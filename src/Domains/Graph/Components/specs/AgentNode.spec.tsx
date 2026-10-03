import { describe, expect, it } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { AgentNode } from '../AgentNode';
import type { TGraphNodeData } from '../../Graph.entity';

const data: TGraphNodeData = {
  sessionId: 'root',
  agentName: 'develop',
  directory: '/repo/opencode-agent-viz',
  model: { providerID: 'opencode', id: 'deepseek' },
  status: 'running',
  metrics: {
    durationMs: 83_000,
    startedAt: 0,
    endedAt: 83_000,
    cost: 0.02,
    tokens: { input: 1200, output: 300, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
    invocations: 1,
    retryCount: 0,
    hasLoop: false,
    loopEvidence: [],
  },
  isRoot: true,
  currentTool: { name: 'bash', state: 'running' },
};

const props = {
  id: 'root',
  type: 'agent',
  data,
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
} as unknown as ComponentProps<typeof AgentNode>;

describe('AgentNode', () => {
  it('renders the agent, model, metrics and current tool', () => {
    render(
      <ReactFlowProvider>
        <AgentNode {...props} />
      </ReactFlowProvider>,
    );
    expect(screen.getByText('develop')).toBeInTheDocument();
    expect(screen.getByText('opencode/deepseek')).toBeInTheDocument();
    expect(screen.getByText('1m 23s')).toBeInTheDocument();
    expect(screen.getByText('bash')).toBeInTheDocument();
  });
});
