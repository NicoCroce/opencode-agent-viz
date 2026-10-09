import { describe, expect, it } from 'vitest';
import type { TGraphModel, TGraphNode } from '../../Graph.entity';
import { deriveExecutionLayout } from '../execution/deriveExecutionLayout';
import {
  EXECUTION_ROW_HEIGHT,
  EXECUTION_ROW_PAD,
  executionColumnX,
} from '../executionLevels';

type TNodeOverrides = Omit<Partial<TGraphNode['data']>, 'metrics'> & {
  metrics?: Partial<TGraphNode['data']['metrics']>;
};

const node = (id: string, overrides: TNodeOverrides = {}): TGraphNode => {
  const { metrics, ...data } = overrides;
  return {
    id,
    type: 'agent',
    position: { x: 0, y: 0 },
    data: {
      sessionId: id,
      title: id,
      createdAt: null,
      updatedAt: null,
      agentName: 'general',
      directory: '/repo',
      model: null,
      status: 'succeeded',
      retry: null,
      interruptReason: null,
      metrics: {
        durationMs: null,
        startedAt: null,
        endedAt: null,
        cost: null,
        tokens: null,
        invocations: 0,
        retryCount: 0,
        hasLoop: false,
        loopEvidence: [],
        ...metrics,
      },
      isRoot: false,
      currentTool: null,
      parallel: null,
      ...data,
    },
  };
};

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

/**
 * A (raíz) → B,C en paralelo → B1,B2,B3 en paralelo. Escenario del brief de
 * 006 reutilizado para ejercitar la composición del layout de ejecución.
 */
const example = (): TGraphModel =>
  model(
    [
      node('A', { createdAt: 0, updatedAt: 50 }),
      node('B', { createdAt: 100, updatedAt: 400 }),
      node('C', { createdAt: 100, updatedAt: 150 }),
      node('B1', { createdAt: 200, updatedAt: 300 }),
      node('B2', { createdAt: 200, updatedAt: 260 }),
      node('B3', { createdAt: 200, updatedAt: 280 }),
    ],
    { B: 'A', C: 'A', B1: 'B', B2: 'B', B3: 'B' },
  );

describe('deriveExecutionLayout', () => {
  it('derives the plan coherently: root at level 0, parallel batches in their own level', () => {
    const { plan } = deriveExecutionLayout(example(), 1000);

    expect(plan.levels.map((level) => level.nodeIds)).toEqual([
      ['A'],
      ['B', 'C'],
      ['B1', 'B2', 'B3'],
    ]);
    expect(plan.levels.map((level) => level.parallel)).toEqual([
      false,
      true,
      true,
    ]);
    expect(plan.levels.map((level) => level.level)).toEqual([0, 1, 2]);
    expect(plan.levelByNode.B).toBe(plan.levelByNode.C);
    expect(plan.levelByNode.B1).toBe(plan.levelByNode.B2);
    expect(plan.columnByNode.B).toBe(0);
    expect(plan.columnByNode.C).toBe(1);
    expect(plan.width).toBeGreaterThan(0);
  });

  it('indexes positions from the laid-out plan (same level → same row)', () => {
    const graph = example();
    const { positions, plan, graph: laidOut } = deriveExecutionLayout(graph, 1000);

    expect(Object.keys(positions).sort()).toEqual([
      'A',
      'B',
      'B1',
      'B2',
      'B3',
      'C',
    ]);
    expect(positions.A).toEqual({
      x: executionColumnX(0),
      y: EXECUTION_ROW_PAD,
    });
    expect(positions.C).toEqual({
      x: executionColumnX(1),
      y: EXECUTION_ROW_HEIGHT + EXECUTION_ROW_PAD,
    });
    expect(positions.B3.y).toBe(2 * EXECUTION_ROW_HEIGHT + EXECUTION_ROW_PAD);

    // Un mismo nivel comparte fila (y) y cada columna su x.
    expect(positions.B.y).toBe(positions.C.y);
    expect(positions.B1.y).toBe(positions.B2.y);
    expect(positions.B1.y).toBe(positions.B3.y);
    expect(plan.levelByNode.B1).toBe(plan.levelByNode.B3);

    // El grafo posicionado usa el mismo índice de posiciones.
    for (const graphNode of laidOut.nodes) {
      expect(graphNode.position).toEqual(positions[graphNode.id]);
    }
  });

  it('returns sibling groups coherent with parallelByNode', () => {
    const { parallelGroups, parallelByNode } = deriveExecutionLayout(
      example(),
      1000,
    );

    expect(parallelGroups.map((group) => group.nodeIds)).toEqual([
      ['B', 'C'],
      ['B1', 'B2', 'B3'],
    ]);
    expect(parallelGroups.map((group) => group.parentId)).toEqual(['A', 'B']);
    expect(parallelByNode.B).toEqual({ groupId: 'A#B', size: 2 });
    expect(parallelByNode.C).toEqual({ groupId: 'A#B', size: 2 });
    expect(parallelByNode.B3).toEqual({ groupId: 'B#B1', size: 3 });
    expect(parallelByNode.A).toBeUndefined();
  });

  it('applies data.parallel on the returned graph from the same groups', () => {
    const { graph: laidOut, parallelByNode } = deriveExecutionLayout(
      example(),
      1000,
    );
    const byId = Object.fromEntries(laidOut.nodes.map((n) => [n.id, n]));

    expect(byId.A.data.parallel).toBeNull();
    expect(byId.B.data.parallel).toEqual({ groupId: 'A#B', size: 2 });
    expect(byId.B3.data.parallel).toEqual({ groupId: 'B#B1', size: 3 });

    for (const graphNode of laidOut.nodes) {
      expect(graphNode.data.parallel).toEqual(
        parallelByNode[graphNode.id] ?? null,
      );
    }
  });

  it('keeps disjoint siblings in distinct rows and marks no parallelism', () => {
    const graph = model(
      [
        node('A', { createdAt: 0, updatedAt: 1000 }),
        node('B', { createdAt: 10, updatedAt: 20 }),
        node('C', { createdAt: 100, updatedAt: 200 }),
      ],
      { B: 'A', C: 'A' },
    );

    const { plan, parallelGroups, parallelByNode, graph: laidOut } =
      deriveExecutionLayout(graph, 1000);

    expect(plan.levels.map((level) => level.nodeIds)).toEqual([
      ['A'],
      ['B'],
      ['C'],
    ]);
    expect(plan.levels.every((level) => !level.parallel)).toBe(true);
    expect(parallelGroups).toEqual([]);
    expect(parallelByNode).toEqual({});
    expect(laidOut.nodes.every((n) => n.data.parallel === null)).toBe(true);
  });

  it('groups active siblings even when their frozen mark equals their start', () => {
    const graph = model(
      [
        node('A', { createdAt: 0, updatedAt: 100, status: 'running' }),
        node('B', { createdAt: 100, updatedAt: 100, status: 'running' }),
        node('C', { createdAt: 500, updatedAt: 500, status: 'running' }),
      ],
      { B: 'A', C: 'A' },
    );

    const { plan, parallelGroups, parallelByNode } = deriveExecutionLayout(
      graph,
      1000,
    );

    expect(parallelGroups.map((group) => group.nodeIds)).toEqual([['B', 'C']]);
    expect(plan.levels.map((level) => level.nodeIds)).toEqual([
      ['A'],
      ['B', 'C'],
    ]);
    expect(parallelByNode.B).toEqual({ groupId: 'A#B', size: 2 });
  });

  it('preserves edges and unrelated node data', () => {
    const graph = example();
    const { graph: laidOut } = deriveExecutionLayout(graph, 1000);
    const sourceById = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
    const byId = Object.fromEntries(laidOut.nodes.map((n) => [n.id, n]));

    expect(laidOut.edges).toEqual(graph.edges);
    expect(byId.B.data.sessionId).toBe('B');
    expect(byId.B.data.title).toBe(sourceById.B.data.title);
    expect(byId.B.data.status).toBe('succeeded');
    expect(byId.B.data.metrics).toEqual(sourceById.B.data.metrics);
  });

  it('does not mutate the input model', () => {
    const graph = example();
    const before = structuredClone(graph);

    const layout = deriveExecutionLayout(graph, 1000);

    expect(graph).toEqual(before);
    expect(layout.graph).not.toBe(graph);
    expect(layout.graph.nodes).not.toBe(graph.nodes);
  });
});
