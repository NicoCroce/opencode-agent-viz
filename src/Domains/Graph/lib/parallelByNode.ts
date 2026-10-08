import type { TNodeParallelism, TParallelGroup } from '../Graph.entity';

/**
 * Índice de paralelismo por id de nodo a partir de los grupos detectados por
 * `deriveParallelGroups`: cada nodo conoce su grupo y el tamaño de este.
 *
 * Función pura extraída de `useGraphStructure`; reutilizable por cualquier
 * vista que necesite resolver el paralelismo de un nodo por id.
 */
export const toParallelByNode = (
  groups: TParallelGroup[],
): Record<string, TNodeParallelism> => {
  const map: Record<string, TNodeParallelism> = {};
  for (const group of groups) {
    for (const id of group.nodeIds) {
      map[id] = { groupId: group.id, size: group.nodeIds.length };
    }
  }
  return map;
};
