import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/react';

/**
 * Separación vertical antes de desviarse al riel y antes de entrar al hijo.
 * Se mantiene por debajo del padding del carril (`EXECUTION_ROW_PAD`) para que
 * los tramos horizontales pasen por el aire, nunca sobre una card.
 */
export const RAIL_EXIT = 16;

export interface TInvocationEdgeData extends Record<string, unknown> {
  /** X del riel vertical: canal a la izquierda de la columna del padre. */
  railX: number;
}

export type TInvocationEdge = Edge<TInvocationEdgeData, 'invocation'>;

/**
 * Arista de invocación padre → hijo.
 *
 * En lugar de cruzar el grafo en diagonal, sale del padre, se desvía al riel de
 * su columna, baja por el canal (libre de nodos) y entra al hijo desde arriba.
 * Todas las aristas de un mismo padre comparten `railX`, así se leen como un
 * **haz** que nace del padre y se ramifica hacia sus hijos: el origen queda
 * inequívoco.
 *
 * `style` y `markerEnd` llegan resueltos desde `AgentGraph` (reposo vs. activo).
 */
export const InvocationEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style,
  markerEnd,
}: EdgeProps<TInvocationEdge>) => {
  const railX = typeof data?.railX === 'number' ? data.railX : sourceX;
  const path = [
    `M ${sourceX} ${sourceY}`,
    `L ${sourceX} ${sourceY + RAIL_EXIT}`,
    `L ${railX} ${sourceY + RAIL_EXIT}`,
    `L ${railX} ${targetY - RAIL_EXIT}`,
    `L ${targetX} ${targetY - RAIL_EXIT}`,
    `L ${targetX} ${targetY}`,
  ].join(' ');

  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
};
