import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SessionInfo } from '@opencode/client';
import { STORE_KEY } from '@app/Application/Hooks';
import {
  INSPECTOR_DEFAULT_WIDTH,
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
  INSPECTOR_STEP,
} from '@app/Application/Helpers/panelWidth';
import { queryKeys } from '@app/Domains/queryKeys';
import type { TAttentionItem } from '@app/Domains/Chat';
import { useSessionAttention } from '@app/Domains/Chat/Hooks/useSessionAttention';
import { useRootSessions } from '@app/Domains/Sessions';
import { INSPECTOR_PANEL_WIDTH_KEY } from '../Hooks/useInspectorPanel';
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
    // Marcador identificable que refleja la selección explícita y permite
    // ejercerla desde el spec (T062): el botón invoca `onSelectNode` y el
    // contenedor expone `selectedNodeId` para poder afirmar que `Escape` no la
    // limpia cuando el foco está en el composer.
    AgentGraph: (props: {
      selectedNodeId?: string | null;
      onSelectNode?: (id: string) => void;
      attentionNodeIds?: ReadonlySet<string>;
    }) =>
      React.createElement(
        'div',
        {
          'data-testid': 'agent-graph',
          'data-selected': props.selectedNodeId ?? '',
          // Realce de atención (T072): el Set derivado en `WorkspacePage` viaja
          // hasta el grafo; se expone para verificar el cableado (FR-009).
          'data-attention': [...(props.attentionNodeIds ?? [])].sort().join(','),
        },
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: () => props.onSelectNode?.('ses_root'),
          },
          'Seleccionar nodo',
        ),
      ),
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

vi.mock('@app/Domains/Sessions', async () => {
  const React = await import('react');
  return {
    // T073: el rail (real) pasa `attentionByRoot` al listado; se expone para
    // verificar el cableado sin montar las tarjetas (FR-009).
    SessionList: (props: { attentionByRoot?: Record<string, number> }) =>
      React.createElement('div', {
        'data-testid': 'session-list',
        'data-attention': JSON.stringify(props.attentionByRoot ?? {}),
      }),
    SessionListSkeleton: () => null,
    sessionDetailPath: (id: string) => `/sessions/${id}`,
    useGetSessionStatus: () => ({ data: {} }),
    useRootSessions: vi.fn(),
  };
});

vi.mock('@app/Domains/Inspector', async () => {
  const React = await import('react');
  const { useDevice } = await import('@app/Application/Hooks');
  return {
    // Marcador identificable: permite afirmar que el contenido del panel no se
    // remonta al cambiar el ancho (P5/FR-012). Reproduce el control de
    // fullscreen del panel real (solo escritorio) para poder ejercer el toggle
    // y su cierre (US6/T051).
    InspectorPanel: (props: {
      isFullscreen?: boolean;
      onToggleFullscreen?: () => void;
    }) => {
      const { isDesktop } = useDevice();
      const control =
        isDesktop && props.onToggleFullscreen
          ? React.createElement(
              'button',
              {
                type: 'button',
                'aria-pressed': Boolean(props.isFullscreen),
                'aria-label': props.isFullscreen
                  ? 'Salir de pantalla completa'
                  : 'Pantalla completa',
                onClick: props.onToggleFullscreen,
              },
              'fullscreen',
            )
          : null;

      return React.createElement(
        'div',
        { 'data-testid': 'inspector-panel' },
        control,
      );
    },
    useSessionContext: () => ({
      messages: [],
      isError: false,
      isLoading: false,
    }),
    useSessionForms: () => ({ questions: [] }),
  };
});

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
 * `@app/Domains/Chat` (T026/T062): se sustituye el orquestador real por un
 * marcador que expone la sesión recibida, para verificar el cableado del slot
 * `chat` en `InspectorPane`/`WorkspaceLayout` sin montar el compositor ni la
 * fachada de escritura. Incluye un `textarea` (composer) para poder enfocar el
 * panel y ejercer la coordinación de `Escape` (T062). El `ChatPanel` real se
 * cubre en su propio spec.
 */
vi.mock('@app/Domains/Chat', async (importOriginal) => {
  const React = await import('react');
  const actual = await importOriginal<typeof import('@app/Domains/Chat')>();
  return {
    ChatPanel: (props: {
      sessionId: string;
      directory?: string | null;
      selectionSeed?: { agent?: string | null; model?: unknown };
    }) =>
      React.createElement(
        'div',
        {
          'data-testid': 'chat-panel',
          'data-session-id': props.sessionId,
          // T077: el directorio que scopea el catálogo del selector (FR-008).
          'data-directory': props.directory ?? '',
          // T078: la semilla de selección derivada del nodo abierto (FR-008).
          'data-selection': JSON.stringify(props.selectionSeed ?? {}),
        },
        React.createElement('textarea', { 'aria-label': 'Mensaje' }),
      ),
    // T053/T075: se conserva el badge real para verificar su montaje tanto en el
    // trigger de escritorio como en el tab móvil (FR-009).
    ChatAttentionBadge: actual.ChatAttentionBadge,
  };
});

/**
 * Señales de atención (T055): la derivación (`useSessionAttention`) y el aviso
 * efímero (`useAttentionNotifications`) son hooks del dominio Chat; se sustituyen
 * por dobles para controlar la atención derivada y capturar el manejador de
 * navegación a la request origen (FR-010) sin montar `sonner`.
 *
 * El espía se declara con `vi.hoisted` y firma explícita: al ser `vi.mock` de un
 * factory, la referencia importada degrada el tipo a `any`; con el espía tipado
 * las llamadas se leen sin `no-unsafe-*`.
 */
const attentionNotifications = vi.hoisted(() =>
  vi.fn<
    (items: TAttentionItem[], onNavigate?: (item: TAttentionItem) => void) => void
  >(),
);

vi.mock('@app/Domains/Chat/Hooks/useSessionAttention', () => ({
  useSessionAttention: vi.fn(() => []),
}));

vi.mock('@app/Domains/Chat/Hooks/useAttentionNotifications', () => ({
  useAttentionNotifications: attentionNotifications,
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

/**
 * Fija la presentación (desktop/móvil) sembrando el store global que consume
 * `useDevice` (`STORE_KEY.isMobile`). Sin sembrar, `useDevice` arranca en móvil.
 */
const setDevice = (client: QueryClient, isMobile: boolean): void => {
  client.setQueryData([STORE_KEY.isMobile], isMobile);
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
  vi.mocked(useSessionAttention).mockReturnValue([]);
  attentionNotifications.mockClear();

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

describe('WorkspacePage — resize del panel de detalle (T042, P5, FR-012, SC-007)', () => {
  beforeEach(() => {
    service.listSessions.mockResolvedValue([sessionInfo]);
  });

  it('escritorio: monta el separador accesible y ajusta el ancho sin alterar grafo ni contenido', async () => {
    const client = createClient();
    seedStructureCache(client);
    setDevice(client, false);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );

    const separator = screen.getByRole('separator');
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    expect(separator).toHaveAttribute(
      'aria-valuenow',
      String(INSPECTOR_DEFAULT_WIDTH),
    );
    expect(separator).toHaveAttribute(
      'aria-valuemin',
      String(INSPECTOR_MIN_WIDTH),
    );
    expect(separator).toHaveAttribute(
      'aria-valuemax',
      String(INSPECTOR_MAX_WIDTH),
    );
    expect(separator).toHaveAttribute('tabindex', '0');

    const column = screen.getByTestId('inspector-column');
    expect(column).toHaveStyle({ width: `${INSPECTOR_DEFAULT_WIDTH}px` });

    // Referencias de nodo del contenido: no deben cambiar al redimensionar.
    const inspectorBefore = screen.getByTestId('inspector-panel');
    const graphBefore = screen.getByTestId('agent-graph');

    fireEvent.keyDown(separator, { key: 'ArrowLeft' });

    const widened = INSPECTOR_DEFAULT_WIDTH + INSPECTOR_STEP;
    expect(column).toHaveStyle({ width: `${widened}px` });
    expect(separator).toHaveAttribute('aria-valuenow', String(widened));
    // El contenido del inspector y el grafo se conservan intactos (FR-012).
    expect(screen.getByTestId('inspector-panel')).toBe(inspectorBefore);
    expect(screen.getByTestId('agent-graph')).toBe(graphBefore);
  });

  it('móvil: no monta el separador ni el control de fullscreen, aun con el panel activo', async () => {
    const client = createClient();
    seedStructureCache(client);
    setDevice(client, true);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );

    // Se abre la pestaña del inspector: el panel se monta, pero los controles de
    // escritorio (separador y fullscreen) no deben existir (AGENTS §9).
    fireEvent.click(screen.getByRole('tab', { name: 'inspector' }));

    expect(screen.getByTestId('inspector-panel')).toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /pantalla completa|fullscreen/i }),
    ).not.toBeInTheDocument();
  });
});

describe('WorkspacePage — fullscreen del panel de detalle (T051, P6, FR-013..FR-015)', () => {
  beforeEach(() => {
    service.listSessions.mockResolvedValue([sessionInfo]);
  });

  const renderDesktopWorkspace = async () => {
    const client = createClient();
    seedStructureCache(client);
    setDevice(client, false);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );
  };

  it('toggleFullscreen expande el panel y el mismo control vuelve al layout normal', async () => {
    await renderDesktopWorkspace();

    expect(screen.getByTestId('inspector-column')).not.toHaveAttribute(
      'data-fullscreen',
    );
    expect(screen.getByRole('separator')).toBeInTheDocument();

    const expand = screen.getByRole('button', { name: 'Pantalla completa' });
    expect(expand).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(expand);

    const overlay = screen.getByTestId('inspector-column');
    expect(overlay).toHaveAttribute('data-fullscreen', 'true');
    expect(overlay).toHaveClass('bg-surface-0');
    // El separador de escritorio no se monta en fullscreen.
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();

    const collapse = screen.getByRole('button', {
      name: 'Salir de pantalla completa',
    });
    expect(collapse).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(collapse);

    expect(screen.getByTestId('inspector-column')).not.toHaveAttribute(
      'data-fullscreen',
    );
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('Escape cierra el fullscreen antes de limpiar la selección', async () => {
    await renderDesktopWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa' }));
    expect(screen.getByTestId('inspector-column')).toHaveAttribute(
      'data-fullscreen',
      'true',
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.getByTestId('inspector-column')).not.toHaveAttribute(
        'data-fullscreen',
      ),
    );
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('arranca en layout normal y no persiste el fullscreen', async () => {
    await renderDesktopWorkspace();

    expect(screen.getByTestId('inspector-column')).not.toHaveAttribute(
      'data-fullscreen',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa' }));
    expect(screen.getByTestId('inspector-column')).toHaveAttribute(
      'data-fullscreen',
      'true',
    );

    // Solo se persiste el ancho del panel, nunca el estado de fullscreen.
    const keys = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.key(index),
    );
    expect(keys).toEqual([INSPECTOR_PANEL_WIDTH_KEY]);
  });
});

describe('WorkspacePage — cableado del panel de chat (T026, FR-008/FR-014)', () => {
  beforeEach(() => {
    service.listSessions.mockResolvedValue([sessionInfo]);
  });

  it('escritorio: pasa el ChatPanel con la sesión abierta al slot de la pestaña Chat', async () => {
    const client = createClient();
    seedStructureCache(client);
    setDevice(client, false);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );

    // El tablist interno Detalle|Chat existe en escritorio (FR-008).
    expect(
      screen.getByRole('tablist', { name: 'Vistas del panel de detalle' }),
    ).toBeInTheDocument();
    // El contenido del chat es perezoso: no se monta hasta activar la pestaña.
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Chat' }), {
      button: 0,
    });

    const chat = await screen.findByTestId('chat-panel');
    expect(chat).toHaveAttribute('data-session-id', SESSION_ID);
  });

  it('escritorio: pasa el directorio y la semilla de selección del nodo al ChatPanel (T077/T078, FR-008)', async () => {
    const client = createClient();
    seedStructureCache(client);
    setDevice(client, false);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Chat' }), {
      button: 0,
    });

    const chat = await screen.findByTestId('chat-panel');
    // T077: el directorio de la sesión scopea el catálogo del selector.
    expect(chat).toHaveAttribute('data-directory', DIRECTORY);
    // T078: la semilla se deriva del nodo abierto (`data.sessionId === id`).
    expect(chat).toHaveAttribute(
      'data-selection',
      JSON.stringify({ agent: 'develop', model: null }),
    );
  });

  it('móvil: no monta el tablist interno Detalle|Chat (sin tabbars anidadas)', async () => {
    const client = createClient();
    seedStructureCache(client);
    setDevice(client, true);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('tab', { name: 'inspector' }));

    expect(screen.getByTestId('inspector-panel')).toBeInTheDocument();
    expect(
      screen.queryByRole('tablist', { name: 'Vistas del panel de detalle' }),
    ).not.toBeInTheDocument();
  });

  it('móvil: monta el ChatPanel como tab de primer nivel (T062, FR-013)', async () => {
    const client = createClient();
    seedStructureCache(client);
    setDevice(client, true);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );

    // El contenido del tab es perezoso: sin cablear la prop `chat` de
    // `WorkspaceLayout` el destino quedaría vacío.
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'chat' }));

    const chat = await screen.findByTestId('chat-panel');
    expect(chat).toHaveAttribute('data-session-id', SESSION_ID);
  });
});

describe('WorkspacePage — señales de atención y navegación a la request (T055, FR-010, A7)', () => {
  beforeEach(() => {
    service.listSessions.mockResolvedValue([sessionInfo]);
  });

  const attentionItem: TAttentionItem = {
    id: 'perm_child',
    kind: 'permission',
    sessionId: SESSION_ID,
    nodeId: SESSION_ID,
    title: 'bash',
    at: 1_000,
  };

  it('cablea las señales con la atención derivada del subárbol y su manejador', async () => {
    const client = createClient();
    seedStructureCache(client);
    setDevice(client, false);
    vi.mocked(useSessionAttention).mockReturnValue([attentionItem]);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );

    // `Array.prototype.at` no está en `lib` ES2020: se indexa por longitud.
    const calls = attentionNotifications.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall?.[0]).toEqual([attentionItem]);
    expect(typeof lastCall?.[1]).toBe('function');
  });

  it('deriva los nodos con atención y los pasa al grafo para su realce (T072, FR-009)', async () => {
    const client = createClient();
    seedStructureCache(client);
    setDevice(client, false);
    // Un ítem sin nodo en el subárbol (`nodeId: null`) no debe realzar nada.
    vi.mocked(useSessionAttention).mockReturnValue([
      attentionItem,
      { ...attentionItem, id: 'perm_outside', nodeId: null },
    ]);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );

    expect(screen.getByTestId('agent-graph')).toHaveAttribute(
      'data-attention',
      SESSION_ID,
    );
  });

  it('sin atención no realza ningún nodo del grafo (T072, FR-009)', async () => {
    const client = createClient();
    seedStructureCache(client);
    setDevice(client, false);
    vi.mocked(useSessionAttention).mockReturnValue([]);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );

    expect(screen.getByTestId('agent-graph')).toHaveAttribute(
      'data-attention',
      '',
    );
  });

  it('actuar sobre una señal enfoca la request origen y abre la pestaña Chat (FR-010, A7)', async () => {
    const client = createClient();
    seedStructureCache(client);
    setDevice(client, false);
    vi.mocked(useSessionAttention).mockReturnValue([attentionItem]);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );

    // El badge real (T075) añade su etiqueta al nombre accesible del trigger:
    // se localiza el tab Chat por prefijo, no por igualdad exacta.
    expect(screen.getByRole('tab', { name: /^Chat/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );

    const calls = attentionNotifications.mock.calls;
    const handler = calls[calls.length - 1]?.[1];
    act(() => handler?.(attentionItem));

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /^Chat/ })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
  });

  it('deriva la atención por raíz y la pasa al rail (T073, FR-009)', async () => {
    const client = createClient();
    seedStructureCache(client);
    setDevice(client, false);
    client.setQueryData(queryKeys.permissions.list(), [
      { id: 'perm_root', sessionID: SESSION_ID, action: 'bash', resources: [] },
    ]);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );

    // El rail recibe el conteo por sesión raíz, no solo el del subárbol abierto.
    expect(screen.getByTestId('session-list')).toHaveAttribute(
      'data-attention',
      JSON.stringify({ [SESSION_ID]: 1 }),
    );
  });

  it('monta el badge de atención en el tab móvil Chat (T075, FR-009)', async () => {
    const client = createClient();
    seedStructureCache(client);
    setDevice(client, true);
    vi.mocked(useSessionAttention).mockReturnValue([attentionItem]);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );

    expect(screen.getByTestId('chat-attention-badge')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '1 pendiente por atender' }),
    ).toBeInTheDocument();
  });
});

/**
 * Coordinación de `Escape` (T062, chat-panel-contract §5): el `Escape` del
 * composer (foco dentro del panel de chat) cancela solo su estado inline y **no**
 * se propaga al handler de la página; fuera del composer rige la prioridad
 * "cerrar fullscreen" > "limpiar selección".
 */
describe('WorkspacePage — Escape del composer (T062, chat-panel-contract §5)', () => {
  beforeEach(() => {
    service.listSessions.mockResolvedValue([sessionInfo]);
  });

  /** Renderiza escritorio y abre la pestaña Chat; devuelve el composer. */
  const renderDesktopChat = async (): Promise<HTMLTextAreaElement> => {
    const client = createClient();
    seedStructureCache(client);
    setDevice(client, false);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Chat' }), {
      button: 0,
    });

    return screen.findByRole('textbox', { name: 'Mensaje' });
  };

  it('con el foco en el composer no limpia la selección; fuera de él sí', async () => {
    const composer = await renderDesktopChat();

    // La selección explícita de un nodo habilita el listener de `Escape`.
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar nodo' }));

    expect(screen.getByTestId('agent-graph')).toHaveAttribute(
      'data-selected',
      SESSION_ID,
    );

    act(() => composer.focus());
    fireEvent.keyDown(window, { key: 'Escape' });

    // El `Escape` del composer no se propaga: la selección sigue intacta.
    expect(screen.getByTestId('agent-graph')).toHaveAttribute(
      'data-selected',
      SESSION_ID,
    );

    // Fuera del composer, `Escape` recupera la prioridad de la página.
    act(() => composer.blur());
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByTestId('agent-graph')).toHaveAttribute(
      'data-selected',
      '',
    );
  });

  it('con el foco en el composer no cierra el fullscreen; fuera de él sí', async () => {
    const client = createClient();
    seedStructureCache(client);
    setDevice(client, false);

    renderWorkspace(client);

    await waitFor(() =>
      expect(screen.getByTestId('agent-graph')).toBeInTheDocument(),
    );

    // El control de fullscreen vive en la pestaña Detalle: se activa antes de
    // abrir el chat (Radix desmonta el contenido inactivo).
    fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa' }));
    expect(screen.getByTestId('inspector-column')).toHaveAttribute(
      'data-fullscreen',
      'true',
    );

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Chat' }), {
      button: 0,
    });
    const composer = await screen.findByRole('textbox', { name: 'Mensaje' });

    act(() => composer.focus());
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByTestId('inspector-column')).toHaveAttribute(
      'data-fullscreen',
      'true',
    );

    act(() => composer.blur());
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.getByTestId('inspector-column')).not.toHaveAttribute(
        'data-fullscreen',
      ),
    );
  });
});
