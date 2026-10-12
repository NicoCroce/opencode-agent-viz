import { memo, type ReactNode } from 'react';
import { Container } from '@app/Application/Components';
import { RichText } from '@app/Application/Components/Molecules';
import { HistoryEntryBody } from '@app/Application/Components/Organisms/HistoryEntry/HistoryEntryBody';
import type { TChatTimelineEntry } from '../Chat.entity';
import { ChatTypingIndicator } from './ChatTypingIndicator';

/**
 * Etiqueta de la parte provisional del buffer. Solo `text`/`reasoning` llegan
 * como provisionales (el buffer solo acumula esos dos deltas, data-model §2.1).
 */
const provisionalLabel = (kind: TChatTimelineEntry['kind']): string =>
  kind === 'reasoning' ? 'Razonamiento' : 'Respuesta';

/** Variante de `RichText` de la parte provisional (color por tipo de delta). */
const provisionalVariant = (
  kind: TChatTimelineEntry['kind'],
): 'answer' | 'reasoning' => (kind === 'reasoning' ? 'reasoning' : 'answer');

/**
 * Cuerpo markdown de la parte provisional, memoizado por `text` (string).
 *
 * `ChatMessageRow` ya es `memo`, pero su `entry` cambia de identidad en cada
 * delta/proyección; este `memo` corta el re-parseo de markdown cuando la fila se
 * re-renderiza por un motivo ajeno con el mismo texto (el padre re-renderiza ~10
 * veces/s durante el streaming). Tradeoff: un `memo` extra por fila a cambio de
 * no re-parsear markdown en renders que no cambian el texto.
 */
const ProvisionalText = memo(function ProvisionalText({
  text,
  variant,
}: {
  text: string;
  variant: 'answer' | 'reasoning';
}) {
  return <RichText text={text} variant={variant} />;
});

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
 * resto a la izquierda. Las partes provisionales del buffer se anuncian con el
 * indicador animado `ChatTypingIndicator` (FR-004) y su cuerpo se renderiza
 * **siempre en markdown** con `RichText` (memoizado por texto), para que el
 * streaming se vea con el mismo formato que el contenido consolidado.
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
      className={`flex min-w-0 max-w-[85%] flex-col gap-1 break-words ${
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
            <ChatTypingIndicator />
          </Container>
          <ProvisionalText
            text={entry.text}
            variant={provisionalVariant(entry.kind)}
          />
        </>
      )}
    </article>
  );
});
