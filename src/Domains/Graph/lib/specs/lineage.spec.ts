import { describe, expect, it } from 'vitest';
import type { TGraphEdge, TGraphModel, TGraphNode } from '../../Graph.entity';
import { EMPTY_METRICS } from '../../Graph.entity';
import { deriveLineage } from '../lineage';

const node = (id: string): TGraphNode => ({
  id,
  type: 'agent',
  position: { x: 0, y: 0 },
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
    isRoot: id === 'A',
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
 * A
 * ├─ B
 * │  ├─ B1
 * │  └─ B2
 * └─ C
 *    └─ C1
 */
const model = (): TGraphModel => ({
  nodes: ['A', 'B', 'C', 'B1', 'B2', 'C1'].map(node),
  edges: [
    edge('A', 'B'),
    edge('A', 'C'),
    edge('B', 'B1'),
    edge('B', 'B2'),
    edge('C', 'C1'),
  ],
});

const sorted = (values: Set<string>): string[] => [...values].sort();

describe('deriveLineage', () => {
  it('returns null when there is no selection', () => {
    expect(deriveLineage(model(), null)).toBeNull();
  });

  it('returns null when the node is not in the model', () => {
    expect(deriveLineage(model(), 'missing')).toBeNull();
  });

  it('includes ancestors and descendants of the selected node', () => {
    const lineage = deriveLineage(model(), 'B');
    expect(lineage).not.toBeNull();
    expect(sorted(lineage!.nodeIds)).toEqual(['A', 'B', 'B1', 'B2']);
  });

  it('includes only ancestors when selecting a leaf', () => {
    const lineage = deriveLineage(model(), 'B1');
    expect(sorted(lineage!.nodeIds)).toEqual(['A', 'B', 'B1']);
  });

  it('includes the whole tree when selecting the root', () => {
    const lineage = deriveLineage(model(), 'A');
    expect(sorted(lineage!.nodeIds)).toEqual(['A', 'B', 'B1', 'B2', 'C', 'C1']);
  });

  it('excludes sibling branches that are not in the lineage', () => {
    const lineage = deriveLineage(model(), 'B');
    expect(lineage!.nodeIds.has('C')).toBe(false);
    expect(lineage!.nodeIds.has('C1')).toBe(false);
  });

  it('keeps only edges whose both endpoints are in the lineage', () => {
    const lineage = deriveLineage(model(), 'B');
    expect(sorted(lineage!.edgeIds)).toEqual([
      'A->B',
      'B->B1',
      'B->B2',
    ]);
  });

  it('keeps every edge when selecting the root', () => {
    const lineage = deriveLineage(model(), 'A');
    expect(lineage!.edgeIds.size).toBe(5);
  });
});
