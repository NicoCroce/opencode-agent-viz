import dagre from '@dagrejs/dagre';
import type { TGraphModel } from '../Graph.entity';

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 76;

export const topologySignature = (model: TGraphModel): string => {
  const nodeIds = model.nodes
    .map((n) => n.id)
    .sort()
    .join(',');
  const edgeIds = model.edges
    .map((e) => e.id)
    .sort()
    .join(',');
  return `${nodeIds}|${edgeIds}`;
};

export const layoutGraph = (model: TGraphModel): TGraphModel => {
  if (model.nodes.length === 0) return model;

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: 'TB',
    nodesep: 40,
    ranksep: 60,
    marginx: 16,
    marginy: 16,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of model.nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of model.edges) {
    graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  const nodes = model.nodes.map((node) => {
    const position = graph.node(node.id) as
      | { x: number; y: number }
      | undefined;
    return {
      ...node,
      position: position
        ? { x: position.x - NODE_WIDTH / 2, y: position.y - NODE_HEIGHT / 2 }
        : node.position,
    };
  });

  return { ...model, nodes };
};
