import type { ModelRef } from '@opencode/client';

/**
 * Estado de ejecución de un agente (FR-017). 9 valores que se derivan de
 * forma pura en `lib/nodeStatus.ts` y se muestran de forma consistente entre
 * nodo y detalle (FR-023). Ver `contracts/execution-state-contract.md`.
 */
export type TNodeStatus =
  | 'created'
  | 'running'
  | 'retrying'
  | 'compacting'
  | 'waiting-permission'
  | 'waiting-input'
  | 'succeeded'
  | 'failed'
  | 'interrupted';

export interface TTokenUsage {
  input: number | null;
  output: number | null;
  reasoning: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
}

export interface TNodeMetrics {
  durationMs: number | null;
  startedAt: number | null;
  endedAt: number | null;
  cost: number | null;
  tokens: TTokenUsage | null;
  invocations: number;
  retryCount: number;
  hasLoop: boolean;
  loopEvidence: string[];
}

/**
 * Base de métricas de un nodo **independiente del reloj** (data-model §2.1):
 * resultado de `deriveMetricBase(messages)`, memoizable por identidad de
 * `messages`. No incluye `durationMs` ni `invocations` (dependen de `now` y de
 * la señal de ejecución); eso lo resuelve `resolveMetrics(base, status, now,
 * subtaskInvocations)`.
 *
 * Expone además `model`, `currentTool` y `lastAssistantErrored`, que consume
 * `buildGraph` para `data.model`, `data.currentTool` y el cálculo de `hasError`;
 * **no** forman parte de `TNodeMetrics`.
 */
export interface TMetricBase {
  startedAt: number | null;
  endedAt: number | null;
  cost: number | null;
  tokens: TTokenUsage | null;
  retryCount: number;
  hasLoop: boolean;
  loopEvidence: string[];
  model: ModelRef | null;
  currentTool: TCurrentTool | null;
  lastAssistantErrored: boolean;
}

/**
 * Estado de carga del detalle de un nodo (data-model §2.2). `'pending'` al
 * construir la estructura (métricas/señales/permisos/formularios aún sin
 * fusionar); `'ready'` cuando el enriquecimiento completó el lote que contiene
 * el nodo. Nunca regresa de `'ready'` a `'pending'` dentro de una misma visita
 * (evita parpadeo); un refetch de datos por evento no lo degrada.
 */
export type TEnrichmentState = 'pending' | 'ready';

export interface TCurrentTool {
  name: string;
  state: string;
}

/**
 * Grupo de agentes que corrieron en paralelo (intervalos de ejecución
 * solapados entre hermanos). Ver `lib/parallelism.ts`.
 */
export interface TParallelGroup {
  id: string;
  /** Sesión padre común a todos los miembros; `null` para raíces. */
  parentId: string | null;
  nodeIds: string[];
  startedAt: number;
  endedAt: number;
}

/** Resumen de paralelismo de un nodo, listo para la vista. */
export interface TNodeParallelism {
  groupId: string;
  /** Cantidad de agentes del grupo, incluido este nodo. */
  size: number;
}

/**
 * Marca de última actividad observada por sesión (FR-009), cacheada en
 * `queryKeys.sessions.activity()`. Estado de vista en caché (TanStack Query),
 * hermana de `sessions.status()`: `[sessionID]` = último instante de actividad
 * (ms), con `max` acumulado (nunca retrocede). Se compone de los eventos en vivo
 * reducidos de forma pura por `reduceActivity`. No se persiste ni se envía al
 * servidor. Ver `contracts/session-activity-contract.md` §1.
 */
export type TActivityMap = Record<string, number>;

export interface TGraphNodeData extends Record<string, unknown> {
  sessionId: string;
  /** Título de la tarea/sesión; reemplaza al agente en el nodo. */
  title: string | null;
  /**
   * `SessionInfo.time.created`: instante de creación de la sesión. Es estable
   * (no depende de que los mensajes hayan cargado) y ordena los niveles de
   * ejecución y las columnas dentro de un nivel.
   */
  createdAt: number | null;
  /**
   * Fin del intervalo de ejecución:
   * `max(SessionInfo.time.idle ?? time.updated ?? 0, activity[sessionId] ?? 0)`.
   * La lista de sesiones es estable y disponible apenas cargan; la marca de
   * actividad (`TActivityMap`, FR-009) mantiene fresco el fin en vivo. Cierra la
   * detección de solapamientos sin depender de los mensajes.
   */
  updatedAt: number | null;
  agentName: string;
  directory: string;
  model: ModelRef | null;
  status: TNodeStatus;
  /**
   * Reintento en curso (FR-018): presente solo cuando `status === 'retrying'`.
   * `next` puede faltar (`null`) si el servidor no lo reporta (edge case).
   */
  retry: { attempt: number; next: number | null } | null;
  /**
   * Motivo de la interrupción (FR-019) cuando `status === 'interrupted'`;
   * `null` → "no disponible" (edge case).
   */
  interruptReason: string | null;
  metrics: TNodeMetrics;
  isRoot: boolean;
  currentTool: TCurrentTool | null;
  /** `null` cuando el nodo no corrió en paralelo con ningún hermano. */
  parallel: TNodeParallelism | null;
  /**
   * Estado de carga del detalle (data-model §2.2). En la fase estructural vale
   * `'pending'`; pasa a `'ready'` cuando el enriquecimiento del nodo fusiona sus
   * métricas/señales/permisos/formularios. Es estado de vista: no participa de
   * la paridad de negocio (FR-007) ni se degrada de `'ready'` a `'pending'`.
   */
  enrichment?: TEnrichmentState;
}

export interface TGraphNode {
  id: string;
  type: 'agent';
  position: { x: number; y: number };
  data: TGraphNodeData;
}

export interface TGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'agent';
}

export interface TGraphModel {
  nodes: TGraphNode[];
  edges: TGraphEdge[];
}

/**
 * Señal de ejecución en vivo por sesión (FR-018/FR-019), cacheada en
 * `queryKeys.sessions.execution(id)`. Se compone de la siembra durable
 * (`getSessionLog`) y de los eventos en vivo reducidos de forma pura por
 * `lib/eventReducer.ts`. Ver `contracts/execution-state-contract.md`.
 */
export interface TExecutionSignal {
  retry: { attempt: number; next: number | null } | null;
  compaction: 'running' | 'completed' | 'failed' | null;
  outcome: 'succeeded' | 'failed' | 'interrupted' | null;
  interruptReason: string | null;
}

/**
 * Tamaño/posición elegidos por el usuario para un nodo, por sesión.
 * Estado de vista local: sin persistencia ni escritura en el servidor.
 */
export interface TNodeSizeOverride {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export const EMPTY_TOKEN_USAGE: TTokenUsage = {
  input: null,
  output: null,
  reasoning: null,
  cacheRead: null,
  cacheWrite: null,
};

export const EMPTY_METRICS: TNodeMetrics = {
  durationMs: null,
  startedAt: null,
  endedAt: null,
  cost: null,
  tokens: null,
  invocations: 0,
  retryCount: 0,
  hasLoop: false,
  loopEvidence: [],
};
