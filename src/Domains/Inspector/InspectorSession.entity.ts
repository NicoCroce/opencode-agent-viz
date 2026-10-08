import type {
  FileDiffInfo,
  SessionInboxInfo,
  SessionMessageInfo,
} from '@opencode/client';
import type { TNodeMetrics } from '../Graph/Graph.entity';
import type { TResourceUsage } from './InspectorResources.entity';

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
