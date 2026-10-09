import type { TGraphModel, TGraphNode, TParallelGroup } from '../Graph.entity';
import { executionInterval, nodeInterval } from './execution/nodeInterval';

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
 * Solo los lotes con 2+ agentes: los que corrieron realmente en paralelo.
 */
export const deriveParallelGroups = (
  model: TGraphModel,
  now: number,
): TParallelGroup[] =>
  deriveSiblingBatches(model, now).filter((batch) => batch.nodeIds.length >= 2);
