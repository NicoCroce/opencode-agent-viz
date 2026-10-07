import type { TToolHistoryEntry, TToolStat } from '../Inspector.entity';

/**
 * Mediana de una lista de duraciones; `null` si no hay ninguna (FR-036). Con
 * un número par de valores promedia los dos centrales.
 */
const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Agrupa las ejecuciones de herramientas por `name` y calcula, por cada una, el
 * número de llamadas (`calls`) y la mediana de `endedAt - startedAt` de las
 * ejecuciones con ambos tiempos (`medianMs`, `null` sin datos) (FR-036).
 *
 * Función pura: no muta la entrada y preserva el orden de primera aparición de
 * cada herramienta.
 */
export function medianToolDurations(
  tools: TToolHistoryEntry[],
): TToolStat[] {
  const durationsByName = new Map<string, number[]>();
  const callsByName = new Map<string, number>();
  const order: string[] = [];

  for (const tool of tools) {
    if (!callsByName.has(tool.name)) {
      callsByName.set(tool.name, 0);
      durationsByName.set(tool.name, []);
      order.push(tool.name);
    }
    callsByName.set(tool.name, (callsByName.get(tool.name) ?? 0) + 1);

    if (tool.startedAt !== undefined && tool.endedAt !== undefined) {
      durationsByName.get(tool.name)?.push(tool.endedAt - tool.startedAt);
    }
  }

  return order.map((name) => ({
    name,
    calls: callsByName.get(name) ?? 0,
    medianMs: median(durationsByName.get(name) ?? []),
  }));
}
