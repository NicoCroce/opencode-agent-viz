/**
 * Estado de la pregunta en lenguaje natural (FR-033) y view-models de pregunta
 * compartidos entre History e Inspector (Familia 6).
 *
 * `THistoryQuestion*` (`History.entity`) y `TQuestion*` (`Inspector.entity`) eran
 * estructuralmente idénticos: History declaró la compatibilidad en sus propios
 * comentarios para no depender de Inspector. Este módulo es la fuente única para
 * que ambos dominios compartan el contrato sin acoplarse entre sí, y aloja
 * también la etiqueta/color del estado (Familia 3, FR-033).
 */

/** Estado de una pregunta al usuario (FR-033). */
export type TQuestionState = 'pending' | 'answered' | 'cancelled';

/** Opción ofrecida por un campo de pregunta (FR-032). */
export interface TQuestionOption {
  value: string;
  label: string;
}

/** Campo de una pregunta: título visible y opciones ofrecidas (FR-032). */
export interface TQuestionField {
  key: string;
  /** Título legible del campo; `null` si el servidor no lo da (FR-038). */
  title: string | null;
  type: string;
  options: TQuestionOption[];
}

/**
 * Pregunta dirigida al usuario (FR-032/FR-033). `state` distingue pendiente,
 * respondida y cancelada; `answer` solo se rellena cuando está respondida, de
 * modo que `pending`/`cancelled` nunca se presentan como `answered`.
 */
export interface TQuestionEntry {
  id: string;
  title: string;
  fields: TQuestionField[];
  state: TQuestionState;
  /** Respuesta formateada si `state === 'answered'`; `null` en otro caso. */
  answer: string | null;
}

/**
 * Etiqueta del estado de la pregunta (FR-033). Valores idénticos a los de las
 * copias de `HistoryEntry` (`QUESTION_STATE_LABEL`) y `QuestionsSection`
 * (`STATE_LABEL`).
 */
export const QUESTION_STATE_LABEL: Record<TQuestionState, string> = {
  pending: 'pendiente',
  answered: 'respondida',
  cancelled: 'cancelada',
};

/**
 * Color semántico del estado de la pregunta (FR-033). Valores idénticos a los de
 * `HistoryEntry` (`QUESTION_STATE_COLOR`) y `QuestionsSection` (`STATE_COLOR`).
 */
export const QUESTION_STATE_COLOR: Record<TQuestionState, string> = {
  pending: 'text-status-running',
  answered: 'text-status-done',
  cancelled: 'text-muted-foreground',
};
