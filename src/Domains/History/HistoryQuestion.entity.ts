import type {
  TQuestionEntry,
  TQuestionField,
  TQuestionOption,
  TQuestionState,
} from '@app/Application/Helpers/questionState';
import type { THistoryEntryBase } from './HistoryEntry.entity';

/**
 * View-models de pregunta del histórico (FR-032/FR-033).
 *
 * Son aliases de los tipos compartidos de `Application/Helpers/questionState`
 * (Familia 6 / SH-07), de modo que History e Inspector comparten un único
 * contrato sin acoplarse entre sí. Los aliases `THistoryQuestion*` preservan la
 * API pública que consumen `buildHistory`, `HistoryEntry` y sus specs.
 */

/** Estado de una pregunta al usuario (FR-033). */
export type THistoryQuestionState = TQuestionState;

/** Opción ofrecida por un campo de pregunta (FR-032). */
export type THistoryQuestionOption = TQuestionOption;

/** Campo de una pregunta: título visible y opciones (FR-032). */
export type THistoryQuestionField = TQuestionField;

/** Pregunta al usuario incorporada al histórico (FR-033). */
export type THistoryQuestion = TQuestionEntry;

/**
 * Pregunta al usuario en su posición cronológica (FR-033). `FormInfo`/
 * `FormDetail` no exponen tiempo, así que la entrada se ancla a la llamada a
 * herramienta que la originó (tool `question`/`form`, R8); `anchorId` es el id
 * de esa llamada y `anchored` indica si la posición provino de ella o del
 * fallback (al final del histórico).
 */
export interface THistoryQuestionEntry extends THistoryEntryBase {
  kind: 'question';
  formId: string;
  title: string;
  fields: THistoryQuestionField[];
  state: THistoryQuestionState;
  answer: string | null;
  /** Id del tool call ancla; `null` si no se encontró ninguno. */
  anchorId: string | null;
  /** `true` si la posición proviene de su tool call; `false` en el fallback. */
  anchored: boolean;
}
