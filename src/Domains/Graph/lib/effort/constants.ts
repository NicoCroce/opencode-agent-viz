/**
 * Umbrales del nivel de esfuerzo de vista (`TNodeEffort`).
 *
 * Aislados aquí para ajustarlos si la muestra lo pide sin tocar la lógica
 * (research R3; AGENTS §8.5: sin magic numbers).
 */

/**
 * Tope de la escala de esfuerzo. El nivel se calcula como
 * `min(EFFORT_MAX, 1 + condiciones)` y el nivel 5 es alcanzable.
 */
export const EFFORT_MAX = 5;

/** Nº de hijos (por aristas) a partir del cual la forma suma +1. */
export const EFFORT_SHAPE_CHILDREN = 3;

/** Nº de invocaciones a partir del cual la forma suma +1. */
export const EFFORT_SHAPE_INVOCATIONS = 5;
