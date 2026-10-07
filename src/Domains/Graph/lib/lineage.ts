import type { TGraphModel } from '../Graph.entity';

/** Conjunto resaltado al enfocar un nodo: sus nodos y las aristas que los unen. */
export interface TLineage {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
}

/**
 * Linaje de un nodo: **ancestros** (raíz → nodo) **más descendientes** (todo el
 * subárbol que ese nodo invocó, recursivo). Es el conjunto que queda a opacidad
 * plena cuando se selecciona un nodo; el resto se atenúa.
 *
 * Devuelve también las aristas cuyos dos extremos pertenecen al linaje (las que
 * se refuerzan). `null` si no hay selección o el nodo no está en el modelo.
 *
 * Función pura, sin React (Principio V).
 */
export const deriveLineage = (
  model: TGraphModel,
  nodeId: string | null,
): TLineage | null => {
  if (!nodeId) return null;

  const ids = new Set(model.nodes.map((node) => node.id));
  if (!ids.has(nodeId)) return null;

  const parentByChild = new Map<string, string>();
  const childrenByParent = new Map<string, string[]>();
  for (const edge of model.edges) {
    parentByChild.set(edge.target, edge.source);
    const list = childrenByParent.get(edge.source);
    if (list) list.push(edge.target);
    else childrenByParent.set(edge.source, [edge.target]);
  }

  const nodeIds = new Set<string>([nodeId]);

  // Ancestros: caminar hacia la raíz.
  let current = parentByChild.get(nodeId);
  while (current !== undefined && !nodeIds.has(current)) {
    nodeIds.add(current);
    current = parentByChild.get(current);
  }

  // Descendientes: BFS hacia abajo.
  const queue = [nodeId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const child of childrenByParent.get(id) ?? []) {
      if (nodeIds.has(child)) continue;
      nodeIds.add(child);
      queue.push(child);
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of model.edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      edgeIds.add(edge.id);
    }
  }

  return { nodeIds, edgeIds };
};
