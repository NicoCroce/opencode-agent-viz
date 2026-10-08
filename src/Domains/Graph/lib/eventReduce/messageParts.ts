import type { V2Event } from '@opencode/client';
import type {
  TContentPart,
  TSessionMessage,
} from '@app/Infrastructure/Services/opencodeClient';
import type { TSessionMessageCache } from './cache';
import { messagesOf } from './cache';

type TAssistantInfo = Extract<TSessionMessage['info'], { type: 'assistant' }>;

/**
 * `parts` es una vista de `info.content`: los dos se mantienen en sync para
 * que los consumidores (grafo, Inspector) puedan seguir iterando `parts`.
 */
export const withParts = (
  message: TSessionMessage,
  parts: TContentPart[],
): TSessionMessage => ({
  ...message,
  parts,
  info:
    message.info.type === 'assistant'
      ? { ...message.info, content: parts }
      : message.info,
});

export const patchMessage = (
  prev: unknown,
  messageID: string,
  patch: (message: TSessionMessage) => TSessionMessage,
): TSessionMessageCache =>
  messagesOf(prev).map((message) =>
    message.info.id === messageID ? patch(message) : message,
  );

export const patchAssistantInfo = (
  prev: unknown,
  messageID: string,
  patch: Partial<TAssistantInfo>,
): TSessionMessageCache =>
  patchMessage(prev, messageID, (message) =>
    message.info.type === 'assistant'
      ? { ...message, info: { ...message.info, ...patch } }
      : message,
  );

/**
 * `session.step.started` abre un mensaje assistant que aun no tiene contenido.
 * V2 no emite un "message created": lo reconstruimos con lo que el evento trae.
 */
export const upsertAssistantShell = (
  prev: unknown,
  event: Extract<V2Event, { type: 'session.step.started' }>,
): TSessionMessageCache => {
  const { assistantMessageID, agent, model, started } = event.data;
  const messages = messagesOf(prev);
  const existing = messages.find((m) => m.info.id === assistantMessageID);
  const info: TAssistantInfo = {
    id: assistantMessageID,
    type: 'assistant',
    time:
      existing?.info.type === 'assistant'
        ? existing.info.time
        : { created: started },
    agent,
    model,
    content: [],
  };
  if (existing) {
    return patchMessage(prev, assistantMessageID, () => ({ info, parts: [] }));
  }
  return [...messages, { info, parts: [] }];
};

export const textPart = (text: string): TContentPart => ({ type: 'text', text });

export const reasoningPart = (text: string): TContentPart => ({
  type: 'reasoning',
  text,
});

/**
 * Inserta/reemplaza una parte consolidada en la posicion `ordinal` del
 * contenido del assistant (R6): los eventos `*.ended` traen el texto completo
 * y su ordinal, y `content` se mantiene ordenado por el. Nunca se acumulan
 * deltas (FR-005, Principio VII).
 */
export const upsertContentPart = (
  prev: unknown,
  messageID: string,
  ordinal: number,
  part: TContentPart,
): TSessionMessageCache =>
  patchMessage(prev, messageID, (message) => {
    const parts = [...message.parts];
    if (ordinal < parts.length) {
      parts[ordinal] = part;
    } else {
      parts.push(part);
    }
    return withParts(message, parts);
  });

/**
 * `session.message.content.updated` trae la instantanea durable completa del
 * contenido: es un reemplazo consolidado, no incremental (R6), asi que no
 * viola FR-005.
 */
export const replaceContent = (
  prev: unknown,
  messageID: string,
  content: TContentPart[],
): TSessionMessageCache =>
  patchMessage(prev, messageID, (message) => withParts(message, content));
