import { useId, type RefObject } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClockRotateLeft, faWrench } from '@fortawesome/free-solid-svg-icons';
import { Container, Label, Toggle } from '@app/Application/Components';
import { Button } from '@app/Application/Components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/Application/Components/ui/select';

/**
 * Controles del chat (iteración UX U1: footer estilo Copilot).
 *
 * Presentación pura con tres controles, estética neutra (sin colores de tipo,
 * coherente con U1). Se monta en la **fila inferior del compositor** (a la
 * izquierda, junto a los chips de agente/modelo/razonamiento) y ya no sobre el
 * hilo:
 *
 * 1. **Chip-toggle "Herramientas"** (U3): oculta/muestra las entradas de tipo
 *    herramienta. Por defecto las herramientas se ven (`pressed: true`); el
 *    estado se comunica con `aria-pressed` y una etiqueta textual, no solo por
 *    color. La visibilidad la posee el llamador (`ChatPanel`), que la reenvía al
 *    timeline.
 * 2. **Chip-select "Ir a mi mensaje"** (U4): lista los prompts propios (entradas
 *    del usuario) en orden; la etiqueta es la primera porción del texto en una
 *    sola línea. Al elegir uno, el llamador salta a esa fila y la resalta un
 *    instante. Sin prompts el control queda **deshabilitado**. Es más ancho que
 *    el resto de chips (`min-w-56`) para que el texto del mensaje se lea cómodo.
 * 3. **Botón-icono "Historial de mensajes"** (U2): abre el modal de historial
 *    completo. Solo emite la intención (`onOpenHistory`); el estado de apertura y
 *    el modal viven en el llamador (`ChatPanel`), que reutiliza su salto.
 *
 * El `Select` usa los primitivos Radix de `ui/select` (el wrapper `Select` no
 * expone `disabled`), como ya hace `ChatSelector`; el botón-icono usa `ui/button`
 * (el wrapper `Button` impone padding de botón con etiqueta).
 */

/** Longitud máxima (caracteres) de la etiqueta de un prompt en el selector. */
export const CHAT_PROMPT_LABEL_MAX = 40;

/** Prompt propio del timeline: id de la entrada (ancla) + texto crudo. */
export interface TChatPrompt {
  /** `TChatTimelineEntry.id` de la entrada del usuario (ancla del salto). */
  id: string;
  /** Texto del prompt tal cual (la barra lo colapsa y trunca para la etiqueta). */
  text: string;
}

/**
 * Etiqueta de una opción de "mis mensajes": colapsa a una sola línea y trunca a
 * ~`CHAT_PROMPT_LABEL_MAX` caracteres añadiendo una elipsis si excede.
 */
export const promptLabel = (text: string): string => {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  return singleLine.length > CHAT_PROMPT_LABEL_MAX
    ? `${singleLine.slice(0, CHAT_PROMPT_LABEL_MAX)}…`
    : singleLine;
};

export interface ChatToolbarProps {
  /** `true` = las entradas de herramienta se ven (por defecto). */
  showTools: boolean;
  /** Notifica el nuevo estado del toggle. */
  onToggleTools: (next: boolean) => void;
  /** Mis prompts de texto, en orden cronológico. */
  prompts: TChatPrompt[];
  /** Notifica el `id` de la entrada elegida para saltar a ella. */
  onSelectPrompt: (entryId: string) => void;
  /** Abre el modal de historial completo (U2); el modal lo posee el llamador. */
  onOpenHistory: () => void;
  /**
   * Ref al botón-icono de historial. El llamador (`ChatPanel`) la reenvía al
   * modal (`ChatHistoryDialog.triggerRef`) para devolver el foco a este botón al
   * cerrar (WCAG 2.2 AA): sin `DialogTrigger`, Radix no sabría a quién restaurar.
   */
  historyButtonRef?: RefObject<HTMLButtonElement | null>;
  className?: string;
}

export const ChatToolbar = ({
  showTools,
  onToggleTools,
  prompts,
  onSelectPrompt,
  onOpenHistory,
  historyButtonRef,
  className,
}: ChatToolbarProps) => {
  const selectId = useId();
  const hasPrompts = prompts.length > 0;

  return (
    <Container
      row
      align="center"
      space="small"
      role="toolbar"
      aria-label="Controles del chat"
      data-testid="chat-toolbar"
      className={`w-auto flex-wrap ${className ?? ''}`}
    >
      <Toggle
        pressed={showTools}
        onPressedChange={onToggleTools}
        variant="outline"
        size="sm"
        data-testid="chat-tools-toggle"
        className="gap-1.5 rounded-full text-[11px]"
      >
        <FontAwesomeIcon icon={faWrench} aria-hidden className="size-3" />
        Herramientas
      </Toggle>

      <Container row align="center" className="w-auto">
        <Label htmlFor={selectId} className="sr-only">
          Ir a mi mensaje
        </Label>
        <Select onValueChange={onSelectPrompt} disabled={!hasPrompts}>
          <SelectTrigger
            id={selectId}
            className="h-8 w-auto min-w-56 rounded-full text-xs"
          >
            <SelectValue
              placeholder={hasPrompts ? 'Mis mensajes' : 'Sin mensajes'}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {prompts.map((prompt) => (
                <SelectItem key={prompt.id} value={prompt.id}>
                  {promptLabel(prompt.text)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Container>

      <Button
        ref={historyButtonRef}
        type="button"
        variant="outline"
        size="sm"
        onClick={onOpenHistory}
        aria-label="Historial de mensajes"
        title="Historial de mensajes"
        data-testid="chat-history-open"
        className="h-8 w-8 rounded-full p-0"
      >
        <FontAwesomeIcon
          icon={faClockRotateLeft}
          aria-hidden
          className="size-3"
        />
      </Button>
    </Container>
  );
};
