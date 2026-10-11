import { useId, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Container,
  Label,
  Textarea,
} from '@app/Application/Components';

export interface ChatComposerProps {
  /** Texto actual del borrador (controlado por `useChatDraft`). */
  value: string;
  /** Notifica cada cambio del textarea. */
  onChange: (value: string) => void;
  /** Envía el texto no vacío (FR-001). */
  onSubmit: () => void;
  /** Turno en curso: bloquea la entrada y anuncia `aria-busy` (FR-021). */
  isSubmitting?: boolean;
  /** Turno en curso en la sesión abierta: habilita "Detener" (FR-004). */
  busy?: boolean;
  /** Solicita interrumpir el turno en curso tras confirmar (FR-004). */
  onInterrupt?: () => void;
  /** Interrupción en vuelo: anuncia `aria-busy` y estado de carga (FR-004). */
  isInterrupting?: boolean;
  /** Deshabilita el compositor completo (p. ej. sin sesión abierta). */
  disabled?: boolean;
  /**
   * Controles del chat (chips de herramientas/agente/modelo/razonamiento) que se
   * montan en la **fila inferior**, a la izquierda de las acciones. El
   * compositor no conoce el dominio: el llamador (`ChatPanel`) rellena este slot
   * con `ChatToolbar` + `ChatSelector`, evitando el import cross-domain.
   */
  controls?: ReactNode;
  className?: string;
}

/**
 * Compositor de mensajes del chat (FR-001, FR-023, FR-021, FR-004).
 *
 * Molecule presentacional: textarea + fila inferior tipo Copilot con los
 * **controles del chat a la izquierda** (slot `controls`) y las acciones
 * `[Detener] [Enviar]` a la derecha. No conoce el SDK, los servicios ni el
 * dominio `Chat`: los selectores llegan ya compuestos por el llamador. Solo
 * acepta texto (sin adjuntos). Enter envía, Shift+Enter inserta un salto de
 * línea y el envío se respeta durante la composición IME. "Detener" solo se
 * habilita con un turno en curso (`busy`) y pide confirmación en un
 * `AlertDialog` antes de interrumpir (FR-004).
 */
export const ChatComposer = ({
  value,
  onChange,
  onSubmit,
  isSubmitting = false,
  busy = false,
  onInterrupt,
  isInterrupting = false,
  disabled = false,
  controls,
  className,
}: ChatComposerProps) => {
  const [isComposing, setIsComposing] = useState(false);
  const textareaId = useId();

  const isDisabled = disabled || isSubmitting;
  const canSubmit = value.trim().length > 0 && !isDisabled;
  // Solo se puede interrumpir si hay turno en curso y el compositor no está bloqueado (FR-004).
  const canInterrupt = busy && !disabled;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    // Nunca enviar mientras el IME está componiendo (FR-021).
    if (isComposing || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (canSubmit) onSubmit();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) onSubmit();
  };

  return (
    <form
      className={className}
      onSubmit={handleSubmit}
      aria-busy={isSubmitting}
    >
      <Container space="small">
        <Label htmlFor={textareaId} className="sr-only">
          Mensaje
        </Label>
        <Textarea
          id={textareaId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          disabled={isDisabled}
          rows={3}
          placeholder="Escribe un mensaje…"
        />

        {/* Fila inferior tipo Copilot: chips del chat a la izquierda y las
            acciones [Detener] [Enviar] a la derecha, todo bajo el textarea. */}
        <Container
          row
          align="center"
          justify="between"
          space="small"
          className="flex-wrap"
        >
          <Container
            row
            align="center"
            space="small"
            data-testid="chat-composer-controls"
            className="min-w-0 flex-1 flex-wrap"
          >
            {controls}
          </Container>

          <Container
            row
            align="center"
            space="small"
            data-testid="chat-composer-actions"
            className="shrink-0"
          >
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canInterrupt}
                  isLoading={isInterrupting}
                  aria-busy={isInterrupting}
                >
                  Detener
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Detener el turno en curso?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se interrumpirá el turno de esta sesión. Las sesiones hijas
                    (subagentes) continuarán en ejecución.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onInterrupt}>
                    Detener turno
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={!canSubmit}
              aria-busy={isSubmitting}
            >
              Enviar
            </Button>
          </Container>
        </Container>
      </Container>
    </form>
  );
};
