/**
 * Vistas del lienzo de agentes:
 * - `graph` (Grafo): jerarquía de invocación padre → hijos, como árbol.
 * - `lanes` (Carriles): niveles de ejecución en el tiempo, con la línea de
 *   tiempo del gutter y las bandas por nivel.
 */
export const GRAPH_VIEW_MODE = {
  GRAPH: 'graph',
  LANES: 'lanes',
} as const;

export type TGraphViewMode =
  (typeof GRAPH_VIEW_MODE)[keyof typeof GRAPH_VIEW_MODE];

/** Etiqueta visible de cada vista (el selector las muestra en este orden). */
export const GRAPH_VIEW_MODE_LABEL: Record<TGraphViewMode, string> = {
  [GRAPH_VIEW_MODE.GRAPH]: 'Grafo',
  [GRAPH_VIEW_MODE.LANES]: 'Carriles',
};

export const GRAPH_VIEW_MODES: TGraphViewMode[] = [
  GRAPH_VIEW_MODE.GRAPH,
  GRAPH_VIEW_MODE.LANES,
];

/** Vista por defecto: el grafo, como en el diseño. */
export const DEFAULT_GRAPH_VIEW_MODE: TGraphViewMode = GRAPH_VIEW_MODE.GRAPH;

/** Guarda de tipo para valores leídos de almacenamiento. */
export const isGraphViewMode = (value: unknown): value is TGraphViewMode =>
  GRAPH_VIEW_MODES.includes(value as TGraphViewMode);
