import { useEffect, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@app/Application/lib/utils';
import { NODE_HEIGHT, NODE_WIDTH, topologySignature } from '../lib/layoutGraph';
import { cardHeight } from '../lib/cardHeight';
import { buildViewNodes } from '../lib/buildViewNodes';
import type { TGraphModel, TGraphNode, TNodeStatus } from '../Graph.entity';
import {
  EXECUTION_ROW_PAD,
  deriveRowLayout,
  executionRailX,
  type TExecutionPlan,
} from '../lib/executionLevels';
import { deriveLineage } from '../lib/lineage';
import { isActiveStatus } from '../lib/nodeStatus';
import { useNodeResize } from '../Hooks/useNodeResize';
import { AgentNode } from './AgentNode';
import { InvocationEdge } from './InvocationEdge';
import {
  ExecutionLanes,
  GUTTER_NODE_TYPE,
  GutterNode,
  buildGutterNodes,
} from './ExecutionLanes';

const nodeTypes = {
  agent: AgentNode,
  [GUTTER_NODE_TYPE]: GutterNode,
} as unknown as NodeTypes;

const edgeTypes = {
  invocation: InvocationEdge,
} as unknown as EdgeTypes;

/**
 * Rango de agregación por nivel de ejecución (FR-023): cuando un carril reúne
 * varios agentes, se muestra el estado dominante. Los estados activos
 * (esperas, en curso, reintentando, compactando) pesan más que los terminales,
 * de modo que un nivel con algún agente activo se lee como "en curso"; dentro
 * de los terminales, fallo/interrupción pesan más que terminada. Ver
 * `contracts/execution-state-contract.md`.
 */
const STATUS_RANK: Record<TNodeStatus, number> = {
  created: 0,
  succeeded: 1,
  interrupted: 2,
  failed: 3,
  'waiting-permission': 4,
  'waiting-input': 5,
  running: 6,
  retrying: 7,
  compacting: 8,
};

const worseStatus = (
  current: TNodeStatus | undefined,
  candidate: TNodeStatus,
): TNodeStatus =>
  current === undefined || STATUS_RANK[candidate] > STATUS_RANK[current]
    ? candidate
    : current;

const FollowController = ({ nodeId }: { nodeId: string | null }) => {
  const { getNode, setCenter } = useReactFlow();

  useEffect(() => {
    if (!nodeId) return;
    const node = getNode(nodeId);
    if (!node) return;
    void setCenter(
      node.position.x + NODE_WIDTH / 2,
      node.position.y + NODE_HEIGHT / 2,
      { zoom: 1, duration: 300 },
    );
  }, [nodeId, getNode, setCenter]);

  return null;
};

/**
 * Ajusta el viewport cuando cambia la firma de topología de la vista. React Flow
 * solo hace `fitView` en el montaje, así que un cambio de topología necesita un
 * ajuste explícito. No relayouta: solo encuadra los nodos ya posicionados
 * (Principio VII).
 */
const FitViewController = ({ signature }: { signature: string }) => {
  const { fitView } = useReactFlow();

  useEffect(() => {
    void fitView({ duration: 300, padding: 0.1 });
  }, [signature, fitView]);

  return null;
};

interface AgentGraphProps {
  graph: TGraphModel;
  /** Plan de niveles de ejecución (carriles + gutter). */
  plan: TExecutionPlan;
  /** Nodo enfocado: su linaje queda a opacidad plena y el resto se atenúa. */
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  /** Clic en el fondo: vuelve al grafo completo. */
  onClearSelection: () => void;
  /**
   * Doble clic en un nodo `agent`: abre el histórico de su sesión (FR-008).
   * Recibe el `node.id`, que es la sesión del agente. El clic simple sigue
   * seleccionando el nodo (`onSelectNode`).
   */
  onOpenHistory?: (nodeId: string) => void;
  followNodeId?: string | null;
  /** Sesión raíz: al cambiar se limpian los tamaños elegidos por el usuario. */
  resetKey?: string | null;
  className?: string;
}

export const AgentGraph = ({
  graph,
  plan,
  selectedNodeId,
  onSelectNode,
  onClearSelection,
  onOpenHistory,
  followNodeId = null,
  resetKey = null,
  className,
}: AgentGraphProps) => {
  const { overrides, onNodesChange } = useNodeResize(resetKey);
  const signature = useMemo(() => topologySignature(graph), [graph]);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Linaje del nodo seleccionado: ancestros + descendientes. `null` = sin foco.
  const lineage = useMemo(
    () => deriveLineage(graph, selectedNodeId),
    [graph, selectedNodeId],
  );

  const statusByLevel = useMemo(() => {
    const map: Record<number, TNodeStatus> = {};
    for (const node of graph.nodes) {
      const level = plan.levelByNode[node.id];
      if (level === undefined) continue;
      map[level] = worseStatus(map[level], node.data.status);
    }
    return map;
  }, [graph.nodes, plan]);

  const activeLevel = useMemo(() => {
    const active = graph.nodes.find((node) => isActiveStatus(node.data.status));
    return active ? (plan.levelByNode[active.id] ?? null) : null;
  }, [graph.nodes, plan]);

  // Alto real de cada nodo: el override de resize o el alto calculado según el
  // contenido (`cardHeight`), para que el carril acompañe al card.
  const heightByNode = useMemo(() => {
    const map: Record<string, number> = {};
    for (const node of graph.nodes) {
      map[node.id] =
        overrides[node.id]?.height ?? cardHeight(node.data, NODE_WIDTH);
    }
    return map;
  }, [graph.nodes, overrides]);

  // Cada carril crece en proporción al nodo más alto de su nivel.
  const rowLayout = useMemo(
    () => deriveRowLayout(plan, heightByNode),
    [plan, heightByNode],
  );

  const nodes = useMemo<TGraphNode[]>(() => {
    const agentNodes = buildViewNodes(
      graph.nodes,
      overrides,
      selectedNodeId,
      false,
    );

    // El carril manda el `y` (alto acumulado); el `x` sigue siendo el de la
    // columna dentro del nivel. Fuera del linaje, el nodo se atenúa (no se
    // oculta: la estructura del grafo se conserva).
    const positioned = agentNodes.map((node) => {
      const level = plan.levelByNode[node.id];
      if (level === undefined) return node;
      return {
        ...node,
        position: {
          x: node.position.x,
          y: (rowLayout.top[level] ?? 0) + EXECUTION_ROW_PAD,
        },
        style: lineage
          ? { ...node.style, opacity: lineage.nodeIds.has(node.id) ? 1 : 0.15 }
          : node.style,
      };
    });

    // Los nodos del gutter son de otro tipo (`gutter`); React Flow los admite
    // en el mismo array. El cast refleja que el genérico lo fija `onNodesChange`.
    return [
      ...positioned,
      ...buildGutterNodes(plan, rowLayout, statusByLevel, activeLevel),
    ] as unknown as TGraphNode[];
  }, [
    graph.nodes,
    overrides,
    selectedNodeId,
    plan,
    rowLayout,
    statusByLevel,
    activeLevel,
    lineage,
  ]);

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge) => {
        const column = plan.columnByNode[edge.source] ?? 0;
        // Reposo: gris visible (no `--border`, que se pierde en dark).
        let color = 'hsl(var(--muted-foreground))';
        let strokeWidth = 1.25;
        let opacity = 0.45;

        if (lineage) {
          // Foco activo: se refuerzan las aristas del linaje; el resto se atenúa
          // pero sigue visible (la estructura no se borra).
          if (lineage.edgeIds.has(edge.id)) {
            color = 'hsl(var(--foreground))';
            strokeWidth = 2;
            opacity = 1;
          } else {
            opacity = 0.15;
          }
        } else if (
          hoveredNodeId !== null &&
          (edge.source === hoveredNodeId || edge.target === hoveredNodeId)
        ) {
          // Sin foco: el hover traza las relaciones directas del nodo.
          color = 'hsl(var(--foreground))';
          strokeWidth = 1.6;
          opacity = 1;
        }

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'invocation',
          data: { railX: executionRailX(column) },
          style: { stroke: color, strokeWidth, opacity },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 12,
            height: 12,
            color,
          },
        };
      }),
    [graph.edges, plan.columnByNode, lineage, hoveredNodeId],
  );

  return (
    <ReactFlowProvider>
      <div className={cn('h-full w-full', className)}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode="dark"
          fitView
          minZoom={0.2}
          nodesDraggable={false}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => {
            if (String(node.type) === GUTTER_NODE_TYPE) return;
            onSelectNode(node.id);
          }}
          onNodeDoubleClick={(_, node) => {
            if (String(node.type) === GUTTER_NODE_TYPE) return;
            onOpenHistory?.(node.id);
          }}
          onNodeMouseEnter={(_, node) => {
            if (String(node.type) === GUTTER_NODE_TYPE) return;
            setHoveredNodeId(node.id);
          }}
          onNodeMouseLeave={() => setHoveredNodeId(null)}
          onPaneClick={onClearSelection}
        >
          <Background gap={16} color="#232A34" />
          <Controls showInteractive={false} />
          <ExecutionLanes
            plan={plan}
            rowLayout={rowLayout}
            activeLevel={activeLevel}
          />
        </ReactFlow>
        <FitViewController signature={signature} />
        <FollowController nodeId={followNodeId} />
      </div>
    </ReactFlowProvider>
  );
};
