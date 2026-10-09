import { UNAVAILABLE_LABEL } from './format/constants';
import { formatClock } from './format/clock';

export interface TTimeRangeInput {
  startedAt: number | null;
  endedAt: number | null;
  isRunning: boolean;
}

const RUNNING_LABEL = 'en curso';
const RANGE_SEPARATOR = ' – ';
const RANGE_ARROW = ' → ';

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * Fecha y hora compactas `dd/mm hh:mm` (24h), sin año. Pensadas para el grafo,
 * donde el ancho es acotado; determinísticas para no depender del locale.
 */
const formatDateTime = (ms: number): string => {
  const date = new Date(ms);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const buildRange = (
  format: (ms: number) => string,
  { startedAt, endedAt, isRunning }: TTimeRangeInput,
  separator: string,
): string => {
  const start = startedAt === null ? UNAVAILABLE_LABEL : format(startedAt);

  // `isRunning` gana siempre sobre `endedAt`: mientras corre nunca se muestra
  // una hora que cambia sola (FR-015).
  const end = isRunning
    ? RUNNING_LABEL
    : endedAt === null
      ? UNAVAILABLE_LABEL
      : format(endedAt);

  return `${start}${separator}${end}`;
};

/**
 * Rango hora–hora compacto `HH:mm → HH:mm`, para el nodo del grafo, donde el
 * ancho es acotado y la fecha se sobreentiende (el `→` marca la secuencia
 * inicio–fin frente al guion de la lista de sesiones).
 */
export const formatTimeRange = (input: TTimeRangeInput): string =>
  buildRange(formatClock, input, RANGE_ARROW);

/** Rango fecha-hora–fecha-hora (`dd/mm HH:mm – dd/mm HH:mm`), para listas. */
export const formatDateTimeRange = (input: TTimeRangeInput): string =>
  buildRange(formatDateTime, input, RANGE_SEPARATOR);
