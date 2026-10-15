import { describe, expect, it } from 'vitest';
import type {
  TContextCompaction,
  TContextGrowthPoint,
} from '@app/Domains/Graph/Graph.entity';
import { detectCompactionLoop } from '../compactionLoop';

const steps = (...times: number[]): TContextGrowthPoint[] =>
  times.map((startedAt, index) => ({
    stepId: `a${index}`,
    startedAt,
    windowTokens: 16_000,
  }));

const compactionsAt = (...times: number[]): TContextCompaction[] =>
  times.map((at, index) => ({
    id: `c${index}`,
    at,
    status: 'completed',
    reason: 'auto',
  }));

describe('detectCompactionLoop', () => {
  it('detecta compactaciones tras casi cada respuesta', () => {
    // c · paso · c · paso · c · paso · c
    const points = steps(15, 25, 35);
    const loop = detectCompactionLoop(points, compactionsAt(10, 20, 30, 40));

    expect(loop).toEqual({ compactions: 4, steps: 3 });
  });

  it('admite hasta dos pasos entre compactaciones de la racha', () => {
    const points = steps(11, 12, 21, 22);
    const loop = detectCompactionLoop(points, compactionsAt(10, 20, 30));

    expect(loop).toEqual({ compactions: 3, steps: 4 });
  });

  it('no avisa con compactaciones espaciadas', () => {
    const points = steps(11, 12, 13, 21, 22, 23);
    expect(detectCompactionLoop(points, compactionsAt(10, 20, 30))).toBeNull();
  });

  it('no avisa con menos de tres compactaciones seguidas', () => {
    const points = steps(15);
    expect(detectCompactionLoop(points, compactionsAt(10, 20))).toBeNull();
    expect(detectCompactionLoop(points, compactionsAt(10))).toBeNull();
    expect(detectCompactionLoop(points, [])).toBeNull();
  });

  it('informa la racha más larga cuando hay varias', () => {
    // Racha de 3 (10–30), corte de 3 pasos, racha de 4 (70–100).
    const points = steps(15, 25, 41, 42, 43, 75, 85, 95);
    const loop = detectCompactionLoop(
      points,
      compactionsAt(10, 20, 30, 70, 80, 90, 100),
    );

    expect(loop).toEqual({ compactions: 4, steps: 3 });
  });
});
