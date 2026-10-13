import type { TSessionMessage } from '@app/Infrastructure/Services/opencodeClient';
import { deriveLatency, median } from './metrics/latency';

/**
 * Mediana de `totalMs` por agente (FR-012): agrupa las muestras de todos los
 * nodos de un mismo agente y devuelve su mediana. Es la referencia de respaldo
 * para los nodos con menos de `MIN_SAMPLES` muestras propias.
 *
 * Un agente sin ninguna muestra con `totalMs` (sin mensajes completados) queda a
 * `null`. Reutiliza `deriveLatency` y `median`; no reimplementa ninguna de las
 * dos, no abre consultas y no muta las entradas.
 */
export const deriveAgentMedians = (
  entries: ReadonlyArray<{ agent: string; messages: TSessionMessage[] }>,
): Record<string, number | null> => {
  const totalsByAgent = new Map<string, number[]>();

  for (const { agent, messages } of entries) {
    const totals = totalsByAgent.get(agent) ?? [];
    for (const sample of deriveLatency(messages).samples) {
      if (sample.totalMs !== null) totals.push(sample.totalMs);
    }
    totalsByAgent.set(agent, totals);
  }

  const medians: Record<string, number | null> = {};
  for (const [agent, totals] of totalsByAgent) {
    medians[agent] = median(totals);
  }
  return medians;
};
