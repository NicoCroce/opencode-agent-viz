import type { TGraphModel, TGraphNode } from '../../Graph.entity';
import { NODE_WIDTH } from '../layoutGraph';
import { deriveSiblingBatches } from '../parallelism';
import { EXECUTION_COLUMN_GAP, executionColumnX } from './geometry';
import { endOf, startOf } from './nodeInterval';

/** Un nivel de ejecución: una tanda (uno o varios agentes concurrentes). */
export interface TExecutionLevel {
  level: number;
  /** Ids de los agentes del nivel, ordenados por instante de inicio. */
  nodeIds: string[];
  startedAt: number;
  endedAt: number;
  /** `true` si el nivel agrupa 2+ agentes concurrentes. */
  parallel: boolean;
}

export interface TExecutionPlan {
  levels: TExecutionLevel[];
  levelByNode: Record<string, number>;
  columnByNode: Record<string, number>;
  /** Ancho total del contenido (gutter + columnas + margen). */
  width: number;
}

/**
 * Asigna a cada agente un **nivel de ejecución** (una tanda), en orden de
 * ejecución:
 *
 * 1. La raíz ocupa el nivel 0.
 * 2. Cada lote de hermanos concurrentes (ver `deriveSiblingBatches`) es una
 *    tanda; las tandas se ordenan por instante de inicio y reciben niveles
 *    consecutivos. Los hermanos que arrancan juntos comparten nivel.
 * 3. Se normaliza para que ningún hijo quede por encima de su padre, de modo
 *    que las aristas (quién invocó a quién) siempre apunten hacia abajo.
 *
 * Dentro de un nivel, los agentes se ordenan por instante de inicio (columnas
 * de izquierda a derecha). Función pura, sin React (Principio V).
 */
export const deriveExecutionLevels = (
  model: TGraphModel,
  now: number,
): TExecutionPlan => {
  const parentByChild = new Map<string, string>();
  for (const edge of model.edges) parentByChild.set(edge.target, edge.source);

  const levelByNode: Record<string, number> = {};
  const roots = model.nodes
    .filter((node) => !parentByChild.has(node.id))
    .sort((a, b) => startOf(a) - startOf(b) || a.id.localeCompare(b.id));

  for (const root of roots) levelByNode[root.id] = 0;

  let nextLevel = roots.length > 0 ? 1 : 0;
  for (const batch of deriveSiblingBatches(model, now)) {
    // El lote de la raíz (sin padre) no es una tanda de invocación: la raíz ya
    // ocupa el nivel 0.
    if (batch.parentId === null) continue;
    for (const id of batch.nodeIds) levelByNode[id] = nextLevel;
    nextLevel += 1;
  }

  // Normaliza: cada hijo, al menos un nivel por debajo de su padre.
  const childrenByParent = new Map<string, string[]>();
  for (const [child, parent] of parentByChild) {
    const list = childrenByParent.get(parent) ?? [];
    list.push(child);
    childrenByParent.set(parent, list);
  }

  const queue = roots.map((root) => root.id);
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const child of childrenByParent.get(id) ?? []) {
      levelByNode[child] = Math.max(
        levelByNode[child] ?? 0,
        (levelByNode[id] ?? 0) + 1,
      );
      queue.push(child);
    }
  }

  const byLevel = new Map<number, TGraphNode[]>();
  for (const node of model.nodes) {
    const level = levelByNode[node.id] ?? 0;
    const list = byLevel.get(level);
    if (list) list.push(node);
    else byLevel.set(level, [node]);
  }

  const levels: TExecutionLevel[] = [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, nodes]) => {
      const sorted = [...nodes].sort(
        (a, b) => startOf(a) - startOf(b) || a.id.localeCompare(b.id),
      );
      return {
        level,
        nodeIds: sorted.map((node) => node.id),
        startedAt: Math.min(...sorted.map(startOf)),
        endedAt: Math.max(...sorted.map((node) => endOf(node, now))),
        parallel: sorted.length > 1,
      };
    });

  const columnByNode: Record<string, number> = {};
  for (const level of levels) {
    level.nodeIds.forEach((id, index) => {
      columnByNode[id] = index;
    });
  }

  const maxColumns = Math.max(1, ...levels.map((level) => level.nodeIds.length));
  const width =
    executionColumnX(maxColumns - 1) + NODE_WIDTH + EXECUTION_COLUMN_GAP;

  return { levels, levelByNode, columnByNode, width };
};
