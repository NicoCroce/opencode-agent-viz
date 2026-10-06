import { describe, expect, it } from 'vitest';
import type { TGraphNode, TNodeSizeOverride } from '../../Graph.entity';
import { EMPTY_METRICS } from '../../Graph.entity';
import { NODE_WIDTH } from '../layoutGraph';
import { buildViewNodes } from '../buildViewNodes';

// Contrato: `specs/002-viz-ux-refinements/contracts/graph-view-contract.md`
// y research R2 (FR-006). Puro y sin `ResizeObserver` (Principio V).

const node = (id: string, x = 0, y = 0): TGraphNode => ({
  id,
  type: 'agent',
  position: { x, y },
  data: {
    sessionId: id,
    createdAt: null,
    updatedAt: null,
    agentName: id,
    directory: '/repo',
    model: null,
    status: 'done',
    metrics: { ...EMPTY_METRICS },
    isRoot: id === 'root',
    currentTool: null,
    parallel: null,
  },
});

const override = (
  overrides: Partial<TNodeSizeOverride> = {},
): TNodeSizeOverride => ({
  width: 320,
  height: 200,
  ...overrides,
});

describe('buildViewNodes', () => {
  it('uses the model position and default width when there is no override', () => {
    const [view] = buildViewNodes([node('root', 40, 80)], {}, null, false);

    expect(view.position).toEqual({ x: 40, y: 80 });
    expect(view.width).toBe(NODE_WIDTH);
    expect(view.height).toBeUndefined();
    expect(view.selected).toBe(false);
  });

  it('flags the selected node from selectedNodeId', () => {
    const views = buildViewNodes(
      [node('root'), node('child')],
      {},
      'child',
      false,
    );

    expect(views.map((n) => n.selected)).toEqual([false, true]);
  });

  it('applies override size and position in the full-graph mode', () => {
    const [view] = buildViewNodes(
      [node('root', 0, 0)],
      { root: override({ x: -30, y: -12 }) },
      null,
      false,
    );

    expect(view.width).toBe(320);
    expect(view.height).toBe(200);
    expect(view.position).toEqual({ x: -30, y: -12 });
  });

  it('ignores the override x/y in chain mode and keeps the layoutChain position', () => {
    // `layoutChain` deja `child` en la segunda columna (x > 0, y = 0).
    const chainNode = node('child', NODE_WIDTH + 48, 0);

    const [view] = buildViewNodes(
      [chainNode],
      { child: override({ x: -999, y: -999 }) },
      null,
      true,
    );

    expect(view.position).toEqual(chainNode.position);
  });

  it('keeps the override size in chain mode while ignoring its position', () => {
    const [view] = buildViewNodes(
      [node('root', 220, 0)],
      { root: override({ width: 360, height: 240, x: -50, y: -50 }) },
      null,
      true,
    );

    expect(view.width).toBe(360);
    expect(view.height).toBe(240);
    expect(view.position).toEqual({ x: 220, y: 0 });
  });

  it('keeps a single row for a chain even when every node was resized', () => {
    const chain = [
      node('root', 0, 0),
      node('child', 268, 0),
      node('grandchild', 536, 0),
    ];
    const overrides = {
      root: override({ x: -120, y: -200 }),
      child: override({ x: -120, y: -200 }),
      grandchild: override({ x: -120, y: -200 }),
    };

    const views = buildViewNodes(chain, overrides, null, true);

    expect(views.map((n) => n.position.y)).toEqual([0, 0, 0]);
    expect(views.map((n) => n.position.x)).toEqual([0, 268, 536]);
  });

  it('does not mutate the input nodes or overrides', () => {
    const input = [node('root', 10, 20)];
    const overrides = { root: override({ x: -5, y: -6 }) };
    const snapshotNodes = structuredClone(input);
    const snapshotOverrides = structuredClone(overrides);

    buildViewNodes(input, overrides, 'root', false);

    expect(input).toEqual(snapshotNodes);
    expect(overrides).toEqual(snapshotOverrides);
  });
});
