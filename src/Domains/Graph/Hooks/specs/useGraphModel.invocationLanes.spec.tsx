import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SessionInfo, SessionStatus } from '@opencode/client';
import type { ReactNode } from 'react';
import type {
  TContentPart,
  TSessionMessage,
} from '@app/Infrastructure/Services/opencodeClient';
import { queryKeys } from '../../../queryKeys';
import type { TSubtreeLoadResult } from '../../lib/loadPlan/subtree';
import {
  DEFAULT_DIRECTORY,
  assistantMessage,
  idleStatus,
  session,
} from '../../lib/specs/fixtures';
import { useGraphModel, type UseGraphModelResult } from '../useGraphModel';

/**
 * Wiring de extremo a extremo del **paralelismo por invocación** (feature 011,
 * US5; contrato `invocation-lanes-contract.md` §1-§4, criterios E1/E2/E3/E5).
 *
 * Las funciones puras ya tienen sus specs (`invocations.spec.ts`,
 * `invocationParity.spec.ts`, `parallelism.spec.ts`). Lo que falta —y es el
 * corazón del pedido (FR-007/FR-008/FR-011)— es que el **lote derivado de los
 * mensajes del padre** recorra el modelo real: `useGraphModel` →
 * `useInvocationBatches` (lee `sessions.messages(id)` del caché, sin consultas
 * nuevas) → `deriveExecutionLayout` → **filas** (`executionPlan`) + **badge**
 * (`node.data.parallel`). Sin ese cableado, el arreglo del paralelismo sería un
 * **no-op silencioso** (FR-008, research R8).
 *
 * Los casos fijan:
 *  - un paso con 2+ subagentes del padre → **una** fila, aunque los intervalos
 *    de sesión de los hermanos **no solapen** (la invocación gana; el respaldo
 *    por solape los separaría);
 *  - una hija **reutilizada en dos pasos** → dos lotes, y los pasos secuenciales
 *    **no** se fusionan en una fila paralela (el intervalo largo de la hija
 *    fusionaría a los tres con el respaldo);
 *  - los mensajes del padre que **llegan tarde** hacen aparecer el badge y unen
 *    la fila: misma topología, resultado distinto (la clave de ejecución no se
 *    queda memoizada);
 *  - paridad **fila ↔ badge** nodo a nodo sobre el modelo real.
 *
 * Todo se observa a través del hook; se mockea solo la frontera del SDK.
 */

const service = vi.hoisted(() => ({
  listSessions: vi.fn(),
  listRootSessions: vi.fn(),
  listChildSessions: vi.fn(),
  getSession: vi.fn(),
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

const {
  listSessions,
  listRootSessions,
  listChildSessions,
  getSession,
  listAgents,
  getSessionMessages,
  getSessionPermissions,
  getSessionLog,
  listSessionForms,
  getSessionForm,
  listSessionInbox,
} = service;

/** Raíz del subárbol observado (el padre que invoca). */
const ROOT = 'ses-inv-root';
/** Hija larga: su intervalo de sesión cubre los dos pasos del padre. */
const WIDE = 'ses-inv-wide';
/** Hija del primer paso. */
const EARLY = 'ses-inv-early';
/** Hija del segundo paso. */
const LATE = 'ses-inv-late';

type TToolPart = Extract<TContentPart, { type: 'tool' }>;

interface TSpawn {
  /** Id del tool part que abre la sesión hija. */
  toolId: string;
  /** Sesión hija (`state.metadata.sessionID`). */
  sessionId: string;
  created: number;
  completed: number;
}

/**
 * Tool part `subagent` completado, con la forma exacta que `deriveInvocations`
 * lee como **invocación**: nombre `subagent`, vínculo en
 * `state.metadata.sessionID` y `time.created`/`time.completed`.
 */
const spawn = ({
  toolId,
  sessionId,
  created,
  completed,
}: TSpawn): TToolPart => ({
  type: 'tool',
  id: toolId,
  name: 'subagent',
  state: {
    status: 'completed',
    input: { description: `delegar en ${sessionId}` },
    content: [{ type: 'text', text: `subagente ${sessionId} terminado` }],
    metadata: { sessionID: sessionId },
  },
  time: { created, completed },
});

/** Paso del padre: el id de su mensaje assistant es el `stepId` de sus invocaciones. */
const step = (stepId: string, parts: TContentPart[]): TSessionMessage =>
  assistantMessage({
    id: stepId,
    time: { created: 1, completed: 2 },
    content: parts,
  });

/** Mensaje assistant sin invocaciones: el paso no aporta lote. */
const plain = (id: string): TSessionMessage =>
  assistantMessage({ id, time: { created: 1, completed: 2 } });

/* -------------------------------------------------------------------- */
/* Subárbol de la fase estructural (misma semilla que el resto de specs).*/
/* -------------------------------------------------------------------- */

let subtreeRoots: SessionInfo[] = [];
let sessionsById: Record<string, SessionInfo> = {};
let childrenByParent: Record<string, string[]> = {};

const seedSubtree = (tree: readonly SessionInfo[]): void => {
  subtreeRoots = tree.filter((item) => item.parentID === undefined);
  sessionsById = Object.fromEntries(tree.map((item) => [item.id, item]));
  childrenByParent = {};
  for (const item of tree) {
    if (item.parentID === undefined) continue;
    childrenByParent[item.parentID] = [
      ...(childrenByParent[item.parentID] ?? []),
      item.id,
    ];
  }
};

const subtreeResult = (tree: readonly SessionInfo[]): TSubtreeLoadResult => ({
  sessions: [...tree],
  truncated: false,
  loadedCount: tree.length,
  notFound: false,
});

const installSubtreeService = (): void => {
  listSessions.mockResolvedValue([]);
  listRootSessions.mockImplementation(() =>
    Promise.resolve({ sessions: subtreeRoots, truncated: false }),
  );
  listChildSessions.mockImplementation((parentID: string) =>
    Promise.resolve(
      (childrenByParent[parentID] ?? []).map((id) => sessionsById[id]),
    ),
  );
  getSession.mockImplementation((id: string) => {
    const found = sessionsById[id];
    return found
      ? Promise.resolve(found)
      : Promise.reject(new Error(`sesión ${id} inexistente`));
  });
};

/**
 * Contenido por sesión. `content[ROOT]` es el **mensaje del padre** del que se
 * derivan las invocaciones; las hijas responden con un assistant sin spawns
 * (nunca emiten lote). Cada caso decide cuándo el padre tiene mensajes.
 */
let content: Record<string, TSessionMessage[]> = {};

const installContentLoaders = (): void => {
  getSessionMessages.mockImplementation((id: string) =>
    Promise.resolve(content[id] ?? [plain(`msg-${id}`)]),
  );
  getSessionPermissions.mockResolvedValue([]);
  getSessionLog.mockResolvedValue([]);
  listSessionForms.mockResolvedValue([]);
  getSessionForm.mockResolvedValue(undefined);
  listSessionInbox.mockResolvedValue([]);
};

const prepareGraphMocks = (tree: readonly SessionInfo[]): void => {
  vi.resetAllMocks();
  content = {};
  seedSubtree(tree);
  installSubtreeService();
  installContentLoaders();
  listAgents.mockResolvedValue([]);
};

const graphClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

const renderGraph = (
  queryClient: QueryClient,
  sessionId: string = ROOT,
): ReturnType<typeof renderHook<UseGraphModelResult, unknown>> => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useGraphModel(sessionId, DEFAULT_DIRECTORY), {
    wrapper,
  });
};

const nodeById = (result: UseGraphModelResult, id: string) => {
  const node = result.graph.nodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`nodo ${id} no encontrado`);
  return node;
};

const rowOf = (result: UseGraphModelResult, id: string) =>
  result.executionPlan.levels.find((level) => level.nodeIds.includes(id));

const allReady = (result: UseGraphModelResult, total: number): boolean =>
  result.graph.nodes.length === total &&
  result.graph.nodes.every((node) => node.data.enrichment === 'ready');

/** Paridad **fila ↔ badge** (FR-008, E5) sobre el modelo real del hook. */
const expectRowBadgeParity = (result: UseGraphModelResult): void => {
  for (const node of result.graph.nodes) {
    const rowParallel = rowOf(result, node.id)?.parallel === true;
    const badgeSize = node.data.parallel?.size ?? 0;
    expect(rowParallel, `fila ↔ badge de ${node.id}`).toBe(badgeSize > 1);
  }
};

const rawStatuses = (ids: readonly string[]): Record<string, SessionStatus> =>
  Object.fromEntries(ids.map((id) => [id, idleStatus]));

/* -------------------------------------------------------------------- */
/* E1 + E5 — un paso con 2+ subagentes: una fila aunque las sesiones no */
/* solapen (la invocación gana al solape estructural).                   */
/* -------------------------------------------------------------------- */

/** Raíz + dos hijas cuyos intervalos de **sesión** son disjuntos. */
const buildDisjointSiblings = () => [
  session(ROOT, { time: { created: 0, updated: 9_000 } }),
  session(EARLY, {
    parentID: ROOT,
    time: { created: 100, updated: 150 },
  }),
  session(LATE, {
    parentID: ROOT,
    time: { created: 500, updated: 550 },
  }),
];

describe('useGraphModel — lote por invocación del padre (E1/E5, FR-007/FR-008)', () => {
  beforeEach(() => {
    prepareGraphMocks(buildDisjointSiblings());
    // Un único paso del padre con las dos invocaciones: un lote paralelo.
    content[ROOT] = [
      step('step_1', [
        spawn({ toolId: 'tool-early', sessionId: EARLY, created: 100, completed: 150 }),
        spawn({ toolId: 'tool-late', sessionId: LATE, created: 500, completed: 550 }),
      ]),
    ];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('une en una fila paralela a los hermanos del mismo paso aunque sus intervalos de sesión no solapen', async () => {
    const queryClient = graphClient();
    queryClient.setQueryData(
      queryKeys.sessions.status(),
      rawStatuses([ROOT, EARLY, LATE]),
    );

    const { result } = renderGraph(queryClient);
    await waitFor(() => expect(allReady(result.current, 3)).toBe(true));

    // Precondición del caso: los intervalos de sesión son disjuntos, así que el
    // respaldo estructural (`deriveSiblingBatches`) los pondría en filas
    // distintas: son las invocaciones del mismo paso las que los unen.
    expect(nodeById(result.current, EARLY).data.updatedAt).toBe(150);
    expect(nodeById(result.current, LATE).data.createdAt).toBe(500);

    expect(result.current.executionPlan.levelByNode[EARLY]).toBe(
      result.current.executionPlan.levelByNode[LATE],
    );
    expect(rowOf(result.current, EARLY)?.parallel).toBe(true);

    // Badge y fila salen del lote `ROOT#step_1` (2 invocaciones del mismo paso).
    const group = result.current.parallelGroups.find(
      (candidate) => candidate.id === `${ROOT}#step_1`,
    );
    expect(group?.nodeIds.slice().sort()).toEqual([EARLY, LATE].sort());
    expect(nodeById(result.current, EARLY).data.parallel?.size).toBe(2);
    expect(nodeById(result.current, LATE).data.parallel?.size).toBe(2);

    // La raíz no participa de una tanda paralela.
    expect(rowOf(result.current, ROOT)?.parallel).toBe(false);
    expect(nodeById(result.current, ROOT).data.parallel).toBeNull();

    expectRowBadgeParity(result.current);
  });

  it('el mismo paso se ve igual al reabrir con el subárbol cacheado (paridad en vivo/refresco)', async () => {
    const queryClient = graphClient();
    queryClient.setQueryData(
      queryKeys.sessions.status(),
      rawStatuses([ROOT, EARLY, LATE]),
    );
    // Subárbol y mensajes ya cacheados: la reapertura no repite el BFS.
    queryClient.setQueryData(
      queryKeys.graph.for(DEFAULT_DIRECTORY, ROOT),
      subtreeResult(buildDisjointSiblings()),
    );
    queryClient.setQueryData(queryKeys.sessions.messages(ROOT), content[ROOT]);

    const { result } = renderGraph(queryClient);

    // La estructura está de inmediato; el lote sale de los mensajes cacheados.
    expect(result.current.graph.nodes).toHaveLength(3);
    await waitFor(() =>
      expect(nodeById(result.current, EARLY).data.parallel?.size).toBe(2),
    );

    expect(result.current.executionPlan.levelByNode[EARLY]).toBe(
      result.current.executionPlan.levelByNode[LATE],
    );
    expectRowBadgeParity(result.current);
  });
});

/* -------------------------------------------------------------------- */
/* E2 + E3 — hija reutilizada en dos pasos: dos lotes y pasos           */
/* secuenciales que **no** se fusionan (FR-007/FR-011).                  */
/* -------------------------------------------------------------------- */

/**
 * Raíz con dos pasos secuenciales y una hija reutilizada en ambos. `WIDE`
 * mantiene un intervalo de sesión **largo** que cubre los dos pasos: con el
 * respaldo por solape, los tres nodos caerían en una única fila de 3 (la
 * fusión que el pedido ataca).
 */
const buildReusedChild = () => [
  session(ROOT, { time: { created: 0, updated: 9_000 } }),
  session(WIDE, { parentID: ROOT, time: { created: 0, updated: 6_000 } }),
  session(EARLY, { parentID: ROOT, time: { created: 100, updated: 150 } }),
  session(LATE, { parentID: ROOT, time: { created: 500, updated: 550 } }),
];

describe('useGraphModel — hija reutilizada en dos pasos (E2/E3, FR-007/FR-011)', () => {
  beforeEach(() => {
    prepareGraphMocks(buildReusedChild());
    content[ROOT] = [
      step('step_1', [
        spawn({ toolId: 'tool-wide-1', sessionId: WIDE, created: 100, completed: 150 }),
        spawn({ toolId: 'tool-early', sessionId: EARLY, created: 100, completed: 150 }),
      ]),
      step('step_2', [
        spawn({ toolId: 'tool-wide-2', sessionId: WIDE, created: 500, completed: 550 }),
        spawn({ toolId: 'tool-late', sessionId: LATE, created: 500, completed: 550 }),
      ]),
    ];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('la hija aporta dos invocaciones (dos lotes) y los pasos secuenciales quedan en filas distintas', async () => {
    const queryClient = graphClient();
    queryClient.setQueryData(
      queryKeys.sessions.status(),
      rawStatuses([ROOT, WIDE, EARLY, LATE]),
    );

    const { result } = renderGraph(queryClient);
    await waitFor(() => expect(allReady(result.current, 4)).toBe(true));

    // Dos pasos distintos ⇒ dos lotes con identidad propia, y la hija
    // reutilizada (`WIDE`) está en **ambos** (FR-007).
    const groups = result.current.parallelGroups.filter(
      (group) => group.nodeIds.length >= 2,
    );
    expect(groups.map((group) => group.id).sort()).toEqual(
      [`${ROOT}#step_1`, `${ROOT}#step_2`].sort(),
    );
    const stepOne = groups.find((group) => group.id === `${ROOT}#step_1`);
    const stepTwo = groups.find((group) => group.id === `${ROOT}#step_2`);
    expect(stepOne?.nodeIds).toContain(WIDE);
    expect(stepTwo?.nodeIds).toContain(WIDE);
    expect(stepOne?.nodeIds.slice().sort()).toEqual([WIDE, EARLY].sort());
    expect(stepTwo?.nodeIds.slice().sort()).toEqual([WIDE, LATE].sort());

    // Los pasos secuenciales **no** se fusionan: `EARLY` y `LATE` no comparten
    // fila, aunque el intervalo largo de `WIDE` solape con los dos.
    expect(result.current.executionPlan.levelByNode[EARLY]).not.toBe(
      result.current.executionPlan.levelByNode[LATE],
    );
    expect(rowOf(result.current, EARLY)?.parallel).toBe(true);
    expect(rowOf(result.current, LATE)?.parallel).toBe(true);

    // El badge de `WIDE` es del lote (2), no de la sesión larga (3): la fila
    // paralela nunca se construye por la barra temporal del nodo.
    expect(nodeById(result.current, WIDE).data.parallel?.size).toBe(2);
    expect(nodeById(result.current, WIDE).data.parallel?.groupId).toBe(
      `${ROOT}#step_2`,
    );

    expectRowBadgeParity(result.current);
  });
});

/* -------------------------------------------------------------------- */
/* S4/FR-005 — la sesión inexistente llega como `notFound` aditivo, no   */
/* como error ni como esqueleto terminal (el banner la consume).         */
/* -------------------------------------------------------------------- */

const GHOST = 'ses-inv-ghost';

describe('useGraphModel — sesión inexistente (S4/FR-005)', () => {
  beforeEach(() => {
    prepareGraphMocks([session(ROOT)]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('propaga notFound (aditivo) sin error y sin nodos, distinto de "sin agentes"', async () => {
    const queryClient = graphClient();
    const { result } = renderGraph(queryClient, GHOST);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // El cargador sube con `session.get` y traduce el 404 a "no encontrada".
    expect(getSession).toHaveBeenCalledWith(GHOST);
    expect(result.current.notFound).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.graph.nodes).toHaveLength(0);
    expect(result.current.truncated).toBe(false);
  });
});

/* -------------------------------------------------------------------- */
/* E4/R8 — los mensajes del padre que llegan después cambian filas y    */
/* badge: la clave de ejecución no se queda memoizada (no-op silencioso).*/
/* -------------------------------------------------------------------- */

describe('useGraphModel — llegada de los mensajes del padre (E4, R8/FR-008)', () => {
  let releases: Array<() => void> = [];

  beforeEach(() => {
    prepareGraphMocks(buildDisjointSiblings());
    releases = [];
    // El padre arranca sin mensajes: la promesa no se resuelve hasta que el caso
    // lo decide, así el estado previo (respaldo estructural) es observable.
    getSessionMessages.mockImplementation((id: string) => {
      if (id === ROOT) {
        return new Promise<TSessionMessage[]>((resolve) => {
          releases.push(() =>
            resolve([
              step('step_1', [
                spawn({ toolId: 'tool-early', sessionId: EARLY, created: 100, completed: 150 }),
                spawn({ toolId: 'tool-late', sessionId: LATE, created: 500, completed: 550 }),
              ]),
            ]),
          );
        });
      }
      return Promise.resolve([plain(`msg-${id}`)]);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('al llegar la firma de lotes re-deriva las filas y aparece el badge sin cambiar la topología', async () => {
    const queryClient = graphClient();
    queryClient.setQueryData(
      queryKeys.sessions.status(),
      rawStatuses([ROOT, EARLY, LATE]),
    );

    const { result } = renderGraph(queryClient);
    await waitFor(() => expect(result.current.graph.nodes).toHaveLength(3));

    // Estado previo: sin mensajes del padre no hay invocaciones y manda el
    // respaldo por solape de sesión — filas distintas y sin badge.
    expect(
      queryClient.getQueryData(queryKeys.sessions.messages(ROOT)),
    ).toBeUndefined();
    expect(result.current.executionPlan.levelByNode[EARLY]).not.toBe(
      result.current.executionPlan.levelByNode[LATE],
    );
    expect(nodeById(result.current, EARLY).data.parallel).toBeNull();

    // Llegan los mensajes del padre (misma topología: ni un nodo ni una arista
    // cambian). Aun así filas y badge deben re-derivarse.
    await act(async () => {
      for (const release of releases) release();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(nodeById(result.current, EARLY).data.parallel?.size).toBe(2),
    );

    expect(result.current.graph.nodes).toHaveLength(3);
    expect(result.current.executionPlan.levelByNode[EARLY]).toBe(
      result.current.executionPlan.levelByNode[LATE],
    );
    expect(rowOf(result.current, EARLY)?.parallel).toBe(true);
    expect(nodeById(result.current, LATE).data.parallel?.size).toBe(2);
    expectRowBadgeParity(result.current);
  });
});
