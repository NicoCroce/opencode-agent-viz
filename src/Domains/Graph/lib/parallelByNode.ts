import type {
  TGraphModel,
  TNodeParallelism,
  TParallelGroup,
} from '../Graph.entity';
import type { TInvocationBatch } from './invocations';
import { deriveParallelBatches } from './parallelism';

/**
 * Lotes de ejecución del modelo desde la **única** fuente fusionada (FR-008,
 * FR-012; contrato `invocation-lanes` §3-§4): la **invocación** gana cuando
 * existe —lotes por `stepId` del padre, con el `parentId` resuelto contra el
 * modelo— y el **solape de sesión** de `deriveSiblingBatches` es el respaldo
 * estructural (sin lotes, comportamiento intacto).
 *
 * Es el punto de fusión que alimenta a las **filas** (`deriveExecutionLevels`) y,
 * vía `deriveParallelGroups`, al **badge** (`toParallelByNode`): al derivar ambos
 * de la misma lista de lotes, la paridad fila ↔ badge (E5) no depende de que cada
 * consumidor repita el agrupamiento. Función pura, sin React (Principio V).
 */
export const deriveExecutionBatches = (
  model: TGraphModel,
  now: number,
  batches?: TInvocationBatch[],
): TParallelGroup[] => deriveParallelBatches(model, now, batches);

/**
 * Índice de paralelismo por id de nodo a partir de los grupos detectados por
 * `deriveParallelGroups`: cada nodo conoce su grupo y el tamaño de este.
 *
 * Función pura extraída de `useGraphStructure`; reutilizable por cualquier
 * vista que necesite resolver el paralelismo de un nodo por id.
 */
export const toParallelByNode = (
  groups: TParallelGroup[],
): Record<string, TNodeParallelism> => {
  const map: Record<string, TNodeParallelism> = {};
  for (const group of groups) {
    for (const id of group.nodeIds) {
      map[id] = { groupId: group.id, size: group.nodeIds.length };
    }
  }
  return map;
};
