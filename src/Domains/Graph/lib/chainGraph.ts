import type { TGraphModel, TGraphNode } from '../Graph.entity';
import { NODE_WIDTH } from './layoutGraph';

/** Separación horizontal entre nodos consecutivos de la cadena (FR-006). */
export const CHAIN_GAP = 48;

/**
 * Proyecta la cadena de ancestros de `nodeId`, desde la raíz de la sesión
 * hasta el propio nodo.
 *
 * Función pura, sin React (Principio V) y O(n):
 * - Recorre los ancestros siguiendo las aristas en sentido `target → source`
 *   (una arista `source → target` conecta padre → hijo) hasta la raíz.
 * - Devuelve los nodos ordenados `raíz → … → nodeId` junto con las aristas que
 *   los conectan. No incluye descendientes ni ramas hermanas (FR-005).
 * - Devuelve `null` si `nodeId` no está en `model`; el llamador usa entonces el
 *   grafo completo.
 * - Caso `nodeId === raíz`: cadena de un solo nodo y sin aristas.
 */
export const buildChain = (
  model: TGraphModel,
  nodeId: string,
): TGraphModel | null => {
  const nodeById = new Map<string, TGraphNode>();
  for (const node of model.nodes) nodeById.set(node.id, node);

  if (!nodeById.has(nodeId)) return null;

  // Padre de cada nodo: la arista apunta `source → target`, así que al caminar
  // hacia la raíz resolvemos el `source` a partir del `target` actual.
  const parentByChild = new Map<string, string>();
  for (const edge of model.edges) parentByChild.set(edge.target, edge.source);

  const chainIds: string[] = [];
  const visited = new Set<string>();
  let current: string | undefined = nodeId;
  while (
    current !== undefined &&
    nodeById.has(current) &&
    !visited.has(current)
  ) {
    visited.add(current);
    chainIds.push(current);
    current = parentByChild.get(current);
  }
  chainIds.reverse(); // raíz → … → nodeId

  const chainIdSet = new Set(chainIds);
  const nodes = chainIds
    .map((id) => nodeById.get(id))
    .filter((node): node is TGraphNode => node !== undefined);
  const edges = model.edges.filter(
    (edge) => chainIdSet.has(edge.source) && chainIdSet.has(edge.target),
  );

  return { nodes, edges };
};

/**
 * Posiciona la cadena en una sola fila horizontal (FR-006):
 * `x = index * (NODE_WIDTH + CHAIN_GAP)`, `y = 0`, respetando el orden
 * recibido. Determinista y O(n); no usa dagre (Principio V).
 */
export const layoutChain = (model: TGraphModel): TGraphModel => {
  const nodes = model.nodes.map((node, index) => ({
    ...node,
    position: { x: index * (NODE_WIDTH + CHAIN_GAP), y: 0 },
  }));

  return { ...model, nodes };
};
