import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';
import { useNodeFocus, type TNodeFocus } from './NodeFocusContext';

/**
 * Separación vertical antes de desviarse al riel y antes de entrar al hijo.
 * Se mantiene por debajo del padding del carril (`EXECUTION_ROW_PAD`) para que
 * los tramos horizontales pasen por el aire, nunca sobre una card.
 */
export const RAIL_EXIT = 16;

/**
 * Distancia del bus horizontal sobre la fila de hijos (vista "Grafo"): los
 * hermanos comparten `targetY`, así que todos sus tramos coinciden en un bus.
 */
export const TREE_BUS_OFFSET = 28;

export interface TInvocationEdgeData extends Record<string, unknown> {
  /** X del riel vertical: canal a la izquierda de la columna del padre (Carriles). */
  railX?: number;
  /**
   * Trazado: `rail` (Carriles, baja por el canal de la columna) o `tree`
   * (Grafo, codo con bus horizontal sobre los hijos). Por defecto, `rail`.
   */
  routing?: 'rail' | 'tree';
}

/** Codo de árbol: baja del padre, cruza por el bus y entra al hijo desde arriba. */
const treePath = (
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string => {
  const busY = Math.max(sourceY + RAIL_EXIT, targetY - TREE_BUS_OFFSET);
  return [
    `M ${sourceX} ${sourceY}`,
    `L ${sourceX} ${busY}`,
    `L ${targetX} ${busY}`,
    `L ${targetX} ${targetY}`,
  ].join(' ');
};

export type TInvocationEdge = Edge<TInvocationEdgeData, 'invocation'>;

/**
 * Reposo: hairline sólido `--edge`. Sin alfa: las aristas de un padre comparten
 * riel y con opacidad se aclaraban al superponerse.
 */
const REST_STROKE = 'hsl(var(--edge))';
/** Foco (linaje) y hover: el acento cyan, como el camino activo del diseño. */
const FOCUS_STROKE = 'hsl(var(--accent))';
/** Fuera del linaje: un tono sólido más oscuro (tampoco se acumula). */
const DIMMED_STROKE = 'hsl(var(--border))';

/** Reposo: sin foco ni hover (contrato de render §2). */
const REST_STYLE: CSSProperties = {
  stroke: REST_STROKE,
  strokeWidth: 1,
  opacity: 1,
};

/** Arista dentro del linaje del nodo seleccionado (contrato de render §2). */
const LINEAGE_STYLE: CSSProperties = {
  stroke: FOCUS_STROKE,
  strokeWidth: 1.75,
  opacity: 1,
};

/** Arista fuera del linaje: se atenúa con un tono sólido más oscuro. */
const LINEAGE_OUTSIDE_STYLE: CSSProperties = {
  stroke: DIMMED_STROKE,
  strokeWidth: 1,
  opacity: 1,
};

/** Hover sin foco: se trazan las relaciones directas del nodo. */
const HOVER_STYLE: CSSProperties = {
  stroke: FOCUS_STROKE,
  strokeWidth: 1.5,
  opacity: 1,
};

/**
 * Resuelve el estilo de la arista a partir del foco publicado por contexto
 * (contrato de render §2). Precedencia: el foco (selección/linaje) gana sobre
 * el hover; el hover solo actúa cuando no hay selección.
 */
const resolveFocusStyle = (
  focus: TNodeFocus,
  id: string,
  source: string,
  target: string,
): CSSProperties => {
  if (focus.selectedNodeId !== null) {
    return focus.lineageEdgeIds.has(id) ? LINEAGE_STYLE : LINEAGE_OUTSIDE_STYLE;
  }
  if (
    focus.hoveredNodeId !== null &&
    (source === focus.hoveredNodeId || target === focus.hoveredNodeId)
  ) {
    return HOVER_STYLE;
  }
  return REST_STYLE;
};

/**
 * Arista de invocación padre → hijo.
 *
 * En lugar de cruzar el grafo en diagonal, sale del padre, se desvía al riel de
 * su columna, baja por el canal (libre de nodos) y entra al hijo desde arriba.
 * Todas las aristas de un mismo padre comparten `railX`, así se leen como un
 * **haz** que nace del padre y se ramifica hacia sus hijos: el origen queda
 * inequívoco.
 *
 * El resaltado de hover/linaje se resuelve aquí desde `useNodeFocus` (contrato
 * de render §2), no viene "horneado" en `style`: así hover y selección no
 * reconstruyen el array de aristas de React Flow. Mientras `AgentGraph` aún
 * entregue un `style` resuelto (transición de T028), se usa como respaldo solo
 * cuando no hay foco, para no alterar el aspecto en ese estado.
 */
export const InvocationEdge = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style,
  markerEnd,
}: EdgeProps<TInvocationEdge>) => {
  const focus = useNodeFocus();
  const railX = typeof data?.railX === 'number' ? data.railX : sourceX;
  const path =
    data?.routing === 'tree'
      ? treePath(sourceX, sourceY, targetX, targetY)
      : [
          `M ${sourceX} ${sourceY}`,
          `L ${sourceX} ${sourceY + RAIL_EXIT}`,
          `L ${railX} ${sourceY + RAIL_EXIT}`,
          `L ${railX} ${targetY - RAIL_EXIT}`,
          `L ${targetX} ${targetY - RAIL_EXIT}`,
          `L ${targetX} ${targetY}`,
        ].join(' ');

  const hasFocus = focus.selectedNodeId !== null || focus.hoveredNodeId !== null;
  const resolvedStyle = hasFocus
    ? resolveFocusStyle(focus, id, source, target)
    : (style ?? REST_STYLE);

  return <BaseEdge path={path} markerEnd={markerEnd} style={resolvedStyle} />;
};
