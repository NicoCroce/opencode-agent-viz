import { describe, expect, it } from 'vitest';
import type {
  TDimensionKey,
  TDimensionResult,
  TIndicatorKey,
  TIndicatorResult,
} from '../../Efficiency.entity';
import { DIMENSION_WEIGHTS } from '../thresholds';
import { buildFactors } from '../factors';

/**
 * T015 (data-model §2.6, engine §10): tabla de factores del veredicto.
 * Spec de lógica pura (entorno `node`): 2–3 factores, orden por impacto,
 * fallback positivo y signo/conteo.
 */

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const indicator = (
  key: TIndicatorKey,
  overrides: Partial<Omit<TIndicatorResult, 'key'>> = {},
): TIndicatorResult => ({
  key,
  ratio: 0,
  cap: 1,
  score: 1,
  count: 1,
  minimum: 0,
  ...overrides,
});

const dimension = (
  key: TDimensionKey,
  indicators: TIndicatorResult[],
  overrides: Partial<Omit<TDimensionResult, 'key' | 'indicators'>> = {},
): TDimensionResult => ({
  key,
  weight: DIMENSION_WEIGHTS[key],
  value: 100,
  available: true,
  indicators,
  ...overrides,
});

/** Informe disponible con una pérdida en cada dimensión salvo Resultado. */
const withLosses = (): TDimensionResult[] => [
  dimension('entrada', [
    indicator('INP-1', { score: 0.5, count: 5, minimum: 3 }),
    indicator('INP-2', { score: 0.5, count: 4 }),
    indicator('INP-3', { count: 2 }),
  ]),
  dimension('ejecucion', [
    indicator('RES-1', { score: 0.6, count: 20, minimum: 10 }),
    indicator('RES-2', { count: 10 }),
    indicator('RES-3', { count: 20 }),
  ]),
  dimension('contexto', [
    indicator('RES-4', { score: 0.5, count: 2 }),
    indicator('CACHE', { count: 12, minimum: 10 }),
  ]),
  dimension('resultado', [
    indicator('OUTCOME', { count: 1, minimum: 1 }),
    indicator('OPEN_ERRORS', { count: 1 }),
  ]),
];

/** Informe disponible con una única pérdida (RES-2). */
const withSingleLoss = (): TDimensionResult[] =>
  withLosses().map((item) => ({
    ...item,
    indicators: item.indicators.map((candidate) =>
      candidate.key === 'RES-2'
        ? { ...candidate, ratio: 0.05, cap: 0.1, score: 0.5 }
        : { ...candidate, ratio: 0, score: 1 },
    ),
  }));

// ---------------------------------------------------------------------------
// Factores
// ---------------------------------------------------------------------------

describe('buildFactors', () => {
  it('devuelve 3 factores ordenados por impacto con conteo y signo', () => {
    const factors = buildFactors(withLosses());

    expect(factors).toHaveLength(3);
    expect(factors.map((factor) => factor.key)).toEqual([
      'INP-1',
      'RES-1',
      'INP-2',
    ]);
    expect(factors[0]).toEqual({
      key: 'INP-1',
      dimension: 'entrada',
      label: 'Pedidos consecutivos similares',
      count: 5,
      kind: 'resta',
    });
    expect(factors.every((factor) => factor.kind === 'resta')).toBe(true);
  });

  it('completa con factores positivos cuando hay una sola pérdida', () => {
    const factors = buildFactors(withSingleLoss());

    expect(factors.map((factor) => factor.key)).toEqual([
      'RES-2',
      'OUTCOME',
      'INP-1',
    ]);
    expect(factors.map((factor) => factor.kind)).toEqual([
      'resta',
      'suma',
      'suma',
    ]);
    expect(factors[1]).toMatchObject({ count: 1, dimension: 'resultado' });
  });

  it('usa el fallback positivo en una sesión sin pérdidas', () => {
    const factors = buildFactors(withSingleLoss().map((item) => ({
      ...item,
      indicators: item.indicators.map((candidate) => ({
        ...candidate,
        ratio: 0,
        score: 1,
      })),
    })));

    expect(factors.map((factor) => factor.key)).toEqual([
      'OUTCOME',
      'INP-1',
      'RES-1',
    ]);
    expect(factors.every((factor) => factor.kind === 'suma')).toBe(true);
  });

  it('ignora dimensiones omitidas e indicadores sin muestra', () => {
    const factors = buildFactors([
      dimension(
        'entrada',
        [indicator('INP-1', { score: 0, count: 5, minimum: 3 })],
        { available: false, value: null },
      ),
      dimension('ejecucion', [indicator('RES-2', { count: 0 })]),
      dimension('resultado', [
        indicator('OUTCOME', { count: 1, minimum: 1 }),
      ]),
    ]);

    expect(factors).toEqual([
      {
        key: 'OUTCOME',
        dimension: 'resultado',
        label: 'Resultado final',
        count: 1,
        kind: 'suma',
      },
    ]);
  });

  it('cuenta RES-4 con 0 compactaciones (el 0 es una muestra real)', () => {
    const factors = buildFactors([
      dimension('contexto', [indicator('RES-4', { count: 0 })]),
    ]);

    expect(factors).toEqual([
      {
        key: 'RES-4',
        dimension: 'contexto',
        label: 'Compactaciones automáticas',
        count: 0,
        kind: 'suma',
      },
    ]);
  });
});
