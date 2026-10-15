import type {
  TLatencyAnomaly,
  TLatencyReport,
  TLatencySample,
} from '@app/Domains/Graph/Graph.entity';

/** Muestra de latencia sin esperas, con los campos que el spec no fije. */
export const latencySample = (
  overrides: Partial<TLatencySample> = {},
): TLatencySample => ({
  stepId: 's1',
  startedAt: 0,
  model: 'p/m',
  firstOutputMs: null,
  generationMs: 100,
  totalMs: 1000,
  toolMs: 0,
  subagentMs: 0,
  humanMs: 0,
  topTool: null,
  outputTokens: null,
  expectedMs: null,
  ...overrides,
});

/** Anomalía de latencia: por defecto, 2,4× lo esperado. */
export const latencyAnomaly = (
  overrides: Partial<TLatencyAnomaly> = {},
): TLatencyAnomaly => ({
  stepId: 's1',
  ratio: 2.4,
  expectedMs: 5000,
  excessMs: 7000,
  ...overrides,
});

/** Informe de latencia vacío salvo lo que fije el spec. */
export const latencyReport = (
  overrides: Partial<TLatencyReport> = {},
): TLatencyReport => ({
  samples: [],
  paces: [],
  anomalies: [],
  ...overrides,
});
