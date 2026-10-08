import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@app/Application/lib/utils';
import type { TGraphModel } from '../Graph.entity';
import type { TExecutionPlan } from '../lib/executionLevels';
import { useGraphFocusModel } from '../Hooks/useGraphFocusModel';
import { useGraphLayoutModel } from '../Hooks/useGraphLayoutModel';
import { useInteractionPerf } from '../Hooks/useInteractionPerf';
import { useNodeResize } from '../Hooks/useNodeResize';
import { useStableGraphModel } from '../Hooks/useStableGraphModel';
import { AgentNode } from './AgentNode';
import { ExecutionLanes } from './ExecutionLanes';
import { GUTTER_NODE_TYPE, GutterNode, isGutterNode } from './GutterNode';
import { InvocationEdge } from './InvocationEdge';
import { NodeFocusProvider } from './NodeFocusContext';
import { FitViewController, FollowController } from './ViewportControllers';

const nodeTypes = {
  agent: AgentNode,
  [GUTTER_NODE_TYPE]: GutterNode,
} as unknown as NodeTypes;

const edgeTypes = {
  invocation: InvocationEdge,
} as unknown as EdgeTypes;

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
   * Doble clic en un nodo `agent`: abre el histórico de su sesión (FR-008) con
   * el `node.id` (la sesión). El clic simple sigue seleccionando (`onSelectNode`).
   */
  onOpenHistory?: (nodeId: string) => void;
  followNodeId?: string | null;
  /** Sesión raíz: al cambiar se limpian los tamaños elegidos por el usuario. */
  resetKey?: string | null;
  className?: string;
}

/**
 * Orquestación del grafo React Flow. Toda la derivación vive en hooks puros
 * (`Hooks/`); aquí solo se conectan y se renderiza (contrato de render §1).
 */
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
  const { graph: stableGraph, signature } = useStableGraphModel(graph);
  const { hoveredNodeId, setHoveredNodeId, focus } = useGraphFocusModel(
    stableGraph,
    selectedNodeId,
  );
  const { rowLayout, activeLevel, nodes, edges } = useGraphLayoutModel(
    stableGraph,
    plan,
    overrides,
  );
  useInteractionPerf({
    hoveredNodeId,
    selectedNodeId,
    nodeCount: stableGraph.nodes.length,
  });

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
              if (isGutterNode(node)) return;
              onSelectNode(node.id);
            }}
            onNodeDoubleClick={(_, node) => {
              if (isGutterNode(node)) return;
              onOpenHistory?.(node.id);
            }}
            onNodeMouseEnter={(_, node) => {
              if (isGutterNode(node)) return;
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
