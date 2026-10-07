import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SessionStatus, V2Event } from '@opencode/client';
import { opencodeService } from './Services/opencodeClient';
import { reduceEvent } from '@app/Domains/Graph/lib/eventReducer';
import { queryKeys } from '@app/Domains/queryKeys';
import type { TConnectionState } from '@app/Domains/Connection/Connection.entity';

interface EventStreamContextValue {
  state: TConnectionState;
}

const EventStreamContext = createContext<EventStreamContextValue>({
  state: 'disconnected',
});

export const useEventStream = (): EventStreamContextValue =>
  useContext(EventStreamContext);

const FLUSH_INTERVAL_MS = 100;
const MAX_ATTEMPTS = 5;
/**
 * Cada cuánto se re-siembra la foto de sesiones activas (`session.active()`).
 * V2 no emite un evento de "arranque" fiable por ejecución, así que sin este
 * refresco una sesión que empieza a correr después del montaje nunca recibe
 * `busy` y el grafo la deriva como terminada.
 */
const ACTIVE_POLL_MS = 2500;

export const EventStreamProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<TConnectionState>('reconnecting');
  const bufferRef = useRef<V2Event[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    const events = bufferRef.current;
    if (events.length === 0) return;
    bufferRef.current = [];
    for (const event of events) {
      const updates = reduceEvent(event);
      if (!updates) continue;
      for (const update of updates) {
        if (update.kind === 'invalidate') {
          void queryClient.invalidateQueries({ queryKey: update.queryKey });
        } else {
          queryClient.setQueryData(update.queryKey, update.updater);
        }
      }
    }
  }, [queryClient]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flush();
    }, FLUSH_INTERVAL_MS);
  }, [flush]);

  // Siembra/refresca el mapa global de estados desde `session.active()`. V2
  // eliminó `session.status`: la única foto del estado en curso es
  // `session.active()`, que devuelve las sesiones que están corriendo. El seed
  // se vuelve a pedir periódicamente y al (re)conectar porque los eventos de
  // arranque no siempre llegan: sin esto, una sesión que empieza a correr
  // después del montaje queda sin `busy` y el grafo la deriva como `succeeded`.
  //
  // `reset` reemplaza el mapa completo (snapshot autoritativo: se usa al
  // conectar); sin `reset` solo agrega/actualiza las activas y preserva el
  // detalle `retry` que aportan los eventos.
  const refreshActive = useCallback(
    async (reset: boolean) => {
      try {
        const seed = await opencodeService.getActiveSessions();
        queryClient.setQueryData<Record<string, SessionStatus>>(
          queryKeys.sessions.status(),
          (prev) => {
            const next = reset ? {} : { ...(prev ?? {}) };
            for (const [id, status] of Object.entries(seed)) {
              if (!reset && next[id]?.type === 'retry') continue;
              next[id] = status;
            }
            return next;
          },
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
    }, ACTIVE_POLL_MS);
    return () => clearInterval(timer);
  }, [refreshActive]);

  // Un unico stream SSE global: `GET /api/event` no acepta `location`, asi que
  // el server emite para todos los proyectos y cada evento trae el suyo.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      let attempt = 0;
      while (!cancelled && !controller.signal.aborted) {
        try {
          setState('reconnecting');
          const stream = opencodeService.subscribeEvents(controller.signal);
          setState('connected');
          // Foto autoritativa de las sesiones activas al (re)conectar.
          void refreshActive(true);
          attempt = 0;

          for await (const event of stream) {
            if (cancelled || controller.signal.aborted) break;
            // El server emite `server.connected` al abrir el stream: reafirmamos
            // el estado para sobrevivir al doble-montaje de StrictMode (el cleanup
            // de la primera suscripción puede pisar el `connected` de la segunda).
            if (event.type === 'server.connected') setState('connected');
            bufferRef.current.push(event);
            scheduleFlush();
          }
          if (cancelled || controller.signal.aborted) break;
          setState('reconnecting');
        } catch {
          if (cancelled || controller.signal.aborted) break;
          attempt += 1;
          setState(attempt >= MAX_ATTEMPTS ? 'disconnected' : 'reconnecting');
        }

        if (attempt >= MAX_ATTEMPTS) break;

        const delay = Math.min(1000 * 2 ** attempt, 30000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (cancelled) break;
        // Tras una reconexión el server puede haberse perdido eventos: refrescamos.
        void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      }
      // Solo marcamos desconectado si el efecto sigue vivo; en un cleanup
      // (StrictMode/unmount) no debemos pisar el estado de la nueva suscripción.
      if (!cancelled) setState('disconnected');
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [scheduleFlush, queryClient, refreshActive]);

  return (
    <EventStreamContext.Provider value={{ state }}>
      {children}
    </EventStreamContext.Provider>
  );
};
