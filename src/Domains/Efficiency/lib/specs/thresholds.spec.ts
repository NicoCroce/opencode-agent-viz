import { describe, expect, it } from 'vitest';
import {
  BAND_MINIMUMS,
  CACHE_OMISSION_PENALTY,
  DIMENSION_WEIGHTS,
  EXECUTION_MIN_STEPS,
  HIGH_CONFIDENCE_MIN_COVERAGE,
  INDICATOR_CAPS,
  INDICATOR_MINIMUMS,
  INDICATOR_WEIGHTS,
  MAX_FINDINGS,
  MAX_WEAK_SIGNALS,
  MEDIUM_CONFIDENCE_MIN_COVERAGE,
  MIN_CLOSED_TURNS,
  MIN_COVERAGE,
  PROMPT_TRUNCATE_CODE_POINTS,
  QUESTION_REPEAT_SIMILARITY,
  SIMILARITY_THRESHOLD,
  SLOW_TOOL_MS,
} from '../thresholds';

const INDICATOR_KEYS = [
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
] as const;

/**
 * Valores normativos de engine §5 y data-model §4. El spec fija la tabla
 * completa: cualquier cambio de peso, tope o banda debe pasar por aquí.
 */
describe('thresholds', () => {
  describe('pesos de dimensión', () => {
    it('fija 30/30/15/25 y suma 100', () => {
      expect(DIMENSION_WEIGHTS).toEqual({
        entrada: 30,
        ejecucion: 30,
        contexto: 15,
        resultado: 25,
      });

      const total = Object.values(DIMENSION_WEIGHTS).reduce(
        (sum, weight) => sum + weight,
        0,
      );
      expect(total).toBe(100);
    });
  });

  describe('pesos de indicador', () => {
    it('suma 1 en cada dimensión', () => {
      for (const weights of Object.values(INDICATOR_WEIGHTS)) {
        const total = Object.values(weights).reduce(
          (sum, weight) => sum + weight,
          0,
        );
        expect(total).toBeCloseTo(1, 10);
      }
    });

    it('cubre exactamente los indicadores de cada dimensión', () => {
      expect(Object.keys(INDICATOR_WEIGHTS.entrada)).toEqual([
        'INP-1',
        'INP-2',
        'INP-3',
      ]);
      expect(Object.keys(INDICATOR_WEIGHTS.ejecucion)).toEqual([
        'RES-1',
        'RES-2',
        'RES-3',
      ]);
      expect(Object.keys(INDICATOR_WEIGHTS.contexto)).toEqual([
        'RES-4',
        'CACHE',
      ]);
      expect(Object.keys(INDICATOR_WEIGHTS.resultado)).toEqual([
        'OUTCOME',
        'OPEN_ERRORS',
      ]);
    });

    it('fija los pesos normativos 45/35/20, 45/35/20, 70/30 y 70/30', () => {
      expect(INDICATOR_WEIGHTS.entrada).toEqual({
        'INP-1': 0.45,
        'INP-2': 0.35,
        'INP-3': 0.2,
      });
      expect(INDICATOR_WEIGHTS.ejecucion).toEqual({
        'RES-1': 0.45,
        'RES-2': 0.35,
        'RES-3': 0.2,
      });
      expect(INDICATOR_WEIGHTS.contexto).toEqual({
        'RES-4': 0.7,
        CACHE: 0.3,
      });
      expect(INDICATOR_WEIGHTS.resultado).toEqual({
        OUTCOME: 0.7,
        OPEN_ERRORS: 0.3,
      });
    });
  });

  describe('caps', () => {
    it('define un cap positivo y exacto por indicador', () => {
      expect(INDICATOR_CAPS).toEqual({
        'INP-1': 0.5,
        'INP-2': 0.33,
        'INP-3': 1,
        'RES-1': 0.2,
        'RES-2': 0.1,
        'RES-3': 0.15,
        'RES-4': 2,
        CACHE: 0.6,
        OUTCOME: 1,
        OPEN_ERRORS: 1,
      });

      for (const key of INDICATOR_KEYS) {
        expect(INDICATOR_CAPS[key]).toBeGreaterThan(0);
      }
    });
  });

  describe('mínimos de muestra', () => {
    it('define un mínimo no negativo y exacto por indicador', () => {
      expect(INDICATOR_MINIMUMS).toEqual({
        'INP-1': 3,
        'INP-2': 0,
        'INP-3': 0,
        'RES-1': 10,
        'RES-2': 0,
        'RES-3': 0,
        'RES-4': 0,
        CACHE: 10,
        OUTCOME: 1,
        OPEN_ERRORS: 0,
      });

      for (const key of INDICATOR_KEYS) {
        expect(INDICATOR_MINIMUMS[key]).toBeGreaterThanOrEqual(0);
      }
      expect(EXECUTION_MIN_STEPS).toBe(5);
    });
  });

  describe('umbrales de similitud', () => {
    it('exige más similitud para repetir una pregunta que para un par', () => {
      expect(SIMILARITY_THRESHOLD).toBeGreaterThan(0);
      expect(SIMILARITY_THRESHOLD).toBeLessThan(1);
      expect(QUESTION_REPEAT_SIMILARITY).toBeGreaterThan(
        SIMILARITY_THRESHOLD,
      );
      expect(QUESTION_REPEAT_SIMILARITY).toBeLessThanOrEqual(1);
    });
  });

  describe('guardas y bandas', () => {
    it('fija los mínimos de banda en 85/70/50/0, de mayor a menor', () => {
      expect(BAND_MINIMUMS).toEqual({
        eficiente: 85,
        aceptable: 70,
        mejorable: 50,
        friccion: 0,
      });

      expect(BAND_MINIMUMS.eficiente).toBeGreaterThan(BAND_MINIMUMS.aceptable);
      expect(BAND_MINIMUMS.aceptable).toBeGreaterThan(BAND_MINIMUMS.mejorable);
      expect(BAND_MINIMUMS.mejorable).toBeGreaterThan(BAND_MINIMUMS.friccion);
    });

    it('exige 2 turnos cerrados y 60 de cobertura para puntuar', () => {
      expect(MIN_CLOSED_TURNS).toBe(2);
      expect(MIN_COVERAGE).toBe(60);
    });

    it('fija la confianza en 85 (alta) y 70 (media)', () => {
      expect(HIGH_CONFIDENCE_MIN_COVERAGE).toBe(85);
      expect(MEDIUM_CONFIDENCE_MIN_COVERAGE).toBe(70);
      expect(HIGH_CONFIDENCE_MIN_COVERAGE).toBeGreaterThan(
        MEDIUM_CONFIDENCE_MIN_COVERAGE,
      );
      expect(MEDIUM_CONFIDENCE_MIN_COVERAGE).toBeGreaterThan(MIN_COVERAGE);
    });

    it('descuenta 4,5 puntos de cobertura cuando la caché se omite', () => {
      expect(CACHE_OMISSION_PENALTY).toBeCloseTo(4.5, 10);
      expect(CACHE_OMISSION_PENALTY).toBeCloseTo(
        DIMENSION_WEIGHTS.contexto * INDICATOR_WEIGHTS.contexto.CACHE,
        10,
      );
    });
  });

  describe('constantes de presentación y catálogo', () => {
    it('fija el recorte como entero positivo junto a la lentitud y los topes', () => {
      expect(PROMPT_TRUNCATE_CODE_POINTS).toBeGreaterThan(0);
      expect(Number.isInteger(PROMPT_TRUNCATE_CODE_POINTS)).toBe(true);
      expect(SLOW_TOOL_MS).toBe(60_000);
      expect(MAX_FINDINGS).toBe(10);
      expect(MAX_WEAK_SIGNALS).toBe(10);
    });
  });
});
