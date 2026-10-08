import { useEffect, useState } from 'react';

/** Intervalo por defecto del reloj en vivo, en ms (FR-022, SC-007). */
export const DEFAULT_NOW_INTERVAL_MS = 1000;

/**
 * Reloj en vivo para la ventana rodante del filtro temporal (FR-022, SC-007).
 *
 * Devuelve la hora actual (`Date.now()`) y la refresca con un `setInterval`
 * **solo mientras `active` es `true`**; al desactivarse o al desmontar, el
 * intervalo se limpia. Con el rango "todo" (`active === false`) el tiempo no
 * altera la lista, así que no hay re-renders innecesarios (Principio VII).
 *
 * Al activarse (transición `false → true`) refresca `now` con el `Date.now()`
 * del momento **antes** de arrancar el intervalo: así la primera evaluación de
 * un rango acotado no parte del instante obsoleto capturado en el montaje, que
 * puede haber quedado atrás mientras el reloj estaba inactivo (FR-022, SC-007).
 *
 * @param active - Si el reloj debe avanzar (p. ej. `range !== 'all'`).
 * @param intervalMs - Intervalo de refresco inyectable; por defecto 1000 ms.
 * @returns El instante actual en milisegundos.
 */
export const useNow = (
  active: boolean,
  intervalMs: number = DEFAULT_NOW_INTERVAL_MS,
): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;

    // Refresco único al activarse (FR-022, SC-007). Es intencionadamente
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
  }, [active, intervalMs]);

  return now;
};
