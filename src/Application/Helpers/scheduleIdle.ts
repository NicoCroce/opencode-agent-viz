interface TIdleDeadline {
  didTimeout: boolean;
  timeRemaining: () => number;
}

interface TIdleScheduler {
  requestIdleCallback?: (callback: (deadline: TIdleDeadline) => void) => number;
  cancelIdleCallback?: (handle: number) => void;
}

/**
 * Agenda un turno de idle: `requestIdleCallback` si existe (browser) y, en su
 * defecto, `setTimeout(..., 0)` (jsdom/entornos sin idle). Devuelve un cancelador
 * para abortar el turno si el plan se reinicia.
 *
 * Extraído del scheduling por lotes de `useGraphEnrichment` (una carga por turno
 * de idle para ceder el hilo sin congelar la UI, SC-007).
 */
export const scheduleIdle = (callback: () => void): { cancel: () => void } => {
  const scheduler = globalThis as unknown as TIdleScheduler;
  if (typeof scheduler.requestIdleCallback === 'function') {
    const handle = scheduler.requestIdleCallback(() => callback());
    return { cancel: () => scheduler.cancelIdleCallback?.(handle) };
  }
  const handle = setTimeout(callback, 0);
  return { cancel: () => clearTimeout(handle) };
};
