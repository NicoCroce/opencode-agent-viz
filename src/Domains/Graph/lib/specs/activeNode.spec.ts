import { describe, expect, it } from 'vitest';
import type { TGraphModel, TGraphNode, TNodeStatus } from '../../Graph.entity';
import { activityStartOf, latestActiveNodeId } from '../activeNode';

interface NodeOptions {
  status?: TNodeStatus;
  startedAt?: number | null;
  createdAt?: number | null;
}

const node = (id: string, options: NodeOptions = {}): TGraphNode => ({
  id,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: id,
    title: null,
    createdAt: options.createdAt ?? null,
    updatedAt: null,
    agentName: 'general',
    directory: '/repo',
    model: null,
    status: options.status ?? 'running',
    retry: null,
    interruptReason: null,
    metrics: {
      durationMs: null,
      startedAt: options.startedAt ?? null,
      endedAt: null,
      cost: null,
      tokens: null,
      invocations: 0,
      retryCount: 0,
      hasLoop: false,
      loopEvidence: [],
    },
    isRoot: false,
    currentTool: null,
    parallel: null,
  },
});

const model = (nodes: TGraphNode[]): TGraphModel => ({ nodes, edges: [] });

const ACTIVE_STATUSES = [
  'running',
  'retrying',
  'compacting',
  'waiting-permission',
  'waiting-input',
] as const satisfies readonly TNodeStatus[];

const INACTIVE_STATUSES = [
  'created',
  'succeeded',
  'failed',
  'interrupted',
] as const satisfies readonly TNodeStatus[];

describe('activityStartOf', () => {
  it('prefers metrics.startedAt over createdAt (inverse precedence of startOf)', () => {
    expect(
      activityStartOf(node('n', { startedAt: 100, createdAt: 500 })),
    ).toBe(100);
  });

  it('falls back to createdAt when startedAt is absent', () => {
    expect(
      activityStartOf(node('n', { startedAt: null, createdAt: 500 })),
    ).toBe(500);
  });

  it('falls back to 0 when neither is present', () => {
    expect(activityStartOf(node('n'))).toBe(0);
  });
});

describe('latestActiveNodeId', () => {
  it('E1: picks the active node with the greatest activity start', () => {
    const graph = model([
      node('early', { startedAt: 100 }),
      node('late', { startedAt: 300 }),
      node('middle', { startedAt: 200 }),
    ]);

    expect(latestActiveNodeId(graph)).toBe('late');
  });

  it('E1: prefers metrics.startedAt over createdAt when ranking', () => {
    // `later.createdAt` es mayor, pero su inicio de ejecución es anterior:
    // con la precedencia de `startOf` (createdAt primero) ganaría `later`.
    const graph = model([
      node('earlier', { startedAt: 100, createdAt: 900 }),
      node('later', { startedAt: null, createdAt: 200 }),
    ]);

    expect(latestActiveNodeId(graph)).toBe('later');
  });

  it('E1: uses createdAt only as a last resort', () => {
    const graph = model([
      node('withStart', { startedAt: 50, createdAt: 10 }),
      node('onlyCreatedAt', { startedAt: null, createdAt: 100 }),
    ]);

    expect(latestActiveNodeId(graph)).toBe('onlyCreatedAt');
  });

  it('E1: treats a node without any time as the oldest (0)', () => {
    const graph = model([
      node('noTime', { startedAt: null, createdAt: null }),
      node('withStart', { startedAt: 1 }),
    ]);

    expect(latestActiveNodeId(graph)).toBe('withStart');
  });

  it('E1: ignores inactive nodes even with a later start', () => {
    const graph = model([
      node('active', { status: 'running', startedAt: 100 }),
      node('terminal', { status: 'succeeded', startedAt: 500 }),
    ]);

    expect(latestActiveNodeId(graph)).toBe('active');
  });

  it.each(ACTIVE_STATUSES)('E1: considers %s as active', (status) => {
    const graph = model([node('only', { status, startedAt: 10 })]);

    expect(latestActiveNodeId(graph)).toBe('only');
  });

  it.each(INACTIVE_STATUSES)('E2: ignores %s nodes', (status) => {
    const graph = model([node('only', { status, startedAt: 10 })]);

    expect(latestActiveNodeId(graph)).toBeNull();
  });

  it('E1: breaks ties by id lexicographically for a deterministic pick', () => {
    const graph = model([
      node('b', { startedAt: 100 }),
      node('a', { startedAt: 100 }),
    ]);

    expect(latestActiveNodeId(graph)).toBe('a');
  });

  it('E2: returns null for an empty model', () => {
    expect(latestActiveNodeId(model([]))).toBeNull();
  });

  it('E2: returns null when there are no active nodes', () => {
    const graph = model([
      node('done', { status: 'succeeded', startedAt: 300 }),
      node('failed', { status: 'failed', startedAt: 400 }),
    ]);

    expect(latestActiveNodeId(graph)).toBeNull();
  });

  it('E1: ties across the startedAt/createdAt fallback and breaks by id', () => {
    // `a` no tiene inicio de ejecución y cae a `createdAt` 100; `b` empieza en
    // 100. Ambos quedan en 100 y el desempate es lexicográfico por id.
    const graph = model([
      node('b', { startedAt: 100, createdAt: null }),
      node('a', { startedAt: null, createdAt: 100 }),
    ]);

    expect(activityStartOf(node('a', { startedAt: null, createdAt: 100 }))).toBe(
      100,
    );
    expect(latestActiveNodeId(graph)).toBe('a');
  });

  it('E1: a three-way tie resolves deterministically to the smallest id', () => {
    const graph = model([
      node('c', { startedAt: 50 }),
      node('b', { startedAt: 50 }),
      node('a', { startedAt: 50 }),
    ]);

    expect(latestActiveNodeId(graph)).toBe('a');
  });
});
