import { useEffect } from 'react';

/**
 * Escucha la tecla `Escape` y ejecuta `handler` cuando el listener está habilitado.
 *
 * @param {() => void} handler - Acción a ejecutar al presionar `Escape`.
 * @param {boolean} enabled - Activa o desactiva el listener.
 */
export const useEscapeKey = (handler: () => void, enabled: boolean): void => {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handler();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handler, enabled]);
};
