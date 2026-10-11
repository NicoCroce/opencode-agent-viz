import { useId } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWrench } from '@fortawesome/free-solid-svg-icons';
import { Container, Label, Toggle } from '@app/Application/Components';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/Application/Components/ui/select';

/**
 * Barra superior del chat (iteración UX U3/U4).
 *
 * Presentación pura con dos controles, estética neutra (sin colores de tipo,
 * coherente con U1):
 *
 * 1. **Toggle "Herramientas"** (U3): oculta/muestra las entradas de tipo
 *    herramienta. Por defecto las herramientas se ven (`pressed: true`); el
 *    estado se comunica con `aria-pressed` y una etiqueta textual, no solo por
 *    color. La visibilidad la posee el llamador (`ChatPanel`), que la reenvía al
 *    timeline.
 * 2. **Select "Ir a mi mensaje"** (U4): lista los prompts propios (entradas del
 *    usuario) en orden; la etiqueta es la primera porción del texto en una sola
 *    línea. Al elegir uno, el llamador salta a esa fila y la resalta un instante.
 *    Sin prompts el control queda **deshabilitado**.
 *
 * El `Select` usa los primitivos Radix de `ui/select` (el wrapper `Select` no
 * expone `disabled`), como ya hace `ChatSelector`.
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
  className?: string;
}

export const ChatToolbar = ({
  showTools,
  onToggleTools,
  prompts,
  onSelectPrompt,
  className,
}: ChatToolbarProps) => {
  const selectId = useId();
  const hasPrompts = prompts.length > 0;

  return (
    <Container
      row
      align="center"
      justify="between"
      space="small"
      role="toolbar"
      aria-label="Controles del chat"
      data-testid="chat-toolbar"
      className={`shrink-0 ${className ?? ''}`}
    >
      <Toggle
        pressed={showTools}
        onPressedChange={onToggleTools}
        variant="outline"
        size="sm"
        data-testid="chat-tools-toggle"
        className="gap-1.5 text-[11px]"
      >
        <FontAwesomeIcon icon={faWrench} aria-hidden className="size-3" />
        Herramientas
      </Toggle>

      <Container space="small" className="w-auto">
        <Label htmlFor={selectId} className="sr-only">
          Ir a mi mensaje
        </Label>
        <Select onValueChange={onSelectPrompt} disabled={!hasPrompts}>
          <SelectTrigger id={selectId} className="w-auto min-w-40">
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
    </Container>
  );
};
