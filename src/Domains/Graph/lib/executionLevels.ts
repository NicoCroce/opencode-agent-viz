import type { TGraphModel, TGraphNode } from '../Graph.entity';
import { NODE_CARD_HEIGHT, NODE_WIDTH } from './layoutGraph';
import { deriveSiblingBatches } from './parallelism';

/** Ancho del gutter izquierdo (la "espina") en coordenadas de flujo. */
export const EXECUTION_GUTTER = 232;
/** Canal libre entre la espina y la primera columna, donde corre el riel. */
export const EXECUTION_COLUMN_LEFT_PAD = 44;
/** Separación horizontal entre agentes del mismo nivel. */
export const EXECUTION_COLUMN_GAP = 48;
/** Distancia del riel de invocación a la izquierda de su columna. */
export const EXECUTION_RAIL_OFFSET = 18;
/** Margen vertical del nodo dentro de su carril (arriba y abajo). */
export const EXECUTION_ROW_PAD = 22;
/**
 * Alto de cada carril, derivado del alto de la card del nodo (`NODE_CARD_HEIGHT`).
 * Así el carril crece o se achica en proporción al nodo en lugar de ser un
 * valor suelto.
 */
export const EXECUTION_ROW_HEIGHT = NODE_CARD_HEIGHT + EXECUTION_ROW_PAD * 2;

/** X (izquierda) de la columna `column` dentro de un nivel. */
export const executionColumnX = (column: number): number =>
  EXECUTION_GUTTER +
  EXECUTION_COLUMN_LEFT_PAD +
  column * (NODE_WIDTH + EXECUTION_COLUMN_GAP);

/**
 * X del riel vertical por el que viajan las aristas que **salen** de la columna
 * `column`. Cae en el canal a la izquierda de la columna, libre de nodos, de
 * modo que las invocaciones nunca cruzan una card.
 */
export const executionRailX = (column: number): number =>
  executionColumnX(column) - EXECUTION_RAIL_OFFSET;

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

/** Geometría vertical de los carriles: dónde empieza y cuánto mide cada nivel. */
export interface TRowLayout {
  top: Record<number, number>;
  height: Record<number, number>;
  total: number;
}

const startOf = (node: TGraphNode): number =>
  node.data.createdAt ?? node.data.metrics.startedAt ?? 0;

const endOf = (node: TGraphNode, now: number): number =>
  node.data.updatedAt ?? node.data.metrics.endedAt ?? now;

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

/**
 * Alto de cada carril en proporción al **alto real** de sus nodos: el máximo del
 * nivel (`heightByNode`, con `NODE_CARD_HEIGHT` por defecto) más el padding
 * vertical. Devuelve también el `top` acumulado de cada nivel.
 *
 * Función pura, sin React (Principio V); determinística y sin medición.
 */
export const deriveRowLayout = (
  plan: TExecutionPlan,
  heightByNode: Record<string, number>,
): TRowLayout => {
  const top: Record<number, number> = {};
  const height: Record<number, number> = {};
  let cursor = 0;

  for (const level of plan.levels) {
    const maxHeight = Math.max(
      NODE_CARD_HEIGHT,
      ...level.nodeIds.map((id) => heightByNode[id] ?? NODE_CARD_HEIGHT),
    );
    const rowHeight = maxHeight + EXECUTION_ROW_PAD * 2;
    top[level.level] = cursor;
    height[level.level] = rowHeight;
    cursor += rowHeight;
  }

  return { top, height, total: cursor };
};

/**
 * Posiciona los nodos según el plan: `x` por columna dentro del nivel, `y` por
 * el alto acumulado de los carriles (con alturas por defecto). Determinista y
 * sin dagre (Principio V); no muta la entrada.
 */
export const layoutExecution = (
  model: TGraphModel,
  plan: TExecutionPlan,
): TGraphModel => {
  const rowLayout = deriveRowLayout(plan, {});
  return {
    ...model,
    nodes: model.nodes.map((node) => {
      const level = plan.levelByNode[node.id] ?? 0;
      const column = plan.columnByNode[node.id] ?? 0;
      return {
        ...node,
        position: {
          x: executionColumnX(column),
          y: (rowLayout.top[level] ?? 0) + EXECUTION_ROW_PAD,
        },
      };
    }),
  };
};
