import type {
  TGraphModel,
  TGraphNode,
  TParallelGroup,
} from '../../Graph.entity';
import { NODE_WIDTH } from '../layoutGraph';
import type { TInvocationBatch } from '../invocations';
import { deriveExecutionBatches } from '../parallelByNode';
import { EXECUTION_COLUMN_GAP, executionColumnX } from './geometry';
import { endOf, startOf } from './nodeInterval';

/** Un nivel de ejecución: una tanda (uno o varios agentes concurrentes). */
export interface TExecutionLevel {
  level: number;
  /** Ids de los agentes del nivel, ordenados por instante de inicio. */
  nodeIds: string[];
  startedAt: number;
  endedAt: number;
  /**
   * `true` si el nivel es una tanda **paralela**: existe un lote de 2+
   * miembros que contiene a **todos** los nodos del nivel. Es el mismo dato de
   * membresía que alimenta el badge (`toParallelByNode` sobre los mismos lotes),
   * de modo que un nodo no puede tener fila paralela y badge nulo a la vez
   * (paridad fila ↔ badge forzada por construcción, FR-008, E5).
   */
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
 * 2. Cada lote de la **fuente fusionada** (`deriveExecutionBatches`: invocación
 *    del padre si existe, solape de sesión si no) es una tanda; las tandas se
 *    ordenan por instante de inicio y reciben niveles consecutivos. Los hermanos
 *    del mismo paso del padre comparten nivel aunque sus intervalos de sesión no
 *    solapen (FR-001, FR-007/FR-011 de 011).
 * 3. Se normaliza para que ningún hijo quede por encima de su padre, de modo
 *    que las aristas (quién invocó a quién) siempre apunten hacia abajo.
 *
 * Dentro de un nivel, los agentes se ordenan por instante de inicio (columnas
 * de izquierda a derecha). Función pura, sin React (Principio V): sin lotes
 * (tercer argumento vacío) el comportamiento por solape de sesión queda intacto
 * (respaldo estructural, FR-012).
 *
 * `executionGroups` permite al llamador inyectar los lotes **ya fusionados** una
 * sola vez por plan (`deriveExecutionLayout`), evitando repetir el agrupamiento
 * —y su coste por solape de hermanos— en filas y badge. Si se omite, se derivan
 * aquí de `batches` (comportamiento previo intacto).
 */
export const deriveExecutionLevels = (
  model: TGraphModel,
  now: number,
  batches: TInvocationBatch[] = [],
  executionGroups?: TParallelGroup[],
): TExecutionPlan => {
  const parentByChild = new Map<string, string>();
  for (const edge of model.edges) parentByChild.set(edge.target, edge.source);

  const levelByNode: Record<string, number> = {};
  const roots = model.nodes
    .filter((node) => !parentByChild.has(node.id))
    .sort((a, b) => startOf(a) - startOf(b) || a.id.localeCompare(b.id));

  for (const root of roots) levelByNode[root.id] = 0;

  let nextLevel = roots.length > 0 ? 1 : 0;

  // Fuente única de lotes para filas y badge: el `parentId` nulo que deja
  // `deriveInvocationBatches` se resuelve contra el modelo aquí dentro. El
  // llamador puede inyectar los lotes ya fusionados para no reagrupar.
  const groups = executionGroups ?? deriveExecutionBatches(model, now, batches);

  // Membresía de los lotes **paralelos** (2+). Un nivel es paralelo solo si un
  // mismo lote contiene a todos sus nodos: el mismo predicado de membresía que
  // determina el badge, así fila y badge no pueden divergir (FR-008, E5).
  const parallelMembers = groups
    .filter((group) => group.nodeIds.length >= 2)
    .map((group) => new Set(group.nodeIds));

  for (const group of groups) {
    // El lote de la raíz (sin padre) no es una tanda de invocación: la raíz ya
    // ocupa el nivel 0.
    if (group.parentId === null) continue;
    for (const id of group.nodeIds) levelByNode[id] = nextLevel;
    nextLevel += 1;
  }

  if (batches.length > 0) {
    // Con invocaciones, un nodo sin lote no tiene evidencia de paralelismo (su
    // badge es nulo): ocupa su **propia** fila para no compartir nivel con un
    // lote paralelo y romper la paridad fila ↔ badge (FR-008).
    for (const node of model.nodes) {
      if (levelByNode[node.id] !== undefined) continue;
      levelByNode[node.id] = nextLevel;
      nextLevel += 1;
    }
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
        parallel: parallelMembers.some((members) =>
          sorted.every((node) => members.has(node.id)),
        ),
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
