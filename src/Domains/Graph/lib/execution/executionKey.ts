import type { TGraphModel, TGraphNode } from '../../Graph.entity';
import type { TInvocationBatch } from '../invocations';
import { topologySignature } from '../layoutGraph';
import { isActiveStatus } from '../nodeStatus';
import { startOf } from './nodeInterval';

/**
 * Clave de ejecución del modelo (contract execution-lanes §3, data-model §2.3).
 *
 * Compone la firma de topología (`topologySignature`) con, por nodo, su clase
 * de intervalo: `id:startOf:('open' | finSinReloj)`. Un nodo activo
 * (`isActiveStatus`) queda abierto (`'open'`), independiente de su marca de
 * actividad; un terminado usa su fin real (`updatedAt ?? metrics.endedAt ?? 0`).
 *
 * El fin de un terminado se etiqueta con su **fuente** (`u:` para `updatedAt`,
 * `m:` para el fallback `metrics.endedAt`, `0` sin fin): la clave así distingue
 * un fin real de un fin por fallback aunque el valor coincida, tal como exige
 * `specs/executionKey.spec.ts` (E3). En la práctica ambos producen el mismo
 * borde de intervalo, pero el spec trata el cambio de fuente como estructural.
 *
 * **Firma de lotes (FR-008, research R8)**: el tercer componente es la firma de
 * los lotes de invocación (ids del paso, padre y miembros). El plan de
 * filas/columnas y el badge se memoizan por esta clave, y al llegar los mensajes
 * del padre **solo** cambian los lotes: sin esta firma el arreglo del
 * paralelismo sería un no-op silencioso. La firma se normaliza (lotes y
 * miembros ordenados), así que no depende del orden de ninguno de los dos.
 *
 * Es la clave de memo del plan de filas/columnas y del paralelismo: cambia
 * **solo** cuando cambia la topología, la clase/borde de intervalo de algún
 * nodo (FR-003) o la firma de lotes. No reacciona a eventos de contenido/estado
 * no estructurales ni al tick de 1 s (FR-007, SC-004). Es pura, determinística y
 * sin reloj: nunca usa `Date.now()`.
 */
const terminatedEnd = (node: TGraphNode): string => {
  if (node.data.updatedAt != null) return `u:${node.data.updatedAt}`;
  if (node.data.metrics.endedAt != null) return `m:${node.data.metrics.endedAt}`;
  return '0';
};

/** Firma de lotes: `stepId:parentId:miembro+miembro`, ordenada por lote. */
const batchesSignature = (batches: TInvocationBatch[]): string =>
  batches
    .map(
      (batch) =>
        `${batch.stepId}:${batch.parentId ?? ''}:${[...batch.sessionIds].sort().join('+')}`,
    )
    .sort()
    .join(';');

export const deriveExecutionKey = (
  model: TGraphModel,
  batches: TInvocationBatch[] = [],
): string => {
  const nodeParts = model.nodes
    .map((node) => {
      const end = isActiveStatus(node.data.status) ? 'open' : terminatedEnd(node);
      return `${node.id}:${startOf(node)}:${end}`;
    })
    .sort()
    .join('|');

  return `${topologySignature(model)}|${nodeParts}|${batchesSignature(batches)}`;
};

