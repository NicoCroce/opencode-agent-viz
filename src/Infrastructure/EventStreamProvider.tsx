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

  // Siembra el mapa global de estados. V2 eliminó `session.status`: la única
  // foto inicial es `session.active()`, que devuelve las sesiones en curso.
  // A partir de ahí los eventos `session.status`/`session.idle` lo refinan.
  useEffect(() => {
    let active = true;
    void opencodeService.getActiveSessions().then((seed) => {
      if (!active) return;
      queryClient.setQueryData<Record<string, SessionStatus>>(
        queryKeys.sessions.status(),
        (prev) => ({ ...seed, ...(prev ?? {}) }),
      );
    });
    return () => {
      active = false;
    };
  }, [queryClient]);

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
  }, [scheduleFlush, queryClient]);

  return (
    <EventStreamContext.Provider value={{ state }}>
      {children}
    </EventStreamContext.Provider>
  );
};
