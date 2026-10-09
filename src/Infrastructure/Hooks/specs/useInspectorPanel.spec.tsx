import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import {
  INSPECTOR_DEFAULT_WIDTH,
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
  INSPECTOR_STEP,
} from '@app/Application/Helpers/panelWidth';
import {
  INSPECTOR_PANEL_WIDTH_KEY,
  useInspectorPanel,
} from '../useInspectorPanel';

/**
 * El inspector vive en la columna derecha del workspace, así que su separador
 * está en su borde izquierdo: mover el puntero hacia la izquierda **ensancha**
 * el panel (y `ArrowLeft` lo ensancha por teclado). El ancho se acota por
 * `clampPanelWidth` y se persiste en `localStorage`; el fullscreen es efímero.
 */

const START_X = 400;

const pointerEvent = (clientX: number) => {
  const preventDefault = vi.fn();
  const event = {
    clientX,
    pointerId: 1,
    currentTarget: null,
    preventDefault,
  } as unknown as ReactPointerEvent;
  return { event, preventDefault };
};

const keyEvent = (key: string) => {
  const preventDefault = vi.fn();
  const event = { key, preventDefault } as unknown as ReactKeyboardEvent;
  return { event, preventDefault };
};

const dispatchPointerMove = (clientX: number) => {
  act(() => {
    window.dispatchEvent(new MouseEvent('pointermove', { clientX }));
  });
};

const dispatchPointerUp = () => {
  act(() => {
    window.dispatchEvent(new MouseEvent('pointerup'));
  });
};

const storageKeys = () =>
  Array.from(
    { length: window.localStorage.length },
    (_, index) => window.localStorage.key(index) ?? '',
  );

describe('useInspectorPanel — ancho por puntero (P2)', () => {
  it('arranca en el ancho por defecto y sin arrastre', () => {
    const { result } = renderHook(() => useInspectorPanel());

    expect(result.current.width).toBe(INSPECTOR_DEFAULT_WIDTH);
    expect(result.current.isResizing).toBe(false);
  });

  it('sigue al puntero: mover el separador a la izquierda ensancha el panel', () => {
    const { result } = renderHook(() => useInspectorPanel());

    act(() => result.current.startResize(pointerEvent(START_X).event));
    expect(result.current.isResizing).toBe(true);

    dispatchPointerMove(START_X - 60);

    expect(result.current.width).toBe(INSPECTOR_DEFAULT_WIDTH + 60);
  });

  it('acota al máximo aunque el puntero siga hacia la izquierda', () => {
    const { result } = renderHook(() => useInspectorPanel());

    act(() => result.current.startResize(pointerEvent(START_X).event));
    dispatchPointerMove(-1000);

    expect(result.current.width).toBe(INSPECTOR_MAX_WIDTH);
  });

  it('acota al mínimo aunque el puntero siga hacia la derecha', () => {
    const { result } = renderHook(() => useInspectorPanel());

    act(() => result.current.startResize(pointerEvent(START_X).event));
    dispatchPointerMove(START_X + 5000);

    expect(result.current.width).toBe(INSPECTOR_MIN_WIDTH);
  });

  it('consume el evento al empezar el arrastre', () => {
    const { result } = renderHook(() => useInspectorPanel());
    const { event, preventDefault } = pointerEvent(START_X);

    act(() => result.current.startResize(event));

    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('termina el arrastre con pointerup y deja de seguir al puntero', () => {
    const { result } = renderHook(() => useInspectorPanel());

    act(() => result.current.startResize(pointerEvent(START_X).event));
    dispatchPointerMove(START_X - 40);
    const widened = result.current.width;

    dispatchPointerUp();
    expect(result.current.isResizing).toBe(false);

    dispatchPointerMove(START_X - 400);
    expect(result.current.width).toBe(widened);
  });
});

describe('useInspectorPanel — persistencia del ancho (P3)', () => {
  it('restaura el ancho guardado al montar', () => {
    window.localStorage.setItem(INSPECTOR_PANEL_WIDTH_KEY, '500');

    const { result } = renderHook(() => useInspectorPanel());

    expect(result.current.width).toBe(500);
  });

  it('acota al máximo un ancho guardado por encima del límite', () => {
    window.localStorage.setItem(
      INSPECTOR_PANEL_WIDTH_KEY,
      String(INSPECTOR_MAX_WIDTH + 500),
    );

    const { result } = renderHook(() => useInspectorPanel());

    expect(result.current.width).toBe(INSPECTOR_MAX_WIDTH);
  });

  it('acota al mínimo un ancho guardado por debajo del límite', () => {
    window.localStorage.setItem(
      INSPECTOR_PANEL_WIDTH_KEY,
      String(INSPECTOR_MIN_WIDTH - 100),
    );

    const { result } = renderHook(() => useInspectorPanel());

    expect(result.current.width).toBe(INSPECTOR_MIN_WIDTH);
  });

  it('usa el valor por defecto si lo guardado no es numérico', () => {
    window.localStorage.setItem(INSPECTOR_PANEL_WIDTH_KEY, 'no-es-un-numero');

    const { result } = renderHook(() => useInspectorPanel());

    expect(result.current.width).toBe(INSPECTOR_DEFAULT_WIDTH);
  });

  it('persiste el ancho en localStorage al ajustarlo', () => {
    const { result } = renderHook(() => useInspectorPanel());

    act(() => result.current.startResize(pointerEvent(START_X).event));
    dispatchPointerMove(START_X - 80);
    dispatchPointerUp();

    expect(window.localStorage.getItem(INSPECTOR_PANEL_WIDTH_KEY)).toBe(
      String(result.current.width),
    );
  });
});

describe('useInspectorPanel — ajuste por teclado (P4)', () => {
  it('ArrowLeft ensancha el panel un paso', () => {
    const { result } = renderHook(() => useInspectorPanel());

    act(() => result.current.onResizeKey(keyEvent('ArrowLeft').event));

    expect(result.current.width).toBe(INSPECTOR_DEFAULT_WIDTH + INSPECTOR_STEP);
  });

  it('ArrowRight estrecha el panel un paso', () => {
    const { result } = renderHook(() => useInspectorPanel());

    act(() => result.current.onResizeKey(keyEvent('ArrowRight').event));

    expect(result.current.width).toBe(INSPECTOR_DEFAULT_WIDTH - INSPECTOR_STEP);
  });

  it('no supera el máximo con ArrowLeft', () => {
    window.localStorage.setItem(
      INSPECTOR_PANEL_WIDTH_KEY,
      String(INSPECTOR_MAX_WIDTH),
    );
    const { result } = renderHook(() => useInspectorPanel());

    act(() => result.current.onResizeKey(keyEvent('ArrowLeft').event));

    expect(result.current.width).toBe(INSPECTOR_MAX_WIDTH);
  });

  it('no baja del mínimo con ArrowRight', () => {
    window.localStorage.setItem(
      INSPECTOR_PANEL_WIDTH_KEY,
      String(INSPECTOR_MIN_WIDTH),
    );
    const { result } = renderHook(() => useInspectorPanel());

    act(() => result.current.onResizeKey(keyEvent('ArrowRight').event));

    expect(result.current.width).toBe(INSPECTOR_MIN_WIDTH);
  });

  it('consume el evento al ajustar con las flechas', () => {
    const { result } = renderHook(() => useInspectorPanel());
    const { event, preventDefault } = keyEvent('ArrowLeft');

    act(() => result.current.onResizeKey(event));

    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('ignora teclas que no son flechas y no consume el evento', () => {
    const { result } = renderHook(() => useInspectorPanel());
    const { event, preventDefault } = keyEvent('a');

    act(() => result.current.onResizeKey(event));

    expect(result.current.width).toBe(INSPECTOR_DEFAULT_WIDTH);
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

describe('useInspectorPanel — pantalla completa efímera (P8)', () => {
  it('arranca en layout normal', () => {
    const { result } = renderHook(() => useInspectorPanel());

    expect(result.current.isFullscreen).toBe(false);
  });

  it('toggleFullscreen alterna el estado', () => {
    const { result } = renderHook(() => useInspectorPanel());

    act(() => result.current.toggleFullscreen());
    expect(result.current.isFullscreen).toBe(true);

    act(() => result.current.toggleFullscreen());
    expect(result.current.isFullscreen).toBe(false);
  });

  it('closeFullscreen vuelve al layout normal', () => {
    const { result } = renderHook(() => useInspectorPanel());

    act(() => result.current.toggleFullscreen());
    act(() => result.current.closeFullscreen());

    expect(result.current.isFullscreen).toBe(false);
  });

  it('no persiste el fullscreen entre montajes', () => {
    const first = renderHook(() => useInspectorPanel());
    act(() => first.result.current.toggleFullscreen());
    expect(first.result.current.isFullscreen).toBe(true);
    first.unmount();

    const second = renderHook(() => useInspectorPanel());

    expect(second.result.current.isFullscreen).toBe(false);
  });

  it('solo persiste el ancho, nunca el fullscreen', () => {
    const { result } = renderHook(() => useInspectorPanel());

    act(() => result.current.toggleFullscreen());

    expect(storageKeys()).toEqual([INSPECTOR_PANEL_WIDTH_KEY]);
  });
});
