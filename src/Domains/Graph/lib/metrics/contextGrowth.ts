import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type {
  TCompactionEffect,
  TContextCompaction,
  TContextGrowthPoint,
} from '../../Graph.entity';

/**
 * Deriva la evolución del contexto de un agente (FR-016;
 * `contracts/context-metrics-contract.md` §2). Un punto por mensaje assistant con
 * `tokens`; `windowTokens` es la ventana del paso (`input + cache.read +
 * cache.write`), la misma definición que la composición (research R1). Ordenada
 * por `time.created` ascendente. Función pura y memoizable por identidad de
 * `messages`.
 */
export const deriveContextGrowth = (
  messages: TSessionMessage[],
): TContextGrowthPoint[] =>
  messages
    .flatMap(({ info }) => {
      if (info.type !== 'assistant' || info.tokens === undefined) return [];
      const { input, cache } = info.tokens;
      return [
        {
          stepId: info.id,
          startedAt: info.time.created,
          windowTokens: input + cache.read + cache.write,
        },
      ];
    })
    .sort((a, b) => a.startedAt - b.startedAt);

/**
 * Compactaciones observadas en la sesión (FR-016), en orden temporal. Cada
 * episodio conserva su estado y motivo reales (`SessionMessageCompaction`),
 * nunca un resultado inventado (SC-007).
 */
export const deriveContextCompactions = (
  messages: TSessionMessage[],
): TContextCompaction[] =>
  messages
    .flatMap(({ info }) => {
      if (info.type !== 'compaction') return [];
      return [
        {
          id: info.id,
          at: info.time.created,
          status: info.status,
          reason: info.reason,
        },
      ];
    })
    .sort((a, b) => a.at - b.at);

/**
 * Efecto de una compactación sobre la ventana de contexto: compara la ventana
 * del último paso anterior con la del primero posterior. Sin pasos a un lado, el
 * extremo es `null` (no se inventa el efecto).
 */
export const deriveCompactionEffect = (
  growth: TContextGrowthPoint[],
  compaction: TContextCompaction,
): TCompactionEffect => {
  const beforePoints = growth.filter((point) => point.startedAt <= compaction.at);
  const before =
    beforePoints[beforePoints.length - 1]?.windowTokens ?? null;
  const after =
    growth.find((point) => point.startedAt > compaction.at)?.windowTokens ?? null;
  return { before, after };
};
