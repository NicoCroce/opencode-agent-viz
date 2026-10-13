import { describe, expect, it } from 'vitest';
import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { MIN_SAMPLES, deriveLatency, detectAnomalies } from '../metrics/latency';

const assistant = (
  id: string,
  created: number,
  completed?: number,
  streamed?: number,
): TSessionMessage => ({
  info: {
    id,
    type: 'assistant',
    agent: 'develop',
    model: { id: 'm', providerID: 'p' },
    time: {
      created,
      ...(streamed === undefined ? {} : { streamed }),
      ...(completed === undefined ? {} : { completed }),
    },
    content: [],
  },
  parts: [],
});

describe('deriveLatency · L1 (muestras)', () => {
  it('deriva ttftMs y totalMs desde time y ordena por startedAt', () => {
    const report = deriveLatency([
      assistant('b', 2000, 2600, 2100),
      assistant('a', 1000, 1900, 1100),
      assistant('sin-fin', 3000),
    ]);

    expect(report.samples.map((sample) => sample.stepId)).toEqual(['a', 'b']);
    expect(report.samples[0]).toEqual({
      stepId: 'a',
      startedAt: 1000,
      ttftMs: 100,
      totalMs: 900,
    });
    expect(report.samples[1].ttftMs).toBe(100);
  });

  it('deja ttftMs en null sin time.streamed', () => {
    const report = deriveLatency([assistant('a', 0, 500)]);

    expect(report.samples[0].ttftMs).toBeNull();
    expect(report.samples[0].totalMs).toBe(500);
  });
});

describe('deriveLatency · L2/L3/L4 (referencia)', () => {
  it('con ≥ MIN_SAMPLES usa la mediana del nodo', () => {
    const report = deriveLatency([
      assistant('a', 0, 1000),
      assistant('b', 0, 2000),
      assistant('c', 0, 3000),
    ]);

    expect(MIN_SAMPLES).toBe(3);
    expect(report.reference).toBe('node');
    expect(report.medianMs).toBe(2000);
  });

  it('con < MIN_SAMPLES cae a la mediana del agente', () => {
    const report = deriveLatency([assistant('a', 0, 1000)], {
      agentMedianMs: 2500,
    });

    expect(report.reference).toBe('agent');
    expect(report.medianMs).toBe(2500);
  });

  it('sin baseline deja anomalies vacío', () => {
    const report = deriveLatency([assistant('a', 0, 1000)]);

    expect(report.reference).toBeNull();
    expect(report.medianMs).toBeNull();
    expect(report.anomalies).toEqual([]);
  });
});

describe('deriveLatency · L5/L6 (detección)', () => {
  it('marca slow por encima y fast por debajo del umbral', () => {
    const outside = detectAnomalies(
      [
        { stepId: 'slow', startedAt: 0, ttftMs: null, totalMs: 5000 },
        { stepId: 'fast', startedAt: 0, ttftMs: null, totalMs: 500 },
      ],
      2000,
      'node',
      0.4,
    );

    expect(outside[0]).toMatchObject({
      stepId: 'slow',
      direction: 'slow',
      referenceMs: 2000,
      reference: 'node',
    });
    expect(outside[1]).toMatchObject({ stepId: 'fast', direction: 'fast' });
  });

  it('no marca dentro de la banda', () => {
    const anomalies = detectAnomalies(
      [{ stepId: 'ok', startedAt: 0, ttftMs: null, totalMs: 2500 }],
      2000,
      'node',
      0.4,
    );

    expect(anomalies).toEqual([]);
  });
});
