import type {
  TContextCompaction,
  TContextGrowthPoint,
} from '@app/Domains/Graph/Graph.entity';

/** Máximo de pasos entre dos compactaciones para considerarlas seguidas. */
export const LOOP_MAX_GAP_STEPS = 2;
/** Mínimo de compactaciones seguidas para sospechar un bucle. */
export const LOOP_MIN_COMPACTIONS = 3;

/** Racha de compactaciones casi consecutivas (posible bucle). */
export interface TCompactionLoop {
  /** Compactaciones de la racha. */
  compactions: number;
  /** Pasos medidos entre la primera y la última compactación de la racha. */
  steps: number;
}

const stepsBetween = (
  points: TContextGrowthPoint[],
  from: number,
  to: number,
): number =>
  points.filter((point) => point.startedAt > from && point.startedAt < to)
    .length;

/**
 * Detecta un bucle de compactación: la racha más larga de compactaciones
 * separadas por `LOOP_MAX_GAP_STEPS` pasos o menos. Una compactación sana deja
 * espacio para muchos pasos; si se repite casi en cada respuesta, compactar no
 * libera contexto (p. ej. un `compaction.buffer` mayor que el límite del
 * modelo). Devuelve `null` si la racha no llega a `LOOP_MIN_COMPACTIONS`.
 */
export const detectCompactionLoop = (
  points: TContextGrowthPoint[],
  compactions: TContextCompaction[],
): TCompactionLoop | null => {
  let first = 0;
  let last = 0;
  let start = 0;

  for (let index = 1; index < compactions.length; index++) {
    const gap = stepsBetween(points, compactions[index - 1].at, compactions[index].at);
    if (gap > LOOP_MAX_GAP_STEPS) start = index;
    if (index - start > last - first) {
      first = start;
      last = index;
    }
  }

  const size = last - first + 1;
  if (size < LOOP_MIN_COMPACTIONS) return null;
  return {
    compactions: size,
    steps: stepsBetween(points, compactions[first].at, compactions[last].at),
  };
};
