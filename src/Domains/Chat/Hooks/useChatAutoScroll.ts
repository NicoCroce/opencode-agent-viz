import { useEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from '@app/Application/Helpers/prefersReducedMotion';

/**
 * Auto-scroll del timeline del chat (feature 009, iteración UX U2).
 *
 * Comportamiento natural de chat: al llegar contenido nuevo el hilo sigue al
 * fondo, pero **sin secuestrar** el scroll si el usuario está leyendo más arriba.
 * Toda la lógica vive en este hook puro de UI (AGENTS §4); `ChatPanel` solo le
 * engancha el `ref` al contenedor `overflow-auto`.
 *
 * El hook no observa el DOM por sí mismo (no conoce las entradas): recibe una
 * **señal de contenido** (nº de entradas o su firma) y, cuando cambia, hace
 * `scrollTo` al fondo **solo si el usuario ya estaba al fondo**. La intención del
 * usuario se sigue con el evento `scroll` del contenedor: si scrollea hacia
 * arriba se desengancha; al volver al fondo se re-engancha y el auto-scroll se
 * reanuda. `prefers-reduced-motion` se respeta usando scroll instantáneo.
 */

/**
 * Umbral de tolerancia (px) para considerar que el usuario está "al fondo".
 * Absorbe el redondeo sub-píxel y el scroll casi imperceptible, de modo que un
 * usuario que sigue la conversación no se desenganche por un delta mínimo.
 */
export const CHAT_AUTOSCROLL_THRESHOLD = 28;

/** Métricas mínimas del contenedor necesarias para medir la distancia al fondo. */
export interface TScrollMetrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

/**
 * ¿El contenedor está a `threshold` px o menos del fondo? Función pura y
 * exportada para poder probar el umbral sin montar el hook.
 */
export const isNearBottom = (
  { scrollHeight, scrollTop, clientHeight }: TScrollMetrics,
  threshold: number = CHAT_AUTOSCROLL_THRESHOLD,
): boolean => scrollHeight - scrollTop - clientHeight <= threshold;

export interface TUseChatAutoScrollResult {
  /** `ref` que se engancha al contenedor scrolleable del timeline. */
  ref: RefObject<HTMLDivElement | null>;
}

/**
 * `useChatAutoScroll(contentSignal)` — sigue al fondo el contenedor scrolleable.
 *
 * @param contentSignal Cambia cuando llega contenido nuevo (nº de entradas o su
 *   firma). Es la única dependencia del efecto de scroll.
 * @param threshold Tolerancia (px) para "estar al fondo"; por defecto
 *   `CHAT_AUTOSCROLL_THRESHOLD`.
 */
export const useChatAutoScroll = (
  contentSignal: string | number,
  threshold: number = CHAT_AUTOSCROLL_THRESHOLD,
): TUseChatAutoScrollResult => {
  const ref = useRef<HTMLDivElement | null>(null);

  // Arranca "enganchado": en la primera carga el hilo se posiciona al fondo.
  const stickToBottomRef = useRef(true);

  // Sigue la intención del usuario: cada scroll recalcula si sigue al fondo.
  // Si el usuario sube, se desengancha; al volver al fondo, se re-engancha.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleScroll = () => {
      stickToBottomRef.current = isNearBottom(element, threshold);
    };

    element.addEventListener('scroll', handleScroll);
    return () => element.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  // Al cambiar el contenido, solo se sigue al fondo si el usuario ya estaba
  // allí; si está leyendo más arriba, no se fuerza el scroll (no lo secuestra).
  useEffect(() => {
    const element = ref.current;
    if (!element || !stickToBottomRef.current) return;

    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';

    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ top: element.scrollHeight, behavior });
    } else {
      // Fallback para entornos sin `scrollTo` (p. ej. `jsdom`).
      element.scrollTop = element.scrollHeight;
    }

    // El scroll programático no debe desenganchar: seguimos al fondo.
    stickToBottomRef.current = true;
  }, [contentSignal]);

  return { ref };
};
