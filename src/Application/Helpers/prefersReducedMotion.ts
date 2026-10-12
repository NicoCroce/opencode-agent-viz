/**
 * `true` si el sistema pide movimiento reducido (`prefers-reduced-motion: reduce`).
 *
 * Función pura y defensiva: en entornos sin `window` o sin `matchMedia`
 * (p. ej. `jsdom`) asume animación permitida. La comparten el auto-scroll del
 * timeline (`useChatAutoScroll`) y el salto resaltado del chat (`ChatPanel`),
 * que eligen `scroll` instantáneo cuando el usuario pide menos movimiento.
 */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
