import { useCallback, useState } from 'react';
import {
  DEFAULT_GRAPH_VIEW_MODE,
  isGraphViewMode,
  type TGraphViewMode,
} from '../lib/graphViewMode';

/** Clave de `localStorage` de la vista elegida (Grafo | Carriles). */
export const GRAPH_VIEW_MODE_STORAGE_KEY = 'graph.viewMode';

/** Lee la vista guardada; la de por defecto si no hay valor válido o falla el acceso. */
const readStoredMode = (): TGraphViewMode => {
  try {
    if (typeof window === 'undefined') return DEFAULT_GRAPH_VIEW_MODE;
    const stored = window.localStorage.getItem(GRAPH_VIEW_MODE_STORAGE_KEY);
    return isGraphViewMode(stored) ? stored : DEFAULT_GRAPH_VIEW_MODE;
  } catch {
    return DEFAULT_GRAPH_VIEW_MODE;
  }
};

/** Persiste la vista; un fallo de almacenamiento no debe romper el cambio. */
const writeStoredMode = (mode: TGraphViewMode): void => {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(GRAPH_VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // Sin persistencia (modo privado, cuota): la vista sigue en memoria.
  }
};

export interface TUseGraphViewModeResult {
  mode: TGraphViewMode;
  setMode: (mode: TGraphViewMode) => void;
}

/**
 * Vista del lienzo de agentes (Grafo | Carriles). Estado de vista del usuario,
 * recordado entre sesiones en `localStorage`; no toca datos ni el layout.
 */
export const useGraphViewMode = (): TUseGraphViewModeResult => {
  const [mode, setModeState] = useState<TGraphViewMode>(readStoredMode);

  const setMode = useCallback((next: TGraphViewMode) => {
    setModeState(next);
    writeStoredMode(next);
  }, []);

  return { mode, setMode };
};
