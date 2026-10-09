/**
 * Vocabulario y evaluación del rango temporal del listado de sesiones
 * (feature 005, FR-007..FR-009, FR-022).
 *
 * Lógica pura: no depende del SDK ni del reloj real; `now` siempre se inyecta,
 * de modo que la ventana rodante (FR-022) es testeable sin temporizadores.
 */

/** Rangos temporales predefinidos; conjunto cerrado y conocido (FR-007). */
export type TTimeRange = '1h' | '24h' | '7d' | '30d' | 'all';

/** Entrada de la tabla de rangos que alimenta el control temporal. */
export interface TTimeRangeOption {
  value: TTimeRange;
  label: string;
  /** Duración de la ventana en ms; `null` = sin corte ("todo"). */
  durationMs: number | null;
}

/** Rango por defecto y valor "sin corte" (FR-008). */
export const DEFAULT_TIME_RANGE: TTimeRange = 'all';

/** Rangos predefinidos con su etiqueta visible y duración (FR-007). */
export const TIME_RANGES: readonly TTimeRangeOption[] = [
  { value: '1h', label: 'Última hora', durationMs: 3_600_000 },
  { value: '24h', label: 'Últimas 24 horas', durationMs: 86_400_000 },
  { value: '7d', label: 'Últimos 7 días', durationMs: 604_800_000 },
  { value: '30d', label: 'Últimos 30 días', durationMs: 2_592_000_000 },
  { value: DEFAULT_TIME_RANGE, label: 'Todo', durationMs: null },
];

/** Duración de la ventana de un rango; `null` para `all` (sin corte). */
export const durationFor = (range: TTimeRange): number | null =>
  TIME_RANGES.find((option) => option.value === range)?.durationMs ?? null;

/**
 * ¿La última actividad `updatedAt` cae dentro de la ventana `range`?
 *
 * - `all` → siempre `true` (sin corte).
 * - `updatedAt` no finito (`null`/`undefined`/`NaN`) → `false` para cualquier
 *   rango acotado (edge case "sesión sin actividad registrada").
 * - En otro caso → `now - updatedAt <= durationMs` (frontera incluida).
 */
export const isWithinTimeRange = (
  updatedAt: number | null | undefined,
  range: TTimeRange,
  now: number,
): boolean => {
  if (range === DEFAULT_TIME_RANGE) return true;
  const durationMs = durationFor(range);
  if (durationMs === null) return true;
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) return false;
  return now - updatedAt <= durationMs;
};

/** Etiqueta visible del rango activo (`Última hora`, `Todo`, …) (FR-007). */
export const timeRangeLabel = (range: TTimeRange): string =>
  TIME_RANGES.find((option) => option.value === range)?.label ?? 'Todo';
