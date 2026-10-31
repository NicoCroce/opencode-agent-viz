import { describe, expect, it } from 'vitest';
import { TREE_RANK_SEP, layoutTree } from '../layoutTree';

const node = (id: string, height = 100) => ({ id, width: 200, height });

describe('layoutTree', () => {
  it('returns no positions for an empty graph', () => {
    expect(layoutTree([], [])).toEqual({});
  });

  it('places children below their parent, one rank apart', () => {
    const positions = layoutTree(
      [node('root'), node('a'), node('b')],
      [
        { source: 'root', target: 'a' },
        { source: 'root', target: 'b' },
      ],
    );

    expect(positions.a.y).toBe(positions.root.y + 100 + TREE_RANK_SEP);
    expect(positions.b.y).toBe(positions.a.y);
    expect(positions.a.x).not.toBe(positions.b.x);
  });

  it('top-aligns siblings of different heights so they share one edge bus', () => {
    const positions = layoutTree(
      [node('root'), node('short', 80), node('tall', 160)],
      [
        { source: 'root', target: 'short' },
        { source: 'root', target: 'tall' },
      ],
    );

    expect(positions.short.y).toBe(positions.tall.y);
  });

  it('centers a single child under its parent', () => {
    const positions = layoutTree(
      [node('root'), node('child')],
      [{ source: 'root', target: 'child' }],
    );

    expect(positions.child.x).toBe(positions.root.x);
  });

  it('ignores edges whose endpoints are not in the node list', () => {
    const positions = layoutTree(
      [node('root')],
      [{ source: 'root', target: 'missing' }],
    );

    expect(Object.keys(positions)).toEqual(['root']);
  });
});
