import { useMemo, useState } from 'react';
import type { TGraphModel } from '../Graph.entity';
import { topologySignature } from '../lib/layoutGraph';
import { reconcileGraphModel } from '../lib/reconcileGraph';

export interface UseStableGraphModelResult {
  /** Modelo con identidad estable (nodos/aristas sin cambios reutilizados). */
  graph: TGraphModel;
  /** Firma de topología: cambia solo cuando cambia la estructura. */
  signature: string;
}

/**
 * Identidad estable del modelo (R4, contrato de render §1.1): aunque el padre
 * entregue un `TGraphModel` nuevo por referencia, se reutilizan los nodos y
 * aristas sin cambios para que React Flow no re-renderice de más. Se ajusta el
 * estado durante el render (patrón recomendado por React) para no mostrar un
 * modelo intermedio.
 */
export const useStableGraphModel = (
  graph: TGraphModel,
): UseStableGraphModelResult => {
  const [previousGraph, setPreviousGraph] = useState(graph);
  const [stableGraph, setStableGraph] = useState(graph);
  if (previousGraph !== graph) {
    setPreviousGraph(graph);
    setStableGraph(reconcileGraphModel(stableGraph, graph));
  }

  const signature = useMemo(
    () =>
      topologySignature({
        nodes: stableGraph.nodes,
        edges: stableGraph.edges,
      }),
    [stableGraph.nodes, stableGraph.edges],
  );

  return { graph: stableGraph, signature };
};
