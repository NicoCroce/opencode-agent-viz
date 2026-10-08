import type { TGraphModel, TGraphNode } from '../../Graph.entity';
import { topologySignature } from '../layoutGraph';
import { sameNode } from './comparators';

/**
 * Identidad estable de nodos y aristas (R4, contrato de render §1.1).
 *
 * `reconcileGraphModel(prev, next)` es una función pura que, dado el modelo
 * anterior y el nuevo, devuelve un `TGraphModel` donde:
 *
 *  1. `prev === null` → devuelve `next` tal cual.
 *  2. Cada nodo se reutiliza (`===`) si existe un nodo en `prev` con el mismo
 *     `id`, la misma `position` y el mismo `data` comparado **campo a campo**
 *     (incluidos `metrics`, `status` y `enrichment`).
 *  3. `edges` es el mismo array de `prev` si `topologySignature(prev)` no
 *     cambia; en caso contrario, el de `next`.
 *  4. El array `nodes` es nuevo si algún nodo difiere; si todos se reutilizan
 *     en el mismo orden, se devuelve `prev.nodes`.
 *
 * No muta `prev` ni `next` (Principio V). Con esto, `AgentNode`/`InvocationEdge`
 * (`React.memo`) solo re-renderizan cuando sus props cambian de verdad.
 */
export const reconcileGraphModel = (
  prev: TGraphModel | null,
  next: TGraphModel,
): TGraphModel => {
  if (prev === null) {
    return next;
  }

  const prevById = new Map<string, TGraphNode>();
  for (const node of prev.nodes) {
    prevById.set(node.id, node);
  }

  let allReused = prev.nodes.length === next.nodes.length;
  const nodes = next.nodes.map((node, index) => {
    const previous = prevById.get(node.id);
    if (previous !== undefined && sameNode(previous, node)) {
      if (prev.nodes[index] !== previous) {
        allReused = false;
      }
      return previous;
    }
    allReused = false;
    return node;
  });

  const edges =
    topologySignature(prev) === topologySignature(next)
      ? prev.edges
      : next.edges;

  return {
    nodes: allReused ? prev.nodes : nodes,
    edges,
  };
};
