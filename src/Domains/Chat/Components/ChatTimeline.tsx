import { memo, type ReactNode } from 'react';
import { Container } from '@app/Application/Components';
import type { TChatTimelineEntry } from '../Chat.entity';
import { ChatMessageRow } from './ChatMessageRow';

/** Anuncio accesible de inicio de turno (FR-021). */
export const TURN_IN_PROGRESS_ANNOUNCEMENT = 'Turno en curso';
/** Anuncio accesible de fin de turno (FR-021). */
export const TURN_FINISHED_ANNOUNCEMENT = 'Turno finalizado';

/** Atributo estable con el `id` de la entrada; ancla para el salto (U4). */
export const CHAT_ENTRY_ANCHOR_ATTR = 'data-chat-entry-id';

/** `id` del envoltorio de una fila, estable por entrada (U4). */
export const chatEntryAnchorId = (entryId: string): string =>
  `chat-entry-${entryId}`;

/**
 * Resaltado temporal neutro (U4): fondo tenue + contorno con tokens
 * (`muted`/`ring`), sin depender solo del color (también se expone
 * `data-highlighted`). El `outline` no afecta al layout.
 */
export const CHAT_ENTRY_HIGHLIGHT_CLASS =
  'rounded-flat bg-muted/50 outline outline-2 outline-offset-2 outline-ring/60 transition-colors duration-300';

/**
 * Desplaza el contenedor scrolleable del timeline hasta la fila `target` (U4).
 *
 * Usa el **contenedor** (nunca `window`): calcula el destino a partir de los
 * rectángulos para no depender del `offsetParent`. Reutiliza el contenedor que
 * aporta `useChatAutoScroll`; aquí solo se añade el salto puntual.
 */
export const scrollEntryIntoView = (
  container: HTMLElement,
  target: HTMLElement,
  behavior: ScrollBehavior = 'smooth',
): void => {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const top = container.scrollTop + (targetRect.top - containerRect.top);

  if (typeof container.scrollTo === 'function') {
    container.scrollTo({ top, behavior });
  } else {
    // Fallback para entornos sin `scrollTo` (p. ej. `jsdom`).
    container.scrollTop = top;
  }
};

interface ChatTimelineProps {
  /** Timeline proyectado por `buildChatTimeline` (consolidado + provisional). */
  entries: TChatTimelineEntry[];
  /** Visibilidad del razonamiento (FR-002); la posee el llamador. */
  showReasoning?: boolean;
  /**
   * `false` oculta las entradas de tipo herramienta (U3). Por defecto se ven. El
   * filtro no toca el dedupe (ya resuelto en la proyección) ni el anuncio del
   * turno (`role="status"`), que se calcula sobre el timeline completo.
   */
  showTools?: boolean;
  /** Sesión dueña; se reenvía a `ChatMessageRow` para el contexto de compactación. */
  sessionId?: string | null;
  /** Render inyectado del contexto de compactación (FR-035). */
  renderCompactionContext?: (sessionId: string) => ReactNode;
  /** Entrada resaltada temporalmente por el salto (U4); `null` = ninguna. */
  highlightedEntryId?: string | null;
}

/**
 * Timeline del chat (FR-002/FR-003, SC-004).
 *
 * Renderiza la proyección pura de `buildChatTimeline` delegando cada entrada en
 * `ChatMessageRow` (envoltorio neutro + alineación + cuerpo compartido). El
 * dedupe (FR-003) ya lo resolvió la proyección, por lo que la consolidada
 * reemplaza a la provisional sin duplicar. El anuncio accesible (`role="status"`)
 * solo refleja el inicio/fin del turno —nunca el texto del delta—, de modo que
 * no se repite en cada delta (FR-021).
 *
 * Cada fila va envuelta en un ancla estable (`id`/`data-chat-entry-id`) que
 * permite el salto desde la barra superior (U4); el resaltado temporal se aplica
 * sobre ese envoltorio. `memo` evita re-renderizar el timeline por cambios ajenos
 * a sus entradas.
 */
export const ChatTimeline = memo(function ChatTimeline({
  entries,
  showReasoning = true,
  showTools = true,
  sessionId = null,
  renderCompactionContext,
  highlightedEntryId = null,
}: ChatTimelineProps) {
  // Un turno está en curso mientras exista una parte provisional (buffer sin
  // consolidar): las consolidadas exponen su `history`, las provisionales no
  // (`buildChatTimeline` las marca con `history: null`). Se calcula sobre el
  // timeline **completo** para que el filtro de herramientas no lo altere (U3).
  const hasProvisional = entries.some((entry) => entry.history == null);
  const announcement =
    entries.length === 0
      ? ''
      : hasProvisional
        ? TURN_IN_PROGRESS_ANNOUNCEMENT
        : TURN_FINISHED_ANNOUNCEMENT;

  // El filtro solo decide qué filas se pintan; no reordena ni deduplica.
  const visibleEntries = showTools
    ? entries
    : entries.filter((entry) => entry.kind !== 'tool');

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
      {visibleEntries.map((entry) => {
        const isHighlighted = entry.id === highlightedEntryId;
        // El razonamiento oculto (FR-002) no se pinta: se omite también su
        // envoltorio-ancla para no dejar filas vacías en el timeline.
        if (entry.kind === 'reasoning' && !showReasoning) return null;
        return (
          <Container
            key={entry.id}
            space="none"
            id={chatEntryAnchorId(entry.id)}
            // Ancla estable por fila (U4): la clave del atributo vive en la
            // constante compartida para no repetir el string.
            {...{ [CHAT_ENTRY_ANCHOR_ATTR]: entry.id }}
            data-highlighted={isHighlighted ? 'true' : undefined}
            className={[
              entry.role === 'user' ? 'self-end' : 'self-start',
              isHighlighted ? CHAT_ENTRY_HIGHLIGHT_CLASS : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <ChatMessageRow
              entry={entry}
              showReasoning={showReasoning}
              sessionId={sessionId}
              renderCompactionContext={renderCompactionContext}
            />
          </Container>
        );
      })}
    </Container>
  );
});
