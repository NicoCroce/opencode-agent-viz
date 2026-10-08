import type { SessionInfo } from '@opencode/client';
import {
  EMPTY_METRICS,
  type TGraphEdge,
  type TGraphModel,
  type TGraphNode,
} from '../Graph.entity';
import { deriveExecutionLevels } from './executionLevels';

/**
 * Tamaño de lote por defecto de `chunkLoadPlan` (contrato de carga §2.2). Es una
 * constante exportada y ajustable: el hook de enriquecimiento puede pasar otro
 * tamaño, pero el valor por defecto acota el trabajo por turno para no congelar
 * la UI (SC-007).
 */
export const LOAD_CHUNK_SIZE = 8;

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
 * Construye un `TGraphModel` **estructural** mínimo a partir del subárbol para
 * reaprovechar el mismo agrupamiento por tanda que el layout
 * (`deriveExecutionLevels`). Los nodos solo aportan la topología y los tiempos de
 * `SessionInfo` (`time.created`/`time.idle ?? time.updated`); el resto de campos
 * de vista son neutros y no intervienen en el orden.
 */
const toStructuralModel = (subtree: readonly SessionInfo[]): TGraphModel => {
  const nodeIds = new Set(subtree.map((session) => session.id));

  const nodes: TGraphNode[] = subtree.map((session) => ({
    id: session.id,
    type: 'agent',
    position: { x: 0, y: 0 },
    data: {
      sessionId: session.id,
      title: session.title ?? null,
      createdAt: session.time.created,
      updatedAt: session.time.idle ?? session.time.updated,
      agentName: session.agent ?? '',
      directory: session.location.directory,
      model: null,
      status: 'created',
      retry: null,
      interruptReason: null,
      metrics: EMPTY_METRICS,
      isRoot: session.parentID === undefined,
      currentTool: null,
      parallel: null,
    },
  }));

  const edges: TGraphEdge[] = [];
  for (const session of subtree) {
    if (session.parentID === undefined) continue;
    if (!nodeIds.has(session.parentID)) continue;
    edges.push({
      id: `${session.parentID}->${session.id}`,
      source: session.parentID,
      target: session.id,
      type: 'agent',
    });
  }

  return { nodes, edges };
};

/** Cadena de ancestros de `id` desde la raíz del subárbol hasta `id` (inclusive). */
const ancestorChain = (
  id: string,
  byId: ReadonlyMap<string, SessionInfo>,
): string[] => {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = id;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = byId.get(current)?.parentID;
  }
  return chain.reverse();
};

/**
 * Orden del "resto" por **nivel de ejecución** (misma agrupación por tanda que
 * `deriveExecutionLevels`); dentro de cada nivel, por `time.created` ascendente y
 * `id` lexicográfico. Determinista y sin reloj implícito (contrato de carga
 * §2.1, data-model §2.3).
 */
const executionLevelOrder = (
  subtree: readonly SessionInfo[],
  byId: ReadonlyMap<string, SessionInfo>,
): string[] => {
  const plan = deriveExecutionLevels(toStructuralModel(subtree), 0);
  const createdOf = (id: string): number => byId.get(id)?.time.created ?? 0;

  const order: string[] = [];
  for (const level of plan.levels) {
    const sorted = [...level.nodeIds].sort(
      (a, b) => createdOf(a) - createdOf(b) || a.localeCompare(b),
    );
    order.push(...sorted);
  }
  return order;
};

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

  const createdOf = (id: string): number => byId.get(id)?.time.created ?? 0;
  const compare = (a: string, b: string): number =>
    createdOf(a) - createdOf(b) || a.localeCompare(b);

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

/**
 * Trocea `orderedIds` en lotes de `size` (contrato de carga §2.2). `size` por
 * defecto es `LOAD_CHUNK_SIZE`; `size <= 0` se normaliza a `1`; una entrada vacía
 * devuelve `[]`. La concatenación de los chunks es `orderedIds`, sin pérdidas ni
 * duplicados (L3). Función pura, sin React (Principio V).
 */
export const chunkLoadPlan = (
  orderedIds: readonly string[],
  size: number = LOAD_CHUNK_SIZE,
): string[][] => {
  if (orderedIds.length === 0) return [];

  const chunkSize = size > 0 ? Math.floor(size) : 1;
  const chunks: string[][] = [];
  for (let index = 0; index < orderedIds.length; index += chunkSize) {
    chunks.push(orderedIds.slice(index, index + chunkSize));
  }
  return chunks;
};
