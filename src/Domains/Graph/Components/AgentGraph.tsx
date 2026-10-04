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
import { NODE_HEIGHT, NODE_WIDTH, topologySignature } from '../lib/layoutGraph';
import { buildViewNodes } from '../lib/buildViewNodes';
import type { TGraphModel } from '../Graph.entity';
import { useNodeResize } from '../Hooks/useNodeResize';
import { AgentNode } from './AgentNode';

const nodeTypes = { agent: AgentNode } as unknown as NodeTypes;

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
 * Ajusta el viewport cuando cambia la firma de topología de la vista (grafo
 * completo ↔ cadena). React Flow solo hace `fitView` en el montaje, así que el
 * cambio de proyección necesita un ajuste explícito (FR-006). No relayouta el
 * grafo: solo encuadra los nodos ya posicionados (Principio VII).
 */
const FitViewController = ({
  signature,
  isChainMode,
}: {
  signature: string;
  isChainMode: boolean;
}) => {
  const { fitView } = useReactFlow();

  useEffect(() => {
    void fitView({ duration: 300, padding: isChainMode ? 0.15 : 0.1 });
  }, [signature, isChainMode, fitView]);

  return null;
};

interface AgentGraphProps {
  graph: TGraphModel;
  /** Selección explícita a resaltar; `null` = ningún nodo resaltado. */
  selectedNodeId: string | null;
  /** `true` cuando la vista muestra solo la cadena raíz→nodo. */
  isChainMode: boolean;
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
  selectedNodeId,
  isChainMode,
  onSelectNode,
  onClearSelection,
  followNodeId = null,
  resetKey = null,
  className,
}: AgentGraphProps) => {
  const { overrides, onNodesChange } = useNodeResize(resetKey);
  const signature = useMemo(() => topologySignature(graph), [graph]);

  const nodes = useMemo(
    () => buildViewNodes(graph.nodes, overrides, selectedNodeId, isChainMode),
    [graph.nodes, overrides, selectedNodeId, isChainMode],
  );

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
          onNodeClick={(_, node) => onSelectNode(node.id)}
          onPaneClick={onClearSelection}
        >
          <Background gap={16} color="#232A34" />
          <Controls showInteractive={false} />
        </ReactFlow>
        <FitViewController signature={signature} isChainMode={isChainMode} />
        <FollowController nodeId={followNodeId} />
      </div>
    </ReactFlowProvider>
  );
};
