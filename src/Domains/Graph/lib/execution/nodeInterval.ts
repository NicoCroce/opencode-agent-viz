import type { TGraphNode } from '../../Graph.entity';
import { isActiveStatus } from '../nodeStatus';

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
 * Un nodo en estado activo (`isActiveStatus`) se considera **abierto hasta el
 * presente observado**, por lo que devuelve `now`. Un nodo terminado usa su fin
 * real: `updatedAt` (`time.idle ?? time.updated`) y cae a `metrics.endedAt` o a
 * `now`. La apertura **nunca** se infiere de datos ausentes (FR-011): solo el
 * estado activo explícito la habilita.
 */
export const endOf = (node: TGraphNode, now: number): number =>
  isActiveStatus(node.data.status)
    ? now
    : node.data.updatedAt ?? node.data.metrics.endedAt ?? now;

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

/**
 * Intervalo de **solape** de un nodo para el agrupamiento de hermanos.
 *
 * El fin abierto de un activo se modela como `+∞`: para decidir solape es
 * equivalente a evaluar en cualquier `now ≥ max(inicio)`, y así el agrupamiento
 * queda **independiente del reloj** (Principio V, FR-008). Un terminado se
 * cierra con su fin real (`endOf(node, 0)`), nunca con `now`, de modo que un
 * terminado sin datos de fin no se confunde con un activo (FR-011).
 *
 * Se conserva el clamp `Math.max(inicio, fin)` para garantizar un intervalo
 * válido. Una sola lógica de intervalos compartida con `parallelism.ts`
 * (FR-010).
 */
export const executionInterval = (node: TGraphNode): [number, number] => {
  const start = startOf(node);
  const end = isActiveStatus(node.data.status)
    ? Number.POSITIVE_INFINITY
    : endOf(node, 0);
  return [start, Math.max(start, end)];
};
