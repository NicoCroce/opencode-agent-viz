import type { ModelRef } from '@opencode/client';
import type {
  TCurrentTool,
  TGraphNode,
  TGraphNodeData,
  TNodeEffort,
  TNodeMetrics,
  TNodeParallelism,
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
    a.enrichment === b.enrichment);

export const sameNode = (a: TGraphNode, b: TGraphNode): boolean =>
  a === b ||
  (a.id === b.id &&
    a.type === b.type &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    sameNodeData(a.data, b.data));
