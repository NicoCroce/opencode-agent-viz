import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { THistoryEntry, THistoryQuestion } from '../History.entity';
import { MESSAGE_ENTRY_BUILDERS } from './entryBuilders';
import { mergeQuestions } from './historyQuestions';

/** Opciones de `buildHistory`: preguntas al usuario a incorporar (FR-033). */
export interface BuildHistoryOptions {
  /**
   * Formularios/preguntas de la sesión, en el orden reportado por el servidor.
   * Estructuralmente compatibles con `TQuestionEntry` (Inspector).
   */
  questions?: THistoryQuestion[];
}

/**
 * Proyecta los mensajes normalizados del SDK (`TSessionMessage`) en entradas de
 * histórico ordenables cronológicamente (`THistoryEntry`, FR-009).
 *
 * Función pura: no muta la entrada, no depende del SDK en runtime (solo de sus
 * tipos) y es determinista. El `id` de cada entrada es estable: id del mensaje
 * + ordinal de la parte (`assistant`) o `:0` para el resto.
 *
 * Con `options.questions` incorpora las preguntas al usuario en su posición
 * cronológica anclándolas a su tool call (`mergeQuestions`, FR-033).
 *
 * Orquestador: el despacho por tipo de mensaje vive en `entryBuilders`
 * (`MESSAGE_ENTRY_BUILDERS`) y el subsistema de preguntas en `historyQuestions`.
 */
export function buildHistory(
  messages: TSessionMessage[],
  options: BuildHistoryOptions = {},
): THistoryEntry[] {
  // Copia ordenada por `info.time.created` ascendente (FR-009). El sort es
  // estable, así que los mensajes con el mismo instante conservan su orden.
  const ordered = [...messages].sort(
    (a, b) => a.info.time.created - b.info.time.created,
  );
  const entries = ordered.flatMap((message) => {
    const { info } = message;
    const builder = MESSAGE_ENTRY_BUILDERS[info.type];
    return builder(message, info.time.created, `${info.id}:0`);
  });
  const questions = options.questions ?? [];
  if (questions.length === 0) return entries;
  return mergeQuestions(entries, questions);
}
