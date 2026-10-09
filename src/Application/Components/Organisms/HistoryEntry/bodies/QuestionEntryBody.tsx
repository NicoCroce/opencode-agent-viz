import { QuestionBlock } from '@app/Application/Components/Molecules';
import type { THistoryQuestionEntry } from '@app/Domains/History/History.entity';

interface QuestionEntryBodyProps {
  entry: THistoryQuestionEntry;
}

/**
 * Pregunta al usuario (FR-033). Delega en `QuestionBlock`, que unifica título,
 * estado coloreado, campos con opciones y respuesta cuando existe; `pending` y
 * `cancelled` nunca se presentan como `answered`.
 */
export const QuestionEntryBody = ({ entry }: QuestionEntryBodyProps) => (
  <QuestionBlock question={entry} />
);
