/**
 * Tipos del dominio Efficiency (data-model.md §1–§3).
 *
 * El motor puro recibe mensajes de sesión y metadatos del grafo y devuelve un
 * informe inmutable. Todos los tipos propios llevan prefijo `T`; los del SDK se
 * importan con `import type` y nunca se redefinen (Principio IV).
 */
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';

// ---------------------------------------------------------------------------
// Entrada (§1)
// ---------------------------------------------------------------------------

export type TEfficiencySessionStatus = 'active' | 'idle';

export interface TEfficiencySessionMeta {
  /** Sesión padre en el subárbol; ausente en la raíz. */
  parentID?: string;
  /** `active` si el nodo está en curso (running/retrying/compacting/waiting). */
  status?: TEfficiencySessionStatus;
}

export interface TEfficiencyInput {
  rootSessionId: string;
  /** Solo las sesiones con mensajes cargados; una clave ausente = no cargada. */
  messagesBySession: Record<string, TSessionMessage[]>;
  /** Raíz + subárbol, con o sin mensajes; el motor detecta las ausencias. */
  sessions: Record<string, TEfficiencySessionMeta>;
  /**
   * El grafo declara el subárbol truncado: el motor lo trata como parcial para
   * la confianza, sin inventar sesiones ausentes.
   */
  truncated?: boolean;
  /** Reloj inyectado; solo se usa para la duración del turno abierto. */
  now?: number;
}

// ---------------------------------------------------------------------------
// Salida (§2)
// ---------------------------------------------------------------------------

export type TDimensionKey = 'entrada' | 'ejecucion' | 'contexto' | 'resultado';

export type TEfficiencyStatus = 'ok' | 'in_progress' | 'insufficient' | 'no_data';

export type TBand = 'eficiente' | 'aceptable' | 'mejorable' | 'friccion';

export type TConfidence = 'alta' | 'media' | 'baja';

export type TSeverity = 'alta' | 'media' | 'baja';

export type TRuleId =
  | 'INP-1'
  | 'INP-2'
  | 'INP-3'
  | 'INP-4'
  | 'RES-1'
  | 'RES-2'
  | 'RES-3'
  | 'RES-4'
  | 'RES-5'
  | 'RES-6';

export type TIndicatorKey =
  | 'INP-1'
  | 'INP-2'
  | 'INP-3'
  | 'RES-1'
  | 'RES-2'
  | 'RES-3'
  | 'RES-4'
  | 'CACHE'
  | 'OUTCOME'
  | 'OPEN_ERRORS';

export interface TIndicatorResult {
  key: TIndicatorKey;
  /** Proporción observada; para OUTCOME es la pérdida (1 − valor). */
  ratio: number;
  /** Tope de tolerancia (o 1 para OUTCOME/OPEN_ERRORS). */
  cap: number;
  /** Aporte 0–1 (para CACHE es calidad, no fricción). */
  score: number;
  /** Tamaño de muestra observado. */
  count: number;
  /** Mínimo de muestra exigido; 0 = sin mínimo. */
  minimum: number;
}

export interface TDimensionResult {
  key: TDimensionKey;
  /** Peso completo de la dimensión: 30/30/15/25. */
  weight: number;
  /** Valor 0–100; null si la dimensión se omite. */
  value: number | null;
  available: boolean;
  indicators: TIndicatorResult[];
}

export interface TEfficiencyTotals {
  /** Suma de `assistant.cost`; `null` si no se reportó. */
  cost: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  /** Raíz: input + cache.read + cache.write del último assistant con tokens. */
  windowTokens: number | null;
  /** Tools completadas de todo el subárbol. */
  latencyP95Ms: number | null;
  /** Tools con duración > 60 000 ms. */
  slowToolCalls: number;
  /** Compactaciones completadas (auto + manual). */
  compactions: number;
  /** Assistants con reintento. */
  retries: number;
  toolErrors: number;
  toolCalls: number;
}

/**
 * Subconjunto estructural de `TNodeMetrics` (`summary.metrics`) para el
 * contraste de totales en el overlay. El dominio no importa Graph ni Inspector.
 */
export interface TEfficiencyReference {
  cost: number | null;
  tokens: {
    input: number | null;
    output: number | null;
    cacheRead: number | null;
    cacheWrite: number | null;
  } | null;
}

export interface TTurnAnalysis {
  /** 1-based, cronológico. */
  index: number;
  userMessageId: string;
  /** `user.time.created`. */
  at: number;
  /** Texto completo; la vista recorta a 120 code points. */
  prompt: string;
  /** Tokens de palabra (incluye stopwords). */
  promptTokens: number;
  closed: boolean;
  outcome: 'succeeded' | 'failed' | 'interrupted' | null;
  /** Tools question/form de la raíz en la ventana. */
  clarifications: number;
  /** Assistants de raíz + subárbol en la ventana. */
  steps: number;
  toolCalls: number;
  toolErrors: number;
  retries: number;
  cost: number | null;
  durationMs: number | null;
  /** Reglas con evidencia en este turno. */
  signals: TRuleId[];
}

export interface TEvidence {
  sessionId: string;
  messageId?: string;
  toolId?: string;
  formId?: string;
  at?: number;
  turnIndex?: number;
}

export interface TFinding {
  ruleId: TRuleId;
  severity: TSeverity;
  dimension: TDimensionKey | null;
  penalizes: boolean;
  evidence: TEvidence;
  /** Cita completa con ancla y texto; la vista recorta a 120 code points. */
  quote: string;
  /** Condición medida en lenguaje neutral. */
  condition: string;
  recommendation: string;
}

export interface TFactor {
  key: TIndicatorKey;
  dimension: TDimensionKey;
  label: string;
  count: number;
  kind: 'resta' | 'suma';
}

export interface TOmission {
  key: TDimensionKey;
  weight: number;
  reason: string;
  indicator?: TIndicatorKey;
  count?: number;
  minimum?: number;
}

export interface TEfficiencyReport {
  status: TEfficiencyStatus;
  /** Entero 0–100; `null` si no se puede puntuar. */
  score: number | null;
  /** `null` si `score === null`. */
  band: TBand | null;
  /** 0–100 (puntos de peso disponibles). */
  coverage: number;
  /** `null` solo en `no_data`. */
  confidence: TConfidence | null;
  dimensions: TDimensionResult[];
  /** Solo penalizantes, máx. 10. */
  findings: TFinding[];
  /** No penalizan. */
  weakSignals: TFinding[];
  turns: TTurnAnalysis[];
  totals: TEfficiencyTotals;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Hook (§3)
// ---------------------------------------------------------------------------

export interface TUseSessionEfficiencyParams {
  rootSessionId: string | null;
  sessions: Record<string, TEfficiencySessionMeta>;
  /** `node.data.enrichment === 'ready'` del nodo raíz. */
  rootReady: boolean;
  /** El grafo declara el subárbol truncado. */
  truncated?: boolean;
  /** Error estructural del grafo (`graph.isError`). */
  graphError?: boolean;
  /** `openedAt` fijo del panel; solo para el turno abierto. */
  now?: number;
  /** El panel está abierto; con false no se observa la caché. */
  enabled: boolean;
}

export interface TSessionEfficiencyResult {
  report: TEfficiencyReport | null;
  isLoading: boolean;
  isError: boolean;
  isPartial: boolean;
  missingSessionIds: string[];
}
