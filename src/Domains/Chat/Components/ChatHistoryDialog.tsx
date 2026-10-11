import type { RefObject } from 'react';
import { Container, EmptyState } from '@app/Application/Components';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@app/Application/Components/ui/dialog';
import type { TChatTimelineEntry } from '../Chat.entity';

/**
 * Acceso rápido al historial (iteración UX U2): modal con **todos** los mensajes
 * del timeline —míos y respuestas— etiquetados por autor. Al elegir uno, el
 * modal se cierra, el hilo salta a esa fila y la resalta un instante.
 *
 * Componente **controlado** (`open`/`onOpenChange`): el estado de apertura y el
 * timeline los posee el llamador (`ChatPanel`), que también aporta el salto
 * reutilizando su `handleSelectPrompt`; aquí no se duplica esa lógica. Radix
 * `Dialog` aporta el foco inicial, la trampa de foco y `Escape`.
 *
 * **Restauración de foco (WCAG 2.2 AA):** el modal se abre desde un botón externo
 * (la barra `ChatToolbar`), no desde un `DialogTrigger`, así que Radix no sabe a
 * quién devolver el foco y al cerrar cae en `<body>`. Con la `triggerRef` que
 * aporta el llamador se restaura al disparador al cerrar —por `Escape`, overlay,
 * botón de cierre o selección— vía `onCloseAutoFocus`, el punto canónico de
 * Radix para este propósito (no duplica el estado de apertura).
 */

/** Longitud máxima (caracteres) de la etiqueta de un mensaje en el historial. */
export const CHAT_HISTORY_LABEL_MAX = 80;

/** Etiqueta del autor: los mensajes propios son "Tú"; el resto, el agente. */
export const historyAuthorLabel = (
  role: TChatTimelineEntry['role'],
  agentLabel = 'Agente',
): string => (role === 'user' ? 'Tú' : agentLabel);

/** Texto de reserva de las entradas sin cuerpo textual (herramienta, sistema…). */
const kindFallback = (kind: TChatTimelineEntry['kind']): string => {
  switch (kind) {
    case 'tool':
      return 'Llamada a herramienta';
    case 'system':
      return 'Evento del sistema';
    case 'question':
      return 'Pregunta';
    case 'reasoning':
      return 'Razonamiento';
    default:
      return 'Mensaje';
  }
};

/**
 * Texto de una entrada del historial: colapsa los saltos de línea y espacios
 * sobrantes a una sola línea y trunca a ~`CHAT_HISTORY_LABEL_MAX` caracteres.
 * Las entradas sin texto (herramientas, sistema) muestran una etiqueta de su
 * tipo para no quedar en blanco.
 */
export const historyItemLabel = (entry: TChatTimelineEntry): string => {
  const raw =
    entry.text.trim().length > 0 ? entry.text : kindFallback(entry.kind);
  const singleLine = raw.replace(/\s+/g, ' ').trim();
  return singleLine.length > CHAT_HISTORY_LABEL_MAX
    ? `${singleLine.slice(0, CHAT_HISTORY_LABEL_MAX)}…`
    : singleLine;
};

export interface ChatHistoryDialogProps {
  /** Estado de apertura controlado por el llamador. */
  open: boolean;
  /** Notifica el cambio de apertura (cierre por `Escape`, overlay o selección). */
  onOpenChange: (open: boolean) => void;
  /** Timeline completo (míos y respuestas) en orden cronológico. */
  entries: TChatTimelineEntry[];
  /** Salta a la entrada elegida; el modal se cierra antes de invocarlo. */
  onSelectEntry: (entryId: string) => void;
  /** Nombre del agente para etiquetar sus respuestas; por defecto "Agente". */
  agentLabel?: string;
  /**
   * Ref al control que abrió el modal (el botón de historial de la barra). Radix
   * `Dialog` sin `DialogTrigger` no tiene a quién devolver el foco; con esta ref
   * el foco vuelve al disparador al cerrar. Sin ella, el foco cae en `<body>`.
   */
  triggerRef?: RefObject<HTMLElement | null>;
  className?: string;
}

export const ChatHistoryDialog = ({
  open,
  onOpenChange,
  entries,
  onSelectEntry,
  agentLabel = 'Agente',
  triggerRef,
  className,
}: ChatHistoryDialogProps) => {
  // Cerrar antes de saltar: el resaltado temporal del hilo se aprecia mejor sin
  // el overlay del modal por encima.
  const handleSelect = (entryId: string) => {
    onOpenChange(false);
    onSelectEntry(entryId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="chat-history-dialog"
        className={`max-w-md ${className ?? ''}`}
        // El foco vuelve al disparador al cerrar (Escape, overlay, cierre o
        // selección). Se cancela el foco por defecto de Radix (que apunta a un
        // `DialogTrigger` inexistente) para fijarlo en el botón de la barra.
        onCloseAutoFocus={(event) => {
          const trigger = triggerRef?.current;
          if (!trigger) return;
          event.preventDefault();
          trigger.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Historial de mensajes</DialogTitle>
          <DialogDescription>
            Selecciona un mensaje para saltar a él en el hilo.
          </DialogDescription>
        </DialogHeader>

        {entries.length === 0 ? (
          <EmptyState
            title="Sin mensajes en el historial"
            description="Aún no hay mensajes en esta conversación."
          />
        ) : (
          <Container block className="min-h-0">
            <ul
              aria-label="Mensajes de la conversación"
              data-testid="chat-history-list"
              className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto"
            >
              {entries.map((entry) => {
                const author = historyAuthorLabel(entry.role, agentLabel);
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      data-testid="chat-history-item"
                      data-entry-id={entry.id}
                      onClick={() => handleSelect(entry.id)}
                      className="flex w-full flex-col items-start gap-0.5 rounded-flat px-2 py-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {author}
                      </span>
                      <span className="w-full truncate text-sm text-foreground">
                        {historyItemLabel(entry)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Container>
        )}
      </DialogContent>
    </Dialog>
  );
};
