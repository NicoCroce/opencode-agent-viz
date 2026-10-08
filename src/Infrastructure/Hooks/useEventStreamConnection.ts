import { useEffect, useRef, useState } from 'react';
import type { V2Event } from '@opencode/client';
import type { TConnectionState } from '@app/Domains/Connection/Connection.entity';
import { opencodeService } from '../Services/opencodeClient';
import { computeBackoffDelay } from '../lib/backoff';
import { MAX_ATTEMPTS } from '../lib/eventStream.constants';

interface EventStreamHandlers {
  onEvent: (event: V2Event) => void;
  onConnected?: () => void;
  onReconnected?: () => void;
}

/**
 * Máquina de conexión del stream SSE global (`GET /api/event` no acepta
 * `location`, así que el server emite para todos los proyectos y cada evento
 * trae el suyo). Una sola suscripción, reconexión con backoff exponencial y
 * `AbortController`/flag `cancelled` para sobrevivir al doble montaje de
 * StrictMode (el cleanup de la primera suscripción no debe pisar el `connected`
 * de la segunda).
 */
export const useEventStreamConnection = ({
  onEvent,
  onConnected,
  onReconnected,
}: EventStreamHandlers): TConnectionState => {
  const [state, setState] = useState<TConnectionState>('reconnecting');

  // Handlers "latest" para que la identidad de los callbacks no reinicie el
  // stream: el efecto de conexión depende solo del montaje.
  const handlersRef = useRef<EventStreamHandlers>({
    onEvent,
    onConnected,
    onReconnected,
  });
  useEffect(() => {
    handlersRef.current = { onEvent, onConnected, onReconnected };
  });

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
          handlersRef.current.onConnected?.();
          attempt = 0;

          for await (const event of stream) {
            if (cancelled || controller.signal.aborted) break;
            // El server emite `server.connected` al abrir el stream: reafirmamos
            // el estado para sobrevivir al doble-montaje de StrictMode (el cleanup
            // de la primera suscripción puede pisar el `connected` de la segunda).
            if (event.type === 'server.connected') setState('connected');
            handlersRef.current.onEvent(event);
          }
          if (cancelled || controller.signal.aborted) break;
          setState('reconnecting');
        } catch {
          if (cancelled || controller.signal.aborted) break;
          attempt += 1;
          setState(attempt >= MAX_ATTEMPTS ? 'disconnected' : 'reconnecting');
        }

        if (attempt >= MAX_ATTEMPTS) break;

        const delay = computeBackoffDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (cancelled) break;
        // Tras una reconexión el server puede haberse perdido eventos: refrescamos.
        handlersRef.current.onReconnected?.();
      }
      // Solo marcamos desconectado si el efecto sigue vivo; en un cleanup
      // (StrictMode/unmount) no debemos pisar el estado de la nueva suscripción.
      if (!cancelled) setState('disconnected');
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return state;
};
