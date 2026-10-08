import { useMemo } from 'react';
import type { TGraphModel, TGraphNode, TParallelGroup } from '@app/Domains/Graph';

interface UseInspectedNodeContextParams {
  graph: TGraphModel;
  parallelGroups: TParallelGroup[];
  inspectedNodeId: string | null;
}

interface UseInspectedNodeContextResult {
  node: TGraphNode | null;
  peers: TGraphNode[];
  invokedBy: TGraphNode | null;
}

/**
 * Contexto del nodo inspeccionado (FR-007/FR-008): el nodo, los agentes que
 * corrieron en paralelo con él y quién lo invocó (relación padre → hijo).
 *
 * Los peers se calculan sobre el grafo completo (no sobre la proyección de
 * cadena); la relación padre → hijo se deriva de la arista entrante.
 */
export const useInspectedNodeContext = ({
  graph,
  parallelGroups,
  inspectedNodeId,
}: UseInspectedNodeContextParams): UseInspectedNodeContextResult => {
  const node =
    graph.nodes.find((candidate) => candidate.id === inspectedNodeId) ?? null;

  const peers = useMemo(() => {
    if (!inspectedNodeId) return [];
    const group = parallelGroups.find((candidate) =>
      candidate.nodeIds.includes(inspectedNodeId),
    );
    if (!group) return [];
    return group.nodeIds
      .filter((nodeId) => nodeId !== inspectedNodeId)
      .map((nodeId) => graph.nodes.find((candidate) => candidate.id === nodeId))
      .filter((candidate): candidate is TGraphNode => Boolean(candidate));
  }, [parallelGroups, graph.nodes, inspectedNodeId]);

  const invokedBy = useMemo(() => {
    if (!inspectedNodeId) return null;
    const edge = graph.edges.find(
      (candidate) => candidate.target === inspectedNodeId,
    );
    if (!edge) return null;
    return graph.nodes.find((candidate) => candidate.id === edge.source) ?? null;
  }, [graph.edges, graph.nodes, inspectedNodeId]);

  return { node, peers, invokedBy };
};
