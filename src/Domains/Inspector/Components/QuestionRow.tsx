import { QuestionBlock } from '@app/Application/Components/Molecules/QuestionBlock';
import {
  ChatPendingRequest,
  type TChatFormAnswer,
} from '@app/Application/Components/Molecules/ChatPendingRequest';
import type { TQuestionEntry } from '../Inspector.entity';

interface QuestionRowProps {
  /** Pregunta dirigida al usuario (FR-032/FR-033). */
  question: TQuestionEntry;
  /**
   * Modo accionable opt-in (FR-005). Por defecto `false`: la fila conserva el
   * comportamiento de solo lectura. Con `true` (y `onReplyForm`) una pregunta
   * `pending` delega en la molecule `ChatPendingRequest` y ofrece el formulario.
   */
  actionable?: boolean;
  /** Notifica la respuesta indexada por `field.key`; requerido en accionable. */
  onReplyForm?: (answer: TChatFormAnswer) => void;
  /** Mutation en vuelo: bloquea el formulario en modo accionable (FR-004). */
  isPending?: boolean;
}

/**
 * Fila de una pregunta (FR-032/FR-033): delega en el bloque compartido
 * `QuestionBlock` (título + `QuestionStateBadge`, campos/opciones y respuesta
 * solo si `answered`) y añade el borde inferior de la fila.
 *
 * Reemplaza los mapas locales `STATE_LABEL`/`STATE_COLOR` por la fuente única
 * (`QUESTION_STATE_LABEL`/`QUESTION_STATE_COLOR`) que ya usaba `HistoryEntry`.
 *
 * En **modo accionable opt-in** (FR-005) solo una pregunta `pending` se vuelve
 * respondible mediante `ChatPendingRequest`; `answered`/`cancelled` siguen en
 * solo lectura (nunca se ofrece responderlas de nuevo, FR-033).
 */
export const QuestionRow = ({
  question,
  actionable = false,
  onReplyForm,
  isPending = false,
}: QuestionRowProps) => {
  if (actionable && onReplyForm && question.state === 'pending') {
    return (
      <ChatPendingRequest
        kind="question"
        question={question}
        onReplyForm={onReplyForm}
        isPending={isPending}
        className="border-b border-border py-1 last:border-b-0"
      />
    );
  }

  return (
    <QuestionBlock
      question={question}
      className="border-b border-border py-1 last:border-b-0"
    />
  );
};
