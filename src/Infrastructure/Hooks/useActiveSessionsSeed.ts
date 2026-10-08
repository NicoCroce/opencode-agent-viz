import { useCallback, useEffect, useRef } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { SessionStatus } from '@opencode/client';
import { queryKeys } from '@app/Domains/queryKeys';
import { opencodeService } from '../Services/opencodeClient';
import { applyActiveSeed } from '../lib/applyActiveSeed';
import { ACTIVE_POLL_MS } from '../lib/eventStream.constants';

/**
 * Siembra/refresca el mapa global de estados desde `session.active()`. V2
 * eliminó `session.status`: la única foto del estado en curso es
 * `session.active()`, que devuelve las sesiones que están corriendo. El seed
 * se vuelve a pedir periódicamente y al (re)conectar porque los eventos de
 * arranque no siempre llegan: sin esto, una sesión que empieza a correr
 * después del montaje queda sin `busy` y el grafo la deriva como `succeeded`.
 *
 * `reset` reemplaza el mapa completo (snapshot autoritativo: se usa al
 * conectar); sin `reset` solo agrega/actualiza las activas y preserva el
 * detalle `retry` que aportan los eventos.
 */
export const useActiveSessionsSeed = (
  queryClient: QueryClient,
  pollMs: number = ACTIVE_POLL_MS,
) => {
  /** Sesiones `busy` ausentes del último sondeo (gracia antes de degradarlas). */
  const missingActiveRef = useRef<Set<string>>(new Set());

  const refreshActive = useCallback(
    async (reset: boolean) => {
      try {
        const seed = await opencodeService.getActiveSessions();
        const key = queryKeys.sessions.status();
        const prev =
          queryClient.getQueryData<Record<string, SessionStatus>>(key) ?? {};
        queryClient.setQueryData(
          key,
          applyActiveSeed(prev, seed, {
            reset,
            missing: missingActiveRef.current,
          }),
        );
      } catch {
        // Sin respuesta: el SSE reintenta y el siguiente tick lo vuelve a probar.
      }
    },
    [queryClient],
  );

  useEffect(() => {
    void refreshActive(true);
    const timer = setInterval(() => {
      void refreshActive(false);
    }, pollMs);
    return () => clearInterval(timer);
  }, [refreshActive, pollMs]);

  return { refreshActive };
};
