import { describe, expect, it } from 'vitest';
import type {
  NodeChange,
  NodeDimensionChange,
  NodePositionChange,
} from '@xyflow/react';
import type { TGraphNode, TNodeSizeOverride } from '../../Graph.entity';
import { MIN_NODE_WIDTH, reduceNodeOverrides } from '../nodeResize';

// Valores fijados por el contrato de la vista del grafo (`graph-view-contract.md`).
const MIN_NODE_HEIGHT = 72;

type TOverrides = Record<string, TNodeSizeOverride>;

const override = (
  partial: Partial<TNodeSizeOverride> = {},
): TNodeSizeOverride => ({
  width: 300,
  height: 200,
  ...partial,
});

/** Cambio de dimensiones emitido por `NodeResizer` (durante y al final del resize). */
const dimensions = (
  id: string,
  width: number,
  height: number,
  resizing = true,
): NodeDimensionChange => ({
  id,
  type: 'dimensions',
  resizing,
  dimensions: { width, height },
});

/**
 * Cambio de dimensiones de **medición automática** emitido por el
 * `ResizeObserver` interno de React Flow: sin `resizing` ni `setAttributes`.
 */
const measurement = (
  id: string,
  width: number,
  height: number,
): NodeDimensionChange => ({
  id,
  type: 'dimensions',
  dimensions: { width, height },
});

/** Cambio de posición emitido por `NodeResizer` al agrandar desde arriba/izquierda. */
const position = (id: string, x: number, y: number): NodePositionChange => ({
  id,
  type: 'position',
  position: { x, y },
});

const select = (id: string, selected: boolean): NodeChange<TGraphNode> => ({
  id,
  type: 'select',
  selected,
});

describe('reduceNodeOverrides', () => {
  it('stores width and height from a dimension change', () => {
    const result = reduceNodeOverrides({}, [dimensions('n1', 520, 240)]);

    expect(result).toEqual({ n1: { width: 520, height: 240 } });
  });

  it('clamps width and height up to the minimum node size', () => {
    const result = reduceNodeOverrides({}, [dimensions('n1', 40, 10)]);

    expect(result.n1).toEqual({
      width: MIN_NODE_WIDTH,
      height: MIN_NODE_HEIGHT,
    });
  });

  it('keeps the requested size when it is above the minimum', () => {
    const result = reduceNodeOverrides({}, [dimensions('n1', 500, 400)]);

    expect(result.n1.width).toBe(500);
    expect(result.n1.height).toBe(400);
  });

  it('ignores the automatic measurement of a node without a user override', () => {
    const result = reduceNodeOverrides({}, [measurement('n1', 200, 96)]);

    // Sin override, el nodo conserva su alto automático por contenido (FR-002).
    expect(result).toEqual({});
  });

  it('ignores the automatic measurement without overwriting a user resize', () => {
    const overrides: TOverrides = { n1: override({ width: 360, height: 260 }) };

    const result = reduceNodeOverrides(overrides, [measurement('n1', 200, 96)]);

    expect(result).toEqual(overrides);
  });

  it('returns the same reference when there is nothing to apply', () => {
    const overrides: TOverrides = { n1: override() };

    const result = reduceNodeOverrides(overrides, [
      measurement('n1', 200, 96),
      select('n1', true),
    ]);

    // Misma referencia: permite al hook evitar un re-render que haría que
    // React Flow descarte las dimensiones medidas y oculte los nodos.
    expect(result).toBe(overrides);
  });

  it('still stores the final dimensions emitted at the end of a user resize', () => {
    const result = reduceNodeOverrides({}, [dimensions('n1', 560, 420, false)]);

    // `resizing: false` marca el fin del resize del usuario y sí se conserva.
    expect(result).toEqual({ n1: { width: 560, height: 420 } });
  });

  it('updates x and y from a resize position change without touching the size', () => {
    const overrides: TOverrides = { n1: override({ width: 320, height: 240 }) };

    const result = reduceNodeOverrides(overrides, [position('n1', -40, -20)]);

    expect(result.n1).toEqual({ width: 320, height: 240, x: -40, y: -20 });
  });

  it('applies a resize batch with position and dimensions together', () => {
    const overrides: TOverrides = { n1: override() };

    const result = reduceNodeOverrides(overrides, [
      position('n1', -30, -10),
      dimensions('n1', 560, 260),
    ]);

    expect(result.n1).toEqual({ width: 560, height: 260, x: -30, y: -10 });
  });

  it('handles several nodes in the same batch', () => {
    const result = reduceNodeOverrides({}, [
      dimensions('n1', 520, 240),
      dimensions('n2', 500, 180),
    ]);

    expect(result).toEqual({
      n1: { width: 520, height: 240 },
      n2: { width: 500, height: 180 },
    });
  });

  it('ignores selection changes', () => {
    const overrides: TOverrides = { n1: override() };

    const result = reduceNodeOverrides(overrides, [
      select('n1', true),
      select('n2', false),
    ]);

    expect(result).toEqual(overrides);
  });

  it('ignores changes without a usable payload', () => {
    const overrides: TOverrides = { n1: override() };

    const result = reduceNodeOverrides(overrides, [
      { id: 'n1', type: 'dimensions' },
      { id: 'n1', type: 'position' },
    ]);

    expect(result).toEqual(overrides);
  });

  it('does not mutate the input map or its entries and returns a new map', () => {
    const overrides: TOverrides = { n1: override({ width: 300, height: 200 }) };
    const snapshot = structuredClone(overrides);

    const result = reduceNodeOverrides(overrides, [
      dimensions('n1', 520, 300),
      position('n1', 12, 34),
    ]);

    expect(overrides).toEqual(snapshot);
    expect(result).not.toBe(overrides);
    expect(result.n1).not.toBe(overrides.n1);
    expect(result.n1).toEqual({ width: 520, height: 300, x: 12, y: 34 });
  });

  describe('reset base', () => {
    it('rebuilds from an empty map without leaking previous overrides', () => {
      const previous: TOverrides = { old: override({ x: 1, y: 2 }) };

      const result = reduceNodeOverrides({}, [dimensions('new', 520, 160)]);

      expect(result).toEqual({ new: { width: 520, height: 160 } });
      expect(result.old).toBeUndefined();
      expect(previous).toEqual({ old: override({ x: 1, y: 2 }) });
    });

    it('keeps an empty base empty when there is nothing to apply', () => {
      const result = reduceNodeOverrides({}, []);

      expect(result).toEqual({});
    });
  });
});
