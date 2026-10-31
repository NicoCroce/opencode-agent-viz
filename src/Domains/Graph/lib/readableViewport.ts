/**
 * Encuadre legible del grafo. `fitView` encoge todo hasta que quepa; con muchos
 * niveles eso deja las cards ilegibles. Si el ajuste completo cae por debajo de
 * `minReadableZoom`, se encuadra desde arriba a zoom legible (centrado en X si
 * cabe; si no, alineado a la izquierda o centrado en `anchorX`) y el resto
 * queda a un scroll/pan.
 */

/** Zoom mínimo en el que las cards se leen sin acercar (título 13px → ~9px). */
export const MIN_READABLE_ZOOM = 0.7;

/** Margen del encuadre legible, en píxeles de pantalla. */
const VIEWPORT_MARGIN = 24;

/** Padding relativo que usa `fitView` (mismo valor que `FitViewController`). */
export const FIT_PADDING = 0.1;

export interface TRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TViewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Devuelve el viewport legible, o `null` si el ajuste completo ya es legible
 * (entonces se usa `fitView` tal cual). Con `anchorX` (X de flujo, p. ej. la
 * raíz del árbol) y contenido más ancho que el panel, centra ese punto sin
 * dejar vacío más allá de los bordes del contenido. Función pura.
 */
export const readableViewport = (
  bounds: TRect,
  pane: { width: number; height: number },
  minReadableZoom: number = MIN_READABLE_ZOOM,
  anchorX: number | null = null,
): TViewport | null => {
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  if (pane.width <= 0 || pane.height <= 0) return null;

  const pad = 1 + FIT_PADDING * 2;
  const fitZoom = Math.min(
    pane.width / (bounds.width * pad),
    pane.height / (bounds.height * pad),
  );
  if (fitZoom >= minReadableZoom) return null;

  const zoom = minReadableZoom;
  const y = VIEWPORT_MARGIN - bounds.y * zoom;
  const scaledWidth = bounds.width * zoom;
  if (scaledWidth + VIEWPORT_MARGIN * 2 <= pane.width) {
    return { x: (pane.width - scaledWidth) / 2 - bounds.x * zoom, y, zoom };
  }
  if (anchorX === null) {
    return { x: VIEWPORT_MARGIN - bounds.x * zoom, y, zoom };
  }

  // Centrado en el ancla, acotado a los bordes del contenido (más el margen).
  const maxX = VIEWPORT_MARGIN - bounds.x * zoom;
  const minX = pane.width - VIEWPORT_MARGIN - (bounds.x + bounds.width) * zoom;
  const centered = pane.width / 2 - anchorX * zoom;
  return { x: Math.min(maxX, Math.max(minX, centered)), y, zoom };
};
