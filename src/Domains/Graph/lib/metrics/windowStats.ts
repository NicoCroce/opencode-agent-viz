import type { TContextWindow, TNodeMetrics } from '../../Graph.entity';

/**
 * Deriva la ventana de contexto y el uso de caché de un agente (FR-016;
 * `contracts/context-metrics-contract.md` §2). `windowTokens` viene del desglose
 * (research R1); la tasa de acierto usa los acumulados del nodo y el coste se
 * normaliza por 1k tokens de contexto. Los valores ausentes son `null`, nunca
 * cero (SC-007).
 */
export const deriveContextWindow = (
  metrics: TNodeMetrics,
  windowTokens: number | null,
): TContextWindow => {
  const input = metrics.tokens?.input ?? null;
  const cacheRead = metrics.tokens?.cacheRead ?? null;
  const cacheWrite = metrics.tokens?.cacheWrite ?? null;

  const denominator = (cacheRead ?? 0) + (input ?? 0);
  const hitRate =
    cacheRead !== null && input !== null && denominator > 0
      ? cacheRead / denominator
      : null;

  const costPerKToken =
    metrics.cost !== null && windowTokens !== null && windowTokens > 0
      ? metrics.cost / (windowTokens / 1000)
      : null;

  return { windowTokens, cacheRead, cacheWrite, hitRate, costPerKToken };
};
