import { useMemo } from 'react';
import type { TGraphNode } from '@app/Domains/Graph';
import type { TSessionSummary } from '@app/Domains/Inspector';
import {
  deriveGraphPaneHeadline,
  type TGraphPaneHeadline,
} from '../lib/workspaceHeadline';

/**
 * Cabecera del panel del grafo (eyebrow de estado + título de la sesión),
 * memoizada sobre los nodos y el resumen. La derivación vive en
 * `deriveGraphPaneHeadline` (pura); `GraphPane` solo la pinta.
 */
export const useGraphPaneHeadline = (
  nodes: readonly TGraphNode[],
  rootId: string | null,
  summary: TSessionSummary | null,
): TGraphPaneHeadline =>
  useMemo(
    () => deriveGraphPaneHeadline(nodes, rootId, summary),
    [nodes, rootId, summary],
  );
