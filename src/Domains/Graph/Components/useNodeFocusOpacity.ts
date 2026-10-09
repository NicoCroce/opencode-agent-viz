import { useNodeFocus } from './NodeFocusContext';

/**
 * Opacidad de foco del nodo leída del contexto (contrato de render §1.2/§2).
 *
 * `1` dentro del linaje del nodo seleccionado y `0.15` fuera; `undefined` sin
 * selección (sin estilo en línea). El hover **no** atenúa el nodo —solo afecta
 * a las aristas—, por lo que no participa del cálculo.
 */
export const useNodeFocusOpacity = (nodeId: string): number | undefined => {
  const { selectedNodeId, lineageNodeIds } = useNodeFocus();

  if (selectedNodeId === null) return undefined;
  return lineageNodeIds.has(nodeId) ? 1 : 0.15;
};
