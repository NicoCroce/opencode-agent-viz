import { useCallback, useState } from 'react';
import type { OnNodesChange } from '@xyflow/react';
import type { TGraphNode, TNodeSizeOverride } from '../Graph.entity';
import { reduceNodeOverrides } from '../lib/nodeResize';

export interface UseNodeResizeResult {
  /** Tamaño/posición elegidos por el usuario, por nodo y por sesión. */
  overrides: Record<string, TNodeSizeOverride>;
  /** Cambios de React Flow: solo se conservan dimensiones/posición de resize. */
  onNodesChange: OnNodesChange<TGraphNode>;
}

interface NodeResizeState {
  resetKey: string | null;
  overrides: Record<string, TNodeSizeOverride>;
}

/**
 * Mantiene los overrides de tamaño/posición de los nodos en estado local.
 *
 * - `onNodesChange` delega en la función pura `reduceNodeOverrides` (Principio V).
 * - Al cambiar `resetKey` (id de la sesión raíz) se limpian los overrides, de
 *   modo que el tamaño no se filtra entre sesiones (FR-003). Se usa el patrón
 *   recomendado de React de ajustar estado durante el render en lugar de un
 *   efecto, evitando renders en cascada.
 * - No persiste ni sincroniza con el servidor (estado de vista, Principio IV).
 */
export const useNodeResize = (resetKey: string | null): UseNodeResizeResult => {
  const [state, setState] = useState<NodeResizeState>({
    resetKey,
    overrides: {},
  });

  if (state.resetKey !== resetKey) {
    setState({ resetKey, overrides: {} });
  }

  const overrides = state.resetKey === resetKey ? state.overrides : {};

  const onNodesChange = useCallback<OnNodesChange<TGraphNode>>((changes) => {
    setState((current) => ({
      ...current,
      overrides: reduceNodeOverrides(current.overrides, changes),
    }));
  }, []);

  return { overrides, onNodesChange };
};
