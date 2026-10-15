import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import type {
  TLatencyAnomaly,
  TLatencyReport,
  TLatencySample,
} from '../../Graph.entity';
import { DEFAULT_ANOMALY_THRESHOLD } from './anomalyThreshold';

/** Mínimo de muestras propias con `totalMs` para usar la mediana del nodo. */
export const MIN_SAMPLES = 3;

/** Mediana de una lista de números; `null` si está vacía. Función pura. */
export const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

/**
 * Muestras de latencia de una respuesta assistant (FR-018): `generationMs` es el
 * tiempo de generación del modelo (`streamed − created`) y `totalMs` la latencia
 * total (`completed − created`). `streamed` marca el **fin** del stream, no el
 * primer token. Solo los mensajes con `time.completed`.
 */
const samplesOf = (messages: TSessionMessage[]): TLatencySample[] =>
  messages
    .flatMap(({ info }) => {
      if (info.type !== 'assistant') return [];
      const { created, streamed, completed } = info.time;
      if (completed === undefined) return [];
      return [
        {
          stepId: info.id,
          startedAt: created,
          generationMs: streamed === undefined ? null : streamed - created,
          totalMs: completed - created,
        },
      ];
    })
    .sort((a, b) => a.startedAt - b.startedAt);

/**
 * Marca las muestras fuera de la banda `[1 − threshold, 1 + threshold]`
 * (FR-021; `latency-anomaly-contract` §3). La dirección es `'slow'` por encima
 * y `'fast'` por debajo: la rapidez anómala se alerta igual que la lentitud.
 * Sin referencia no hay anomalías.
 */
export const detectAnomalies = (
  samples: TLatencySample[],
  referenceMs: number | null,
  reference: 'node' | 'agent',
  threshold: number,
): TLatencyAnomaly[] => {
  if (referenceMs === null || referenceMs <= 0) return [];

  const anomalies: TLatencyAnomaly[] = [];
  for (const sample of samples) {
    if (sample.totalMs === null) continue;
    const ratio = sample.totalMs / referenceMs;
    if (ratio > 1 + threshold) {
      anomalies.push({
        stepId: sample.stepId,
        ratio,
        direction: 'slow',
        referenceMs,
        reference,
      });
    } else if (ratio < 1 - threshold) {
      anomalies.push({
        stepId: sample.stepId,
        ratio,
        direction: 'fast',
        referenceMs,
        reference,
      });
    }
  }
  return anomalies;
};

/**
 * Deriva la serie de latencia de un nodo y detecta anomalías
 * (FR-018..FR-021; `latency-anomaly-contract` §2/§3). La referencia es la
 * mediana de `totalMs` del nodo con ≥ `MIN_SAMPLES` muestras; si no, la mediana
 * del mismo agente (`agentMedianMs`). Sin baseline, `anomalies` queda vacío.
 */
export const deriveLatency = (
  messages: TSessionMessage[],
  options: { threshold?: number; agentMedianMs?: number | null } = {},
): TLatencyReport => {
  const threshold = options.threshold ?? DEFAULT_ANOMALY_THRESHOLD;
  const samples = samplesOf(messages);

  const totals = samples
    .map((sample) => sample.totalMs)
    .filter((value): value is number => value !== null);

  let medianMs: number | null = null;
  let reference: 'node' | 'agent' | null = null;
  if (totals.length >= MIN_SAMPLES) {
    medianMs = median(totals);
    reference = 'node';
  } else if (options.agentMedianMs !== null && options.agentMedianMs !== undefined) {
    medianMs = options.agentMedianMs;
    reference = 'agent';
  }

  const anomalies =
    medianMs !== null && reference !== null
      ? detectAnomalies(samples, medianMs, reference, threshold)
      : [];

  return { samples, medianMs, reference, anomalies };
};
