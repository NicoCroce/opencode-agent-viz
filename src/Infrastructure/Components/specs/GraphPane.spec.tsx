import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import type { QueryClient } from '@tanstack/react-query';
import type {
  TExecutionPlan,
  TGraphNode,
  UseGraphModelResult,
} from '@app/Domains/Graph';
import { queryKeys } from '@app/Domains/queryKeys';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { GraphPane, type TFollowMode } from '../GraphPane';

/**
 * T025/T028 [US3/US4] (FR-004/FR-005/FR-006, Principio VI; contrato
 * `subtree-structure-contract.md` §4/§5): `GraphPane` concentra el orden de
 * estados obligatorio **error → loading acotada → no encontrada → vacío →
 * datos** y monta el aviso de truncamiento entre la cabecera y el lienzo.
 *
 * La producción de `notFound`/`truncated` en `UseGraphModelResult` (T026/T029) y
 * su render en `GraphPane` (T027/T030) llegan en olas posteriores: estos casos
 * quedan **RED por diseño** hasta entonces y fijan el contrato que deben cumplir.
 *
 * Se sustituyen los barrels pesados de presentación (`AgentGraph`/React Flow,
 * `GraphSkeleton`, `SessionSummaryBar`) para observar **solo** la decisión de
 * estado del panel; los `EmptyState`/`EmptyScreenError` reales se conservan
 * porque sus títulos son el contrato que distingue "no encontrada" de "sin
 * agentes".
 */
vi.mock('@app/Domains/Graph', () => ({
  AgentGraph: () => <div data-testid="agent-graph" />,
  GraphSkeleton: () => <div data-testid="graph-skeleton" />,
  SessionSummaryBar: () => null,
}));

/**
 * Forma del resultado que consume el panel: el `notFound`/`truncated` aditivos
 * (T026/T029) se declaran opcionales para que el spec compile **antes** de que
 * existan en el tipo público, sin inventar campos en la API real.
 */
type PaneGraphResult = UseGraphModelResult & {
  notFound?: boolean;
  truncated?: boolean;
};

const EMPTY_PLAN: TExecutionPlan = {
  levels: [],
  levelByNode: {},
  columnByNode: {},
  width: 0,
};

const DIRECTORY = '/repo';
const OTHER_DIRECTORY = '/otro';

/**
 * Nodo mínimo del contrato de datos: el panel lee de él el `directory` de la
 * sesión abierta (`data.sessionId === rootId`) para acotar el aviso de
 * truncamiento a su proyecto (review 1, amarillo 4).
 */
const makeNode = (sessionId: string, directory: string): TGraphNode =>
  ({
    id: sessionId,
    type: 'agent',
    position: { x: 0, y: 0 },
    data: { sessionId, directory },
  }) as unknown as TGraphNode;

const ROOT_NODE = makeNode('root-1', DIRECTORY);

const makeGraph = (overrides: Partial<PaneGraphResult> = {}): PaneGraphResult => ({
  graph: { nodes: [], edges: [] },
  parallelGroups: [],
  executionPlan: EMPTY_PLAN,
  activeNodeId: null,
  latestActiveNodeId: null,
  isLoading: false,
  isError: false,
  error: null,
  notFound: false,
  truncated: false,
  ...overrides,
});

/** Modo "seguir" por defecto del panel, con `toggle` espiado. */
const makeFollow = (): TFollowMode => ({
  enabled: false,
  toggle: vi.fn(),
  followNodeId: null,
});

/**
 * Elemento del panel reutilizable: los casos de persistencia necesitan
 * `rerender` con el **mismo** árbol que el render inicial.
 */
const paneElement = (
  overrides: Partial<PaneGraphResult> = {},
  follow: TFollowMode = makeFollow(),
) => (
  <GraphPane
    graph={makeGraph(overrides)}
    summary={null}
    follow={follow}
    selectedNodeId={null}
    onSelectNode={vi.fn()}
    onClearSelection={vi.fn()}
    onOpenHistory={vi.fn()}
    rootId="root-1"
  />
);

const renderPane = (overrides: Partial<PaneGraphResult> = {}) => {
  const follow = makeFollow();
  const view = renderWithProviders(paneElement(overrides, follow));
  return { ...view, follow };
};

/**
 * Renderiza el panel con la caché de raíces ya sembrada: el aviso de
 * truncamiento se lee de `sessions.roots(directory)` al renderizar (sin
 * suscripción propia del panel), así que se siembra y se re-renderiza el mismo
 * árbol para que la lectura vea el dato.
 */
const renderPaneSeeded = (
  seedRoots: (client: QueryClient) => void,
  overrides: Partial<PaneGraphResult> = {},
) => {
  const follow = makeFollow();
  const view = renderWithProviders(paneElement(overrides, follow));
  seedRoots(view.queryClient);
  view.rerender(paneElement(overrides, follow));
  return { ...view, follow };
};

/** Rutas mínimas para observar la salida del estado "no encontrada" (FR-005). */
const renderPaneOnRoute = (overrides: Partial<PaneGraphResult> = {}) =>
  renderWithProviders(
    <Routes>
      <Route
        path="/sessions/:id"
        element={
          <GraphPane
            graph={makeGraph(overrides)}
            summary={null}
            follow={{ enabled: false, toggle: vi.fn(), followNodeId: null }}
            selectedNodeId={null}
            onSelectNode={vi.fn()}
            onClearSelection={vi.fn()}
            onOpenHistory={vi.fn()}
            rootId="root-1"
          />
        }
      />
      <Route path="/sessions" element={<div data-testid="sessions-list" />} />
    </Routes>,
    { initialEntries: ['/sessions/child-1'] },
  );

describe('GraphPane — orden de estados (T025, US3, FR-004/FR-005, Principio VI)', () => {
  it('da prioridad al error sobre loading, no encontrada y datos', () => {
    renderPane({
      isError: true,
      error: new Error('falló la estructura'),
      isLoading: true,
      notFound: true,
      graph: { nodes: [ROOT_NODE], edges: [] },
    });

    expect(
      screen.getByRole('heading', { name: 'Error' }),
    ).toBeInTheDocument();
    expect(screen.getByText('falló la estructura')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-graph')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /no encontrada/i }),
    ).not.toBeInTheDocument();
  });

  it('mantiene el skeleton acotado por delante de "no encontrada" y del vacío', () => {
    renderPane({ isLoading: true, notFound: true });

    expect(screen.getByTestId('graph-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('agent-graph')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /no encontrada/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Sin agentes' }),
    ).not.toBeInTheDocument();
  });

  it('muestra "no encontrada" (distinta de "sin agentes") con salida al listado', () => {
    renderPaneOnRoute({ notFound: true });

    expect(
      screen.getByRole('heading', { name: /no encontrada/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Sin agentes' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-graph')).not.toBeInTheDocument();
    // Regresión del esqueleto terminal (FR-005/SC-002): una sesión inexistente
    // se resuelve en "no encontrada" —con salida— y nunca deja el esqueleto sin
    // salida.
    expect(screen.queryByTestId('graph-skeleton')).not.toBeInTheDocument();

    // La acción lleva al listado de sesiones (`/sessions`); no es un callejón.
    fireEvent.click(
      screen.getByRole('button', { name: /listado|sesiones/i }),
    );
    expect(screen.getByTestId('sessions-list')).toBeInTheDocument();
  });

  it('un fallo real de datos mantiene el error y no se colapsa con "no encontrada"', () => {
    renderPane({
      isError: true,
      error: new Error('fallo de red'),
      notFound: true,
    });

    expect(
      screen.getByRole('heading', { name: 'Error' }),
    ).toBeInTheDocument();
    expect(screen.getByText('fallo de red')).toBeInTheDocument();
    // El 404 (no encontrada) y el fallo real son estados distintos: el error no
    // ofrece la salida al listado que sí tiene "no encontrada".
    expect(
      screen.queryByRole('heading', { name: /no encontrada/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /listado|sesiones/i }),
    ).not.toBeInTheDocument();
  });

  it('muestra "sin agentes" cuando la estructura se resolvió sin nodos', () => {
    renderPane({ notFound: false });

    expect(
      screen.getByRole('heading', { name: 'Sin agentes' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /no encontrada/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-graph')).not.toBeInTheDocument();
  });

  it('muestra el grafo cuando hay nodos y ningún estado previo gana', () => {
    renderPane({ graph: { nodes: [ROOT_NODE], edges: [] } });

    expect(screen.getByTestId('agent-graph')).toBeInTheDocument();
    expect(screen.queryByTestId('graph-skeleton')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Sin agentes' }),
    ).not.toBeInTheDocument();
  });
});

describe('GraphPane — aviso de truncamiento (T028, US4, FR-006, SC-009)', () => {
  it('muestra el aviso entre cabecera y lienzo cuando el subárbol se truncó', () => {
    renderPane({
      truncated: true,
      graph: { nodes: [ROOT_NODE], edges: [] },
    });

    const banner = screen.getByTestId('graph-truncation-banner');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveAttribute('aria-live', 'polite');

    // Informativo puro: sin acción ni cifras del tipo "N de M".
    expect(banner.querySelector('button')).toBeNull();
    expect(banner.textContent).not.toMatch(/\d+\s*de\s*\d+/i);
  });

  it('no bloquea el lienzo: el grafo sigue montado con el aviso visible', () => {
    renderPane({
      truncated: true,
      graph: { nodes: [ROOT_NODE], edges: [] },
    });

    expect(screen.getByTestId('graph-truncation-banner')).toBeInTheDocument();
    expect(screen.getByTestId('agent-graph')).toBeInTheDocument();
  });

  it('no muestra el aviso cuando el subárbol está completo', () => {
    renderPane({ truncated: false, graph: { nodes: [ROOT_NODE], edges: [] } });

    expect(
      screen.queryByTestId('graph-truncation-banner'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('agent-graph')).toBeInTheDocument();
  });

  it('monta el aviso entre la cabecera y el lienzo, sin ocupar role="alert"', () => {
    renderPane({
      truncated: true,
      graph: { nodes: [ROOT_NODE], edges: [] },
    });

    const banner = screen.getByTestId('graph-truncation-banner');
    const followButton = screen.getByRole('button', { name: 'Seguir' });
    const canvas = screen.getByTestId('agent-graph');

    // Cabecera → aviso → lienzo (contract §5): el orden importa, no solo que esté.
    expect(
      followButton.compareDocumentPosition(banner) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      banner.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // El slot de alerta viva lo ocupa el banner de atención del chat.
    expect(banner).not.toHaveAttribute('role', 'alert');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('persiste sin duplicarse mientras el truncamiento sigue activo', () => {
    const props: Partial<PaneGraphResult> = {
      truncated: true,
      graph: { nodes: [ROOT_NODE], edges: [] },
    };
    const { rerender } = renderPane(props);

    expect(screen.getAllByTestId('graph-truncation-banner')).toHaveLength(1);

    rerender(paneElement(props));

    expect(screen.getAllByTestId('graph-truncation-banner')).toHaveLength(1);
    expect(screen.getByTestId('agent-graph')).toBeInTheDocument();
  });
});

/**
 * Acotación del aviso al **directorio abierto** (review 1, amarillo 4): el
 * listado de raíces truncado de **otro** proyecto no debe marcar "vista parcial"
 * al abrir uno completo. El corte del listado se lee de la caché por el
 * directorio de la sesión que se está viendo (`sessions.roots(directory)`), sin
 * abrir ninguna consulta nueva.
 */
describe('GraphPane — aviso acotado al directorio abierto (review 1, amarillo 4)', () => {
  const seedRoots =
    (directory: string, truncated: boolean) => (client: QueryClient) =>
      client.setQueryData(queryKeys.sessions.roots(directory), {
        sessions: [],
        truncated,
      });

  it('muestra el aviso cuando el listado de raíces del directorio abierto se cortó', () => {
    renderPaneSeeded(seedRoots(DIRECTORY, true), {
      truncated: false,
      graph: { nodes: [ROOT_NODE], edges: [] },
    });

    expect(screen.getByTestId('graph-truncation-banner')).toBeInTheDocument();
    expect(screen.getByTestId('agent-graph')).toBeInTheDocument();
  });

  it('no muestra el aviso por el corte de otro proyecto (sin falso "vista parcial")', () => {
    renderPaneSeeded(
      (client) => {
        seedRoots(DIRECTORY, false)(client);
        seedRoots(OTHER_DIRECTORY, true)(client);
      },
      { truncated: false, graph: { nodes: [ROOT_NODE], edges: [] } },
    );

    expect(
      screen.queryByTestId('graph-truncation-banner'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('agent-graph')).toBeInTheDocument();
  });

  it('no muestra el aviso si no se puede determinar el directorio', () => {
    renderPaneSeeded(seedRoots(DIRECTORY, true), {
      truncated: false,
      graph: { nodes: [], edges: [] },
    });

    expect(
      screen.queryByTestId('graph-truncation-banner'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Sin agentes')).toBeInTheDocument();
  });
});

