import {
  Background,
  Controls,
  Panel,
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
import { GraphViewToggle } from './GraphViewToggle';
import { GRAPH_VIEW_MODE, type TGraphViewMode } from '../lib/graphViewMode';

const nodeTypes = {
  agent: AgentNode,
  [GUTTER_NODE_TYPE]: GutterNode,
} as unknown as NodeTypes;

const edgeTypes = {
  invocation: InvocationEdge,
} as unknown as EdgeTypes;

/**
 * Controles de zoom con la receta de botón-icono (32 px, `rounded-lg`, borde y
 * fondo `--muted`, hover cyan): las variables `--xy-controls-*` recolorean y los
 * selectores `[&>button]` ajustan tamaño, radio y separación sin tocar el CSS
 * global. El borde va con `!` porque React Flow lo quita en el último botón.
 */
const CONTROLS_CLASS = [
  'gap-1.5',
  '[--xy-controls-box-shadow:none]',
  '[--xy-controls-button-background-color:hsl(var(--muted))]',
  '[--xy-controls-button-background-color-hover:hsl(var(--accent)/0.1)]',
  '[--xy-controls-button-color:hsl(var(--muted-foreground))]',
  '[--xy-controls-button-color-hover:hsl(var(--accent))]',
  '[--xy-controls-button-border-color:hsl(var(--border))]',
  '[&>button]:size-8',
  '[&>button]:rounded-lg',
  '[&>button]:border!',
  '[&>button]:border-border',
  '[&>button]:p-2',
  '[&>button>svg]:max-h-3.5',
  '[&>button>svg]:max-w-3.5',
].join(' ');

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
  /**
   * Ids de nodos con un pendiente de atención (FR-009). Se publica por contexto
   * hasta `NodeFocusProvider` para realzar solo el nodo afectado, sin tocar
   * `data` ni re-layoutar (Principio VII / FR-016).
   */
  attentionNodeIds?: ReadonlySet<string>;
  /**
   * Vista del lienzo: `graph` (árbol de invocación) o `lanes` (niveles de
   * ejecución con gutter y bandas). Por defecto, carriles.
   */
  viewMode?: TGraphViewMode;
  /** Si se aporta, muestra el selector Grafo | Carriles en la esquina del lienzo. */
  onViewModeChange?: (mode: TGraphViewMode) => void;
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
  attentionNodeIds,
  viewMode = GRAPH_VIEW_MODE.LANES,
  onViewModeChange,
  className,
}: AgentGraphProps) => {
  const isLanes = viewMode === GRAPH_VIEW_MODE.LANES;
  const { overrides, onNodesChange } = useNodeResize(resetKey);
  const { graph: stableGraph, signature } = useStableGraphModel(graph);
  const { hoveredNodeId, setHoveredNodeId, focus } = useGraphFocusModel(
    stableGraph,
    selectedNodeId,
    attentionNodeIds,
  );
  const { rowLayout, activeLevel, nodes, edges, anchorX } = useGraphLayoutModel(
    stableGraph,
    plan,
    overrides,
    viewMode,
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
            // Sin `fitView` propio: el encuadre inicial lo hace
            // `FitViewController` (legible desde arriba en grafos altos) y el
            // de React Flow lo pisaría al medir los nodos.
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
            <Background gap={20} size={1.2} color="hsl(var(--border))" />
            <Controls showInteractive={false} className={CONTROLS_CLASS} />
            {isLanes ? (
              <ExecutionLanes
                plan={plan}
                rowLayout={rowLayout}
                activeLevel={activeLevel}
              />
            ) : null}
            {onViewModeChange ? (
              <Panel position="top-left">
                <GraphViewToggle mode={viewMode} onChange={onViewModeChange} />
              </Panel>
            ) : null}
          </ReactFlow>
          {/* La vista entra en la firma: cambiar de vista reencuadra. */}
          <FitViewController
            signature={`${viewMode}:${signature}`}
            anchorX={anchorX}
          />
          <FollowController nodeId={followNodeId} />
        </div>
      </NodeFocusProvider>
    </ReactFlowProvider>
  );
};
