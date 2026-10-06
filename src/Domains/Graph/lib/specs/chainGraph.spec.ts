import { describe, expect, it } from 'vitest';
import type { TGraphEdge, TGraphModel, TGraphNode } from '../../Graph.entity';
import { EMPTY_METRICS } from '../../Graph.entity';
import { NODE_WIDTH } from '../layoutGraph';
import { buildChain, CHAIN_GAP, layoutChain } from '../chainGraph';

// Contrato: `specs/002-viz-ux-refinements/contracts/graph-view-contract.md`.

const node = (id: string): TGraphNode => ({
  id,
  type: 'agent',
  position: { x: 0, y: 0 },
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

const edge = (source: string, target: string): TGraphEdge => ({
  id: `${source}->${target}`,
  source,
  target,
  type: 'agent',
});

/**
 * Árbol sintético con una cadena `root -> child -> grandchild` y una rama
 * hermana `root -> sibling -> niece` (descendiente que no debe entrar en la
 * cadena de `child`/`grandchild`).
 */
const model = (): TGraphModel => ({
  nodes: [
    node('root'),
    node('child'),
    node('grandchild'),
    node('sibling'),
    node('niece'),
  ],
  edges: [
    edge('root', 'child'),
    edge('child', 'grandchild'),
    edge('root', 'sibling'),
    edge('sibling', 'niece'),
  ],
});

const chainFor = (id: string): TGraphModel => {
  const chain = buildChain(model(), id);
  if (!chain) throw new Error(`expected a chain for "${id}"`);
  return chain;
};

const ids = (m: TGraphModel): string[] => m.nodes.map((n) => n.id);

describe('buildChain', () => {
  it('returns the ancestors ordered root -> node with only the connecting edges', () => {
    const chain = buildChain(model(), 'grandchild');

    expect(ids(chain as TGraphModel)).toEqual(['root', 'child', 'grandchild']);
    expect((chain as TGraphModel).edges.map((e) => e.id)).toEqual([
      'root->child',
      'child->grandchild',
    ]);
  });

  it('returns a single root node without edges when nodeId is the root', () => {
    const chain = chainFor('root');

    expect(ids(chain)).toEqual(['root']);
    expect(chain.edges).toEqual([]);
  });

  it('returns null when nodeId is not present in the model', () => {
    expect(buildChain(model(), 'missing')).toBeNull();
  });

  it('ignores siblings and descendants of the selected node', () => {
    const chain = chainFor('child');

    expect(ids(chain)).toEqual(['root', 'child']);
    expect(chain.edges.map((e) => e.id)).toEqual(['root->child']);
  });
});

describe('layoutChain', () => {
  it('keeps y constant and increases x by NODE_WIDTH + CHAIN_GAP', () => {
    const laid = layoutChain(chainFor('grandchild'));

    expect(laid.nodes.map((n) => n.position.y)).toEqual([0, 0, 0]);
    expect(laid.nodes.map((n) => n.position.x)).toEqual([
      0,
      NODE_WIDTH + CHAIN_GAP,
      2 * (NODE_WIDTH + CHAIN_GAP),
    ]);
  });

  it('respects the order received instead of re-sorting the nodes', () => {
    const reordered: TGraphModel = {
      nodes: [node('grandchild'), node('child'), node('root')],
      edges: [],
    };

    const laid = layoutChain(reordered);

    expect(ids(laid)).toEqual(['grandchild', 'child', 'root']);
    expect(laid.nodes.map((n) => n.position.x)).toEqual([
      0,
      NODE_WIDTH + CHAIN_GAP,
      2 * (NODE_WIDTH + CHAIN_GAP),
    ]);
  });

  it('preserves the chain nodes and edges', () => {
    const chain = chainFor('grandchild');

    const laid = layoutChain(chain);

    expect(ids(laid)).toEqual(ids(chain));
    expect(laid.edges).toEqual(chain.edges);
  });
});
