import { describe, expect, it } from 'vitest';
import type {
  TDimensionKey,
  TDimensionResult,
  TIndicatorKey,
  TIndicatorResult,
} from '../../Efficiency.entity';
import { DIMENSION_WEIGHTS } from '../thresholds';
import { buildOmissions } from '../omissions';

/**
 * T015 (data-model §2.6, engine §10): omisiones de dimensión y de caché.
 * Spec de lógica pura (entorno `node`): peso, motivo, indicador, conteo y
 * mínimo.
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

const omitted = (
  key: TDimensionKey,
  indicators: TIndicatorResult[],
): TDimensionResult =>
  dimension(key, indicators, { available: false, value: null });

// ---------------------------------------------------------------------------
// Omisiones
// ---------------------------------------------------------------------------

describe('buildOmissions', () => {
  it('declara Entrada, Ejecución y Resultado con su indicador, conteo y mínimo', () => {
    const omissions = buildOmissions([
      omitted('entrada', [
        indicator('INP-1', { score: 0, count: 2, minimum: 3 }),
        indicator('INP-2', { count: 4 }),
      ]),
      omitted('ejecucion', [
        indicator('RES-1', { score: 0, count: 8, minimum: 10 }),
      ]),
      dimension('contexto', [
        indicator('RES-4', { count: 0 }),
        indicator('CACHE', { score: 0.8, count: 12, minimum: 10 }),
      ]),
      omitted('resultado', [indicator('OPEN_ERRORS', { count: 1 })]),
    ]);

    expect(omissions.map((omission) => omission.key)).toEqual([
      'entrada',
      'ejecucion',
      'resultado',
    ]);
    expect(omissions[0]).toMatchObject({
      key: 'entrada',
      weight: 30,
      indicator: 'INP-1',
      count: 2,
      minimum: 3,
    });
    expect(omissions[0].reason).toContain('2 de 3');
    expect(omissions[1]).toMatchObject({
      key: 'ejecucion',
      weight: 30,
      indicator: 'RES-1',
      count: 8,
      minimum: 10,
    });
    expect(omissions[1].reason).toContain('8 de 10');
    expect(omissions[1].reason).toContain('5 pasos');
    expect(omissions[2]).toMatchObject({
      key: 'resultado',
      weight: 25,
      indicator: 'OUTCOME',
      count: 0,
      minimum: 1,
    });
    expect(omissions[2].reason).toBe(
      'Sin resultado conocido para el último turno',
    );
  });

  it('declara la caché omitida con su peso parcial y sus pasos con tokens', () => {
    const omissions = buildOmissions([
      dimension('contexto', [
        indicator('RES-4', { count: 0 }),
        indicator('CACHE', { score: 0.3, count: 6, minimum: 10 }),
      ]),
    ]);

    expect(omissions).toHaveLength(1);
    expect(omissions[0]).toMatchObject({
      key: 'contexto',
      weight: 4.5,
      indicator: 'CACHE',
      count: 6,
      minimum: 10,
    });
    expect(omissions[0].reason).toContain('6 de 10');
  });

  it('declara la caché omitida sin indicador cuando no hay evidencia', () => {
    const omissions = buildOmissions([
      dimension('contexto', [indicator('RES-4', { count: 0 })]),
    ]);

    expect(omissions).toHaveLength(1);
    expect(omissions[0]).toMatchObject({
      key: 'contexto',
      weight: 4.5,
      indicator: 'CACHE',
      minimum: 10,
    });
    expect(omissions[0].count).toBeUndefined();
    expect(omissions[0].reason).toContain('sin pasos con tokens');
  });

  it('no emite omisiones cuando todas las dimensiones y la caché son válidas', () => {
    const omissions = buildOmissions([
      dimension('entrada', [
        indicator('INP-1', { count: 4, minimum: 3 }),
      ]),
      dimension('ejecucion', [
        indicator('RES-1', { count: 20, minimum: 10 }),
      ]),
      dimension('contexto', [
        indicator('RES-4', { count: 0 }),
        indicator('CACHE', { count: 12, minimum: 10 }),
      ]),
      dimension('resultado', [
        indicator('OUTCOME', { count: 1, minimum: 1 }),
      ]),
    ]);

    expect(omissions).toEqual([]);
  });

  it('no duplica la caché cuando Contexto ya está omitido', () => {
    const omissions = buildOmissions([
      omitted('contexto', [indicator('RES-4', { count: 0 })]),
    ]);

    expect(omissions).toHaveLength(1);
    expect(omissions[0]).toMatchObject({ key: 'contexto', weight: 15 });
  });
});
