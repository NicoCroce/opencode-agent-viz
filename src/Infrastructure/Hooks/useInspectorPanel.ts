import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import {
  clampPanelWidth,
  INSPECTOR_DEFAULT_WIDTH,
  INSPECTOR_STEP,
} from '@app/Application/Helpers/panelWidth';

/**
 * Clave de `localStorage` del ancho del panel de detalle. El ancho es la única
 * preferencia persistida de la feature (FR-010); el fullscreen es efímero
 * (FR-013) y no tiene clave.
 */
export const INSPECTOR_PANEL_WIDTH_KEY = 'inspector.panel.width';

export interface TInspectorPanelState {
  width: number;
  isResizing: boolean;
  isFullscreen: boolean;
}

export interface TUseInspectorPanelResult extends TInspectorPanelState {
  startResize: (event: ReactPointerEvent) => void;
  onResizeKey: (event: ReactKeyboardEvent) => void;
  toggleFullscreen: () => void;
  closeFullscreen: () => void;
}

const readStoredWidth = (): number => {
  if (typeof window === 'undefined') return INSPECTOR_DEFAULT_WIDTH;

  const stored = window.localStorage.getItem(INSPECTOR_PANEL_WIDTH_KEY);
  if (stored === null || stored.trim() === '') return INSPECTOR_DEFAULT_WIDTH;

  return clampPanelWidth(Number(stored));
};

/**
 * Estado de vista del panel de detalle (US5/US6):
 *
 * - `width` se lee de `localStorage` al montar (fallback a
 *   `INSPECTOR_DEFAULT_WIDTH`) y se vuelve a acotar con `clampPanelWidth`;
 *   cada cambio se persiste (FR-010/FR-011).
 * - `startResize` arranca un arrastre por puntero que escucha `pointermove`/
 *   `pointerup`/`pointercancel` en `window` con limpieza (SC-007). El inspector
 *   vive a la derecha, así que mover el separador hacia la izquierda ensancha.
 * - `onResizeKey` ajusta ±`INSPECTOR_STEP` con `ArrowLeft`/`ArrowRight`.
 * - `isFullscreen` arranca `false`, nunca se persiste (FR-013) y se alterna con
 *   `toggleFullscreen` / se cierra con `closeFullscreen`.
 *
 * Toda la lógica vive en el hook (AGENTS §4); el layout solo consume el estado.
 */
export const useInspectorPanel = (): TUseInspectorPanelResult => {
  const [width, setWidth] = useState<number>(readStoredWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Punto de anclaje del arrastre: posición X del puntero y ancho al empezar.
  const dragStartX = useRef<number | null>(null);
  const dragStartWidth = useRef(width);

  // Persistir el ancho (FR-010); el fullscreen no se persiste (FR-013).
  useEffect(() => {
    window.localStorage.setItem(INSPECTOR_PANEL_WIDTH_KEY, String(width));
  }, [width]);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const startX = dragStartX.current;
      if (startX === null) return;
      // Mover el separador hacia la izquierda (deltaX < 0) ensancha el panel.
      const delta = startX - event.clientX;
      setWidth(clampPanelWidth(dragStartWidth.current + delta));
    };

    const handlePointerUp = () => {
      dragStartX.current = null;
      setIsResizing(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isResizing]);

  const startResize = useCallback(
    (event: ReactPointerEvent) => {
      event.preventDefault();
      dragStartX.current = event.clientX;
      dragStartWidth.current = width;
      setIsResizing(true);
    },
    [width],
  );

  const onResizeKey = useCallback((event: ReactKeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    event.preventDefault();
    const direction = event.key === 'ArrowLeft' ? 1 : -1;
    setWidth((current) => clampPanelWidth(current + direction * INSPECTOR_STEP));
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((current) => !current);
  }, []);

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  return {
    width,
    isResizing,
    isFullscreen,
    startResize,
    onResizeKey,
    toggleFullscreen,
    closeFullscreen,
  };
};
