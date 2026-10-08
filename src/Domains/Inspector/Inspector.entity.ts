import type {
  FileDiffInfo,
  McpServer,
  SessionInboxInfo,
  SessionMessageInfo,
} from '@opencode/client';
import type { TNodeMetrics } from '../Graph/Graph.entity';

/** `McpServer.status` es una unión discriminada por `status`. */
export type TMcpStatus = McpServer['status']['status'];

export interface TResourceUsage {
  mcpServers: { name: string; status: TMcpStatus }[];
  instructions: string[];
  skills: { name: string }[];
  tools: string[];
  availability: 'available';
}

export interface TToolHistoryEntry {
  name: string;
  status: string;
  startedAt?: number;
  endedAt?: number;
}

/**
 * Estadística agregada de una herramienta (FR-036): número de ejecuciones y
 * mediana de sus duraciones. La calcula la función pura `medianToolDurations`.
 */
export interface TToolStat {
  name: string;
  /** Ejecuciones registradas de esa herramienta. */
  calls: number;
  /** Mediana de `endedAt - startedAt` con ambos tiempos; `null` sin datos. */
  medianMs: number | null;
}

/**
 * Un archivo afectado por el agente (FR-028..FR-030). Alias del `FileDiffInfo`
 * del SDK (Principio IV: no se redefine lo que el SDK ya exporta). `status` ∈
 * `added | modified | deleted`; `patch` puede venir vacío → "parche no
 * disponible".
 */
export type TFileChange = FileDiffInfo;

/** Resultado de `useSessionDiff` con los estados de pantalla de la sección. */
export interface TSessionDiffResult {
  changes: TFileChange[];
  isError: boolean;
  isLoading: boolean;
}

/** Estado de una pregunta al usuario (FR-033). */
export type TQuestionState = 'pending' | 'answered' | 'cancelled';

/** Opciones ofrecidas por un campo de una pregunta (FR-032). */
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

/** Permiso que una ejecución está esperando (FR-031). */
export interface TPermissionEntry {
  id: string;
  /** Operación afectada. */
  action: string;
  /** Recursos afectados por la operación. */
  resources: string[];
  /** Motivo textual si el servidor lo reporta (FR-038). */
  message: string | null;
}

/** Resultado de `useSessionForms` (preguntas + estados de pantalla). */
export interface TSessionFormsResult {
  questions: TQuestionEntry[];
  isError: boolean;
  isLoading: boolean;
}

/** Resultado de `useSessionPermissions` (permisos + estados de pantalla). */
export interface TSessionPermissionsResult {
  permissions: TPermissionEntry[];
  isError: boolean;
  isLoading: boolean;
}

/** Resultado de `useSessionInbox` (cola de turnos + estados de pantalla). */
export interface TSessionInboxResult {
  /** Turnos pendientes en cola: items con `delivery === 'queue'` (FR-034). */
  queuedTurns: number;
  items: SessionInboxInfo[];
  isError: boolean;
  isLoading: boolean;
}

/**
 * Resultado de `useSessionContext` (FR-035): contexto resultante de una
 * compactación, cargado bajo demanda, con los estados de pantalla de la
 * sección.
 */
export interface TSessionContextResult {
  messages: SessionMessageInfo[];
  isError: boolean;
  isLoading: boolean;
}

/**
 * V2 eliminó la API de todos de sesión (`session.todo` y el evento
 * `todo.updated` no existen). En su lugar derivamos las tareas del subagente
 * de los tool calls que abren una sesión hija.
 */
export interface TTaskEntry {
  id: string;
  description: string;
  agent: string | null;
  status: string;
  /** Sesión hija que el subagente abrió, cuando el server la reporta. */
  sessionID: string | null;
  startedAt?: number;
  endedAt?: number;
}

export interface TSessionSummary {
  rootSessionId: string;
  metrics: TNodeMetrics;
  agentCount: number;
  subagentCount: number;
  createdCount: number;
  runningCount: number;
  retryingCount: number;
  compactingCount: number;
  /** Agrupa `waiting-permission` + `waiting-input` (FR-024). */
  waitingCount: number;
  succeededCount: number;
  /** Cuenta solo `failed`; `interrupted` se cuenta aparte (FR-019). */
  errorCount: number;
  interruptedCount: number;
  loopCount: number;
  agentInvocations: Record<string, number>;
  resourceUsage: TResourceUsage;
  /**
   * Tiempo transcurrido de la sesión: `max(endedAt) - min(startedAt)`; si la
   * sesión sigue activa, `now - min(startedAt)`; `null` sin actividad (FR-026).
   */
  elapsedMs: number | null;
}
