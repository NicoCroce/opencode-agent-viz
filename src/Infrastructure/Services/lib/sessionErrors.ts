import { isSessionNotFoundError } from '@opencode/client';

/**
 * `true` cuando el servidor respondió que la sesión no existe (`SessionNotFoundError`).
 * Distingue una sesión inexistente de un fallo de red/servidor, que NO es "no encontrada".
 */
export const isSessionNotFound = (error: unknown): boolean =>
  isSessionNotFoundError(error);
