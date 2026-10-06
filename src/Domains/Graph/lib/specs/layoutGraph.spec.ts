import { describe, expect, it } from 'vitest';
import type { TGraphModel } from '../../Graph.entity';
import { topologySignature } from '../layoutGraph';

const model = (): TGraphModel => ({
  nodes: [
    {
      id: 'root',
      type: 'agent',
      position: { x: 0, y: 0 },
      data: {
        sessionId: 'root',
        title: 'root task',
        createdAt: null,
        updatedAt: null,
        agentName: 'develop',
        directory: '/repo',
        model: null,
        status: 'running',
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
        },
        isRoot: true,
        currentTool: null,
        parallel: null,
      },
    },
    {
      id: 'child',
      type: 'agent',
      position: { x: 0, y: 0 },
      data: {
        sessionId: 'child',
        title: 'child task',
        createdAt: null,
        updatedAt: null,
        agentName: 'explore',
        directory: '/repo',
        model: null,
        status: 'done',
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
        },
        isRoot: false,
        currentTool: null,
        parallel: null,
      },
    },
  ],
  edges: [
    { id: 'root->child', source: 'root', target: 'child', type: 'agent' },
  ],
});

describe('topologySignature', () => {
  it('keeps a stable signature when only data changes', () => {
    const first = model();
    const second = model();
    second.nodes[0].data.status = 'done';
    expect(topologySignature(first)).toBe(topologySignature(second));
  });

  it('changes the signature when topology changes', () => {
    const first = model();
    const second = model();
    second.edges = [];
    expect(topologySignature(first)).not.toBe(topologySignature(second));
  });
});
