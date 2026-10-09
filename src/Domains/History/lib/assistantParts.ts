import type {
  TContentPart,
  TSessionMessage,
} from '@app/Infrastructure/Services/opencodeClient';
import type { THistoryEntry } from '../History.entity';
import { toToolEntry } from './toolEntry';

/**
 * Intercala las partes del assistant en su orden de producción (FR-003). Un
 * assistant sin `time.completed` marca sus respuestas/razonamiento como "en
 * curso" y nunca se presenta texto parcial como completo (FR-005/006).
 */
export function toAssistantEntries(
  info: Extract<TSessionMessage['info'], { type: 'assistant' }>,
  parts: TContentPart[],
  at: number,
): THistoryEntry[] {
  const isComplete = info.time.completed != null;
  return parts.map((part, index) => {
    const id = `${info.id}:${index}`;
    switch (part.type) {
      case 'text':
        return {
          id,
          at,
          kind: 'answer' as const,
          text: part.text,
          isComplete,
        };
      case 'reasoning':
        return {
          id,
          at,
          kind: 'reasoning' as const,
          text: part.text,
          isComplete,
        };
      case 'tool':
        return {
          id,
          at,
          kind: 'tool' as const,
          entry: toToolEntry(part),
        };
    }
  });
}
