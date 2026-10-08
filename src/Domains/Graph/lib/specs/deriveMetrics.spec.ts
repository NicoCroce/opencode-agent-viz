import { describe, expect, it } from 'vitest';
import type {
  SessionInfo,
  SessionMessageAssistant,
  SessionStatus,
} from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { TResourceUsage } from '@app/Domains/Inspector/Inspector.entity';
import {
  EMPTY_METRICS,
  type TGraphModel,
  type TGraphNode,
  type TMetricBase,
  type TNodeMetrics,
  type TNodeStatus,
} from '../../Graph.entity';
import {
  deriveMetricBase,
  deriveMetrics,
  resolveMetrics,
  summarizeSession,
} from '../deriveMetrics';

const tokens = (
  input: number,
  output: number,
  reasoning = 0,
  cacheRead = 0,
  cacheWrite = 0,
) => ({
  input,
  output,
  reasoning,
  cache: { read: cacheRead, write: cacheWrite },
});

const assistant = (
  overrides: Partial<SessionMessageAssistant> = {},
): SessionMessageAssistant => ({
  id: 'msg_1',
  time: { created: 1000, completed: 4000 },
  type: 'assistant',
  agent: 'develop',
  model: { providerID: 'opencode', id: 'deepseek' },
  content: [],
  cost: 0.02,
  tokens: tokens(100, 50, 10, 5, 2),
  ...overrides,
});

const message = (
  overrides: Partial<SessionMessageAssistant> = {},
): TSessionMessage => {
  const info = assistant(overrides);
  return { info, parts: info.content };
};

const toolPart = (
  name: string,
  status: string,
): SessionMessageAssistant['content'][number] =>
  ({
    type: 'tool',
    id: 'tool_1',
    name,
    state: { status },
  }) as unknown as SessionMessageAssistant['content'][number];

describe('deriveMetrics', () => {
  it('computes a fixed duration when the assistant message completed', () => {
    const metrics = deriveMetrics({ messages: [message()], now: 9999 });
    expect(metrics.durationMs).toBe(3000);
    expect(metrics.startedAt).toBe(1000);
    expect(metrics.endedAt).toBe(4000);
  });

  it('computes a live duration when completed is missing', () => {
    const metrics = deriveMetrics({
      messages: [message({ time: { created: 1000 } })],
      now: 5000,
    });
    expect(metrics.durationMs).toBe(4000);
    expect(metrics.endedAt).toBeNull();
  });

  it('sums cost and tokens from assistant messages', () => {
    const metrics = deriveMetrics({ messages: [message()], now: 4000 });
    expect(metrics.cost).toBeCloseTo(0.02, 5);
    expect(metrics.tokens).toEqual({
      input: 100,
      output: 50,
      reasoning: 10,
      cacheRead: 5,
      cacheWrite: 2,
    });
  });

  it('returns null metrics when there is no data', () => {
    const metrics = deriveMetrics({ messages: [], now: 1000 });
    expect(metrics.durationMs).toBeNull();
    expect(metrics.cost).toBeNull();
    expect(metrics.tokens).toBeNull();
    expect(metrics.hasLoop).toBe(false);
  });

  it('marks a loop on an assistant retry and records evidence', () => {
    const metrics = deriveMetrics({
      messages: [
        message({
          retry: {
            attempt: 2,
            at: 1500,
            error: { type: 'api', message: 'rate limited' },
          },
        }),
      ],
      now: 4000,
    });
    expect(metrics.retryCount).toBe(1);
    expect(metrics.hasLoop).toBe(true);
    expect(metrics.loopEvidence).toContain('rate limited');
  });

  it('counts invocations from subtask invocations', () => {
    const metrics = deriveMetrics({
      messages: [message()],
      now: 4000,
      subtaskInvocations: 3,
    });
    expect(metrics.invocations).toBe(3);
  });

  it('does not mark a loop from high invocation counts alone', () => {
    const metrics = deriveMetrics({
      messages: [message()],
      now: 4000,
      subtaskInvocations: 12,
    });
    expect(metrics.hasLoop).toBe(false);
  });
});

describe('deriveMetricBase', () => {
  it('derives the clock-independent base from messages', () => {
    const base = deriveMetricBase([
      message({ time: { created: 1000, completed: 4000 } }),
    ]);

    expect(base.startedAt).toBe(1000);
    expect(base.endedAt).toBe(4000);
    expect(base.cost).toBeCloseTo(0.02, 5);
    expect(base.tokens).toEqual({
      input: 100,
      output: 50,
      reasoning: 10,
      cacheRead: 5,
      cacheWrite: 2,
    });
    expect(base.retryCount).toBe(0);
    expect(base.hasLoop).toBe(false);
    expect(base.loopEvidence).toEqual([]);
  });

  it('does not resolve the duration (clock-independent)', () => {
    const base = deriveMetricBase([message()]);

    expect('durationMs' in base).toBe(false);
  });

  it('is stable across calls for the same messages', () => {
    const messages = [message()];

    expect(deriveMetricBase(messages)).toEqual(deriveMetricBase(messages));
  });

  it('keeps null metrics without assistant messages', () => {
    const base = deriveMetricBase([]);

    expect(base.startedAt).toBeNull();
    expect(base.endedAt).toBeNull();
    expect(base.cost).toBeNull();
    expect(base.tokens).toBeNull();
  });

  it('exposes model, currentTool and lastAssistantErrored', () => {
    const base = deriveMetricBase([
      message({ content: [toolPart('read', 'completed')] }),
    ]);

    expect(base.model).toEqual({ providerID: 'opencode', id: 'deepseek' });
    expect(base.currentTool).toEqual({ name: 'read', state: 'completed' });
    expect(base.lastAssistantErrored).toBe(false);
  });

  it('marks the last assistant output as errored on a failed tool', () => {
    const base = deriveMetricBase([
      message({ content: [toolPart('bash', 'error')] }),
    ]);

    expect(base.lastAssistantErrored).toBe(true);
  });
});

describe('resolveMetrics', () => {
  const base = (overrides: Partial<TMetricBase> = {}): TMetricBase => ({
    ...deriveMetricBase([message()]),
    ...overrides,
  });

  it('computes a fixed duration from endedAt', () => {
    const metrics = resolveMetrics(base(), undefined, 9999, 0);

    expect(metrics.durationMs).toBe(3000);
    expect(metrics.startedAt).toBe(1000);
    expect(metrics.endedAt).toBe(4000);
  });

  it('uses now as the end when endedAt is missing', () => {
    const metrics = resolveMetrics(base({ endedAt: null }), undefined, 5000, 0);

    expect(metrics.durationMs).toBe(4000);
    expect(metrics.endedAt).toBeNull();
  });

  it('returns a null duration without a start', () => {
    const metrics = resolveMetrics(base({ startedAt: null }), undefined, 5000, 0);

    expect(metrics.durationMs).toBeNull();
  });

  it('adds the retry attempt of the status', () => {
    const retry: SessionStatus = {
      type: 'retry',
      attempt: 2,
      message: 'rate limited',
      next: 1234,
    };

    const metrics = resolveMetrics(base(), retry, 4000, 0);

    expect(metrics.retryCount).toBe(2);
    expect(metrics.hasLoop).toBe(true);
    expect(metrics.loopEvidence).toContain('rate limited');
  });

  it('uses the subtask invocations for the count', () => {
    const metrics = resolveMetrics(base(), undefined, 4000, 3);

    expect(metrics.invocations).toBe(3);
  });
});

const NOW = 10_000;

const root: SessionInfo = {
  id: 'ses_root',
  projectID: 'proj',
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  time: { created: 0, updated: 0 },
  location: { directory: '/repo' },
  title: 'Root',
};

const resources: TResourceUsage = {
  mcpServers: [],
  instructions: [],
  skills: [],
  tools: [],
  availability: 'available',
};

const node = (
  id: string,
  status: TNodeStatus,
  metrics: Partial<TNodeMetrics> = {},
  isRoot = false,
): TGraphNode => ({
  id,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: id,
    title: null,
    createdAt: null,
    updatedAt: null,
    agentName: 'develop',
    directory: '/repo',
    model: null,
    status,
    retry: null,
    interruptReason: null,
    metrics: { ...EMPTY_METRICS, ...metrics },
    isRoot,
    currentTool: null,
    parallel: null,
  },
});

const graph = (nodes: TGraphNode[]): TGraphModel => ({ nodes, edges: [] });

const summary = (nodes: TGraphNode[], now = NOW) =>
  summarizeSession(root, graph(nodes), resources, now);

describe('summarizeSession', () => {
  it('counts every execution status', () => {
    const result = summary([
      node('a', 'created'),
      node('b', 'running'),
      node('c', 'retrying'),
      node('d', 'compacting'),
      node('e', 'succeeded'),
      node('f', 'failed'),
      node('g', 'interrupted'),
    ]);

    expect(result.createdCount).toBe(1);
    expect(result.runningCount).toBe(1);
    expect(result.retryingCount).toBe(1);
    expect(result.compactingCount).toBe(1);
    expect(result.succeededCount).toBe(1);
    expect(result.agentCount).toBe(7);
  });

  it('groups both waiting states into waitingCount', () => {
    const result = summary([
      node('a', 'waiting-permission'),
      node('b', 'waiting-input'),
      node('c', 'running'),
    ]);

    expect(result.waitingCount).toBe(2);
    expect(result.runningCount).toBe(1);
  });

  it('keeps interruptedCount separate from errorCount (FR-019)', () => {
    const result = summary([
      node('a', 'failed'),
      node('b', 'interrupted'),
      node('c', 'interrupted'),
    ]);

    expect(result.errorCount).toBe(1);
    expect(result.interruptedCount).toBe(2);
  });

  it('computes elapsedMs from the first start to the last end when idle', () => {
    const result = summary([
      node('a', 'succeeded', { startedAt: 1000, endedAt: 4000 }),
      node('b', 'succeeded', { startedAt: 2000, endedAt: 9000 }),
    ]);

    expect(result.elapsedMs).toBe(8000);
  });

  it('uses now as the end while an agent is active', () => {
    const result = summary(
      [
        node('a', 'succeeded', { startedAt: 1000, endedAt: 4000 }),
        node('b', 'running', { startedAt: 2000, endedAt: null }),
      ],
      10_000,
    );

    expect(result.elapsedMs).toBe(9000);
  });

  it('returns null elapsedMs without activity', () => {
    const result = summary([node('a', 'created', { startedAt: null })]);

    expect(result.elapsedMs).toBeNull();
  });

  it('sums cost and tokens across nodes', () => {
    const result = summary([
      node('a', 'succeeded', {
        cost: 0.01,
        tokens: {
          input: 100,
          output: 50,
          reasoning: 10,
          cacheRead: 0,
          cacheWrite: 0,
        },
      }),
      node('b', 'succeeded', {
        cost: 0.02,
        tokens: {
          input: 200,
          output: 100,
          reasoning: 20,
          cacheRead: 0,
          cacheWrite: 0,
        },
      }),
    ]);

    expect(result.metrics.cost).toBeCloseTo(0.03, 5);
    expect(result.metrics.tokens).toEqual({
      input: 300,
      output: 150,
      reasoning: 30,
      cacheRead: 0,
      cacheWrite: 0,
    });
  });

  it('returns null cost and tokens when no node reports them', () => {
    const result = summary([node('a', 'created')]);

    expect(result.metrics.cost).toBeNull();
    expect(result.metrics.tokens).toBeNull();
  });
});
