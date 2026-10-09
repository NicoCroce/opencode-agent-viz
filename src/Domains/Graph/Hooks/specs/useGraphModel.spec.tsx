import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SessionStatus } from '@opencode/client';
import type { ReactNode } from 'react';
import { queryKeys } from '../../../queryKeys';
import {
  DEFAULT_DIRECTORY,
  assistantMessage,
  busyStatus,
  idleStatus,
  session,
} from '../../lib/specs/fixtures';
import { useGraphModel, type UseGraphModelResult } from '../useGraphModel';

/**
 * Spec de contrato del modelo por fases (criterios L7..L8 del
 * `contracts/graph-loading-contract.md`):
 *
 * - L8: `useGraphModel` conserva **exactamente** la firma y la forma pública de
 *   `UseGraphModelResult` (verificado en runtime y por compilación `tsc`).
 * - L7: la revisita de una sesión ya visitada no repite la carga; todos los ids
 *   `ready` entran en `skippedIds` (sin recarga de contenido, SC-003/SC-008).
 *
 * El observable de "sin recarga" son las llamadas a los loaders de contenido:
 * con el caché de la primera visita intacto, una revisita no debe volver a
 * invocarlos. Este spec se escribe contra el contrato congelado y es la red de
 * seguridad del refactor de `useGraphModel` (T019).
 */

const {
  listSessions,
  listAgents,
  getSessionMessages,
  getSessionPermissions,
  getSessionLog,
  listSessionForms,
  getSessionForm,
  listSessionInbox,
} = vi.hoisted(() => ({
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
  opencodeService: {
    listSessions,
    listAgents,
    getSessionMessages,
    getSessionPermissions,
    getSessionLog,
    listSessionForms,
    getSessionForm,
    listSessionInbox,
  },
}));

const ROOT_ID = 'ses-root';
const CHILD_IDS = ['ses-child-a', 'ses-child-b'] as const;
const SUBTREE_IDS = [ROOT_ID, ...CHILD_IDS];

/** Claves públicas exactas de `UseGraphModelResult` (contrato §1, L8). */
const PUBLIC_RESULT_KEYS: ReadonlyArray<keyof UseGraphModelResult> = [
  'graph',
  'parallelGroups',
  'executionPlan',
  'activeNodeId',
  'latestActiveNodeId',
  'isLoading',
  'isError',
  'error',
];

/**
 * Loaders que consume el enriquecimiento. En la revisita de una sesión ya
 * enriquecida (`skippedIds` completos) ninguno debe volver a invocarse.
 */
const CONTENT_LOADERS = [
  getSessionMessages,
  getSessionPermissions,
  getSessionLog,
  listSessionForms,
  getSessionForm,
  listSessionInbox,
] as const;

const contentCallCounts = (): number[] =>
  CONTENT_LOADERS.map((loader) => loader.mock.calls.length);

const buildSubtree = () => [
  session(ROOT_ID),
  session(CHILD_IDS[0], { parentID: ROOT_ID }),
  session(CHILD_IDS[1], { parentID: ROOT_ID }),
];

/**
 * Cliente que sobrevive al desmontaje (`gcTime: Infinity`) para que la revisita
 * comparta exactamente el mismo caché que la primera visita.
 */
const createRevisitClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

const renderGraph = (queryClient: QueryClient, sessionId: string = ROOT_ID) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useGraphModel(sessionId, DEFAULT_DIRECTORY), {
    wrapper,
  });
};

describe('useGraphModel — contrato de carga (L7..L8)', () => {
  beforeEach(() => {
    listSessions.mockResolvedValue(buildSubtree());
    listAgents.mockResolvedValue([]);
    getSessionMessages.mockResolvedValue([assistantMessage()]);
    getSessionPermissions.mockResolvedValue([]);
    getSessionLog.mockResolvedValue([]);
    listSessionForms.mockResolvedValue([]);
    getSessionForm.mockResolvedValue(undefined);
    listSessionInbox.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('conserva la forma pública de UseGraphModelResult (L8)', async () => {
    const { result } = renderGraph(createRevisitClient());

    await waitFor(() =>
      expect(result.current.graph.nodes).toHaveLength(SUBTREE_IDS.length),
    );

    // Compilación: el retorno sigue siendo asignable a la interfaz pública (tsc).
    const shape: UseGraphModelResult = result.current;

    expect(Object.keys(shape).sort()).toEqual([...PUBLIC_RESULT_KEYS].sort());
    expect(Array.isArray(shape.graph.nodes)).toBe(true);
    expect(Array.isArray(shape.graph.edges)).toBe(true);
    expect(Array.isArray(shape.parallelGroups)).toBe(true);
    expect(shape.executionPlan).toBeDefined();
    expect(
      shape.activeNodeId === null || typeof shape.activeNodeId === 'string',
    ).toBe(true);
    expect(
      shape.latestActiveNodeId === null ||
        typeof shape.latestActiveNodeId === 'string',
    ).toBe(true);
    expect(typeof shape.isLoading).toBe('boolean');
    expect(typeof shape.isError).toBe('boolean');
    expect(shape.error === null || shape.error instanceof Error).toBe(true);
  });

  it('sirve la estructura desde caché y salta todos los ids ready en la revisita (L7)', async () => {
    const queryClient = createRevisitClient();

    // --- Primera visita: el enriquecimiento carga el contenido de cada id. ---
    const first = renderGraph(queryClient);
    await waitFor(() =>
      expect(first.result.current.graph.nodes).toHaveLength(
        SUBTREE_IDS.length,
      ),
    );
    await waitFor(() =>
      expect(getSessionMessages).toHaveBeenCalledTimes(SUBTREE_IDS.length),
    );
    expect(contentCallCounts()).toEqual([3, 3, 3, 3, 0, 3]);
    // Al completar la primera visita, todo el subárbol queda `ready`.
    expect(
      first.result.current.graph.nodes.every(
        (node) => node.data.enrichment === 'ready',
      ),
    ).toBe(true);

    first.unmount();
    const callsAfterFirstVisit = contentCallCounts();

    // --- Revisita: misma sesión de trabajo, mismo caché. ---
    const second = renderGraph(queryClient);

    // La estructura está disponible de inmediato (desde caché), sin esqueleto.
    expect(second.result.current.isLoading).toBe(false);
    expect(second.result.current.graph.nodes).toHaveLength(SUBTREE_IDS.length);
    expect(
      second.result.current.graph.nodes.every(
        (node) => node.data.enrichment === 'ready',
      ),
    ).toBe(true);

    // Deja correr cualquier efecto/fetch pendiente antes de medir.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // `skippedIds` completos: ningún loader de contenido se vuelve a invocar.
    expect(contentCallCounts()).toEqual(callsAfterFirstVisit);
    expect(getSessionMessages).toHaveBeenCalledTimes(SUBTREE_IDS.length);
  });

  it('solo carga los ids que no están ready: skippedIds = readyIds (L7, SC-008)', async () => {
    const queryClient = createRevisitClient();
    const [readyId, pendingId] = CHILD_IDS;

    // Simula una sesión ya enriquecida: el contenido de `readyId` está en caché.
    queryClient.setQueryData(queryKeys.sessions.messages(readyId), [
      assistantMessage(),
    ]);
    queryClient.setQueryData(queryKeys.permissions.for(readyId), []);
    queryClient.setQueryData(queryKeys.sessions.log(readyId), []);
    queryClient.setQueryData(queryKeys.sessions.forms(readyId), []);
    queryClient.setQueryData(queryKeys.sessions.inbox(readyId), []);

    const { result } = renderGraph(queryClient);
    await waitFor(() =>
      expect(result.current.graph.nodes).toHaveLength(SUBTREE_IDS.length),
    );
    await waitFor(() => expect(getSessionMessages).toHaveBeenCalledTimes(2));

    // `readyId` queda en `skippedIds`: no se vuelve a pedir ninguno de sus datos.
    const requested = getSessionMessages.mock.calls
      .map(([id]) => id as string)
      .sort();
    expect(requested).toEqual([ROOT_ID, pendingId].sort());
    expect(getSessionPermissions).not.toHaveBeenCalledWith(readyId);
    expect(getSessionLog).not.toHaveBeenCalledWith(readyId);
    expect(listSessionForms).not.toHaveBeenCalledWith(readyId);
    expect(listSessionInbox).not.toHaveBeenCalledWith(readyId);
  });
});

/* -------------------------------------------------------------------- */
/* E5/A5 — filas paralelas en vivo y paridad en vivo/refresco (T024).    */
/* -------------------------------------------------------------------- */

const LANE_ROOT = 'ses-lane-root';
const LANE_IDS = ['ses-lane-1', 'ses-lane-2', 'ses-lane-3'] as const;
const LANE_FINISH = 1_000;

/**
 * Subárbol raíz → N hermanos concurrentes (subagentes en paralelo). Los hijos
 * se crean en instantes **escalonados** (`10/20/30`) para probar que el
 * agrupamiento sale del solape real de actividad y no de "casi al mismo
 * tiempo"; `finish` fija el fin real (`SessionInfo.time.updated`) del estado
 * completo que llega al terminar la ejecución.
 */
const buildLaneSubtree = (finish: number | null = null) => [
  session(LANE_ROOT, { time: { created: 0, updated: 0 } }),
  ...LANE_IDS.map((id, index) => {
    const created = 10 * (index + 1);
    return session(id, {
      parentID: LANE_ROOT,
      time: { created, updated: finish ?? created },
    });
  }),
];

const laneStatuses = (
  status: SessionStatus,
): Record<string, SessionStatus> =>
  Object.fromEntries(LANE_IDS.map((id) => [id, status]));

const laneNode = (result: UseGraphModelResult, id: string) => {
  const node = result.graph.nodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`nodo ${id} no encontrado`);
  return node;
};

const allLanesReady = (result: UseGraphModelResult): boolean =>
  result.graph.nodes.length === LANE_IDS.length + 1 &&
  result.graph.nodes.every((node) => node.data.enrichment === 'ready');

/**
 * Disposición observable de la vista: niveles (filas), columnas, posiciones y
 * grupos paralelos. Es lo que debe permanecer idéntico entre el estado en vivo
 * y el estado completo reconstruido (paridad en vivo/refresco).
 */
const laneSnapshot = (result: UseGraphModelResult) => ({
  levelByNode: { ...result.executionPlan.levelByNode },
  columnByNode: { ...result.executionPlan.columnByNode },
  positions: Object.fromEntries(
    result.graph.nodes.map((node) => [node.id, node.position]),
  ),
  parallelGroups: [...result.parallelGroups]
    .map((group) => [...group.nodeIds].sort().join(','))
    .sort(),
});

const seedLaneContent = () => {
  getSessionMessages.mockImplementation((id: string) =>
    Promise.resolve([assistantMessage({ id: `msg-${id}` })]),
  );
};

describe('useGraphModel — filas paralelas en vivo y paridad (E5/A5)', () => {
  beforeEach(() => {
    listSessions.mockResolvedValue(buildLaneSubtree());
    listAgents.mockResolvedValue([]);
    getSessionMessages.mockReset();
    getSessionPermissions.mockResolvedValue([]);
    getSessionLog.mockResolvedValue([]);
    listSessionForms.mockResolvedValue([]);
    getSessionForm.mockResolvedValue(undefined);
    listSessionInbox.mockResolvedValue([]);
    seedLaneContent();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('los N subagentes concurrentes comparten fila/levelByNode desde el modelo enriquecido (E5)', async () => {
    const queryClient = createRevisitClient();
    queryClient.setQueryData(
      queryKeys.sessions.status(),
      laneStatuses(busyStatus),
    );

    const { result } = renderGraph(queryClient, LANE_ROOT);

    await waitFor(() => expect(allLanesReady(result.current)).toBe(true));

    const { executionPlan, graph, parallelGroups } = result.current;

    // Una sola fila para los N hermanos activos, por debajo de la raíz.
    const levels = LANE_IDS.map((id) => executionPlan.levelByNode[id]);
    expect(new Set(levels).size).toBe(1);
    expect(levels[0]).toBeGreaterThan(executionPlan.levelByNode[LANE_ROOT]);

    // Misma fila = mismo `y`; cada subagente en su propia columna (`x`).
    const ys = LANE_IDS.map((id) => laneNode(result.current, id).position.y);
    const xs = LANE_IDS.map((id) => laneNode(result.current, id).position.x);
    expect(new Set(ys).size).toBe(1);
    expect(new Set(xs).size).toBe(LANE_IDS.length);

    // Activos (`running`) en la fase enriquecida, no apilados.
    for (const id of LANE_IDS) {
      expect(laneNode(result.current, id).data.status).toBe('running');
    }

    // El badge (`data.parallel`) sale de los mismos grupos que la fila (FR-010).
    const group = parallelGroups.find(
      (candidate) => candidate.nodeIds.length === LANE_IDS.length,
    );
    expect(group?.nodeIds.slice().sort()).toEqual([...LANE_IDS].sort());
    for (const id of LANE_IDS) {
      expect(laneNode(result.current, id).data.parallel?.size).toBe(
        LANE_IDS.length,
      );
    }

    expect(graph.nodes).toHaveLength(LANE_IDS.length + 1);
  });

  it('la disposición en vivo se mantiene idéntica al llegar el estado completo y al reabrir (A5)', async () => {
    const queryClient = createRevisitClient();
    queryClient.setQueryData(
      queryKeys.sessions.status(),
      laneStatuses(busyStatus),
    );

    const live = renderGraph(queryClient, LANE_ROOT);
    await waitFor(() => expect(allLanesReady(live.result.current)).toBe(true));

    const liveSnapshot = laneSnapshot(live.result.current);
    // En vivo, los N concurrentes ya comparten una fila.
    expect(
      new Set(LANE_IDS.map((id) => liveSnapshot.levelByNode[id])).size,
    ).toBe(1);

    // Llega el estado completo: las sesiones reportan su fin real y terminan.
    act(() => {
      queryClient.setQueryData(
        queryKeys.sessions.status(),
        laneStatuses(idleStatus),
      );
      queryClient.setQueryData(
        queryKeys.sessions.list(DEFAULT_DIRECTORY),
        buildLaneSubtree(LANE_FINISH),
      );
    });

    await waitFor(() =>
      expect(
        LANE_IDS.every(
          (id) => laneNode(live.result.current, id).data.status === 'succeeded',
        ),
      ).toBe(true),
    );

    // El agrupamiento final coincide con el observado en vivo (US1 esc. 3).
    expect(laneSnapshot(live.result.current)).toEqual(liveSnapshot);

    // Reabrir la vista con el estado completo no cambia la disposición.
    live.unmount();
    const reopened = renderGraph(queryClient, LANE_ROOT);
    await waitFor(() =>
      expect(allLanesReady(reopened.result.current)).toBe(true),
    );

    expect(laneSnapshot(reopened.result.current)).toEqual(liveSnapshot);
  });
});

/* -------------------------------------------------------------------- */
/* S11 — esfuerzo por nodo e identidad estable ante tick (T021).        */
/* -------------------------------------------------------------------- */

const EFFORT_ROOT = 'ses-effort-root';
const EFFORT_CHILD = 'ses-effort-child';
const EFFORT_START = new Date('2026-01-01T00:00:00.000Z').getTime();
const EFFORT_TICK = 1_000;

/**
 * Reloj falso + shim de idle (jsdom no implementa `requestIdleCallback`), como
 * en `useGraphModel.tick.spec.tsx`: permite disparar el tick de 1 s y resolver
 * los lotes de enriquecimiento por separado.
 */
const installEffortClock = (): void => {
  vi.useFakeTimers();
  vi.setSystemTime(EFFORT_START);
  vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) =>
    setTimeout(
      () => callback({ didTimeout: false, timeRemaining: () => 50 }),
      0,
    ),
  );
  vi.stubGlobal('cancelIdleCallback', (handle: number) => clearTimeout(handle));
};

/** Avanza turnos de idle (1 ms, por debajo del tick) hasta enriquecer todo. */
const drainEffort = async (
  hook: ReturnType<typeof renderGraph>,
  maxTurns = 16,
): Promise<void> => {
  for (let turn = 0; turn < maxTurns; turn += 1) {
    const nodes = hook.result.current.graph.nodes;
    if (
      nodes.length > 0 &&
      nodes.every((node) => node.data.enrichment === 'ready')
    ) {
      return;
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
  }
};

const effortNode = (result: UseGraphModelResult, id: string) => {
  const node = result.graph.nodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`nodo ${id} no encontrado`);
  return node;
};

describe('useGraphModel — esfuerzo por nodo e identidad estable (S11, T021)', () => {
  beforeEach(() => {
    installEffortClock();
    listSessions.mockReset().mockResolvedValue([
      session(EFFORT_ROOT),
      session(EFFORT_CHILD, { parentID: EFFORT_ROOT }),
    ]);
    listAgents.mockReset().mockResolvedValue([]);
    getSessionPermissions.mockReset().mockResolvedValue([]);
    getSessionLog.mockReset().mockResolvedValue([]);
    listSessionForms.mockReset().mockResolvedValue([]);
    getSessionForm.mockReset().mockResolvedValue(undefined);
    listSessionInbox.mockReset().mockResolvedValue([]);
    // La raíz queda activa (sin `time.completed`, duración viva); el hijo queda
    // terminado (`time.completed`, duración fija).
    getSessionMessages.mockReset().mockImplementation((id: string) =>
      Promise.resolve(
        id === EFFORT_ROOT
          ? [assistantMessage({ id: 'msg_root', time: { created: 2 } })]
          : [
              assistantMessage({
                id: 'msg_child',
                time: { created: 2, completed: 5 },
              }),
            ],
      ),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('expone data.effort por nodo y conserva la identidad del nodo sin cambios ante un tick', async () => {
    const queryClient = createRevisitClient();
    queryClient.setQueryData(queryKeys.sessions.status(), {
      [EFFORT_ROOT]: busyStatus,
      [EFFORT_CHILD]: idleStatus,
    });

    const hook = renderGraph(queryClient, EFFORT_ROOT);
    await drainEffort(hook);

    // Todo nodo expone un nivel de esfuerzo válido (nivel base 1 garantizado).
    for (const node of hook.result.current.graph.nodes) {
      expect(node.data.effort).toBeDefined();
      expect(node.data.effort?.level).toBeGreaterThanOrEqual(1);
      expect(node.data.effort?.level).toBeLessThanOrEqual(5);
      expect(node.data.effort?.reasons.length).toBeGreaterThan(0);
    }

    const activeBefore = effortNode(hook.result.current, EFFORT_ROOT);
    const inactiveBefore = effortNode(hook.result.current, EFFORT_CHILD);
    expect(activeBefore.data.status).toBe('running');
    expect(inactiveBefore.data.status).toBe('succeeded');
    const activeDurationBefore = activeBefore.data.metrics.durationMs;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(EFFORT_TICK);
    });

    const activeAfter = effortNode(hook.result.current, EFFORT_ROOT);
    const inactiveAfter = effortNode(hook.result.current, EFFORT_CHILD);

    // El activo avanza de duración: se reconstruye (su `effort` puede cambiar).
    expect(activeAfter).not.toBe(activeBefore);
    expect(activeAfter.data.metrics.durationMs).toBe(
      (activeDurationBefore as number) + EFFORT_TICK,
    );

    // El inactivo no cambia de duración ni de nivel: conserva el **mismo objeto**
    // de nodo (y por tanto el mismo objeto de `effort`).
    expect(inactiveAfter).toBe(inactiveBefore);
    expect(inactiveAfter.data.effort).toBe(inactiveBefore.data.effort);
  });
});

/* -------------------------------------------------------------------- */
/* US3 (T031) — `latestActiveNodeId` aditivo en UseGraphModelResult.     */
/* -------------------------------------------------------------------- */

const LATEST_ROOT = 'ses-latest-root';
const LATEST_EARLY = 'ses-latest-early';
const LATEST_LATE = 'ses-latest-late';
const LATEST_IDS = [LATEST_ROOT, LATEST_EARLY, LATEST_LATE] as const;

/** Raíz → dos hermanos concurrentes con inicio de ejecución escalonado. */
const buildLatestSubtree = () => [
  session(LATEST_ROOT, { time: { created: 0, updated: 0 } }),
  session(LATEST_EARLY, { parentID: LATEST_ROOT }),
  session(LATEST_LATE, { parentID: LATEST_ROOT }),
];

const latestStatuses = (
  status: SessionStatus,
): Record<string, SessionStatus> =>
  Object.fromEntries(LATEST_IDS.map((id) => [id, status]));

const allLatestReady = (result: UseGraphModelResult): boolean =>
  result.graph.nodes.length === LATEST_IDS.length &&
  result.graph.nodes.every((node) => node.data.enrichment === 'ready');

/**
 * `UseGraphModelResult` expone `latestActiveNodeId` (FR-005) **sin alterar**
 * `activeNodeId` (additivo; active-node-feedback-contract §2). El `activeNodeId`
 * sigue siendo el primer nodo activo en orden de nodo; `latestActiveNodeId` es
 * el de mayor hora de inicio entre los activos.
 */
describe('useGraphModel — latestActiveNodeId (T031, US3)', () => {
  beforeEach(() => {
    listSessions.mockReset().mockResolvedValue(buildLatestSubtree());
    listAgents.mockReset().mockResolvedValue([]);
    getSessionPermissions.mockReset().mockResolvedValue([]);
    getSessionLog.mockReset().mockResolvedValue([]);
    listSessionForms.mockReset().mockResolvedValue([]);
    getSessionForm.mockReset().mockResolvedValue(undefined);
    listSessionInbox.mockReset().mockResolvedValue([]);
    // `metrics.startedAt` = mínimo `time.created` de los assistant: el hijo
    // "early" empieza en 100 y el "late" en 300 (FR-005).
    getSessionMessages.mockReset().mockImplementation((id: string) =>
      Promise.resolve([
        assistantMessage({
          id: `msg-${id}`,
          time: {
            created:
              id === LATEST_LATE ? 300 : id === LATEST_EARLY ? 100 : 0,
          },
        }),
      ]),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('expone latestActiveNodeId (mayor hora de inicio) conservando activeNodeId', async () => {
    const queryClient = createRevisitClient();
    queryClient.setQueryData(queryKeys.sessions.status(), {
      ...latestStatuses(idleStatus),
      [LATEST_EARLY]: busyStatus,
      [LATEST_LATE]: busyStatus,
    });

    const { result } = renderGraph(queryClient, LATEST_ROOT);
    await waitFor(() => expect(allLatestReady(result.current)).toBe(true));

    // `activeNodeId` se conserva: el primer activo en orden de nodo.
    const firstActive = result.current.graph.nodes.find(
      (node) => node.data.status === 'running',
    )?.id;
    expect(firstActive).toBe(LATEST_EARLY);
    expect(result.current.activeNodeId).toBe(firstActive);

    // `latestActiveNodeId` elige el activo que empezó más tarde (FR-005).
    expect(result.current.latestActiveNodeId).toBe(LATEST_LATE);
    expect(result.current.latestActiveNodeId).not.toBe(
      result.current.activeNodeId,
    );
  });

  it('latestActiveNodeId es null cuando no hay nodos activos (FR-007)', async () => {
    const queryClient = createRevisitClient();
    queryClient.setQueryData(
      queryKeys.sessions.status(),
      latestStatuses(idleStatus),
    );

    const { result } = renderGraph(queryClient, LATEST_ROOT);
    await waitFor(() => expect(allLatestReady(result.current)).toBe(true));

    expect(result.current.latestActiveNodeId).toBeNull();
    expect(result.current.activeNodeId).toBeNull();
  });
});
