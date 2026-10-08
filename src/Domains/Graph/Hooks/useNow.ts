import { useEffect, useState } from 'react';

/** Intervalo por defecto del reloj en vivo del grafo, en ms (FR-006, SC-005). */
export const DEFAULT_NOW_INTERVAL_MS = 1000;

/**
 * Reloj en vivo del modelo de grafo (FR-006, SC-005, R3).
 *
 * Devuelve `Date.now()` y lo refresca con un `setInterval` **solo mientras
 * `enabled` es `true`**: sin ningún nodo activo (`isActiveStatus`) el paso del
 * tiempo no altera `durationMs` de ningún nodo, así que no hay tick ni
 * re-renders innecesarios (Principio VII). El consumidor (`useGraphModel`)
 * condiciona `enabled` a que exista al menos un nodo activo.
 *
 * Al activarse (transición `false → true`) refresca `now` con el instante
 * actual **antes** de arrancar el intervalo: la primera evaluación parte de la
 * hora real y no del instante obsoleto capturado en el montaje, que puede haber
 * quedado atrás mientras el reloj estaba inactivo.
 *
 * @param intervalMs - Intervalo de refresco inyectable; por defecto 1000 ms.
 * @param enabled - Si el reloj debe avanzar (p. ej. hay nodos activos).
 * @returns El instante actual en milisegundos.
 */
export const useNow = (
  intervalMs: number = DEFAULT_NOW_INTERVAL_MS,
  enabled = true,
): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;

    // Refresco único al activarse (FR-006, SC-005). Es intencionadamente
    // síncrono para que la primera evaluación use la hora actual y no el
    // instante del montaje; el re-render extra está acotado a esta transición.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el reloj con el instante real al activarse
    setNow(Date.now());

    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);

  return now;
};
