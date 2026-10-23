/**
 * Puntuación del motor de eficiencia (engine §5, data-model §4).
 *
 * Fuente: `contracts/efficiency-engine-contract.md` §5.1–§5.3, §4.4–§4.6 y
 * `data-model.md` §2.3/§4 (feature 015).
 *
 * - Indicadores: `1 − min(1, r / cap)` para fricción y `min(1, hitRate / 0,6)`
 *   para caché. `RES-4` codifica la pérdida en `ratio = max(0, n − 1)` y
 *   `OUTCOME` en `ratio = 1 − valor`, así que comparten la fórmula de fricción.
 * - Dimensión: media ponderada de los indicadores **disponibles**, renormalizada
 *   sobre los pesos presentes; si no se alcanza el mínimo de muestra, la
 *   dimensión se omite (`value: null`) y pierde su peso completo.
 * - Global: media ponderada de las dimensiones disponibles, `Math.round` final y
 *   acotada a [0, 100].
 * - Cobertura (engine §4.4) y confianza (engine §4.6) se reportan aquí; las
 *   guardas de estado (`no_data` → `in_progress` → `insufficient` → `ok`) las
 *   aplica `analyzeSession`, no este módulo.
 *
 * Módulo puro: sin React, SDK, reloj ni azar.
 */
import type {
  TBand,
  TConfidence,
  TDimensionKey,
  TDimensionResult,
  TIndicatorKey,
  TIndicatorResult,
} from '../Efficiency.entity';
import type { TFacts } from './turns';
import {
  BAND_MINIMUMS,
  CACHE_OMISSION_PENALTY,
  DIMENSION_WEIGHTS,
  EXECUTION_MIN_STEPS,
  HIGH_CONFIDENCE_MIN_COVERAGE,
  INDICATOR_CAPS,
  INDICATOR_MINIMUMS,
  INDICATOR_WEIGHTS,
  MEDIUM_CONFIDENCE_MIN_COVERAGE,
} from './thresholds';

// ---------------------------------------------------------------------------
// Tipos de salida
// ---------------------------------------------------------------------------

/** Parámetros de `buildScore`; la raíz es necesaria para RES-4 (solo raíz). */
export interface TScoreOptions {
  rootSessionId: string;
  /** El subárbol tiene sesiones sin mensajes cargados (engine §4.6). */
  isPartial?: boolean;
}

export interface TScoreResult {
  dimensions: TDimensionResult[];
  /** Global renormalizado (entero 0–100) o `null` sin dimensiones disponibles. */
  score: number | null;
  /** Puntos de peso disponibles, ya descontada la caché omitida (engine §4.4). */
  coverage: number;
  /** La caché no se puede puntuar: sin tokens, <10 pasos o proveedor sin caché. */
  cacheOmitted: boolean;
  /** Confianza §4.6; `no_data` la anula en `analyzeSession`. */
  confidence: TConfidence;
}

export interface TConfidenceInput {
  coverage: number;
  dimensions: readonly TDimensionResult[];
  /** Pasos assistant (raíz + subárbol); el doble mínimo de Ejecución es 10. */
  steps: number;
  isPartial?: boolean;
}

/** Indicador medido y si aporta al valor de su dimensión. */
interface TMeasuredIndicator {
  indicator: TIndicatorResult;
  /** `false` si no alcanza el mínimo o no tiene muestra (solo se muestra). */
  counted: boolean;
}

/** Lectura de la caché de la raíz (engine §5.1). */
interface TCacheReading {
  /** No puntuable: sin tokens, <10 pasos con tokens o sin evidencia de caché. */
  omitted: boolean;
  /** Hay pasos con tokens y al menos una lectura/escritura > 0. */
  measured: boolean;
  /** `Σ cache.read / Σ (cache.read + input)` sobre pasos de la raíz. */
  hitRate: number;
  /** Pasos de la raíz con tokens. */
  count: number;
}

// ---------------------------------------------------------------------------
// Helpers numéricos
// ---------------------------------------------------------------------------

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const clamp100 = (value: number): number => Math.min(100, Math.max(0, value));

/** Cociente protegido: denominador 0 ⇒ 0 (nunca `NaN`). */
const ratioOf = (numerator: number, denominator: number): number =>
  denominator > 0 ? numerator / denominator : 0;

const weightOf = (
  dimension: TDimensionKey,
  indicator: TIndicatorKey,
): number => {
  const weights = INDICATOR_WEIGHTS[dimension] as Partial<
    Record<TIndicatorKey, number>
  >;
  return weights[indicator] ?? 0;
};

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

/**
 * Construye un indicador con su `cap`/`minimum` normativos. El `ratio` se acota
 * a ≥0 (nunca negativo) y el aporte a [0,1].
 */
const measure = (
  key: TIndicatorKey,
  ratio: number,
  count: number,
): TIndicatorResult => {
  const cap = INDICATOR_CAPS[key];
  const boundedRatio = Math.max(0, ratio);
  const contribution =
    key === 'CACHE'
      ? Math.min(1, boundedRatio / cap)
      : 1 - Math.min(1, boundedRatio / cap);
  return {
    key,
    ratio: boundedRatio,
    cap,
    score: clamp01(contribution),
    count,
    minimum: INDICATOR_MINIMUMS[key],
  };
};

const counted = (indicator: TIndicatorResult): TMeasuredIndicator => ({
  indicator,
  counted: true,
});

const shownOnly = (indicator: TIndicatorResult): TMeasuredIndicator => ({
  indicator,
  counted: false,
});

const readCache = (facts: TFacts): TCacheReading => {
  const steps = facts.rootTokenSteps;
  const count = steps.length;
  let cacheRead = 0;
  let input = 0;
  let hasEvidence = false;
  for (const step of steps) {
    cacheRead += step.cacheRead;
    input += step.input;
    if (step.cacheRead + step.cacheWrite > 0) hasEvidence = true;
  }
  const minimum = INDICATOR_MINIMUMS.CACHE;
  return {
    omitted: count < minimum || !hasEvidence,
    measured: count > 0 && hasEvidence,
    hitRate: ratioOf(cacheRead, cacheRead + input),
    count,
  };
};

// ---------------------------------------------------------------------------
// Dimensiones
// ---------------------------------------------------------------------------

const dimensionValue = (
  key: TDimensionKey,
  indicators: readonly TIndicatorResult[],
): number | null => {
  let weightSum = 0;
  let weighted = 0;
  for (const indicator of indicators) {
    const weight = weightOf(key, indicator.key);
    weightSum += weight;
    weighted += weight * indicator.score;
  }
  return weightSum > 0 ? clamp100((100 * weighted) / weightSum) : null;
};

/**
 * Compone una dimensión. `minimumMet` refleja el mínimo de la dimensión
 * (INP-1 ≥3 pares; RES-1 ≥10 calls y ≥5 pasos; outcome conocido; Contexto sin
 * mínimo). Si no se alcanza, `value` y `available` quedan en `null`/`false`
 * aunque los indicadores conserven sus conteos para explicar la omisión.
 */
const composeDimension = (
  key: TDimensionKey,
  measures: readonly TMeasuredIndicator[],
  minimumMet: boolean,
): TDimensionResult => {
  const countedIndicators = measures
    .filter((measure) => measure.counted)
    .map((measure) => measure.indicator);
  const value = minimumMet
    ? dimensionValue(key, countedIndicators)
    : null;
  return {
    key,
    weight: DIMENSION_WEIGHTS[key],
    available: value !== null,
    value,
    indicators: measures.map((measure) => measure.indicator),
  };
};

const readEntrada = (facts: TFacts): TDimensionResult => {
  const pairs = facts.eligiblePairs;
  const inp1 = measure(
    'INP-1',
    ratioOf(facts.reformulationPairs.length, pairs),
    pairs,
  );
  const inp2 = measure(
    'INP-2',
    ratioOf(facts.interruptions.length, facts.closedTurns),
    facts.closedTurns,
  );
  const inp3 = measure(
    'INP-3',
    ratioOf(facts.repeatedQuestions.length, facts.questionCalls.length),
    facts.questionCalls.length,
  );
  return composeDimension(
    'entrada',
    [
      // INP-1 es el mínimo de la dimensión (3 pares elegibles).
      inp1.count >= inp1.minimum ? counted(inp1) : shownOnly(inp1),
      // Sin turnos cerrados / preguntas el cociente no tiene muestra.
      inp2.count > 0 ? counted(inp2) : shownOnly(inp2),
      inp3.count > 0 ? counted(inp3) : shownOnly(inp3),
    ],
    inp1.count >= inp1.minimum,
  );
};

const readEjecucion = (facts: TFacts): TDimensionResult => {
  const toolCalls = facts.tools.length;
  const steps = facts.assistants.length;
  const res1 = measure(
    'RES-1',
    ratioOf(facts.toolErrors, toolCalls),
    toolCalls,
  );
  const res2 = measure(
    'RES-2',
    ratioOf(facts.retries.length, steps),
    steps,
  );
  const res3 = measure(
    'RES-3',
    ratioOf(facts.redundantCalls.length, toolCalls),
    toolCalls,
  );
  // RES-1 exige 10 llamadas y 5 pasos; sin llamadas no hay muestra.
  const res1Available =
    res1.count >= res1.minimum && steps >= EXECUTION_MIN_STEPS;
  return composeDimension(
    'ejecucion',
    [
      res1Available ? counted(res1) : shownOnly(res1),
      res2.count > 0 ? counted(res2) : shownOnly(res2),
      res3.count > 0 ? counted(res3) : shownOnly(res3),
    ],
    res1Available,
  );
};

const readContexto = (
  facts: TFacts,
  rootSessionId: string,
  cache: TCacheReading,
): TDimensionResult => {
  const compactions = facts.compactions.filter(
    (compaction) =>
      compaction.sessionId === rootSessionId && compaction.reason === 'auto',
  ).length;
  const res4 = measure('RES-4', Math.max(0, compactions - 1), compactions);
  // La primera compactación no resta; sin mínimo de compactaciones, Contexto
  // siempre está disponible. La caché puede faltar (omisión con 4,5 puntos).
  const measures: TMeasuredIndicator[] = [counted(res4)];
  if (cache.measured) {
    const cacheIndicator = measure('CACHE', cache.hitRate, cache.count);
    measures.push(
      cache.omitted ? shownOnly(cacheIndicator) : counted(cacheIndicator),
    );
  }
  return composeDimension('contexto', measures, true);
};

const OUTCOME_VALUES = {
  succeeded: 1,
  interrupted: 0.5,
  failed: 0,
} as const;

const readResultado = (facts: TFacts): TDimensionResult => {
  const measures: TMeasuredIndicator[] = [];
  if (facts.outcome !== null) {
    const value = OUTCOME_VALUES[facts.outcome];
    measures.push(counted(measure('OUTCOME', 1 - value, 1)));
  }
  measures.push(
    counted(measure('OPEN_ERRORS', facts.openErrors ? 1 : 0, 1)),
  );
  // Resultado exige outcome conocido (engine §5.2).
  return composeDimension('resultado', measures, facts.outcome !== null);
};

const buildDimensions = (
  facts: TFacts,
  rootSessionId: string,
  cache: TCacheReading,
): TDimensionResult[] => [
  readEntrada(facts),
  readEjecucion(facts),
  readContexto(facts, rootSessionId, cache),
  readResultado(facts),
];

// ---------------------------------------------------------------------------
// Global, cobertura, bandas y confianza
// ---------------------------------------------------------------------------

/** Global renormalizado sobre las dimensiones disponibles, redondeado. */
export const globalScore = (
  dimensions: readonly TDimensionResult[],
): number | null => {
  let weightSum = 0;
  let weighted = 0;
  for (const dimension of dimensions) {
    if (!dimension.available || dimension.value === null) continue;
    weightSum += dimension.weight;
    weighted += dimension.weight * dimension.value;
  }
  if (weightSum === 0) return null;
  return clamp100(Math.round(weighted / weightSum));
};

/**
 * Cobertura (engine §4.4): suma de pesos de las dimensiones disponibles menos
 * 4,5 cuando Contexto está disponible y la caché se omite. Sin multiplicador
 * por sesiones cargadas.
 */
export const computeCoverage = (
  dimensions: readonly TDimensionResult[],
  cacheOmitted: boolean,
): number => {
  const available = dimensions.filter((dimension) => dimension.available);
  const total = available.reduce(
    (sum, dimension) => sum + dimension.weight,
    0,
  );
  const contextoAvailable = available.some(
    (dimension) => dimension.key === 'contexto',
  );
  const penalty = contextoAvailable && cacheOmitted ? CACHE_OMISSION_PENALTY : 0;
  return clamp100(total - penalty);
};

/** Banda de la nota (data-model §4.7): 85/70/50. */
export const bandFor = (score: number | null): TBand | null => {
  if (score === null) return null;
  if (score >= BAND_MINIMUMS.eficiente) return 'eficiente';
  if (score >= BAND_MINIMUMS.aceptable) return 'aceptable';
  if (score >= BAND_MINIMUMS.mejorable) return 'mejorable';
  return 'friccion';
};

const indicatorOf = (
  dimension: TDimensionResult,
  key: TIndicatorKey,
): TIndicatorResult | undefined =>
  dimension.indicators.find((indicator) => indicator.key === key);

/** El doble del mínimo de muestra de la dimensión (engine §4.6). */
const reachesDoubleSample = (
  dimension: TDimensionResult,
  steps: number,
): boolean => {
  switch (dimension.key) {
    case 'entrada': {
      const inp1 = indicatorOf(dimension, 'INP-1');
      return inp1 === undefined || inp1.count >= 2 * inp1.minimum;
    }
    case 'ejecucion': {
      const res1 = indicatorOf(dimension, 'RES-1');
      return (
        res1 === undefined ||
        (res1.count >= 2 * res1.minimum &&
          steps >= 2 * EXECUTION_MIN_STEPS)
      );
    }
    // Contexto no tiene mínimo de compactaciones; Resultado basta con outcome.
    case 'contexto':
    case 'resultado':
      return true;
  }
};

/**
 * Confianza §4.6: `baja` si la cobertura es <70 o el subárbol es parcial;
 * `alta` solo con cobertura ≥85, todas las dimensiones disponibles con doble
 * muestra y subárbol completo; `media` en el resto (≥70).
 */
export const confidenceFor = (input: TConfidenceInput): TConfidence => {
  const isPartial = input.isPartial ?? false;
  const high =
    input.coverage >= HIGH_CONFIDENCE_MIN_COVERAGE &&
    !isPartial &&
    input.dimensions
      .filter((dimension) => dimension.available)
      .every((dimension) => reachesDoubleSample(dimension, input.steps));
  if (high) return 'alta';
  if (input.coverage < MEDIUM_CONFIDENCE_MIN_COVERAGE || isPartial) {
    return 'baja';
  }
  return 'media';
};

/**
 * Calcula dimensiones, nota global, cobertura y confianza desde los hechos.
 * No aplica las guardas de estado ni decide `band`; eso es de `analyzeSession`.
 */
export const buildScore = (
  facts: TFacts,
  options: TScoreOptions,
): TScoreResult => {
  const cache = readCache(facts);
  const dimensions = buildDimensions(facts, options.rootSessionId, cache);
  const coverage = computeCoverage(dimensions, cache.omitted);
  return {
    dimensions,
    score: globalScore(dimensions),
    coverage,
    cacheOmitted: cache.omitted,
    confidence: confidenceFor({
      coverage,
      dimensions,
      steps: facts.assistants.length,
      isPartial: options.isPartial,
    }),
  };
};
