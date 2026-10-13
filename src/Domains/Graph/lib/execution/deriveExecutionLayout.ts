import type {
  TGraphModel,
  TNodeParallelism,
  TParallelGroup,
} from '../../Graph.entity';
import { assembleStructuralGraph } from '../assembleStructuralGraph';
import { indexPositions } from '../indexPositions';
import type { TInvocationBatch } from '../invocations';
import { deriveExecutionBatches, toParallelByNode } from '../parallelByNode';
import {
  deriveExecutionLevels,
  type TExecutionPlan,
} from './deriveExecutionLevels';
import { layoutExecution } from './layoutRows';

/**
 * Resultado completo del layout de ejecución (contract execution-lanes §4,
 * data-model §2.5): el plan de filas/columnas, las posiciones indexadas por id,
 * los grupos paralelos, el badge de paralelismo por nodo y el grafo ya
 * posicionado con `data.parallel` aplicado.
 */
export interface TExecutionLayout {
  graph: TGraphModel;
  plan: TExecutionPlan;
  positions: Record<string, { x: number; y: number }>;
  parallelGroups: TParallelGroup[];
  parallelByNode: Record<string, TNodeParallelism>;
}

/**
 * Deriva el layout de ejecución completo de un modelo en una sola pasada pura.
 *
 * Compone las mismas piezas que usa la vista y que 006 ya tenía separadas, sin
 * duplicar lógica (FR-010):
 *
 * 1. `groups = deriveExecutionBatches(model, now, batches)` — **una única**
 *    fusión de lotes por plan (invocación del padre si existe, solape de sesión
 *    si no); el respaldo estructural `[]` queda intacto (FR-012).
 * 2. `plan = deriveExecutionLevels(model, now, batches, groups)` — niveles/tandas
 *    de esa misma fuente (los lotes se **inyectan**, sin reagrupar): columnas por
 *    instante de inicio y normalización padre→hijo.
 * 3. `positions = indexPositions(layoutExecution(model, plan).nodes)` — `x` por
 *    columna, `y` por carril; mismo nivel comparte fila.
 * 4. `parallelGroups = groups.filter(2+)` y `parallelByNode =
 *    toParallelByNode(parallelGroups)` — badge derivado de la **misma** lista de
 *    lotes que las filas (FR-010, paridad fila ↔ badge); la barra temporal del
 *    nodo **no** se toca (mantiene el intervalo de sesión).
 * 5. `graph = assembleStructuralGraph(model, positions, parallelByNode)` — el
 *    modelo con posiciones y `parallel` pegados, conservando aristas y datos.
 *
 * Es una función **pura y sin React** (FR-008): no muta la entrada (cada paso
 * devuelve un modelo nuevo) y **nunca** usa `Date.now()`. `now` solo alimenta
 * las ventanas informativas `startedAt`/`endedAt` de niveles y lotes; el
 * agrupamiento, los niveles y las columnas no dependen del reloj (FR-007,
 * SC-004, Principio V). El llamador (hook) es quien memoiza por
 * `deriveExecutionKey(model, batches)` y así deriva los lotes una vez por clave
 * (Principio VII).
 */
export const deriveExecutionLayout = (
  model: TGraphModel,
  now: number,
  batches: TInvocationBatch[] = [],
): TExecutionLayout => {
  const groups = deriveExecutionBatches(model, now, batches);
  const plan = deriveExecutionLevels(model, now, batches, groups);
  const positions = indexPositions(layoutExecution(model, plan).nodes);
  const parallelGroups = groups.filter((group) => group.nodeIds.length >= 2);
  const parallelByNode = toParallelByNode(parallelGroups);
  const graph = assembleStructuralGraph(model, positions, parallelByNode);

  return { graph, plan, positions, parallelGroups, parallelByNode };
};
