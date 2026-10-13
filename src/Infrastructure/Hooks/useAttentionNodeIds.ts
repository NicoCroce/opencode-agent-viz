import { useMemo } from 'react';
import type { TAttentionItem } from '@app/Domains/Chat';

/**
 * Realce del grafo (T009/T072, FR-007). Deriva de la **única fuente** de
 * atención (`TAttentionItem[]`) el `Set` de nodos afectados que viaja por
 * `GraphPane` → `AgentGraph` → `useGraphFocusModel` hasta el contexto del nodo,
 * sin tocar `data` ni re-layoutar (Principio VII / FR-016).
 *
 * Un ítem sin nodo en el subárbol (`nodeId === null`) no realza nada y se
 * descarta. El `useMemo` se ancla a la **identidad** de `attention` (FR-019):
 * mientras el array no cambie de referencia, el `Set` no se recalcula ni se
 * recrea, así que el contexto del nodo no re-renderiza.
 */
export const useAttentionNodeIds = (
  attention: TAttentionItem[],
): ReadonlySet<string> =>
  useMemo(
    () =>
      new Set(
        attention
          .map((item) => item.nodeId)
          .filter((nodeId): nodeId is string => nodeId !== null),
      ),
    [attention],
  );
