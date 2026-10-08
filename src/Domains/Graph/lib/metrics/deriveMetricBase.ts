import type { ModelRef } from '@opencode/client';
import type { TCurrentTool, TMetricBase } from '../../Graph.entity';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import {
  accumulateTokens,
  toTokenUsage,
  type TokenAccumulator,
  type TokenSeen,
} from './tokens';

export type TSessionMessageLike = TSessionMessage;

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

  const tokens = toTokenUsage(acc, seen);

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
