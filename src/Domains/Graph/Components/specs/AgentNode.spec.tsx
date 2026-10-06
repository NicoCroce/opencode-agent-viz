import { describe, expect, it } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { AgentNode } from '../AgentNode';
import type {
  TGraphNodeData,
  TNodeMetrics,
  TNodeStatus,
} from '../../Graph.entity';

const data: TGraphNodeData = {
  sessionId: 'root',
  createdAt: null,
  updatedAt: null,
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
  parallel: null,
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

const renderAgentNode = (overrides: Partial<ComponentProps<typeof AgentNode>> = {}) =>
  render(
    <ReactFlowProvider>
      <AgentNode {...props} {...overrides} />
    </ReactFlowProvider>,
  );

const clock = (ms: number): string =>
  new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

const START = new Date(2024, 0, 15, 9, 5).getTime();
const END = new Date(2024, 0, 15, 17, 42).getTime();

const withData = (overrides: Partial<TGraphNodeData> = {}): TGraphNodeData => ({
  ...data,
  ...overrides,
});

const withMetrics = (overrides: Partial<TNodeMetrics> = {}): TNodeMetrics => ({
  ...data.metrics,
  ...overrides,
});

const renderWithNode = (
  status: TNodeStatus,
  metrics: Partial<TNodeMetrics>,
) => renderAgentNode({ data: withData({ status, metrics: withMetrics(metrics) }) });

describe('AgentNode', () => {
  it('renders the agent, model, metrics and current tool', () => {
    renderAgentNode();
    expect(screen.getByText('develop')).toBeInTheDocument();
    expect(screen.getByText('opencode/deepseek')).toBeInTheDocument();
    expect(screen.getByText('1m 23s')).toBeInTheDocument();
    expect(screen.getByText('bash')).toBeInTheDocument();
  });

  it('renders the NodeResizer resize controls', () => {
    const { container } = renderAgentNode();
    const controls = container.querySelectorAll('.react-flow__resize-control');
    expect(controls.length).toBeGreaterThan(0);
    expect(container.querySelector('.react-flow__resize-control.line')).toBeInTheDocument();
    expect(container.querySelector('.react-flow__resize-control.handle')).toBeInTheDocument();
  });

  it('uses border-accent on the selected node while a non-selected ancestor does not', () => {
    const selected = renderAgentNode({ selected: true });
    const selectedNode = selected.container.querySelector('.border-accent');
    expect(selectedNode).toBeInTheDocument();
    expect(selectedNode).toHaveClass('border-accent');

    const ancestor = renderAgentNode({ selected: false });
    expect(ancestor.container.querySelector('.border-accent')).toBeNull();
    expect(ancestor.container.querySelector('.border-border')).toBeInTheDocument();
  });
});

describe('AgentNode — rango horario (US5)', () => {
  it('renders the start – end range from metrics.startedAt/endedAt alongside the duration', () => {
    renderWithNode('done', { startedAt: START, endedAt: END });

    expect(
      screen.getByText(`${clock(START)} – ${clock(END)}`),
    ).toBeInTheDocument();
    // El rango convive con la duración existente; no la reemplaza.
    expect(screen.getByText('1m 23s')).toBeInTheDocument();
  });

  it.each<TNodeStatus>(['running', 'waiting'])(
    'shows "inicio – en curso" while the node status is %s',
    (status) => {
      renderWithNode(status, { startedAt: START, endedAt: null });

      expect(
        screen.getByText(`${clock(START)} – en curso`),
      ).toBeInTheDocument();
    },
  );

  it('prefers "en curso" over a present endedAt while running', () => {
    renderWithNode('running', { startedAt: START, endedAt: END });

    expect(
      screen.getByText(`${clock(START)} – en curso`),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(`${clock(START)} – ${clock(END)}`),
    ).not.toBeInTheDocument();
  });

  it('shows "no disponible" for a missing endedAt when not running', () => {
    renderWithNode('done', { startedAt: START, endedAt: null });

    expect(
      screen.getByText(`${clock(START)} – no disponible`),
    ).toBeInTheDocument();
  });

  it('shows "no disponible" for a missing startedAt when not running', () => {
    renderWithNode('done', { startedAt: null, endedAt: END });

    expect(
      screen.getByText(`no disponible – ${clock(END)}`),
    ).toBeInTheDocument();
  });

  it('shows "no disponible" on both ends when both timestamps are missing', () => {
    renderWithNode('done', { startedAt: null, endedAt: null });

    expect(
      screen.getByText('no disponible – no disponible'),
    ).toBeInTheDocument();
  });
});

describe('AgentNode — paralelismo', () => {
  it('renders the parallel badge with the group size', () => {
    renderAgentNode({
      data: withData({ parallel: { groupId: 'g', size: 4 } }),
    });

    const badge = screen.getByText('∥4');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute(
      'title',
      '4 agentes ejecutados en paralelo',
    );
    expect(badge).toHaveClass('text-foreground');
  });

  it('does not render a badge when the node ran alone', () => {
    renderAgentNode({ data: withData({ parallel: null }) });
    expect(screen.queryByText(/∥/)).not.toBeInTheDocument();
  });

  it('does not render a badge for a group of one', () => {
    renderAgentNode({
      data: withData({ parallel: { groupId: 'g', size: 1 } }),
    });
    expect(screen.queryByText(/∥/)).not.toBeInTheDocument();
  });
});
