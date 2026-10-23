import { describe, expect, it } from 'vitest';
import type { TGraphEdge, TGraphNode, TGraphModel } from '@app/Domains/Graph/Graph.entity';
import { EMPTY_METRICS } from '@app/Domains/Graph/Graph.entity';
import type { TNodeStatus } from '@app/Domains/Graph/Graph.entity';
import { buildEfficiencySessions } from '../buildEfficiencySessions';

/**
 * T011 (data-model §1.2, feature 015): la proyección del grafo al mapa de
 * sesiones del motor es pura. La raíz no tiene `parentID`, cada hijo toma el
 * `source` de su arista, `status` sale de `isActiveStatus` y nunca aparecen
 * sesiones que no estén en `graph.nodes`.
 */

const node = (id: string, status: TNodeStatus, isRoot = false): TGraphNode => ({
  id,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: id,
    title: null,
    createdAt: null,
    updatedAt: null,
    agentName: 'build',
    directory: '/repo',
    model: null,
    status,
    retry: null,
    interruptReason: null,
    metrics: EMPTY_METRICS,
    isRoot,
    currentTool: null,
    parallel: null,
  },
});

const edge = (source: string, target: string): TGraphEdge => ({
  id: `edge-${source}-${target}`,
  source,
  target,
  type: 'agent',
});

const graph = (nodes: TGraphNode[], edges: TGraphEdge[] = []): TGraphModel => ({
  nodes,
  edges,
});

describe('buildEfficiencySessions', () => {
  it('leaves the root without parentID and takes each child source from its edge', () => {
    const sessions = buildEfficiencySessions(
      graph(
        [
          node('root', 'succeeded', true),
          node('child', 'running'),
          node('grandchild', 'waiting-input'),
        ],
        [edge('root', 'child'), edge('child', 'grandchild')],
      ),
    );

    expect(sessions.root).not.toHaveProperty('parentID');
    expect(sessions.child).toEqual({ parentID: 'root', status: 'active' });
    expect(sessions.grandchild).toEqual({ parentID: 'child', status: 'active' });
  });

  it('marks active statuses as active and the rest as idle', () => {
    const sessions = buildEfficiencySessions(
      graph([
        node('root', 'running', true),
        node('retrying', 'retrying'),
        node('compacting', 'compacting'),
        node('waiting-permission', 'waiting-permission'),
        node('waiting-input', 'waiting-input'),
        node('created', 'created'),
        node('succeeded', 'succeeded'),
        node('failed', 'failed'),
        node('interrupted', 'interrupted'),
      ]),
    );

    expect(sessions.root.status).toBe('active');
    expect(sessions.retrying.status).toBe('active');
    expect(sessions.compacting.status).toBe('active');
    expect(sessions['waiting-permission'].status).toBe('active');
    expect(sessions['waiting-input'].status).toBe('active');
    expect(sessions.created.status).toBe('idle');
    expect(sessions.succeeded.status).toBe('idle');
    expect(sessions.failed.status).toBe('idle');
    expect(sessions.interrupted.status).toBe('idle');
  });

  it('returns an empty map for an empty graph', () => {
    expect(buildEfficiencySessions(graph([]))).toEqual({});
  });

  it('leaves a node without an incoming edge without parentID', () => {
    const sessions = buildEfficiencySessions(
      graph([node('root', 'succeeded', true), node('orphan', 'succeeded')]),
    );

    expect(sessions.orphan).not.toHaveProperty('parentID');
    expect(sessions.orphan).toEqual({ status: 'idle' });
  });

  it('never invents sessions outside graph.nodes', () => {
    const sessions = buildEfficiencySessions(
      graph(
        [node('root', 'succeeded', true), node('child', 'succeeded')],
        [edge('root', 'child'), edge('child', 'missing-node')],
      ),
    );

    expect(Object.keys(sessions).sort()).toEqual(['child', 'root']);
    expect(sessions).not.toHaveProperty('missing-node');
  });

  it('does not mutate the graph', () => {
    const model = graph(
      [node('root', 'succeeded', true), node('child', 'running')],
      [edge('root', 'child')],
    );
    const snapshot = JSON.stringify(model);

    buildEfficiencySessions(model);

    expect(JSON.stringify(model)).toBe(snapshot);
  });
});
