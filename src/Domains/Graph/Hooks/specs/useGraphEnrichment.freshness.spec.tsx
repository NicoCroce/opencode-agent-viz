import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect, type ReactElement, type ReactNode } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  type QueryClient as TQueryClient,
} from '@tanstack/react-query';
import type { V2Event } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../../../queryKeys';
import type { TGraphModel } from '../../Graph.entity';
import { buildGraph } from '../../lib/buildGraph';
import { reduceEvent, type TReducibleEvent } from '../../lib/eventReducer';
import { DEFAULT_DIRECTORY, session } from '../../lib/specs/fixtures';
import { useGraphEnrichment } from '../useGraphEnrichment';
import { useGraphModel, type UseGraphModelResult } from '../useGraphModel';

/**
 * Spec de **frescura** del enriquecimiento (criterio L9 del
 * `contracts/graph-loading-contract.md`, FR-009, hallazgo E2):
 *
 * - El enriquecimiento progresivo (`useGraphEnrichment`) escribe en las **mismas
 *   claves** de caché que parchea `eventReducer` (`sessions.messages`,
 *   `permissions.for`, `sessions.log`, `sessions.execution`, `sessions.forms`,
 *   `sessions.inbox`), de modo que la carga inicial y los eventos en vivo
 *   comparten estado (R6) y no aparece una segunda copia divergente.
 * - Un **evento en vivo posterior gana**: como ambas vías escriben la misma
 *   clave, el parche del reducer se aplica sobre el dato enriquecido (y la
 *   siembra del enriquecimiento no pisa un evento ya cacheado).
 * - El modelo refleja el evento en vivo dentro del presupuesto de frescura
 *   (≤ 1 s, FR-009), que es el tick del grafo.
 *
 * Se importan `reduceEvent` (para producir los parches en vivo tal cual los
 * aplica `EventStreamProvider.flush`) y `queryKeys` (para comprobar las claves
 * compartidas). Es tarea de TEST: no modifica `useGraphEnrichment.ts` ni
 * `eventReducer.ts`.
 *
 * Se usa un `QueryClient` con `gcTime: Infinity` (como el cliente de producción,
 * 24 h) en lugar de `renderWithProviders` (que usa `gcTime: 0`): con `gcTime: 0`
 * una clave sin observador —como `sessions.execution`, que el enriquecimiento
 * escribe/lee con `getQueryData`— se recolecta y desaparece, un artefacto que no
 * se da en producción.
 *
 * HALLAZGO (documentado, fuera de alcance): `eventReducer` **no** parchea
 * `permissions.for(id)` —su clave de permisos es `permissions.list()`, un
 * hermano distinto bajo `['permissions']`— y **no** parchea `sessions.log(id)`
 * (solo lo alcanza la invalidación de prefijo `['sessions']`). Por tanto la
 * afirmación "mismas claves" de L9/R6 solo es literal para
 * `sessions.messages`/`sessions.execution` (y de prefijo para forms/inbox/log);
 * el estado `waiting-permission` derivado de permisos no se refresca por SSE a
 * través de la caché compartida. Es una divergencia **preexistente** (el
 * `useGraphModel` anterior ya leía `permissions.for(id)`) y la paridad FR-007 la
 * conserva; se caracteriza aquí y no se corrige (fuera del alcance de T042).
 */

const service = vi.hoisted(() => ({
  listSessions: vi.fn(),
  listAgents: vi.fn(),
  getSessionMessages: vi.fn(),
  getSessionPermissions: vi.fn(),
  getSessionLog: vi.fn(),
  listSessionForms: vi.fn(),
  getSessionForm: vi.fn(),
  listSessionInbox: vi.fn(),
}));

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: service,
}));

const ROOT = 'ses-root';

/* ------------------------------------------------------------------ */
/* Fixtures de eventos en vivo (mismas formas que eventReducer.spec)   */
/* ------------------------------------------------------------------ */

const stepStarted = (sessionID: string): V2Event => ({
  id: `evt_step_${sessionID}`,
  created: 100,
  type: 'session.step.started',
  durable: { aggregateID: sessionID, seq: 10, version: 1 },
  data: {
    sessionID,
    assistantMessageID: `msg_${sessionID}`,
    agent: 'build',
    model: { id: 'claude', providerID: 'anthropic' },
    started: 100,
  },
});

const retryScheduled = (sessionID: string): V2Event => ({
  id: `evt_retry_${sessionID}`,
  created: 200,
  type: 'session.retry.scheduled',
  durable: { aggregateID: sessionID, seq: 40, version: 1 },
  data: {
    sessionID,
    assistantMessageID: `msg_${sessionID}`,
    attempt: 2,
    at: 5000,
    error: { type: 'api', message: 'boom' },
  },
});

const permissionAsked = (sessionID: string): V2Event => ({
  id: `evt_perm_${sessionID}`,
  created: 3,
  type: 'permission.asked',
  data: {
    id: `perm_${sessionID}`,
    sessionID,
    action: 'bash',
    resources: ['echo hi'],
  },
});

const formCreated = (sessionID: string): V2Event => ({
  id: `evt_form_${sessionID}`,
  created: 700,
  type: 'form.created',
  data: {
    form: {
      id: `form_${sessionID}`,
      sessionID,
      title: 'Pregunta',
      fields: [{ type: 'string', key: 'q', title: 'Q' }],
    },
  },
});

const inboxDelivered = (sessionID: string): V2Event => ({
  id: `evt_inbox_${sessionID}`,
  created: 600,
  type: 'session.inbox.delivered',
  durable: { aggregateID: sessionID, seq: 70, version: 1 },
  data: { sessionID, inboxID: `inbox_${sessionID}` },
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Cliente con caché persistente (`gcTime: Infinity`), como el de producción:
 * las claves que el enriquecimiento escribe sin observador no se recolectan.
 */
const createFreshnessClient = (): TQueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    },
  });

const renderWithClient = (ui: ReactElement, queryClient = createFreshnessClient()) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Object.assign(render(ui, { wrapper: Wrapper }), { queryClient });
};

/** Aplica un evento en vivo como `EventStreamProvider.flush` (set/invalidate). */
const applyLiveEvent = (
  queryClient: TQueryClient,
  event: TReducibleEvent,
): void => {
  const updates = reduceEvent(event);
  if (!updates) return;
  for (const update of updates) {
    if (update.kind === 'invalidate') {
      void queryClient.invalidateQueries({ queryKey: update.queryKey });
    } else {
      queryClient.setQueryData(update.queryKey, update.updater);
    }
  }
};

/** `TGraphModel` estructural (todos `pending`) de una raíz con `count - 1` hijos. */
const makeStructure = (prefix: string, count: number): TGraphModel =>
  buildGraph({
    sessions: Array.from({ length: count }, (_, index) =>
      session(`${prefix}-${index}`, {
        parentID: index === 0 ? undefined : `${prefix}-0`,
        time: { created: index + 1, updated: index + 2 },
      }),
    ),
    statuses: {},
    agents: [],
    messages: {},
    permissions: [],
    signals: {},
    forms: [],
    inbox: [],
    enrichment: 'pending',
    now: 0,
  });

let latest: TGraphModel | null = null;

const EnrichmentProbe = ({
  ids,
  structure,
}: {
  ids: string[];
  structure: TGraphModel;
}) => {
  const model = useGraphEnrichment(ids, structure);
  useEffect(() => {
    latest = model;
  });
  return null;
};

let latestModel: UseGraphModelResult | null = null;

const ModelProbe = ({
  sessionId,
  directory,
}: {
  sessionId: string;
  directory: string;
}) => {
  const result = useGraphModel(sessionId, directory);
  useEffect(() => {
    latestModel = result;
  });
  return null;
};

const readyCount = (): number =>
  latest?.nodes.filter((node) => node.data.enrichment === 'ready').length ?? 0;

const pendingCount = (): number =>
  latest?.nodes.filter((node) => node.data.enrichment === 'pending').length ?? 0;

/** Ejecuta un turno de idle (un lote) y deja asentar los efectos de React. */
const runIdleTurn = async (): Promise<void> => {
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
};

/** Avanza turnos de idle hasta completar el subárbol. */
const drain = async (maxTurns = 12): Promise<void> => {
  for (let turn = 0; turn < maxTurns && pendingCount() > 0; turn += 1) {
    await runIdleTurn();
  }
};

const renderEnrichment = (structure: TGraphModel) => {
  const ids = structure.nodes.map((node) => node.id);
  return renderWithClient(<EnrichmentProbe ids={ids} structure={structure} />);
};

describe('useGraphEnrichment — frescura y claves compartidas (L9, FR-009)', () => {
  beforeEach(() => {
    latest = null;
    latestModel = null;
    vi.useFakeTimers();
    // jsdom no implementa `requestIdleCallback`: shim sobre `setTimeout` falso.
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) =>
      setTimeout(
        () =>
          callback({
            didTimeout: false,
            timeRemaining: () => 50,
          }),
        0,
      ),
    );
    vi.stubGlobal('cancelIdleCallback', (handle: number) =>
      clearTimeout(handle),
    );

    service.listSessions.mockReset().mockResolvedValue([]);
    service.listAgents.mockReset().mockResolvedValue([]);
    service.getSessionMessages.mockReset().mockResolvedValue([]);
    service.getSessionPermissions.mockReset().mockResolvedValue([]);
    service.getSessionLog.mockReset().mockResolvedValue([]);
    service.listSessionForms.mockReset().mockResolvedValue([]);
    service.getSessionForm.mockReset().mockResolvedValue(undefined);
    service.listSessionInbox.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('escribe exactamente en las claves compartidas con eventReducer (L9)', async () => {
    const structure = makeStructure('a', 2);
    const view = renderEnrichment(structure);
    const setSpy = vi.spyOn(view.queryClient, 'setQueryData');

    await drain();
    expect(readyCount()).toBe(2);

    const written = new Set(
      setSpy.mock.calls.map(([key]) => JSON.stringify(key)),
    );

    // Las seis claves que L9/R6 declaran compartidas con `eventReducer`.
    const sharedKeys = [
      queryKeys.sessions.messages('a-0'),
      queryKeys.permissions.for('a-0'),
      queryKeys.sessions.log('a-0'),
      queryKeys.sessions.execution('a-0'),
      queryKeys.sessions.forms('a-0'),
      queryKeys.sessions.inbox('a-0'),
    ];
    for (const key of sharedKeys) {
      expect(written.has(JSON.stringify(key))).toBe(true);
    }

    // La clave que parchea un evento en vivo de mensajes es exactamente la que
    // escribió el enriquecimiento: no hay copia paralela (frescura).
    const liveMessagesKey = reduceEvent(stepStarted('a-0'))?.[0].queryKey;
    expect(liveMessagesKey).toEqual(queryKeys.sessions.messages('a-0'));
    expect(written.has(JSON.stringify(liveMessagesKey))).toBe(true);

    setSpy.mockRestore();
  });

  it('caracteriza la cobertura de eventReducer sobre las claves del enriquecimiento (hallazgo)', () => {
    // Claves dirigidas por el reducer para eventos que cubren las seis áreas.
    const reducerEvents: TReducibleEvent[] = [
      stepStarted(ROOT),
      retryScheduled(ROOT),
      permissionAsked(ROOT),
      formCreated(ROOT),
      inboxDelivered(ROOT),
    ];
    const reducerKeys = reducerEvents.flatMap((event) =>
      (reduceEvent(event) ?? []).map((update) => update.queryKey),
    );
    const targets = (key: readonly unknown[]): boolean =>
      reducerKeys.some(
        (reducerKey) => JSON.stringify(reducerKey) === JSON.stringify(key),
      );
    // La invalidación de prefijo `['sessions']` alcanza cualquier subclave.
    const coveredBySessionPrefix = (key: readonly unknown[]): boolean =>
      JSON.stringify(key).startsWith('["sessions"');

    // Compartidas de forma literal: mensajes y ejecución.
    expect(targets(queryKeys.sessions.messages(ROOT))).toBe(true);
    expect(targets(queryKeys.sessions.execution(ROOT))).toBe(true);
    // Compartidas por invalidación dirigida (forms/inbox) o de prefijo (log).
    expect(targets(queryKeys.sessions.forms(ROOT))).toBe(true);
    expect(targets(queryKeys.sessions.inbox(ROOT))).toBe(true);
    expect(coveredBySessionPrefix(queryKeys.sessions.log(ROOT))).toBe(true);

    // HALLAZGO (preexistente, fuera de alcance): el reducer parchea
    // `permissions.list()`, no `permissions.for(id)`; el estado derivado de
    // permisos no se refresca por SSE a través de la caché compartida.
    expect(targets(queryKeys.permissions.for(ROOT))).toBe(false);
    expect(targets(queryKeys.permissions.list())).toBe(true);
  });

  it('un evento en vivo posterior gana sobre el dato enriquecido (mismo caché, L9)', async () => {
    const structure = makeStructure('a', 1);
    const view = renderEnrichment(structure);

    await drain();
    expect(readyCount()).toBe(1);
    // El enriquecimiento dejó la caché de mensajes escrita (vacía) en su clave.
    expect(
      view.queryClient.getQueryData(queryKeys.sessions.messages('a-0')),
    ).toEqual([]);

    // Evento en vivo posterior: escribe en la misma clave y se aplica sobre el
    // dato enriquecido (el reducer parte del valor cacheado).
    act(() => applyLiveEvent(view.queryClient, stepStarted('a-0')));

    const messages = view.queryClient.getQueryData<TSessionMessage[]>(
      queryKeys.sessions.messages('a-0'),
    );
    expect(messages).toHaveLength(1);
    expect(messages?.[0].info.id).toBe('msg_a-0');
  });

  it('la siembra del enriquecimiento no pisa un evento en vivo ya cacheado (FR-009)', async () => {
    const structure = makeStructure('a', 1);
    const view = renderEnrichment(structure);

    // Evento en vivo ANTES de que el enriquecimiento escriba su siembra.
    act(() => applyLiveEvent(view.queryClient, retryScheduled('a-0')));

    await drain();
    expect(readyCount()).toBe(1);

    // La siembra durable (log vacío) no clobbea el retry en vivo: `current` gana.
    const signals = view.queryClient.getQueryData<
      Record<string, { retry: { attempt: number; next: number | null } | null }>
    >(queryKeys.sessions.execution('a-0'));
    expect(signals?.['a-0'].retry).toEqual({ attempt: 2, next: 5000 });
  });

  it('el modelo refleja el evento en vivo dentro del presupuesto de frescura (≤ 1 s)', async () => {
    // El tick de 1 s vive en `useGraphModel`; con timers reales se comprueba que
    // el modelo se actualiza dentro del presupuesto de FR-009.
    vi.useRealTimers();
    service.listSessions.mockResolvedValue([session(ROOT)]);
    service.listAgents.mockResolvedValue([]);

    const view = renderWithClient(
      <ModelProbe sessionId={ROOT} directory={DEFAULT_DIRECTORY} />,
    );

    await waitFor(() => expect(latestModel?.graph.nodes).toHaveLength(1));
    await waitFor(() =>
      expect(latestModel?.graph.nodes[0].data.enrichment).toBe('ready'),
    );

    // Nodo activo: el tick del grafo queda habilitado.
    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.status(), {
        [ROOT]: { type: 'busy' },
      });
    });

    expect(latestModel!.graph.nodes[0].data.metrics.startedAt).toBeNull();

    // Evento en vivo posterior sobre la clave compartida de mensajes.
    act(() => applyLiveEvent(view.queryClient, stepStarted(ROOT)));

    await waitFor(
      () =>
        expect(latestModel!.graph.nodes[0].data.metrics.startedAt).not.toBeNull(),
      { timeout: 1500 },
    );
  });
});
