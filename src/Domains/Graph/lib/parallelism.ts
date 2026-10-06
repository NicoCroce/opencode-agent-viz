import type { TGraphModel, TGraphNode, TParallelGroup } from '../Graph.entity';

/**
 * Intervalo de ejecución de un nodo.
 *
 * Usa `createdAt` (creación de la sesión, estable y disponible apenas cargan
 * las sesiones) y cae a `metrics.startedAt` si falta. El fin es `updatedAt`
 * (`time.idle ?? time.updated`) y cae a `metrics.endedAt` o `now`.
 */
const intervalOf = (node: TGraphNode, now: number): [number, number] => {
  const start = node.data.createdAt ?? node.data.metrics.startedAt ?? now;
  const end =
    node.data.updatedAt ?? node.data.metrics.endedAt ?? now;
  return [start, Math.max(start, end)];
};

const overlaps = (a: TGraphNode, b: TGraphNode, now: number): boolean => {
  const [aStart, aEnd] = intervalOf(a, now);
  const [bStart, bEnd] = intervalOf(b, now);
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
        if (!overlaps(nodes[i], nodes[j], now)) continue;
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
        (a, b) => intervalOf(a, now)[0] - intervalOf(b, now)[0],
      );
      batches.push({
        id: `${key || 'root'}#${sorted[0].id}`,
        parentId: key || null,
        nodeIds: sorted.map((node) => node.id),
        startedAt: Math.min(...sorted.map((node) => intervalOf(node, now)[0])),
        endedAt: Math.max(...sorted.map((node) => intervalOf(node, now)[1])),
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
