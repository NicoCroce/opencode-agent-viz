/**
 * Fachada pública de métricas del grafo (DC-07). Re-exporta la API exacta que
 * consumían `buildGraph`, `useGraphEnrichment`, `WorkspacePage`, el barrel
 * `Graph/index.ts` y los specs. La implementación vive en `./metrics/*`,
 * cortada por fase: acumulación de tokens → base sin reloj → resolución por
 * reloj → agregación de sesión.
 */
export type { TSessionMessageLike } from './metrics/deriveMetricBase';
export { deriveMetricBase } from './metrics/deriveMetricBase';
export type { DeriveMetricsInput } from './metrics/resolveMetrics';
export {
  deriveMetrics,
  resolveMetrics,
} from './metrics/resolveMetrics';
export { summarizeSession } from './metrics/summarizeSession';
