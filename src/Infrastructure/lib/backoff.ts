import { BACKOFF_BASE_MS, BACKOFF_MAX_MS } from './eventStream.constants';

/**
 * Retardo de reconexión con backoff exponencial: `base * 2 ** attempt`, tope
 * `maxMs`. `attempt` es el número de intentos fallidos acumulados.
 */
export const computeBackoffDelay = (
  attempt: number,
  { baseMs = BACKOFF_BASE_MS, maxMs = BACKOFF_MAX_MS } = {},
): number => Math.min(baseMs * 2 ** attempt, maxMs);
