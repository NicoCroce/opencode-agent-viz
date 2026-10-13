import { useEffect, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
  useQuery,
} from '@tanstack/react-query';
import type { FormInfo, PermissionRequest } from '@opencode/client';
import type {
  TGraphModel,
  TGraphNode,
} from '@app/Domains/Graph/Graph.entity';
import type { TAttentionItem } from '../../Chat.entity';
import { queryKeys } from '../../../queryKeys';
import { useSessionAttention } from '../useSessionAttention';

/**
 * Specs de `useSessionAttention` (feature 009, T049 · US5, FR-009/FR-011).
 *
 * El hook es la **única fuente** de la atención de la sesión abierta: acota el
 * grafo al **subárbol** de `rootId` (raíz + descendientes), lo cruza con la
 * lista global `permissions.list()` y delega en la función pura `deriveAttention`
 * (`contracts/attention-contract.md §1`). Devuelve `TAttentionItem[]` ordenado
 * por `at`. Además enriquece los ítems de pregunta con el `FormInfo` real
 * (`sessions.forms(id)`) para que `id`/`title` no dependan del título del nodo.
 */

type TMetrics = TGraphNode['data']['metrics'];

const metrics = (overrides: Partial<TMetrics> = {}): TMetrics => ({
  durationMs: null,
  startedAt: null,
  endedAt: null,
  cost: null,
  tokens: null,
  invocations: 0,
  retryCount: 0,
  hasLoop: false,
  loopEvidence: [],
  ...overrides,
});

/** Nodo con los defaults del modelo estructural (`buildGraph`). */
const node = (
  id: string,
  overrides: Partial<TGraphNode['data']> = {},
): TGraphNode => ({
  id,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: id,
    title: null,
    createdAt: null,
    updatedAt: null,
    agentName: 'general',
    directory: '/repo',
    model: null,
    status: 'running',
    retry: null,
    interruptReason: null,
    metrics: metrics(),
    isRoot: false,
    currentTool: null,
    parallel: null,
    ...overrides,
  },
});

/** Grafo con aristas padre→hijo (`parentByChild`). */
const model = (
  nodes: TGraphNode[],
  parentByChild: Record<string, string> = {},
): TGraphModel => ({
  nodes,
  edges: Object.entries(parentByChild).map(([target, source]) => ({
    id: `${source}->${target}`,
    source,
    target,
    type: 'agent' as const,
  })),
});

const permission = (
  overrides: Partial<PermissionRequest> &
    Pick<PermissionRequest, 'id' | 'sessionID'>,
): PermissionRequest => ({
  action: 'bash',
  resources: ['echo hi'],
  ...overrides,
});

const form = (
  overrides: Partial<FormInfo> & Pick<FormInfo, 'id' | 'sessionID'>,
): FormInfo => ({
  title: 'Pregunta',
  fields: [{ key: 'answer', type: 'string' }],
  ...overrides,
});

/** Renderiza el hook con un `QueryClient` sembrable y estable por test. */
const renderAttention = (
  rootId: string | null,
  graph: TGraphModel,
  seed: (queryClient: QueryClient) => void = () => {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  seed(queryClient);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(() => useSessionAttention(rootId, graph), {
    wrapper,
  });
  return { ...rendered, queryClient };
};

describe('useSessionAttention — subárbol y permisos (FR-009)', () => {
  it('returns an empty list without a rootId (A3)', () => {
    const graph = model([
      node('root', { isRoot: true, status: 'waiting-permission' }),
    ]);

    const { result } = renderAttention(null, graph);

    expect(result.current).toEqual([]);
  });

  it('returns an empty list without pendings (A3)', () => {
    const graph = model(
      [
        node('root', { isRoot: true, status: 'running' }),
        node('child', { status: 'succeeded' }),
      ],
      { child: 'root' },
    );

    const { result } = renderAttention('root', graph);

    expect(result.current).toEqual([]);
  });

  it('produces a permission item from the global permissions.list() (A1)', () => {
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-permission',
        updatedAt: 1000,
      }),
    ]);

    const { result } = renderAttention('root', graph, (queryClient) =>
      queryClient.setQueryData(
        queryKeys.permissions.list(),
        [permission({ id: 'perm_1', sessionID: 'root', action: 'edit' })],
      ),
    );

    expect(result.current).toEqual<TAttentionItem[]>([
      {
        id: 'perm_1',
        kind: 'permission',
        sessionId: 'root',
        nodeId: 'root',
        title: 'edit',
        at: 1000,
      },
    ]);
  });

  it('reports a descendant pending with its origin sessionId (A2)', () => {
    const graph = model(
      [
        node('root', { isRoot: true, status: 'running' }),
        node('child', { status: 'waiting-permission', updatedAt: 2000 }),
      ],
      { child: 'root' },
    );

    const { result } = renderAttention('root', graph, (queryClient) =>
      queryClient.setQueryData(queryKeys.permissions.list(), [
        permission({ id: 'perm_child', sessionID: 'child', action: 'bash' }),
      ]),
    );

    expect(result.current).toEqual<TAttentionItem[]>([
      {
        id: 'perm_child',
        kind: 'permission',
        sessionId: 'child',
        nodeId: 'child',
        title: 'bash',
        at: 2000,
      },
    ]);
  });

  it('scopes the graph to the root subtree and ignores other branches', () => {
    // `other` cuelga de `uncle` (fuera del subárbol de `root`): su pendiente no
    // debe aparecer aunque deriveAttention sobre el grafo completo lo vería.
    const graph = model(
      [
        node('root', { isRoot: true, status: 'running' }),
        node('child', { status: 'waiting-permission', updatedAt: 2000 }),
        node('uncle', { status: 'running' }),
        node('other', { status: 'waiting-permission', updatedAt: 1000 }),
      ],
      { child: 'root', other: 'uncle' },
    );

    const { result } = renderAttention('root', graph, (queryClient) =>
      queryClient.setQueryData(queryKeys.permissions.list(), [
        permission({ id: 'perm_child', sessionID: 'child' }),
        permission({ id: 'perm_other', sessionID: 'other' }),
      ]),
    );

    expect(result.current.map((item) => item.id)).toEqual(['perm_child']);
  });

  it('orders the items by `at` ascending', () => {
    const graph = model(
      [
        node('root', {
          isRoot: true,
          status: 'waiting-permission',
          updatedAt: 3000,
        }),
        node('child', { status: 'waiting-permission', updatedAt: 1000 }),
      ],
      { child: 'root' },
    );

    const { result } = renderAttention('root', graph, (queryClient) =>
      queryClient.setQueryData(queryKeys.permissions.list(), [
        permission({ id: 'perm_root', sessionID: 'root' }),
        permission({ id: 'perm_child', sessionID: 'child' }),
      ]),
    );

    expect(result.current.map((item) => item.at)).toEqual([1000, 3000]);
  });

  it('reacts to permissions.list() updates (FR-011)', () => {
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-permission',
        updatedAt: 1000,
      }),
    ]);

    const { result, queryClient } = renderAttention('root', graph);
    expect(result.current).toEqual([]);

    act(() => {
      queryClient.setQueryData(queryKeys.permissions.list(), [
        permission({ id: 'perm_1', sessionID: 'root' }),
      ]);
    });

    expect(result.current.map((item) => item.id)).toEqual(['perm_1']);

    act(() => {
      queryClient.setQueryData(queryKeys.permissions.list(), []);
    });

    expect(result.current).toEqual([]);
  });
});

describe('useSessionAttention — enriquecimiento de preguntas (T048 pendiente)', () => {
  it('falls back to the node title when no form is cached', () => {
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-input',
        title: 'Elige una opción',
        updatedAt: 500,
      }),
    ]);

    const { result } = renderAttention('root', graph);

    expect(result.current).toEqual<TAttentionItem[]>([
      {
        id: 'question:root',
        kind: 'question',
        sessionId: 'root',
        nodeId: 'root',
        title: 'Elige una opción',
        at: 500,
      },
    ]);
  });

  it('enriches the id and title with the cached FormInfo', () => {
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-input',
        title: 'Título del nodo',
        updatedAt: 500,
      }),
    ]);

    const { result } = renderAttention('root', graph, (queryClient) =>
      queryClient.setQueryData(queryKeys.sessions.forms('root'), [
        form({ id: 'form_1', sessionID: 'root', title: '¿Continuar?' }),
      ]),
    );

    expect(result.current).toEqual<TAttentionItem[]>([
      {
        id: 'form_1',
        kind: 'question',
        sessionId: 'root',
        nodeId: 'root',
        title: '¿Continuar?',
        at: 500,
      },
    ]);
  });

  it('re-enriches when the forms cache arrives after mount', () => {
    const graph = model([
      node('child', { status: 'waiting-input', title: 'Título del nodo' }),
    ]);

    const { result, queryClient } = renderAttention('child', graph);
    expect(result.current[0]?.id).toBe('question:child');

    act(() => {
      queryClient.setQueryData(queryKeys.sessions.forms('child'), [
        form({ id: 'form_child', sessionID: 'child', title: 'Elige' }),
      ]);
    });

    expect(result.current[0]?.id).toBe('form_child');
    expect(result.current[0]?.title).toBe('Elige');
  });
});

/**
 * Contenido del histórico (feature 013, T011 · US2/FR-003).
 *
 * El `kind: 'question'` debe conservar el mismo contenido que hoy: `id`/`title`
 * del `FormInfo` cacheado (`sessions.forms(id)`) cuando existe; sin formulario,
 * el respaldo (`id` = `question:<sessionId>`, `title` = título del nodo). Las
 * preguntas de sesiones **hijas** del subárbol se enriquecen igual.
 */
describe('useSessionAttention — contenido del histórico (T011)', () => {
  it('takes the id and title from the cached FormInfo (a)', () => {
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-input',
        title: 'Título del nodo',
        updatedAt: 500,
      }),
    ]);

    const { result } = renderAttention('root', graph, (queryClient) =>
      queryClient.setQueryData(queryKeys.sessions.forms('root'), [
        form({ id: 'form_1', sessionID: 'root', title: '¿Continuar?' }),
      ]),
    );

    expect(result.current).toEqual<TAttentionItem[]>([
      {
        id: 'form_1',
        kind: 'question',
        sessionId: 'root',
        nodeId: 'root',
        title: '¿Continuar?',
        at: 500,
      },
    ]);
  });

  it('keeps the question:<sessionId> fallback with an empty forms list (b)', () => {
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-input',
        title: 'Elige una opción',
        updatedAt: 500,
      }),
    ]);

    const { result } = renderAttention('root', graph, (queryClient) =>
      queryClient.setQueryData(queryKeys.sessions.forms('root'), []),
    );

    expect(result.current).toEqual<TAttentionItem[]>([
      {
        id: 'question:root',
        kind: 'question',
        sessionId: 'root',
        nodeId: 'root',
        title: 'Elige una opción',
        at: 500,
      },
    ]);
  });

  it('enriches questions from child sessions of the subtree (c)', () => {
    const graph = model(
      [
        node('root', { isRoot: true, status: 'running' }),
        node('child', {
          status: 'waiting-input',
          title: 'Título del hijo',
          updatedAt: 2000,
        }),
      ],
      { child: 'root' },
    );

    const { result } = renderAttention('root', graph, (queryClient) =>
      queryClient.setQueryData(queryKeys.sessions.forms('child'), [
        form({ id: 'form_child', sessionID: 'child', title: 'Pregunta hija' }),
      ]),
    );

    expect(result.current).toEqual<TAttentionItem[]>([
      {
        id: 'form_child',
        kind: 'question',
        sessionId: 'child',
        nodeId: 'child',
        title: 'Pregunta hija',
        at: 2000,
      },
    ]);
  });

  it('keeps the fallback for a child session without a cached form (c)', () => {
    const graph = model(
      [
        node('root', { isRoot: true, status: 'running' }),
        node('child', { status: 'waiting-input', title: 'Título del hijo' }),
      ],
      { child: 'root' },
    );

    const { result } = renderAttention('root', graph, (queryClient) =>
      queryClient.setQueryData(queryKeys.sessions.forms('child'), []),
    );

    expect(result.current).toEqual<TAttentionItem[]>([
      {
        id: 'question:child',
        kind: 'question',
        sessionId: 'child',
        nodeId: 'child',
        title: 'Título del hijo',
        at: 0,
      },
    ]);
  });
});

/**
 * Regresión del cuelgue del histórico (feature 013, T005 · US4/FR-006).
 *
 * `useSessionAttention` enriquece las preguntas suscribiéndose a la `QueryCache`
 * (`useCachedForms`). El defecto: el filtro casa por **prefijo**, de modo que
 * `sessions.questions(id)` (= `[...forms(id), 'questions']`) también dispara
 * `sync()`, y `read()` devuelve un objeto nuevo en cada notificación. Un
 * observador real sobre `questions(id)` (como `useSessionForms` en el Inspector)
 * emite `observerOptionsUpdated` en cada render, cerrando el ciclo
 * `sync → setForms → render → observer.setOptions → notify → ∞`.
 *
 * Estas pruebas montan el hook junto a ese observador real. Hoy **no terminan**
 * (bucle de render); tras el arreglo (clave exacta + identidad estable + solo
 * eventos de dato) convergen y conservan el enriquecimiento.
 */

let latestItems: TAttentionItem[] = [];

/**
 * Sonda del hook **y** observador real en el **mismo** componente, como
 * `WorkspacePage` (que monta `useSessionAttention` y `useSessionForms` juntos):
 * el `setForms` del índice re-renderiza la sonda, con lo que el observador
 * re-ejecuta su efecto (`observer.setOptions`) y notifica de nuevo. Ese es el
 * ciclo que hoy no termina.
 */
const AttentionProbe = ({
  rootId,
  graph,
}: {
  rootId: string;
  graph: TGraphModel;
}) => {
  const items = useSessionAttention(rootId, graph);
  useQuery({
    queryKey: queryKeys.sessions.questions(rootId),
    // `queryFn` inline: nueva identidad en cada render, así `observer.setOptions`
    // emite `observerOptionsUpdated` (la notificación que hoy cierra el bucle).
    queryFn: () => Promise.resolve([]),
    enabled: false,
    staleTime: Infinity,
  });
  useEffect(() => {
    latestItems = items;
  });
  return null;
};

/** Renderiza la sonda (hook + observador real) con una caché sembrable. */
const renderAttentionWithObserver = (
  rootId: string,
  graph: TGraphModel,
  seed: (queryClient: QueryClient) => void = () => {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  seed(queryClient);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = render(<AttentionProbe rootId={rootId} graph={graph} />, {
    wrapper,
  });
  return { ...rendered, queryClient };
};

describe('useSessionAttention — regresión del cuelgue del histórico (T005)', () => {
  it(
    'converges and enriches the question when sessions.forms(id) arrives',
    { timeout: 2_000 },
    () => {
      latestItems = [];
      const graph = model([
        node('root', {
          isRoot: true,
          status: 'waiting-input',
          title: 'Título del nodo',
          updatedAt: 500,
        }),
      ]);

      const { queryClient } = renderAttentionWithObserver('root', graph);

      // Sin formulario cacheado: respaldo del título del nodo.
      expect(latestItems.map((item) => item.id)).toEqual(['question:root']);

      act(() => {
        queryClient.setQueryData(queryKeys.sessions.forms('root'), [
          form({ id: 'form_1', sessionID: 'root', title: '¿Continuar?' }),
        ]);
      });

      // Converge (no cuelga) y enriquece `id`/`title` con el `FormInfo` cacheado.
      expect(latestItems).toEqual<TAttentionItem[]>([
        {
          id: 'form_1',
          kind: 'question',
          sessionId: 'root',
          nodeId: 'root',
          title: '¿Continuar?',
          at: 500,
        },
      ]);
    },
  );

  it(
    'keeps the index identity when a notification does not change the data',
    { timeout: 2_000 },
    () => {
      latestItems = [];
      const graph = model([
        node('root', {
          isRoot: true,
          status: 'waiting-input',
          title: 'Título del nodo',
          updatedAt: 500,
        }),
      ]);
      const cachedForms = [
        form({ id: 'form_1', sessionID: 'root', title: '¿Continuar?' }),
      ];

      const { queryClient } = renderAttentionWithObserver(
        'root',
        graph,
        (client) =>
          client.setQueryData(queryKeys.sessions.forms('root'), cachedForms),
      );

      const enriched = latestItems;
      expect(enriched.map((item) => item.id)).toEqual(['form_1']);

      // Instrumentación para que la aserción de identidad no sea vacua: se
      // observan las **dos** etapas de la notificación. Primero el evento de la
      // `QueryCache` (¿se emitió?), que es lo que la suscripción filtra por tipo
      // y clave exacta; después las lecturas de `sessions.forms(id)` (¿el
      // manejador llegó a ejecutar `read()`?). Si la suscripción no se disparase,
      // el `toBe` final pasaría igual: por eso ambas aserciones son previas.
      const formsKey = queryKeys.sessions.forms('root');
      const seen: Array<{ type: string; key: readonly unknown[] }> = [];
      const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
        seen.push({
          type: event.type,
          key: event.query.queryKey as readonly unknown[],
        });
      });
      const spy = vi.spyOn(queryClient, 'getQueryData');
      // Control del espía: sin notificación el contador no se mueve por sí solo
      // (el efecto ya montado no relee). Es la línea base del delta de abajo.
      expect(formsKeyReads(spy, 'root')).toBe(0);

      // Notificación de la clave exacta que devuelve el mismo dato (misma
      // referencia): el índice no debe cambiar de identidad ⇒ sin estado nuevo.
      act(() => {
        queryClient.setQueryData(
          formsKey,
          (previous: FormInfo[] | undefined) => previous,
        );
      });

      unsubscribe();

      // El evento portador de dato llegó de verdad a la caché (no es vacuo)…
      expect(
        seen.filter(
          (event) =>
            event.type === 'updated' &&
            JSON.stringify(event.key) === JSON.stringify(formsKey),
        ),
      ).toHaveLength(1);
      // …y el manejador de la suscripción lo procesó leyendo la clave exacta.
      expect(formsKeyReads(spy, 'root')).toBe(1);
      expect(latestItems).toBe(enriched);

      spy.mockRestore();
    },
  );
});

/**
 * Invariantes de la suscripción a la caché (feature 013, R1/R2/R3 ·
 * `contracts/attention-forms-subscription.md` §2–§4).
 *
 * La regresión de T005 solo cubre el **efecto** (convergencia + identidad ante
 * una escritura del mismo dato). Estas pruebas fijan además el **filtro** de
 * `useCachedForms`, que es la causa raíz:
 *
 *  - **R1** (§2): reaccionar **solo** a la clave exacta `['sessions','forms',id]`
 *    y **solo** para sesiones con pregunta pendiente. `sessions.questions(id)`
 *    (= `[...forms(id),'questions']`) comparte prefijo y **no** debe leerse.
 *  - **R2** (§3): identidad estable del índice: sin cambio de dato no hay
 *    `setState` ni render.
 *  - **R3** (§4): solo eventos portadores de dato (`type === 'updated'`); los
 *    estructurales (`observerOptionsUpdated`/`observerResultsUpdated`) no son
 *    cambio de dato.
 *
 * Señal observable: además del render y de la identidad del índice —que son lo
 * que ve el histórico— se espía `queryClient.getQueryData` filtrando **solo** las
 * lecturas de la clave exacta `sessions.forms(id)`. Es la única señal que
 * distingue «no reaccionar» de «reaccionar y devolver el mismo dato» (R2 sola ya
 * evita el render) y es exactamente el trabajo que el contrato prohíbe.
 */

/** Renders de la sonda sin observadores (aisla render de otras fuentes). */
let probeRenders = 0;

/**
 * Sonda del hook **sin** `useQuery`: sin observadores añadidos, cualquier render
 * viene de un `setState` del propio `useCachedForms`. Cuenta los commits en un
 * efecto (nunca durante el render).
 */
const AttentionRenderProbe = ({
  rootId,
  graph,
}: {
  rootId: string;
  graph: TGraphModel;
}) => {
  const items = useSessionAttention(rootId, graph);
  useEffect(() => {
    latestItems = items;
    probeRenders += 1;
  });
  return null;
};

/** Renderiza la sonda del hook con una caché sembrable y estable por test. */
const renderAttentionProbe = (
  rootId: string,
  graph: TGraphModel,
  seed: (queryClient: QueryClient) => void = () => {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  seed(queryClient);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = render(
    <AttentionRenderProbe rootId={rootId} graph={graph} />,
    { wrapper },
  );
  return { ...rendered, queryClient };
};

/** Espía de `getQueryData`. */
type TCacheReadSpy = {
  mock: { calls: ReadonlyArray<ReadonlyArray<unknown>> };
};

/** Nº de lecturas de la clave **exacta** `sessions.forms(id)`. */
const formsKeyReads = (spy: TCacheReadSpy, id: string): number =>
  spy.mock.calls.filter(
    ([key]) =>
      JSON.stringify(key) === JSON.stringify(queryKeys.sessions.forms(id)),
  ).length;

describe('useSessionAttention — filtro de la suscripción a la caché (R1/R2/R3)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('no lee sessions.forms(id) ante un evento `updated` de sessions.questions(id) (R1)', () => {
    latestItems = [];
    probeRenders = 0;
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-input',
        title: 'Título del nodo',
        updatedAt: 500,
      }),
    ]);

    const { queryClient } = renderAttentionProbe('root', graph, (client) =>
      client.setQueryData(queryKeys.sessions.forms('root'), [
        form({ id: 'form_1', sessionID: 'root', title: '¿Continuar?' }),
      ]),
    );

    const enriched = latestItems;
    expect(enriched.map((item) => item.id)).toEqual(['form_1']);
    const renders = probeRenders;

    // Evento **portador de dato** sobre la clave anidada (`questions(id)`), que
    // con el filtro por prefijo habría disparado `sync()`.
    const spy = vi.spyOn(queryClient, 'getQueryData');
    act(() => {
      queryClient.setQueryData(queryKeys.sessions.questions('root'), [
        { id: 'question_1', state: 'resolved' },
      ]);
    });

    expect(formsKeyReads(spy, 'root')).toBe(0);
    expect(probeRenders).toBe(renders);
    expect(latestItems).toBe(enriched);

    spy.mockRestore();
  });

  it('no lee sessions.forms(id) ante formularios de una sesión sin pregunta pendiente (R1)', () => {
    latestItems = [];
    probeRenders = 0;
    const graph = model(
      [
        node('root', {
          isRoot: true,
          status: 'waiting-input',
          title: 'Título del nodo',
          updatedAt: 500,
        }),
        // Hijo del subárbol en ejecución: sin pregunta, no entra en el conjunto.
        node('child', { status: 'running' }),
      ],
      { child: 'root' },
    );

    const { queryClient } = renderAttentionProbe('root', graph, (client) =>
      client.setQueryData(queryKeys.sessions.forms('root'), [
        form({ id: 'form_1', sessionID: 'root', title: '¿Continuar?' }),
      ]),
    );

    const enriched = latestItems;
    expect(enriched).toHaveLength(1);
    const renders = probeRenders;

    const spy = vi.spyOn(queryClient, 'getQueryData');
    act(() => {
      queryClient.setQueryData(queryKeys.sessions.forms('child'), [
        form({ id: 'form_child', sessionID: 'child', title: 'Otra pregunta' }),
      ]);
    });

    expect(formsKeyReads(spy, 'root')).toBe(0);
    expect(probeRenders).toBe(renders);
    expect(latestItems).toBe(enriched);
    expect(latestItems.map((item) => item.id)).toEqual(['form_1']);

    spy.mockRestore();
  });

  it('ignora un evento estructural del observador y sigue re-enriqueciendo con dato nuevo (R3)', () => {
    latestItems = [];
    probeRenders = 0;
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-input',
        title: 'Título del nodo',
        updatedAt: 500,
      }),
    ]);

    const { queryClient } = renderAttentionProbe('root', graph, (client) =>
      client.setQueryData(queryKeys.sessions.forms('root'), [
        form({ id: 'form_1', sessionID: 'root', title: '¿Continuar?' }),
      ]),
    );

    const enriched = latestItems;
    expect(enriched.map((item) => item.id)).toEqual(['form_1']);
    const renders = probeRenders;

    // Observador real sobre la clave **anidada**, como `useSessionForms` (U7) en
    // el Inspector: cambiar la identidad de `queryFn` (lo que hace un `queryFn`
    // inline en cada render) emite `observerOptionsUpdated` a la `QueryCache`.
    const observer = new QueryObserver(queryClient, {
      queryKey: queryKeys.sessions.questions('root'),
      queryFn: () => Promise.resolve([]),
      enabled: false,
      staleTime: Infinity,
    });

    const seen: string[] = [];
    const unsubscribe = queryClient.getQueryCache().subscribe((event) =>
      seen.push(event.type),
    );
    const spy = vi.spyOn(queryClient, 'getQueryData');

    act(() => {
      observer.setOptions({
        queryKey: queryKeys.sessions.questions('root'),
        queryFn: () => Promise.resolve([]),
        enabled: false,
        staleTime: Infinity,
      });
    });
    unsubscribe();
    observer.destroy();

    // El evento estructural llegó de verdad a la caché (la aserción no es vacía)…
    expect(seen).toContain('observerOptionsUpdated');
    // …y el contrato manda no tratarlo como cambio de dato: ni lectura ni render.
    expect(formsKeyReads(spy, 'root')).toBe(0);
    expect(probeRenders).toBe(renders);
    expect(latestItems).toBe(enriched);

    // Control positivo: la suscripción sigue viva y re-enriquece con el dato nuevo.
    act(() => {
      queryClient.setQueryData(queryKeys.sessions.forms('root'), [
        form({ id: 'form_2', sessionID: 'root', title: '¿Seguir?' }),
      ]);
    });

    expect(latestItems.map((item) => item.id)).toEqual(['form_2']);
    expect(latestItems.map((item) => item.title)).toEqual(['¿Seguir?']);

    spy.mockRestore();
  });
});
