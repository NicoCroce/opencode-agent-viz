import { Graph, layout } from '@dagrejs/dagre';

/** Separación horizontal entre cards hermanas del árbol. */
export const TREE_NODE_SEP = 40;
/** Separación vertical entre niveles del árbol (aloja el bus de aristas). */
export const TREE_RANK_SEP = 72;

export interface TTreeLayoutNode {
  id: string;
  width: number;
  height: number;
}

/** Etiqueta de nodo de dagre: tamaño de entrada, centro calculado. */
interface TDagreNode {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface TTreeLayoutEdge {
  source: string;
  target: string;
}

/**
 * Posiciona los nodos como árbol de invocación (vista "Grafo"): de arriba abajo,
 * padres sobre sus hijos. Usa dagre y luego **alinea por arriba** cada nivel,
 * de modo que los hermanos comparten `y` y sus aristas un mismo bus horizontal.
 *
 * Función pura y determinista (mismo orden de entrada → mismas posiciones);
 * devuelve la esquina superior izquierda de cada card, en coordenadas de flujo.
 */
export const layoutTree = (
  nodes: TTreeLayoutNode[],
  edges: TTreeLayoutEdge[],
): Record<string, { x: number; y: number }> => {
  if (nodes.length === 0) return {};

  const g = new Graph<object, TDagreNode, object>();
  g.setGraph({
    rankdir: 'TB',
    nodesep: TREE_NODE_SEP,
    ranksep: TREE_RANK_SEP,
    marginx: 0,
    marginy: 0,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const ids = new Set(nodes.map((node) => node.id));
  for (const node of nodes) {
    g.setNode(node.id, { width: node.width, height: node.height, x: 0, y: 0 });
  }
  for (const edge of edges) {
    if (ids.has(edge.source) && ids.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  layout(g);

  // dagre centra cada card en su nivel; el borde superior del nivel es el
  // centro menos la mitad del alto mayor de ese nivel.
  const rankTop = new Map<number, number>();
  for (const node of nodes) {
    const { y, height } = g.node(node.id);
    const top = y - height / 2;
    rankTop.set(y, Math.min(rankTop.get(y) ?? top, top));
  }

  const positions: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    const { x, y, width } = g.node(node.id);
    positions[node.id] = { x: x - width / 2, y: rankTop.get(y) ?? y };
  }
  return positions;
};
