import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SessionInfo } from '@opencode/client';
import { queryKeys } from '@app/Domains/queryKeys';
import { useRootSessions } from '@app/Domains/Sessions';
import { WorkspacePage } from '../WorkspacePage';

/**
 * Spec del orden de estados de pantalla obligatorios (FR-008, Principio VI):
 * **error → carga → vacío → datos**, ejercitado **después** del modelo en dos
 * fases (`useGraphStructure` → `useGraphEnrichment`, contrato de carga §1/§5).
 *
 * Igual que `WorkspacePage.perf.spec.tsx`, se monta la página con el **modelo
 * real** y se controla la red/caché para provocar cada estado. El `graphPane`
 * decide con un ternario cuyo orden es el contrato:
 *
 *   1. `isError`          → `EmptyScreenError`
 *   2. `isLoading`        → `GraphSkeleton`
 *   3. `nodes.length === 0` → `EmptyState` ("Sin agentes")
 *   4. resto              → `AgentGraph`
 *
 * El punto crítico del modelo por fases: `isLoading` refleja **solo** la fase
 * estructural. En cuanto la estructura está disponible (aunque el
 * enriquecimiento siga `pending`) la página muestra **datos**, y el esqueleto
 * no reaparece al completarse el enriquecimiento.
 *
 * Solo se sustituyen las dependencias pesadas de presentación (React Flow, el
 * inspector y el histórico) y el acceso al SDK. Las consultas reales del grafo
 * (`sessions.list`/`status`/`agents.list`) siguen vivas para que la precedencia
 * se verifique sobre el modelo real, no sobre un doble.
 */

/**
 * `@app/Domains/Graph`: se conservan los hooks reales (el modelo por fases) y
 * se sustituyen los componentes que montan React Flow por marcadores
 * identificables para poder afirmar **qué** rama del ternario se pintó.
 */
vi.mock('@app/Domains/Graph', async () => {
  const React = await import('react');
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

  return {
    AgentGraph: () =>
      React.createElement('div', { 'data-testid': 'agent-graph' }),
    GraphSkeleton: () =>
      React.createElement('div', { 'data-testid': 'graph-skeleton' }),
    SessionSummaryBar: () => null,
    isActiveStatus,
    summarizeSession,
    useChainSelection,
    useFollowMode,
    useGraphModel,
    useNow,
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

/**
 * SDK bajo control del test: `listSessions` gobierna la fase estructural
 * (éxito → datos, vacío → vacío, rechazo → error, pendiente → carga) y los
 * loaders de contenido permiten completar el enriquecimiento sin red real.
 */
const service = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listSessions: vi.fn(),
  listAgents: vi.fn(),
  getSessionMessages: vi.fn(),
  getSessionPermissions: vi.fn(),
  getSessionLog: vi.fn(),
  listSessionForms: vi.fn(),
  getSessionForm: vi.fn(),
  listSessionInbox: vi.fn(),
  getActiveSessions: vi.fn(),
  subscribeEvents: vi.fn(),
}));

vi.mock('@app/Infrastructure/Services/opencodeClient', () => ({
  opencodeService: service,
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
 * Cliente con `gcTime`/`staleTime` infinitos para que la estructura sembrada en
 * el caché no se recolecte ni dispare refetch antes de que la página la lea.
 */
const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

/** Siembra el caché con la estructura estructural del subárbol. */
const seedStructureCache = (client: QueryClient): void => {
  client.setQueryData(queryKeys.sessions.list(DIRECTORY), [sessionInfo]);
  client.setQueryData(queryKeys.agents.list(DIRECTORY), []);
  client.setQueryData(queryKeys.sessions.status(), {});
};

const renderWorkspace = (client: QueryClient) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/sessions/${SESSION_ID}`]}>
        <Routes>
          <Route path="/sessions/:id" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

/** Deja correr un turno de idle/setTimeout (batching del enriquecimiento). */
const flushIdle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

beforeEach(() => {
  vi.mocked(useRootSessions).mockReturnValue({
    items: [{ session: sessionInfo, agentName: 'develop' }],
    groups: [],
    isLoading: false,
    isError: false,
    error: null,
  });

  service.listSessions.mockReset();
  service.listAgents.mockResolvedValue([]);
  service.getSessionMessages.mockResolvedValue([]);
  service.getSessionPermissions.mockResolvedValue([]);
  service.getSessionLog.mockResolvedValue([]);
  service.listSessionForms.mockResolvedValue([]);
  service.getSessionForm.mockResolvedValue(undefined);
  service.listSessionInbox.mockResolvedValue([]);
});

describe('WorkspacePage — orden de estados error→carga→vacío→datos (T035, FR-008)', () => {
  it('1) error: con la estructura fallida muestra el error y ningún otro estado', async () => {
    const client = createClient();
    service.listSessions.mockRejectedValue(new Error('fallo de red'));

    renderWorkspace(client);

    await waitFor(() => expect(screen.getByText('Error')).toBeInTheDocument());
    // El error gana incluso con el grafo vacío (misma condición que "vacío").
    expect(screen.getByText('fallo de red')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-graph')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin agentes')).not.toBeInTheDocument();
  });

  it('2) carga: mientras la estructura no está disponible muestra el esqueleto, no el vacío', async () => {
    const client = createClient();
    // Nunca resuelve: la fase estructural sigue en curso (`isLoading`).
    service.listSessions.mockReturnValue(new Promise(() => {}));

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('graph-skeleton')).toBeInTheDocument(),
    );
    // La carga gana al vacío aunque `nodes.length === 0` en ambos.
    expect(screen.queryByText('Sin agentes')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-graph')).not.toBeInTheDocument();
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });

  it('3) vacío: con la estructura lista pero sin agentes muestra el estado vacío', async () => {
    const client = createClient();
    service.listSessions.mockResolvedValue([]);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByText('Sin agentes')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('graph-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-graph')).not.toBeInTheDocument();
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });

  it('4) datos: con la estructura y nodos disponibles muestra el grafo', async () => {
    const client = createClient();
    service.listSessions.mockResolvedValue([sessionInfo]);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('graph-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin agentes')).not.toBeInTheDocument();
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });

  it('prioridad: el error gana a los datos si una recarga falla', async () => {
    const client = createClient();
    seedStructureCache(client);
    service.listSessions.mockRejectedValue(new Error('recarga fallida'));

    renderWorkspace(client);

    // La estructura cacheada ya pinta datos.
    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );

    // Una recarga fallida deja datos en caché pero marca `isError`; el ternario
    // debe resolver por la primera rama (error), no por la de datos.
    await act(async () => {
      await client.refetchQueries({
        queryKey: queryKeys.sessions.list(DIRECTORY),
      });
    });

    await waitFor(() => expect(screen.getByText('Error')).toBeInTheDocument());
    expect(screen.queryByTestId('agent-graph')).not.toBeInTheDocument();
    expect(screen.queryByTestId('graph-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin agentes')).not.toBeInTheDocument();
  });

  it('modelo en dos fases: la estructura cacheada muestra datos aunque el enriquecimiento siga pending, y no vuelve a carga', async () => {
    const client = createClient();
    seedStructureCache(client);
    service.listSessions.mockResolvedValue([sessionInfo]);

    renderWorkspace(client);

    // La fase estructural pinta de inmediato: datos, nunca esqueleto.
    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('graph-skeleton')).not.toBeInTheDocument();

    // Al completarse el enriquecimiento (siguiente turno de idle) el estado de
    // pantalla sigue siendo "datos": `isLoading` pertenece a la estructura.
    await flushIdle();

    expect(screen.getByTestId('agent-graph')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin agentes')).not.toBeInTheDocument();
  });
});
