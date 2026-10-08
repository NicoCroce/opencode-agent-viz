import type { TGraphModel } from '../Graph.entity';
import { orderSubtreeForLoad, type TLoadPlan } from './loadPriority';
import { isActiveStatus } from './nodeStatus';
import { sessionInfoFromNode } from './sessionInfoFromNode';

/**
 * Construye el plan de carga priorizado de un subárbol (T016): reconstruye las
 * `SessionInfo` mínimas de los ids pedidos, localiza la raíz y los nodos activos
 * y delega el orden/troceado en `orderSubtreeForLoad`. Excluye los ids ya
 * procesados (`readyIds`, FR-004/SC-008).
 */
export const buildEnrichmentPlan = (
  structure: TGraphModel,
  ids: string[],
  readyIds: ReadonlySet<string>,
): TLoadPlan => {
  const parentOf = new Map(
    structure.edges.map((edge) => [edge.target, edge.source]),
  );
  const idSet = new Set(ids);
  const subtree = structure.nodes
    .filter((node) => idSet.has(node.id))
    .map((node) => sessionInfoFromNode(node, parentOf.get(node.id)));
  const rootId =
    structure.nodes.find((node) => node.data.isRoot)?.id ?? ids[0] ?? '';
  const activeIds = new Set(
    structure.nodes
      .filter((node) => idSet.has(node.id) && isActiveStatus(node.data.status))
      .map((node) => node.id),
  );

  return orderSubtreeForLoad(subtree, {
    rootId,
    selectedId: null,
    activeIds,
    readyIds,
  });
};
