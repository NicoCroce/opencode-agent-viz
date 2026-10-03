import type { SessionInfo, SessionStatus } from '@opencode/client';
import type { TGraphModel, TNodeMetrics, TTokenUsage } from '../Graph.entity';
import type { TResourceUsage, TSessionSummary } from '../../Inspector/Inspector.entity';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';

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

export const deriveMetrics = ({
  messages,
  status,
  subtaskInvocations = 0,
  now,
}: DeriveMetricsInput): TNodeMetrics => {
  let startedAt: number | null = null;
  let endedAt: number | null = null;
  let cost = 0;
  let sawCost = false;

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

  let retryCount = 0;
  const loopEvidence: string[] = [];

  for (const { info } of messages) {
    if (info.type !== 'assistant') continue;

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
  }

  if (status?.type === 'retry') {
    retryCount += Math.max(status.attempt, 1);
    loopEvidence.push(status.message);
  }

  const durationMs = startedAt === null ? null : (endedAt ?? now) - startedAt;

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
    durationMs,
    startedAt,
    endedAt,
    cost: sawCost ? cost : null,
    tokens,
    invocations: subtaskInvocations,
    retryCount,
    hasLoop: retryCount > 0,
    loopEvidence,
  };
};

const sumNullable = (values: (number | null)[]): number | null => {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((total, v) => total + v, 0);
};

export const summarizeSession = (
  root: SessionInfo,
  graph: TGraphModel,
  resourceUsage: TResourceUsage,
): TSessionSummary => {
  const nodes = graph.nodes;

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
    runningCount: nodes.filter((n) => n.data.status === 'running').length,
    waitingCount: nodes.filter((n) => n.data.status === 'waiting').length,
    errorCount: nodes.filter((n) => n.data.status === 'error').length,
    loopCount: nodes.filter((n) => n.data.metrics.hasLoop).length,
    agentInvocations,
    resourceUsage,
  };
};
