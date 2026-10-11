import type {
  TChatStreamBuffer,
  TChatStreamPart,
} from '@app/Domains/Chat/Chat.entity';
import { queryKeys } from '../../../../queryKeys';
import type { TReducibleEvent } from '../eventTypes';
import { set } from '../queryUpdates';
import type { TEventUpdate } from '../queryUpdates';

/**
 * Slice aditivo de los deltas de texto/razonamiento (data-model §2.1). Mantiene
 * por sesión el buffer del mensaje en curso en la clave **raíz**
 * `['chatStream', sessionID]`, fuera de `['sessions']`: así la invalidación por
 * prefijo de `sessions.all` no pisa el buffer y el grafo no reacciona a los
 * deltas (FR-016, SC-003). Un `set` por delta; el batching del
 * `EventStreamProvider` agrupa los flushes (~10/s).
 */
type TChatStreamEvent = Extract<
  TReducibleEvent,
  { type: 'session.text.delta' | 'session.reasoning.delta' }
>;

const isBuffer = (prev: unknown): prev is TChatStreamBuffer =>
  prev !== null &&
  typeof prev === 'object' &&
  'assistantMessageID' in prev &&
  'parts' in prev;

const kindOf = (type: TChatStreamEvent['type']): TChatStreamPart['kind'] =>
  type === 'session.text.delta' ? 'text' : 'reasoning';

/**
 * Upsert puro del buffer por `assistantMessageID:ordinal` (R2): si cambia el
 * mensaje en curso, **resetea** el buffer (acota la memoria a un único
 * mensaje); si es el mismo, concatena `delta` en el `ordinal` correspondiente.
 */
export const upsertChatStreamBuffer = (
  prev: unknown,
  event: TChatStreamEvent,
): TChatStreamBuffer => {
  const { assistantMessageID, ordinal, delta } = event.data;
  const previous = isBuffer(prev) ? prev : null;
  const sameMessage = previous?.assistantMessageID === assistantMessageID;
  const parts = sameMessage ? previous.parts : {};
  const current = parts[ordinal];

  return {
    assistantMessageID,
    parts: {
      ...parts,
      [ordinal]: {
        kind: kindOf(event.type),
        text: (current?.text ?? '') + delta,
        at: event.created,
      },
    },
  };
};

export const reduceChatStream = (event: TChatStreamEvent): TEventUpdate => [
  set(queryKeys.chatStream.for(event.data.sessionID), (prev) =>
    upsertChatStreamBuffer(prev, event),
  ),
];
