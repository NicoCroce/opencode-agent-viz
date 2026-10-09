import type { V2Event } from '@opencode/client';
import { opencodeClient } from './client';

/** Único stream SSE global de OpenCode. */
export interface EventReadService {
  /**
   * Un unico stream SSE global (`GET /api/event`, sin `location`). El cliente
   * V2 comparte la conexion entre suscriptores y NO reconecta solo: si el
   * iterador termina, hay que volver a suscribirse.
   */
  subscribeEvents: (signal?: AbortSignal) => AsyncIterable<V2Event>;
}

export const eventReadService: EventReadService = {
  subscribeEvents(signal) {
    return opencodeClient.event.subscribe({ signal });
  },
};
