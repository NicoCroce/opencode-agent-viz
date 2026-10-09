import { cn } from '@app/Application/lib/utils';
import {
  QUESTION_STATE_COLOR,
  QUESTION_STATE_LABEL,
  type TQuestionState,
} from '@app/Application/Helpers/questionState';

interface QuestionStateBadgeProps {
  /** Estado de la pregunta (FR-033). */
  state: TQuestionState;
  className?: string;
}

/**
 * Etiqueta coloreada del estado de una pregunta (FR-033).
 *
 * Presentación pura sobre los mapas compartidos `QUESTION_STATE_LABEL` /
 * `QUESTION_STATE_COLOR`: conserva los textos exactos
 * ('pendiente'/'respondida'/'cancelada') y las clases `text-status-*` que ya
 * usaban `HistoryEntry` y `QuestionsSection`.
 */
export const QuestionStateBadge = ({
  state,
  className,
}: QuestionStateBadgeProps) => (
  <span
    className={cn(
      'shrink-0 font-mono text-[11px]',
      QUESTION_STATE_COLOR[state],
      className,
    )}
  >
    {QUESTION_STATE_LABEL[state]}
  </span>
);
