import { memo, type ReactNode } from 'react';
import { Container } from '@app/Application/Components';
import { InProgressText } from '@app/Application/Components/Molecules';
import { HistoryEntryBody } from '@app/Application/Components/Organisms/HistoryEntry/HistoryEntryBody';
import type { TChatTimelineEntry } from '../Chat.entity';

/**
 * Etiqueta de la parte provisional del buffer. Solo `text`/`reasoning` llegan
 * como provisionales (el buffer solo acumula esos dos deltas, data-model §2.1).
 */
const provisionalLabel = (kind: TChatTimelineEntry['kind']): string =>
  kind === 'reasoning' ? 'Razonamiento' : 'Respuesta';

interface ChatMessageRowProps {
  /** Entrada del timeline proyectada por `buildChatTimeline`. */
  entry: TChatTimelineEntry;
  /**
   * Cuando es `false`, las entradas de razonamiento no se renderizan (FR-002).
   * La visibilidad la posee el llamador (`useReasoningVisibility`).
   */
  showReasoning?: boolean;
  /** Sesión dueña; la reenvía a `HistoryEntryBody` para el contexto de compactación. */
  sessionId?: string | null;
  /** Render inyectado del contexto de compactación (FR-035). */
  renderCompactionContext?: (sessionId: string) => ReactNode;
}

/**
 * Fila del timeline del chat (FR-002/FR-003, SC-004).
 *
 * Render **neutro**: sin franjas de color (`border-accent`/`border-status-*`) ni
 * etiquetas mayúsculas de tipo —la jerarquía la dan el espaciado y la
 * tipografía—. El cuerpo de las entradas consolidadas lo resuelve
 * `HistoryEntryBody`, la misma presentación compartida que el Historial, para no
 * duplicar markdown/tool/question; este componente solo aporta el envoltorio y la
 * alineación.
 *
 * Los mensajes propios (`entry.role === 'user'`) se alinean a la derecha; el
 * resto a la izquierda. Las partes provisionales del buffer se muestran como
 * **texto plano** con su etiqueta "En curso" (FR-002, SC-004): el re-parseo de
 * markdown en cada delta es el hot spot que la feature evita.
 */
export const ChatMessageRow = memo(function ChatMessageRow({
  entry,
  showReasoning = true,
  sessionId = null,
  renderCompactionContext,
}: ChatMessageRowProps) {
  if (entry.kind === 'reasoning' && !showReasoning) {
    return null;
  }

  // `role` es la proyección de `THistoryEntry.kind === 'user'` (buildChatTimeline).
  const isUser = entry.role === 'user';

  return (
    <article
      data-testid="chat-message-row"
      data-role={entry.role}
      className={`flex max-w-[85%] flex-col gap-1 ${
        isUser ? 'self-end items-end' : 'self-start items-start'
      }`}
    >
      {entry.history ? (
        <HistoryEntryBody
          entry={entry.history}
          sessionId={sessionId}
          renderCompactionContext={renderCompactionContext}
        />
      ) : (
        <>
          <Container row align="center" space="small">
            <span className="text-[11px] font-medium text-muted-foreground">
              {provisionalLabel(entry.kind)}
            </span>
            <InProgressText />
          </Container>
          <p className="whitespace-pre-wrap font-sans text-sm leading-6 text-foreground">
            {entry.text}
          </p>
        </>
      )}
    </article>
  );
});
