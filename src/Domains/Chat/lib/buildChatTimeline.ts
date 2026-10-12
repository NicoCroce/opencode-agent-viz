import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { THistoryEntry, THistoryQuestion } from '@app/Domains/History';
import { buildHistory } from '@app/Domains/History/lib/buildHistory';
import type {
  TChatStreamBuffer,
  TChatStreamPart,
  TChatTimelineEntry,
  TChatTimelineKind,
} from '../Chat.entity';

/**
 * Proyección del timeline del chat (data-model §2.2,
 * `contracts/chat-stream-contract.md` §3). Función **pura**: combina el histórico
 * consolidado (`buildHistory`, reusado de `Domains/History/lib`), el buffer
 * provisional del mensaje en curso y las preguntas.
 *
 * **Dedupe (FR-003)**: toda parte del buffer cuya clave `assistantMessageID:ordinal`
 * ya exista en el histórico se descarta; al llegar `*.ended` la parte consolidada
 * entra por el histórico y el `ordinal` deja de mostrarse como provisional, sin
 * duplicar. Las partes restantes se agregan como provisionales (`isComplete:
 * false`, "En curso") y el conjunto se ordena por `at` ascendente.
 */
const kindOf = (entry: THistoryEntry): TChatTimelineKind => {
  switch (entry.kind) {
    case 'user':
    case 'answer':
      return 'text';
    case 'reasoning':
      return 'reasoning';
    case 'tool':
      return 'tool';
    case 'question':
      return 'question';
    default:
      return 'system';
  }
};

const textOf = (entry: THistoryEntry): string => {
  switch (entry.kind) {
    case 'user':
    case 'answer':
    case 'reasoning':
      return entry.text;
    case 'question':
      return entry.title;
    default:
      return '';
  }
};

const isCompleteOf = (entry: THistoryEntry): boolean => {
  switch (entry.kind) {
    case 'answer':
    case 'reasoning':
      return entry.isComplete;
    default:
      return true;
  }
};

const toTimelineEntry = (entry: THistoryEntry): TChatTimelineEntry => ({
  id: entry.id,
  role: entry.kind === 'user' ? 'user' : 'agent',
  kind: kindOf(entry),
  text: textOf(entry),
  isComplete: isCompleteOf(entry),
  at: entry.at,
  history: entry,
});

const toProvisionalEntry = (
  assistantMessageID: string,
  ordinal: number,
  part: TChatStreamPart,
): TChatTimelineEntry => ({
  id: `stream:${assistantMessageID}:${ordinal}`,
  role: 'agent',
  kind: part.kind,
  text: part.text,
  isComplete: false,
  at: part.at,
  history: null,
});

export function buildChatTimeline(
  messages: TSessionMessage[],
  buffer: TChatStreamBuffer | null | undefined,
  questions: THistoryQuestion[] = [],
): TChatTimelineEntry[] {
  const consolidated = buildHistory(messages, { questions }).map(
    toTimelineEntry,
  );
  const consolidatedIds = new Set(consolidated.map((entry) => entry.id));

  const provisional: TChatTimelineEntry[] = [];
  if (buffer) {
    for (const [key, part] of Object.entries(buffer.parts)) {
      const ordinal = Number(key);
      // Dedupe (FR-003): el histórico ya consolidó esta parte.
      if (consolidatedIds.has(`${buffer.assistantMessageID}:${ordinal}`)) {
        continue;
      }
      provisional.push(
        toProvisionalEntry(buffer.assistantMessageID, ordinal, part),
      );
    }
  }

  // `Array.prototype.sort` es estable: con `at` iguales, lo consolidado (que va
  // antes en el array) conserva su posición y el provisional queda después.
  return [...consolidated, ...provisional].sort((a, b) => a.at - b.at);
}
