import type {
  ModelRef,
  SessionMessageCompaction,
  SessionMessageShell,
} from '@opencode/client';

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

/** Estado real de una llamada a herramienta (`SessionMessageAssistantTool`). */
export type TToolStatus = 'streaming' | 'running' | 'completed' | 'error';

/** Estado de un episodio de compactación (`SessionMessageCompaction`). */
export type TCompactionStatus = 'running' | 'completed' | 'failed';

/** Motivo de un episodio de compactación (`SessionMessageCompaction`). */
export type TCompactionReason = SessionMessageCompaction['reason'];

/** Resultado final de un turno (`SessionMessageIdle`). */
export type TIdleOutcome = 'succeeded' | 'failed' | 'interrupted';

/** Estado de un mensaje `shell` (`SessionMessageShell`). */
export type TShellStatus = SessionMessageShell['status'];

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
interface THistoryEntryBase {
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

/** Cambio de agente (`SessionMessageAgentSelected`). */
export interface THistoryAgentSwitchedEntry extends THistoryEntryBase {
  kind: 'agent-switched';
  agent: string;
  previous: string | null;
}

/** Cambio de modelo (`SessionMessageModelSelected`). */
export interface THistoryModelSwitchedEntry extends THistoryEntryBase {
  kind: 'model-switched';
  model: ModelRef;
  previous: ModelRef | null;
}

/** Cambio de ubicación/directorio (`SessionMessageLocationSwitched`). */
export interface THistoryLocationSwitchedEntry extends THistoryEntryBase {
  kind: 'location-switched';
  directory: string;
}

/** Aviso de sistema (`SessionMessageSystem`). */
export interface THistorySystemEntry extends THistoryEntryBase {
  kind: 'system';
  text: string;
  description: string | null;
}

/** Entrada sintética (`SessionMessageSynthetic`). */
export interface THistorySyntheticEntry extends THistoryEntryBase {
  kind: 'synthetic';
  text: string;
  description: string | null;
}

/** Activación de una skill (`SessionMessageSkill`). */
export interface THistorySkillEntry extends THistoryEntryBase {
  kind: 'skill';
  skill: string;
  name: string;
  text: string;
}

/** Ejecución de shell (`SessionMessageShell`). */
export interface THistoryShellEntry extends THistoryEntryBase {
  kind: 'shell';
  command: string;
  status: TShellStatus;
  exit: number | null;
}

/** Episodio de compactación de contexto (`SessionMessageCompaction`, FR-035). */
export interface THistoryCompactionEntry extends THistoryEntryBase {
  kind: 'compaction';
  status: TCompactionStatus;
  reason: TCompactionReason;
  summary: string | null;
}

/** Cierre de turno con su resultado (`SessionMessageIdle`). */
export interface THistoryIdleEntry extends THistoryEntryBase {
  kind: 'idle';
  outcome: TIdleOutcome;
}

/** Estado de una pregunta al usuario (FR-033). */
export type THistoryQuestionState = 'pending' | 'answered' | 'cancelled';

/** Opción ofrecida por un campo de pregunta (FR-032). */
export interface THistoryQuestionOption {
  value: string;
  label: string;
}

/** Campo de una pregunta: título visible y opciones (FR-032). */
export interface THistoryQuestionField {
  key: string;
  /** Título legible del campo; `null` si el servidor no lo da (FR-038). */
  title: string | null;
  type: string;
  options: THistoryQuestionOption[];
}

/**
 * Pregunta al usuario incorporada al histórico (FR-033). Es el view-model
 * mínimo que consume `buildHistory`; estructuralmente compatible con
 * `TQuestionEntry` (Inspector), de modo que History no depende de Inspector.
 * `state` distingue pendiente/respondida/cancelada y `answer` solo se rellena
 * cuando está respondida.
 */
export interface THistoryQuestion {
  /** Id del formulario de origen (`FormInfo.id`). */
  id: string;
  title: string;
  fields: THistoryQuestionField[];
  state: THistoryQuestionState;
  /** Respuesta formateada si `state === 'answered'`; `null` en otro caso. */
  answer: string | null;
}

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
