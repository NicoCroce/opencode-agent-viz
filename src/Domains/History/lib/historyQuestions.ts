import type { TQuestionEntry } from '@app/Application/Helpers/questionState';
import type {
  THistoryEntry,
  THistoryQuestion,
  THistoryQuestionEntry,
  THistoryToolEntry,
} from '../History.entity';

/** Nombres de herramienta que originan una pregunta al usuario (R8). */
export const QUESTION_TOOL_NAMES: ReadonlySet<string> = new Set([
  'question',
  'form',
]);

/** Ancla disponible para una pregunta: el tool call que la originó. */
interface TQuestionAnchor {
  id: string;
  at: number;
  /** Títulos candidatos del input del tool call, para emparejar por contenido. */
  titles: string[];
}

/** ¿Es una entrada de tool que pudo originar una pregunta? */
export const isQuestionTool = (
  entry: THistoryEntry,
): entry is THistoryToolEntry =>
  entry.kind === 'tool' && QUESTION_TOOL_NAMES.has(entry.entry.name);

/**
 * Títulos candidatos del input de un tool de pregunta (`title`, `question`,
 * `header` o `prompt`, incluso anidados en `questions[]`) para emparejarlo.
 */
export const candidateTitles = (input: unknown): string[] => {
  const titles: string[] = [];
  const visit = (value: unknown, depth: number): void => {
    if (depth > 4 || value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (
        (key === 'title' ||
          key === 'question' ||
          key === 'header' ||
          key === 'prompt') &&
        typeof child === 'string' &&
        child.length > 0
      ) {
        titles.push(child);
      }
      visit(child, depth + 1);
    }
  };
  visit(input, 0);
  return titles;
};

/**
 * Elige el ancla de una pregunta: por coincidencia de título con el input del
 * tool call y, si no la hay, la primera libre en orden cronológico.
 */
const pickAnchor = (
  anchors: TQuestionAnchor[],
  used: ReadonlySet<string>,
  question: TQuestionEntry,
): TQuestionAnchor | null => {
  const available = anchors.filter((anchor) => !used.has(anchor.id));
  if (available.length === 0) return null;
  return (
    available.find((anchor) => anchor.titles.includes(question.title)) ??
    available[0]
  );
};

const toQuestionEntry = (
  question: TQuestionEntry,
  at: number,
  anchorId: string | null,
): THistoryQuestionEntry => ({
  ...question,
  id: `question:${question.id}`,
  at,
  kind: 'question',
  formId: question.id,
  anchorId,
  anchored: anchorId !== null,
});

/**
 * Incorpora las preguntas al histórico en su posición cronológica (FR-033):
 * cada pregunta se ancla a la llamada a herramienta que la originó (tool
 * `question`/`form`, R8) y sustituye esa entrada, sin inventar un timestamp.
 * Emparejado por título del input y, si no coincide, por orden. **Fallback**
 * (documentado): sin ancla disponible, se añade al final con `anchored: false`.
 */
export const mergeQuestions = (
  entries: THistoryEntry[],
  questions: THistoryQuestion[],
): THistoryEntry[] => {
  const anchors: TQuestionAnchor[] = entries
    .filter(isQuestionTool)
    .map((entry) => ({
      id: entry.entry.id,
      at: entry.at,
      titles: candidateTitles(entry.entry.input),
    }));

  const used = new Set<string>();
  const anchoredQuestions: THistoryQuestionEntry[] = [];
  const fallbackQuestions: THistoryQuestionEntry[] = [];

  for (const question of questions) {
    const anchor = pickAnchor(anchors, used, question);
    if (anchor) {
      used.add(anchor.id);
      anchoredQuestions.push(toQuestionEntry(question, anchor.at, anchor.id));
    } else {
      fallbackQuestions.push(toQuestionEntry(question, 0, null));
    }
  }

  // El tool call ancla se sustituye por la pregunta estructurada (sin duplicar).
  const withoutAnchors = entries.filter(
    (entry) => !(entry.kind === 'tool' && used.has(entry.entry.id)),
  );
  const merged = [...withoutAnchors, ...anchoredQuestions].sort(
    (a, b) => a.at - b.at,
  );
  if (fallbackQuestions.length === 0) return merged;

  const lastAt = merged.length > 0 ? merged[merged.length - 1].at : 0;
  return [
    ...merged,
    ...fallbackQuestions.map((entry, index) => ({
      ...entry,
      at: lastAt + index + 1,
    })),
  ];
};
