import type { TGraphModel, TGraphNode } from '../../Graph.entity';
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
 * Es la clave de memo del plan de filas/columnas y del paralelismo: cambia
 * **solo** cuando cambia la topología o la clase/borde de intervalo de algún
 * nodo (FR-003). No reacciona a eventos de contenido/estado no estructurales ni
 * al tick de 1 s (FR-007, SC-004). Es pura, determinística y sin reloj: nunca
 * usa `Date.now()`.
 */
const terminatedEnd = (node: TGraphNode): string => {
  if (node.data.updatedAt != null) return `u:${node.data.updatedAt}`;
  if (node.data.metrics.endedAt != null) return `m:${node.data.metrics.endedAt}`;
  return '0';
};

export const deriveExecutionKey = (model: TGraphModel): string => {
  const nodeParts = model.nodes
    .map((node) => {
      const end = isActiveStatus(node.data.status) ? 'open' : terminatedEnd(node);
      return `${node.id}:${startOf(node)}:${end}`;
    })
    .sort()
    .join('|');

  return `${topologySignature(model)}|${nodeParts}`;
};
