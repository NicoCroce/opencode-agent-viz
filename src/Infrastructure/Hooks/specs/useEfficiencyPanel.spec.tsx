import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useEfficiencyPanel,
  type TUseEfficiencyPanelParams,
} from '../useEfficiencyPanel';

/**
 * Estado de vista del overlay de eficiencia (research R1, overlay §2–§3):
 * apertura/cierre, reloj inyectado, retorno de foco al disparador —también si
 * ya se desmontó— y reset durante el render al cambiar la sesión raíz.
 */

const ROOT = 'root';
const OTHER = 'other';

const panelParams = (
  overrides: Partial<TUseEfficiencyPanelParams> = {},
): TUseEfficiencyPanelParams => ({ rootSessionId: ROOT, ...overrides });

const renderPanel = (overrides: Partial<TUseEfficiencyPanelParams> = {}) =>
  renderHook((props: TUseEfficiencyPanelParams) => useEfficiencyPanel(props), {
    initialProps: panelParams(overrides),
  });

/** Monta un botón en el documento para que `focus()` y `document.contains` funcionen. */
const mountTrigger = (label: string): HTMLButtonElement => {
  const trigger = document.createElement('button');
  trigger.textContent = label;
  document.body.appendChild(trigger);
  return trigger;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useEfficiencyPanel — estado de vista (FR-005/FR-006)', () => {
  it('abre y cierra el panel', () => {
    const { result } = renderPanel();
    const trigger = mountTrigger('Abrir');

    expect(result.current.isOpen).toBe(false);
    expect(result.current.openedAt).toBeNull();

    act(() => {
      result.current.open(trigger);
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('fija openedAt con el reloj inyectado al abrir', () => {
    const clock = vi.fn(() => 1_700_000_123_456);
    const { result } = renderPanel({ clock });
    const trigger = mountTrigger('Abrir');

    act(() => {
      result.current.open(trigger);
    });

    expect(clock).toHaveBeenCalledTimes(1);
    expect(result.current.openedAt).toBe(1_700_000_123_456);
  });

  it('restoreFocus devuelve el foco al disparador', () => {
    const { result } = renderPanel();
    const trigger = mountTrigger('Abrir');
    const elsewhere = mountTrigger('Otro');

    act(() => {
      result.current.open(trigger);
    });
    elsewhere.focus();
    expect(document.activeElement).toBe(elsewhere);

    act(() => {
      result.current.restoreFocus();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it('un disparador desmontado no lanza ni enfoca otro elemento', () => {
    const { result } = renderPanel();
    const trigger = mountTrigger('Abrir');
    const elsewhere = mountTrigger('Otro');

    act(() => {
      result.current.open(trigger);
    });
    trigger.remove();
    elsewhere.focus();

    expect(() => {
      act(() => {
        result.current.restoreFocus();
      });
    }).not.toThrow();
    expect(document.activeElement).toBe(elsewhere);
  });

  it('cambiar la sesión raíz cierra el panel y limpia el disparador', () => {
    const { result, rerender } = renderPanel();
    const trigger = mountTrigger('Abrir');
    const elsewhere = mountTrigger('Otro');

    act(() => {
      result.current.open(trigger);
    });
    elsewhere.focus();

    rerender(panelParams({ rootSessionId: OTHER }));

    expect(result.current.isOpen).toBe(false);
    expect(result.current.openedAt).toBeNull();

    act(() => {
      result.current.restoreFocus();
    });
    expect(document.activeElement).toBe(elsewhere);
  });

  it('open guarda el disparador actual, no el primero', () => {
    const { result } = renderPanel();
    const first = mountTrigger('Primero');
    const second = mountTrigger('Segundo');

    first.focus();
    act(() => {
      result.current.open(first);
    });
    act(() => {
      result.current.open(second);
    });

    act(() => {
      result.current.restoreFocus();
    });
    expect(document.activeElement).toBe(second);
  });
});
