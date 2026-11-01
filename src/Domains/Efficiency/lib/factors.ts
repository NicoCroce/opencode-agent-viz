/**
 * Factores de impacto del veredicto de eficiencia (data-model §2.6).
 *
 * Un factor es la vista de un indicador que explica la nota: su etiqueta, el
 * tamaño de muestra (`count`) y si resta o suma (`kind`). El orden se calcula
 * por impacto interno —`peso_dimensión × peso_indicador × (1 − score)`—, pero
 * TFactor no expone los puntos: esos viven en “Cómo se calcula”.
 *
 * Reglas:
 * - Solo se consideran indicadores de dimensiones disponibles y con muestra
 *   suficiente (los mismos que el motor cuenta para el valor de la dimensión).
 * - Si hay pérdidas, se muestran las de mayor impacto (2–3). Cuando quedan
 *   menos de dos, se completa con indicadores sin pérdida (`kind: 'suma'`),
 *   ordenados por el impacto que tendrían si bajaran a cero.
 * - Sin pérdidas (sesión limpia), el fallback es positivo: 2–3 indicadores
 *   `suma` con mayor peso.
 *
 * Módulo puro: sin React, SDK, reloj ni azar.
 */
import type {
  TDimensionKey,
  TDimensionResult,
  TFactor,
  TIndicatorKey,
  TIndicatorResult,
} from '../Efficiency.entity';
import { INDICATOR_LABEL } from './labels';
import { INDICATOR_WEIGHTS, MAX_FACTORS } from './thresholds';

/** Mínimo de factores que muestra el veredicto en `ok` (data-model §2.6). */
const MIN_FACTORS = 2;

const DIMENSION_ORDER: readonly TDimensionKey[] = [
  'entrada',
  'ejecucion',
  'contexto',
  'resultado',
];

const INDICATOR_ORDER: readonly TIndicatorKey[] = [
  'INP-1',
  'INP-2',
  'INP-3',
  'RES-1',
  'RES-2',
  'RES-3',
  'RES-4',
  'CACHE',
  'OUTCOME',
  'OPEN_ERRORS',
];

interface TFactorCandidate {
  factor: TFactor;
  /** Puntos de dimensión perdidos por este indicador. */
  impact: number;
  /** Impacto que tendría si el indicador bajara a cero. */
  potential: number;
  dimensionOrder: number;
  indicatorOrder: number;
}

const orderOf = <T>(order: readonly T[], value: T): number => {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
};

const indicatorWeight = (
  dimension: TDimensionKey,
  indicator: TIndicatorKey,
): number => {
  const weights = INDICATOR_WEIGHTS[dimension] as Partial<
    Record<TIndicatorKey, number>
  >;
  return weights[indicator] ?? 0;
};

/**
 * Impacto interno de un indicador: `peso_dimensión × peso_indicador × (1 − score)`.
 * Para CACHE, `score` es calidad, así que el complemento mide la calidad no
 * aprovechada. No se expone en `TFactor`; la tabla de “Cómo se calcula” lo usa.
 */
export const factorImpact = (
  dimension: TDimensionResult,
  indicator: TIndicatorResult,
): number =>
  dimension.weight *
  indicatorWeight(dimension.key, indicator.key) *
  (1 - indicator.score);

/**
 * `true` si el indicador aporta al valor de la dimensión. Réplica de las reglas
 * de `score.ts`: `RES-4` cuenta con 0 compactaciones (el 0 es un valor real);
 * el resto necesita muestra (y CACHE, llegar a su mínimo de pasos con tokens).
 */
const isCounted = (indicator: TIndicatorResult): boolean => {
  if (indicator.count > 0) return indicator.count >= indicator.minimum;
  return indicator.key === 'RES-4' && indicator.minimum === 0;
};

const toCandidate = (
  dimension: TDimensionResult,
  indicator: TIndicatorResult,
): TFactorCandidate => {
  const weight = indicatorWeight(dimension.key, indicator.key);
  return {
    factor: {
      key: indicator.key,
      dimension: dimension.key,
      label: INDICATOR_LABEL[indicator.key],
      count: indicator.count,
      kind: indicator.score >= 1 ? 'suma' : 'resta',
    },
    impact: factorImpact(dimension, indicator),
    potential: dimension.weight * weight,
    dimensionOrder: orderOf(DIMENSION_ORDER, dimension.key),
    indicatorOrder: orderOf(INDICATOR_ORDER, indicator.key),
  };
};

/** Orden determinista: impacto, potencial, dimensión y orden canónico. */
const compareCandidates = (
  left: TFactorCandidate,
  right: TFactorCandidate,
): number =>
  right.impact - left.impact ||
  right.potential - left.potential ||
  left.dimensionOrder - right.dimensionOrder ||
  left.indicatorOrder - right.indicatorOrder;

/**
 * Construye los 2–3 factores visibles del veredicto a partir de las dimensiones
 * puntuadas. Devuelve `[]` si no hay ninguna dimensión disponible o ningún
 * indicador con muestra; las dimensiones omitidas se explican en
 * `omissions.ts`, no aquí.
 */
export const buildFactors = (
  dimensions: readonly TDimensionResult[],
): TFactor[] => {
  const candidates = dimensions
    .filter((dimension) => dimension.available)
    .flatMap((dimension) =>
      dimension.indicators
        .filter(isCounted)
        .map((indicator) => toCandidate(dimension, indicator)),
    )
    .sort(compareCandidates);

  if (candidates.length === 0) return [];

  const losses = candidates.filter((candidate) => candidate.impact > 0);
  const positives = candidates.filter((candidate) => candidate.impact <= 0);

  if (losses.length >= MIN_FACTORS) {
    return losses
      .slice(0, MAX_FACTORS)
      .map((candidate) => candidate.factor);
  }

  // Fallback positivo: completa hasta el máximo visible con lo que no resta.
  return [...losses, ...positives]
    .slice(0, MAX_FACTORS)
    .map((candidate) => candidate.factor);
};
