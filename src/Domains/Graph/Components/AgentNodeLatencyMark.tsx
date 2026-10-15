import { formatSpeedup } from '@app/Application/Helpers';
import type { TLatencyAnomaly, TLatencyReport } from '../Graph.entity';

interface AgentNodeLatencyMarkProps {
  /** Serie de latencia del nodo; `null` hasta el enriquecimiento (US5). */
  latency: TLatencyReport | null;
}

/**
 * Última muestra del nodo, si fue lenta (FR-023). La marca refleja la respuesta
 * **más reciente** (contrato `latency-anomaly-contract` §6/L8): una anomalía
 * pasada ya corregida no deja el nodo marcado. `null` si no hay serie,
 * muestras, anomalías o si la última muestra tardó lo esperado.
 */
export const lastLatencyAnomaly = (
  latency: TLatencyReport | null,
): TLatencyAnomaly | null => {
  if (!latency || latency.samples.length === 0 || latency.anomalies.length === 0) {
    return null;
  }
  const lastSample = latency.samples[latency.samples.length - 1];
  return (
    latency.anomalies.find((anomaly) => anomaly.stepId === lastSample.stepId) ??
    null
  );
};

/**
 * Marca de respuesta lenta del nodo (FR-021/FR-023;
 * `latency-anomaly-contract` §6): el modelo tardó más de lo esperado para los
 * tokens que generó. Compacta, va en el cluster del encabezado junto al badge
 * de aceleración y **no añade filas** al card (`cardHeight`). El texto «lenta»
 * acompaña al color y la etiqueta accesible lleva la magnitud (a11y).
 */
export const AgentNodeLatencyMark = ({
  latency,
}: AgentNodeLatencyMarkProps) => {
  const anomaly = lastLatencyAnomaly(latency);
  if (!anomaly) return null;

  const label = `Respuesta lenta: ${formatSpeedup(
    anomaly.ratio,
  )} lo esperado para sus tokens`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-testid="node-latency-mark"
      className="rounded-flat border border-status-error/80 px-1 font-mono text-[10px] leading-4 text-status-error"
    >
      ▲ lenta
    </span>
  );
};
