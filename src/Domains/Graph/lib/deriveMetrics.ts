import type { ModelRef, SessionInfo, SessionStatus } from '@opencode/client';
import type {
  TCurrentTool,
  TGraphModel,
  TMetricBase,
  TNodeMetrics,
  TNodeStatus,
  TTokenUsage,
} from '../Graph.entity';
import type { TResourceUsage, TSessionSummary } from '../../Inspector/Inspector.entity';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { isActiveStatus } from './nodeStatus';

export type TSessionMessageLike = TSessionMessage;

export interface DeriveMetricsInput {
  messages: TSessionMessageLike[];
  status?: SessionStatus;
  subtaskInvocations?: number;
  now: number;
}

interface TokenAccumulator {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
}

interface TokenSeen {
  input: boolean;
  output: boolean;
  reasoning: boolean;
  cacheRead: boolean;
  cacheWrite: boolean;
}

interface SdkTokens {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
}

const accumulateTokens = (
  tokens: SdkTokens,
  acc: TokenAccumulator,
  seen: TokenSeen,
): void => {
  acc.input += tokens.input;
  acc.output += tokens.output;
  acc.reasoning += tokens.reasoning;
  acc.cacheRead += tokens.cache.read;
  acc.cacheWrite += tokens.cache.write;
  seen.input = true;
  seen.output = true;
  seen.reasoning = true;
  seen.cacheRead = true;
  seen.cacheWrite = true;
};

/**
 * Deriva la base de métricas de una sesión **sin depender del reloj** (R3):
 * recorre `messages` una sola vez y expone `startedAt`/`endedAt`/`cost`/`tokens`/
 * `retryCount`/`hasLoop`/`loopEvidence` y, reutilizando el mismo recorrido,
 * `model`, `currentTool` y `lastAssistantErrored`. No calcula `durationMs`
 * (eso depende de `now` y lo resuelve `resolveMetrics`).
 */
export const deriveMetricBase = (
  messages: TSessionMessageLike[],
): TMetricBase => {
  let startedAt: number | null = null;
  let endedAt: number | null = null;
  let cost = 0;
  let sawCost = false;
  let retryCount = 0;
  const loopEvidence: string[] = [];
  let model: ModelRef | null = null;
  let sawAssistant = false;
  let currentTool: TCurrentTool | null = null;
  let lastAssistantErrored = false;

  const acc: TokenAccumulator = {
    input: 0,
    output: 0,
    reasoning: 0,
    cacheRead: 0,
    cacheWrite: 0,
  };
  const seen: TokenSeen = {
    input: false,
    output: false,
    reasoning: false,
    cacheRead: false,
    cacheWrite: false,
  };

  for (const { info, parts } of messages) {
    // El último tool de la sesión gana (mismo recorrido que `buildGraph`).
    for (const part of parts) {
      if (part.type === 'tool') {
        currentTool = { name: part.name, state: part.state.status };
      }
    }

    if (info.type !== 'assistant') continue;

    // La primera respuesta assistant aporta el `model` (como `resolveModel`).
    if (!sawAssistant) {
      model = info.model;
      sawAssistant = true;
    }

    const { created, completed } = info.time;
    if (startedAt === null || created < startedAt) startedAt = created;
    if (completed !== undefined && (endedAt === null || completed > endedAt)) {
      endedAt = completed;
    }
    if (info.cost !== undefined) {
      cost += info.cost;
      sawCost = true;
    }
    if (info.tokens) accumulateTokens(info.tokens, acc, seen);

    // V2 no tiene una parte `retry`: el reintento vive en
    // `SessionMessageAssistant.retry` sobre el propio mensaje.
    if (info.retry) {
      retryCount += 1;
      loopEvidence.push(info.retry.error.message);
    }

    // `lastAssistantErrored` mira la ÚLTIMA respuesta assistant (FR-020): su
    // propio `error` o un tool fallido dentro de ese mismo mensaje.
    lastAssistantErrored = info.error
      ? true
      : parts.some((p) => p.type === 'tool' && p.state.status === 'error');
  }

  const hasTokens =
    seen.input ||
    seen.output ||
    seen.reasoning ||
    seen.cacheRead ||
    seen.cacheWrite;

  const tokens: TTokenUsage | null = hasTokens
    ? {
        input: seen.input ? acc.input : null,
        output: seen.output ? acc.output : null,
        reasoning: seen.reasoning ? acc.reasoning : null,
        cacheRead: seen.cacheRead ? acc.cacheRead : null,
        cacheWrite: seen.cacheWrite ? acc.cacheWrite : null,
      }
    : null;

  return {
    startedAt,
    endedAt,
    cost: sawCost ? cost : null,
    tokens,
    retryCount,
    hasLoop: retryCount > 0,
    loopEvidence,
    model,
    currentTool,
    lastAssistantErrored,
  };
};

/**
 * Resuelve el `TNodeMetrics` completo a partir de la base memoizada (R3):
 * solo `durationMs = (endedAt ?? now) - startedAt` depende del reloj, más el
 * `retry` del `status` y las invocaciones del subárbol. O(1) por nodo y tick.
 */
export const resolveMetrics = (
  base: TMetricBase,
  status: SessionStatus | undefined,
  now: number,
  subtaskInvocations: number,
): TNodeMetrics => {
  const retryCount =
    status?.type === 'retry'
      ? base.retryCount + Math.max(status.attempt, 1)
      : base.retryCount;
  const loopEvidence =
    status?.type === 'retry'
      ? [...base.loopEvidence, status.message]
      : base.loopEvidence;

  const durationMs =
    base.startedAt === null ? null : (base.endedAt ?? now) - base.startedAt;

  return {
    durationMs,
    startedAt: base.startedAt,
    endedAt: base.endedAt,
    cost: base.cost,
    tokens: base.tokens,
    invocations: subtaskInvocations,
    retryCount,
    hasLoop: retryCount > 0,
    loopEvidence,
  };
};

/**
 * Envoltorio de objeto equivalente `{ messages, status, subtaskInvocations, now }`
 * (firma que ya usa `buildGraph`): compone `deriveMetricBase` + `resolveMetrics`
 * sin cambiar a ningún consumidor (Principio V, R3).
 */
export const deriveMetrics = ({
  messages,
  status,
  subtaskInvocations = 0,
  now,
}: DeriveMetricsInput): TNodeMetrics =>
  resolveMetrics(deriveMetricBase(messages), status, now, subtaskInvocations);

const sumNullable = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((total, v) => total + v, 0);
};

export const summarizeSession = (
  root: SessionInfo,
  graph: TGraphModel,
  resourceUsage: TResourceUsage,
  now: number,
): TSessionSummary => {
  const nodes = graph.nodes;
  const statuses = nodes.map((n) => n.data.status);
  const countStatus = (status: TNodeStatus): number =>
    statuses.filter((candidate) => candidate === status).length;

  const durationMs = sumNullable(nodes.map((n) => n.data.metrics.durationMs));
  const cost = sumNullable(nodes.map((n) => n.data.metrics.cost));

  const tokenValues = nodes.map((n) => n.data.metrics.tokens);
  const tokenField = (
    pick: (t: TTokenUsage) => number | null,
  ): number | null =>
    sumNullable(tokenValues.map((t) => (t === null ? null : pick(t))));

  const tokens: TTokenUsage | null =
    tokenValues.some((t) => t !== null)
      ? {
          input: tokenField((t) => t.input),
          output: tokenField((t) => t.output),
          reasoning: tokenField((t) => t.reasoning),
          cacheRead: tokenField((t) => t.cacheRead),
          cacheWrite: tokenField((t) => t.cacheWrite),
        }
      : null;

  const startValues = nodes
    .map((n) => n.data.metrics.startedAt)
    .filter((v): v is number => v !== null);
  const endValues = nodes
    .map((n) => n.data.metrics.endedAt)
    .filter((v): v is number => v !== null);

  // Tiempo transcurrido de la sesión (FR-026): del primer inicio al último fin;
  // mientras algún agente siga activo (corre, reintenta, compacta o espera), el
  // fin es `now` para que la barra avance en vivo sin relayoutar (FR-027).
  const sessionActive = statuses.some(isActiveStatus);
  const elapsedMs =
    startValues.length === 0
      ? null
      : (sessionActive || endValues.length === 0
          ? now
          : Math.max(...endValues)) - Math.min(...startValues);

  const agentInvocations: Record<string, number> = {};
  for (const node of nodes) {
    const name = node.data.agentName;
    agentInvocations[name] = (agentInvocations[name] ?? 0) + 1;
  }

  const loopEvidence = nodes.flatMap((n) => n.data.metrics.loopEvidence);

  const metrics: TNodeMetrics = {
    durationMs,
    startedAt: startValues.length > 0 ? Math.min(...startValues) : null,
    endedAt: endValues.length > 0 ? Math.max(...endValues) : null,
    cost,
    tokens,
    invocations: nodes.reduce(
      (total, n) => total + n.data.metrics.invocations,
      0,
    ),
    retryCount: nodes.reduce((total, n) => total + n.data.metrics.retryCount, 0),
    hasLoop: nodes.some((n) => n.data.metrics.hasLoop),
    loopEvidence,
  };

  return {
    rootSessionId: root.id,
    metrics,
    agentCount: nodes.length,
    subagentCount: nodes.filter((n) => !n.data.isRoot).length,
    createdCount: countStatus('created'),
    runningCount: countStatus('running'),
    retryingCount: countStatus('retrying'),
    compactingCount: countStatus('compacting'),
    // Las dos esperas (permiso y respuesta) se agrupan en un solo contador
    // (FR-024); se distinguen entre sí en el detalle del agente.
    waitingCount: countStatus('waiting-permission') + countStatus('waiting-input'),
    succeededCount: countStatus('succeeded'),
    // `errorCount` cuenta solo `failed`: una interrupción no es un fallo
    // propio y se reporta por separado (FR-019).
    errorCount: countStatus('failed'),
    interruptedCount: countStatus('interrupted'),
    loopCount: nodes.filter((n) => n.data.metrics.hasLoop).length,
    agentInvocations,
    resourceUsage,
    elapsedMs,
  };
};
