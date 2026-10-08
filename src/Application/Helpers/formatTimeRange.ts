import { UNAVAILABLE_LABEL } from './format/constants';

export interface TTimeRangeInput {
  startedAt: number | null;
  endedAt: number | null;
  isRunning: boolean;
}

const RUNNING_LABEL = 'en curso';
const RANGE_SEPARATOR = ' – ';

const formatClock = (ms: number): string =>
  new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

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
): string => {
  const start = startedAt === null ? UNAVAILABLE_LABEL : format(startedAt);

  // `isRunning` gana siempre sobre `endedAt`: mientras corre nunca se muestra
  // una hora que cambia sola (FR-015).
  const end = isRunning
    ? RUNNING_LABEL
    : endedAt === null
      ? UNAVAILABLE_LABEL
      : format(endedAt);

  return `${start}${RANGE_SEPARATOR}${end}`;
};

/** Rango hora–hora (`HH:mm – HH:mm`), como el de la lista de sesiones. */
export const formatTimeRange = (input: TTimeRangeInput): string =>
  buildRange(formatClock, input);

/** Rango fecha-hora–fecha-hora (`dd/mm HH:mm – dd/mm HH:mm`), para el grafo. */
export const formatDateTimeRange = (input: TTimeRangeInput): string =>
  buildRange(formatDateTime, input);
