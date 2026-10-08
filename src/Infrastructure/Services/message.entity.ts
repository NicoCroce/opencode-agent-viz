import type { SessionMessageInfo } from '@opencode/client';

/**
 * Contenido de un mensaje assistant en V2. Antes era `Part[]` con un tipo por
 * parte; V2 lo aplana en `content` con tres variantes (text | reasoning | tool).
 */
export type TContentPart = Extract<
  SessionMessageInfo,
  { type: 'assistant' }
>['content'][number];

/**
 * Forma normalizada que consume el resto de la app. V2 devuelve los mensajes
 * planos (`SessionMessageInfo[]`) sin separar info y partes; envolvemos cada
 * mensaje para no obligar a cada consumidor a discriminar por `type`.
 */
export interface TSessionMessage {
  info: SessionMessageInfo;
  parts: TContentPart[];
}

/** `SessionMessageInfo` -> `{ info, parts }` con `content` en `parts`. */
export const normalizeMessages = (
  messages: SessionMessageInfo[],
): TSessionMessage[] =>
  messages.map((info) => ({
    info,
    parts: info.type === 'assistant' ? info.content : [],
  }));
