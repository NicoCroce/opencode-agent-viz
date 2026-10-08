import { describe, expect, it } from 'vitest';
import type { TGraphNode } from '../../Graph.entity';
import { endOf, nodeInterval, startOf } from '../execution/nodeInterval';

type TMetrics = TGraphNode['data']['metrics'];

const metrics = (overrides: Partial<TMetrics> = {}): TMetrics => ({
  durationMs: null,
  startedAt: null,
  endedAt: null,
  cost: null,
  tokens: null,
  invocations: 0,
  retryCount: 0,
  hasLoop: false,
  loopEvidence: [],
  ...overrides,
});

const node = (overrides: Partial<TGraphNode['data']> = {}): TGraphNode => ({
  id: 'n1',
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: 'n1',
    title: null,
    createdAt: null,
    updatedAt: null,
    agentName: 'general',
    directory: '/repo',
    model: null,
    status: 'succeeded',
    retry: null,
    interruptReason: null,
    metrics: metrics(),
    isRoot: false,
    currentTool: null,
    parallel: null,
    ...overrides,
  },
});

describe('startOf', () => {
  it('prefers createdAt over the metric start', () => {
    expect(
      startOf(node({ createdAt: 100, metrics: metrics({ startedAt: 50 }) })),
    ).toBe(100);
  });

  it('falls back to metrics.startedAt', () => {
    expect(
      startOf(node({ createdAt: null, metrics: metrics({ startedAt: 50 }) })),
    ).toBe(50);
  });

  it('falls back to 0 when neither is present', () => {
    expect(startOf(node())).toBe(0);
  });
});

describe('endOf', () => {
  it('prefers updatedAt over the metric end', () => {
    expect(
      endOf(node({ updatedAt: 200, metrics: metrics({ endedAt: 150 }) }), 999),
    ).toBe(200);
  });

  it('falls back to metrics.endedAt', () => {
    expect(
      endOf(node({ updatedAt: null, metrics: metrics({ endedAt: 150 }) }), 999),
    ).toBe(150);
  });

  it('falls back to now when neither is present', () => {
    expect(endOf(node(), 999)).toBe(999);
  });
});

describe('nodeInterval', () => {
  it('returns [start, end] from the node bounds', () => {
    expect(nodeInterval(node({ createdAt: 100, updatedAt: 300 }), 999)).toEqual([
      100, 300,
    ]);
  });

  it('clamps an end before the start', () => {
    expect(nodeInterval(node({ createdAt: 500, updatedAt: 100 }), 999)).toEqual([
      500, 500,
    ]);
  });

  it('uses the documented fallbacks: start 0 and end now', () => {
    expect(nodeInterval(node(), 999)).toEqual([0, 999]);
  });

  it('mixes createdAt with the metric end', () => {
    expect(
      nodeInterval(
        node({ createdAt: 100, metrics: metrics({ endedAt: 250 }) }),
        999,
      ),
    ).toEqual([100, 250]);
  });
});
