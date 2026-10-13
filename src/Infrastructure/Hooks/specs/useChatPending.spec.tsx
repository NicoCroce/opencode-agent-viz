import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { PermissionRequest } from '@opencode/client';
import type { TAttentionItem, TChatPendingItem } from '@app/Domains/Chat';
import type { TGraphNode } from '@app/Domains/Graph';
import { queryKeys } from '@app/Domains/queryKeys';
import {
  attentionItem,
  formDetail,
  formInfo,
  permissionRequest,
} from '../../lib/specs/fixtures';
import { useChatPending } from '../useChatPending';

/**
 * Specs de `useChatPending` (feature 012, T008 · US3, FR-006).
 *
 * El hook compone la bandeja de pendientes del subárbol abierto a partir de tres
 * fuentes: la lista global `permissions.list()` que le **pasa el llamador**
 * (`listedPermissions`, única suscripción por clave), las semillas
 * `permissions.for(sessionId)` y los formularios `sessions.forms(sessionId)` de
 * las sesiones marcadas por `attention`. Deduplica por `permission.id` /
 * `question:<formId>` y respeta el `FormDetail` cacheado (una pregunta resuelta
 * no vuelve a la bandeja). La reactividad es **por props**.
 */

type TNodeMetrics = TGraphNode['data']['metrics'];

const metrics = (): TNodeMetrics => ({
  durationMs: null,
  startedAt: null,
  endedAt: null,
  cost: null,
  tokens: null,
  invocations: 0,
  retryCount: 0,
  hasLoop: false,
  loopEvidence: [],
});

/** Nodo con la forma exacta del modelo estructural (`buildGraph`). */
const node = (
  id: string,
  agentName: string,
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
    agentName,
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

/** Ids de los ítems de permiso (estrecha la unión discriminada). */
const permissionIds = (items: TChatPendingItem[]): string[] =>
  items.flatMap((item) =>
    item.kind === 'permission' ? [item.permission.id] : [],
  );

/** Ids de los ítems de pregunta (estrecha la unión discriminada). */
const questionIds = (items: TChatPendingItem[]): string[] =>
  items.flatMap((item) => (item.kind === 'question' ? [item.question.id] : []));

/** Renderiza el hook con un `QueryClient` sembrable y estable por test. */
const renderPending = (
  attention: TAttentionItem[],
  nodes: TGraphNode[],
  listedPermissions: PermissionRequest[] = [],
  seed: (queryClient: QueryClient) => void = () => {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  seed(queryClient);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const rendered = renderHook(
    ({ listed }: { listed: PermissionRequest[] }) =>
      useChatPending(attention, nodes, listed),
    { wrapper, initialProps: { listed: listedPermissions } },
  );
  /** Simula al llamador re-renderizando cuando cambia la caché que observa. */
  const relist = (listed: PermissionRequest[]): void =>
    rendered.rerender({ listed });
  return { ...rendered, queryClient, relist };
};

describe('useChatPending — permisos del subárbol (FR-006)', () => {
  it('returns an empty list without permissions or questions', () => {
    const { result } = renderPending([], [node('root', 'Root')]);

    expect(result.current).toEqual([]);
  });

  it('composes a permission from the listedPermissions prop with the node label', () => {
    const { result } = renderPending([], [node('root', 'Root Agent')], [
      permissionRequest({ id: 'perm_1', sessionID: 'root' }),
    ]);

    expect(result.current).toEqual<TChatPendingItem[]>([
      {
        kind: 'permission',
        originSessionId: 'root',
        originLabel: 'Root Agent',
        permission: {
          id: 'perm_1',
          action: 'bash',
          resources: ['echo hi'],
          message: null,
        },
      },
    ]);
  });

  it('ignores permissions from sessions outside the subtree', () => {
    const { result } = renderPending(
      [],
      [node('root', 'Root'), node('child', 'Child')],
      [
        permissionRequest({ id: 'perm_child', sessionID: 'child' }),
        permissionRequest({ id: 'perm_other', sessionID: 'other' }),
      ],
    );

    expect(permissionIds(result.current)).toEqual(['perm_child']);
  });

  it('falls back to permissions.for(sessionId) seed when list() is empty', () => {
    const { result } = renderPending([], [node('root', 'Root')], [], (qc) =>
      qc.setQueryData(queryKeys.permissions.for('root'), [
        permissionRequest({ id: 'perm_seed', sessionID: 'root' }),
      ]),
    );

    expect(permissionIds(result.current)).toEqual(['perm_seed']);
  });

  it('deduplicates a permission present in both list() and for()', () => {
    const { result } = renderPending(
      [],
      [node('root', 'Root')],
      [permissionRequest({ id: 'perm_1', sessionID: 'root' })],
      (qc) => {
        qc.setQueryData(queryKeys.permissions.for('root'), [
          permissionRequest({ id: 'perm_1', sessionID: 'root' }),
        ]);
      },
    );

    expect(result.current).toHaveLength(1);
    expect(permissionIds(result.current)).toEqual(['perm_1']);
  });
});

describe('useChatPending — preguntas accionables (FR-007)', () => {
  it('composes a question from sessions.forms() for an attention question', () => {
    const { result } = renderPending(
      [
        attentionItem({
          id: 'form_1',
          sessionId: 'child',
          kind: 'question',
        }),
      ],
      [node('child', 'Child')],
      [],
      (qc) =>
        qc.setQueryData(queryKeys.sessions.forms('child'), [
          formInfo({ id: 'form_1', sessionID: 'child' }),
        ]),
    );

    expect(result.current).toEqual<TChatPendingItem[]>([
      {
        kind: 'question',
        originSessionId: 'child',
        originLabel: 'Child',
        question: {
          id: 'form_1',
          title: '¿Aplicar el cambio?',
          fields: [
            {
              key: 'reason',
              title: 'Motivo',
              type: 'string',
              options: [
                { value: 'ok', label: 'Correcto' },
                { value: 'redo', label: 'Rehacer' },
              ],
            },
            {
              key: 'choice',
              title: 'Opción',
              type: 'multiselect',
              options: [
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ],
            },
          ],
          state: 'pending',
          answer: null,
        },
      },
    ]);
  });

  it('does not compose questions without a question attention item', () => {
    const { result } = renderPending(
      [],
      [node('child', 'Child')],
      [],
      (qc) =>
        qc.setQueryData(queryKeys.sessions.forms('child'), [
          formInfo({ id: 'form_1', sessionID: 'child' }),
        ]),
    );

    expect(result.current).toEqual([]);
  });

  it('skips a question whose cached FormDetail is not pending (FR-011)', () => {
    const { result } = renderPending(
      [
        attentionItem({
          id: 'form_1',
          sessionId: 'child',
          kind: 'question',
        }),
      ],
      [node('child', 'Child')],
      [],
      (qc) => {
        qc.setQueryData(queryKeys.sessions.forms('child'), [
          formInfo({ id: 'form_1', sessionID: 'child' }),
        ]);
        qc.setQueryData(
          [...queryKeys.sessions.forms('child'), 'form_1'],
          formDetail({
            id: 'form_1',
            sessionID: 'child',
            state: { status: 'answered', answer: { choice: 'a' } },
          }),
        );
      },
    );

    expect(result.current).toEqual([]);
  });

  it('deduplicates questions by formId', () => {
    const { result } = renderPending(
      [
        attentionItem({
          id: 'form_1',
          sessionId: 'child',
          kind: 'question',
        }),
      ],
      [node('child', 'Child')],
      [],
      (qc) =>
        qc.setQueryData(queryKeys.sessions.forms('child'), [
          formInfo({ id: 'form_1', sessionID: 'child' }),
          formInfo({ id: 'form_1', sessionID: 'child', title: 'Duplicada' }),
        ]),
    );

    expect(result.current).toHaveLength(1);
    expect(questionIds(result.current)).toEqual(['form_1']);
  });

  it('falls back to the sessionId as label when the node is absent', () => {
    const { result } = renderPending(
      [
        attentionItem({
          id: 'form_1',
          sessionId: 'ghost',
          kind: 'question',
        }),
      ],
      [node('child', 'Child')],
      [],
      (qc) =>
        qc.setQueryData(queryKeys.sessions.forms('ghost'), [
          formInfo({ id: 'form_1', sessionID: 'ghost' }),
        ]),
    );

    expect(result.current[0]?.originLabel).toBe('ghost');
  });
});

describe('useChatPending — reactividad por props', () => {
  it('recomposes when the caller re-renders with updated listedPermissions', () => {
    const { result, relist } = renderPending([], [node('root', 'Root')]);
    expect(result.current).toEqual([]);

    relist([permissionRequest({ id: 'perm_1', sessionID: 'root' })]);

    expect(permissionIds(result.current)).toEqual(['perm_1']);
  });
});
