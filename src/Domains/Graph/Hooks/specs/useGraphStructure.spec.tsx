import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
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
  type UseGraphStructureResult,
} from '../useGraphStructure';

/**
 * L4 (contrato de carga §1.1): la fase estructural se deriva **solo** de las
 * consultas ya cacheadas (sesiones, estados y agentes) y **nunca** abre las
 * consultas de contenido (`getSessionMessages`, `getSessionLog`,
 * `getSessionPermissions`, formularios o inbox). Se espía `opencodeService`
 * para garantizarlo (Constitución III).
 */
const service = vi.hoisted(() => ({
  listSessions: vi.fn(),
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

const SESSIONS = [
  session(ROOT),
  session(RUNNING, { parentID: ROOT }),
  session(RETRYING, { parentID: ROOT }),
  session(CREATED, { parentID: RUNNING }),
];

const STATUSES = {
  [RUNNING]: busyStatus,
  [RETRYING]: retryStatus(),
};

let latest: UseGraphStructureResult | null = null;

const StructureProbe = ({
  sessionId,
  directory,
  report,
}: {
  sessionId: string | null;
  directory: string | null;
  report: (result: UseGraphStructureResult) => void;
}) => {
  const result = useGraphStructure(sessionId, directory);
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
) => {
  const report = (result: UseGraphStructureResult) => {
    latest = result;
  };
  const view = renderWithProviders(
    <StructureProbe
      sessionId={sessionId}
      directory={directory}
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
    service.listSessions.mockReset().mockResolvedValue(SESSIONS);
    service.listAgents.mockReset().mockResolvedValue([]);
    for (const spy of contentSpies) spy.mockReset();
  });

  it('derives the structure from cached sessions/status/agents without content queries (L4)', async () => {
    renderStructure();

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(4));

    // Solo se leen las consultas estructurales ya existentes.
    expect(service.listSessions).toHaveBeenCalledWith(DEFAULT_DIRECTORY);
    expect(service.listAgents).toHaveBeenCalledWith(DEFAULT_DIRECTORY);

    // Ninguna consulta de contenido se dispara en la fase de estructura.
    for (const spy of contentSpies) {
      expect(spy).not.toHaveBeenCalled();
    }

    const { edges } = latest!.graph;
    expect(edges.map((edge) => edge.id).sort()).toEqual(
      [
        `${ROOT}->${RUNNING}`,
        `${ROOT}->${RETRYING}`,
        `${RUNNING}->${CREATED}`,
      ].sort(),
    );
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

  it('does not fetch content when there is no session selected', async () => {
    renderStructure(null);

    await waitFor(() => expect(service.listSessions).toHaveBeenCalled());
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
   * más nueva que la lista, y nunca lo hace retroceder.
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

    // La actividad anterior a la lista no retrocede el fin del intervalo.
    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.activity(), {
        [RUNNING]: 1,
      });
    });
    await waitFor(() => expect(updatedAtOf(RUNNING)).toBe(2));
  });

  /**
   * El plan/posiciones se memoizan por `deriveExecutionKey(model)` (T021). Una
   * marca de actividad sobre un nodo **activo** cambia `model` y `updatedAt`,
   * pero **no** la clave de ejecución (el activo sigue `'open'`): el plan y las
   * posiciones conservan su identidad, sin relayout por datos no estructurales
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
   * incorpora (FR-003).
   */
  it('recomputes the execution plan when the topology changes (a new sibling appears)', async () => {
    const view = renderStructure();

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(4));

    const planBefore = latest!.executionPlan;
    const freshSibling = session('running-agent-2', { parentID: ROOT });

    act(() => {
      view.queryClient.setQueryData(queryKeys.sessions.list(DEFAULT_DIRECTORY), [
        ...SESSIONS,
        freshSibling,
      ]);
    });

    await waitFor(() => expect(latest?.graph.nodes).toHaveLength(5));

    expect(latest!.executionPlan.levelByNode).toHaveProperty(
      'running-agent-2',
    );
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
});
