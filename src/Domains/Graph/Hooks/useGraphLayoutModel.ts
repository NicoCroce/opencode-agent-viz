import { useMemo } from 'react';
import { MarkerType, type Edge } from '@xyflow/react';
import type {
  TGraphModel,
  TGraphNode,
  TNodeSizeOverride,
  TNodeStatus,
} from '../Graph.entity';
import { buildGutterNodes } from '../lib/buildGutterNodes';
import { buildViewNodes, type TGraphViewNode } from '../lib/buildViewNodes';
import {
  EXECUTION_ROW_PAD,
  deriveRowLayout,
  executionRailX,
  type TExecutionPlan,
  type TRowLayout,
} from '../lib/executionLevels';
import { NODE_HEIGHT } from '../lib/layoutGraph';
import { isActiveStatus } from '../lib/nodeStatus';
import { worseNodeStatus } from '../lib/nodeStatusRank';
import { REST_EDGE_COLOR, REST_EDGE_STYLE } from '../lib/restEdgeStyle';

export interface UseGraphLayoutModelResult {
  statusByLevel: Record<number, TNodeStatus>;
  activeLevel: number | null;
  heightByNode: Record<string, number>;
  viewNodes: TGraphViewNode[];
  rowLayout: TRowLayout;
  nodes: TGraphNode[];
  edges: Edge[];
}

/**
 * Modelo de vista del grafo. Las deps de cada `useMemo` son las mínimas: hover
 * y selección **no** invalidan ninguna derivación (contrato de render §1.2, C3).
 */
export const useGraphLayoutModel = (
  graph: TGraphModel,
  plan: TExecutionPlan,
  overrides: Record<string, TNodeSizeOverride>,
): UseGraphLayoutModelResult => {
  const statusByLevel = useMemo(() => {
    const map: Record<number, TNodeStatus> = {};
    for (const node of graph.nodes) {
      const level = plan.levelByNode[node.id];
      if (level === undefined) continue;
      map[level] = worseNodeStatus(map[level], node.data.status);
    }
    return map;
  }, [graph.nodes, plan]);

  const activeLevel = useMemo(() => {
    const active = graph.nodes.find((node) => isActiveStatus(node.data.status));
    return active ? (plan.levelByNode[active.id] ?? null) : null;
  }, [graph.nodes, plan]);

  // `height` ya resuelto por `buildViewNodes` (contrato de render §3): el carril
  // reutiliza ese alto y no vuelve a llamar `cardHeight`.
  const viewNodes = useMemo(
    () => buildViewNodes(graph.nodes, overrides, null, false),
    [graph.nodes, overrides],
  );

  const heightByNode = useMemo(() => {
    const map: Record<string, number> = {};
    for (const node of viewNodes) {
      map[node.id] = node.height ?? NODE_HEIGHT;
    }
    return map;
  }, [viewNodes]);

  // Cada carril crece en proporción al nodo más alto de su nivel.
  const rowLayout = useMemo(
    () => deriveRowLayout(plan, heightByNode),
    [plan, heightByNode],
  );

  const nodes = useMemo<TGraphNode[]>(() => {
    // El carril manda el `y`; el `x` sigue siendo el de la columna del nivel.
    const positioned = viewNodes.map((node) => {
      const level = plan.levelByNode[node.id];
      if (level === undefined) return node;
      return {
        ...node,
        position: {
          x: node.position.x,
          y: (rowLayout.top[level] ?? 0) + EXECUTION_ROW_PAD,
        },
      };
    });

    return [
      ...positioned,
      ...buildGutterNodes(plan, rowLayout, statusByLevel, activeLevel),
    ] as unknown as TGraphNode[];
  }, [viewNodes, plan, rowLayout, statusByLevel, activeLevel]);

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge) => {
        const column = plan.columnByNode[edge.source] ?? 0;
        // Reposo gris; el foco/hover lo resuelve `InvocationEdge` por contexto.
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'invocation',
          data: { railX: executionRailX(column) },
          style: REST_EDGE_STYLE,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 12,
            height: 12,
            color: REST_EDGE_COLOR,
          },
        };
      }),
    [graph.edges, plan.columnByNode],
  );

  return {
    statusByLevel,
    activeLevel,
    heightByNode,
    viewNodes,
    rowLayout,
    nodes,
    edges,
  };
};
