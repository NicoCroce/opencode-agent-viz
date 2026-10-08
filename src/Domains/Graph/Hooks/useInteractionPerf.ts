import { useEffect, useRef } from 'react';
import { PERF_METRIC, perfMark, perfMeasure } from '@app/Application/Helpers';

/**
 * Marcas de inicio de una transición de interacción (contrato de instrumentación
 * §4). La medida `graph.interaction` se resuelve en el efecto posterior al commit
 * —"pintado siguiente"—, nunca por `mousemove`/frame (criterio P5).
 */
const INTERACTION_HOVER_MARK = 'graph.interaction.hover.start';
const INTERACTION_SELECT_MARK = 'graph.interaction.select.start';

export interface UseInteractionPerfInput {
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  nodeCount: number;
}

/**
 * Mide `graph.interaction` por transición de hover/selección (contrato de
 * instrumentación §4, criterio P5): marca al cambiar el foco y mide en el commit
 * siguiente, nunca por frame. Los refs permiten ignorar el montaje.
 */
export const useInteractionPerf = ({
  hoveredNodeId,
  selectedNodeId,
  nodeCount,
}: UseInteractionPerfInput): void => {
  const previousHoverRef = useRef(hoveredNodeId);
  useEffect(() => {
    if (previousHoverRef.current === hoveredNodeId) return;
    previousHoverRef.current = hoveredNodeId;
    perfMark(INTERACTION_HOVER_MARK);
    perfMeasure(PERF_METRIC.interaction, INTERACTION_HOVER_MARK, {
      nodeCount,
      kind: 'hover',
    });
  }, [hoveredNodeId, nodeCount]);

  const previousSelectedRef = useRef(selectedNodeId);
  useEffect(() => {
    if (previousSelectedRef.current === selectedNodeId) return;
    previousSelectedRef.current = selectedNodeId;
    perfMark(INTERACTION_SELECT_MARK);
    perfMeasure(PERF_METRIC.interaction, INTERACTION_SELECT_MARK, {
      nodeCount,
      kind: 'select',
    });
  }, [selectedNodeId, nodeCount]);
};
