import { queryKeys } from '../../../../queryKeys';
import type { TReducibleEvent } from '../eventTypes';
import {
  patchAssistantInfo,
  reasoningPart,
  replaceContent,
  textPart,
  upsertAssistantShell,
  upsertContentPart,
} from '../messageParts';
import { set } from '../queryUpdates';
import type { TEventUpdate } from '../queryUpdates';
import { upsertToolPart } from '../toolParts';

type TMessagesEvent = Extract<
  TReducibleEvent,
  {
    type:
      | 'session.step.started'
      | 'session.step.ended'
      | 'session.step.failed'
      | 'session.text.ended'
      | 'session.reasoning.ended'
      | 'session.message.content.updated'
      | 'session.tool.input.started'
      | 'session.tool.called'
      | 'session.tool.success'
      | 'session.tool.failed';
  }
>;

export const reduceMessages = (event: TMessagesEvent): TEventUpdate | null => {
  switch (event.type) {
    /* --- mensajes --- */
    case 'session.step.started':
      return [
        set(queryKeys.sessions.messages(event.data.sessionID), (prev) =>
          upsertAssistantShell(prev, event),
        ),
      ];

    case 'session.step.ended':
      return [
        set(queryKeys.sessions.messages(event.data.sessionID), (prev) =>
          patchAssistantInfo(prev, event.data.assistantMessageID, {
            time: { created: event.created, completed: event.created },
            finish: event.data.finish,
            cost: event.data.cost,
            tokens: event.data.tokens,
          }),
        ),
      ];

    case 'session.step.failed':
      return [
        set(queryKeys.sessions.messages(event.data.sessionID), (prev) =>
          patchAssistantInfo(prev, event.data.assistantMessageID, {
            error: event.data.error,
          }),
        ),
      ];

    /* --- contenido consolidado (sin deltas, FR-005/FR-006) --- */
    case 'session.text.ended':
      return [
        set(queryKeys.sessions.messages(event.data.sessionID), (prev) =>
          upsertContentPart(
            prev,
            event.data.assistantMessageID,
            event.data.ordinal,
            textPart(event.data.text),
          ),
        ),
      ];

    case 'session.reasoning.ended':
      return [
        set(queryKeys.sessions.messages(event.data.sessionID), (prev) =>
          upsertContentPart(
            prev,
            event.data.assistantMessageID,
            event.data.ordinal,
            reasoningPart(event.data.text),
          ),
        ),
      ];

    case 'session.message.content.updated':
      return [
        set(queryKeys.sessions.messages(event.data.sessionID), (prev) =>
          replaceContent(prev, event.data.messageID, event.data.content),
        ),
      ];

    /* --- tools --- */
    case 'session.tool.input.started':
    case 'session.tool.called':
    case 'session.tool.success':
    case 'session.tool.failed':
      return [
        set(queryKeys.sessions.messages(event.data.sessionID), (prev) =>
          upsertToolPart(
            prev,
            event.data.assistantMessageID,
            event,
            event.created,
          ),
        ),
      ];

    default:
      return null;
  }
};
