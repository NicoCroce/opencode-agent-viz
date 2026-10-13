import type { PermissionRequest } from '@opencode/client';

/**
 * Conteo de atención por sesión raíz para el rail (T073, FR-009/US5).
 *
 * `useSessionAttention` solo cubre el **subárbol abierto**; el rail necesita un
 * badge por **cada** raíz. Se cuentan los permisos abiertos de
 * `permissions.list()` que pertenecen al subárbol de cada raíz (el del grafo
 * abierto es el único árbol completo que conocemos; para el resto basta la
 * propia sesión) y se añaden las **preguntas** del subárbol abierto, que solo
 * `useSessionAttention` puede derivar. Función **pura**: no muta las entradas ni
 * duplica la derivación de `deriveAttention`.
 */
export const countAttentionByRoot = (
  roots: string[],
  permissions: PermissionRequest[],
  openRootId: string | null,
  openSubtreeSessionIds: ReadonlySet<string>,
  openQuestionCount: number,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const rootId of roots) {
    const sessionIds =
      rootId === openRootId
        ? new Set([...openSubtreeSessionIds, rootId])
        : new Set([rootId]);
    counts[rootId] = permissions.filter((permission) =>
      sessionIds.has(permission.sessionID),
    ).length;
  }
  if (openRootId !== null && counts[openRootId] !== undefined) {
    counts[openRootId] += openQuestionCount;
  }
  return counts;
};
