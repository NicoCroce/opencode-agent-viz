/**
 * Límites y ajuste por teclado del ancho del panel de detalle (`width` en px).
 *
 * El panel es de escritorio: en la presentación actual ocupa 360 px fijos
 * (`WorkspaceLayout`), y estos límites garantizan legibilidad sin permitir que
 * el panel devore el grafo. El ajuste por teclado avanza en pasos de 16 px.
 *
 * Lógica pura, sin React: el estado persistido del panel vive en
 * `Infrastructure/Hooks/useInspectorPanel.ts`, que siempre pasa el valor por
 * `clampPanelWidth` antes de exponerlo (FR-010..FR-012).
 */
export const INSPECTOR_MIN_WIDTH = 280;
export const INSPECTOR_MAX_WIDTH = 720;
export const INSPECTOR_DEFAULT_WIDTH = 360;
export const INSPECTOR_STEP = 16;

/**
 * Acota `value` a `[INSPECTOR_MIN_WIDTH, INSPECTOR_MAX_WIDTH]`. Un valor no
 * finito (incluido `NaN`) no representa un ancho válido y se sanea a
 * `INSPECTOR_DEFAULT_WIDTH` en lugar de propagarse al layout.
 */
export const clampPanelWidth = (value: number): number => {
  if (!Number.isFinite(value)) return INSPECTOR_DEFAULT_WIDTH;
  if (value < INSPECTOR_MIN_WIDTH) return INSPECTOR_MIN_WIDTH;
  if (value > INSPECTOR_MAX_WIDTH) return INSPECTOR_MAX_WIDTH;
  return value;
};
