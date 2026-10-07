import type { ReactNode } from 'react';
import { Button, Container, HistoryEntry } from '@app/Application/Components';
import type { THistoryEntry } from '@app/Domains/History/History.entity';

interface AnswersSectionProps {
  /** Entradas del histórico en orden cronológico (`buildHistory`). */
  entries: THistoryEntry[];
  /**
   * Visibilidad del razonamiento (FR-002). La posee el llamador
   * (`useReasoningVisibility`); ocultarlo no afecta a las respuestas.
   */
  showReasoning: boolean;
  /** Alterna la visibilidad del razonamiento (FR-002). */
  onToggleReasoning: () => void;
  /**
   * Abre el histórico completo del agente (FR-008). El wiring vive en US2
   * (T040/T041); sin handler el botón queda inerte, no oculto.
   */
  onOpenHistory?: () => void;
  /**
   * Sesión a la que pertenecen las entradas. Se reenvía a `HistoryEntry` y a su
   * render del contexto de compactación (FR-035).
   */
  sessionId?: string | null;
  /**
   * Render del contexto de compactación (FR-035), inyectado por el llamador
   * (Inspector, que pide los datos con `useSessionContext`). Se reenvía a
   * `HistoryEntry`; sin él la compactación se muestra sin contexto.
   */
  renderCompactionContext?: (sessionId: string) => ReactNode;
}

/**
 * Tipos de entrada que pertenecen a la conversación de un agente: mensaje del
 * usuario, respuesta, razonamiento, llamada a herramienta (FR-003) y pregunta
 * al usuario (FR-033).
 */
const CONVERSATIONAL_KINDS: ReadonlySet<THistoryEntry['kind']> = new Set([
  'user',
  'answer',
  'reasoning',
  'tool',
  'question',
]);

const isConversational = (entry: THistoryEntry): boolean =>
  CONVERSATIONAL_KINDS.has(entry.kind);

/**
 * Sección de respuestas y razonamiento del detalle del agente (FR-001/002/003).
 *
 * Lista las entradas conversacionales de `buildHistory` en su orden
 * cronológico, con `HistoryEntry` (texto enriquecido saneado para las
 * respuestas y razonamiento, fila expandible para las herramientas). El toggle
 * de razonamiento es un `Button` con `aria-pressed`; ocultarlo nunca afecta a
 * las respuestas. Sin respuestas se muestra un estado vacío explícito y el
 * botón "Ver histórico completo" queda expuesto vía `onOpenHistory` (FR-008).
 */
export const AnswersSection = ({
  entries,
  showReasoning,
  onToggleReasoning,
  onOpenHistory,
  sessionId = null,
  renderCompactionContext,
}: AnswersSectionProps) => {
  const conversational = entries.filter(isConversational);

  // "Sin respuestas todavía" solo cuando no hay contenido de agente visible: si
  // únicamente hay herramientas o preguntas, éstas se muestran y el texto queda
  // vacío de forma explícita (edge case), sin secciones fantasma.
  const hasText = conversational.some(
    (entry) =>
      entry.kind === 'answer' ||
      entry.kind === 'question' ||
      (entry.kind === 'reasoning' && showReasoning),
  );

  return (
    <Container space="small">
      <Container row space="small" justify="between" align="center">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Respuestas
        </span>
        <Button
          variant="outline"
          onClick={onToggleReasoning}
          aria-pressed={showReasoning}
        >
          {showReasoning ? 'Ocultar razonamiento' : 'Ver razonamiento'}
        </Button>
      </Container>

      {!hasText ? (
        <p className="text-xs text-muted-foreground">Sin respuestas todavía</p>
      ) : null}

      {conversational.length > 0 ? (
        <Container space="small">
          {conversational.map((entry) => (
            <HistoryEntry
              key={entry.id}
              entry={entry}
              showReasoning={showReasoning}
              sessionId={sessionId}
              renderCompactionContext={renderCompactionContext}
            />
          ))}
        </Container>
      ) : null}

      <Button variant="outline" onClick={onOpenHistory}>
        Ver histórico completo
      </Button>
    </Container>
  );
};
