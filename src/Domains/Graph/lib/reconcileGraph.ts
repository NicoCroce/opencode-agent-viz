import type { ModelRef } from '@opencode/client';
import type {
  TCurrentTool,
  TGraphModel,
  TGraphNode,
  TGraphNodeData,
  TNodeMetrics,
  TNodeParallelism,
  TTokenUsage,
} from '../Graph.entity';
import { topologySignature } from './layoutGraph';

/**
 * Identidad estable de nodos y aristas (R4, contrato de render §1.1).
 *
 * `reconcileGraphModel(prev, next)` es una función pura que, dado el modelo
 * anterior y el nuevo, devuelve un `TGraphModel` donde:
 *
 *  1. `prev === null` → devuelve `next` tal cual.
 *  2. Cada nodo se reutiliza (`===`) si existe un nodo en `prev` con el mismo
 *     `id`, la misma `position` y el mismo `data` comparado **campo a campo**
 *     (incluidos `metrics`, `status` y `enrichment`).
 *  3. `edges` es el mismo array de `prev` si `topologySignature(prev)` no
 *     cambia; en caso contrario, el de `next`.
 *  4. El array `nodes` es nuevo si algún nodo difiere; si todos se reutilizan
 *     en el mismo orden, se devuelve `prev.nodes`.
 *
 * No muta `prev` ni `next` (Principio V). Con esto, `AgentNode`/`InvocationEdge`
 * (`React.memo`) solo re-renderizan cuando sus props cambian de verdad.
 */

const sameTokenUsage = (
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

const sameStringArray = (a: readonly string[], b: readonly string[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
};

const sameMetrics = (a: TNodeMetrics, b: TNodeMetrics): boolean =>
  a.durationMs === b.durationMs &&
  a.startedAt === b.startedAt &&
  a.endedAt === b.endedAt &&
  a.cost === b.cost &&
  sameTokenUsage(a.tokens, b.tokens) &&
  a.invocations === b.invocations &&
  a.retryCount === b.retryCount &&
  a.hasLoop === b.hasLoop &&
  sameStringArray(a.loopEvidence, b.loopEvidence);

const sameModel = (a: ModelRef | null, b: ModelRef | null): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.id === b.id && a.providerID === b.providerID && a.variant === b.variant;
};

const sameRetry = (
  a: TGraphNodeData['retry'],
  b: TGraphNodeData['retry'],
): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.attempt === b.attempt && a.next === b.next;
};

const sameCurrentTool = (
  a: TCurrentTool | null,
  b: TCurrentTool | null,
): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.name === b.name && a.state === b.state;
};

const sameParallel = (
  a: TNodeParallelism | null,
  b: TNodeParallelism | null,
): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.groupId === b.groupId && a.size === b.size;
};

/** Compara `TGraphNodeData` campo a campo (contrato de render §1.1, garantía 2). */
const sameNodeData = (a: TGraphNodeData, b: TGraphNodeData): boolean =>
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
    a.enrichment === b.enrichment);

const sameNode = (a: TGraphNode, b: TGraphNode): boolean =>
  a === b ||
  (a.id === b.id &&
    a.type === b.type &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    sameNodeData(a.data, b.data));

export const reconcileGraphModel = (
  prev: TGraphModel | null,
  next: TGraphModel,
): TGraphModel => {
  if (prev === null) {
    return next;
  }

  const prevById = new Map<string, TGraphNode>();
  for (const node of prev.nodes) {
    prevById.set(node.id, node);
  }

  let allReused = prev.nodes.length === next.nodes.length;
  const nodes = next.nodes.map((node, index) => {
    const previous = prevById.get(node.id);
    if (previous !== undefined && sameNode(previous, node)) {
      if (prev.nodes[index] !== previous) {
        allReused = false;
      }
      return previous;
    }
    allReused = false;
    return node;
  });

  const edges =
    topologySignature(prev) === topologySignature(next)
      ? prev.edges
      : next.edges;

  return {
    nodes: allReused ? prev.nodes : nodes,
    edges,
  };
};
