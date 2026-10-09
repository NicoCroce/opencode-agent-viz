import type {
  TGraphModel,
  TNodeParallelism,
  TParallelGroup,
} from '../../Graph.entity';
import { assembleStructuralGraph } from '../assembleStructuralGraph';
import { indexPositions } from '../indexPositions';
import { toParallelByNode } from '../parallelByNode';
import { deriveParallelGroups } from '../parallelism';
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
 * 1. `plan = deriveExecutionLevels(model, now)` — niveles/tandas de hermanos
 *    concurrentes, columnas por instante de inicio y normalización padre→hijo.
 * 2. `positions = indexPositions(layoutExecution(model, plan).nodes)` — `x` por
 *    columna, `y` por carril; mismo nivel comparte fila.
 * 3. `parallelGroups = deriveParallelGroups(model, now)` y
 *    `parallelByNode = toParallelByNode(parallelGroups)` — badge derivado de la
 *    **misma** lógica de intervalos que las filas (FR-010).
 * 4. `graph = assembleStructuralGraph(model, positions, parallelByNode)` — el
 *    modelo con posiciones y `parallel` pegados, conservando aristas y datos.
 *
 * Es una función **pura y sin React** (FR-008): no muta la entrada (cada paso
 * devuelve un modelo nuevo) y **nunca** usa `Date.now()`. `now` solo alimenta
 * las ventanas informativas `startedAt`/`endedAt` de niveles y lotes; el
 * agrupamiento, los niveles y las columnas no dependen del reloj (FR-007,
 * SC-004, Principio V). El llamador (hook) es quien memoiza por
 * `deriveExecutionKey(model)`.
 */
export const deriveExecutionLayout = (
  model: TGraphModel,
  now: number,
): TExecutionLayout => {
  const plan = deriveExecutionLevels(model, now);
  const positions = indexPositions(layoutExecution(model, plan).nodes);
  const parallelGroups = deriveParallelGroups(model, now);
  const parallelByNode = toParallelByNode(parallelGroups);
  const graph = assembleStructuralGraph(model, positions, parallelByNode);

  return { graph, plan, positions, parallelGroups, parallelByNode };
};
