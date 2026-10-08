import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { queryKeys } from '../../../queryKeys';
import {
  DEFAULT_DIRECTORY,
  assistantMessage,
  busyStatus,
  idleStatus,
  session,
} from '../../lib/specs/fixtures';
import { useGraphModel } from '../useGraphModel';

/**
 * Spec del tick condicionado del modelo (T032, FR-006, SC-005, R3).
 *
 * Contrato: al avanzar `now` solo los nodos **activos** cambian de `durationMs`;
 * los inactivos conservan la **identidad** (`===`) de su objeto y no se
 * reacomodan. Sin ningún nodo activo (`isActiveStatus`) no hay tick, así que el
 * modelo permanece estable aunque pase el tiempo.
 *
 * Se controlan los turnos de idle con temporizadores falsos (jsdom no implementa
 * `requestIdleCallback`: se shimea sobre `setTimeout`, como en
 * `useGraphEnrichment.spec.tsx`) y el mapa de estados global
 * (`queryKeys.sessions.status()`) para fijar qué nodo está activo.
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

const ROOT_ID = 'ses-root';
const CHILD_ID = 'ses-child';

const START = new Date('2026-01-01T00:00:00.000Z').getTime();
const SECOND = 1_000;

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

const renderGraph = (client: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useGraphModel(ROOT_ID, DEFAULT_DIRECTORY), {
    wrapper: Wrapper,
  });
};

type GraphHook = ReturnType<typeof renderGraph>;

/**
 * Un turno de idle (un lote de enriquecimiento). Avanza 1 ms —por debajo del
 * tick de 1 s— para que se disparen los `setTimeout(0)` del shim de idle y se
 * resuelvan las promesas pendientes sin disparar el `setInterval` del reloj.
 */
const idleTurn = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
};

/** Avanza turnos de idle hasta que todo el subárbol quede `ready`. */
const drain = async (hook: GraphHook, maxTurns = 16): Promise<void> => {
  for (let turn = 0; turn < maxTurns; turn += 1) {
    const nodes = hook.result.current.graph.nodes;
    if (
      nodes.length > 0 &&
      nodes.every((node) => node.data.enrichment === 'ready')
    ) {
      return;
    }
    await idleTurn();
  }
};

const nodeById = (hook: GraphHook, id: string) => {
  const node = hook.result.current.graph.nodes.find(
    (candidate) => candidate.id === id,
  );
  if (!node) throw new Error(`nodo ${id} no encontrado`);
  return node;
};

/** Subárbol raíz → un hijo. */
const buildSubtree = () => [
  session(ROOT_ID),
  session(CHILD_ID, { parentID: ROOT_ID }),
];

/**
 * Contenido por sesión: la raíz activa no tiene `time.completed` (duración viva);
 * el hijo inactivo sí (duración fija).
 */
const seedContent = () => {
  service.getSessionMessages.mockImplementation((id: string) =>
    Promise.resolve(
      id === ROOT_ID
        ? [assistantMessage({ id: 'msg_root', time: { created: 2 } })]
        : [
            assistantMessage({
              id: 'msg_child',
              time: { created: 2, completed: 5 },
            }),
          ],
    ),
  );
};

describe('useGraphModel — tick solo con nodos activos (FR-006, SC-005)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) =>
      setTimeout(
        () =>
          callback({ didTimeout: false, timeRemaining: () => 50 }),
        0,
      ),
    );
    vi.stubGlobal('cancelIdleCallback', (handle: number) =>
      clearTimeout(handle),
    );

    service.listSessions.mockReset().mockResolvedValue(buildSubtree());
    service.listAgents.mockReset().mockResolvedValue([]);
    service.getSessionPermissions.mockReset().mockResolvedValue([]);
    service.getSessionLog.mockReset().mockResolvedValue([]);
    service.listSessionForms.mockReset().mockResolvedValue([]);
    service.getSessionForm.mockReset().mockResolvedValue(undefined);
    service.listSessionInbox.mockReset().mockResolvedValue([]);
    seedContent();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('al avanzar now solo el nodo activo cambia de durationMs; el inactivo conserva identidad', async () => {
    const client = createClient();
    client.setQueryData(queryKeys.sessions.status(), {
      [ROOT_ID]: busyStatus,
      [CHILD_ID]: idleStatus,
    });

    const hook = renderGraph(client);
    await drain(hook);

    const activeBefore = nodeById(hook, ROOT_ID);
    const inactiveBefore = nodeById(hook, CHILD_ID);

    // Estados finales (ya enriquecidos): activo vs. terminado.
    expect(activeBefore.data.enrichment).toBe('ready');
    expect(activeBefore.data.status).toBe('running');
    expect(inactiveBefore.data.enrichment).toBe('ready');
    expect(inactiveBefore.data.status).toBe('succeeded');

    const activeDurationBefore = activeBefore.data.metrics.durationMs;
    const inactiveDurationBefore = inactiveBefore.data.metrics.durationMs;
    expect(activeDurationBefore).not.toBeNull();
    expect(inactiveDurationBefore).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SECOND);
    });

    const activeAfter = nodeById(hook, ROOT_ID);
    const inactiveAfter = nodeById(hook, CHILD_ID);

    // El activo avanza exactamente el tick y se reemplaza por un nodo nuevo…
    expect(activeAfter).not.toBe(activeBefore);
    expect(activeAfter.data.metrics.durationMs).toBe(
      (activeDurationBefore as number) + SECOND,
    );

    // …mientras el inactivo conserva el **mismo objeto** y su duración.
    expect(inactiveAfter).toBe(inactiveBefore);
    expect(inactiveAfter.data.metrics.durationMs).toBe(inactiveDurationBefore);

    // El tick no reacomoda el grafo.
    expect(activeAfter.position).toEqual(activeBefore.position);
  });

  it('sin nodos activos no hay tick: el modelo no cambia con el tiempo', async () => {
    const client = createClient();
    client.setQueryData(queryKeys.sessions.status(), {
      [ROOT_ID]: idleStatus,
      [CHILD_ID]: idleStatus,
    });

    const hook = renderGraph(client);
    await drain(hook);

    const before = hook.result.current.graph.nodes;
    expect(before.every((node) => node.data.enrichment === 'ready')).toBe(true);
    expect(before.some((node) => node.data.status === 'running')).toBe(false);
    // Sin nodos activos no queda ningún `setInterval` vivo.
    expect(vi.getTimerCount()).toBe(0);

    const durations = before.map((node) => node.data.metrics.durationMs);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * SECOND);
    });

    const after = hook.result.current.graph.nodes;
    // Identidad estable nodo a nodo y duraciones congeladas.
    expect(after).toHaveLength(before.length);
    after.forEach((node, index) => {
      expect(node).toBe(before[index]);
      expect(node.data.metrics.durationMs).toBe(durations[index]);
    });
  });
});
