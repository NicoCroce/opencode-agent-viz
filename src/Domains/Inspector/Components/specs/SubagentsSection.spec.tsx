import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';
import type { TTaskEntry } from '../../Inspector.entity';
import { SubagentsSection } from '../SubagentsSection';

const task = (overrides: Partial<TTaskEntry> = {}): TTaskEntry => ({
  id: 'task-1',
  description: 'Revisar el contrato de la API',
  agent: 'blendverse-reviewer',
  status: 'running',
  sessionID: 'child-1',
  ...overrides,
});

const peer = (overrides: Partial<TGraphNode> = {}): TGraphNode => ({
  id: 'peer-1',
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: 'peer-1',
    title: 'Agente en paralelo',
    createdAt: null,
    updatedAt: null,
    agentName: 'blendverse-front',
    directory: '/repo/opencode-agent-viz',
    model: { providerID: 'opencode', id: 'deepseek' },
    status: 'succeeded',
    retry: null,
    interruptReason: null,
    metrics: {
      durationMs: 1000,
      startedAt: 0,
      endedAt: 1000,
      cost: 0.01,
      tokens: null,
      invocations: 1,
      retryCount: 0,
      hasLoop: false,
      loopEvidence: [],
    },
    isRoot: false,
    currentTool: null,
    parallel: null,
  },
  ...overrides,
});

describe('SubagentsSection', () => {
  it('groups tasks and parallel peers under a single "Subagentes" header', () => {
    render(
      <SubagentsSection
        tasks={[task()]}
        parallelPeers={[peer()]}
      />,
    );

    // FR-007: un único encabezado agrupa ambos contenidos.
    expect(screen.getAllByText('Subagentes')).toHaveLength(1);
  });

  it('renders each delegated task with its status and description', () => {
    render(
      <SubagentsSection
        tasks={[
          task({ id: 'task-1', status: 'running', description: 'Tarea uno' }),
          task({ id: 'task-2', status: 'succeeded', description: 'Tarea dos' }),
        ]}
        parallelPeers={[]}
      />,
    );

    expect(screen.getByText('Tarea uno')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('Tarea dos')).toBeInTheDocument();
    expect(screen.getByText('succeeded')).toBeInTheDocument();
  });

  it('renders each parallel peer with a status dot and its title', () => {
    render(
      <SubagentsSection
        tasks={[]}
        parallelPeers={[
          peer({ id: 'peer-1', data: { ...peer().data, title: 'Peer uno' } }),
          peer({
            id: 'peer-2',
            data: {
              ...peer().data,
              title: 'Peer dos',
              status: 'running',
            },
          }),
        ]}
      />,
    );

    expect(screen.getByText('Peer uno')).toBeInTheDocument();
    expect(screen.getByText('Peer dos')).toBeInTheDocument();

    // StatusDot por peer: rol img con la etiqueta legible del estado (FR-023).
    expect(screen.getByRole('img', { name: 'Terminada' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'En curso' })).toBeInTheDocument();
  });

  it('shows an explicit empty state when there are no tasks nor peers (FR-008)', () => {
    render(<SubagentsSection tasks={[]} parallelPeers={[]} />);

    expect(screen.getByText('Subagentes')).toBeInTheDocument();
    expect(
      screen.getByText('Sin subagentes ni agentes en paralelo.'),
    ).toBeInTheDocument();
  });

  it('hides the empty state as soon as there is content', () => {
    render(
      <SubagentsSection tasks={[task()]} parallelPeers={[]} />,
    );

    expect(
      screen.queryByText('Sin subagentes ni agentes en paralelo.'),
    ).not.toBeInTheDocument();
  });
});
