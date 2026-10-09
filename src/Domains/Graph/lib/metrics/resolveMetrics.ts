import type { SessionStatus } from '@opencode/client';
import type { TMetricBase, TNodeMetrics } from '../../Graph.entity';
import { deriveMetricBase, type TSessionMessageLike } from './deriveMetricBase';

export interface DeriveMetricsInput {
  messages: TSessionMessageLike[];
  status?: SessionStatus;
  subtaskInvocations?: number;
  now: number;
}

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
