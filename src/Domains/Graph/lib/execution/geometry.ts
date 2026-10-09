import { NODE_CARD_HEIGHT, NODE_WIDTH } from '../layoutGraph';

/** Ancho del gutter izquierdo (la "espina") en coordenadas de flujo. */
export const EXECUTION_GUTTER = 232;
/** Canal libre entre la espina y la primera columna, donde corre el riel. */
export const EXECUTION_COLUMN_LEFT_PAD = 44;
/** Separación horizontal entre agentes del mismo nivel. */
export const EXECUTION_COLUMN_GAP = 48;
/** Distancia del riel de invocación a la izquierda de su columna. */
export const EXECUTION_RAIL_OFFSET = 18;
/** Margen vertical del nodo dentro de su carril (arriba y abajo). */
export const EXECUTION_ROW_PAD = 22;
/**
 * Alto de cada carril, derivado del alto de la card del nodo (`NODE_CARD_HEIGHT`).
 * Así el carril crece o se achica en proporción al nodo en lugar de ser un
 * valor suelto.
 */
export const EXECUTION_ROW_HEIGHT = NODE_CARD_HEIGHT + EXECUTION_ROW_PAD * 2;

/** X (izquierda) de la columna `column` dentro de un nivel. */
export const executionColumnX = (column: number): number =>
  EXECUTION_GUTTER +
  EXECUTION_COLUMN_LEFT_PAD +
  column * (NODE_WIDTH + EXECUTION_COLUMN_GAP);

/**
 * X del riel vertical por el que viajan las aristas que **salen** de la columna
 * `column`. Cae en el canal a la izquierda de la columna, libre de nodos, de
 * modo que las invocaciones nunca cruzan una card.
 */
export const executionRailX = (column: number): number =>
  executionColumnX(column) - EXECUTION_RAIL_OFFSET;
