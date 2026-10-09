import { useCallback, useEffect, useRef } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { SessionStatus } from '@opencode/client';
import type { TActivityMap } from '@app/Domains/Graph/Graph.entity';
import { setActivity } from '@app/Domains/Graph/lib/eventReduce/cache';
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
 *
 * Además, al (re)conectar (`reset`) siembra `activity[id] = now` para las
 * activas del mismo snapshot (research R6, contract session-activity §5):
 * refuerza el edge case de reconexión —una activa que no emitió actividad desde
 * la conexión no queda con la marca atrasada— reutilizando el mismo
 * `session.active()` (sin red adicional). `setActivity` conserva la monotonía.
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

        // R6: al (re)conectar la foto de activas es autoritativa. Sembrar la
        // marca de actividad de cada activa a `now` mantiene fresca la ventana
        // (paridad en vivo/refresco) sin red extra. El `max` de `setActivity`
        // la vuelve monótona: nunca retrocede.
        const activeIds = Object.keys(seed);
        if (reset && activeIds.length > 0) {
          const now = Date.now();
          queryClient.setQueryData<TActivityMap>(
            queryKeys.sessions.activity(),
            (prevActivity) => {
              let next = prevActivity ?? {};
              for (const id of activeIds) next = setActivity(next, id, now);
              return next;
            },
          );
        }
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
