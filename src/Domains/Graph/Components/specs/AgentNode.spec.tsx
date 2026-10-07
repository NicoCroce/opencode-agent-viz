import { describe, expect, it } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { NODE_STATUS_LABEL } from '@app/Application/Helpers';
import { AgentNode } from '../AgentNode';
import type {
  TGraphNodeData,
  TNodeMetrics,
  TNodeStatus,
} from '../../Graph.entity';

const data: TGraphNodeData = {
  sessionId: 'root',
  title: 'Tarea de prueba',
  createdAt: null,
  updatedAt: null,
  agentName: 'develop',
  directory: '/repo/opencode-agent-viz',
  model: { providerID: 'opencode', id: 'deepseek' },
  status: 'running',
  retry: null,
  interruptReason: null,
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

const pad = (value: number): string => String(value).padStart(2, '0');

const stamp = (ms: number): string => {
  const date = new Date(ms);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const clock = (ms: number): string => {
  const date = new Date(ms);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const START = new Date(2024, 0, 15, 9, 5).getTime();
const END = new Date(2024, 0, 15, 17, 42).getTime();
const NEXT_RETRY = new Date(2024, 0, 15, 12, 34).getTime();

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

const ACTIVE_STATUSES: TNodeStatus[] = [
  'running',
  'retrying',
  'compacting',
  'waiting-permission',
  'waiting-input',
];

const INACTIVE_STATUSES: TNodeStatus[] = [
  'created',
  'succeeded',
  'failed',
  'interrupted',
];

describe('AgentNode', () => {
  it('renders the session title, metrics and current tool', () => {
    renderAgentNode();
    expect(screen.getByText('Tarea de prueba')).toBeInTheDocument();
    expect(screen.queryByText('develop')).not.toBeInTheDocument();
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

describe('AgentNode — título', () => {
  it('shows the session title instead of the agent name', () => {
    renderAgentNode();
    expect(screen.getByText('Tarea de prueba')).toBeInTheDocument();
    expect(screen.queryByText('develop')).not.toBeInTheDocument();
  });

  it('falls back to the agent name when the session has no title', () => {
    renderAgentNode({ data: withData({ title: null }) });
    expect(screen.getByText('develop')).toBeInTheDocument();
  });
});

describe('AgentNode — modelo', () => {
  it('renders provider/model and the variant tag', () => {
    renderAgentNode({
      data: withData({
        model: {
          providerID: 'opencode-go',
          id: 'deepseek-v4.1-flash',
          variant: 'high',
        },
      }),
    });

    expect(
      screen.getByText('opencode-go/deepseek-v4.1-flash'),
    ).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('hides the model line when the node has no model', () => {
    renderAgentNode({ data: withData({ model: null }) });
    expect(screen.queryByText('opencode/deepseek')).not.toBeInTheDocument();
  });
});

describe('AgentNode — consumo resumido', () => {
  it('renders tokens, cost and duration on one line', () => {
    renderAgentNode();
    expect(screen.getByText('1.5k tok')).toBeInTheDocument();
    expect(screen.getByText('$0.0200')).toBeInTheDocument();
    expect(screen.getByText('1m 23s')).toBeInTheDocument();
  });

  it('shows the model line but not the labeled sections', () => {
    renderAgentNode();
    expect(screen.queryByText('Modelo')).not.toBeInTheDocument();
    expect(screen.queryByText('Consumo')).not.toBeInTheDocument();
    expect(screen.getByText('opencode/deepseek')).toBeInTheDocument();
  });
});

describe('AgentNode — rango horario (US5)', () => {
  it('renders the start – end range from metrics.startedAt/endedAt alongside the duration', () => {
    renderWithNode('succeeded', { startedAt: START, endedAt: END });

    expect(
      screen.getByText(`${stamp(START)} – ${stamp(END)}`),
    ).toBeInTheDocument();
    // El rango convive con la duración existente; no la reemplaza.
    expect(screen.getByText('1m 23s')).toBeInTheDocument();
  });

  it.each<TNodeStatus>(ACTIVE_STATUSES)(
    'shows "inicio – en curso" while the node status is %s',
    (status) => {
      renderWithNode(status, { startedAt: START, endedAt: null });

      expect(
        screen.getByText(`${stamp(START)} – en curso`),
      ).toBeInTheDocument();
    },
  );

  it('prefers "en curso" over a present endedAt while running', () => {
    renderWithNode('running', { startedAt: START, endedAt: END });

    expect(
      screen.getByText(`${stamp(START)} – en curso`),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(`${stamp(START)} – ${stamp(END)}`),
    ).not.toBeInTheDocument();
  });

  it('shows "no disponible" for a missing endedAt when not running', () => {
    renderWithNode('succeeded', { startedAt: START, endedAt: null });

    expect(
      screen.getByText(`${stamp(START)} – no disponible`),
    ).toBeInTheDocument();
  });

  it('shows "no disponible" for a missing startedAt when not running', () => {
    renderWithNode('succeeded', { startedAt: null, endedAt: END });

    expect(
      screen.getByText(`no disponible – ${stamp(END)}`),
    ).toBeInTheDocument();
  });

  it('shows "no disponible" on both ends when both timestamps are missing', () => {
    renderWithNode('succeeded', { startedAt: null, endedAt: null });

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

describe('AgentNode — estado enriquecido (US3, FR-017/FR-023)', () => {
  it.each<TNodeStatus>(Object.keys(NODE_STATUS_LABEL) as TNodeStatus[])(
    'renders the %s label',
    (status) => {
      renderAgentNode({ data: withData({ status }) });
      expect(screen.getByText(NODE_STATUS_LABEL[status])).toBeInTheDocument();
    },
  );

  it('shows a progress pulse while the execution is active (FR-022)', () => {
    for (const status of ACTIVE_STATUSES) {
      const { unmount } = renderAgentNode({ data: withData({ status }) });
      const pulse = screen.getByTestId('agent-progress');
      expect(pulse).toBeInTheDocument();
      expect(pulse).toHaveClass('animate-pulse');
      // La señal es puramente visual: no depende del texto en generación.
      expect(pulse).toHaveAttribute('aria-hidden');
      unmount();
    }
  });

  it('does not show a progress pulse once the execution is not active', () => {
    for (const status of INACTIVE_STATUSES) {
      const { unmount } = renderAgentNode({ data: withData({ status }) });
      expect(screen.queryByTestId('agent-progress')).not.toBeInTheDocument();
      unmount();
    }
  });
});

describe('AgentNode — reintento (US3, FR-018)', () => {
  it('shows the attempt number and the next attempt moment', () => {
    renderAgentNode({
      data: withData({
        status: 'retrying',
        retry: { attempt: 2, next: NEXT_RETRY },
      }),
    });

    expect(
      screen.getByText(`Intento 2 · próximo ${clock(NEXT_RETRY)}`),
    ).toBeInTheDocument();
  });

  it('shows "no disponible" for the next attempt when the server omits it', () => {
    renderAgentNode({
      data: withData({
        status: 'retrying',
        retry: { attempt: 3, next: null },
      }),
    });

    expect(
      screen.getByText('Intento 3 · próximo no disponible'),
    ).toBeInTheDocument();
  });

  it('does not show retry details when there is no retry', () => {
    renderAgentNode({ data: withData({ status: 'running', retry: null }) });
    expect(screen.queryByText(/Intento/)).not.toBeInTheDocument();
  });
});

describe('AgentNode — interrupción (US3, FR-019)', () => {
  it('shows the interruption reason', () => {
    renderAgentNode({
      data: withData({
        status: 'interrupted',
        interruptReason: 'Cancelada por el usuario',
      }),
    });

    expect(
      screen.getByText('Motivo: Cancelada por el usuario'),
    ).toBeInTheDocument();
  });

  it('shows "no disponible" when the interruption reason is missing', () => {
    renderAgentNode({
      data: withData({ status: 'interrupted', interruptReason: null }),
    });

    expect(screen.getByText('Motivo: no disponible')).toBeInTheDocument();
  });

  it('does not show an interruption reason while the execution is not interrupted', () => {
    renderAgentNode({
      data: withData({ status: 'failed', interruptReason: 'Cancelada' }),
    });

    expect(screen.queryByText(/Motivo:/)).not.toBeInTheDocument();
  });
});
