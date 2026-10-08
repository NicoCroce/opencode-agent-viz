import { describe, expect, it, vi } from 'vitest';
import type { TGraphNode, TNodeSizeOverride } from '../../Graph.entity';
import { EMPTY_METRICS } from '../../Graph.entity';
import { NODE_WIDTH } from '../layoutGraph';
import { cardHeight } from '../cardHeight';
import * as cardHeightModule from '../cardHeight';
import { buildViewNodes } from '../buildViewNodes';

// Contrato: `specs/002-viz-ux-refinements/contracts/graph-view-contract.md`
// y research R2 (FR-006). Puro y sin `ResizeObserver` (Principio V).

const node = (id: string, x = 0, y = 0): TGraphNode => ({
  id,
  type: 'agent',
  position: { x, y },
  data: {
    sessionId: id,
    title: id,
    createdAt: null,
    updatedAt: null,
    agentName: id,
    directory: '/repo',
    model: null,
    status: 'succeeded',
    retry: null,
    interruptReason: null,
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
    expect(view.height).toBe(cardHeight(node('root').data, NODE_WIDTH));
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

// C5 — contrato de render §3: `buildViewNodes` calcula `height` una sola vez
// (`override?.height ?? cardHeight(data, width)`) y lo devuelve ya resuelto, de
// modo que el consumidor no tenga que recalcularlo.
//
// La otra mitad de C5 —que `AgentGraph` reutilice ese `node.height` y NO vuelva
// a llamar `cardHeight` en su `heightByNode`— no es verificable desde este spec
// (vive en `Components/AgentGraph.tsx`). Queda pendiente de T028 (eliminar la
// llamada de `AgentGraph.tsx:171`) y se comprueba en `AgentGraph.spec.tsx`
// (T024). Este bloque cierra el límite del builder: una llamada a `cardHeight`
// por nodo, nunca cuando el alto viene de un override.
describe('buildViewNodes — altura calculada una sola vez (C5)', () => {
  const spyOnCardHeight = () => vi.spyOn(cardHeightModule, 'cardHeight');

  it('returns the height already calculated by cardHeight when there is no override', () => {
    const cardHeightSpy = spyOnCardHeight();
    const root = node('root', 40, 80);

    const [view] = buildViewNodes([root], {}, null, false);

    expect(cardHeightSpy).toHaveBeenCalledTimes(1);
    expect(cardHeightSpy).toHaveBeenCalledWith(root.data, NODE_WIDTH);
    expect(typeof view.height).toBe('number');
    // El alto devuelto es exactamente el de esa única llamada: no se recalcula.
    expect(view.height).toBe(cardHeightSpy.mock.results[0].value);
  });

  it('does not call cardHeight when the node height comes from an override', () => {
    const cardHeightSpy = spyOnCardHeight();

    const [view] = buildViewNodes(
      [node('root')],
      { root: override({ height: 250 }) },
      null,
      false,
    );

    expect(cardHeightSpy).not.toHaveBeenCalled();
    expect(view.height).toBe(250);
  });

  it('computes cardHeight exactly once per node without recalculating it', () => {
    const cardHeightSpy = spyOnCardHeight();
    const nodes = [node('root'), node('child'), node('grandchild')];

    const views = buildViewNodes(nodes, {}, null, false);

    expect(cardHeightSpy).toHaveBeenCalledTimes(nodes.length);
    views.forEach((view, index) => {
      expect(view.height).toBe(cardHeightSpy.mock.results[index].value);
    });
  });

  it('mixes overrides and computed heights without extra cardHeight calls', () => {
    const cardHeightSpy = spyOnCardHeight();
    const root = node('root');
    const child = node('child');

    const views = buildViewNodes(
      [root, child],
      { child: override({ height: 300 }) },
      null,
      false,
    );

    expect(cardHeightSpy).toHaveBeenCalledTimes(1);
    expect(cardHeightSpy).toHaveBeenCalledWith(root.data, NODE_WIDTH);
    expect(views[0].height).toBe(cardHeightSpy.mock.results[0].value);
    expect(views[1].height).toBe(300);
  });
});
