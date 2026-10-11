import { useState } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { INSPECTOR_DEFAULT_WIDTH } from '@app/Application/Helpers/panelWidth';
import type { TWorkspaceTab } from '../../WorkspacePage.constants';
import { WorkspaceLayout } from '../WorkspaceLayout';

/**
 * T060/FR-013/FR-014 (chat-panel-contract §2, P4): `WorkspaceLayout` elige la
 * presentación del workspace. En escritorio monta las tres columnas (rail,
 * grafo, inspector con su tablist interno `Detalle | Chat` dentro del nodo
 * `inspector`); en móvil monta `WorkspaceMobileTabs` con el chat como destino de
 * **primer nivel** y **sin** tabbars anidadas. Ambas presentaciones reciben el
 * **mismo** nodo de chat (una sola fuente de lógica, `useChatController`).
 *
 * Se sustituyen los barrels pesados que `InspectorPane` (origen de
 * `InspectorResizeHandle`) importa a nivel de módulo; los nodos de sesiones,
 * grafo, inspector y chat se pasan como marcadores identificables.
 */
vi.mock('@app/Domains/Inspector', () => ({ InspectorPanel: () => null }));
vi.mock('@app/Domains/Graph', () => ({}));
vi.mock('@app/Domains/Chat', () => ({ ChatAttentionBadge: () => null }));

const renderDesktop = (
  overrides: Partial<Parameters<typeof WorkspaceLayout>[0]> = {},
) => {
  const onChangeTab = vi.fn();
  const onResizeStart = vi.fn();
  const onResizeKey = vi.fn();

  const view = render(
    <WorkspaceLayout
      isMobile={false}
      tab="graph"
      onChangeTab={onChangeTab}
      sessions={<div data-testid="sessions-node" />}
      graph={<div data-testid="graph-node" />}
      inspector={<div data-testid="inspector-node" />}
      chat={<div data-testid="chat-node" />}
      history={<div data-testid="history-node" />}
      inspectorWidth={INSPECTOR_DEFAULT_WIDTH}
      isResizing={false}
      onResizeStart={onResizeStart}
      onResizeKey={onResizeKey}
      isFullscreen={false}
      {...overrides}
    />,
  );

  return { ...view, onChangeTab, onResizeStart, onResizeKey };
};

const MobileHarness = ({ chat }: { chat?: ReactNode }) => {
  const [tab, setTab] = useState<TWorkspaceTab>('graph');

  return (
    <WorkspaceLayout
      isMobile
      tab={tab}
      onChangeTab={setTab}
      sessions={<div data-testid="sessions-node" />}
      graph={<div data-testid="graph-node" />}
      inspector={<div data-testid="inspector-node" />}
      chat={chat ?? <div data-testid="chat-node" />}
      history={<div data-testid="history-node" />}
      inspectorWidth={INSPECTOR_DEFAULT_WIDTH}
      isResizing={false}
      onResizeStart={vi.fn()}
      onResizeKey={vi.fn()}
      isFullscreen={false}
    />
  );
};

describe('WorkspaceLayout — escritorio (FR-008/FR-014)', () => {
  it('monta las columnas, el separador y el histórico; sin tablist móvil', () => {
    renderDesktop();

    expect(screen.getByTestId('sessions-node')).toBeInTheDocument();
    expect(screen.getByTestId('graph-node')).toBeInTheDocument();
    expect(screen.getByTestId('inspector-node')).toBeInTheDocument();
    expect(screen.getByTestId('history-node')).toBeInTheDocument();

    expect(screen.getByRole('separator')).toBeInTheDocument();
    // El tablist de primer nivel es exclusivo de la presentación móvil.
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('aplica el ancho del panel a la columna del inspector', () => {
    renderDesktop({ inspectorWidth: 480 });

    expect(screen.getByTestId('inspector-column')).toHaveStyle({
      width: '480px',
    });
  });

  it('reenvía los handlers del separador', () => {
    const { onResizeStart, onResizeKey } = renderDesktop();

    fireEvent.pointerDown(screen.getByRole('separator'));
    expect(onResizeStart).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' });
    expect(onResizeKey).toHaveBeenCalledTimes(1);
  });

  it('en fullscreen convierte la columna en overlay y no monta el separador', () => {
    renderDesktop({ isFullscreen: true });

    const column = screen.getByTestId('inspector-column');
    expect(column).toHaveAttribute('data-fullscreen', 'true');
    expect(column).toHaveClass('bg-surface-0');
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });
});

describe('WorkspaceLayout — móvil, chat de primer nivel (T060, FR-013/FR-014, P4)', () => {
  it('monta el tablist de primer nivel con las cuatro vistas y el histórico', () => {
    render(<MobileHarness />);

    expect(
      screen.getByRole('tablist', { name: 'Vistas del workspace' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'sessions',
      'graph',
      'inspector',
      'chat',
    ]);
    expect(screen.getByTestId('history-node')).toBeInTheDocument();

    // No se montan los controles de escritorio.
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inspector-column')).not.toBeInTheDocument();
  });

  it('no añade el tablist interno Detalle|Chat (sin tabbars anidadas)', () => {
    render(<MobileHarness />);

    fireEvent.click(screen.getByRole('tab', { name: 'inspector' }));
    expect(screen.getByTestId('inspector-node')).toBeInTheDocument();

    // Un único tablist (el del workspace): el layout no anida `Detalle | Chat`.
    expect(screen.getAllByRole('tablist')).toHaveLength(1);
    expect(
      screen.queryByRole('tablist', { name: 'Vistas del panel de detalle' }),
    ).not.toBeInTheDocument();
  });

  it('renderiza el mismo nodo de chat como panel propio al activar su tab', () => {
    render(<MobileHarness chat={<div data-testid="chat-node" />} />);

    // Antes de activar el tab el chat no está montado.
    expect(screen.queryByTestId('chat-node')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'chat' }));

    expect(screen.getByTestId('chat-node')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'chat' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getAllByRole('tablist')).toHaveLength(1);
  });
});
