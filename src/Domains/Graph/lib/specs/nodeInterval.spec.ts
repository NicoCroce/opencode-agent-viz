import { describe, expect, it } from 'vitest';
import type { TGraphNode, TNodeStatus } from '../../Graph.entity';
import {
  endOf,
  executionInterval,
  nodeInterval,
  startOf,
} from '../execution/nodeInterval';

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

const ACTIVE_STATUSES = [
  'running',
  'retrying',
  'compacting',
  'waiting-permission',
  'waiting-input',
] as const satisfies readonly TNodeStatus[];

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

  it('returns now for an active node even when a stale updatedAt exists', () => {
    expect(endOf(node({ status: 'running', updatedAt: 200 }), 999)).toBe(999);
  });

  it.each(ACTIVE_STATUSES)(
    'treats %s as active: the end is the observed now',
    (status) => {
      expect(endOf(node({ status, updatedAt: 200 }), 999)).toBe(999);
    },
  );

  it('keeps the real end for a finished node', () => {
    expect(endOf(node({ status: 'succeeded', updatedAt: 200 }), 999)).toBe(200);
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

describe('executionInterval', () => {
  it('opens an active node with an unbounded end (+∞)', () => {
    expect(
      executionInterval(
        node({ status: 'running', createdAt: 100, updatedAt: 150 }),
      ),
    ).toEqual([100, Number.POSITIVE_INFINITY]);
  });

  it.each(ACTIVE_STATUSES)('opens %s to +∞', (status) => {
    expect(
      executionInterval(node({ status, createdAt: 100, updatedAt: 150 })),
    ).toEqual([100, Number.POSITIVE_INFINITY]);
  });

  it('closes a finished node with its real end (updatedAt)', () => {
    expect(
      executionInterval(
        node({ status: 'succeeded', createdAt: 100, updatedAt: 300 }),
      ),
    ).toEqual([100, 300]);
  });

  it('closes a finished node falling back to metrics.endedAt', () => {
    expect(
      executionInterval(
        node({
          status: 'failed',
          createdAt: 100,
          metrics: metrics({ endedAt: 250 }),
        }),
      ),
    ).toEqual([100, 250]);
  });

  it('clamps a finished end that precedes its start', () => {
    expect(
      executionInterval(
        node({ status: 'succeeded', createdAt: 500, updatedAt: 100 }),
      ),
    ).toEqual([500, 500]);
  });

  it('never infers an open interval from absent data (FR-011)', () => {
    expect(
      executionInterval(node({ status: 'created', createdAt: 100 })),
    ).toEqual([100, 100]);
  });

  it('keeps a terminated node closed when no end data exists (FR-011)', () => {
    expect(executionInterval(node({ status: 'succeeded' }))).toEqual([0, 0]);
  });

  it('never infers an open interval from a missing start', () => {
    expect(executionInterval(node({ status: 'created' }))).toEqual([0, 0]);
  });
});
