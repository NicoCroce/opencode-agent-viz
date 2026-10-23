/**
 * Proyección pura del grafo al mapa de sesiones del motor de eficiencia
 * (`data-model.md` §1.2, feature 015).
 *
 * - `parentID` = `source` de la arista cuyo `target` es el nodo; la raíz no
 *   tiene arista entrante y queda sin padre.
 * - `status` = `active` si el nodo está en curso (`isActiveStatus`), `idle` si no.
 * - Incluye **todos** los nodos del grafo y no inventa sesiones: el subárbol
 *   truncado se declara aparte en la capa (`truncated`).
 *
 * No muta el grafo ni depende del SDK: solo lee `TGraphModel`.
 */
import type { TGraphModel } from '@app/Domains/Graph/Graph.entity';
import { isActiveStatus } from '@app/Domains/Graph/lib/nodeStatus';
import type { TEfficiencySessionMeta } from '@app/Domains/Efficiency/Efficiency.entity';

export const buildEfficiencySessions = (
  graph: TGraphModel,
): Record<string, TEfficiencySessionMeta> => {
  const parents = new Map<string, string>();
  for (const edge of graph.edges) {
    parents.set(edge.target, edge.source);
  }

  const sessions: Record<string, TEfficiencySessionMeta> = {};
  for (const node of graph.nodes) {
    const parentID = parents.get(node.id);
    sessions[node.id] = {
      ...(parentID === undefined ? {} : { parentID }),
      status: isActiveStatus(node.data.status) ? 'active' : 'idle',
    };
  }
  return sessions;
};
