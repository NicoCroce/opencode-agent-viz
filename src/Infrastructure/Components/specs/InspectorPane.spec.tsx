import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  INSPECTOR_DEFAULT_WIDTH,
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
} from '@app/Application/Helpers/panelWidth';
import { InspectorResizeHandle } from '../InspectorPane';

/**
 * P4/P6 (inspector-panel-contract §1, SC-007): el separador es el único control
 * de escritorio para ajustar el ancho. `WorkspacePage.spec.tsx` ya cubre su
 * integración (atajo de teclado y ancho de la columna); aquí se aísla la
 * superficie accesible y el feedback visual del arrastre, que no se verifica
 * en ningún otro spec.
 *
 * Se sustituyen los barrels pesados que `InspectorPane` importa a nivel de
 * módulo para renderizar solo el separador.
 */
vi.mock('@app/Domains/Inspector', () => ({ InspectorPanel: () => null }));
vi.mock('@app/Domains/Graph', () => ({}));

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
