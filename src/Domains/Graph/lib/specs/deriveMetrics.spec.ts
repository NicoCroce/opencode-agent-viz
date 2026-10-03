import { describe, expect, it } from 'vitest';
import type { SessionMessageAssistant } from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { deriveMetrics } from '../deriveMetrics';

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
