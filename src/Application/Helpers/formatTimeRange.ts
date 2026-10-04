export interface TTimeRangeInput {
  startedAt: number | null;
  endedAt: number | null;
  isRunning: boolean;
}

const UNAVAILABLE_LABEL = 'no disponible';
const RUNNING_LABEL = 'en curso';
const RANGE_SEPARATOR = ' – ';

const formatClock = (ms: number): string =>
  new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatTimeRange = ({
  startedAt,
  endedAt,
  isRunning,
}: TTimeRangeInput): string => {
  const start = startedAt === null ? UNAVAILABLE_LABEL : formatClock(startedAt);

  // `isRunning` gana siempre sobre `endedAt`: mientras corre nunca se muestra
  // una hora que cambia sola (FR-015).
  const end = isRunning
    ? RUNNING_LABEL
    : endedAt === null
      ? UNAVAILABLE_LABEL
      : formatClock(endedAt);

  return `${start}${RANGE_SEPARATOR}${end}`;
};
