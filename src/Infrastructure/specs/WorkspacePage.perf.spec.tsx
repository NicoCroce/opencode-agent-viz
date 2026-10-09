import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SessionInfo, SessionStatus } from '@opencode/client';
import { queryKeys } from '@app/Domains/queryKeys';
import {
  PERF_METRIC,
  perfMark,
  perfMeasure,
} from '@app/Application/Helpers/perf';
import type { TGraphModel } from '@app/Domains/Graph/Graph.entity';
import {
  assistantMessage,
  busyStatus,
  idleStatus,
  session,
} from '@app/Domains/Graph/lib/specs/fixtures';
import { useRootSessions } from '@app/Domains/Sessions';
import { WorkspacePage } from '../WorkspacePage';

/**
 * Espía del `useNow` que consume `WorkspacePage` para el tick del resumen
 * (T041). El `useGraphModel` real importa `useNow` por ruta directa, así que no
 * pasa por el barrel y este espía observa **solo** la decisión de la página.
 */
const graphHooks = vi.hoisted(() => ({
  useNow: vi.fn<(options?: { enabled?: boolean; intervalMs?: number }) => number>(),
  /**
   * Captura las props con las que `GraphPane` monta `AgentGraph` para observar
   * la identidad de los nodos del modelo (SC-006, T053) sin renderizar React Flow.
   */
  agentGraph: vi.fn(),
}));

/**
 * Spec del criterio P4 del contrato de instrumentación
 * (`specs/006-graph-render-performance/contracts/performance-instrumentation-contract.md`):
 * `graph.session.open` y `graph.session.revisit` se distinguen por la presencia
 * de la **estructura** del subárbol en el caché de consultas.
 *
 * La detección de "estructura en caché" vive en `WorkspacePage` (T021). Para
 * ejercitarla de forma fiel se usa el **modelo real** (`useGraphModel` sobre
 * `sessions.list`/`status`/`agents.list`) y se controla el caché: la estructura
 * está cacheada cuando esas claves ya están sembradas (revisita) y no lo está
 * cuando el caché arranca vacío (apertura fría). Así el test es válido tanto si
 * la página detecta el caché leyendo `queryClient.getQueryData(...)` como si lo
 * infiere de `graph.isLoading`.
 *
 * Solo se sustituyen las dependencias pesadas de presentación (React Flow, el
 * inspector y el histórico) y el acceso al SDK (`opencodeService`). Las marcas
 * `perfMark`/`perfMeasure` se mockean para observar el nombre de la medida sin
 * depender de la Performance API de jsdom (el helper real se cubre en
 * `Application/Helpers/specs/perf.spec.ts`).
 */

vi.mock('@app/Application/Helpers/perf', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@app/Application/Helpers/perf')>();
  return {
    ...actual,
    perfMark: vi.fn(),
    perfMeasure: vi.fn(() => 0),
  };
});

/**
 * `@app/Domains/Graph`: se conservan los hooks reales (el modelo por fases) y
 * se sustituyen solo los componentes que montan React Flow.
 */
vi.mock('@app/Domains/Graph', async () => {
  const { useGraphModel } = await import(
    '@app/Domains/Graph/Hooks/useGraphModel'
  );
  const { useNow } = await import('@app/Domains/Graph/Hooks/useNow');
  const { useChainSelection } = await import(
    '@app/Domains/Graph/Hooks/useChainSelection'
  );
  const { useFollowMode } = await import(
    '@app/Domains/Graph/Hooks/useFollowMode'
  );
  const { summarizeSession } = await import(
    '@app/Domains/Graph/lib/deriveMetrics'
  );
  const { isActiveStatus } = await import(
    '@app/Domains/Graph/lib/nodeStatus'
  );

  graphHooks.useNow.mockImplementation(useNow);

  return {
    AgentGraph: graphHooks.agentGraph,
    GraphSkeleton: () => null,
    SessionSummaryBar: () => null,
    isActiveStatus,
    summarizeSession,
    useChainSelection,
    useFollowMode,
    useGraphModel,
    useNow: graphHooks.useNow,
  };
});

vi.mock('@app/Domains/Sessions', () => ({
  SessionList: () => null,
  SessionListSkeleton: () => null,
  sessionDetailPath: (id: string) => `/sessions/${id}`,
  useGetSessionStatus: () => ({ data: {} }),
  useRootSessions: vi.fn(),
}));

vi.mock('@app/Domains/Inspector', () => ({
  InspectorPanel: () => null,
  useSessionContext: () => ({
    messages: [],
    isError: false,
    isLoading: false,
  }),
  useSessionForms: () => ({ questions: [] }),
}));

vi.mock('@app/Domains/History', () => ({
  HistoryModal: () => null,
  useHistory: () => ({
    targetId: null,
    open: vi.fn(),
    close: vi.fn(),
    navigateTo: vi.fn(),
  }),
}));

/** SDK fuera de la ecuación: la estructura sale del caché, no de la red. */
vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: {
    listProjects: vi.fn(() => Promise.resolve([])),
    listSessions: vi.fn(),
    listAgents: vi.fn(() => Promise.resolve([])),
    getSessionMessages: vi.fn(() => Promise.resolve([])),
    getSessionPermissions: vi.fn(() => Promise.resolve([])),
    getSessionLog: vi.fn(() => Promise.resolve([])),
    listSessionForms: vi.fn(() => Promise.resolve([])),
    getSessionForm: vi.fn(() => Promise.resolve({})),
    listSessionInbox: vi.fn(() => Promise.resolve([])),
    getActiveSessions: vi.fn(() => Promise.resolve({})),
    subscribeEvents: vi.fn(),
  },
}));

const SESSION_ID = 'ses_root';
const DIRECTORY = '/repo';

const sessionInfo: SessionInfo = {
  id: SESSION_ID,
  projectID: 'proj',
  agent: 'develop',
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  title: 'tarea',
  time: { created: 1, updated: 2 },
  location: { directory: DIRECTORY },
};

/**
 * Cliente de test con `gcTime: Infinity` para que la estructura sembrada en el
 * caché no se recolecte antes de que `WorkspacePage` la lea.
 */
const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

/** Siembra el caché con las claves que definen la "estructura" del subárbol. */
const seedStructureCache = (client: QueryClient): void => {
  client.setQueryData(queryKeys.sessions.list(DIRECTORY), [sessionInfo]);
  client.setQueryData(queryKeys.agents.list(DIRECTORY), []);
  client.setQueryData(queryKeys.sessions.status(), {});
};

const renderWorkspace = (client: QueryClient, sessionId: string = SESSION_ID) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/sessions/${sessionId}`]}>
        <Routes>
          <Route path="/sessions/:id" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const measuredNames = () =>
  vi.mocked(perfMeasure).mock.calls.map(([name]) => name);

/**
 * El `setup` global restaura los mocks tras cada caso; como el barrel devuelve
 * el espía `graphHooks.useNow`, hay que re-aplicarle la implementación real del
 * reloj antes de cada test (el espía solo observa los argumentos).
 */
beforeEach(async () => {
  const { useNow } = await import('@app/Domains/Graph/Hooks/useNow');
  graphHooks.useNow.mockImplementation(useNow);
});

describe('WorkspacePage — instrumentación de apertura/revisita (P4)', () => {
  beforeEach(async () => {
    vi.mocked(useRootSessions).mockReturnValue({
      items: [{ session: sessionInfo, agentName: 'develop' }],
      groups: [],
      isLoading: false,
      isError: false,
      error: null,
    });

    const { opencodeService } = await import(
      '@app/Infrastructure/Services/opencodeClient'
    );
    vi.mocked(opencodeService.listSessions).mockResolvedValue([sessionInfo]);
  });

  it('registra graph.session.open cuando la estructura NO está en caché', async () => {
    const client = createClient();

    renderWorkspace(client);

    await waitFor(() => expect(perfMeasure).toHaveBeenCalled());
    expect(measuredNames()).toContain(PERF_METRIC.sessionOpen);
    expect(measuredNames()).not.toContain(PERF_METRIC.sessionRevisit);
    expect(perfMark).toHaveBeenCalled();
  });

  it('registra graph.session.revisit cuando la estructura YA está en caché', async () => {
    const client = createClient();
    seedStructureCache(client);

    renderWorkspace(client);

    await waitFor(() => expect(perfMeasure).toHaveBeenCalled());
    expect(measuredNames()).toContain(PERF_METRIC.sessionRevisit);
    expect(measuredNames()).not.toContain(PERF_METRIC.sessionOpen);
    expect(perfMark).toHaveBeenCalled();
  });
});

describe('WorkspacePage — tick del resumen condicionado a nodos activos (T041, FR-006/FR-024, SC-005)', () => {
  beforeEach(async () => {
    graphHooks.useNow.mockClear();

    vi.mocked(useRootSessions).mockReturnValue({
      items: [{ session: sessionInfo, agentName: 'develop' }],
      groups: [],
      isLoading: false,
      isError: false,
      error: null,
    });

    const { opencodeService } = await import(
      '@app/Infrastructure/Services/opencodeClient'
    );
    vi.mocked(opencodeService.listSessions).mockResolvedValue([sessionInfo]);
  });

  /** Opciones con las que la página evaluó el tick del resumen. */
  const summaryTicks = () =>
    graphHooks.useNow.mock.calls.map(([options]) => options?.enabled);

  it('sin nodos activos no activa el tick del resumen', async () => {
    const client = createClient();
    seedStructureCache(client); // status {} → nodo `created` (inactivo)

    renderWorkspace(client);

    // La estructura ya está disponible (1 nodo), pero ningún nodo está activo.
    await waitFor(() =>
      expect(screen.getByText('1 agentes')).toBeInTheDocument(),
    );
    expect(graphHooks.useNow).toHaveBeenCalledWith({ enabled: false });
    expect(summaryTicks().every((enabled) => enabled === false)).toBe(true);
  });

  it('con un nodo activo activa el tick del resumen', async () => {
    const client = createClient();
    seedStructureCache(client);
    client.setQueryData(queryKeys.sessions.status(), {
      [SESSION_ID]: busyStatus,
    });

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByText('1 agentes')).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(graphHooks.useNow).toHaveBeenCalledWith({ enabled: true }),
    );
  });
});

/* -------------------------------------------------------------------- */
/* SC-006 (T053) — identidad de nodo estable con ~150 nodos ante el tick.*/
/* -------------------------------------------------------------------- */

const PERF_NODE_COUNT = 150;
const PERF_ROOT_ID = 'ses-perf-root';
const PERF_CHILD_IDS = Array.from(
  { length: PERF_NODE_COUNT - 1 },
  (_, index) => `ses-perf-child-${index}`,
);
const PERF_START = new Date('2026-01-01T00:00:00.000Z').getTime();
const PERF_CHILD_DURATION_MS = 50;
const PERF_TICK_MS = 1_000;

/** Subárbol de ~150 nodos: raíz + N-1 hermanos en una sola tanda. */
const buildPerfSessions = (): SessionInfo[] => [
  session(PERF_ROOT_ID, { time: { created: 0, updated: 0 } }),
  ...PERF_CHILD_IDS.map((id, index) =>
    session(id, {
      parentID: PERF_ROOT_ID,
      time: { created: index + 1, updated: index + 1 },
    }),
  ),
];

/** Solo la raíz está activa; los 149 hijos quedan terminados. */
const buildPerfStatuses = (): Record<string, SessionStatus> => ({
  [PERF_ROOT_ID]: busyStatus,
  ...Object.fromEntries(PERF_CHILD_IDS.map((id) => [id, idleStatus])),
});

/**
 * La raíz no tiene `time.completed` (duración viva que avanza con el tick); los
 * hijos sí (duración fija), de modo que el tick solo debe reconstruir la raíz.
 */
const buildPerfMessages = (id: string) =>
  id === PERF_ROOT_ID
    ? [assistantMessage({ id: 'msg_perf_root', time: { created: PERF_START } })]
    : [
        assistantMessage({
          id: `msg_${id}`,
          time: {
            created: PERF_START,
            completed: PERF_START + PERF_CHILD_DURATION_MS,
          },
        }),
      ];

/** Nodos con los que `GraphPane` montó `AgentGraph` en el último render. */
const latestGraphNodes = (): TGraphModel['nodes'] => {
  const calls = graphHooks.agentGraph.mock.calls as unknown as Array<
    [{ graph: TGraphModel }]
  >;
  const call = calls[calls.length - 1];
  if (!call) throw new Error('AgentGraph no se montó');
  return call[0].graph.nodes;
};

const nodeById = (nodes: TGraphModel['nodes'], id: string) => {
  const node = nodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`nodo ${id} no encontrado`);
  return node;
};

describe('WorkspacePage — identidad de nodo estable con ~150 nodos (T053, SC-006, Principio VII)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(PERF_START);
    graphHooks.agentGraph.mockImplementation(() => null);

    vi.mocked(useRootSessions).mockReturnValue({
      items: [
        {
          session: session(PERF_ROOT_ID, { time: { created: 0, updated: 0 } }),
          agentName: 'develop',
        },
      ],
      groups: [],
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('el tick de 1 s solo reconstruye el nodo activo; los ~149 inactivos conservan identidad', async () => {
    const client = createClient();
    client.setQueryData(
      queryKeys.sessions.list(DIRECTORY),
      buildPerfSessions(),
    );
    client.setQueryData(queryKeys.agents.list(DIRECTORY), []);
    client.setQueryData(queryKeys.sessions.status(), buildPerfStatuses());
    for (const id of [PERF_ROOT_ID, ...PERF_CHILD_IDS]) {
      client.setQueryData(
        queryKeys.sessions.messages(id),
        buildPerfMessages(id),
      );
    }

    renderWorkspace(client, PERF_ROOT_ID);

    // El modelo real expone los ~150 nodos en el primer render (todo en caché).
    const nodesBefore = latestGraphNodes();
    expect(nodesBefore).toHaveLength(PERF_NODE_COUNT);
    expect(screen.getByText(`${PERF_NODE_COUNT} agentes`)).toBeInTheDocument();

    const rootBefore = nodeById(nodesBefore, PERF_ROOT_ID);
    const rootDurationBefore = rootBefore.data.metrics.durationMs;
    expect(rootBefore.data.status).toBe('running');
    expect(rootDurationBefore).not.toBeNull();

    const childrenBefore = new Map(
      PERF_CHILD_IDS.map((id) => [id, nodeById(nodesBefore, id)]),
    );
    // Cada hijo inactivo trae su esfuerzo ya derivado y una duración fija.
    for (const id of PERF_CHILD_IDS) {
      const child = childrenBefore.get(id);
      expect(child?.data.effort).toBeDefined();
      expect(child?.data.metrics.durationMs).toBe(PERF_CHILD_DURATION_MS);
    }

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PERF_TICK_MS);
    });

    const nodesAfter = latestGraphNodes();
    expect(nodesAfter).toHaveLength(PERF_NODE_COUNT);

    // El nodo activo avanza su duración y se reconstruye…
    const rootAfter = nodeById(nodesAfter, PERF_ROOT_ID);
    expect(rootAfter).not.toBe(rootBefore);
    expect(rootAfter.data.metrics.durationMs).toBe(
      (rootDurationBefore as number) + PERF_TICK_MS,
    );

    // …mientras los ~149 inactivos conservan el **mismo objeto** de nodo (y con
    // él su `effort`): el tick no dispara un re-render en cascada (SC-006).
    for (const id of PERF_CHILD_IDS) {
      expect(nodeById(nodesAfter, id)).toBe(childrenBefore.get(id));
    }
  });
});
