import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@app/test/renderWithProviders';
import { InspectorPanel } from '../InspectorPanel';
import type { TGraphNode } from '@app/Domains/Graph/Graph.entity';

const node: TGraphNode = {
  id: 'root',
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: 'root',
    title: 'Tarea raíz',
    createdAt: null,
    updatedAt: null,
    agentName: 'develop',
    directory: '/repo/opencode-agent-viz',
    model: { providerID: 'opencode', id: 'deepseek' },
    status: 'succeeded',
    retry: null,
    interruptReason: null,
    metrics: {
      durationMs: 3000,
      startedAt: 0,
      endedAt: 3000,
      cost: 0.02,
      tokens: null,
      invocations: 2,
      retryCount: 0,
      hasLoop: false,
      loopEvidence: [],
    },
    isRoot: true,
    currentTool: null,
    parallel: null,
  },
};

describe('InspectorPanel', () => {
  it('prompts to select a node when none is provided', () => {
    renderWithProviders(<InspectorPanel node={null} />);
    expect(
      screen.getByText('Selecciona un nodo del grafo para ver su detalle.'),
    ).toBeInTheDocument();
  });

  it('renders sections and empty states for a selected node', () => {
    renderWithProviders(<InspectorPanel node={node} />);
    expect(screen.getByText('Tarea raíz')).toBeInTheDocument();
    expect(screen.getByText('develop')).toBeInTheDocument();
    expect(screen.getByText('Modelo')).toBeInTheDocument();
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('opencode/deepseek')).toBeInTheDocument();
    expect(screen.getAllByText('Razonamiento').length).toBeGreaterThan(0);
    expect(screen.getByText('Métricas')).toBeInTheDocument();
    expect(screen.getByText('Sin tareas de subagente.')).toBeInTheDocument();
    expect(screen.getByText('Sin errores.')).toBeInTheDocument();
    expect(screen.getByText('ejecutado varias veces')).toBeInTheDocument();
  });

  it('shows the model variant as "Razonamiento"', () => {
    const withVariant: TGraphNode = {
      ...node,
      data: {
        ...node.data,
        model: {
          providerID: 'opencode-go',
          id: 'deepseek-v4.1-flash',
          variant: 'high',
        },
      },
    };

    renderWithProviders(<InspectorPanel node={withVariant} />);

    expect(
      screen.getByText('opencode-go/deepseek-v4.1-flash'),
    ).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('lists the peers that ran in parallel with the node', () => {
    const peer: TGraphNode = {
      ...node,
      id: 'peer',
      data: { ...node.data, title: 'Tarea hermana' },
    };

    renderWithProviders(
      <InspectorPanel node={node} parallelPeers={[peer]} />,
    );

    expect(screen.getByText('En paralelo (2)')).toBeInTheDocument();
    expect(screen.getByText('Tarea hermana')).toBeInTheDocument();
  });

  it('does not render the parallel section when there are no peers', () => {
    renderWithProviders(<InspectorPanel node={node} />);
    expect(screen.queryByText(/En paralelo/)).not.toBeInTheDocument();
  });

  it('renders the answers section with an explicit empty state', () => {
    renderWithProviders(<InspectorPanel node={node} />);

    expect(screen.getByText('Respuestas')).toBeInTheDocument();
    expect(screen.getByText('Sin respuestas todavía')).toBeInTheDocument();
  });

  it('toggles the reasoning visibility from the answers section', async () => {
    const user = userEvent.setup();
    renderWithProviders(<InspectorPanel node={node} />);

    const toggle = screen.getByRole('button', { name: /razonamiento/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(
      screen.getByRole('button', { name: /razonamiento/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('forwards onOpenHistory to the answers section button', async () => {
    const user = userEvent.setup();
    const onOpenHistory = vi.fn();
    renderWithProviders(
      <InspectorPanel node={node} onOpenHistory={onOpenHistory} />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Ver histórico completo' }),
    );

    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  });
});
