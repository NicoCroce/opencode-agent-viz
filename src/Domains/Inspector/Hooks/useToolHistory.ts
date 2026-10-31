import { useCallback, useMemo, useState } from 'react';
import type { TToolHistoryEntry } from '../Inspector.entity';
import { toolHistoryRows, type TToolHistoryRow } from '../lib/toolHistoryRows';

/** Umbral fijo del historial de herramientas (no configurable). */
export const TOOL_HISTORY_LIMIT = 10;

export interface TToolHistoryView {
  visibleTools: TToolHistoryEntry[];
  /**
   * Filas visibles con duración, ratio y destacado, calculados sobre las
   * entradas visibles (la más lenta de la ventana fija la escala).
   */
  visibleRows: TToolHistoryRow[];
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

  // Ratio y destacado relativos a lo que se ve: la llamada más lenta de la
  // ventana visible marca la escala (con 700+ llamadas, un pico oculto dejaría
  // todas las barras visibles vacías).
  const visibleRows = useMemo(
    () => toolHistoryRows(visibleTools),
    [visibleTools],
  );

  const hiddenCount = Math.max(tools.length - TOOL_HISTORY_LIMIT, 0);
  const canExpand = tools.length > TOOL_HISTORY_LIMIT;

  const toggle = useCallback(() => setIsExpanded((value) => !value), []);

  return {
    visibleTools,
    visibleRows,
    hiddenCount,
    canExpand,
    isExpanded,
    toggle,
  };
};
