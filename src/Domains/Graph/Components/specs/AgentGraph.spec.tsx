import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TGraphModel, TGraphNodeData } from '../../Graph.entity';
import type { TExecutionPlan } from '../../lib/executionLevels';

/**
 * `AgentGraph` orquesta React Flow; el comportamiento de T039 (doble clic →
 * histórico, clic simple → selección) se verifica sustituyendo `ReactFlow` por
 * un stub que expone los mismos handlers con nodos en el DOM. Así el test es
 * estable en jsdom y no depende de la medición interna del viewport.
 */
vi.mock('@xyflow/react', async () => {
  const React = await import('react');

  interface MockNode {
    id: string;
    type?: string;
  }

  interface MockReactFlowProps {
    nodes: MockNode[];
    onNodeClick?: (event: unknown, node: MockNode) => void;
    onNodeDoubleClick?: (event: unknown, node: MockNode) => void;
    onNodeMouseEnter?: (event: unknown, node: MockNode) => void;
    onPaneClick?: () => void;
  }

  return {
    ReactFlow: ({
      nodes,
      onNodeClick,
      onNodeDoubleClick,
      onNodeMouseEnter,
      onPaneClick,
    }: MockReactFlowProps) =>
      React.createElement(
        'div',
        { 'data-testid': 'react-flow' },
        nodes.map((node) =>
          React.createElement(
            'button',
            {
              key: node.id,
              type: 'button',
              'data-testid': `node-${node.id}`,
              'data-node-type': String(node.type),
              onClick: () => onNodeClick?.({}, node),
              onDoubleClick: () => onNodeDoubleClick?.({}, node),
              onMouseEnter: () => onNodeMouseEnter?.({}, node),
            },
            node.id,
          ),
        ),
        React.createElement('button', {
          key: 'pane',
          type: 'button',
          'data-testid': 'pane',
          onClick: () => onPaneClick?.(),
        }),
      ),
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Background: () => null,
    Controls: () => null,
    MarkerType: { ArrowClosed: 'arrowclosed' },
    useReactFlow: () => ({
      getNode: () => null,
      setCenter: () => undefined,
      fitView: () => undefined,
    }),
  };
});

import { AgentGraph } from '../AgentGraph';

const data: TGraphNodeData = {
  sessionId: 'root',
  title: 'Tarea de prueba',
  createdAt: 0,
  updatedAt: 1,
  agentName: 'develop',
  directory: '/repo/opencode-agent-viz',
  model: null,
  status: 'succeeded',
  retry: null,
  interruptReason: null,
  metrics: {
    durationMs: null,
    startedAt: null,
    endedAt: null,
    cost: null,
    tokens: null,
    invocations: 1,
    retryCount: 0,
    hasLoop: false,
    loopEvidence: [],
  },
  isRoot: true,
  currentTool: null,
  parallel: null,
};

const graph: TGraphModel = {
  nodes: [{ id: 'root', type: 'agent', position: { x: 0, y: 0 }, data }],
  edges: [],
};

const plan: TExecutionPlan = {
  levels: [
    { level: 0, nodeIds: ['root'], startedAt: 0, endedAt: 1, parallel: false },
  ],
  levelByNode: { root: 0 },
  columnByNode: { root: 0 },
  width: 300,
};

interface RenderGraphOptions {
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
  onClearSelection?: () => void;
  onOpenHistory?: (nodeId: string) => void;
  followNodeId?: string | null;
  resetKey?: string | null;
}

const renderGraph = ({
  selectedNodeId = null,
  onSelectNode = vi.fn(),
  onClearSelection = vi.fn(),
  onOpenHistory = vi.fn(),
  followNodeId = null,
  resetKey = null,
}: RenderGraphOptions = {}) =>
  render(
    <AgentGraph
      graph={graph}
      plan={plan}
      selectedNodeId={selectedNodeId}
      onSelectNode={onSelectNode}
      onClearSelection={onClearSelection}
      onOpenHistory={onOpenHistory}
      followNodeId={followNodeId}
      resetKey={resetKey}
    />,
  );

describe('AgentGraph — apertura del histórico (T039)', () => {
  it('opens the history of the double-clicked agent node', async () => {
    const user = userEvent.setup();
    const onOpenHistory = vi.fn();
    renderGraph({ onOpenHistory });

    await user.dblClick(screen.getByTestId('node-root'));

    expect(onOpenHistory).toHaveBeenCalledTimes(1);
    expect(onOpenHistory).toHaveBeenCalledWith('root');
  });

  it('keeps the simple click selecting the node and does not open the history', async () => {
    const user = userEvent.setup();
    const onSelectNode = vi.fn();
    const onOpenHistory = vi.fn();
    renderGraph({ onSelectNode, onOpenHistory });

    await user.click(screen.getByTestId('node-root'));

    expect(onSelectNode).toHaveBeenCalledTimes(1);
    expect(onSelectNode).toHaveBeenCalledWith('root');
    expect(onOpenHistory).not.toHaveBeenCalled();
  });

  it('ignores the double click on a gutter node', async () => {
    const user = userEvent.setup();
    const onOpenHistory = vi.fn();
    renderGraph({ onOpenHistory });

    const gutter = screen.getByTestId('node-gutter-0');
    expect(gutter).toHaveAttribute('data-node-type', 'gutter');
    await user.dblClick(gutter);

    expect(onOpenHistory).not.toHaveBeenCalled();
  });

  it('still clears the selection on a pane click', async () => {
    const user = userEvent.setup();
    const onClearSelection = vi.fn();
    renderGraph({ onClearSelection });

    await user.click(screen.getByTestId('pane'));

    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('renders with follow and reset keys without breaking selection', () => {
    renderGraph({
      selectedNodeId: 'root',
      followNodeId: 'root',
      resetKey: 'root',
    });

    expect(screen.getByTestId('node-root')).toBeInTheDocument();
  });
});
