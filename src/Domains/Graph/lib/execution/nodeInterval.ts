import type { TGraphNode } from '../../Graph.entity';

/**
 * Inicio del intervalo de ejecución de un nodo.
 *
 * Usa `createdAt` (creación de la sesión, estable y disponible apenas cargan
 * las sesiones) y cae a `metrics.startedAt`; si ninguno existe, devuelve `0`.
 */
export const startOf = (node: TGraphNode): number =>
  node.data.createdAt ?? node.data.metrics.startedAt ?? 0;

/**
 * Fin del intervalo de ejecución de un nodo.
 *
 * Usa `updatedAt` (`time.idle ?? time.updated`) y cae a `metrics.endedAt` o a
 * `now`.
 */
export const endOf = (node: TGraphNode, now: number): number =>
  node.data.updatedAt ?? node.data.metrics.endedAt ?? now;

/**
 * Intervalo `[inicio, fin]` de ejecución de un nodo, unificando
 * `executionLevels.startOf`/`endOf` con `parallelism.intervalOf`.
 *
 * DECISIÓN DE UNIFICACIÓN (cambio de comportamiento consciente): el fallback
 * del inicio es `0` (comportamiento de `executionLevels`), **no** `now`
 * (comportamiento que tenía `parallelism.intervalOf`). Un nodo sin
 * `createdAt`/`startedAt` se ordena así como el más antiguo en vez de agruparse
 * con "ahora", que es lo que hacía `intervalOf`; esto alinea orden y
 * agrupamiento, pero **cambia comportamiento** cuando falta `createdAt`, por lo
 * que requiere revisar `lib/specs/executionLevels.spec.ts` y los specs de
 * paralelismo (no se tocaron en este cambio). Se conserva el clamp
 * `Math.max(start, end)` de `intervalOf` para garantizar un intervalo válido.
 */
export const nodeInterval = (
  node: TGraphNode,
  now: number,
): [number, number] => {
  const start = startOf(node);
  const end = endOf(node, now);
  return [start, Math.max(start, end)];
};
