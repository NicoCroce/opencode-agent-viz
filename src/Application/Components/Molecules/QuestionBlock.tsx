import { Container } from '@app/Application/Components/Layout';
import type {
  TQuestionEntry,
  TQuestionField,
  TQuestionOption,
} from '@app/Application/Helpers/questionState';
import { QuestionStateBadge } from './QuestionStateBadge';

interface QuestionBlockProps {
  /** Pregunta normalizada compartida por History e Inspector (FR-032/FR-033). */
  question: TQuestionEntry;
  className?: string;
}

/** Campo y sus opciones ofrecidas; se omite el sufijo si no hay opciones. */
const QuestionFieldRow = (field: TQuestionField) => (
  <span key={field.key} className="text-[11px] text-muted-foreground">
    {field.title ?? field.key}
    {field.options.length > 0
      ? ` · ${field.options
          .map((option: TQuestionOption) => option.label)
          .join(', ')}`
      : null}
  </span>
);

/**
 * Bloque de pregunta al usuario (FR-033): título + estado coloreado, campos con
 * sus opciones y, solo cuando está respondida, la respuesta.
 *
 * Unifica el bloque que `HistoryEntry` (entrada `question`) y `QuestionsSection`
 * renderizaban por separado a partir de view-models estructuralmente idénticos
 * (Familia 6); `pending`/`cancelled` nunca se presentan como `answered`.
 */
export const QuestionBlock = ({ question, className }: QuestionBlockProps) => (
  <Container space="small" className={className}>
    <Container row space="small" align="baseline" justify="between">
      <span className="min-w-0 text-xs text-foreground">{question.title}</span>
      <QuestionStateBadge state={question.state} />
    </Container>

    {question.fields.map(QuestionFieldRow)}

    {question.state === 'answered' && question.answer ? (
      <span className="text-[11px] text-status-done">
        Respuesta: {question.answer}
      </span>
    ) : null}
  </Container>
);
