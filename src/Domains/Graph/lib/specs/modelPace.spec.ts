import { describe, expect, it } from 'vitest';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import {
  MIN_PACE_SAMPLES,
  deriveModelPaces,
  fitModelPace,
} from '../metrics/modelPace';

const points = (rows: Array<[number, number]>) =>
  rows.map(([tokens, ms]) => ({ tokens, ms }));

/** n puntos exactos sobre `ms = base + rate × tokens`. */
const line = (n: number, base: number, rate: number) =>
  points(Array.from({ length: n }, (_, i) => [100 * (i + 1), base + rate * 100 * (i + 1)]));

const message = (
  id: string,
  providerID: string,
  modelId: string,
  generationMs: number,
  output: number,
): TSessionMessage => ({
  info: {
    id,
    type: 'assistant',
    agent: 'develop',
    model: { id: modelId, providerID },
    time: { created: 0, streamed: generationMs, completed: generationMs + 10 },
    content: [],
    tokens: { input: 0, output, reasoning: 0, cache: { read: 0, write: 0 } },
  },
  parts: [],
});

describe('fitModelPace', () => {
  it('recupera base y ritmo de una relación lineal entre tokens y tiempo', () => {
    const fit = fitModelPace('p/m', line(MIN_PACE_SAMPLES, 800, 12));

    expect(fit?.baseMs).toBeCloseTo(800);
    expect(fit?.msPerToken).toBeCloseTo(12);
    expect(fit?.samples).toBe(MIN_PACE_SAMPLES);
  });

  it('con menos muestras que el mínimo no estima nada', () => {
    expect(MIN_PACE_SAMPLES).toBe(8);
    expect(fitModelPace('p/m', line(MIN_PACE_SAMPLES - 1, 800, 12))).toBeNull();
  });

  it('una respuesta anómala no arrastra el ritmo del modelo', () => {
    const clean = line(10, 1000, 10);
    const withOutlier = [...clean, { tokens: 500, ms: 120_000 }];

    const fit = fitModelPace('p/m', withOutlier);

    expect(fit?.msPerToken).toBeCloseTo(10);
    expect(fit?.baseMs).toBeCloseTo(1000);
    expect(fit?.samples).toBe(11);
  });

  it('si el tiempo no crece con los tokens, usa la mediana como base y ritmo 0', () => {
    const flat = points([
      [100, 3000],
      [200, 2000],
      [300, 2500],
      [400, 1500],
      [500, 2200],
      [600, 1800],
      [700, 1200],
      [800, 1000],
    ]);

    const fit = fitModelPace('p/m', flat);

    expect(fit?.msPerToken).toBe(0);
    expect(fit?.baseMs).toBe(1900);
  });

  it('nunca devuelve una base negativa', () => {
    const fit = fitModelPace('p/m', line(MIN_PACE_SAMPLES, -500, 20));

    expect(fit?.baseMs).toBe(0);
    expect(fit?.msPerToken).toBeGreaterThan(0);
  });
});

describe('deriveModelPaces', () => {
  it('agrupa las respuestas de todos los nodos por proveedor y modelo', () => {
    const nodeA = Array.from({ length: 5 }, (_, i) =>
      message(`a${i}`, 'p', 'm', 1000 + 10 * 100 * (i + 1), 100 * (i + 1)),
    );
    const nodeB = Array.from({ length: 5 }, (_, i) =>
      message(`b${i}`, 'p', 'm', 1000 + 10 * 100 * (i + 6), 100 * (i + 6)),
    );
    const other = [message('c', 'q', 'm', 5000, 100)];

    const paces = deriveModelPaces([nodeA, nodeB, other]);

    expect(Object.keys(paces)).toEqual(['p/m']);
    expect(paces['p/m'].samples).toBe(10);
    expect(paces['p/m'].msPerToken).toBeCloseTo(10);
  });

  it('ignora respuestas sin tokens o sin tiempo de generación', () => {
    const noTokens: TSessionMessage = {
      ...message('x', 'p', 'm', 1000, 100),
    };
    if (noTokens.info.type === 'assistant') delete noTokens.info.tokens;

    expect(deriveModelPaces([[noTokens]])).toEqual({});
  });
});
