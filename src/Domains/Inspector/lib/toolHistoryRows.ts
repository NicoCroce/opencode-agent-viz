import type { TToolHistoryEntry } from '../Inspector.entity';

/** Estados de una llamada que siguen en curso (se destacan en la lista). */
export const ACTIVE_TOOL_STATUSES: ReadonlySet<string> = new Set([
  'running',
  'streaming',
]);

/** Fila derivada del historial de herramientas para la lista del detalle. */
export interface TToolHistoryRow {
  entry: TToolHistoryEntry;
  /** `endedAt - startedAt` con ambos tiempos; `null` sin datos. */
  durationMs: number | null;
  /** Duración relativa a la llamada más lenta del historial (0..1). */
  ratio: number;
  /** Llamada destacada: la más lenta del historial o una todavía en curso. */
  isHighlighted: boolean;
}

const durationOf = (entry: TToolHistoryEntry): number | null =>
  entry.startedAt !== undefined && entry.endedAt !== undefined
    ? Math.max(entry.endedAt - entry.startedAt, 0)
    : null;

/**
 * Deriva las filas de la lista de herramientas (función pura): duración, ratio
 * frente a la más lenta y destacado. Solo se destaca **una** llamada por
 * lentitud (la primera con la duración máxima, si es > 0); las que siguen en
 * curso se destacan siempre. Conserva el orden de entrada.
 */
export const toolHistoryRows = (
  tools: TToolHistoryEntry[],
): TToolHistoryRow[] => {
  const durations = tools.map(durationOf);
  const maxMs = Math.max(0, ...durations.map((ms) => ms ?? 0));
  const slowestIndex =
    maxMs > 0 ? durations.findIndex((ms) => ms === maxMs) : -1;

  return tools.map((entry, index) => {
    const durationMs = durations[index];
    return {
      entry,
      durationMs,
      ratio: maxMs > 0 && durationMs !== null ? durationMs / maxMs : 0,
      isHighlighted:
        index === slowestIndex || ACTIVE_TOOL_STATUSES.has(entry.status),
    };
  });
};
