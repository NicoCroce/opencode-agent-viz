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
});
