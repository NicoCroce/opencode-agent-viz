import type {
  SessionReasoningDelta,
  SessionReasoningEnded,
  SessionTextDelta,
  SessionTextEnded,
} from '@opencode/client';
import type { TChatStreamBuffer, TChatStreamPart } from '../Chat.entity';

/**
 * Buffer provisional del chat (data-model §2.1, `contracts/chat-stream-contract.md`
 * §2). Función **pura**: no muta la entrada y es determinista.
 *
 * Para los deltas su comportamiento es idéntico al slice `reduceChatStream`
 * (`upsertChatStreamBuffer`): concatena `delta` por `assistantMessageID:ordinal`
 * y **resetea** el buffer al cambiar el mensaje en curso (R2, acota la memoria a
 * un único mensaje). Además, al llegar un `*.ended` **limpia** el `ordinal` ya
 * consolidado para que el buffer no conserve una parte que el histórico ya
 * sustituyó (FR-003).
 */
export type TChatStreamDeltaEvent = SessionTextDelta | SessionReasoningDelta;
export type TChatStreamEndedEvent = SessionTextEnded | SessionReasoningEnded;
export type TChatStreamEvent = TChatStreamDeltaEvent | TChatStreamEndedEvent;

const isBuffer = (prev: unknown): prev is TChatStreamBuffer =>
  prev !== null &&
  typeof prev === 'object' &&
  'assistantMessageID' in prev &&
  'parts' in prev;

const isEndedEvent = (
  event: TChatStreamEvent,
): event is TChatStreamEndedEvent =>
  event.type === 'session.text.ended' ||
  event.type === 'session.reasoning.ended';

const kindOf = (type: TChatStreamDeltaEvent['type']): TChatStreamPart['kind'] =>
  type === 'session.text.delta' ? 'text' : 'reasoning';

export const mergeChatStream = (
  prev: unknown,
  event: TChatStreamEvent,
): TChatStreamBuffer => {
  const previous = isBuffer(prev) ? prev : null;

  if (isEndedEvent(event)) {
    // El mensaje ya no es el que el buffer tiene en curso: no se toca (podría
    // haber otro turno en marcha). Sin buffer previo, se abre uno vacío.
    if (
      !previous ||
      previous.assistantMessageID !== event.data.assistantMessageID
    ) {
      return (
        previous ?? {
          assistantMessageID: event.data.assistantMessageID,
          parts: {},
        }
      );
    }

    const parts = { ...previous.parts };
    delete parts[event.data.ordinal];
    return { assistantMessageID: previous.assistantMessageID, parts };
  }

  const { assistantMessageID, ordinal, delta } = event.data;
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
