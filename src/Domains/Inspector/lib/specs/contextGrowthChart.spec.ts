import { describe, expect, it } from 'vitest';
import type {
  TContextCompaction,
  TContextGrowthPoint,
} from '@app/Domains/Graph/Graph.entity';
import {
  buildGrowthChart,
  GROWTH_VIEW_HEIGHT,
  GROWTH_VIEW_WIDTH,
} from '../contextGrowthChart';

const points: TContextGrowthPoint[] = [
  { stepId: 'a1', startedAt: 10, windowTokens: 0 },
  { stepId: 'a2', startedAt: 20, windowTokens: 50_000 },
  { stepId: 'a3', startedAt: 30, windowTokens: 100_000 },
];

const compaction = (
  at: number,
  status: TContextCompaction['status'] = 'completed',
): TContextCompaction => ({ id: `c${at}`, at, status, reason: 'auto' });

const yOf = (line: string, index: number) =>
  Number(line.split(' ')[index].split(',')[1]);

describe('buildGrowthChart', () => {
  it('reparte los pasos a lo ancho y mide el eje Y desde 0', () => {
    const { line } = buildGrowthChart(points, [], null);
    const xs = line.split(' ').map((pair) => Number(pair.split(',')[0]));

    expect(xs).toEqual([0, GROWTH_VIEW_WIDTH / 2, GROWTH_VIEW_WIDTH]);
    // 0 tokens en el fondo, el máximo arriba, la mitad en el medio.
    expect(yOf(line, 0)).toBeCloseTo(GROWTH_VIEW_HEIGHT - 1.5);
    expect(yOf(line, 2)).toBeCloseTo(1.5);
    expect(yOf(line, 1)).toBeCloseTo(GROWTH_VIEW_HEIGHT / 2);
  });

  it('no estira una serie que no empieza en 0', () => {
    const flat = points.map((point) => ({ ...point, windowTokens: 90_000 }));
    flat[2] = { ...flat[2], windowTokens: 100_000 };
    const { line } = buildGrowthChart(flat, [], null);

    // 90k sobre 100k queda cerca del techo, no en el fondo.
    expect(yOf(line, 0)).toBeLessThan(GROWTH_VIEW_HEIGHT * 0.2);
  });

  it('con límite del modelo lo usa como techo y dibuja su línea', () => {
    const { line, limitY } = buildGrowthChart(points, [], 200_000);

    expect(limitY).toBeCloseTo(1.5);
    // 100k sobre un límite de 200k queda a media altura.
    expect(yOf(line, 2)).toBeCloseTo(GROWTH_VIEW_HEIGHT / 2);
  });

  it('si la ventana supera el límite, el techo es la ventana', () => {
    const { line, limitY } = buildGrowthChart(points, [], 50_000);

    expect(yOf(line, 2)).toBeCloseTo(1.5);
    expect(limitY).toBeCloseTo(GROWTH_VIEW_HEIGHT / 2);
  });

  it('sin límite no hay línea de límite', () => {
    expect(buildGrowthChart(points, [], null).limitY).toBeNull();
  });

  it('marca cada compactación entre el paso anterior y el siguiente', () => {
    const { marks } = buildGrowthChart(
      points,
      [compaction(15), compaction(25, 'failed')],
      null,
    );

    expect(marks).toEqual([
      { id: 'c15', x: GROWTH_VIEW_WIDTH / 4, failed: false },
      { id: 'c25', x: (GROWTH_VIEW_WIDTH * 3) / 4, failed: true },
    ]);
  });

  it('lleva a los bordes las compactaciones fuera de la serie', () => {
    const { marks } = buildGrowthChart(
      points,
      [compaction(5), compaction(40)],
      null,
    );

    expect(marks.map((mark) => mark.x)).toEqual([0, GROWTH_VIEW_WIDTH]);
  });
});
