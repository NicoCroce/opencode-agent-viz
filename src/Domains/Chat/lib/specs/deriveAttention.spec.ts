import { describe, expect, it } from 'vitest';
import type { PermissionRequest } from '@opencode/client';
import type {
  TGraphModel,
  TGraphNode,
} from '@app/Domains/Graph/Graph.entity';
import type { TAttentionItem } from '@app/Domains/Chat/Chat.entity';
import { deriveAttention } from '../deriveAttention';

/**
 * A1–A3 (`contracts/attention-contract.md` §1, data-model §2.3, research R6):
 * la derivación de atención es una función **pura** que cruza los nodos del
 * (sub)grafo en `waiting-permission`/`waiting-input` con la lista global
 * `permissions.list()` y produce `TAttentionItem[]` ordenado por `at`. Sin
 * pendientes → `[]` (FR-009/FR-011).
 */

type TMetrics = TGraphNode['data']['metrics'];

const metrics = (overrides: Partial<TMetrics> = {}): TMetrics => ({
  durationMs: null,
  startedAt: null,
  endedAt: null,
  cost: null,
  tokens: null,
  invocations: 0,
  retryCount: 0,
  hasLoop: false,
  loopEvidence: [],
  ...overrides,
});

/** Nodo con los defaults del modelo estructural (`buildGraph`). */
const node = (
  id: string,
  overrides: Partial<TGraphNode['data']> = {},
): TGraphNode => ({
  id,
  type: 'agent',
  position: { x: 0, y: 0 },
  data: {
    sessionId: id,
    title: null,
    createdAt: null,
    updatedAt: null,
    agentName: 'general',
    directory: '/repo',
    model: null,
    status: 'running',
    retry: null,
    interruptReason: null,
    metrics: metrics(),
    isRoot: false,
    currentTool: null,
    parallel: null,
    ...overrides,
  },
});

/** Grafo con aristas padre→hijo (`parentByChild`). */
const model = (
  nodes: TGraphNode[],
  parentByChild: Record<string, string> = {},
): TGraphModel => ({
  nodes,
  edges: Object.entries(parentByChild).map(([target, source]) => ({
    id: `${source}->${target}`,
    source,
    target,
    type: 'agent' as const,
  })),
});

const permission = (
  overrides: Partial<PermissionRequest> &
    Pick<PermissionRequest, 'id' | 'sessionID'>,
): PermissionRequest => ({
  action: 'bash',
  resources: ['echo hi'],
  ...overrides,
});

describe('deriveAttention', () => {
  it('returns an empty list without nodes or pendings (A3)', () => {
    expect(deriveAttention(model([]), [])).toEqual([]);
    expect(
      deriveAttention(
        model([node('root', { isRoot: true, status: 'running' })]),
        [],
      ),
    ).toEqual([]);
  });

  it('produces a permission item for a waiting-permission node (A1)', () => {
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-permission',
        updatedAt: 1000,
      }),
    ]);

    const items = deriveAttention(graph, [
      permission({
        id: 'perm_1',
        sessionID: 'root',
        action: 'bash',
        resources: ['rm -rf build'],
      }),
    ]);

    expect(items).toEqual<TAttentionItem[]>([
      {
        id: 'perm_1',
        kind: 'permission',
        sessionId: 'root',
        nodeId: 'root',
        title: 'bash',
        at: 1000,
      },
    ]);
  });

  it('reports a child pending with its origin sessionId (A2)', () => {
    const graph = model(
      [
        node('root', { isRoot: true, status: 'running' }),
        node('child', { status: 'waiting-permission', updatedAt: 2000 }),
      ],
      { child: 'root' },
    );

    const items = deriveAttention(graph, [
      permission({
        id: 'perm_child',
        sessionID: 'child',
        action: 'edit',
        resources: ['src/a.ts'],
      }),
    ]);

    expect(items).toEqual<TAttentionItem[]>([
      {
        id: 'perm_child',
        kind: 'permission',
        sessionId: 'child',
        nodeId: 'child',
        title: 'edit',
        at: 2000,
      },
    ]);
  });

  it('ignores a waiting-permission node without a matching permission', () => {
    const graph = model([
      node('root', { isRoot: true, status: 'waiting-permission' }),
    ]);

    expect(deriveAttention(graph, [])).toEqual([]);
  });

  it('ignores permissions whose session is not a waiting node in the graph', () => {
    const graph = model([
      node('root', { isRoot: true, status: 'running' }),
    ]);

    expect(
      deriveAttention(graph, [
        permission({ id: 'perm_1', sessionID: 'root' }),
        permission({ id: 'perm_orphan', sessionID: 'gone' }),
      ]),
    ).toEqual([]);
  });

  it('produces a question item for a waiting-input node', () => {
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-input',
        title: 'Elige una opción',
        updatedAt: 500,
      }),
    ]);

    expect(deriveAttention(graph, [])).toEqual<TAttentionItem[]>([
      {
        id: 'question:root',
        kind: 'question',
        sessionId: 'root',
        nodeId: 'root',
        title: 'Elige una opción',
        at: 500,
      },
    ]);
  });

  it('produces one item per matching permission of the same waiting node', () => {
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-permission',
        updatedAt: 1000,
      }),
    ]);

    const items = deriveAttention(graph, [
      permission({ id: 'perm_a', sessionID: 'root', action: 'bash' }),
      permission({ id: 'perm_b', sessionID: 'root', action: 'edit' }),
    ]);

    expect(items.map((item) => item.id)).toEqual(['perm_a', 'perm_b']);
    expect(items.map((item) => item.title)).toEqual(['bash', 'edit']);
    expect(items.every((item) => item.nodeId === 'root')).toBe(true);
  });

  it('keeps a waiting-input node as a question even with a matching permission', () => {
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-input',
        title: 'Elige',
        updatedAt: 500,
      }),
    ]);

    const items = deriveAttention(graph, [
      permission({ id: 'perm_1', sessionID: 'root' }),
    ]);

    expect(items).toEqual<TAttentionItem[]>([
      {
        id: 'question:root',
        kind: 'question',
        sessionId: 'root',
        nodeId: 'root',
        title: 'Elige',
        at: 500,
      },
    ]);
  });

  it('falls back to `at: 0` when the node has no updatedAt yet', () => {
    const graph = model([
      node('root', { isRoot: true, status: 'waiting-input', updatedAt: null }),
    ]);

    expect(deriveAttention(graph, [])[0]?.at).toBe(0);
  });

  it('orders the items by `at` ascending', () => {
    const graph = model(
      [
        node('root', { isRoot: true, status: 'waiting-permission', updatedAt: 3000 }),
        node('child', { status: 'waiting-permission', updatedAt: 1000 }),
      ],
      { child: 'root' },
    );

    const items = deriveAttention(graph, [
      permission({ id: 'perm_root', sessionID: 'root' }),
      permission({ id: 'perm_child', sessionID: 'child' }),
    ]);

    expect(items.map((item) => item.id)).toEqual(['perm_child', 'perm_root']);
    expect(items.map((item) => item.at)).toEqual([1000, 3000]);
  });

  it('does not mutate the graph or the permissions', () => {
    const graph = model([
      node('root', { isRoot: true, status: 'waiting-permission', updatedAt: 1 }),
    ]);
    const permissions = [permission({ id: 'perm_1', sessionID: 'root' })];
    const snapshot = structuredClone({ graph, permissions });

    deriveAttention(graph, permissions);

    expect(structuredClone({ graph, permissions })).toEqual(snapshot);
  });
});
