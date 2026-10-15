import type {
  TContextCompaction,
  TContextGrowthPoint,
} from '@app/Domains/Graph/Graph.entity';

/** Sistema de coordenadas del gráfico (se estira con `preserveAspectRatio`). */
export const GROWTH_VIEW_WIDTH = 100;
export const GROWTH_VIEW_HEIGHT = 48;
/** Margen vertical para que el trazo no se corte en los bordes. */
const VERTICAL_PADDING = 1.5;

/** Muesca de una compactación sobre el eje de pasos. */
export interface TGrowthChartMark {
  id: string;
  x: number;
  failed: boolean;
}

export interface TGrowthChart {
  /** Atributo `points` de la línea, en coordenadas del `viewBox`. */
  line: string;
  marks: TGrowthChartMark[];
  /** Altura de la línea del límite del modelo; `null` sin límite conocido. */
  limitY: number | null;
}

/** Índice del último paso que empezó en `at` o antes; `-1` si no hay. */
const lastStepAtOrBefore = (
  points: TContextGrowthPoint[],
  at: number,
): number => {
  let index = -1;
  points.forEach((point, i) => {
    if (point.startedAt <= at) index = i;
  });
  return index;
};

/**
 * Geometría del gráfico de evolución del contexto. El eje X reparte los pasos
 * en partes iguales; el eje Y va de 0 al mayor entre la ventana máxima y el
 * límite del modelo, para no exagerar variaciones chicas. Cada compactación se
 * marca entre el último paso anterior y el primero posterior. Requiere al
 * menos dos puntos.
 */
export const buildGrowthChart = (
  points: TContextGrowthPoint[],
  compactions: TContextCompaction[],
  limitTokens: number | null,
): TGrowthChart => {
  const maxValue = Math.max(...points.map((point) => point.windowTokens));
  const top = Math.max(maxValue, limitTokens ?? 0) || 1;
  const plotHeight = GROWTH_VIEW_HEIGHT - 2 * VERTICAL_PADDING;
  const toY = (tokens: number) =>
    VERTICAL_PADDING + (1 - tokens / top) * plotHeight;
  const stepX = GROWTH_VIEW_WIDTH / (points.length - 1);

  const line = points
    .map(
      (point, index) =>
        `${(index * stepX).toFixed(2)},${toY(point.windowTokens).toFixed(2)}`,
    )
    .join(' ');

  const marks = compactions.map((compaction) => {
    const x = (lastStepAtOrBefore(points, compaction.at) + 0.5) * stepX;
    return {
      id: compaction.id,
      x: Math.min(Math.max(x, 0), GROWTH_VIEW_WIDTH),
      failed: compaction.status === 'failed',
    };
  });

  return {
    line,
    marks,
    limitY: limitTokens !== null && limitTokens > 0 ? toY(limitTokens) : null,
  };
};
