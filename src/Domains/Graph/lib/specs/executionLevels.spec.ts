import { describe, expect, it } from 'vitest';
import type { TGraphModel, TGraphNode } from '../../Graph.entity';
import { NODE_CARD_HEIGHT } from '../layoutGraph';
import {
  EXECUTION_GUTTER,
  EXECUTION_RAIL_OFFSET,
  EXECUTION_ROW_HEIGHT,
  EXECUTION_ROW_PAD,
  deriveExecutionLevels,
  deriveRowLayout,
  executionColumnX,
  executionRailX,
  layoutExecution,
} from '../executionLevels';

const node = (
  id: string,
  createdAt: number,
  endedAt: number | null = null,
): TGraphNode => ({
  id,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: id,
    title: id,
    createdAt,
    updatedAt: endedAt,
    agentName: 'general',
    directory: '/repo',
    model: null,
    status: 'done',
    metrics: {
      durationMs: null,
      startedAt: createdAt,
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

/**
 * A (raíz) → B,C en paralelo → B1,B2,B3 en paralelo. Es el escenario del brief.
 */
const example = (): TGraphModel =>
  model(
    [
      node('A', 0, 50),
      node('B', 100, 400),
      node('C', 100, 150),
      node('B1', 200, 300),
      node('B2', 200, 260),
      node('B3', 200, 280),
    ],
    {
      B: 'A',
      C: 'A',
      B1: 'B',
      B2: 'B',
      B3: 'B',
    },
  );

describe('deriveExecutionLevels', () => {
  it('puts the root at level 0 and each invocation batch at the next level', () => {
    const plan = deriveExecutionLevels(example(), 1000);

    expect(plan.levels.map((level) => level.nodeIds)).toEqual([
      ['A'],
      ['B', 'C'],
      ['B1', 'B2', 'B3'],
    ]);
    expect(plan.levels.map((level) => level.level)).toEqual([0, 1, 2]);
  });

  it('marks a level as parallel only when it groups 2+ agents', () => {
    const plan = deriveExecutionLevels(example(), 1000);

    expect(plan.levels.map((level) => level.parallel)).toEqual([
      false,
      true,
      true,
    ]);
  });

  it('orders columns within a level by start time', () => {
    const plan = deriveExecutionLevels(example(), 1000);

    expect(plan.columnByNode.B).toBe(0);
    expect(plan.columnByNode.C).toBe(1);
    expect(plan.columnByNode.B1).toBe(0);
    expect(plan.columnByNode.B3).toBe(2);
  });

  it('gives each singleton invocation its own level (chain)', () => {
    const chain = model(
      [node('A', 0, 10), node('B', 20, 30), node('C', 40, 50)],
      { B: 'A', C: 'B' },
    );

    const plan = deriveExecutionLevels(chain, 1000);

    expect(plan.levels.map((level) => level.nodeIds)).toEqual([
      ['A'],
      ['B'],
      ['C'],
    ]);
  });

  it('never places a child above its parent', () => {
    const plan = deriveExecutionLevels(example(), 1000);
    const model_ = example();
    for (const edge of model_.edges) {
      expect(plan.levelByNode[edge.target]).toBeGreaterThan(
        plan.levelByNode[edge.source],
      );
    }
  });

  it('reports the level time window from its members', () => {
    const plan = deriveExecutionLevels(example(), 1000);
    const level1 = plan.levels[1];

    expect(level1.startedAt).toBe(100);
    expect(level1.endedAt).toBe(400);
  });
});

describe('layoutExecution', () => {
  it('positions nodes by level (y) and column (x)', () => {
    const graph = example();
    const plan = deriveExecutionLevels(graph, 1000);
    const laidOut = layoutExecution(graph, plan);

    const byId = Object.fromEntries(
      laidOut.nodes.map((n) => [n.id, n.position]),
    );

    expect(byId.A).toEqual({
      x: executionColumnX(0),
      y: EXECUTION_ROW_PAD,
    });
    expect(byId.C).toEqual({
      x: executionColumnX(1),
      y: EXECUTION_ROW_HEIGHT + EXECUTION_ROW_PAD,
    });
    expect(byId.B3.y).toBe(2 * EXECUTION_ROW_HEIGHT + EXECUTION_ROW_PAD);
  });

  it('does not mutate the input model', () => {
    const graph = example();
    const plan = deriveExecutionLevels(graph, 1000);
    const before = structuredClone(graph.nodes.map((n) => n.position));

    layoutExecution(graph, plan);

    expect(graph.nodes.map((n) => n.position)).toEqual(before);
  });
});

describe('deriveRowLayout', () => {
  it('sizes each row to the tallest node of the level', () => {
    const plan = deriveExecutionLevels(example(), 1000);
    // B pertenece al nivel 1 y fue redimensionado a 300.
    const layout = deriveRowLayout(plan, { B: 300 });

    expect(layout.height[1]).toBe(300 + 2 * EXECUTION_ROW_PAD);
    // El nivel 2 no tiene overrides → alto de card por defecto.
    expect(layout.height[2]).toBe(NODE_CARD_HEIGHT + 2 * EXECUTION_ROW_PAD);
  });

  it('accumulates the top of each row', () => {
    const plan = deriveExecutionLevels(example(), 1000);
    const layout = deriveRowLayout(plan, {});

    expect(layout.top[0]).toBe(0);
    expect(layout.top[1]).toBe(layout.height[0]);
    expect(layout.top[2]).toBe(layout.height[0] + layout.height[1]);
    expect(layout.total).toBe(
      layout.height[0] + layout.height[1] + layout.height[2],
    );
  });

  it('never sizes a row below the card height', () => {
    const plan = deriveExecutionLevels(example(), 1000);
    const layout = deriveRowLayout(plan, { A: 10 });

    expect(layout.height[0]).toBe(NODE_CARD_HEIGHT + 2 * EXECUTION_ROW_PAD);
  });
});

describe('executionRailX', () => {
  it('places the rail in the channel to the left of its column', () => {
    expect(executionRailX(0)).toBe(executionColumnX(0) - EXECUTION_RAIL_OFFSET);
    expect(executionRailX(1)).toBe(executionColumnX(1) - EXECUTION_RAIL_OFFSET);
  });

  it('keeps the first rail clear of the gutter and of the node', () => {
    // El riel de la columna 0 cae después de la espina y antes del nodo.
    expect(executionRailX(0)).toBeGreaterThan(EXECUTION_GUTTER);
    expect(executionRailX(0)).toBeLessThan(executionColumnX(0));
  });
});
