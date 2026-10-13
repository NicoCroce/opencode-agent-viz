import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import type { SessionInfo } from '@opencode/client';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { queryKeys } from '../../../queryKeys';
import { EMPTY_METRICS } from '../../Graph.entity';
import {
  DEFAULT_DIRECTORY,
  busyStatus,
  retryStatus,
  session,
} from '../../lib/specs/fixtures';
import {
  useGraphStructure,
  type TDirectoryResolution,
  type UseGraphStructureResult,
} from '../useGraphStructure';

/**
 * E2 (contrato de subárbol §1/§3, FR-013): el origen de la fase estructural
 * deja de ser la **ventana global** de 200 sesiones (`listSessions`, que las
 * hijas de subagente desplazan y recorta el árbol en silencio) y pasa a ser el
 * **subárbol** de la sesión abierta: raíces (`listRootSessions`) + BFS
 * descendente por `parentID` (`listChildSessions`), con `getSession` para subir
 * cuando la raíz quedó fuera de la ventana de `items` (S2).
 *
 * La fase sigue sin abrir consultas de **contenido** (L4 de `006`, spía de
 * `opencodeService`) y el corte del subárbol por **presupuesto global** se
 * declara (`truncated`, FR-006/SC-009), nunca en silencio.
 *
 * Escrito antes del cambio de `useGraphStructure` (T021): debe fallar mientras
 * el hook siga leyendo `sessions.list` + `filterSubtree`.
 */
const service = vi.hoisted(() => ({
  listSessions: vi.fn(),
  listRootSessions: vi.fn(),
  listChildSessions: vi.fn(),
  getSession: vi.fn(),
  listProjects: vi.fn(),
  listAgents: vi.fn(),
  getSessionMessages: vi.fn(),
  getSessionLog: vi.fn(),
  getSessionPermissions: vi.fn(),
  listSessionForms: vi.fn(),
  getSessionForm: vi.fn(),
  listSessionInbox: vi.fn(),
}));

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: service,
}));

const ROOT = 'root';
const RUNNING = 'running-agent';
const RETRYING = 'retrying-agent';
const CREATED = 'created-agent';
/** Raíz que quedó fuera de la ventana/listado de raíces (enlace directo). */
const HIDDEN_ROOT = 'hidden-root';
const HIDDEN_CHILD = 'hidden-child';
/** Hermano nuevo que aparece a mitad de la ejecución (topología). */
const FRESH_SIBLING = 'running-agent-2';
/** Sesión enlazada que **no** existe: ni en raíces ni resoluble con `session.get`. */
const MISSING = 'missing-session';

/** Bosque de prueba: raíces sin `parentID`, hijas con el suyo. */
const ALL: Record<string, SessionInfo> = {
  [ROOT]: session(ROOT),
  [RUNNING]: session(RUNNING, { parentID: ROOT }),
  [RETRYING]: session(RETRYING, { parentID: ROOT }),
  [CREATED]: session(CREATED, { parentID: RUNNING }),
  [HIDDEN_ROOT]: session(HIDDEN_ROOT),
  [HIDDEN_CHILD]: session(HIDDEN_CHILD, { parentID: HIDDEN_ROOT }),
};

/**
 * Ventana global de 200 más recientes (`listSessions`): trae la raíz y a
 * `RUNNING`, pero **no** a `RETRYING` ni al nieto `CREATED`. Es exactamente el
 * recorte que dejaba el grafo incompleto y sin declararlo.
 */
const GLOBAL_WINDOW = [ALL[ROOT], ALL[RUNNING]];

/** Hijos directos por padre: lo que devuelve el BFS del subárbol. */
const CHILDREN: Record<string, string[]> = {
  [ROOT]: [RUNNING, RETRYING],
  [RUNNING]: [CREATED],
  [HIDDEN_ROOT]: [HIDDEN_CHILD],
};

/**
 * Sonda del presupuesto **global** del cargador (data-model §3): muy por encima
 * del techo de fluidez (~200 agentes, `006`) y del presupuesto recomendado para
 * el cargador (1.000 nodos, findings de performance C2.4). Al superarlo, el
 * subárbol se corta y el resultado **declara** el corte.
 */
const BUDGET_PROBE = 1_500;

let childrenByParent: Record<string, string[]> = CHILDREN;
let latest: UseGraphStructureResult | null = null;

const seedChildren = (children: Record<string, string[]>): void => {
  childrenByParent = children;
};

/** Hijos conocidos del bosque; cualquier otro id se materializa sobre la marcha. */
const childOf = (id: string, parentID: string): SessionInfo =>
  ALL[id] ?? session(id, { parentID });

const STATUSES = {
  [RUNNING]: busyStatus,
  [RETRYING]: retryStatus(),
};

const StructureProbe = ({
  sessionId,
  directory,
  directoryResolution,
  report,
}: {
  sessionId: string | null;
  directory: string | null;
  directoryResolution?: TDirectoryResolution;
  report: (result: UseGraphStructureResult) => void;
}) => {
  const result = useGraphStructure(sessionId, directory, directoryResolution);
  // Se reporta desde un efecto (no durante el render) para no mutar estado
  // externo en la fase de render.
  useEffect(() => {
    report(result);
  }, [result, report]);
  return null;
};

const renderStructure = (
  sessionId: string | null = ROOT,
  directory: string | null = DEFAULT_DIRECTORY,
  directoryResolution?: TDirectoryResolution,
) => {
  const report = (result: UseGraphStructureResult) => {
    latest = result;
  };
  const view = renderWithProviders(
    <StructureProbe
      sessionId={sessionId}
      directory={directory}
      directoryResolution={directoryResolution}
      report={report}
    />,
  );
  act(() => {
    view.queryClient.setQueryData(queryKeys.sessions.status(), STATUSES);
  });
  return view;
};

/** Contenido que la fase estructural **no** debe pedir (L4). */
const contentSpies = [
  service.getSessionMessages,
  service.getSessionLog,
  service.getSessionPermissions,
  service.listSessionForms,
  service.getSessionForm,
  service.listSessionInbox,
];

describe('useGraphStructure', () => {
  beforeEach(() => {
    latest = null;
    childrenByParent = CHILDREN;
    // Ventana global disponible pero **nunca** el origen (FR-013).
    service.listSessions.mockReset().mockResolvedValue(GLOBAL_WINDOW);
    service.listRootSessions
      .mockReset()
      .mockResolvedValue({ sessions: [ALL[ROOT]], truncated: false });
    service.listChildSessions
      .mockReset()
      .mockImplementation((parentID: string) =>
        Promise.resolve(
          (childrenByParent[parentID] ?? []).map((id) => childOf(id, parentID)),
        ),
      );
    service.getSession.mockReset().mockImplementation((id: string) => {
      const found = ALL[id];
      // El SDK rechaza cuando la sesión no existe (el consumidor decide entre
      // "no encontrada" y error); aquí solo hay sesiones conocidas.
      return found
        ? Promise.resolve(found)
        : Promise.reject(new Error(`sesión ${id} inexistente`));
    });
    // Defensivo: si el hook reutiliza `useRootSessions` (descubre proyectos por
    // `/project`), el proyecto del test tiene que existir.
    service.listProjects
      .mockReset()
      .mockResolvedValue([{ id: 'proj', canonical: DEFAULT_DIRECTORY }]);
    service.listAgents.mockReset().mockResolvedValue([]);
    for (const spy of contentSpies) spy.mockReset();
  });

  /* ---------------------------------------------------------------- */
  /* Origen = subárbol (FR-013) y corte declarado (FR-006).            */
  /* ---------------------------------------------------------------- */

  it('derives the structure from the subtree, not from the global session window', async () => {
    renderStructure();

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(4));

    // La ventana global deja de ser el origen estructural: ni se consulta.
    expect(service.listSessions).not.toHaveBeenCalled();

    // El origen son las raíces + el BFS por `parentID`.
    expect(service.listRootSessions).toHaveBeenCalledWith(DEFAULT_DIRECTORY);
    expect(service.listChildSessions).toHaveBeenCalledWith(ROOT);

    const nodeIds = latest!.graph.nodes.map((node) => node.id).sort();
    // `RETRYING` y `CREATED` estaban **fuera** de la primera página del listado
    // global, y aun así el grafo los incluye.
    expect(nodeIds).toEqual([ROOT, RUNNING, RETRYING, CREATED].sort());

    const { edges } = latest!.graph;
    expect(edges.map((edge) => edge.id).sort()).toEqual(
      [
        `${ROOT}->${RUNNING}`,
        `${ROOT}->${RETRYING}`,
        `${RUNNING}->${CREATED}`,
      ].sort(),
    );
  });

  it('loads the subtree of a root that fell outside the roots window (FR-003)', async () => {
    // Enlace directo a una raíz que no está en `items`.
    service.listRootSessions.mockResolvedValue({
      sessions: [],
      truncated: false,
    });

    renderStructure(HIDDEN_ROOT);

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(2));

    // Se sube por `parentID` con `session.get` (S2) en vez de darse por perdida
    // y dejar la pantalla en esqueleto terminal.
    expect(service.getSession).toHaveBeenCalledWith(HIDDEN_ROOT);
    expect(service.listChildSessions).toHaveBeenCalledWith(HIDDEN_ROOT);
    expect(latest!.graph.nodes.map((node) => node.id).sort()).toEqual(
      [HIDDEN_ROOT, HIDDEN_CHILD].sort(),
    );
  });

  it('declares the truncation when the subtree hits the global budget (FR-006, SC-009)', async () => {
    seedChildren({
      [ROOT]: Array.from(
        { length: BUDGET_PROBE },
        (_, index) => `bulk-${index}`,
      ),
    });

    renderStructure();

    await waitFor(() => expect(latest?.truncated).toBe(true));

    // Nunca recorte silencioso: además de declararlo, el grafo se corta.
    expect(latest!.graph.nodes.length).toBeLessThan(BUDGET_PROBE + 1);
  });

  it('preserves L4: the structural phase never opens content queries (E2)', async () => {
    renderStructure();

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(4));

    for (const spy of contentSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('marks every structural node as pending with EMPTY_METRICS', async () => {
    renderStructure();

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(4));

    for (const node of latest!.graph.nodes) {
      expect(node.data.enrichment).toBe('pending');
      // La estructura arranca sin métricas: se resuelven en el enriquecimiento.
      expect(node.data.metrics).toEqual(EMPTY_METRICS);
    }
  });

  it('only running/retrying/created are definitive in the structural phase', async () => {
    renderStructure();

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(4));

    const byId = Object.fromEntries(
      latest!.graph.nodes.map((node) => [node.id, node.data]),
    );
    expect(byId[ROOT].status).toBe('created');
    expect(byId[RUNNING].status).toBe('running');
    expect(byId[RETRYING].status).toBe('retrying');
    expect(byId[CREATED].status).toBe('created');

    // El reintento (derivable de `SessionStatus`) sí es definitivo.
    expect(byId[RETRYING].retry).toEqual({ attempt: 2, next: 1_234 });
    expect(byId[RUNNING].retry).toBeNull();

    // La métrica sigue siendo la vacía, incluso con un reintento en curso.
    expect(byId[RETRYING].metrics).toEqual(EMPTY_METRICS);
  });

  /* ---------------------------------------------------------------- */
  /* Paridad fila ↔ badge en la fase estructural (FR-008, E5; ronda de */
  /* reparación: lotes derivados una sola vez e inyectados).           */
  /* ---------------------------------------------------------------- */

  /**
   * La fase estructural deriva los lotes **una sola vez** y los inyecta a filas
   * (`deriveExecutionLevels`) y badge (`toParallelByNode`), así que una fila
   * marcada paralela no puede quedarse sin badge. Con los hermanos activos del
   * fixture (`RUNNING` y `RETRYING` solapan) hay paridad real que comprobar, no
   * un caso vacío. Aditivo.
   */
  it('keeps row ↔ badge parity by deriving the batches once (FR-008, E5)', async () => {
    renderStructure();

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(4));

    const parallelById = new Map(
      latest!.graph.nodes.map((node) => [node.id, node.data.parallel]),
    );

    // Los dos hermanos activos forman un único lote de 2: fila paralela + badge.
    expect(latest!.parallelGroups).toHaveLength(1);
    expect([...latest!.parallelGroups[0].nodeIds].sort()).toEqual(
      [RUNNING, RETRYING].sort(),
    );

    const parallelLevels = latest!.executionPlan.levels.filter(
      (level) => level.parallel,
    );
    expect(parallelLevels.map((level) => [...level.nodeIds].sort())).toEqual([
      [RUNNING, RETRYING].sort(),
    ]);

    // Invariante E5: toda fila paralela tiene badge de tamaño 2+ en cada nodo,
    // con el `groupId` del único lote estructural (misma fuente para ambos).
    const [onlyGroup] = latest!.parallelGroups;
    for (const level of parallelLevels) {
      for (const id of level.nodeIds) {
        expect(parallelById.get(id)).toEqual({ groupId: onlyGroup.id, size: 2 });
      }
    }
    // Y al revés en esta fase: sin fila paralela no hay badge.
    for (const node of latest!.graph.nodes) {
      const inParallelLevel = parallelLevels.some((level) =>
        level.nodeIds.includes(node.id),
      );
      if (!inParallelLevel) expect(parallelById.get(node.id)).toBeNull();
    }
  });

  it('does not fetch content when there is no session selected', async () => {
    renderStructure(null);

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(0));

    for (const spy of contentSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  /* ---------------------------------------------------------------- */
  /* A4/E6 — frescura del nodo y plan memoizado por la clave de        */
  /* ejecución (fr-009, FR-003/FR-007, L4 de 006).                     */
  /* ---------------------------------------------------------------- */

  /**
   * El nodo estructural toma `updatedAt` de la **marca de actividad**
   * (`queryKeys.sessions.activity()`, FR-009): la marca en vivo que
   * `reduceActivity` parchea por SSE adelanta el fin del intervalo cuando es
   * más nueva que el subárbol, y nunca lo hace retroceder.
   */
  it('refreshes the node updatedAt from the cached activity mark (FR-009)', async () => {
    const view = renderStructure();

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(4));

    const updatedAtOf = (id: string) =>
      latest!.graph.nodes.find((node) => node.id === id)!.data.updatedAt;

    // Línea base: sin marca de actividad gana `session.time.updated` (2).
    expect(updatedAtOf(RUNNING)).toBe(2);

    // La marca de actividad del stream adelanta `updatedAt` solo de ese nodo.
    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.activity(), {
        [RUNNING]: 5_000,
      });
    });
    await waitFor(() => expect(updatedAtOf(RUNNING)).toBe(5_000));
    expect(updatedAtOf(ROOT)).toBe(2);

    // La actividad anterior al fin observado no retrocede el intervalo.
    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.activity(), {
        [RUNNING]: 1,
      });
    });
    await waitFor(() => expect(updatedAtOf(RUNNING)).toBe(2));
  });

  /**
   * El plan/posiciones se memoizan por `deriveExecutionKey(model)`. Una marca de
   * actividad sobre un nodo **activo** cambia `model` y `updatedAt`, pero **no**
   * la clave de ejecución (el activo sigue `'open'`): el plan y las posiciones
   * conservan su identidad, sin relayout por datos no estructurales
   * (FR-007/SC-004).
   */
  it('does not recompute the execution plan when only a live active activity mark advances (FR-007)', async () => {
    const view = renderStructure();

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(4));

    const planBefore = latest!.executionPlan;
    const positionsBefore = latest!.graph.nodes.map((node) => node.position);

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.activity(), {
        [RUNNING]: 9_000,
      });
    });

    // La marca sí refresca el nodo...
    await waitFor(() =>
      expect(
        latest!.graph.nodes.find((node) => node.id === RUNNING)!.data.updatedAt,
      ).toBe(9_000),
    );

    // ...pero el plan y las posiciones no se recalculan (misma clave).
    expect(latest!.executionPlan).toBe(planBefore);
    expect(latest!.graph.nodes.map((node) => node.position)).toEqual(
      positionsBefore,
    );
  });

  /**
   * Cambiar la **clase de intervalo** de un nodo (activo → terminado) sí altera
   * `deriveExecutionKey` sin mover la topología: el plan se recalcula. Esto
   * prueba que la memoización es por la clave de ejecución, no por la firma de
   * topología ni por la identidad de `model` (FR-003).
   */
  it('recomputes the execution plan when a node changes its interval class (active → terminated)', async () => {
    const view = renderStructure();

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(4));

    const statusOf = (id: string) =>
      latest!.graph.nodes.find((node) => node.id === id)!.data.status;
    expect(statusOf(RUNNING)).toBe('running');

    const planBefore = latest!.executionPlan;

    // Quita a `RUNNING` del mapa de estados: pasa de activo a `created`
    // (terminado) sin cambiar la topología ni el conjunto de nodos.
    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.status(), {
        [RETRYING]: retryStatus(),
      });
    });

    await waitFor(() => expect(statusOf(RUNNING)).toBe('created'));

    expect(latest!.executionPlan).not.toBe(planBefore);
  });

  /**
   * Un cambio de **topología** (aparece un hermano nuevo) también cambia la
   * clave de ejecución y recalcula el plan: el nivel/columna del nuevo nodo se
   * incorpora (FR-003). El árbol se refresca refrescando la profundidad 1 de la
   * raíz observada (contrato de subárbol §2): sin `staleTime`, invalidar
   * re-ejecuta el BFS y el hermano entra en el subárbol.
   */
  it('recomputes the execution plan when the topology changes (a new sibling appears)', async () => {
    const view = renderStructure();

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(4));

    const planBefore = latest!.executionPlan;
    seedChildren({
      ...CHILDREN,
      [ROOT]: [RUNNING, RETRYING, FRESH_SIBLING],
    });

    act(() => {
      void view.queryClient.invalidateQueries();
    });

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(5));

    expect(latest!.executionPlan.levelByNode).toHaveProperty(FRESH_SIBLING);
    expect(latest!.executionPlan).not.toBe(planBefore);
  });

  /**
   * L4 de 006: ni el refresco de la marca de actividad ni el recálculo por
   * clave de ejecución abren consultas de contenido. La fase estructural se
   * mantiene sobre las consultas ya cacheadas (Constitución III).
   */
  it('preserves L4: activity refresh and execution-key recalcs never open content queries', async () => {
    const view = renderStructure();

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(4));

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.activity(), {
        [RUNNING]: 9_000,
      });
    });
    await waitFor(() =>
      expect(
        latest!.graph.nodes.find((node) => node.id === RUNNING)!.data.updatedAt,
      ).toBe(9_000),
    );

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.status(), {
        [RETRYING]: retryStatus(),
      });
    });
    await waitFor(() =>
      expect(
        latest!.graph.nodes.find((node) => node.id === RUNNING)!.data.status,
      ).toBe('created'),
    );

    for (const spy of contentSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  /* ---------------------------------------------------------------- */
  /* Ronda de reparación — estados de pantalla sin esqueleto terminal  */
  /* (Principio VI, FR-004/FR-005, SC-002; contrato de subárbol §4).   */
  /* ---------------------------------------------------------------- */

  /**
   * Sesión inexistente **con** `directory` resuelto: el cargador sube con
   * `session.get` (el respaldo), el servicio rechaza y el cargador lo traduce a
   * "no encontrada" —no a error ni a "sin agentes" (FR-005)—.
   */
  it('declara "no encontrada" cuando el respaldo session.get rechaza la sesión (FR-005)', async () => {
    renderStructure(MISSING);

    await waitFor(() => expect(latest?.isLoading).toBe(false));

    expect(service.getSession).toHaveBeenCalledWith(MISSING);
    expect(latest!.notFound).toBe(true);
    expect(latest!.isError).toBe(false);
    expect(latest!.error).toBeNull();
    expect(latest!.graph.nodes).toHaveLength(0);
  });

  /**
   * El caso del bug: la sesión no existe y por eso el `directory` tampoco se
   * resuelve. El cargador del subárbol **no corre** sin `directory`, así que
   * `notFound` era inalcanzable y la vista quedaba en esqueleto terminal. Al
   * propagar el estado de resolución del directorio (`isError` tras el respaldo)
   * el estado "no encontrada" se alcanza desde la resolución del `directory`.
   */
  it('alcanza "no encontrada" cuando el directorio no se resuelve (sesión inexistente, FR-004/FR-005)', async () => {
    renderStructure(MISSING, null, { isLoading: false, isError: true });

    await waitFor(() => expect(latest?.isLoading).toBe(false));

    expect(latest!.notFound).toBe(true);
    expect(latest!.isError).toBe(false);
    expect(latest!.error).toBeNull();
    expect(latest!.graph.nodes).toHaveLength(0);
    // Sin `directory` no hay subárbol que pedir: no se consulta a las raíces.
    expect(service.listRootSessions).not.toHaveBeenCalled();
  });

  /**
   * El respaldo del `directory` falló por red/servidor (no por «no existe»):
   * es un error con reintento, NO «no encontrada» (FR-005 solo para 404 real).
   */
  it('declara error, no "no encontrada", cuando el directorio falla por red', async () => {
    renderStructure(MISSING, null, {
      isLoading: false,
      isError: true,
      isNotFound: false,
    });

    await waitFor(() => expect(latest?.isLoading).toBe(false));

    expect(latest!.notFound).toBe(false);
    expect(latest!.isError).toBe(true);
  });

  /**
   * Fallo de red/servidor al cargar el subárbol: **error con reintento**, no
   * "no encontrada" y nunca un esqueleto terminal (FR-004/SC-002).
   */
  it('declara error con reintento cuando el subárbol falla por red (FR-004/SC-002)', async () => {
    service.listRootSessions.mockRejectedValue(new Error('red caída'));

    renderStructure(ROOT);

    await waitFor(() => expect(latest?.isError).toBe(true));

    expect(latest!.isLoading).toBe(false);
    expect(latest!.notFound).toBe(false);
    expect(latest!.error?.message).toBe('red caída');
    expect(latest!.graph.nodes).toHaveLength(0);
  });
});
