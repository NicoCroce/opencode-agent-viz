/**
 * Omisiones de la puntuación de eficiencia (data-model §2.6, engine §5.2).
 *
 * Explica por qué una dimensión no participa en la nota y cuánto peso se pierde
 * en la cobertura. Los motivos son deterministas y neutrales: describen la
 * muestra, no valoran a la persona.
 *
 * La caché omitida se infiere de las dimensiones: si Contexto está disponible y
 * no hay un indicador CACHE contado (≥10 pasos con tokens), la caché no se pudo
 * puntuar. En ese caso se declara con el peso parcial que pierde la cobertura
 * (4,5). Si Contexto no estuviera disponible, su omisión ya pierde los 15 puntos
 * completos y no se añade la de la caché para no duplicar la explicación.
 *
 * Módulo puro: sin React, SDK, reloj ni azar.
 */
import type {
  TDimensionResult,
  TOmission,
  TIndicatorKey,
  TIndicatorResult,
} from '../Efficiency.entity';
import {
  CACHE_OMISSION_PENALTY,
  EXECUTION_MIN_STEPS,
  INDICATOR_MINIMUMS,
} from './thresholds';

const indicatorOf = (
  dimension: TDimensionResult,
  key: TIndicatorKey,
): TIndicatorResult | undefined =>
  dimension.indicators.find((indicator) => indicator.key === key);

const entradaReason = (count: number, minimum: number): string =>
  `Muestra insuficiente: ${count} de ${minimum} pares consecutivos elegibles`;

const ejecucionReason = (count: number, minimum: number): string =>
  `Muestra insuficiente: ${count} de ${minimum} llamadas a herramientas y ${EXECUTION_MIN_STEPS} pasos como mínimo`;

const RESULTADO_REASON = 'Sin resultado conocido para el último turno';

const CONTEXTO_REASON = 'Muestra insuficiente para puntuar la dimensión';

/** Omisión de una dimensión no disponible, con el indicador que la bloquea. */
const dimensionOmission = (
  dimension: TDimensionResult,
): TOmission | null => {
  if (dimension.available) return null;

  const key = dimension.key;
  switch (key) {
    case 'entrada': {
      // Sin indicador, el mínimo normativo sigue explicando la ausencia.
      const indicator = indicatorOf(dimension, 'INP-1');
      const minimum = indicator?.minimum ?? INDICATOR_MINIMUMS['INP-1'];
      const count = indicator?.count ?? 0;
      return {
        key,
        weight: dimension.weight,
        reason: entradaReason(count, minimum),
        indicator: 'INP-1',
        count,
        minimum,
      };
    }
    case 'ejecucion': {
      const indicator = indicatorOf(dimension, 'RES-1');
      const minimum = indicator?.minimum ?? INDICATOR_MINIMUMS['RES-1'];
      const count = indicator?.count ?? 0;
      return {
        key,
        weight: dimension.weight,
        reason: ejecucionReason(count, minimum),
        indicator: 'RES-1',
        count,
        minimum,
      };
    }
    case 'resultado': {
      const indicator = indicatorOf(dimension, 'OUTCOME');
      return {
        key,
        weight: dimension.weight,
        reason: RESULTADO_REASON,
        indicator: 'OUTCOME',
        count: indicator?.count ?? 0,
        minimum: indicator?.minimum ?? INDICATOR_MINIMUMS.OUTCOME,
      };
    }
    case 'contexto':
      return {
        key,
        weight: dimension.weight,
        reason: CONTEXTO_REASON,
      };
  }
};

const cacheOmissionReason = (cache: TIndicatorResult | undefined): string => {
  if (cache === undefined) {
    return 'Caché no puntuable: sin pasos con tokens ni evidencia de caché';
  }
  return `Caché no puntuable: ${cache.count} de ${cache.minimum} pasos con tokens`;
};

/** Caché no puntuable dentro de Contexto (peso parcial de la cobertura). */
const cacheOmission = (contexto: TDimensionResult): TOmission | null => {
  if (!contexto.available) return null;
  const cache = indicatorOf(contexto, 'CACHE');
  if (cache !== undefined && cache.count >= cache.minimum) return null;
  return {
    key: 'contexto',
    weight: CACHE_OMISSION_PENALTY,
    reason: cacheOmissionReason(cache),
    indicator: 'CACHE',
    ...(cache === undefined ? {} : { count: cache.count }),
    minimum: cache?.minimum ?? INDICATOR_MINIMUMS.CACHE,
  };
};

/**
 * Construye las omisiones en el orden canónico de dimensiones. Incluye las
 * dimensiones no disponibles y, tras Contexto, la caché omitida.
 */
export const buildOmissions = (
  dimensions: readonly TDimensionResult[],
): TOmission[] => {
  const omissions: TOmission[] = [];
  for (const dimension of dimensions) {
    const omission = dimensionOmission(dimension);
    if (omission !== null) omissions.push(omission);
    if (dimension.key === 'contexto') {
      const cache = cacheOmission(dimension);
      if (cache !== null) omissions.push(cache);
    }
  }
  return omissions;
};
