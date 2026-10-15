import { describe, expect, it } from 'vitest';
import { latencySample } from '@app/test/latencyFixtures';
import {
  NO_PACE_LABEL,
  formatLatency,
  describeLatencySample,
  describePace,
  latencyParts,
  summarizeLatency,
} from '../latencyBreakdown';

describe('latencyParts', () => {
  it('ordena los tramos de mayor a menor y omite los vacíos', () => {
    const parts = latencyParts(
      latencySample({ generationMs: 9000, toolMs: 30_000, subagentMs: 0, humanMs: 0 }),
    );

    expect(parts).toEqual([
      { kind: 'tools', ms: 30_000 },
      { kind: 'model', ms: 9000 },
    ]);
  });

  it('sin generación medida, el modelo no aparece', () => {
    expect(latencyParts(latencySample({ generationMs: null, humanMs: 5000 }))).toEqual([
      { kind: 'human', ms: 5000 },
    ]);
  });
});

describe('summarizeLatency', () => {
  it('suma cada tramo en todas las respuestas y calcula su porcentaje', () => {
    const shares = summarizeLatency([
      latencySample({ generationMs: 6000, toolMs: 2000 }),
      latencySample({ generationMs: 2000, subagentMs: 10_000 }),
    ]);

    expect(shares).toEqual([
      { kind: 'model', ms: 8000, pct: 40 },
      { kind: 'tools', ms: 2000, pct: 10 },
      { kind: 'subagents', ms: 10_000, pct: 50 },
    ]);
  });

  it('sin tiempo medido no hay reparto', () => {
    expect(summarizeLatency([])).toEqual([]);
    expect(summarizeLatency([latencySample({ generationMs: null })])).toEqual([]);
  });
});

describe('describeLatencySample', () => {
  it('explica la respuesta empezando por la causa principal', () => {
    const texts = describeLatencySample(
      latencySample({
        generationMs: 9000,
        outputTokens: 2100,
        expectedMs: 3800,
        toolMs: 30_000,
        topTool: 'shell',
        firstOutputMs: 1800,
      }),
    );

    expect(texts).toEqual([
      'herramientas 30s (shell)',
      'modelo 9.0s (2.1k tok; esperado 3.8s)',
      '1.ª salida 1.8s',
    ]);
  });

  it('sin tokens ni esperado, el modelo va sin detalle', () => {
    expect(describeLatencySample(latencySample({ generationMs: 2000 }))).toEqual([
      'modelo 2.0s',
    ]);
  });
});

describe('describePace', () => {
  it('muestra base, ritmo por token y respuestas medidas', () => {
    expect(
      describePace({ model: 'p/m', baseMs: 1200, msPerToken: 12.34, samples: 40 }),
    ).toBe('1.2s + 12.3 ms/tok · 40 resp.');
    expect(NO_PACE_LABEL).toContain('8 respuestas');
  });
});

describe('formatLatency', () => {
  it('usa un decimal entre 1 y 10 s y el formato general fuera de ese rango', () => {
    expect(formatLatency(450)).toBe('450ms');
    expect(formatLatency(1800)).toBe('1.8s');
    expect(formatLatency(9950)).toBe('9.9s');
    expect(formatLatency(42_000)).toBe('42s');
    expect(formatLatency(null)).toBe('—');
  });
});
