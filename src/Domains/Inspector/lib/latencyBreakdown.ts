import { formatDuration, formatTokens } from '@app/Application/Helpers';
import type { TLatencySample, TModelPace } from '@app/Domains/Graph/Graph.entity';
import { MIN_EXCESS_MS } from '@app/Domains/Graph/lib/metrics/latency';
import { MIN_PACE_SAMPLES } from '@app/Domains/Graph/lib/metrics/modelPace';

/**
 * Duración con un decimal por debajo de 10 s (`1.8s`); por encima, igual que
 * `formatDuration`. Las respuestas suelen durar pocos segundos y truncar a
 * segundos enteros oculta diferencias de hasta el doble.
 */
export const formatLatency = (ms: number | null | undefined): string =>
  ms !== null && ms !== undefined && ms >= 1000 && ms < 10_000
    ? `${(ms / 1000).toFixed(1)}s`
    : formatDuration(ms);

/** En qué se fue el tiempo de una respuesta. */
export type TLatencyPartKind = 'model' | 'tools' | 'subagents' | 'human';

export interface TLatencyPart {
  kind: TLatencyPartKind;
  ms: number;
}

export interface TLatencyShare extends TLatencyPart {
  /** Porcentaje sobre la suma de los tramos (0..100). */
  pct: number;
}

/** Etiquetas de cada tramo, para el reparto del nodo. */
export const LATENCY_PART_LABEL: Record<TLatencyPartKind, string> = {
  model: 'Modelo generando',
  tools: 'Herramientas',
  subagents: 'Subagentes',
  human: 'Esperando al usuario',
};

/** Etiquetas cortas de cada tramo, para el desglose de una respuesta. */
const PART_SHORT_LABEL: Record<TLatencyPartKind, string> = {
  model: 'modelo',
  tools: 'herramientas',
  subagents: 'subagentes',
  human: 'esperando al usuario',
};

const partsOf = (sample: TLatencySample): TLatencyPart[] => [
  { kind: 'model', ms: sample.generationMs ?? 0 },
  { kind: 'tools', ms: sample.toolMs },
  { kind: 'subagents', ms: sample.subagentMs },
  { kind: 'human', ms: sample.humanMs },
];

/**
 * Tramos con tiempo de una respuesta, de mayor a menor: el primero es la causa
 * principal de su duración. Vacío si no hay ninguno medido.
 */
export const latencyParts = (sample: TLatencySample): TLatencyPart[] =>
  partsOf(sample)
    .filter((part) => part.ms > 0)
    .sort((a, b) => b.ms - a.ms);

/**
 * Reparto del tiempo de todas las respuestas del nodo por tramo, en orden fijo
 * (modelo, herramientas, subagentes, usuario) y sin los tramos vacíos. `[]` sin
 * tiempo medido.
 */
export const summarizeLatency = (samples: TLatencySample[]): TLatencyShare[] => {
  const totals = new Map<TLatencyPartKind, number>();
  for (const sample of samples) {
    for (const part of partsOf(sample)) {
      totals.set(part.kind, (totals.get(part.kind) ?? 0) + part.ms);
    }
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  if (sum <= 0) return [];
  return [...totals]
    .filter(([, ms]) => ms > 0)
    .map(([kind, ms]) => ({ kind, ms, pct: (ms / sum) * 100 }));
};

/** Texto de un tramo de una respuesta, con su detalle si lo tiene. */
const partText = (part: TLatencyPart, sample: TLatencySample): string => {
  const base = `${PART_SHORT_LABEL[part.kind]} ${formatLatency(part.ms)}`;
  if (part.kind === 'tools' && sample.topTool !== null) {
    return `${base} (${sample.topTool})`;
  }
  if (part.kind === 'model' && sample.outputTokens !== null) {
    const expected =
      sample.expectedMs === null
        ? ''
        : `; esperado ${formatLatency(sample.expectedMs)}`;
    return `${base} (${formatTokens(sample.outputTokens)} tok${expected})`;
  }
  return base;
};

/**
 * Desglose legible de una respuesta: los tramos de mayor a menor (el primero
 * es la causa principal) y, al final, la primera salida si se conoce.
 */
export const describeLatencySample = (sample: TLatencySample): string[] => {
  const texts = latencyParts(sample).map((part) => partText(part, sample));
  if (sample.firstOutputMs !== null) {
    texts.push(`1.ª salida ${formatLatency(sample.firstOutputMs)}`);
  }
  return texts;
};

/** Ritmo de un modelo: base + milisegundos por token y respuestas medidas. */
export const describePace = (pace: TModelPace): string =>
  `${formatLatency(pace.baseMs)} + ${pace.msPerToken.toFixed(1)} ms/tok · ${
    pace.samples
  } resp.`;

/** Aviso cuando ningún modelo del nodo tiene datos para estimar su ritmo. */
export const NO_PACE_LABEL = `sin datos suficientes (mín. ${MIN_PACE_SAMPLES} respuestas del modelo)`;

/** Qué significa el umbral de lentitud, junto a su control. */
export const THRESHOLD_HINT = `Una respuesta es lenta si el modelo tarda más que este múltiplo de lo esperado para sus tokens y se pasa en al menos ${formatLatency(
  MIN_EXCESS_MS,
)}. Las esperas de herramientas, subagentes y del usuario no cuentan.`;
