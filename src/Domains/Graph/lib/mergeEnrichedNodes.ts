import type { TGraphModel, TGraphNode, TGraphNodeData } from '../Graph.entity';

/**
 * Fusión de los nodos enriquecidos sobre la estructura (T026, FR-013;
 * data-model §2.2 y `contracts/enrichment-pure-api.md` §3):
 *
 * - Solo los ids presentes en `readyIds` cambian de `data`: por cada uno se
 *   pide a `buildNodeData` los datos ya fusionados del nodo **original**. La
 *   fusión en sí (`enrichNodeData` + `mergeExecutionSignals`) sigue siendo de
 *   quien llama y ya está probada por separado (FR-014).
 * - Los nodos no listos se devuelven **por referencia** (SC-006/VII): sin
 *   cambio de `data` no hay re-render de sus componentes.
 * - `edges` se devuelven por referencia y la entrada **no se muta** (FR-013).
 */
export const mergeEnrichedNodes = (
  structure: TGraphModel,
  readyIds: ReadonlySet<string>,
  buildNodeData: (node: TGraphNode) => TGraphNodeData,
): TGraphModel => ({
  nodes: structure.nodes.map((node) =>
    readyIds.has(node.id) ? { ...node, data: buildNodeData(node) } : node,
  ),
  edges: structure.edges,
});
