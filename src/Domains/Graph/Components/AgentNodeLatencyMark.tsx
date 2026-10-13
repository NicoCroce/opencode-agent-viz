import { cn } from '@app/Application/lib/utils';
import type { TLatencyAnomaly, TLatencyReport } from '../Graph.entity';

interface AgentNodeLatencyMarkProps {
  /** Serie de latencia del nodo; `null` hasta el enriquecimiento (US5). */
  latency: TLatencyReport | null;
}

/**
 * Última muestra del nodo, si su latencia es anómala (FR-023). La marca refleja
 * la respuesta **más reciente** (contrato `latency-anomaly-contract` §5/L8): una
 * anomalía pasada ya corregida no deja el nodo marcado. `null` si no hay serie,
 * muestras, anomalías o si la última muestra entró en la banda.
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
 * Marca de anomalía de latencia del nodo (FR-021/FR-023;
 * `latency-anomaly-contract` §5). Compacta, va en el cluster del encabezado
 * junto al badge de aceleración y **no añade filas** al card (`cardHeight`).
 * La dirección se distingue por texto (`lenta`/`rápida`) además del color, y la
 * etiqueta accesible completa ("Respuesta lenta"/"Respuesta rápida") viaja en
 * `aria-label`/`title`: la información no depende solo del color (a11y).
 */
export const AgentNodeLatencyMark = ({
  latency,
}: AgentNodeLatencyMarkProps) => {
  const anomaly = lastLatencyAnomaly(latency);
  if (!anomaly) return null;

  const slow = anomaly.direction === 'slow';
  const label = slow ? 'Respuesta lenta' : 'Respuesta rápida';

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-testid="node-latency-mark"
      className={cn(
        'rounded-flat border px-1 font-mono text-[10px] leading-4',
        slow
          ? 'border-status-error/60 text-status-error'
          : 'border-status-waiting/60 text-status-waiting',
      )}
    >
      {slow ? '▲ lenta' : '▼ rápida'}
    </span>
  );
};
