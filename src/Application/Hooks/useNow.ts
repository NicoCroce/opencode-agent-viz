import { useEffect, useState } from 'react';

/**
 * Intervalo por defecto del reloj en vivo, en ms (FR-006/FR-022,
 * SC-005/SC-007).
 */
export const DEFAULT_NOW_INTERVAL_MS = 1000;

/** Opciones del reloj en vivo; ambas son opcionales. */
export interface TUseNowOptions {
  /**
   * Si el reloj debe avanzar (p. ej. `range !== 'all'` o hay nodos activos).
   * Con el reloj inactivo no hay tick ni re-renders innecesarios (Principio
   * VII). Por defecto `true`.
   */
  enabled?: boolean;
  /** Intervalo de refresco inyectable; por defecto `DEFAULT_NOW_INTERVAL_MS`. */
  intervalMs?: number;
}

/**
 * Reloj en vivo compartido (antes duplicado en Graph y Sessions).
 *
 * Devuelve `Date.now()` y lo refresca con un `setInterval` **solo mientras
 * `enabled` es `true`**: sin trabajo activo el paso del tiempo no altera la
 * salida, así que no hay tick ni re-renders innecesarios (Principio VII). Al
 * desactivarse o al desmontar, el intervalo se limpia.
 *
 * Al activarse (transición `false → true`) refresca `now` con el `Date.now()`
 * del momento **antes** de arrancar el intervalo: la primera evaluación parte de
 * la hora real y no del instante obsoleto capturado en el montaje, que puede
 * haber quedado atrás mientras el reloj estaba inactivo (FR-006/FR-022,
 * SC-005/SC-007).
 *
 * La firma por objeto de opciones reemplaza las dos firmas posicionales
 * divergentes que existían (`(active, intervalMs)` en Sessions y
 * `(intervalMs, enabled)` en Graph), cuyo orden invertido de argumentos se
 * prestaba a confusión.
 *
 * @param options.enabled - Si el reloj debe avanzar. Por defecto `true`.
 * @param options.intervalMs - Intervalo de refresco; por defecto 1000 ms.
 * @returns El instante actual en milisegundos.
 */
export const useNow = ({
  enabled = true,
  intervalMs = DEFAULT_NOW_INTERVAL_MS,
}: TUseNowOptions = {}): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;

    // Refresco único al activarse (FR-006/FR-022). Es intencionadamente
    // síncrono para que la primera evaluación use la hora actual y no el
    // instante del montaje; el re-render extra está acotado a esta transición.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el reloj con el instante real al activarse
    setNow(Date.now());

    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, intervalMs]);

  return now;
};
