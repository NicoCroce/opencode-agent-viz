import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EMPTY_METRICS, type TNodeStatus } from '../../Graph.entity';
import type { TSessionSummary } from '../../../Inspector/Inspector.entity';
import { SessionSummaryBar } from '../SessionSummaryBar';

const summary = (overrides: Partial<TSessionSummary> = {}): TSessionSummary => ({
  rootSessionId: 'ses_root',
  metrics: {
    ...EMPTY_METRICS,
    cost: 0.0123,
    tokens: {
      input: 12_000,
      output: 400,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
  },
  agentCount: 4,
  subagentCount: 3,
  createdCount: 0,
  runningCount: 0,
  retryingCount: 0,
  compactingCount: 0,
  waitingCount: 0,
  succeededCount: 0,
  errorCount: 0,
  interruptedCount: 0,
  loopCount: 0,
  agentInvocations: {},
  resourceUsage: {
    mcpServers: [],
    instructions: [],
    skills: [],
    tools: [],
    availability: 'available',
  },
  elapsedMs: 83_000,
  ...overrides,
});

const renderBar = (overrides: Partial<TSessionSummary> = {}) =>
  render(<SessionSummaryBar summary={summary(overrides)} />);

const counter = (status: TNodeStatus): HTMLElement | null =>
  document.querySelector(`[data-status="${status}"]`);

describe('SessionSummaryBar', () => {
  it('shows the always-visible counters with their counts (FR-024)', () => {
    renderBar({ runningCount: 2, waitingCount: 1, errorCount: 1 });

    expect(counter('running')).toHaveTextContent('2');
    expect(counter('running')).toHaveTextContent('En curso');
    expect(counter('waiting-permission')).toHaveTextContent('1');
    expect(counter('waiting-permission')).toHaveTextContent('Esperando');
    expect(counter('failed')).toHaveTextContent('Fallida');
  });

  it('renders optional counters only when they have agents', () => {
    renderBar({ runningCount: 1, succeededCount: 0, retryingCount: 0 });

    expect(counter('running')).not.toBeNull();
    expect(counter('succeeded')).toBeNull();
    expect(counter('retrying')).toBeNull();
  });

  it('renders every extra counter when present', () => {
    renderBar({
      retryingCount: 1,
      compactingCount: 2,
      succeededCount: 3,
      interruptedCount: 4,
      createdCount: 5,
    });

    expect(counter('retrying')).toHaveTextContent('Reintentando');
    expect(counter('compacting')).toHaveTextContent('Compactando');
    expect(counter('succeeded')).toHaveTextContent('3');
    expect(counter('interrupted')).toHaveTextContent('Interrumpida');
    expect(counter('created')).toHaveTextContent('Creada');
  });

  it('groups both waiting states under a single "Esperando" counter', () => {
    renderBar({ waitingCount: 3 });

    expect(screen.getAllByText('Esperando')).toHaveLength(1);
    expect(counter('waiting-permission')).toHaveTextContent('3');
  });

  it('never counts an interruption as an error (FR-019)', () => {
    renderBar({ errorCount: 1, interruptedCount: 2 });

    expect(counter('failed')).toHaveTextContent('1');
    expect(counter('interrupted')).toHaveTextContent('2');
  });

  it('formats cost, tokens and elapsed time with the shared helpers', () => {
    renderBar();

    expect(screen.getByText('$0.0123')).toBeInTheDocument();
    expect(screen.getByText('12.4k')).toBeInTheDocument();
    expect(screen.getByText('1m 23s')).toBeInTheDocument();
  });

  it('shows "no disponible" for every missing datum (FR-038)', () => {
    renderBar({
      metrics: { ...EMPTY_METRICS, cost: null, tokens: null },
      elapsedMs: null,
    });

    expect(screen.getAllByLabelText('no disponible')).toHaveLength(3);
  });
});
