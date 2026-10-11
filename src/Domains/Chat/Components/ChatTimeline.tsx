import { memo, type ReactNode } from 'react';
import { Container, HistoryEntry } from '@app/Application/Components';
import { InProgressText } from '@app/Application/Components/Molecules';
import type { TChatTimelineEntry } from '../Chat.entity';

/**
 * Etiqueta del tipo de parte provisional. Solo `text`/`reasoning` llegan como
 * provisionales (el buffer solo acumula esos dos deltas, data-model §2.1).
 */
const provisionalLabel = (kind: TChatTimelineEntry['kind']): string =>
  kind === 'reasoning' ? 'Razonamiento' : 'Respuesta';

/** Anuncio accesible de inicio de turno (FR-021). */
export const TURN_IN_PROGRESS_ANNOUNCEMENT = 'Turno en curso';
/** Anuncio accesible de fin de turno (FR-021). */
export const TURN_FINISHED_ANNOUNCEMENT = 'Turno finalizado';

interface ChatTimelineProps {
  /** Timeline proyectado por `buildChatTimeline` (consolidado + provisional). */
  entries: TChatTimelineEntry[];
  /** Visibilidad del razonamiento (FR-002); la posee el llamador. */
  showReasoning?: boolean;
  /** Sesión dueña; se reenvía a `HistoryEntry` para el contexto de compactación. */
  sessionId?: string | null;
  /** Render inyectado del contexto de compactación (FR-035). */
  renderCompactionContext?: (sessionId: string) => ReactNode;
}

/**
 * Cuerpo de una parte provisional del buffer (FR-002, SC-004).
 *
 * Se renderiza como **texto plano** (nunca `RichText`/markdown) mientras el
 * texto crece ~10/s: el re-parseo de `react-markdown` en cada delta es el hot
 * spot que la feature evita. La etiqueta "En curso" distingue explícitamente la
 * parte no consolidada de una respuesta final.
 */
const ProvisionalEntry = memo(function ProvisionalEntry({
  entry,
}: {
  entry: TChatTimelineEntry;
}) {
  const isReasoning = entry.kind === 'reasoning';

  return (
    <article
      className={`flex flex-col gap-1 border-l-2 border-status-running pl-3 ${
        isReasoning ? 'text-muted-foreground' : 'text-foreground'
      }`}
    >
      <Container row align="center" space="small">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {provisionalLabel(entry.kind)}
        </span>
        <InProgressText />
      </Container>
      <p className="whitespace-pre-wrap font-sans text-sm leading-6">
        {entry.text}
      </p>
    </article>
  );
});

/**
 * Timeline del chat (FR-002/FR-003, SC-004).
 *
 * Renderiza la proyección pura de `buildChatTimeline`: las entradas
 * consolidadas (histórico) con `HistoryEntry`/`RichText` y las partes
 * provisionales del buffer en texto plano con etiqueta "En curso". El dedupe
 * (FR-003) ya lo resolvió la proyección, por lo que la consolidada reemplaza a
 * la provisional sin duplicar. El anuncio accesible (`role="status"`) solo
 * refleja el inicio/fin del turno —nunca el texto del delta—, de modo que no se
 * repite en cada delta (FR-021).
 *
 * `memo` evita re-renderizar el timeline por cambios ajenos a sus entradas.
 */
export const ChatTimeline = memo(function ChatTimeline({
  entries,
  showReasoning = true,
  sessionId = null,
  renderCompactionContext,
}: ChatTimelineProps) {
  // Un turno está en curso mientras exista una parte provisional (buffer sin
  // consolidar): las consolidadas exponen su `history`, las provisionales no
  // (`buildChatTimeline` las marca con `history: null`).
  const hasProvisional = entries.some((entry) => entry.history == null);
  const announcement =
    entries.length === 0
      ? ''
      : hasProvisional
        ? TURN_IN_PROGRESS_ANNOUNCEMENT
        : TURN_FINISHED_ANNOUNCEMENT;

  return (
    <Container space="small" className="min-h-0" data-testid="chat-timeline">
      <span
        role="status"
        aria-live="polite"
        className="sr-only"
        data-testid="chat-turn-status"
      >
        {announcement}
      </span>
      {entries.map((entry) => {
        if (entry.history) {
          return (
            <HistoryEntry
              key={entry.id}
              entry={entry.history}
              showReasoning={showReasoning}
              sessionId={sessionId}
              renderCompactionContext={renderCompactionContext}
            />
          );
        }
        if (entry.kind === 'reasoning' && !showReasoning) {
          return null;
        }
        return <ProvisionalEntry key={entry.id} entry={entry} />;
      })}
    </Container>
  );
});
