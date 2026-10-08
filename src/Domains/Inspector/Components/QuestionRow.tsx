import { QuestionBlock } from '@app/Application/Components/Molecules/QuestionBlock';
import type { TQuestionEntry } from '../Inspector.entity';

interface QuestionRowProps {
  /** Pregunta dirigida al usuario (FR-032/FR-033). */
  question: TQuestionEntry;
}

/**
 * Fila de una pregunta (FR-032/FR-033): delega en el bloque compartido
 * `QuestionBlock` (título + `QuestionStateBadge`, campos/opciones y respuesta
 * solo si `answered`) y añade el borde inferior de la fila.
 *
 * Reemplaza los mapas locales `STATE_LABEL`/`STATE_COLOR` por la fuente única
 * (`QUESTION_STATE_LABEL`/`QUESTION_STATE_COLOR`) que ya usaba `HistoryEntry`.
 */
export const QuestionRow = ({ question }: QuestionRowProps) => (
  <QuestionBlock
    question={question}
    className="border-b border-border py-1 last:border-b-0"
  />
);
