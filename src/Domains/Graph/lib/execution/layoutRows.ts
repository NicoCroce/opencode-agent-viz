import type { TGraphModel } from '../../Graph.entity';
import { NODE_CARD_HEIGHT } from '../layoutGraph';
import type { TExecutionPlan } from './deriveExecutionLevels';
import { EXECUTION_ROW_PAD, executionColumnX } from './geometry';

/** Geometría vertical de los carriles: dónde empieza y cuánto mide cada nivel. */
export interface TRowLayout {
  top: Record<number, number>;
  height: Record<number, number>;
  total: number;
}

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
