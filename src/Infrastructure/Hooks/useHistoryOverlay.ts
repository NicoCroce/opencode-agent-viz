import { useCallback, useMemo, useState } from 'react';
import type { TGraphModel, TGraphNode } from '@app/Domains/Graph';
import type { TLineageNav } from '@app/Domains/History';
import { EMPTY_LINEAGE } from '../WorkspacePage.constants';

interface UseHistoryOverlayParams {
  graph: TGraphModel;
  targetId: string | null;
  rootId: string | null;
  isLoading: boolean;
  isError: boolean;
  onClose: () => void;
}

interface UseHistoryOverlayResult {
  node: TGraphNode | null;
  lineage: TLineageNav;
  missingId: string | null;
  clearMissing: () => void;
}

/**
 * Estado de vista del overlay de histórico derivado del grafo (FR-008/012/014):
 *
 * - Al cambiar la sesión raíz se cierra el overlay (FR-014).
 * - Si el objetivo desapareció del grafo (edge case) se marca "no disponible" y
 *   se cierra, esperando a que el grafo resuelva para no marcar mientras carga.
 * - Se deriva el linaje padre/hijos del objetivo a partir de las aristas.
 *
 * Los ajustes de estado se hacen **durante el render** siguiendo el patrón de
 * `useChainSelection`, para evitar renders en cascada.
 */
export const useHistoryOverlay = ({
  graph,
  targetId,
  rootId,
  isLoading,
  isError,
  onClose,
}: UseHistoryOverlayParams): UseHistoryOverlayResult => {
  const [historyRootId, setHistoryRootId] = useState(rootId);
  const [missingId, setMissingId] = useState<string | null>(null);

  // Al cambiar la sesión raíz se cierra el histórico (FR-014).
  if (historyRootId !== rootId) {
    setHistoryRootId(rootId);
    setMissingId(null);
    onClose();
  }

  // Nodo del histórico abierto.
  const node = useMemo(
    () =>
      targetId
        ? graph.nodes.find((candidate) => candidate.id === targetId) ?? null
        : null,
    [graph.nodes, targetId],
  );

  // Linaje (padre/hijos desde las aristas) del histórico abierto.
  const lineage = useMemo<TLineageNav>(() => {
    if (!targetId) return EMPTY_LINEAGE;
    const parentEdge = graph.edges.find((edge) => edge.target === targetId);
    const childrenIds = graph.edges
      .filter((edge) => edge.source === targetId)
      .map((edge) => edge.target);
    return { parentId: parentEdge?.source ?? null, childrenIds };
  }, [graph.edges, targetId]);

  // El objetivo desapareció del grafo (edge case): se marca "no disponible" y
  // se cierra el overlay. Se espera a que el grafo resuelva para no marcar
  // mientras carga.
  const missing = targetId !== null && !node && !isLoading && !isError;

  if (missing && missingId !== targetId) {
    setMissingId(targetId);
    onClose();
  }

  const clearMissing = useCallback(() => setMissingId(null), []);

  return { node, lineage, missingId, clearMissing };
};
