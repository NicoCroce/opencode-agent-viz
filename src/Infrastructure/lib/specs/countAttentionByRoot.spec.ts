import { describe, expect, it } from 'vitest';
import type { PermissionRequest } from '@opencode/client';
import { countAttentionByRoot } from '../countAttentionByRoot';

/**
 * T073 (FR-009/US5): el badge del rail cuenta, por raíz, los permisos del
 * subárbol abierto (solo cuando corresponde) o de la propia sesión, más las
 * preguntas del subárbol abierto. Función pura: no muta las entradas.
 */

const permission = (
  overrides: Partial<PermissionRequest> &
    Pick<PermissionRequest, 'id' | 'sessionID'>,
): PermissionRequest => ({
  action: 'bash',
  resources: ['echo hi'],
  ...overrides,
});

describe('countAttentionByRoot', () => {
  it('counts only the root session for roots that are not open', () => {
    const permissions = [
      permission({ id: 'perm_1', sessionID: 'a' }),
      permission({ id: 'perm_2', sessionID: 'b-child' }),
      permission({ id: 'perm_3', sessionID: 'c' }),
    ];

    expect(
      countAttentionByRoot(['a', 'c'], permissions, null, new Set(), 0),
    ).toEqual({ a: 1, c: 1 });
  });

  it('sums the whole open subtree for the open root', () => {
    const permissions = [
      permission({ id: 'perm_1', sessionID: 'root' }),
      permission({ id: 'perm_2', sessionID: 'child' }),
      permission({ id: 'perm_3', sessionID: 'grandchild' }),
      permission({ id: 'perm_4', sessionID: 'other' }),
    ];

    expect(
      countAttentionByRoot(
        ['root', 'other'],
        permissions,
        'root',
        new Set(['child', 'grandchild']),
        0,
      ),
    ).toEqual({ root: 3, other: 1 });
  });

  it('adds openQuestionCount to the open root', () => {
    const permissions = [permission({ id: 'perm_1', sessionID: 'child' })];

    expect(
      countAttentionByRoot(['root'], permissions, 'root', new Set(['child']), 2),
    ).toEqual({ root: 3 });
  });

  it('ignores openQuestionCount when the open root is absent', () => {
    expect(
      countAttentionByRoot(['a'], [], null, new Set(['child']), 4),
    ).toEqual({ a: 0 });
    expect(
      countAttentionByRoot(['a'], [], 'missing', new Set(['child']), 4),
    ).toEqual({ a: 0 });
  });

  it('returns a zero count for roots without pending permissions', () => {
    expect(
      countAttentionByRoot(['a', 'b'], [], 'a', new Set(['b']), 0),
    ).toEqual({ a: 0, b: 0 });
  });

  it('does not mutate its inputs', () => {
    const roots = ['root', 'other'];
    const permissions = [
      permission({ id: 'perm_1', sessionID: 'root' }),
      permission({ id: 'perm_2', sessionID: 'child' }),
    ];
    const subtree = new Set(['child']);

    countAttentionByRoot(roots, permissions, 'root', subtree, 1);

    expect(roots).toEqual(['root', 'other']);
    expect(permissions).toHaveLength(2);
    expect(subtree).toEqual(new Set(['child']));
    expect(subtree.has('root')).toBe(false);
  });
});
