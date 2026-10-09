/**
 * Fachada pública del layout de ejecución (carriles por tanda).
 *
 * El cómputo vive en `lib/execution/` (geometría, niveles, filas y el intervalo
 * temporal de nodo compartido `nodeInterval`); este módulo conserva la ruta
 * pública original para no romper los import specifiers de componentes, hooks y
 * specs.
 */
export {
  EXECUTION_COLUMN_GAP,
  EXECUTION_COLUMN_LEFT_PAD,
  EXECUTION_GUTTER,
  EXECUTION_RAIL_OFFSET,
  EXECUTION_ROW_HEIGHT,
  EXECUTION_ROW_PAD,
  executionColumnX,
  executionRailX,
} from './execution/geometry';
export {
  deriveExecutionLevels,
  type TExecutionLevel,
  type TExecutionPlan,
} from './execution/deriveExecutionLevels';
export {
  deriveRowLayout,
  layoutExecution,
  type TRowLayout,
} from './execution/layoutRows';
export { deriveExecutionKey } from './execution/executionKey';
export {
  deriveExecutionLayout,
  type TExecutionLayout,
} from './execution/deriveExecutionLayout';
