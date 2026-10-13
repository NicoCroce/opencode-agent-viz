/**
 * Re-exporta el umbral de anomalía desde `Application` (capa base). El contrato
 * `latency-anomaly-contract` §4 sitúa estas constantes aquí; la definición vive
 * en `Application/Helpers/anomalyThreshold` para que el grafo y el panel de
 * detalle compartan una sola fuente sin acoplarse entre dominios.
 */
export {
  ANOMALY_THRESHOLD_STORAGE_KEY,
  DEFAULT_ANOMALY_THRESHOLD,
  MAX_ANOMALY_THRESHOLD,
  MIN_ANOMALY_THRESHOLD,
  clampThreshold,
  readStoredThreshold,
  writeStoredThreshold,
} from '@app/Application/Helpers/anomalyThreshold';
