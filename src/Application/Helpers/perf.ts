export const PERF_METRIC = {
  sessionOpen: 'graph.session.open',
  sessionRevisit: 'graph.session.revisit',
  interaction: 'graph.interaction',
} as const;

export type TPerfMetricName = (typeof PERF_METRIC)[keyof typeof PERF_METRIC];

const isPerformanceAvailable = (): boolean =>
  typeof performance !== 'undefined' &&
  typeof performance.mark === 'function' &&
  typeof performance.measure === 'function';

const debugPerf = (name: string, detail?: Record<string, unknown>): void => {
  if (import.meta.env.DEV) {
    console.debug(`[perf] ${name}`, detail ?? {});
  }
};

export const perfMark = (name: string): void => {
  if (!isPerformanceAvailable()) return;
  try {
    performance.mark(name);
    debugPerf(name);
  } catch {
    // La instrumentación nunca debe interrumpir la app (contrato §3).
  }
};

export const perfMeasure = (
  name: TPerfMetricName,
  startMark: string,
  detail?: Record<string, unknown>,
): number | null => {
  if (!isPerformanceAvailable()) return null;
  try {
    const entry = performance.measure(name, { start: startMark, detail });
    debugPerf(name, detail);
    return entry.duration;
  } catch {
    return null;
  }
};
