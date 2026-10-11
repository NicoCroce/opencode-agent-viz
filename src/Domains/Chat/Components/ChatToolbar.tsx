import { type RefObject } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClockRotateLeft,
  faEye,
  faEyeSlash,
} from '@fortawesome/free-solid-svg-icons';
import { Container } from '@app/Application/Components';
import { Button } from '@app/Application/Components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@app/Application/Components/ui/tooltip';

/**
 * Controles del chat (iteración UX: footer estilo Copilot).
 *
 * Presentación pura con dos controles, estética neutra (sin colores de tipo,
 * coherente con U1). Se monta en la **fila inferior del compositor** (a la
 * izquierda, junto a los chips de agente/modelo/razonamiento) y ya no sobre el
 * hilo:
 *
 * 1. **Botón-icono "ojo" de herramientas**: oculta/muestra las entradas de tipo
 *    herramienta. Por defecto las herramientas se ven (`showTools: true`); el
 *    estado se comunica con `aria-pressed`, un `aria-label` textual (no depende
 *    solo del tooltip) y el icono (`faEye`/`faEyeSlash`). El tooltip de
 *    `ui/tooltip` repite la etiqueta textual. La visibilidad la posee el
 *    llamador (`ChatPanel`), que la reenvía al timeline.
 * 2. **Botón-icono "Historial de mensajes"**: abre el modal de historial
 *    completo. Solo emite la intención (`onOpenHistory`); el estado de apertura y
 *    el modal viven en el llamador (`ChatPanel`), que reutiliza su salto.
 *
 * El salto a un mensaje propio ya **no** se ofrece aquí: el modal de historial
 * (U2) lo cubre. Por eso se retiraron el `Select` "Ir a mi mensaje" y sus props.
 *
 * Ambos botones-icono usan `ui/button` (el wrapper `Button` impone padding de
 * botón con etiqueta). El `TooltipProvider` se monta localmente para no acoplar
 * la app a un proveedor global mientras solo este control usa tooltips.
 */

/**
 * Etiqueta del toggle de herramientas cuando las herramientas se ven (estado por
 * defecto). Textual y reutilizada por `aria-label` y el tooltip, de modo que el
 * control no dependa exclusivamente del tooltip.
 */
export const CHAT_TOOLS_VISIBLE_LABEL = 'Mostrar herramientas utilizadas';

/** Etiqueta del toggle cuando las herramientas están ocultas. */
export const CHAT_TOOLS_HIDDEN_LABEL = 'Ocultar herramientas utilizadas';

export interface ChatToolbarProps {
  /** `true` = las entradas de herramienta se ven (por defecto). */
  showTools: boolean;
  /** Notifica el nuevo estado del toggle. */
  onToggleTools: (next: boolean) => void;
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
  onOpenHistory,
  historyButtonRef,
  className,
}: ChatToolbarProps) => {
  const toolsLabel = showTools
    ? CHAT_TOOLS_VISIBLE_LABEL
    : CHAT_TOOLS_HIDDEN_LABEL;

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
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onToggleTools(!showTools)}
              aria-pressed={showTools}
              aria-label={toolsLabel}
              data-testid="chat-tools-toggle"
              className="h-8 w-8 rounded-full p-0"
            >
              <FontAwesomeIcon
                icon={showTools ? faEye : faEyeSlash}
                aria-hidden
                className="size-3"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{toolsLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

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
