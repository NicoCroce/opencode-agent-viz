import { useContext } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { INSPECTOR_DEFAULT_WIDTH } from '@app/Application/Helpers/panelWidth';
import { renderWithProviders } from '@app/test/renderWithProviders';
import type { TUseInspectorPanelResult } from '../../Hooks/useInspectorPanel';
import { WorkspaceView } from '../WorkspaceView';
import { WorkspaceChatAttentionContext } from '../WorkspaceMobileTabs';

/**
 * T015 (FR-005/FR-008/FR-013/FR-014): `WorkspaceView` es el componente
 * **presentacional puro** que sustituye la composición inline de
 * `WorkspacePage`: recibe los cinco slots ya construidos (`sessions`, `graph`,
 * `inspector`, `chat`, `history`) más el estado de vista (`panel`,
 * `attentionCount`, `isMobile`, `tab`, `onChangeTab`) y los cablea con
 * **exactamente** las mismas props que antes montaba la página.
 *
 * La presentación (móvil/escritorio) la resuelve `WorkspaceLayout`, ya cubierto
 * en su propio spec: aquí se verifica el **cableado** — que los cinco slots
 * llegan a su destino, que el `Provider` publica `attentionCount` y que los
 * slots nulos (sin sesión) no rompen — así que los slots se pasan como nodos
 * marcadores y los barrels pesados que `InspectorPane` importa a nivel de módulo
 * se sustituyen por dobles (mismo patrón que `WorkspaceLayout.spec.tsx`).
 */
vi.mock('@app/Domains/Inspector', () => ({ InspectorPanel: () => null }));
vi.mock('@app/Domains/Graph', () => ({}));
vi.mock('@app/Domains/Chat', () => ({
  // Consumidor real del contexto (tab móvil `chat`): se dobla para leer el valor
  // que publica `WorkspaceChatAttentionContext`, respetando su contrato (con
  // `count <= 0` no renderiza nada, así que no altera el nombre accesible).
  ChatAttentionBadge: ({ count }: { count: number }) =>
    count > 0 ? <span data-testid="chat-attention-badge">{count}</span> : null,
}));

/**
 * Estado de vista del panel de detalle con dobles de sus handlers: la lógica
 * real vive en `useInspectorPanel` (cubierta en su propio spec) y aquí solo
 * importa qué se reenvía al layout.
 */
const panelFixture = (
  overrides: Partial<TUseInspectorPanelResult> = {},
): TUseInspectorPanelResult => ({
  width: INSPECTOR_DEFAULT_WIDTH,
  isResizing: false,
  isFullscreen: false,
  startResize: vi.fn(),
  onResizeKey: vi.fn(),
  toggleFullscreen: vi.fn(),
  closeFullscreen: vi.fn(),
  ...overrides,
});

const renderView = (
  overrides: Partial<Parameters<typeof WorkspaceView>[0]> = {},
) => {
  const onChangeTab = vi.fn();

  const view = renderWithProviders(
    <WorkspaceView
      sessions={<div data-testid="sessions-node" />}
      graph={<div data-testid="graph-node" />}
      inspector={<div data-testid="inspector-node" />}
      chat={<div data-testid="chat-node" />}
      history={<div data-testid="history-node" />}
      panel={panelFixture()}
      attentionCount={0}
      isMobile={false}
      tab="graph"
      onChangeTab={onChangeTab}
      {...overrides}
    />,
  );

  return { ...view, onChangeTab };
};

/** Sonda del contexto de atención: lee el valor que publica el Provider. */
const AttentionProbe = () => {
  const count = useContext(WorkspaceChatAttentionContext);
  return <span data-testid="attention-probe">{count}</span>;
};

describe('WorkspaceView — escritorio (FR-005/FR-008)', () => {
  it('compone los slots de escritorio, el histórico y el separador; sin tablist móvil', () => {
    renderView();

    expect(screen.getByTestId('sessions-node')).toBeInTheDocument();
    expect(screen.getByTestId('graph-node')).toBeInTheDocument();
    expect(screen.getByTestId('inspector-node')).toBeInTheDocument();
    expect(screen.getByTestId('history-node')).toBeInTheDocument();

    // Controles exclusivos de escritorio; el tablist de primer nivel es de móvil.
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(screen.getByTestId('inspector-column')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('no monta el slot de chat por separado: en escritorio lo hospeda el inspector (FR-008)', () => {
    renderView();

    // El mismo nodo `ChatPanel` viaja como `chat` a la página y como pestaña
    // interna del inspector; la vista no lo duplica (FR-014).
    expect(screen.queryByTestId('chat-node')).not.toBeInTheDocument();
  });

  it('reenvía el ancho del panel a la columna del inspector', () => {
    renderView({ panel: panelFixture({ width: 480 }) });

    expect(screen.getByTestId('inspector-column')).toHaveStyle({
      width: '480px',
    });
  });

  it('reenvía el fullscreen al layout (overlay sin separador)', () => {
    renderView({ panel: panelFixture({ isFullscreen: true }) });

    expect(screen.getByTestId('inspector-column')).toHaveAttribute(
      'data-fullscreen',
      'true',
    );
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('publica `attentionCount` en `WorkspaceChatAttentionContext` (FR-009)', () => {
    renderView({ attentionCount: 3, sessions: <AttentionProbe /> });

    expect(screen.getByTestId('attention-probe')).toHaveTextContent('3');
  });
});

describe('WorkspaceView — móvil (FR-013/FR-014)', () => {
  it('monta el tablist de primer nivel, el histórico y propaga `onChangeTab`', () => {
    const { onChangeTab } = renderView({ isMobile: true, tab: 'graph' });

    expect(
      screen.getByRole('tablist', { name: 'Vistas del workspace' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('history-node')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'inspector' }));
    expect(onChangeTab).toHaveBeenCalledWith('inspector');

    // Sin controles de escritorio.
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inspector-column')).not.toBeInTheDocument();
  });

  it('monta solo el panel activo, con el chat como destino de primer nivel', () => {
    renderView({ isMobile: true, tab: 'chat' });

    expect(screen.getByTestId('chat-node')).toBeInTheDocument();
    expect(screen.getByTestId('history-node')).toBeInTheDocument();

    // Los paneles inactivos no montan su slot (carga perezosa).
    expect(screen.queryByTestId('sessions-node')).not.toBeInTheDocument();
    expect(screen.queryByTestId('graph-node')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inspector-node')).not.toBeInTheDocument();
  });

  it('el badge del tab chat recibe el `attentionCount` del Provider', () => {
    renderView({ isMobile: true, tab: 'chat', attentionCount: 2 });

    expect(screen.getByTestId('chat-attention-badge')).toHaveTextContent('2');
  });
});

describe('WorkspaceView — slots nulos sin sesión (FR-013)', () => {
  it('no rompe con `chat` nulo en escritorio ni en móvil', () => {
    const desktop = renderView({ chat: null });
    expect(screen.getByTestId('inspector-node')).toBeInTheDocument();
    desktop.unmount();

    renderView({ isMobile: true, tab: 'chat', chat: null });

    expect(
      screen.getByRole('tablist', { name: 'Vistas del workspace' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: 'chat' })).toBeInTheDocument();
  });

  it('acepta los cinco slots nulos sin romper', () => {
    renderView({
      sessions: null,
      graph: null,
      inspector: null,
      chat: null,
      history: null,
    });

    expect(screen.getByTestId('inspector-column')).toBeInTheDocument();
    expect(screen.queryByTestId('sessions-node')).not.toBeInTheDocument();
  });
});
