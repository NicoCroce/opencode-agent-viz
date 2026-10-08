import type { SessionInfo } from '@opencode/client';
import {
  ancestorChain,
  compareByTimeThenId,
  executionLevelOrder,
} from './traversal';

/**
 * Opciones de priorización del subárbol (contrato de carga §2.1). `rootId` es la
 * raíz del subárbol; `selectedId` el nodo seleccionado (si lo hay); `activeIds`
 * los nodos con un estado en curso (`isActiveStatus`); `readyIds` los ya
 * enriquecidos (`enrichment === 'ready'`), que se saltan (SC-008, FR-004).
 */
export interface TLoadOptions {
  rootId: string;
  selectedId: string | null;
  activeIds: ReadonlySet<string>;
  readyIds: ReadonlySet<string>;
}

/**
 * Plan de carga puro (data-model §2.3, contrato de carga §2.1): ids del subárbol
 * ordenados por prioridad (`orderedIds`) e ids ya enriquecidos que no se vuelven
 * a pedir (`skippedIds`). El troceado en lotes lo produce `chunkLoadPlan`.
 */
export interface TLoadPlan {
  orderedIds: string[];
  skippedIds: string[];
}

/**
 * Ordena los ids de un subárbol por prioridad de carga (contrato de carga §2.1):
 *
 * 1. Raíz (`rootId`) si está en el subárbol.
 * 2. Linaje del seleccionado (`selectedId`): ancestros de arriba hacia abajo
 *    (raíz → seleccionado) y sus descendientes directos.
 * 3. Nodos activos (`activeIds`) no incluidos antes.
 * 4. Resto en BFS por nivel de ejecución (misma tanda que `deriveExecutionLevels`),
 *    con `time.created` ascendente e `id` dentro del nivel.
 * 5. Desempate restante por `time.created` e `id` (orden total reproducible).
 *
 * Los ids presentes en `readyIds` se devuelven en `skippedIds` y **no** entran en
 * `orderedIds` (SC-008, FR-004). Función pura, sin React (Principio V); no usa
 * `Date.now()` ni aleatoriedad.
 */
export const orderSubtreeForLoad = (
  subtree: readonly SessionInfo[],
  options: TLoadOptions,
): TLoadPlan => {
  const { rootId, selectedId, activeIds, readyIds } = options;

  const byId = new Map<string, SessionInfo>();
  for (const session of subtree) {
    if (!byId.has(session.id)) byId.set(session.id, session);
  }

  const compare = compareByTimeThenId(byId);

  const priority: string[] = [];
  const used = new Set<string>();
  const push = (id: string): void => {
    if (!byId.has(id) || used.has(id)) return;
    used.add(id);
    priority.push(id);
  };

  // 1. Raíz.
  push(rootId);

  // 2. Linaje del seleccionado: ancestros (arriba → abajo) y descendientes directos.
  if (selectedId !== null && byId.has(selectedId)) {
    for (const id of ancestorChain(selectedId, byId)) push(id);
    const children = subtree
      .filter((session) => session.parentID === selectedId)
      .map((session) => session.id)
      .sort(compare);
    for (const id of children) push(id);
  }

  // 3. Nodos activos aún no priorizados.
  const active = [...byId.keys()]
    .filter((id) => activeIds.has(id))
    .sort(compare);
  for (const id of active) push(id);

  // 4. Resto por nivel de ejecución.
  for (const id of executionLevelOrder(subtree, byId)) push(id);

  // 5. Desempate restante (por si un nodo no perteneciera a ningún nivel).
  const rest = [...byId.keys()].filter((id) => !used.has(id)).sort(compare);
  for (const id of rest) push(id);

  // Los ids ya enriquecidos se saltan conservando el orden de prioridad, para que
  // el plan sea determinista (L2).
  const orderedIds: string[] = [];
  const skippedIds: string[] = [];
  for (const id of priority) {
    if (readyIds.has(id)) skippedIds.push(id);
    else orderedIds.push(id);
  }

  return { orderedIds, skippedIds };
};
