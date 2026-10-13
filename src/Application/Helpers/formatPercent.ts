import { UNAVAILABLE } from './format/constants';

/**
 * Formatea un porcentaje ya calculado (p. ej. la porción de una categoría en el
 * desglose de contexto). Valores ausentes o no finitos caen al marcador
 * "no disponible" (`UNAVAILABLE`), nunca a `0%` (SC-007).
 */
export const formatPercent = (
  value: number | null | undefined,
  digits = 0,
): string =>
  value === null || value === undefined || !Number.isFinite(value)
    ? UNAVAILABLE
    : `${value.toFixed(digits)}%`;
