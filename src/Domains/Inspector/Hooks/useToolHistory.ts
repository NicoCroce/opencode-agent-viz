import { useCallback, useMemo, useState } from 'react';
import type { TToolHistoryEntry } from '../Inspector.entity';

/** Umbral fijo del historial de herramientas (no configurable). */
export const TOOL_HISTORY_LIMIT = 10;

export interface TToolHistoryView {
  visibleTools: TToolHistoryEntry[];
  hiddenCount: number;
  canExpand: boolean;
  isExpanded: boolean;
  toggle: () => void;
}

/**
 * Vista truncable del historial de herramientas: preserva el orden
 * cronológico de entrada (no lo invierte). Con más de `TOOL_HISTORY_LIMIT`
 * entradas expone las primeras y permite expandir/contraer.
 */
export const useToolHistory = (
  tools: TToolHistoryEntry[],
): TToolHistoryView => {
  const [isExpanded, setIsExpanded] = useState(false);

  const visibleTools = useMemo(
    () => (isExpanded ? tools : tools.slice(0, TOOL_HISTORY_LIMIT)),
    [isExpanded, tools],
  );

  const hiddenCount = Math.max(tools.length - TOOL_HISTORY_LIMIT, 0);
  const canExpand = tools.length > TOOL_HISTORY_LIMIT;

  const toggle = useCallback(() => setIsExpanded((value) => !value), []);

  return { visibleTools, hiddenCount, canExpand, isExpanded, toggle };
};
