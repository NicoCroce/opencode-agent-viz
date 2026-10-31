import { describe, expect, it } from 'vitest';
import { MIN_READABLE_ZOOM, readableViewport } from '../readableViewport';

const pane = { width: 1000, height: 800 };

describe('readableViewport', () => {
  it('returns null when the full fit is already readable', () => {
    const bounds = { x: 0, y: 0, width: 800, height: 600 };

    expect(readableViewport(bounds, pane)).toBeNull();
  });

  it('frames from the top at readable zoom when the fit would shrink too much', () => {
    const bounds = { x: 100, y: 50, width: 900, height: 4000 };
    const viewport = readableViewport(bounds, pane);

    expect(viewport?.zoom).toBe(MIN_READABLE_ZOOM);
    // Arriba con margen: el primer nodo queda a 24px del borde superior.
    expect(viewport!.y + bounds.y * viewport!.zoom).toBe(24);
    // Cabe a lo ancho: queda centrado en X.
    const left = viewport!.x + bounds.x * viewport!.zoom;
    expect(left).toBeCloseTo((pane.width - bounds.width * MIN_READABLE_ZOOM) / 2);
  });

  it('aligns to the left margin when the graph is wider than the pane', () => {
    const bounds = { x: 0, y: 0, width: 3000, height: 4000 };
    const viewport = readableViewport(bounds, pane);

    expect(viewport?.x).toBe(24);
  });

  it('centers the anchor when the graph is wider than the pane', () => {
    const bounds = { x: 0, y: 0, width: 3000, height: 4000 };
    const viewport = readableViewport(bounds, pane, MIN_READABLE_ZOOM, 1500);

    expect(viewport?.x).toBeCloseTo(500 - 1500 * MIN_READABLE_ZOOM);
  });

  it('clamps an anchor near the edge so no empty space shows past the content', () => {
    const bounds = { x: 0, y: 0, width: 3000, height: 4000 };

    expect(readableViewport(bounds, pane, MIN_READABLE_ZOOM, 0)?.x).toBe(24);
    expect(
      readableViewport(bounds, pane, MIN_READABLE_ZOOM, 3000)?.x,
    ).toBeCloseTo(1000 - 24 - 3000 * MIN_READABLE_ZOOM);
  });

  it('returns null for empty bounds or an unmeasured pane', () => {
    expect(
      readableViewport({ x: 0, y: 0, width: 0, height: 0 }, pane),
    ).toBeNull();
    expect(
      readableViewport({ x: 0, y: 0, width: 900, height: 4000 }, { width: 0, height: 0 }),
    ).toBeNull();
  });
});
