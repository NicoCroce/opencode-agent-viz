import type {
  TGraphModel,
  TNodeEffort,
  TParallelGroup,
} from '../../Graph.entity';
import type { TExecutionPlan } from '../execution/deriveExecutionLevels';
import { isActiveStatus } from '../nodeStatus';
import {
  EFFORT_MAX,
  EFFORT_SHAPE_CHILDREN,
  EFFORT_SHAPE_INVOCATIONS,
} from './constants';

/**
 * Motivos legibles que alimentan la descripción accesible del medidor
 * (FR-026). El primero es siempre el nivel base.
 */
const BASE_REASON = 'Nivel base';
const PARALLEL_REASON = 'Lanza agentes en paralelo';
const DURATION_REASON = 'Duración superior al doble de su línea';
const CHILDREN_REASON = 'Delega en varios agentes';
const INVOCATIONS_REASON = 'Muchas invocaciones de herramientas';

/** Convierte la puntuación acumulada (≥1) al nivel acotado por el tope. */
const toLevel = (score: number): TNodeEffort['level'] =>
  Math.min(EFFORT_MAX, score) as TNodeEffort['level'];

/**
 * Deriva el nivel de esfuerzo de vista de cada nodo (FR-021..FR-028; effort
 * contract §1..§3). Función **pura**, sin React ni SDK (Principio V).
 *
 * Regla acumulativa con tope `EFFORT_MAX`:
 *
 * `level = min(EFFORT_MAX, 1 + condiciones)`
 *
 * - +1 si el nodo es `parentId` de un `TParallelGroup` con `nodeIds.length >= 2`
 *   (lanza/orquesta paralelos).
 * - +1 si su duración supera 2× la del nodo más rápido de su **línea**
 *   (`plan.levelByNode`, la tanda de ejecución; FR-023).
 * - +1 si el nº de hijos por `edges` ≥ `EFFORT_SHAPE_CHILDREN`.
 * - +1 si `metrics.invocations` ≥ `EFFORT_SHAPE_INVOCATIONS`.
 *
 * `provisional` es `true` si el nodo o algún nodo de su línea está activo
 * (`isActiveStatus`), porque los tiempos de la línea no están cerrados (FR-028).
 *
 * Recibe **todos** los nodos del modelo para garantizar el nivel base 1 incluso
 * sin duración registrada (effort contract §4).
 */
export const deriveEffortByNode = (
  model: TGraphModel,
  plan: TExecutionPlan,
  parallelGroups: TParallelGroup[],
): Record<string, TNodeEffort> => {
  const levelByNode = plan.levelByNode;
  const levelOf = (id: string): number => levelByNode[id] ?? 0;

  const childCount = new Map<string, number>();
  for (const edge of model.edges) {
    childCount.set(edge.source, (childCount.get(edge.source) ?? 0) + 1);
  }

  // Nodo más rápido (menor duración positiva) de cada línea/tanda.
  const minDurationByLevel = new Map<number, number>();
  for (const node of model.nodes) {
    const duration = node.data.metrics.durationMs;
    if (duration === null || duration <= 0) continue;
    const level = levelOf(node.id);
    const current = minDurationByLevel.get(level);
    if (current === undefined || duration < current) {
      minDurationByLevel.set(level, duration);
    }
  }

  // ¿Hay algún nodo activo en cada línea?
  const activeByLevel = new Map<number, boolean>();
  for (const node of model.nodes) {
    if (isActiveStatus(node.data.status)) {
      activeByLevel.set(levelOf(node.id), true);
    }
  }

  // Padres que levantan 2+ paralelos.
  const parallelParents = new Set<string>();
  for (const group of parallelGroups) {
    if (group.parentId !== null && group.nodeIds.length >= 2) {
      parallelParents.add(group.parentId);
    }
  }

  const result: Record<string, TNodeEffort> = {};

  for (const node of model.nodes) {
    const { data } = node;
    const level = levelOf(node.id);
    const reasons: string[] = [BASE_REASON];
    let score = 1;

    if (parallelParents.has(node.id)) {
      score += 1;
      reasons.push(PARALLEL_REASON);
    }

    const duration = data.metrics.durationMs;
    const minDuration = minDurationByLevel.get(level);
    if (
      duration !== null &&
      duration > 0 &&
      minDuration !== undefined &&
      duration > 2 * minDuration
    ) {
      score += 1;
      reasons.push(DURATION_REASON);
    }

    if ((childCount.get(node.id) ?? 0) >= EFFORT_SHAPE_CHILDREN) {
      score += 1;
      reasons.push(CHILDREN_REASON);
    }

    if (data.metrics.invocations >= EFFORT_SHAPE_INVOCATIONS) {
      score += 1;
      reasons.push(INVOCATIONS_REASON);
    }

    const provisional =
      isActiveStatus(data.status) || activeByLevel.get(level) === true;

    result[node.id] = {
      level: toLevel(score),
      provisional,
      reasons,
    };
  }

  return result;
};
