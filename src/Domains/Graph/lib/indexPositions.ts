/** Subconjunto estructural de un nodo con posición (compatible con `TGraphNode`). */
export interface TPositionedNode {
  id: string;
  position: { x: number; y: number };
}

/**
 * Índice de posiciones por id de nodo, para aplicar el layout a la estructura
 * sin recorrer el modelo dos veces.
 *
 * Función pura extraída de `useGraphStructure`.
 */
export const indexPositions = (
  nodes: TPositionedNode[],
): Record<string, { x: number; y: number }> =>
  Object.fromEntries(nodes.map((node) => [node.id, node.position]));
