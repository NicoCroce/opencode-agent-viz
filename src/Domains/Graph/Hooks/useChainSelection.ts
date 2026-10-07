import { useCallback, useState } from 'react';

export interface UseChainSelectionResult {
  /** Selección explícita del usuario; `null` = sin modo cadena. */
  selectedNodeId: string | null;
  /** Nodo que ve el inspector: la selección explícita o la raíz por defecto. */
  inspectedNodeId: string | null;
  /** `true` cuando hay una selección explícita (modo cadena activo). */
  isChainMode: boolean;
  /** Entra en modo cadena seleccionando un nodo. */
  selectNode: (id: string) => void;
  /** Vuelve al grafo completo y a la inspección por defecto de la raíz. */
  clearSelection: () => void;
}

interface ChainSelectionState {
  rootId: string | null;
  selectedNodeId: string | null;
}

/**
 * Gestiona la selección **explícita** del grafo y separa la inspección por
 * defecto (remediación A1, FR-008):
 *
 * - `selectedNodeId` es la selección explícita; `null` al montar, de modo que
 *   ningún nodo queda resaltado por defecto.
 * - `inspectedNodeId = selectedNodeId ?? rootId` alimenta solo al inspector.
 * - `isChainMode = selectedNodeId !== null`.
 * - Al cambiar `rootId` (otra sesión) se resetea la selección, siguiendo el
 *   patrón de React de ajustar estado durante el render para evitar renders en
 *   cascada (mismo enfoque que `useNodeResize`).
 *
 * Estado de vista local, sin persistencia (Principio IV).
 */
export const useChainSelection = (
  rootId: string | null,
): UseChainSelectionResult => {
  const [state, setState] = useState<ChainSelectionState>({
    rootId,
    selectedNodeId: null,
  });

  if (state.rootId !== rootId) {
    setState({ rootId, selectedNodeId: null });
  }

  const selectedNodeId = state.rootId === rootId ? state.selectedNodeId : null;

  const selectNode = useCallback((id: string) => {
    setState((current) => ({ ...current, selectedNodeId: id }));
  }, []);

  const clearSelection = useCallback(() => {
    setState((current) => ({ ...current, selectedNodeId: null }));
  }, []);

  return {
    selectedNodeId,
    inspectedNodeId: selectedNodeId ?? rootId,
    isChainMode: selectedNodeId !== null,
    selectNode,
    clearSelection,
  };
};
