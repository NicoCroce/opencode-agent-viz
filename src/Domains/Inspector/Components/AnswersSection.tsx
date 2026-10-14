import type { ReactNode } from 'react';
import {
  Button,
  Container,
  EmptyScreenError,
  HistoryEntry,
} from '@app/Application/Components';
import { ListSkeleton } from '@app/Application/Components/Molecules';
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
  /**
   * La consulta de mensajes (`useInspectorData`) falló (Principio VI): el área
   * de lista muestra el error en lugar del vacío.
   */
  isError?: boolean;
  /**
   * La consulta de mensajes (`useInspectorData`) está en curso (Principio VI):
   * el área de lista muestra el esqueleto en lugar del vacío.
   */
  isLoading?: boolean;
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
 *
 * No usa `SectionFrame` porque su cabecera lleva el toggle de razonamiento y su
 * vacío no es excluyente con la lista (FR-008/R7). El área de lista resuelve
 * igualmente la prioridad error → carga → vacío/datos reutilizando los nodos
 * por defecto (`EmptyScreenError`, `ListSkeleton`); la cabecera con el toggle y
 * el botón "Ver histórico completo" permanecen montados en los cuatro estados,
 * porque ninguno depende de la consulta de mensajes.
 */
export const AnswersSection = ({
  entries,
  showReasoning,
  onToggleReasoning,
  onOpenHistory,
  sessionId = null,
  renderCompactionContext,
  isError = false,
  isLoading = false,
}: AnswersSectionProps) => {
  const conversational = entries.filter(isConversational);

  // "Sin respuestas todavía" solo cuando no hay contenido de agente visible: si
  // únicamente hay herramientas o preguntas, éstas se muestran y el texto queda
  // vacío de forma explícita (edge case), sin secciones fantasma. Nunca se
  // muestra el vacío mientras la fuente está en carga o en error (SC-005).
  const hasText = conversational.some(
    (entry) =>
      entry.kind === 'answer' ||
      entry.kind === 'question' ||
      (entry.kind === 'reasoning' && showReasoning),
  );

  let listArea: ReactNode;
  if (isError) {
    listArea = <EmptyScreenError />;
  } else if (isLoading) {
    listArea = <ListSkeleton />;
  } else {
    listArea = (
      <>
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
      </>
    );
  }

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

      {listArea}

      <Button variant="outline" onClick={onOpenHistory}>
        Ver histórico completo
      </Button>
    </Container>
  );
};
