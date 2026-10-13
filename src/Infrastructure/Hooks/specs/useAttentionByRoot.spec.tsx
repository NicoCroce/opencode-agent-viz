import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { permissionRequest } from '../../lib/specs/fixtures';
import { useAttentionByRoot } from '../useAttentionByRoot';

/**
 * `useAttentionByRoot` es el envoltorio memoizado de `countAttentionByRoot`
 * (FR-007): el badge del rail por **cada** sesión raíz. La raíz abierta suma su
 * subárbol y las preguntas; el resto solo cuenta su propia sesión. La
 * memoización se ancla a la identidad de sus cinco entradas (FR-019).
 */

describe('useAttentionByRoot — badge por raíz (FR-007)', () => {
  it('suma el subárbol de la raíz abierta y solo la sesión del resto', () => {
    const permissions = [
      permissionRequest({ id: 'perm_root', sessionID: 'root' }),
      permissionRequest({ id: 'perm_child', sessionID: 'child' }),
      permissionRequest({ id: 'perm_other', sessionID: 'other' }),
    ];

    const { result } = renderHook(() =>
      useAttentionByRoot({
        rootIds: ['root', 'other'],
        permissions,
        openRootId: 'root',
        openSubtreeSessionIds: new Set(['child']),
        openQuestionCount: 0,
      }),
    );

    expect(result.current).toEqual({ root: 2, other: 1 });
  });

  it('añade las preguntas del subárbol abierto a la raíz abierta', () => {
    const permissions = [permissionRequest({ id: 'perm_child', sessionID: 'child' })];

    const { result } = renderHook(() =>
      useAttentionByRoot({
        rootIds: ['root'],
        permissions,
        openRootId: 'root',
        openSubtreeSessionIds: new Set(['child']),
        openQuestionCount: 2,
      }),
    );

    expect(result.current).toEqual({ root: 3 });
  });

  it('sin raíz abierta (openRootId null) no añade preguntas', () => {
    const { result } = renderHook(() =>
      useAttentionByRoot({
        rootIds: ['a'],
        permissions: [],
        openRootId: null,
        openSubtreeSessionIds: new Set(['child']),
        openQuestionCount: 4,
      }),
    );

    expect(result.current).toEqual({ a: 0 });
  });

  it('una raíz sin permisos pendientes cuenta 0', () => {
    const { result } = renderHook(() =>
      useAttentionByRoot({
        rootIds: ['a', 'b'],
        permissions: [],
        openRootId: 'a',
        openSubtreeSessionIds: new Set(['b']),
        openQuestionCount: 0,
      }),
    );

    expect(result.current).toEqual({ a: 0, b: 0 });
  });

  it('no incluye la raíz ausente del conteo', () => {
    const permissions = [permissionRequest({ id: 'perm_a', sessionID: 'a' })];

    const { result } = renderHook(() =>
      useAttentionByRoot({
        rootIds: ['a'],
        permissions,
        openRootId: 'missing',
        openSubtreeSessionIds: new Set(),
        openQuestionCount: 3,
      }),
    );

    expect(result.current).toEqual({ a: 1 });
    expect(result.current).not.toHaveProperty('missing');
  });

  it('preserva la identidad del conteo mientras no cambian las entradas', () => {
    const params = {
      rootIds: ['a'],
      permissions: [permissionRequest({ id: 'perm_a', sessionID: 'a' })],
      openRootId: 'a',
      openSubtreeSessionIds: new Set<string>(),
      openQuestionCount: 0,
    };

    const { result, rerender } = renderHook(
      (props: typeof params) => useAttentionByRoot(props),
      { initialProps: params },
    );

    const first = result.current;
    rerender(params);

    expect(result.current).toBe(first);
  });

  it('recalcula cuando cambia la identidad de permissions', () => {
    const { result, rerender } = renderHook(
      ({ permissions }: { permissions: ReturnType<typeof permissionRequest>[] }) =>
        useAttentionByRoot({
          rootIds: ['a'],
          permissions,
          openRootId: 'a',
          openSubtreeSessionIds: new Set<string>(),
          openQuestionCount: 0,
        }),
      {
        initialProps: {
          permissions: [permissionRequest({ id: 'perm_a', sessionID: 'a' })],
        },
      },
    );

    const first = result.current;
    rerender({
      permissions: [
        permissionRequest({ id: 'perm_a', sessionID: 'a' }),
        permissionRequest({ id: 'perm_b', sessionID: 'a' }),
      ],
    });

    expect(result.current).not.toBe(first);
    expect(result.current).toEqual({ a: 2 });
  });
});
