import type { TGraphModel, TGraphNode } from '../Graph.entity';
import { isActiveStatus } from './nodeStatus';

/**
 * Inicio de actividad de un nodo para el seguimiento (FR-005): la hora de
 * **inicio de ejecución**, `metrics.startedAt ?? createdAt ?? 0`.
 *
 * Helper propio y **distinto** del `startOf` de `lib/execution/nodeInterval.ts`
 * (precedencia inversa `createdAt ?? metrics.startedAt`): aquí la creación de la
 * sesión es solo el último recurso, porque interesa cuándo *empezó a trabajar*
 * el nodo, no cuándo se creó su sesión.
 */
export const activityStartOf = (node: TGraphNode): number =>
  node.data.metrics.startedAt ?? node.data.createdAt ?? 0;

/**
 * Id del nodo activo más reciente (FR-005, SC-003): entre los nodos
 * `isActiveStatus`, el de mayor `activityStartOf(node)`; desempate determinista
 * por `id` lexicográfico ascendente (mismo criterio que el resto del grafo, p.
 * ej. `deriveExecutionLevels`/`compareByTimeThenId`). Devuelve `null` si no hay
 * ningún nodo activo (FR-007), de modo que el viewport no se mueva.
 *
 * Función pura, sin React: se testea sin montar hooks (Principio V).
 */
export const latestActiveNodeId = (model: TGraphModel): string | null => {
  let latest: TGraphNode | null = null;

  for (const node of model.nodes) {
    if (!isActiveStatus(node.data.status)) continue;

    if (latest === null) {
      latest = node;
      continue;
    }

    const start = activityStartOf(node);
    const latestStart = activityStartOf(latest);
    const isLater =
      start > latestStart ||
      (start === latestStart && node.id.localeCompare(latest.id) < 0);

    if (isLater) latest = node;
  }

  return latest?.id ?? null;
};
