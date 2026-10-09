# Contrato — Panel de detalle: ancho redimensionable y pantalla completa

**Feature**: `008-node-effort-inspector-ux`
**Cubre**: FR-010, FR-011, FR-012, FR-013, FR-014, FR-015 · SC-005, SC-007
**Implementa**: `Application/Helpers/panelWidth.ts`, `Infrastructure/Hooks/useInspectorPanel.ts`,
`Infrastructure/Components/WorkspaceLayout.tsx`, `Infrastructure/Components/InspectorPane.tsx`,
`Infrastructure/WorkspacePage.tsx`, `Domains/Inspector/Components/InspectorPanel.tsx`.

---

## 1. Ancho del panel (FR-010..FR-012)

```ts
// Application/Helpers/panelWidth.ts (puro)
export const INSPECTOR_MIN_WIDTH: number;
export const INSPECTOR_MAX_WIDTH: number;
export const INSPECTOR_DEFAULT_WIDTH: number; // 360 (layout actual)
export const INSPECTOR_STEP: number;          // ajuste por teclado
export const clampPanelWidth = (value: number): number;
```

```ts
// Infrastructure/Hooks/useInspectorPanel.ts
export interface TInspectorPanelState {
  width: number;
  isResizing: boolean;
  isFullscreen: boolean;
}
export const useInspectorPanel: () => TInspectorPanelState & {
  startResize: (event: React.PointerEvent) => void;
  onResizeKey: (event: React.KeyboardEvent) => void;
  toggleFullscreen: () => void;
  closeFullscreen: () => void;
};
```

- `clampPanelWidth` acota a `[INSPECTOR_MIN_WIDTH, INSPECTOR_MAX_WIDTH]` y sanea `NaN` → `INSPECTOR_DEFAULT_WIDTH`.
- El ancho inicial se lee de `localStorage` (clave constante) con fallback a `INSPECTOR_DEFAULT_WIDTH`, y se vuelve a acotar con `clampPanelWidth` (FR-010, FR-011).
- Al cambiar el ancho se **persiste en `localStorage`** (FR-010); el fullscreen **no** se persiste (FR-013).
- El ancho se aplica como `style={{ width }}` en la columna del inspector; no altera el grafo ni el contenido (FR-012).

### Separador (accesible, SC-007)

- `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow`/`aria-valuemin`/`aria-valuemax`, `tabIndex={0}`.
- Estilo: 4 px visibles, zona de agarre 12 px, `cursor-col-resize`; `--surface-2` en reposo, `--status-running` mientras `isResizing`. `:focus-visible` global.
- Arrastre: `startResize` captura puntero y escucha `pointermove`/`pointerup` en `window`, con limpieza; teclado: `ArrowLeft`/`ArrowRight` ajustan ±`INSPECTOR_STEP`.

## 2. Pantalla completa (FR-013..FR-015)

- `isFullscreen` arranca `false` y **no** se persiste (FR-013).
- El encabezado del panel (`InspectorPanel`) incluye un botón de expandir/colapsar (icono `lucide` `Maximize2`/`Minimize2`) con `aria-pressed` y `aria-label`.
- En fullscreen, `WorkspaceLayout` monta el **mismo** `InspectorPanel` en un overlay que cubre el área de trabajo con fondo `--surface-0`, conservando el encabezado y los estados de pantalla error→carga→vacío→datos (FR-014).
- Cierre: el mismo botón y `Escape` (FR-015). `WorkspacePage` da prioridad a cerrar el fullscreen antes de limpiar la selección.

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| P1 | `clampPanelWidth` acota por debajo y por encima y sanea `NaN` | spec puro `panelWidth.spec.ts` |
| P2 | Arrastrar el separador cambia el ancho siguiendo el puntero dentro de límites | spec de hook `useInspectorPanel.spec.tsx` |
| P3 | El ancho se persiste en `localStorage` y se restaura al montar (acotado) | spec de hook |
| P4 | `ArrowLeft`/`ArrowRight` ajustan el ancho por teclado | spec de hook |
| P5 | Cambiar el ancho no altera el contenido del panel ni el grafo | spec de `WorkspacePage`/layout |
| P6 | `toggleFullscreen` expande; el mismo control y `Escape` vuelven al layout normal | spec de `WorkspacePage`/`InspectorPanel` |
| P7 | En fullscreen se conservan encabezado y los cuatro estados de pantalla | spec de `InspectorPanel` extendido |
| P8 | `isFullscreen` arranca `false` y no se persiste | spec de hook / revisión de `localStorage` |

## 3. Presentación móvil (AGENTS §9)

- En móvil **no** se monta el separador ni el fullscreen de escritorio: se mantiene una sola fuente de lógica (`useInspectorPanel`) y dos presentaciones. El panel móvil sigue siendo una pestaña (`WorkspaceMobileTabs`).
