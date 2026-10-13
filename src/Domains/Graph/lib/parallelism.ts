import type { TGraphModel, TGraphNode, TParallelGroup } from '../Graph.entity';
import { executionInterval, nodeInterval } from './execution/nodeInterval';
import {
  deriveInvocationBatches,
  type TInvocation,
  type TInvocationBatch,
} from './invocations';

/**
 * `true` si los intervalos de **solape** de dos nodos hermanos se superponen.
 *
 * Usa `executionInterval`, la única lógica de intervalos compartida con
 * `executionLevels`: un nodo activo se modela con fin `+∞`, de modo que el
 * solape no depende del reloj (FR-008, FR-010, Principio V). Un terminado se
 * cierra con su fin real y nunca se confunde con un activo (FR-011).
 */
const overlaps = (a: TGraphNode, b: TGraphNode): boolean => {
  const [aStart, aEnd] = executionInterval(a);
  const [bStart, bEnd] = executionInterval(b);
  return aStart < bEnd && bStart < aEnd;
};

/**
 * Agrupa a los **hermanos** (mismo padre según las aristas) en lotes de
 * ejecución: cada componente conexa del grafo de solapamiento de intervalos.
 *
 * Incluye los agentes que corrieron solos (lote de 1). No empareja un padre con
 * su hijo: se solapan por construcción y no son trabajo paralelo.
 *
 * Función pura, sin React (Principio V); O(n²) dentro de cada grupo de hermanos.
 * Devuelve los lotes ordenados por instante de inicio.
 *
 * El **agrupamiento** ya no depende del reloj (`executionInterval`, fin `+∞`
 * para activos); `now` se conserva en la firma pública y solo alimenta las
 * ventanas informativas `startedAt`/`endedAt` (`nodeInterval`, que cierra a un
 * activo en el presente observado), tal como las ventanas de nivel.
 */
export const deriveSiblingBatches = (
  model: TGraphModel,
  now: number,
): TParallelGroup[] => {
  const parentByChild = new Map<string, string>();
  for (const edge of model.edges) parentByChild.set(edge.target, edge.source);

  const siblings = new Map<string, TGraphNode[]>();
  for (const node of model.nodes) {
    const key = parentByChild.get(node.id) ?? '';
    const list = siblings.get(key);
    if (list) list.push(node);
    else siblings.set(key, [node]);
  }

  const batches: TParallelGroup[] = [];

  for (const [key, nodes] of siblings) {
    if (nodes.length === 0) continue;

    // Union-find sobre los pares de hermanos que se solapan.
    const parent = new Map<string, string>();
    const find = (id: string): string => {
      let root = id;
      while (parent.get(root) !== root) root = parent.get(root) as string;
      return root;
    };
    for (const node of nodes) parent.set(node.id, node.id);

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        if (!overlaps(nodes[i], nodes[j])) continue;
        const rootA = find(nodes[i].id);
        const rootB = find(nodes[j].id);
        if (rootA !== rootB) parent.set(rootA, rootB);
      }
    }

    const byRoot = new Map<string, TGraphNode[]>();
    for (const node of nodes) {
      const root = find(node.id);
      const list = byRoot.get(root);
      if (list) list.push(node);
      else byRoot.set(root, [node]);
    }

    for (const members of byRoot.values()) {
      const sorted = [...members].sort(
        (a, b) => nodeInterval(a, now)[0] - nodeInterval(b, now)[0],
      );
      batches.push({
        id: `${key || 'root'}#${sorted[0].id}`,
        parentId: key || null,
        nodeIds: sorted.map((node) => node.id),
        startedAt: Math.min(...sorted.map((node) => nodeInterval(node, now)[0])),
        endedAt: Math.max(...sorted.map((node) => nodeInterval(node, now)[1])),
      });
    }
  }

  return batches.sort(
    (a, b) =>
      a.startedAt - b.startedAt ||
      (a.parentId ?? '').localeCompare(b.parentId ?? '') ||
      a.nodeIds[0].localeCompare(b.nodeIds[0]),
  );
};

/**
 * Lotes de invocación **o** invocaciones crudas: ambas se aceptan porque el
 * borde (`useGraphStructure`) puede tener cualquiera de las dos formas a mano y
 * la detección es inequívoca (solo el lote trae `sessionIds`).
 */
type TBatchInput = TInvocationBatch | TInvocation;

const isInvocationBatch = (value: TBatchInput): value is TInvocationBatch =>
  Array.isArray((value as TInvocationBatch).sessionIds);

/**
 * Convierte lotes por paso del padre en grupos de nodos (FR-007/FR-008): cada
 * `sessionIds` se resuelve a los nodos del modelo (una sesión = un nodo, aunque
 * participe en varios lotes) y el `parentId` desconocido se toma del modelo.
 *
 * Función pura, sin React (Principio V). El `id` del grupo es
 * `parentId#stepId` (data-model §5), de modo que dos lotes del mismo padre con
 * los mismos miembros siguen teniendo identidad propia; las ventanas son
 * informativas y usan el intervalo de nodo (`nodeInterval`, como el respaldo).
 */
const groupsFromBatches = (
  model: TGraphModel,
  now: number,
  batches: TBatchInput[],
): TParallelGroup[] => {
  const parentByChild = new Map<string, string>();
  for (const edge of model.edges) parentByChild.set(edge.target, edge.source);

  const nodeBySessionId = new Map<string, TGraphNode>();
  for (const node of model.nodes) nodeBySessionId.set(node.data.sessionId, node);

  const normalized: TInvocationBatch[] = batches.some(isInvocationBatch)
    ? (batches as TInvocationBatch[])
    : deriveInvocationBatches(batches as TInvocation[]);

  const groups: TParallelGroup[] = [];

  for (const batch of normalized) {
    const members = batch.sessionIds
      .map((sessionId) => nodeBySessionId.get(sessionId))
      .filter((node): node is TGraphNode => node !== undefined);
    if (members.length === 0) continue;

    const sorted = [...members].sort(
      (a, b) => nodeInterval(a, now)[0] - nodeInterval(b, now)[0] || a.id.localeCompare(b.id),
    );
    const parentId =
      batch.parentId ??
      sorted.map((node) => parentByChild.get(node.id)).find((id) => id !== undefined) ??
      null;

    groups.push({
      id: `${parentId ?? 'root'}#${batch.stepId}`,
      parentId,
      nodeIds: sorted.map((node) => node.id),
      startedAt: Math.min(...sorted.map((node) => nodeInterval(node, now)[0])),
      endedAt: Math.max(...sorted.map((node) => nodeInterval(node, now)[1])),
    });
  }

  return groups.sort(
    (a, b) =>
      a.startedAt - b.startedAt ||
      (a.parentId ?? '').localeCompare(b.parentId ?? '') ||
      a.nodeIds[0].localeCompare(b.nodeIds[0]),
  );
};

/**
 * API combinada de lotes por **invocación** con el solape de sesión como
 * respaldo (contrato `invocation-lanes` §2/§4, FR-007, FR-012): con invocaciones
 * o lotes del padre manda el agrupamiento por paso; sin ellos devuelve el
 * respaldo estructural de `deriveSiblingBatches`, que no se toca.
 *
 * Devuelve **todos** los lotes, también los de un solo miembro: las filas
 * (`deriveExecutionLevels`) necesitan cada paso como una tanda propia y el badge
 * (`deriveParallelGroups`) filtra los de 2+. Función pura, sin React.
 */
export const deriveParallelBatches = (
  model: TGraphModel,
  now: number,
  batches?: TBatchInput[],
): TParallelGroup[] =>
  batches && batches.length > 0
    ? groupsFromBatches(model, now, batches)
    : deriveSiblingBatches(model, now);

/**
 * Solo los lotes con 2+ agentes: los que corrieron realmente en paralelo.
 *
 * Sin lotes (o con la lista vacía) cae al respaldo estructural por solape de
 * sesión, sin regresión (FR-012); con lotes por invocación, la invocación gana
 * (FR-008) y un nodo reutilizado puede aparecer en varios grupos.
 */
export const deriveParallelGroups = (
  model: TGraphModel,
  now: number,
  batches?: TBatchInput[],
): TParallelGroup[] =>
  deriveParallelBatches(model, now, batches).filter((group) => group.nodeIds.length >= 2);

