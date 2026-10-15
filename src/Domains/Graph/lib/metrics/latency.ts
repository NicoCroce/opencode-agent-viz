import type {
  TContentPart,
  TSessionMessage,
} from '@app/Infrastructure/Services/opencodeClient';
import type {
  TLatencyAnomaly,
  TLatencyReport,
  TLatencySample,
  TModelPace,
} from '../../Graph.entity';
import { DEFAULT_ANOMALY_THRESHOLD } from './anomalyThreshold';

/**
 * Exceso mínimo sobre lo esperado para marcar una respuesta. Evita marcar
 * respuestas cortas: 3 s cuando se esperaba 1 s duplica, pero no importa.
 */
export const MIN_EXCESS_MS = 5000;

/** Piso de la generación esperada: ninguna respuesta tarda menos que esto. */
export const MIN_EXPECTED_MS = 500;

/** Herramientas que esperan a otro agente. */
const SUBAGENT_TOOLS = new Set(['subagent', 'task']);

/** Herramientas que esperan a que el usuario conteste. */
const HUMAN_TOOLS = new Set(['question']);

type TToolPart = Extract<TContentPart, { type: 'tool' }>;
type TInterval = [number, number];

/** Mediana de una lista de números; `null` si está vacía. Función pura. */
export const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

/** Clave del modelo de una respuesta: `providerID/id`. */
export const modelKey = (model: { providerID: string; id: string }): string =>
  `${model.providerID}/${model.id}`;

/** Duración de la unión de intervalos (los solapados cuentan una vez). */
const unionMs = (intervals: TInterval[]): number => {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current: TInterval | null = null;
  for (const [start, end] of sorted) {
    if (current === null || start > current[1]) {
      if (current) total += current[1] - current[0];
      current = [start, end];
    } else {
      current[1] = Math.max(current[1], end);
    }
  }
  return current ? total + current[1] - current[0] : total;
};

/** Intervalo de ejecución de una herramienta; `null` si no terminó. */
const toolInterval = (part: TToolPart): TInterval | null => {
  const start = part.time.ran ?? part.time.created;
  const end = part.time.completed;
  return end === undefined || end < start ? null : [start, end];
};

/** Desglose de herramientas de una respuesta por tipo de espera. */
const toolBreakdown = (tools: TToolPart[]) => {
  const human: TInterval[] = [];
  const subagent: TInterval[] = [];
  const other: TInterval[] = [];
  const byName = new Map<string, number>();

  for (const part of tools) {
    const interval = toolInterval(part);
    if (!interval) continue;
    if (HUMAN_TOOLS.has(part.name)) human.push(interval);
    else if (SUBAGENT_TOOLS.has(part.name)) subagent.push(interval);
    else {
      other.push(interval);
      byName.set(
        part.name,
        (byName.get(part.name) ?? 0) + interval[1] - interval[0],
      );
    }
  }

  let topTool: string | null = null;
  let topMs = 0;
  for (const [name, ms] of byName) {
    if (ms > topMs) {
      topTool = name;
      topMs = ms;
    }
  }

  return {
    toolMs: unionMs(other),
    subagentMs: unionMs(subagent),
    humanMs: unionMs(human),
    topTool,
  };
};

/** Desde `created` hasta el primer razonamiento o herramienta con hora. */
const firstOutputOf = (content: TContentPart[], created: number): number | null => {
  let first = Infinity;
  for (const part of content) {
    if (part.type === 'tool') first = Math.min(first, part.time.created);
    else if (part.type === 'reasoning' && part.time) {
      first = Math.min(first, part.time.created);
    }
  }
  return Number.isFinite(first) ? Math.max(0, first - created) : null;
};

/** Generación esperada para un ritmo y unos tokens, con piso `MIN_EXPECTED_MS`. */
export const expectedGenerationMs = (pace: TModelPace, tokens: number): number =>
  Math.max(MIN_EXPECTED_MS, pace.baseMs + pace.msPerToken * tokens);

/**
 * Muestras de latencia de las respuestas assistant con `time.completed`
 * (FR-018), ordenadas por inicio. `expectedMs` sale del ritmo del modelo
 * (`paces`), si lo hay y la respuesta reporta tokens.
 */
export const latencySamples = (
  messages: TSessionMessage[],
  paces: Record<string, TModelPace> = {},
): TLatencySample[] =>
  messages
    .flatMap(({ info }): TLatencySample[] => {
      if (info.type !== 'assistant') return [];
      const { created, streamed, completed } = info.time;
      if (completed === undefined) return [];

      const model = info.model ? modelKey(info.model) : null;
      const outputTokens = info.tokens
        ? info.tokens.output + info.tokens.reasoning
        : null;
      const pace = model === null ? undefined : paces[model];
      const tools = info.content.filter(
        (part): part is TToolPart => part.type === 'tool',
      );

      return [
        {
          stepId: info.id,
          startedAt: created,
          model,
          firstOutputMs: firstOutputOf(info.content, created),
          generationMs: streamed === undefined ? null : streamed - created,
          totalMs: completed - created,
          ...toolBreakdown(tools),
          outputTokens,
          expectedMs:
            pace && outputTokens !== null
              ? expectedGenerationMs(pace, outputTokens)
              : null,
        },
      ];
    })
    .sort((a, b) => a.startedAt - b.startedAt);

/**
 * Marca las respuestas cuya generación supera `(1 + threshold) ×` lo esperado
 * **y** lo excede en al menos `MIN_EXCESS_MS` (FR-021). Solo cuenta el tiempo
 * del modelo: las esperas de herramientas, subagentes y usuario no son
 * anomalías. La rapidez no se marca.
 */
export const detectAnomalies = (
  samples: TLatencySample[],
  threshold: number,
): TLatencyAnomaly[] => {
  const anomalies: TLatencyAnomaly[] = [];
  for (const sample of samples) {
    const { generationMs, expectedMs } = sample;
    if (generationMs === null || expectedMs === null || expectedMs <= 0) continue;
    const ratio = generationMs / expectedMs;
    const excessMs = generationMs - expectedMs;
    if (ratio > 1 + threshold && excessMs >= MIN_EXCESS_MS) {
      anomalies.push({ stepId: sample.stepId, ratio, expectedMs, excessMs });
    }
  }
  return anomalies;
};

/**
 * Serie de latencia de un nodo con su desglose y sus anomalías (FR-018..FR-021).
 * `paces` es el ritmo por modelo estimado con todo el grafo (`deriveModelPaces`);
 * sin ritmo para un modelo, sus respuestas no se evalúan.
 */
export const deriveLatency = (
  messages: TSessionMessage[],
  options: { threshold?: number; paces?: Record<string, TModelPace> } = {},
): TLatencyReport => {
  const threshold = options.threshold ?? DEFAULT_ANOMALY_THRESHOLD;
  const allPaces = options.paces ?? {};
  const samples = latencySamples(messages, allPaces);

  const used = new Set(
    samples.flatMap((sample) => (sample.model === null ? [] : [sample.model])),
  );
  const paces = [...used]
    .sort()
    .flatMap((model) => (allPaces[model] ? [allPaces[model]] : []));

  return { samples, paces, anomalies: detectAnomalies(samples, threshold) };
};
