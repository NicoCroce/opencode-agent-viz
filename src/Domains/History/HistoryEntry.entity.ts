import type {
  THistoryAgentSwitchedEntry,
  THistoryCompactionEntry,
  THistoryIdleEntry,
  THistoryLocationSwitchedEntry,
  THistoryModelSwitchedEntry,
  THistoryShellEntry,
  THistorySkillEntry,
  THistorySyntheticEntry,
  THistorySystemEntry,
} from './HistoryMetadata.entity';
import type { TToolStatus } from './HistoryStatus.entity';
import type { THistoryQuestionEntry } from './HistoryQuestion.entity';

export * from './HistoryMetadata.entity';

/**
 * View-models del histórico de una sesión (Constitución IV: prefijo `T`).
 *
 * `THistoryEntry` es una unión discriminada por `kind` que proyecta los
 * mensajes del SDK (`SessionMessageInfo`) en entradas de conversación
 * ordenables cronológicamente (FR-009). La construye la función pura
 * `buildHistory` (ver `lib/buildHistory.ts`); estos tipos no dependen del SDK
 * en runtime, solo de sus tipos.
 */

/** Adjunto de un prompt de usuario, normalizado a un nombre mostrable (FR-007). */
export interface THistoryAttachment {
  kind: 'file' | 'agent' | 'skill';
  /** Nombre del adjunto; `null` → "sin nombre" (nunca se omite). */
  name: string | null;
}

/**
 * Llamada a herramienta (`SessionMessageAssistantTool`). Refleja el estado
 * real y nunca inventa un resultado (FR-004/FR-011).
 */
export interface TToolEntry {
  /** Id del parte del SDK. */
  id: string;
  name: string;
  status: TToolStatus;
  /** Entrada cruda, tal cual, para mostrar serializada. */
  input: unknown;
  /** Texto del resultado, o `null` si todavía no terminó. */
  result: string | null;
  /** Mensaje de error cuando `status === 'error'`; `null` si no falló. */
  error: string | null;
  /** `time.created`. */
  startedAt: number | null;
  /** `time.completed`; `null` si no terminó. */
  completedAt: number | null;
  /** `completedAt - startedAt` si ambos existen; `null` si no. */
  durationMs: number | null;
}

/** Campos comunes a toda entrada del histórico. */
export interface THistoryEntryBase {
  /** Id estable: id del mensaje + ordinal de la parte. */
  id: string;
  /** `info.time.created` del mensaje que originó la entrada. */
  at: number;
}

/** Prompt del usuario (`SessionMessageUser`). */
export interface THistoryUserEntry extends THistoryEntryBase {
  kind: 'user';
  text: string;
  attachments: THistoryAttachment[];
}

/** Respuesta del assistant (`SessionMessageAssistantText`, FR-006). */
export interface THistoryAnswerEntry extends THistoryEntryBase {
  kind: 'answer';
  text: string;
  /** `false` mientras el assistant no esté completo → "en curso". */
  isComplete: boolean;
}

/** Razonamiento del assistant (`SessionMessageAssistantReasoning`). */
export interface THistoryReasoningEntry extends THistoryEntryBase {
  kind: 'reasoning';
  text: string;
  isComplete: boolean;
}

/** Llamada a herramienta (`SessionMessageAssistantTool`). */
export interface THistoryToolEntry extends THistoryEntryBase {
  kind: 'tool';
  entry: TToolEntry;
}

/**
 * Entrada del histórico, discriminada por `kind` y ordenada cronológicamente
 * por `at` (FR-009). Cubre todos los tipos de `SessionMessageInfo` y las
 * preguntas al usuario ancladas a su tool call (FR-033).
 */
export type THistoryEntry =
  | THistoryUserEntry
  | THistoryAnswerEntry
  | THistoryReasoningEntry
  | THistoryToolEntry
  | THistoryAgentSwitchedEntry
  | THistoryModelSwitchedEntry
  | THistoryLocationSwitchedEntry
  | THistorySystemEntry
  | THistorySyntheticEntry
  | THistorySkillEntry
  | THistoryShellEntry
  | THistoryCompactionEntry
  | THistoryIdleEntry
  | THistoryQuestionEntry;

/** Sesión cuyo histórico está abierto; `null` = overlay cerrado. */
export type THistoryTarget = string | null;

/** Navegación de linaje padre↔hijo del overlay (FR-010/FR-012). */
export interface TLineageNav {
  /** Sesión que invocó a la actual (arista `target → source`); `null` si raíz. */
  parentId: string | null;
  /** Sesiones invocadas por la actual. */
  childrenIds: string[];
}
