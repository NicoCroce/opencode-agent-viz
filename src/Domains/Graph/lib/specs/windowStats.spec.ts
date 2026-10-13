import { describe, expect, it } from 'vitest';
import type { TNodeMetrics } from '../../Graph.entity';
import { EMPTY_METRICS } from '../../Graph.entity';
import { deriveContextWindow } from '../metrics/windowStats';

const metrics = (overrides: Partial<TNodeMetrics> = {}): TNodeMetrics => ({
  ...EMPTY_METRICS,
  ...overrides,
});

describe('deriveContextWindow · C5 (caché y coste)', () => {
  it('calcula la tasa de acierto con caché', () => {
    const window = deriveContextWindow(
      metrics({
        tokens: {
          input: 300,
          output: 0,
          reasoning: 0,
          cacheRead: 700,
          cacheWrite: 0,
        },
      }),
      1000,
    );

    expect(window.hitRate).toBeCloseTo(0.7, 5);
  });

  it('devuelve hitRate null cuando el denominador es 0', () => {
    const window = deriveContextWindow(
      metrics({
        tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
      }),
      0,
    );

    expect(window.hitRate).toBeNull();
  });

  it('devuelve hitRate null sin tokens', () => {
    expect(deriveContextWindow(metrics(), 100).hitRate).toBeNull();
  });

  it('calcula el coste por 1k tokens de contexto', () => {
    const window = deriveContextWindow(metrics({ cost: 0.02 }), 1000);

    expect(window.costPerKToken).toBeCloseTo(0.02, 5);
  });

  it('devuelve costPerKToken null sin coste o sin ventana', () => {
    expect(deriveContextWindow(metrics(), 1000).costPerKToken).toBeNull();
    expect(deriveContextWindow(metrics({ cost: 0.02 }), null).costPerKToken).toBeNull();
    expect(deriveContextWindow(metrics({ cost: 0.02 }), 0).costPerKToken).toBeNull();
  });

  it('propaga la ventana y los acumulados de caché', () => {
    const window = deriveContextWindow(
      metrics({
        tokens: {
          input: 1,
          output: 2,
          reasoning: 3,
          cacheRead: 4,
          cacheWrite: 5,
        },
      }),
      42,
    );

    expect(window.windowTokens).toBe(42);
    expect(window.cacheRead).toBe(4);
    expect(window.cacheWrite).toBe(5);
  });
});
