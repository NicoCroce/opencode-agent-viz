import type { ModelRef } from '@opencode/client';
import type {
  TContextBreakdown,
  TContextBucket,
  TContextCompaction,
  TContextGrowthPoint,
  TContextWindow,
  TCurrentTool,
  TGraphNode,
  TGraphNodeData,
  TLatencyAnomaly,
  TLatencyReport,
  TLatencySample,
  TNodeContextMetrics,
  TNodeEffort,
  TNodeMetrics,
  TNodeParallelism,
  TNodeSpeedup,
  TTokenUsage,
} from '../../Graph.entity';

/**
 * Comparadores de valor campo a campo usados por `reconcileGraphModel`
 * (contrato de render §1.1, garantía 2).
 */

export const sameTokenUsage = (
  a: TTokenUsage | null,
  b: TTokenUsage | null,
): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return (
    a.input === b.input &&
    a.output === b.output &&
    a.reasoning === b.reasoning &&
    a.cacheRead === b.cacheRead &&
    a.cacheWrite === b.cacheWrite
  );
};

export const sameStringArray = (
  a: readonly string[],
  b: readonly string[],
): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
};

export const sameMetrics = (a: TNodeMetrics, b: TNodeMetrics): boolean =>
  a.durationMs === b.durationMs &&
  a.startedAt === b.startedAt &&
  a.endedAt === b.endedAt &&
  a.cost === b.cost &&
  sameTokenUsage(a.tokens, b.tokens) &&
  a.invocations === b.invocations &&
  a.retryCount === b.retryCount &&
  a.hasLoop === b.hasLoop &&
  sameStringArray(a.loopEvidence, b.loopEvidence);

export const sameModel = (a: ModelRef | null, b: ModelRef | null): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.id === b.id && a.providerID === b.providerID && a.variant === b.variant;
};

export const sameRetry = (
  a: TGraphNodeData['retry'],
  b: TGraphNodeData['retry'],
): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.attempt === b.attempt && a.next === b.next;
};

export const sameCurrentTool = (
  a: TCurrentTool | null,
  b: TCurrentTool | null,
): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.name === b.name && a.state === b.state;
};

export const sameParallel = (
  a: TNodeParallelism | null,
  b: TNodeParallelism | null,
): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.groupId === b.groupId && a.size === b.size;
};

/**
 * Compara el nivel de esfuerzo de vista (effort-contract §4; data-model §2.1).
 * `effort` es opcional: `undefined` y `null` equivalen a "sin esfuerzo" y el
 * paso de ausente a presente se detecta como cambio. Sin este comparador,
 * `reconcileGraphModel` no reemplazaría el nodo y el medidor quedaría congelado.
 */
export const sameEffort = (
  a: TNodeEffort | null | undefined,
  b: TNodeEffort | null | undefined,
): boolean => {
  if (a === b) return true;
  const effortA = a ?? null;
  const effortB = b ?? null;
  if (effortA === null || effortB === null) return effortA === effortB;
  return (
    effortA.level === effortB.level &&
    effortA.provisional === effortB.provisional &&
    sameStringArray(effortA.reasons, effortB.reasons)
  );
};

const sameContextBucket = (a: TContextBucket, b: TContextBucket): boolean =>
  a.category === b.category &&
  a.chars === b.chars &&
  a.tokens === b.tokens &&
  a.pct === b.pct;

const sameBreakdown = (a: TContextBreakdown, b: TContextBreakdown): boolean =>
  a === b ||
  (a.chars === b.chars &&
    a.windowTokens === b.windowTokens &&
    a.hasTokens === b.hasTokens &&
    a.buckets.length === b.buckets.length &&
    a.buckets.every((bucket, index) =>
      sameContextBucket(bucket, b.buckets[index]),
    ));

const sameContextWindow = (a: TContextWindow, b: TContextWindow): boolean =>
  a === b ||
  (a.windowTokens === b.windowTokens &&
    a.cacheRead === b.cacheRead &&
    a.cacheWrite === b.cacheWrite &&
    a.hitRate === b.hitRate &&
    a.costPerKToken === b.costPerKToken);

const sameLatencySample = (a: TLatencySample, b: TLatencySample): boolean =>
  a.stepId === b.stepId &&
  a.startedAt === b.startedAt &&
  a.generationMs === b.generationMs &&
  a.totalMs === b.totalMs;

const sameLatencyAnomaly = (a: TLatencyAnomaly, b: TLatencyAnomaly): boolean =>
  a.stepId === b.stepId &&
  a.ratio === b.ratio &&
  a.direction === b.direction &&
  a.referenceMs === b.referenceMs &&
  a.reference === b.reference;

const sameLatency = (
  a: TLatencyReport | null | undefined,
  b: TLatencyReport | null | undefined,
): boolean => {
  if (a === b) return true;
  const latencyA = a ?? null;
  const latencyB = b ?? null;
  if (latencyA === null || latencyB === null) return latencyA === latencyB;
  return (
    latencyA.medianMs === latencyB.medianMs &&
    latencyA.reference === latencyB.reference &&
    latencyA.samples.length === latencyB.samples.length &&
    latencyA.samples.every((sample, index) =>
      sameLatencySample(sample, latencyB.samples[index]),
    ) &&
    latencyA.anomalies.length === latencyB.anomalies.length &&
    latencyA.anomalies.every((anomaly, index) =>
      sameLatencyAnomaly(anomaly, latencyB.anomalies[index]),
    )
  );
};

/**
 * Compara la evolución del contexto por paso (FR-016). Opcional: `undefined` y
 * `[]` equivalen a "sin pasos" para que el modelo estructural no fuerce el campo.
 */
const sameGrowth = (
  a: readonly TContextGrowthPoint[] | undefined,
  b: readonly TContextGrowthPoint[] | undefined,
): boolean => {
  const growthA = a ?? [];
  const growthB = b ?? [];
  if (growthA === growthB) return true;
  return (
    growthA.length === growthB.length &&
    growthA.every(
      (point, index) =>
        point.stepId === growthB[index].stepId &&
        point.startedAt === growthB[index].startedAt &&
        point.windowTokens === growthB[index].windowTokens,
    )
  );
};

/** Compara las compactaciones observadas (FR-016); `undefined` ≡ `[]`. */
const sameCompactions = (
  a: readonly TContextCompaction[] | undefined,
  b: readonly TContextCompaction[] | undefined,
): boolean => {
  const compactionsA = a ?? [];
  const compactionsB = b ?? [];
  if (compactionsA === compactionsB) return true;
  return (
    compactionsA.length === compactionsB.length &&
    compactionsA.every(
      (compaction, index) =>
        compaction.id === compactionsB[index].id &&
        compaction.at === compactionsB[index].at &&
        compaction.status === compactionsB[index].status &&
        compaction.reason === compactionsB[index].reason,
    )
  );
};

/**
 * Compara las métricas de contexto de un nodo (data-model §7). `context` es
 * opcional (`undefined` y `null` equivalen a "sin contexto") y el paso de
 * ausente a presente se detecta como cambio; sin este comparador el panel de
 * contexto quedaría congelado.
 */
export const sameContext = (
  a: TNodeContextMetrics | null | undefined,
  b: TNodeContextMetrics | null | undefined,
): boolean => {
  if (a === b) return true;
  const contextA = a ?? null;
  const contextB = b ?? null;
  if (contextA === null || contextB === null) return contextA === contextB;
  return (
    contextA.provisional === contextB.provisional &&
    sameBreakdown(contextA.breakdown, contextB.breakdown) &&
    sameContextWindow(contextA.window, contextB.window) &&
    sameGrowth(contextA.growth, contextB.growth) &&
    sameCompactions(contextA.compactions, contextB.compactions) &&
    sameLatency(contextA.latency, contextB.latency)
  );
};

/**
 * Compara la aceleración de paralelismo de un nodo (data-model §7). Opcional
 * (`undefined`/`null` = sin grupo); el paso de ausente a presente se detecta.
 */
export const sameSpeedup = (
  a: TNodeSpeedup | null | undefined,
  b: TNodeSpeedup | null | undefined,
): boolean => {
  if (a === b) return true;
  const speedupA = a ?? null;
  const speedupB = b ?? null;
  if (speedupA === null || speedupB === null) return speedupA === speedupB;
  return (
    speedupA.groupId === speedupB.groupId &&
    speedupA.size === speedupB.size &&
    speedupA.serialMs === speedupB.serialMs &&
    speedupA.wallMs === speedupB.wallMs &&
    speedupA.speedup === speedupB.speedup &&
    speedupA.efficiency === speedupB.efficiency &&
    speedupA.provisional === speedupB.provisional
  );
};

/** Compara `TGraphNodeData` campo a campo (contrato de render §1.1, garantía 2). */
export const sameNodeData = (a: TGraphNodeData, b: TGraphNodeData): boolean =>
  a === b ||
  (a.sessionId === b.sessionId &&
    a.title === b.title &&
    a.createdAt === b.createdAt &&
    a.updatedAt === b.updatedAt &&
    a.agentName === b.agentName &&
    a.directory === b.directory &&
    sameModel(a.model, b.model) &&
    a.status === b.status &&
    sameRetry(a.retry, b.retry) &&
    a.interruptReason === b.interruptReason &&
    sameMetrics(a.metrics, b.metrics) &&
    a.isRoot === b.isRoot &&
    sameCurrentTool(a.currentTool, b.currentTool) &&
    sameParallel(a.parallel, b.parallel) &&
    sameEffort(a.effort, b.effort) &&
    sameContext(a.context, b.context) &&
    sameSpeedup(a.speedup, b.speedup) &&
    a.enrichment === b.enrichment);

export const sameNode = (a: TGraphNode, b: TGraphNode): boolean =>
  a === b ||
  (a.id === b.id &&
    a.type === b.type &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    sameNodeData(a.data, b.data));
