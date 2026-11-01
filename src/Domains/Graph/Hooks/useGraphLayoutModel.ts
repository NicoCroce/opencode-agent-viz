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
import { GRAPH_VIEW_MODE, type TGraphViewMode } from '../lib/graphViewMode';
import { NODE_HEIGHT, NODE_WIDTH } from '../lib/layoutGraph';
import { layoutTree } from '../lib/layoutTree';
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
  /**
   * Centro X (flujo) de la raíz del árbol en la vista "Grafo"; el encuadre la
   * centra cuando el árbol no entra completo. `null` en carriles.
   */
  anchorX: number | null;
}

/**
 * Modelo de vista del grafo. Las deps de cada `useMemo` son las mínimas: hover
 * y selección **no** invalidan ninguna derivación (contrato de render §1.2, C3).
 */
export const useGraphLayoutModel = (
  graph: TGraphModel,
  plan: TExecutionPlan,
  overrides: Record<string, TNodeSizeOverride>,
  mode: TGraphViewMode = GRAPH_VIEW_MODE.LANES,
): UseGraphLayoutModelResult => {
  const isTree = mode === GRAPH_VIEW_MODE.GRAPH;

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

  // Vista "Grafo": árbol de invocación. Se re-layouta solo si cambian ids,
  // tamaños o aristas, no con cada cambio de datos (Principio VII).
  const treeKey = isTree
    ? `${viewNodes.map((node) => `${node.id}:${node.width}x${node.height}`).join(',')}|${graph.edges.map((edge) => edge.id).join(',')}`
    : '';
  const treePositions = useMemo(
    () =>
      isTree
        ? layoutTree(
            viewNodes.map((node) => ({
              id: node.id,
              width: node.width ?? NODE_WIDTH,
              height: node.height ?? NODE_HEIGHT,
            })),
            graph.edges,
          )
        : null,
    // `treeKey` resume viewNodes/edges: re-layoutar por identidad haría correr
    // dagre en cada evento de estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [treeKey],
  );

  const nodes = useMemo<TGraphNode[]>(() => {
    if (treePositions) {
      // El árbol manda la posición; sin gutter ni carriles.
      return viewNodes.map((node) => ({
        ...node,
        position: treePositions[node.id] ?? node.position,
      }));
    }

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
  }, [viewNodes, plan, rowLayout, statusByLevel, activeLevel, treePositions]);

  // Raíz del árbol: el primer nodo que no es destino de ninguna arista.
  const anchorX = useMemo(() => {
    if (!treePositions) return null;
    const targets = new Set(graph.edges.map((edge) => edge.target));
    const root = viewNodes.find((node) => !targets.has(node.id));
    const position = root ? treePositions[root.id] : undefined;
    if (!root || !position) return null;
    return position.x + (root.width ?? NODE_WIDTH) / 2;
  }, [treePositions, viewNodes, graph.edges]);

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
          data: isTree
            ? { routing: 'tree' }
            : { routing: 'rail', railX: executionRailX(column) },
          style: REST_EDGE_STYLE,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 9,
            height: 9,
            color: REST_EDGE_COLOR,
          },
        };
      }),
    [graph.edges, plan.columnByNode, isTree],
  );

  return {
    statusByLevel,
    activeLevel,
    heightByNode,
    viewNodes,
    rowLayout,
    nodes,
    edges,
    anchorX,
  };
};
