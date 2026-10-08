/** Tiempos y límites del stream SSE global (`EventStreamProvider`). */
export const FLUSH_INTERVAL_MS = 100;
export const MAX_ATTEMPTS = 5;
/**
 * Cada cuánto se re-siembra la foto de sesiones activas (`session.active()`).
 * V2 no emite un evento de "arranque" fiable por ejecución, así que sin este
 * refresco una sesión que empieza a correr después del montaje nunca recibe
 * `busy` y el grafo la deriva como terminada.
 */
export const ACTIVE_POLL_MS = 2500;
export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 30000;
