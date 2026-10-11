import { useId, useState, type RefObject } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMagnifyingGlass,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { Container, EmptyState, Label, Toggle } from '@app/Application/Components';
import { Button } from '@app/Application/Components/ui/button';
import { Input } from '@app/Application/Components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@app/Application/Components/ui/dialog';
import type { TChatTimelineEntry } from '../Chat.entity';

/**
 * Acceso rápido al historial (iteración UX U3): modal ancho con **todos** los
 * mensajes del timeline —míos y respuestas— etiquetados por autor y dos filtros
 * combinables (autor AND texto). Al elegir uno, el modal se cierra, el hilo salta
 * a esa fila y la resalta un instante.
 *
 * Componente **controlado** (`open`/`onOpenChange`): el estado de apertura y el
 * timeline los posee el llamador (`ChatPanel`), que también aporta el salto
 * reutilizando su `handleSelectPrompt`; aquí no se duplica esa lógica. Radix
 * `Dialog` aporta el foco inicial, la trampa de foco y `Escape`.
 *
 * **Filtros (U3):** chips de autor excluyentes (`Todos` por defecto) que muestran
 * el recuento por opción, e input de texto que busca en el cuerpo del mensaje
 * (case-insensitive). Ambos se combinan. El estado es local y se limpia al
 * cerrar, para que cada apertura arranque sin filtrar.
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

/** Filtro de autor del historial; `all` = sin filtro (por defecto). */
export type TChatHistoryAuthorFilter = 'all' | 'user' | 'agent';

/** Opción de chip de autor: valor del filtro + etiqueta visible. */
export interface TChatHistoryAuthorOption {
  value: TChatHistoryAuthorFilter;
  label: string;
}

/**
 * Opciones de chip de autor, en orden. La opción del agente usa el
 * `agentLabel` recibido para nombrarlo igual que las filas.
 */
export const chatHistoryAuthorOptions = (
  agentLabel = 'Agente',
): TChatHistoryAuthorOption[] => [
  { value: 'all', label: 'Todos' },
  { value: 'user', label: 'Mis mensajes' },
  { value: 'agent', label: agentLabel },
];

/** Recuento de entradas por opción de autor (sobre el total, sin filtro de texto). */
export type TChatHistoryAuthorCounts = Record<TChatHistoryAuthorFilter, number>;

export const historyAuthorCounts = (
  entries: TChatTimelineEntry[],
): TChatHistoryAuthorCounts => ({
  all: entries.length,
  user: entries.filter((entry) => entry.role === 'user').length,
  agent: entries.filter((entry) => entry.role === 'agent').length,
});

/** Filtro combinado del historial: autor (exclusivo) + texto (subcadena). */
export interface TChatHistoryFilter {
  author: TChatHistoryAuthorFilter;
  query: string;
}

/**
 * Aplica el filtro combinado: autor AND texto. El texto busca en el cuerpo del
 * mensaje de forma case-insensitive; vacío o solo espacios no filtra. Una
 * entrada sin texto (herramienta, sistema…) nunca coincide con una búsqueda.
 */
export const filterHistoryEntries = (
  entries: TChatTimelineEntry[],
  { author, query }: TChatHistoryFilter,
): TChatTimelineEntry[] => {
  const needle = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (author !== 'all' && entry.role !== author) return false;
    if (needle.length === 0) return true;
    return entry.text.toLowerCase().includes(needle);
  });
};

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
  const searchId = useId();
  const [author, setAuthor] = useState<TChatHistoryAuthorFilter>('all');
  const [query, setQuery] = useState('');

  const counts = historyAuthorCounts(entries);
  const options = chatHistoryAuthorOptions(agentLabel);
  const filtered = filterHistoryEntries(entries, { author, query });
  const hasEntries = entries.length > 0;

  const clearFilters = () => {
    setAuthor('all');
    setQuery('');
  };

  // Al cerrar se limpian los filtros (el contenido se desmonta), de modo que cada
  // apertura arranca sin filtrar. Se envuelve el `onOpenChange` de Radix para no
  // resetear el estado desde un efecto.
  const handleOpenChange = (next: boolean) => {
    if (!next) clearFilters();
    onOpenChange(next);
  };

  // Cerrar antes de saltar: el resaltado temporal del hilo se aprecia mejor sin
  // el overlay del modal por encima.
  const handleSelect = (entryId: string) => {
    handleOpenChange(false);
    onSelectEntry(entryId);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="chat-history-dialog"
        // Ancho fluido: `min(90vw, 60rem)` no desborda en pantallas chicas y
        // aprovecha el espacio en las grandes. `max-w-none` vence el `max-w-lg`
        // base de `ui/dialog.tsx` (ambos se fusionan con `twMerge`, gana el
        // último).
        className={`w-[min(90vw,60rem)] max-w-none gap-5 ${className ?? ''}`}
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
            Filtra por autor o texto y selecciona un mensaje para saltar a él en
            el hilo.
          </DialogDescription>
        </DialogHeader>

        {hasEntries && (
          <Container space="small">
            <Container
              row
              align="center"
              space="small"
              role="group"
              aria-label="Filtrar por autor"
              data-testid="chat-history-author-filter"
              className="flex-wrap"
            >
              {options.map((option) => (
                <Toggle
                  key={option.value}
                  pressed={author === option.value}
                  // Exclusivo: pulsar el chip activo no lo deselecciona.
                  onPressedChange={(pressed) => {
                    if (pressed) setAuthor(option.value);
                  }}
                  variant="outline"
                  size="sm"
                  data-testid={`chat-history-author-${option.value}`}
                  className="gap-1.5 rounded-full text-[11px]"
                >
                  {option.label}
                  <span className="tabular-nums text-muted-foreground">
                    {counts[option.value]}
                  </span>
                </Toggle>
              ))}
            </Container>

            <Container block className="relative">
              <Label htmlFor={searchId} className="sr-only">
                Buscar en los mensajes
              </Label>
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar en los mensajes…"
                data-testid="chat-history-search"
                className="pl-9 pr-9"
              />
              {query.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuery('')}
                  aria-label="Limpiar búsqueda"
                  data-testid="chat-history-search-clear"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                >
                  <FontAwesomeIcon
                    icon={faXmark}
                    aria-hidden
                    className="size-3.5"
                  />
                </Button>
              )}
            </Container>
          </Container>
        )}

        {!hasEntries ? (
          <EmptyState
            title="Sin mensajes en el historial"
            description="Aún no hay mensajes en esta conversación."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Ningún mensaje coincide"
            description="Prueba con otro autor o cambia el texto de búsqueda."
            action={{
              label: 'Limpiar filtros',
              onClick: clearFilters,
              variant: 'link',
            }}
          />
        ) : (
          <Container block className="min-h-0">
            <ul
              aria-label="Mensajes de la conversación"
              data-testid="chat-history-list"
              className="flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto pr-1"
            >
              {filtered.map((entry) => {
                const authorLabel = historyAuthorLabel(entry.role, agentLabel);
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      data-testid="chat-history-item"
                      data-entry-id={entry.id}
                      onClick={() => handleSelect(entry.id)}
                      className="flex w-full flex-col items-start gap-0.5 rounded-flat px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {authorLabel}
                      </span>
                      <span className="w-full line-clamp-2 text-sm text-foreground">
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
