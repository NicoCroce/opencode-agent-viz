import { UNAVAILABLE } from './format/constants';

/**
 * Formatea una aceleración ya calculada (p. ej. `serialMs / wallMs` del
 * paralelismo) con el prefijo `×`. Valores ausentes o no finitos caen al
 * marcador "no disponible" (`UNAVAILABLE`), nunca a `×0` (SC-007).
 */
export const formatSpeedup = (
  value: number | null | undefined,
  digits = 1,
): string =>
  value === null || value === undefined || !Number.isFinite(value)
    ? UNAVAILABLE
    : `×${value.toFixed(digits)}`;
