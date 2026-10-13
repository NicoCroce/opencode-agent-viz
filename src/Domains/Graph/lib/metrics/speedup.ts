import type {
  TGraphModel,
  TGraphNode,
  TGroupSpeedup,
  TNodeSpeedup,
  TParallelGroup,
} from '../../Graph.entity';
import type { TSessionSpeedup } from '../../../Inspector/InspectorSession.entity';
import { nodeInterval } from '../execution/nodeInterval';
import { isActiveStatus } from '../nodeStatus';

/**
 * Duración de un nodo para la aceleración: la métrica viva si existe y, si no,
 * la ventana de su intervalo. `null` cuando la ventana es 0 (no calculable).
 */
const durationOf = (node: TGraphNode, now: number): number | null => {
  if (node.data.metrics.durationMs !== null) return node.data.metrics.durationMs;
  const [start, end] = nodeInterval(node, now);
  const duration = end - start;
  return duration > 0 ? duration : null;
};

/**
 * Longitud de la unión de intervalos `[inicio, fin]` (merge). Evita contar dos
 * veces el tiempo compartido por agentes solapados (research R4).
 */
const unionLength = (intervals: [number, number][]): number => {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [currentStart, currentEnd] = sorted[0];
  for (let index = 1; index < sorted.length; index += 1) {
    const [start, end] = sorted[index];
    if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
    } else {
      total += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    }
  }
  total += currentEnd - currentStart;
  return total;
};

/**
 * Aceleración de un grupo de agentes que corrieron en paralelo (FR-006/FR-007;
 * `contracts/parallel-speedup-contract.md` §2). `serialMs` es `null` si falta la
 * duración de algún miembro y `speedup` es `null` si `wallMs ≤ 0`.
 */
export const deriveGroupSpeedup = (
  group: TParallelGroup,
  nodeById: Map<string, TGraphNode>,
  now: number,
): TGroupSpeedup => {
  const members = group.nodeIds
    .map((id) => nodeById.get(id))
    .filter((node): node is TGraphNode => node !== undefined);

  const durations = members.map((node) => durationOf(node, now));
  const serialMs = durations.some((duration) => duration === null)
    ? null
    : durations.reduce<number>(
        (total, duration) => total + (duration as number),
        0,
      );

  const wallMs = group.endedAt - group.startedAt;
  const speedup = serialMs !== null && wallMs > 0 ? serialMs / wallMs : null;
  const efficiency =
    speedup !== null && group.nodeIds.length > 0
      ? speedup / group.nodeIds.length
      : null;
  const provisional = members.some((node) => isActiveStatus(node.data.status));

  return {
    groupId: group.id,
    size: group.nodeIds.length,
    serialMs,
    wallMs,
    speedup,
    efficiency,
    provisional,
  };
};

/**
 * Aceleración por nodo, lista para el badge (FR-009). Solo los nodos que
 * participan de un grupo con 2+ agentes reciben entrada.
 */
export const deriveSpeedupByNode = (
  model: TGraphModel,
  groups: TParallelGroup[],
  now: number,
): Record<string, TNodeSpeedup> => {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const result: Record<string, TNodeSpeedup> = {};

  for (const group of groups) {
    const { groupId, size, serialMs, wallMs, speedup, efficiency, provisional } =
      deriveGroupSpeedup(group, nodeById, now);
    for (const id of group.nodeIds) {
      if (!nodeById.has(id)) continue;
      result[id] = {
        groupId,
        size,
        serialMs,
        wallMs,
        speedup,
        efficiency,
        provisional,
      };
    }
  }

  return result;
};

/**
 * Aceleración global de la sesión (FR-008; contract §3): suma de duraciones de
 * todos los agentes frente al tiempo total activo (unión de intervalos). Usa la
 * suma de las duraciones disponibles (no falla si algún nodo estructural aún no
 * tiene métrica).
 */
export const deriveSessionSpeedup = (
  model: TGraphModel,
  now: number,
): TSessionSpeedup => {
  if (model.nodes.length === 0) {
    return { serialMs: null, wallMs: null, speedup: null };
  }

  const durations = model.nodes
    .map((node) => durationOf(node, now))
    .filter((duration): duration is number => duration !== null);
  const serialMs =
    durations.length > 0
      ? durations.reduce((total, duration) => total + duration, 0)
      : null;

  const intervals = model.nodes
    .map((node) => nodeInterval(node, now))
    .filter(([start, end]) => end > start);
  const wallMs = unionLength(intervals);

  const speedup = serialMs !== null && wallMs > 0 ? serialMs / wallMs : null;

  return { serialMs, wallMs, speedup };
};
