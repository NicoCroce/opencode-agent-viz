import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TGraphModel, TGraphNode } from '../../Graph.entity';
import { deriveExecutionKey } from '../execution/executionKey';

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

const node = (
  id: string,
  overrides: Partial<TGraphNode['data']> = {},
): TGraphNode => ({
  id,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: id,
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

const model = (
  nodes: TGraphNode[],
  parentByChild: Record<string, string> = {},
): TGraphModel => ({
  nodes,
  edges: Object.entries(parentByChild).map(([target, source]) => ({
    id: `${source}->${target}`,
    source,
    target,
    type: 'agent' as const,
  })),
});

/** Dos hermanos activos, la disposición base de los casos siguientes. */
const parallelPair = (): TGraphModel =>
  model(
    [
      node('root', { isRoot: true, status: 'running' }),
      node('a', { createdAt: 100, status: 'running' }),
      node('b', { createdAt: 110, status: 'running' }),
    ],
    { a: 'root', b: 'root' },
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deriveExecutionKey', () => {
  it('is deterministic for the same model', () => {
    const first = parallelPair();
    const second = parallelPair();

    expect(deriveExecutionKey(first)).toBe(deriveExecutionKey(second));
    expect(deriveExecutionKey(first)).toBe(deriveExecutionKey(first));
  });

  it('is independent of the node and edge array order', () => {
    const first = parallelPair();
    const second = parallelPair();
    second.nodes = [...second.nodes].reverse();
    second.edges = [...second.edges].reverse();

    expect(deriveExecutionKey(first)).toBe(deriveExecutionKey(second));
  });

  it('changes when a node appears or disappears (topology)', () => {
    const base = parallelPair();
    const extra = parallelPair();
    extra.nodes.push(node('c', { createdAt: 120, status: 'running' }));
    extra.edges.push({ id: 'root->c', source: 'root', target: 'c', type: 'agent' });

    expect(deriveExecutionKey(base)).not.toBe(deriveExecutionKey(extra));

    const missing = parallelPair();
    missing.nodes = missing.nodes.filter((n) => n.id !== 'b');
    missing.edges = missing.edges.filter((e) => e.target !== 'b');

    expect(deriveExecutionKey(base)).not.toBe(deriveExecutionKey(missing));
  });

  it('changes when a node id changes', () => {
    const base = parallelPair();
    const renamed = parallelPair();
    renamed.nodes[1].id = 'a2';
    renamed.nodes[1].data.sessionId = 'a2';
    renamed.edges = renamed.edges.map((edge) =>
      edge.target === 'a' ? { ...edge, target: 'a2', id: 'root->a2' } : edge,
    );

    expect(deriveExecutionKey(base)).not.toBe(deriveExecutionKey(renamed));
  });

  it('changes when a node parent changes (topology)', () => {
    const base = parallelPair();
    const reparented = parallelPair();
    reparented.edges = reparented.edges.map((edge) =>
      edge.target === 'b' ? { ...edge, source: 'a', id: 'a->b' } : edge,
    );

    expect(deriveExecutionKey(base)).not.toBe(deriveExecutionKey(reparented));
  });

  it('changes when a node start time changes', () => {
    const base = parallelPair();
    const shifted = parallelPair();
    shifted.nodes[1].data.createdAt = 500;

    expect(deriveExecutionKey(base)).not.toBe(deriveExecutionKey(shifted));
  });

  it('changes when an active node becomes terminated', () => {
    const active = parallelPair();
    const terminated = parallelPair();
    terminated.nodes[1].data.status = 'succeeded';
    terminated.nodes[1].data.updatedAt = 400;

    expect(deriveExecutionKey(active)).not.toBe(deriveExecutionKey(terminated));
  });

  it('changes when the real end of a terminated node changes', () => {
    const base = parallelPair();
    base.nodes[1].data.status = 'succeeded';
    base.nodes[1].data.updatedAt = 400;

    const later = parallelPair();
    later.nodes[1].data.status = 'succeeded';
    later.nodes[1].data.updatedAt = 900;

    expect(deriveExecutionKey(base)).not.toBe(deriveExecutionKey(later));
  });

  it('changes when a terminated node falls back to metrics.endedAt', () => {
    const withUpdated = parallelPair();
    withUpdated.nodes[1].data.status = 'succeeded';
    withUpdated.nodes[1].data.updatedAt = 400;

    const withMetric = parallelPair();
    withMetric.nodes[1].data.status = 'succeeded';
    withMetric.nodes[1].data.metrics = metrics({ endedAt: 400 });

    expect(deriveExecutionKey(withUpdated)).not.toBe(
      deriveExecutionKey(withMetric),
    );
  });

  it('does not change when an active node updates its activity mark', () => {
    const base = parallelPair();
    const fresh = parallelPair();
    fresh.nodes[1].data.updatedAt = 999_999;

    expect(deriveExecutionKey(base)).toBe(deriveExecutionKey(fresh));
  });

  it('does not change when an active node switches between active statuses', () => {
    const base = parallelPair();
    const retrying = parallelPair();
    retrying.nodes[1].data.status = 'retrying';

    const waiting = parallelPair();
    waiting.nodes[1].data.status = 'waiting-permission';

    const key = deriveExecutionKey(base);
    expect(deriveExecutionKey(retrying)).toBe(key);
    expect(deriveExecutionKey(waiting)).toBe(key);
  });

  it('does not change when a terminated node switches between terminal statuses with the same end', () => {
    const succeeded = parallelPair();
    succeeded.nodes[1].data.status = 'succeeded';
    succeeded.nodes[1].data.updatedAt = 400;

    const failed = parallelPair();
    failed.nodes[1].data.status = 'failed';
    failed.nodes[1].data.updatedAt = 400;

    expect(deriveExecutionKey(succeeded)).toBe(deriveExecutionKey(failed));
  });

  it('does not change on non-structural data (title, tool, position, badge, metrics, enrichment)', () => {
    const base = parallelPair();
    const decorated = parallelPair();

    decorated.nodes[1].position = { x: 1234, y: 5678 };
    decorated.nodes[1].data.title = 'renamed task';
    decorated.nodes[1].data.currentTool = { name: 'bash', state: 'running' };
    decorated.nodes[1].data.parallel = { groupId: 'root#a', size: 2 };
    decorated.nodes[1].data.enrichment = 'ready';
    decorated.nodes[1].data.metrics = metrics({
      durationMs: 12_345,
      cost: 0.42,
      invocations: 7,
      retryCount: 2,
      hasLoop: true,
      loopEvidence: ['loop'],
    });

    expect(deriveExecutionKey(base)).toBe(deriveExecutionKey(decorated));
  });

  it('does not depend on the wall clock (no Date.now)', () => {
    const base = parallelPair();

    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const early = deriveExecutionKey(base);

    vi.spyOn(Date, 'now').mockReturnValue(9_999_999);
    const late = deriveExecutionKey(base);

    expect(early).toBe(late);
  });

  it('still distinguishes the interval class when only the status class changes', () => {
    // Guarda de la composición: una clase activa y una terminada con el mismo
    // inicio y sin fin real no deben colapsar a la misma clave.
    const active = model([node('a', { createdAt: 100, status: 'running' })]);
    const terminated = model([
      node('a', { createdAt: 100, status: 'succeeded' }),
    ]);

    expect(deriveExecutionKey(active)).not.toBe(
      deriveExecutionKey(terminated),
    );
  });
});
