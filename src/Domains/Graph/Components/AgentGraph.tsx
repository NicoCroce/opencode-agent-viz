import { useEffect } from 'react';
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
import { NODE_HEIGHT, NODE_WIDTH } from '../lib/layoutGraph';
import type { TGraphModel } from '../Graph.entity';
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

interface AgentGraphProps {
  graph: TGraphModel;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  followNodeId?: string | null;
  className?: string;
}

export const AgentGraph = ({
  graph,
  selectedNodeId,
  onSelectNode,
  followNodeId = null,
  className,
}: AgentGraphProps) => (
  <ReactFlowProvider>
    <div className={cn('h-full w-full', className)}>
      <ReactFlow
        nodes={graph.nodes.map((node) => ({
          ...node,
          selected: node.id === selectedNodeId,
        }))}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        minZoom={0.2}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => onSelectNode(node.id)}
      >
        <Background gap={16} color="#232A34" />
        <Controls showInteractive={false} />
      </ReactFlow>
      <FollowController nodeId={followNodeId} />
    </div>
  </ReactFlowProvider>
);
