import { useEffect, useMemo } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@app/Application/lib/utils';
import {
  NODE_CARD_HEIGHT,
  NODE_HEIGHT,
  NODE_WIDTH,
  topologySignature,
} from '../lib/layoutGraph';
import { buildViewNodes } from '../lib/buildViewNodes';
import type { TGraphModel, TGraphNode, TNodeStatus } from '../Graph.entity';
import {
  EXECUTION_ROW_PAD,
  deriveRowLayout,
  type TExecutionPlan,
} from '../lib/executionLevels';
import { useNodeResize } from '../Hooks/useNodeResize';
import { AgentNode } from './AgentNode';
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

const STATUS_RANK: Record<TNodeStatus, number> = {
  idle: 0,
  done: 1,
  error: 2,
  waiting: 3,
  running: 4,
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
  followNodeId = null,
  resetKey = null,
  className,
}: AgentGraphProps) => {
  const { overrides, onNodesChange } = useNodeResize(resetKey);
  const signature = useMemo(() => topologySignature(graph), [graph]);

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
    const active = graph.nodes.find(
      (node) => node.data.status === 'running' || node.data.status === 'waiting',
    );
    return active ? (plan.levelByNode[active.id] ?? null) : null;
  }, [graph.nodes, plan]);

  // Alto real de cada nodo: el override de resize o el alto base de la card,
  // para que el carril acompañe al nodo.
  const heightByNode = useMemo(() => {
    const map: Record<string, number> = {};
    for (const node of graph.nodes) {
      map[node.id] = overrides[node.id]?.height ?? NODE_CARD_HEIGHT;
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
    // columna dentro del nivel.
    const positioned = agentNodes.map((node) => {
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
  }, [
    graph.nodes,
    overrides,
    selectedNodeId,
    plan,
    rowLayout,
    statusByLevel,
    activeLevel,
  ]);

  return (
    <ReactFlowProvider>
      <div className={cn('h-full w-full', className)}>
        <ReactFlow
          nodes={nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
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
