import type { TGraphModel, TNodeParallelism } from '../Graph.entity';

/**
 * Ensambla el modelo estructural final: pega las posiciones del layout y el
 * paralelismo por nodo sobre el modelo base, conservando aristas y el resto de
 * datos del nodo.
 *
 * Función pura extraída de `useGraphStructure`; reutilizable por cualquier fase
 * que combine layout + paralelismo.
 */
export const assembleStructuralGraph = (
  model: TGraphModel,
  positions: Record<string, { x: number; y: number }>,
  parallelByNode: Record<string, TNodeParallelism>,
): TGraphModel => ({
  edges: model.edges,
  nodes: model.nodes.map((node) => ({
    ...node,
    position: positions[node.id] ?? node.position,
    data: { ...node.data, parallel: parallelByNode[node.id] ?? null },
  })),
});
