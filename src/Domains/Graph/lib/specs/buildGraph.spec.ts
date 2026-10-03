import { describe, expect, it } from 'vitest';
import type {
  PermissionRequest,
  SessionInfo,
  SessionMessageAssistant,
  SessionStatus,
} from '@opencode/client';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { buildGraph, type BuildGraphInput } from '../buildGraph';

const emptyTokens = {
  input: 0,
  output: 0,
  reasoning: 0,
  cache: { read: 0, write: 0 },
};

const session = (id: string, parentID?: string): SessionInfo => ({
  id,
  parentID,
  projectID: 'proj',
  agent: parentID === undefined ? 'develop' : 'explore',
  cost: 0,
  tokens: emptyTokens,
  time: { created: 1, updated: 2 },
  location: { directory: '/repo' },
});

const assistant = (
  overrides: Partial<SessionMessageAssistant> = {},
): TSessionMessage => {
  const info: SessionMessageAssistant = {
    id: 'msg_1',
    time: { created: 2, completed: 5 },
    type: 'assistant',
    agent: 'develop',
    model: { providerID: 'opencode', id: 'deepseek' },
    content: [],
    cost: 0.01,
    tokens: { input: 10, output: 5, reasoning: 0, cache: { read: 0, write: 0 } },
    ...overrides,
  };
  return { info, parts: info.content };
};

const baseInput = (
  overrides: Partial<BuildGraphInput> = {},
): BuildGraphInput => ({
  sessions: [session('root')],
  statuses: {},
  agents: [],
  messages: { root: [assistant()] },
  permissions: [],
  now: 10,
  ...overrides,
});

describe('buildGraph', () => {
  it('creates one node per session and an edge per parent relation', () => {
    const graph = buildGraph(
      baseInput({
        sessions: [session('root'), session('child', 'root')],
        messages: {
          root: [assistant()],
          child: [assistant({ agent: 'explore' })],
        },
      }),
    );
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(['child', 'root']);
    expect(graph.edges).toEqual([
      { id: 'root->child', source: 'root', target: 'child', type: 'agent' },
    ]);
    expect(graph.nodes.find((n) => n.id === 'child')?.data.agentName).toBe(
      'explore',
    );
    expect(graph.nodes.find((n) => n.id === 'root')?.data.isRoot).toBe(true);
  });

  it('handles a session with no subagents as a single root node', () => {
    const graph = buildGraph(baseInput());
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
    expect(graph.nodes[0].data.agentName).toBe('develop');
  });

  it('reflects running status from a busy session', () => {
    const statuses: Record<string, SessionStatus> = { root: { type: 'busy' } };
    const graph = buildGraph(baseInput({ statuses }));
    expect(graph.nodes[0].data.status).toBe('running');
  });

  it('prioritizes waiting (pending permission) over running', () => {
    const permission: PermissionRequest = {
      id: 'p1',
      sessionID: 'root',
      action: 'bash',
      resources: ['echo hi'],
    };
    const graph = buildGraph(
      baseInput({
        statuses: { root: { type: 'busy' } },
        permissions: [permission],
      }),
    );
    expect(graph.nodes[0].data.status).toBe('waiting');
  });

  it('keeps the waiting state when the session ends with a pending permission', () => {
    const permission: PermissionRequest = {
      id: 'p1',
      sessionID: 'root',
      action: 'bash',
      resources: ['echo hi'],
    };
    const graph = buildGraph(
      baseInput({
        statuses: { root: { type: 'idle' } },
        permissions: [permission],
      }),
    );
    expect(graph.nodes[0].data.status).toBe('waiting');
  });

  it('marks error status from an assistant error', () => {
    const graph = buildGraph(
      baseInput({
        messages: {
          root: [assistant({ error: { type: 'api', message: 'boom' } })],
        },
      }),
    );
    expect(graph.nodes[0].data.status).toBe('error');
  });

  it('derives model and metrics from assistant messages', () => {
    const graph = buildGraph(baseInput());
    expect(graph.nodes[0].data.model).toEqual({
      providerID: 'opencode',
      id: 'deepseek',
    });
    expect(graph.nodes[0].data.metrics.durationMs).toBe(3);
    expect(graph.nodes[0].data.metrics.cost).toBeCloseTo(0.01, 5);
  });
});
