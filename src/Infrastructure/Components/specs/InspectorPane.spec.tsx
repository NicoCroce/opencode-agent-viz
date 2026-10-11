import { describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  INSPECTOR_DEFAULT_WIDTH,
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
} from '@app/Application/Helpers/panelWidth';
import type { TGraphModel } from '@app/Domains/Graph';
import { InspectorPane, InspectorResizeHandle } from '../InspectorPane';

/**
 * P4/P6 (inspector-panel-contract §1, SC-007): el separador es el único control
 * de escritorio para ajustar el ancho. `WorkspacePage.spec.tsx` ya cubre su
 * integración (atajo de teclado y ancho de la columna); aquí se aísla la
 * superficie accesible y el feedback visual del arrastre, que no se verifica
 * en ningún otro spec.
 *
 * T025/P1 (chat-panel-contract §1/§6): la columna del detalle se envuelve en
 * Radix Tabs con `Detalle | Chat` (APG). Aquí se verifica el contrato de
 * accesibilidad (tablist/tab/tabpanel, `aria-controls`, flechas y roving
 * tabindex) y que el panel `Detalle` sigue siendo el actual mientras la pestaña
 * `Chat` queda como slot listo para `ChatPanel` (T026).
 *
 * Se sustituyen los barrels pesados que `InspectorPane` importa a nivel de
 * módulo para renderizar solo las piezas bajo prueba.
 */
vi.mock('@app/Domains/Inspector', () => ({ InspectorPanel: () => null }));
vi.mock('@app/Domains/Graph', () => ({}));
/**
 * `@app/Domains/Chat`: se conserva el `ChatAttentionBadge` real (T053) para
 * verificar su integración en el trigger de la pestaña `Chat`; el resto del
 * barrel pesado no se necesita en este spec.
 */
vi.mock('@app/Domains/Chat', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@app/Domains/Chat')>();
  return { ChatAttentionBadge: actual.ChatAttentionBadge };
});

const renderHandle = (
  overrides: Partial<Parameters<typeof InspectorResizeHandle>[0]> = {},
) => {
  const onResizeStart = vi.fn();
  const onResizeKey = vi.fn();
  const view = render(
    <InspectorResizeHandle
      width={INSPECTOR_DEFAULT_WIDTH}
      isResizing={false}
      onResizeStart={onResizeStart}
      onResizeKey={onResizeKey}
      {...overrides}
    />,
  );
  return { ...view, onResizeStart, onResizeKey };
};

const innerBar = (container: HTMLElement): HTMLElement => {
  const bar = container.querySelector('span[aria-hidden="true"]');
  if (!(bar instanceof HTMLElement)) {
    throw new Error('No se encontró la barra visible del separador');
  }
  return bar;
};

const emptyGraph = { nodes: [], edges: [] } as unknown as TGraphModel;

const renderPane = (
  overrides: Partial<Parameters<typeof InspectorPane>[0]> = {},
) => {
  const onToggleReasoning = vi.fn();
  const onOpenHistory = vi.fn();
  const view = render(
    <InspectorPane
      graph={emptyGraph}
      parallelGroups={[]}
      inspectedNodeId={null}
      showReasoning={false}
      onToggleReasoning={onToggleReasoning}
      onOpenHistory={onOpenHistory}
      {...overrides}
    />,
  );
  return { ...view, onToggleReasoning, onOpenHistory };
};

describe('InspectorResizeHandle — accesibilidad (P4, SC-007)', () => {
  it('exposes a vertical separator with the current width and its bounds', () => {
    renderHandle({ width: 500 });

    const separator = screen.getByRole('separator');
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    expect(separator).toHaveAttribute(
      'aria-label',
      'Ajustar el ancho del panel de detalle',
    );
    expect(separator).toHaveAttribute('aria-valuenow', '500');
    expect(separator).toHaveAttribute(
      'aria-valuemin',
      String(INSPECTOR_MIN_WIDTH),
    );
    expect(separator).toHaveAttribute(
      'aria-valuemax',
      String(INSPECTOR_MAX_WIDTH),
    );
    expect(separator).toHaveAttribute('tabindex', '0');
  });

  it('forwards pointer-down to the resize starter', () => {
    const { onResizeStart } = renderHandle();

    fireEvent.pointerDown(screen.getByRole('separator'));

    expect(onResizeStart).toHaveBeenCalledTimes(1);
  });

  it('forwards key-down to the keyboard resize handler', () => {
    const { onResizeKey } = renderHandle();

    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' });

    expect(onResizeKey).toHaveBeenCalledTimes(1);
  });
});

describe('InspectorResizeHandle — feedback del arrastre (P4)', () => {
  it('paints the bar with --status-running while resizing', () => {
    const { container } = renderHandle({ isResizing: true });

    expect(innerBar(container)).toHaveClass('bg-status-running');
  });

  it('keeps the bar neutral when not resizing', () => {
    const { container } = renderHandle({ isResizing: false });

    const bar = innerBar(container);
    expect(bar).toHaveClass('bg-surface-2');
    expect(bar).not.toHaveClass('bg-status-running');
  });
});

describe('InspectorPane — pestañas Detalle|Chat (T025, P1, FR-021)', () => {
  it('renders a tablist with the Detalle and Chat tabs', () => {
    renderPane();

    expect(screen.getByRole('tablist')).toHaveAttribute(
      'aria-label',
      'Vistas del panel de detalle',
    );
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Detalle',
      'Chat',
    ]);

    const [detail, chat] = screen.getAllByRole('tab');
    expect(detail).toHaveAttribute('aria-selected', 'true');
    expect(chat).toHaveAttribute('aria-selected', 'false');
  });

  it('exposes a single tab stop and roving tabindex (APG)', () => {
    renderPane();

    const [detail, chat] = screen.getAllByRole('tab');
    // Radix: el tablist es el punto de tabulación y los tabs rovan (-1) hasta
    // que entra el foco; el tab activo pasa a ser el tab stop.
    expect(screen.getByRole('tablist')).toHaveAttribute('tabindex', '0');
    expect(detail).toHaveAttribute('tabindex', '-1');
    expect(chat).toHaveAttribute('tabindex', '-1');

    fireEvent.focus(detail);
    expect(detail).toHaveAttribute('tabindex', '0');
    expect(chat).toHaveAttribute('tabindex', '-1');
  });

  it('links each tab to its tabpanel via aria-controls/aria-labelledby', () => {
    renderPane();

    const detail = screen.getByRole('tab', { name: 'Detalle' });
    const panelId = detail.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();

    const panel = document.getElementById(panelId ?? '');
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute('role', 'tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', detail.id);
  });

  it('moves the selection with the arrow keys (APG)', async () => {
    renderPane();

    const detail = screen.getByRole('tab', { name: 'Detalle' });
    detail.focus();
    fireEvent.keyDown(detail, { key: 'ArrowRight' });

    // Radix mueve el foco en un `setTimeout`, y el foco activa el tab.
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
    expect(detail).toHaveAttribute('aria-selected', 'false');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Chat' }), {
      key: 'ArrowLeft',
    });
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Detalle' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    );
  });

  it('keeps Detalle as the current panel and mounts the chat slot on demand', () => {
    renderPane({ chat: <div data-testid="chat-content" /> });

    // El panel Chat existe como `tabpanel` oculto; su contenido es perezoso.
    expect(screen.getByTestId('detail-chat-slot')).toHaveAttribute('hidden');
    expect(screen.queryByTestId('chat-content')).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Chat' }), {
      button: 0,
    });

    const slot = screen.getByTestId('detail-chat-slot');
    expect(slot).toHaveAttribute('role', 'tabpanel');
    expect(slot).not.toHaveAttribute('hidden');
    expect(screen.getByTestId('chat-content')).toBeInTheDocument();
  });

  it('omits the internal tablist on mobile (showDetailTabs=false)', () => {
    renderPane({ showDetailTabs: false });

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});

describe('InspectorPane — badge de atención en la pestaña Chat (T053, FR-009)', () => {
  it('no muestra badge sin pendientes (FR-011)', () => {
    renderPane();

    const chatTab = screen.getByRole('tab', { name: 'Chat' });
    expect(within(chatTab).queryByRole('img')).not.toBeInTheDocument();
  });

  it('monta el badge textual con el nº de pendientes en la pestaña Chat', () => {
    renderPane({ attentionCount: 2 });

    const chatTab = screen.getByRole('tab', { name: /Chat/ });
    const badge = within(chatTab).getByRole('img', {
      name: '2 pendientes por atender',
    });

    // Marca **no-color** (icono) + token de contraste ≥3:1.
    expect(badge.querySelector('svg')).not.toBeNull();
    expect(badge).toHaveClass('bg-status-waiting', 'text-surface-0');
  });

  it('no añade badge a la pestaña Detalle', () => {
    renderPane({ attentionCount: 3 });

    const detailTab = screen.getByRole('tab', { name: 'Detalle' });
    expect(within(detailTab).queryByRole('img')).not.toBeInTheDocument();
  });

  it('permite controlar el tab activo desde el llamador (T055)', () => {
    const onTabChange = vi.fn();
    renderPane({ activeTab: 'chat', onTabChange });

    const chat = screen.getByRole('tab', { name: 'Chat' });
    expect(chat).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('detail-chat-slot')).not.toHaveAttribute('hidden');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Detalle' }), {
      button: 0,
    });
    expect(onTabChange).toHaveBeenCalledWith('detail');
  });
});
