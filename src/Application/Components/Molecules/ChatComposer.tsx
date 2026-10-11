import { useId, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import type {
  TAgentOption,
  TChatSelection,
  TModelOption,
  TReasoningOption,
} from '@app/Domains/Chat/Chat.entity';
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
import { ChatSelector } from './ChatSelector';

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
  /** Agentes disponibles para el selector (FR-008). */
  agents?: TAgentOption[];
  /** Modelos disponibles, cada uno con sus variantes de razonamiento. */
  models?: TModelOption[];
  /** Variantes de razonamiento del modelo elegido (FR-008). */
  reasoning?: TReasoningOption[];
  /**
   * Selección activa de agente/modelo. Presente → se monta `ChatSelector` sobre
   * el textarea (FR-008); ausente → el compositor se renderiza sin selectores
   * (p. ej. sin catálogo cargado).
   */
  selection?: TChatSelection;
  /** Notifica la selección resultante tras un cambio en `ChatSelector`. */
  onSelectionChange?: (next: TChatSelection) => void;
  className?: string;
}

/** Selección vacía estable para cuando el composer no controla selectores. */
const NOOP_SELECTION_CHANGE = (): void => {};

/**
 * Compositor de mensajes del chat (FR-001, FR-023, FR-021, FR-004, FR-008).
 *
 * Molecule presentacional: textarea + "Enviar" + "Detener" sin conocer el SDK
 * ni los servicios. Solo acepta texto (sin adjuntos). Enter envía, Shift+Enter
 * inserta un salto de línea y el envío se respeta durante la composición IME.
 * "Detener" solo se habilita con un turno en curso (`busy`) y pide confirmación
 * en un `AlertDialog` antes de interrumpir (FR-004). Cuando recibe una
 * `selection` monta `ChatSelector` (agente/modelo/razonamiento, FR-008) sobre el
 * textarea, con las opciones ya derivadas y el estado de escritura en curso.
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
  agents = [],
  models = [],
  reasoning = [],
  selection,
  onSelectionChange = NOOP_SELECTION_CHANGE,
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
      <Container space="medium">
        {selection ? (
          <ChatSelector
            agents={agents}
            models={models}
            reasoning={reasoning}
            selection={selection}
            onChange={onSelectionChange}
            isPending={isSubmitting}
          />
        ) : null}
        <Container space="small">
          <Label
            htmlFor={textareaId}
            className="text-[11px] font-medium text-muted-foreground"
          >
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
        </Container>
        <Container row justify="end" align="center" space="small">
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
    </form>
  );
};
