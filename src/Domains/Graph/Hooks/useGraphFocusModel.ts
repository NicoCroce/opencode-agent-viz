import { useMemo, useState } from 'react';
import type { TGraphModel } from '../Graph.entity';
import { deriveLineage } from '../lib/lineage';
import {
  EMPTY_NODE_FOCUS,
  type TNodeFocus,
} from '../Components/NodeFocusContext';

export interface UseGraphFocusModelResult {
  hoveredNodeId: string | null;
  setHoveredNodeId: (id: string | null) => void;
  /** Foco publicado por contexto (selección + linaje + hover). */
  focus: TNodeFocus;
}

/**
 * Modelo de foco del grafo: hover local + linaje del nodo seleccionado
 * (ancestros + descendientes). Se publica por contexto (no por `data`/`style`)
 * para no reconstruir los arrays que consume React Flow (contrato de render
 * §1.2/§2). `lineage` es `null` sin selección o si el nodo no está en el modelo.
 */
export const useGraphFocusModel = (
  graph: TGraphModel,
  selectedNodeId: string | null,
): UseGraphFocusModelResult => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const lineage = useMemo(
    () =>
      deriveLineage(
        { nodes: graph.nodes, edges: graph.edges },
        selectedNodeId,
      ),
    [graph.nodes, graph.edges, selectedNodeId],
  );

  const focus = useMemo<TNodeFocus>(
    () => ({
      selectedNodeId,
      lineageNodeIds: lineage?.nodeIds ?? EMPTY_NODE_FOCUS.lineageNodeIds,
      lineageEdgeIds: lineage?.edgeIds ?? EMPTY_NODE_FOCUS.lineageEdgeIds,
      hoveredNodeId,
    }),
    [selectedNodeId, lineage, hoveredNodeId],
  );

  return { hoveredNodeId, setHoveredNodeId, focus };
};
