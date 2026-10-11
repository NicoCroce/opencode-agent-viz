import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { FormInfo, PermissionRequest } from '@opencode/client';
import type {
  TGraphModel,
  TGraphNode,
} from '@app/Domains/Graph/Graph.entity';
import type { TAttentionItem } from '../../Chat.entity';
import { queryKeys } from '../../../queryKeys';
import { useSessionAttention } from '../useSessionAttention';

/**
 * Specs de `useSessionAttention` (feature 009, T049 · US5, FR-009/FR-011).
 *
 * El hook es la **única fuente** de la atención de la sesión abierta: acota el
 * grafo al **subárbol** de `rootId` (raíz + descendientes), lo cruza con la
 * lista global `permissions.list()` y delega en la función pura `deriveAttention`
 * (`contracts/attention-contract.md §1`). Devuelve `TAttentionItem[]` ordenado
 * por `at`. Además enriquece los ítems de pregunta con el `FormInfo` real
 * (`sessions.forms(id)`) para que `id`/`title` no dependan del título del nodo.
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

const form = (
  overrides: Partial<FormInfo> & Pick<FormInfo, 'id' | 'sessionID'>,
): FormInfo => ({
  title: 'Pregunta',
  fields: [{ key: 'answer', type: 'string' }],
  ...overrides,
});

/** Renderiza el hook con un `QueryClient` sembrable y estable por test. */
const renderAttention = (
  rootId: string | null,
  graph: TGraphModel,
  seed: (queryClient: QueryClient) => void = () => {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  seed(queryClient);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(() => useSessionAttention(rootId, graph), {
    wrapper,
  });
  return { ...rendered, queryClient };
};

describe('useSessionAttention — subárbol y permisos (FR-009)', () => {
  it('returns an empty list without a rootId (A3)', () => {
    const graph = model([
      node('root', { isRoot: true, status: 'waiting-permission' }),
    ]);

    const { result } = renderAttention(null, graph);

    expect(result.current).toEqual([]);
  });

  it('returns an empty list without pendings (A3)', () => {
    const graph = model(
      [
        node('root', { isRoot: true, status: 'running' }),
        node('child', { status: 'succeeded' }),
      ],
      { child: 'root' },
    );

    const { result } = renderAttention('root', graph);

    expect(result.current).toEqual([]);
  });

  it('produces a permission item from the global permissions.list() (A1)', () => {
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-permission',
        updatedAt: 1000,
      }),
    ]);

    const { result } = renderAttention('root', graph, (queryClient) =>
      queryClient.setQueryData(
        queryKeys.permissions.list(),
        [permission({ id: 'perm_1', sessionID: 'root', action: 'edit' })],
      ),
    );

    expect(result.current).toEqual<TAttentionItem[]>([
      {
        id: 'perm_1',
        kind: 'permission',
        sessionId: 'root',
        nodeId: 'root',
        title: 'edit',
        at: 1000,
      },
    ]);
  });

  it('reports a descendant pending with its origin sessionId (A2)', () => {
    const graph = model(
      [
        node('root', { isRoot: true, status: 'running' }),
        node('child', { status: 'waiting-permission', updatedAt: 2000 }),
      ],
      { child: 'root' },
    );

    const { result } = renderAttention('root', graph, (queryClient) =>
      queryClient.setQueryData(queryKeys.permissions.list(), [
        permission({ id: 'perm_child', sessionID: 'child', action: 'bash' }),
      ]),
    );

    expect(result.current).toEqual<TAttentionItem[]>([
      {
        id: 'perm_child',
        kind: 'permission',
        sessionId: 'child',
        nodeId: 'child',
        title: 'bash',
        at: 2000,
      },
    ]);
  });

  it('scopes the graph to the root subtree and ignores other branches', () => {
    // `other` cuelga de `uncle` (fuera del subárbol de `root`): su pendiente no
    // debe aparecer aunque deriveAttention sobre el grafo completo lo vería.
    const graph = model(
      [
        node('root', { isRoot: true, status: 'running' }),
        node('child', { status: 'waiting-permission', updatedAt: 2000 }),
        node('uncle', { status: 'running' }),
        node('other', { status: 'waiting-permission', updatedAt: 1000 }),
      ],
      { child: 'root', other: 'uncle' },
    );

    const { result } = renderAttention('root', graph, (queryClient) =>
      queryClient.setQueryData(queryKeys.permissions.list(), [
        permission({ id: 'perm_child', sessionID: 'child' }),
        permission({ id: 'perm_other', sessionID: 'other' }),
      ]),
    );

    expect(result.current.map((item) => item.id)).toEqual(['perm_child']);
  });

  it('orders the items by `at` ascending', () => {
    const graph = model(
      [
        node('root', {
          isRoot: true,
          status: 'waiting-permission',
          updatedAt: 3000,
        }),
        node('child', { status: 'waiting-permission', updatedAt: 1000 }),
      ],
      { child: 'root' },
    );

    const { result } = renderAttention('root', graph, (queryClient) =>
      queryClient.setQueryData(queryKeys.permissions.list(), [
        permission({ id: 'perm_root', sessionID: 'root' }),
        permission({ id: 'perm_child', sessionID: 'child' }),
      ]),
    );

    expect(result.current.map((item) => item.at)).toEqual([1000, 3000]);
  });

  it('reacts to permissions.list() updates (FR-011)', () => {
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-permission',
        updatedAt: 1000,
      }),
    ]);

    const { result, queryClient } = renderAttention('root', graph);
    expect(result.current).toEqual([]);

    act(() => {
      queryClient.setQueryData(queryKeys.permissions.list(), [
        permission({ id: 'perm_1', sessionID: 'root' }),
      ]);
    });

    expect(result.current.map((item) => item.id)).toEqual(['perm_1']);

    act(() => {
      queryClient.setQueryData(queryKeys.permissions.list(), []);
    });

    expect(result.current).toEqual([]);
  });
});

describe('useSessionAttention — enriquecimiento de preguntas (T048 pendiente)', () => {
  it('falls back to the node title when no form is cached', () => {
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-input',
        title: 'Elige una opción',
        updatedAt: 500,
      }),
    ]);

    const { result } = renderAttention('root', graph);

    expect(result.current).toEqual<TAttentionItem[]>([
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

  it('enriches the id and title with the cached FormInfo', () => {
    const graph = model([
      node('root', {
        isRoot: true,
        status: 'waiting-input',
        title: 'Título del nodo',
        updatedAt: 500,
      }),
    ]);

    const { result } = renderAttention('root', graph, (queryClient) =>
      queryClient.setQueryData(queryKeys.sessions.forms('root'), [
        form({ id: 'form_1', sessionID: 'root', title: '¿Continuar?' }),
      ]),
    );

    expect(result.current).toEqual<TAttentionItem[]>([
      {
        id: 'form_1',
        kind: 'question',
        sessionId: 'root',
        nodeId: 'root',
        title: '¿Continuar?',
        at: 500,
      },
    ]);
  });

  it('re-enriches when the forms cache arrives after mount', () => {
    const graph = model([
      node('child', { status: 'waiting-input', title: 'Título del nodo' }),
    ]);

    const { result, queryClient } = renderAttention('child', graph);
    expect(result.current[0]?.id).toBe('question:child');

    act(() => {
      queryClient.setQueryData(queryKeys.sessions.forms('child'), [
        form({ id: 'form_child', sessionID: 'child', title: 'Elige' }),
      ]);
    });

    expect(result.current[0]?.id).toBe('form_child');
    expect(result.current[0]?.title).toBe('Elige');
  });
});
