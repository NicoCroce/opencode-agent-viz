import { describe, expect, it } from 'vitest';
import type { TGraphModel, TGraphNode, TNodeStatus } from '../../Graph.entity';
import { deriveParallelGroups, deriveSiblingBatches } from '../parallelism';
import { toParallelByNode } from '../parallelByNode';

const node = (
  id: string,
  startedAt: number | null,
  endedAt: number | null,
  status: TNodeStatus = 'succeeded',
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
    status,
    retry: null,
    interruptReason: null,
    metrics: {
      durationMs: null,
      startedAt,
      endedAt,
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

describe('deriveParallelGroups', () => {
  it('groups siblings whose execution intervals overlap', () => {
    const graph = model(
      [
        node('a', 0, 100),
        node('b', 10, 90),
        node('c', 50, 200),
      ],
      { a: 'root', b: 'root', c: 'root' },
    );

    const groups = deriveParallelGroups(graph, 1000);

    expect(groups).toHaveLength(1);
    expect(groups[0].nodeIds).toEqual(['a', 'b', 'c']);
    expect(groups[0].parentId).toBe('root');
    expect(groups[0].startedAt).toBe(0);
    expect(groups[0].endedAt).toBe(200);
  });

  it('does not group siblings whose intervals are disjoint', () => {
    const graph = model(
      [node('a', 0, 10), node('b', 20, 30)],
      { a: 'root', b: 'root' },
    );

    expect(deriveParallelGroups(graph, 1000)).toEqual([]);
  });

  it('separates disjoint clusters under the same parent', () => {
    const graph = model(
      [
        node('a', 0, 100),
        node('b', 10, 90),
        node('c', 500, 600),
        node('d', 510, 590),
      ],
      { a: 'root', b: 'root', c: 'root', d: 'root' },
    );

    const groups = deriveParallelGroups(graph, 1000);

    expect(groups).toHaveLength(2);
    expect(groups[0].nodeIds).toEqual(['a', 'b']);
    expect(groups[1].nodeIds).toEqual(['c', 'd']);
  });

  it('joins a transitive overlap chain into a single group', () => {
    const graph = model(
      [node('a', 0, 100), node('b', 50, 150), node('c', 120, 200)],
      { a: 'root', b: 'root', c: 'root' },
    );

    const groups = deriveParallelGroups(graph, 1000);

    expect(groups).toHaveLength(1);
    expect(groups[0].nodeIds).toEqual(['a', 'b', 'c']);
  });

  it('never pairs a parent with its own child (different levels)', () => {
    const graph = model([node('root', 0, 1000), node('child', 0, 100)], {
      child: 'root',
    });

    expect(deriveParallelGroups(graph, 1000)).toEqual([]);
  });

  it('keeps a still-running node open so it overlaps any later `now`', () => {
    // Un nodo ACTIVO (running) tiene `executionInterval = [inicio, +∞)`: solapa
    // con cualquier `now`, sin depender del reloj (FR-002, FR-008, FR-011).
    const graph = model(
      [node('a', 0, null, 'running'), node('b', 50, 80)],
      { a: 'root', b: 'root' },
    );

    // `now` cae dentro del intervalo de `b` → se solapan.
    expect(deriveParallelGroups(graph, 100)[0]?.nodeIds).toEqual(['a', 'b']);
    // `now` posterior al fin de `b` sigue solapando (a sigue abierto).
    expect(deriveParallelGroups(graph, 500)[0]?.nodeIds).toEqual(['a', 'b']);
  });

  it('groups active siblings created seconds apart into a single batch', () => {
    const graph = model(
      [
        node('a', 0, null, 'running'),
        node('b', 4_000, null, 'running'),
        node('c', 8_000, null, 'waiting-permission'),
      ],
      { a: 'root', b: 'root', c: 'root' },
    );

    const batches = deriveSiblingBatches(graph, 12_000);

    expect(batches).toHaveLength(1);
    expect(batches[0].nodeIds).toEqual(['a', 'b', 'c']);
  });

  it('keeps sequential siblings (ended before the next starts) in separate batches', () => {
    const graph = model(
      [
        node('first', 0, 1_000),
        node('second', 2_000, 3_000),
        node('third', 4_000, 5_000),
      ],
      { first: 'root', second: 'root', third: 'root' },
    );

    const batches = deriveSiblingBatches(graph, 6_000);

    expect(batches.map((batch) => batch.nodeIds)).toEqual([
      ['first'],
      ['second'],
      ['third'],
    ]);
    // Ningún lote llega a 2 miembros: sin badge de paralelismo (FR-005).
    expect(deriveParallelGroups(graph, 6_000)).toEqual([]);
  });

  it('separates two consecutive parallel groups, each sharing its own batch', () => {
    const graph = model(
      [
        node('a1', 0, 1_000),
        node('a2', 100, 900),
        node('b1', 5_000, 6_000),
        node('b2', 5_100, 5_900),
      ],
      { a1: 'root', a2: 'root', b1: 'root', b2: 'root' },
    );

    const groups = deriveParallelGroups(graph, 7_000);

    expect(groups).toHaveLength(2);
    expect(groups[0].nodeIds).toEqual(['a1', 'a2']);
    expect(groups[1].nodeIds).toEqual(['b1', 'b2']);
  });

  it('derives the parallelism badge from the same groups as the lanes (FR-010)', () => {
    const graph = model(
      [
        node('a1', 0, 1_000),
        node('a2', 100, 900),
        node('solo', 5_000, 6_000),
      ],
      { a1: 'root', a2: 'root', solo: 'root' },
    );

    const batches = deriveSiblingBatches(graph, 7_000);
    const groups = deriveParallelGroups(graph, 7_000);
    const parallelByNode = toParallelByNode(groups);

    // El badge (`parallelGroups`) es exactamente los lotes con 2+ hermanos.
    expect(groups).toEqual(
      batches.filter((batch) => batch.nodeIds.length >= 2),
    );
    expect(parallelByNode.a1).toEqual({ groupId: groups[0].id, size: 2 });
    expect(parallelByNode.a2).toEqual({ groupId: groups[0].id, size: 2 });
    expect(parallelByNode.solo).toBeUndefined();
  });

  it('returns a stable order sorted by start time', () => {
    const graph = model(
      [
        node('late', 500, 600),
        node('latePeer', 510, 590),
        node('early', 0, 100),
        node('earlyPeer', 10, 90),
      ],
      {
        late: 'root',
        latePeer: 'root',
        early: 'root',
        earlyPeer: 'root',
      },
    );

    const groups = deriveParallelGroups(graph, 1000);

    expect(groups.map((group) => group.nodeIds)).toEqual([
      ['early', 'earlyPeer'],
      ['late', 'latePeer'],
    ]);
  });

  it('gives every member of a group a shared, unique id', () => {
    const graph = model(
      [node('a', 0, 100), node('b', 10, 90)],
      { a: 'root', b: 'root' },
    );

    const [group] = deriveParallelGroups(graph, 1000);
    expect(group.id).toBe('root#a');
    expect(new Set(group.nodeIds).size).toBe(2);
  });
});
