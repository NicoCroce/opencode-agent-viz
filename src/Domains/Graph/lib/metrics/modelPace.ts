import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type { TModelPace } from '../../Graph.entity';
import { MIN_EXPECTED_MS, latencySamples, median } from './latency';

/** Respuestas mínimas de un modelo para estimar su ritmo. */
export const MIN_PACE_SAMPLES = 8;

/** Una respuesta que tarda más de este múltiplo de lo predicho no entra al ajuste. */
const OUTLIER_FACTOR = 3;

interface TPacePoint {
  tokens: number;
  ms: number;
}

/** Mínimos cuadrados de `ms ~ base + slope × tokens`. */
const leastSquares = (points: TPacePoint[]) => {
  const n = points.length;
  const meanX = points.reduce((sum, p) => sum + p.tokens, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.ms, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.tokens - meanX) ** 2;
    sxy += (p.tokens - meanX) * (p.ms - meanY);
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  return { base: meanY - slope * meanX, slope };
};

/**
 * Estima el ritmo de generación de un modelo: un ajuste lineal entre tokens
 * generados y tiempo de generación. Para que una respuesta anómala no arrastre
 * el ritmo, se descartan las que tardan más de `OUTLIER_FACTOR ×` lo predicho y
 * se ajusta de nuevo. Si el tiempo no crece con los tokens, el ritmo es 0 y la
 * base es la mediana. `null` con menos de `MIN_PACE_SAMPLES` respuestas.
 */
export const fitModelPace = (
  model: string,
  points: TPacePoint[],
): TModelPace | null => {
  if (points.length < MIN_PACE_SAMPLES) return null;

  let fit = leastSquares(points);
  const kept = points.filter(
    (p) => p.ms <= OUTLIER_FACTOR * Math.max(MIN_EXPECTED_MS, fit.base + fit.slope * p.tokens),
  );
  if (kept.length >= MIN_PACE_SAMPLES && kept.length < points.length) {
    fit = leastSquares(kept);
  }

  if (fit.slope <= 0) {
    return {
      model,
      baseMs: median(kept.map((p) => p.ms)) ?? 0,
      msPerToken: 0,
      samples: points.length,
    };
  }
  return {
    model,
    baseMs: Math.max(0, fit.base),
    msPerToken: fit.slope,
    samples: points.length,
  };
};

/**
 * Ritmo por modelo con las respuestas de todos los nodos del grafo. Solo
 * entran las que reportan tokens y tiempo de generación positivo.
 */
export const deriveModelPaces = (
  messageLists: ReadonlyArray<TSessionMessage[]>,
): Record<string, TModelPace> => {
  const byModel = new Map<string, TPacePoint[]>();
  for (const messages of messageLists) {
    for (const sample of latencySamples(messages)) {
      const { model, generationMs, outputTokens } = sample;
      if (model === null || generationMs === null || generationMs <= 0) continue;
      if (outputTokens === null) continue;
      const list = byModel.get(model) ?? [];
      list.push({ tokens: outputTokens, ms: generationMs });
      byModel.set(model, list);
    }
  }

  const paces: Record<string, TModelPace> = {};
  for (const [model, points] of byModel) {
    const pace = fitModelPace(model, points);
    if (pace) paces[model] = pace;
  }
  return paces;
};
