import { useEffect, useMemo, useRef, useState } from 'react';
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
import { PERF_METRIC, perfMark, perfMeasure } from '@app/Application/Helpers';
import { NODE_HEIGHT, NODE_WIDTH, topologySignature } from '../lib/layoutGraph';
import { buildViewNodes } from '../lib/buildViewNodes';
import { reconcileGraphModel } from '../lib/reconcileGraph';
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
  EMPTY_NODE_FOCUS,
  NodeFocusProvider,
  type TNodeFocus,
} from './NodeFocusContext';
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
 * Marcas de inicio de una transición de interacción (contrato de instrumentación
 * §4). La medida `graph.interaction` se resuelve en el efecto posterior al commit
 * —"pintado siguiente"—, nunca por `mousemove`/frame (criterio P5).
 */
const INTERACTION_HOVER_MARK = 'graph.interaction.hover.start';
const INTERACTION_SELECT_MARK = 'graph.interaction.select.start';

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

  // Identidad estable del modelo (R4, contrato de render §1.1): aunque el padre
  // entregue un `TGraphModel` nuevo por referencia, se reutilizan los nodos y
  // aristas sin cambios para que React Flow no re-renderice de más. Se ajusta el
  // estado durante el render (patrón recomendado por React) para no mostrar un
  // modelo intermedio.
  const [previousGraph, setPreviousGraph] = useState(graph);
  const [stableGraph, setStableGraph] = useState(graph);
  if (previousGraph !== graph) {
    setPreviousGraph(graph);
    setStableGraph(reconcileGraphModel(stableGraph, graph));
  }

  const signature = useMemo(
    () =>
      topologySignature({
        nodes: stableGraph.nodes,
        edges: stableGraph.edges,
      }),
    [stableGraph.nodes, stableGraph.edges],
  );

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Linaje del nodo seleccionado: ancestros + descendientes. `null` = sin foco.
  // Se publica por contexto (no por `data`/`style`) para no reconstruir los
  // arrays que consume React Flow (contrato de render §1.2/§2).
  const lineage = useMemo(
    () =>
      deriveLineage(
        { nodes: stableGraph.nodes, edges: stableGraph.edges },
        selectedNodeId,
      ),
    [stableGraph.nodes, stableGraph.edges, selectedNodeId],
  );

  const focus = useMemo<TNodeFocus>(
    () => ({
      selectedNodeId,
      lineageNodeIds: lineage?.nodeIds ?? EMPTY_NODE_FOCUS.lineageNodeIds,
      lineageEdgeIds: lineage?.edgeIds ?? EMPTY_NODE_FOCUS.lineageEdgeIds,
      hoveredNodeId,
    }),
    [selectedNodeId, lineage, hoveredNodeId],
  );

  const statusByLevel = useMemo(() => {
    const map: Record<number, TNodeStatus> = {};
    for (const node of stableGraph.nodes) {
      const level = plan.levelByNode[node.id];
      if (level === undefined) continue;
      map[level] = worseStatus(map[level], node.data.status);
    }
    return map;
  }, [stableGraph.nodes, plan]);

  const activeLevel = useMemo(() => {
    const active = stableGraph.nodes.find((node) =>
      isActiveStatus(node.data.status),
    );
    return active ? (plan.levelByNode[active.id] ?? null) : null;
  }, [stableGraph.nodes, plan]);

  // Nodos de vista con su `height` ya resuelto por `buildViewNodes` (contrato de
  // render §3): el carril reutiliza ese alto y NO vuelve a llamar `cardHeight`.
  const viewNodes = useMemo(
    () => buildViewNodes(stableGraph.nodes, overrides, null, false),
    [stableGraph.nodes, overrides],
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
    // El carril manda el `y` (alto acumulado); el `x` sigue siendo el de la
    // columna dentro del nivel. El resaltado de linaje/hover va por contexto, no
    // por `style`, así el array se mantiene estable frente a la interacción.
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

    // Los nodos del gutter son de otro tipo (`gutter`); React Flow los admite
    // en el mismo array. El cast refleja que el genérico lo fija `onNodesChange`.
    return [
      ...positioned,
      ...buildGutterNodes(plan, rowLayout, statusByLevel, activeLevel),
    ] as unknown as TGraphNode[];
  }, [viewNodes, plan, rowLayout, statusByLevel, activeLevel]);

  const edges = useMemo<Edge[]>(
    () =>
      stableGraph.edges.map((edge) => {
        const column = plan.columnByNode[edge.source] ?? 0;
        // Reposo: gris visible (no `--border`, que se pierde en dark). El
        // resaltado de hover/linaje lo resuelve `InvocationEdge` por contexto.
        const color = 'hsl(var(--muted-foreground))';

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'invocation',
          data: { railX: executionRailX(column) },
          style: { stroke: color, strokeWidth: 1.25, opacity: 0.45 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 12,
            height: 12,
            color,
          },
        };
      }),
    [stableGraph.edges, plan.columnByNode],
  );

  // Medición de interacción por transición (contrato de instrumentación §4,
  // criterio P5): se marca al cambiar el foco y se mide en el commit siguiente
  // ("pintado siguiente"), nunca por frame. Los refs permiten ignorar el montaje.
  const previousHoverRef = useRef(hoveredNodeId);
  useEffect(() => {
    if (previousHoverRef.current === hoveredNodeId) return;
    previousHoverRef.current = hoveredNodeId;
    perfMark(INTERACTION_HOVER_MARK);
    perfMeasure(PERF_METRIC.interaction, INTERACTION_HOVER_MARK, {
      nodeCount: stableGraph.nodes.length,
      kind: 'hover',
    });
  }, [hoveredNodeId, stableGraph.nodes.length]);

  const previousSelectedRef = useRef(selectedNodeId);
  useEffect(() => {
    if (previousSelectedRef.current === selectedNodeId) return;
    previousSelectedRef.current = selectedNodeId;
    perfMark(INTERACTION_SELECT_MARK);
    perfMeasure(PERF_METRIC.interaction, INTERACTION_SELECT_MARK, {
      nodeCount: stableGraph.nodes.length,
      kind: 'select',
    });
  }, [selectedNodeId, stableGraph.nodes.length]);

  return (
    <ReactFlowProvider>
      <NodeFocusProvider value={focus}>
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
      </NodeFocusProvider>
    </ReactFlowProvider>
  );
};
