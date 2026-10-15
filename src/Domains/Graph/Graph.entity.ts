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
 * Nivel de esfuerzo de vista de un nodo (FR-021..FR-028; data-model §2.1).
 * Escala acumulativa 1..5 derivada de forma pura por `deriveEffortByNode`
 * (`lib/effort/deriveEffort.ts`): paralelismo, duración relativa a su línea y
 * forma (hijos/invocaciones). `provisional` mientras la línea tenga algún nodo
 * activo (los tiempos no están cerrados). **Solo lectura** (FR-027): no es
 * editable ni interactivo. Se adjunta en el memo final de `useGraphModel`.
 */
export interface TNodeEffort {
  level: 1 | 2 | 3 | 4 | 5;
  provisional: boolean;
  /** Motivos legibles; alimentan la descripción accesible (FR-026). */
  reasons: string[];
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

/**
 * Categorías de contenido que componen el contexto de un agente (FR-001;
 * `contracts/context-metrics-contract.md` §1). Cada una agrupa un tipo de parte
 * de los mensajes; el total se reparte por peso de caracteres (research R2).
 */
export type TContextCategory =
  | 'toolResult'
  | 'toolInput'
  | 'reasoning'
  | 'assistantText'
  | 'userText';

/** Una categoría del desglose de contexto con su peso y su porción (FR-004). */
export interface TContextBucket {
  category: TContextCategory;
  chars: number;
  /** Tokens atribuidos; `null` cuando no hay ventana medible (FR-005). */
  tokens: number | null;
  /** Porcentaje sobre el total; los buckets suman 100% (FR-002, SC-002). */
  pct: number;
}

/** Desglose del contexto de un agente en categorías (FR-001..FR-005). */
export interface TContextBreakdown {
  /** Ordenados por `chars` descendente. */
  buckets: TContextBucket[];
  chars: number;
  /** Tokens del último paso (`input + cacheRead + cacheWrite`); research R1. */
  windowTokens: number | null;
  hasTokens: boolean;
}

/** Ventana de contexto y uso de caché de un agente (FR-016). */
export interface TContextWindow {
  windowTokens: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  /** `cacheRead / (cacheRead + input)`; `null` sin denominador. */
  hitRate: number | null;
  /** `cost / (windowTokens / 1000)`; `null` sin datos. */
  costPerKToken: number | null;
}

/** Un paso de la evolución del contexto de un agente (FR-016). */
export interface TContextGrowthPoint {
  stepId: string;
  startedAt: number;
  /** Tokens de la ventana del paso (`input + cache.read + cache.write`). */
  windowTokens: number;
}

/** Estado real de un episodio de compactación (FR-016). */
export type TContextCompactionStatus = 'running' | 'completed' | 'failed';

/** Motivo de un episodio de compactación (FR-016). */
export type TContextCompactionReason = 'auto' | 'manual';

/** Compactación observada en la sesión del agente (FR-016). */
export interface TContextCompaction {
  id: string;
  /** `SessionMessageCompaction.time.created`. */
  at: number;
  status: TContextCompactionStatus;
  reason: TContextCompactionReason;
}

/** Efecto de una compactación sobre la ventana de contexto (FR-016). */
export interface TCompactionEffect {
  /** Ventana del último paso medido antes de la compactación; `null` si no hay. */
  before: number | null;
  /** Ventana del primer paso medido después; `null` si no hay. */
  after: number | null;
}

/** Una respuesta del agente medida en el tiempo (FR-018). */
export interface TLatencySample {
  stepId: string;
  startedAt: number;
  /**
   * Tiempo de generación del modelo (`streamed − created`): `streamed` es el
   * fin del stream, no el primer token. `null` sin datos.
   */
  generationMs: number | null;
  /** Latencia total (`completed − created`); `null` sin datos. */
  totalMs: number | null;
}

/** Desviación de una respuesta respecto de su referencia (FR-021). */
export interface TLatencyAnomaly {
  stepId: string;
  ratio: number;
  /** `slow` = más lenta que la banda; `fast` = más rápida (rapidez anómala). */
  direction: 'slow' | 'fast';
  referenceMs: number;
  reference: 'node' | 'agent';
}

/** Serie de latencia de un agente con su referencia y anomalías (FR-018..FR-023). */
export interface TLatencyReport {
  samples: TLatencySample[];
  medianMs: number | null;
  reference: 'node' | 'agent' | null;
  anomalies: TLatencyAnomaly[];
}

/**
 * Agregado de métricas de contexto de un nodo (data-model §3.1). Se puebla en
 * el enriquecimiento (research R3); `latency` es opcional para que US1/US4
 * puedan entregar sin ella (research R5/US5).
 */
export interface TNodeContextMetrics {
  breakdown: TContextBreakdown;
  window: TContextWindow;
  /** Evolución del contexto por paso (FR-016); `[]` sin pasos medibles. */
  growth?: TContextGrowthPoint[];
  /** Compactaciones observadas en la sesión (FR-016); `[]` sin ninguna. */
  compactions?: TContextCompaction[];
  latency?: TLatencyReport | null;
  /** `true` mientras el nodo está activo (los tiempos no están cerrados). */
  provisional: boolean;
}

/** Aceleración de un grupo de agentes que corrieron en paralelo (FR-006/FR-007). */
export interface TGroupSpeedup {
  groupId: string;
  size: number;
  /** Tiempo teórico en serie (`Σ duración`); `null` si falta alguna duración. */
  serialMs: number | null;
  /** Tiempo real de pared del grupo (`endedAt − startedAt`). */
  wallMs: number;
  /** `serialMs / wallMs`; `null` si `wallMs ≤ 0`. */
  speedup: number | null;
  /** `speedup / size`; `null` si `speedup` es `null`. */
  efficiency: number | null;
  provisional: boolean;
}

/** Resumen de aceleración de un nodo para el badge y el detalle (FR-009). */
export interface TNodeSpeedup {
  groupId: string;
  size: number;
  /** Tiempo teórico en serie del grupo (`Σ duración`); `null` si falta alguna. */
  serialMs: number | null;
  /** Tiempo real de pared del grupo (`endedAt − startedAt`). */
  wallMs: number;
  speedup: number | null;
  efficiency: number | null;
  provisional: boolean;
}

/**
 * Aporte del resultado de un nodo hijo al contexto de su agente padre
 * (data-model §6.1; FR-012/FR-013). Se calcula **bajo demanda** en el hook del
 * Inspector (research R5), no viaja en el modelo del grafo.
 */
export interface TParentImpact {
  parentId: string;
  /** Caracteres del resultado del hijo inyectados en el padre. */
  addedChars: number;
  addedTokens: number | null;
  /** Porcentaje que representa sobre el contexto total del padre. */
  pctOfParent: number | null;
}

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
   * Nivel de esfuerzo de vista (data-model §2.1; FR-021). `undefined` hasta que
   * el memo final de `useGraphModel` lo deriva; entra en `sameNodeData` vía
   * `sameEffort` (contract effort §4). Opcional (como `enrichment?`) para no
   * forzar su inicialización en el modelo estructural.
   */
  effort?: TNodeEffort | null;
  /**
   * Métricas de contexto del agente (data-model §3.1; FR-001, FR-015): desglose,
   * ventana/caché y, cuando US5 la puebla, latencia. `undefined` hasta que el
   * enriquecimiento la deriva; entra en `sameNodeData` vía `sameContext`.
   */
  context?: TNodeContextMetrics | null;
  /**
   * Aceleración del grupo de paralelismo del nodo (data-model §4.2; FR-009).
   * `undefined`/`null` cuando el nodo no corrió en paralelo con hermanos; entra
   * en `sameNodeData` vía `sameSpeedup`.
   */
  speedup?: TNodeSpeedup | null;
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
