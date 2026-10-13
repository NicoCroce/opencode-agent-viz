import { useMemo } from 'react';
import type { PermissionRequest } from '@opencode/client';
import { countAttentionByRoot } from '../lib/countAttentionByRoot';

interface UseAttentionByRootParams {
  rootIds: string[];
  permissions: PermissionRequest[];
  openRootId: string | null;
  openSubtreeSessionIds: ReadonlySet<string>;
  openQuestionCount: number;
}

/**
 * Envoltorio memoizado de `countAttentionByRoot` (T010, FR-007): deriva el badge
 * de atención por **cada** sesión raíz del rail, contando los permisos de su
 * subárbol (el completo solo para la raíz abierta; para el resto, la propia
 * sesión) más las preguntas del subárbol abierto.
 *
 * `useSessionAttention` solo cubre el subárbol abierto, así que el data-fetching
 * cross-domain sigue viviendo en la página (Principio II) y aquí solo se
 * delega. El `useMemo` se ancla a la **identidad** de sus cinco entradas
 * (`rootIds`, `permissions`, `openRootId`, `openSubtreeSessionIds` y
 * `openQuestionCount`), que son las mismas claves del `useMemo` que reemplaza
 * (FR-019): mientras no cambien de referencia, el conteo no se recalcula.
 */
export const useAttentionByRoot = ({
  rootIds,
  permissions,
  openRootId,
  openSubtreeSessionIds,
  openQuestionCount,
}: UseAttentionByRootParams): Record<string, number> =>
  useMemo(
    () =>
      countAttentionByRoot(
        rootIds,
        permissions,
        openRootId,
        openSubtreeSessionIds,
        openQuestionCount,
      ),
    [
      rootIds,
      permissions,
      openRootId,
      openSubtreeSessionIds,
      openQuestionCount,
    ],
  );
