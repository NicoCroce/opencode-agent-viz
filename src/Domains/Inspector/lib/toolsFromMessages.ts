import type {
  TContentPart,
  TSessionMessage,
} from '@app/Infrastructure/Services/opencodeClient';
import type { TToolHistoryEntry } from '../Inspector.entity';

export type TToolPart = Extract<TContentPart, { type: 'tool' }>;

/** Discrimina las partes de tool del contenido de un mensaje assistant. */
export const isToolPart = (part: TContentPart): part is TToolPart =>
  part.type === 'tool';

/**
 * Deriva el histórico de ejecuciones de herramientas a partir de los mensajes
 * de la sesión, preservando el orden de aparición.
 */
export const toolsFromMessages = (
  messages: TSessionMessage[],
): TToolHistoryEntry[] =>
  messages.flatMap(({ parts }) =>
    parts.filter(isToolPart).map((part) => ({
      name: part.name,
      status: part.state.status,
      startedAt: part.time.created,
      endedAt: part.time.completed,
    })),
  );
