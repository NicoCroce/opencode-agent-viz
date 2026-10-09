# Contrato — Niveles de esfuerzo por nodo (escala de 5)

**Feature**: `008-node-effort-inspector-ux`
**Cubre**: FR-021, FR-022, FR-023, FR-024, FR-025, FR-026, FR-027, FR-028 · SC-002, SC-006
**Implementa**: `Domains/Graph/lib/effort/deriveEffort.ts`, `Domains/Graph/lib/effort/constants.ts`,
`Domains/Graph/Graph.entity.ts` (`TNodeEffort`, `effort`), `Domains/Graph/lib/reconcile/comparators.ts` (`sameEffort`),
`Domains/Graph/Hooks/useGraphModel.ts`, `Domains/Graph/Components/EffortMeter.tsx`, `Domains/Graph/Components/AgentNodeHeader.tsx`,
`Domains/Graph/lib/cardHeight.ts`.

---

## 1. Modelo del esfuerzo

```ts
// Domains/Graph/Graph.entity.ts
export interface TNodeEffort {
  level: 1 | 2 | 3 | 4 | 5;
  provisional: boolean;
  reasons: string[];
}
// campo nuevo en TGraphNodeData (opcional, patrón `enrichment?`: lo puebla la derivación):
effort?: TNodeEffort | null;
```

```ts
// Domains/Graph/lib/effort/deriveEffort.ts (puro)
export const deriveEffortByNode = (
  model: TGraphModel,
  plan: TExecutionPlan,
  parallelGroups: TParallelGroup[],
): Record<string, TNodeEffort>;
```

## 2. Regla acumulativa (FR-022)

| Componente | Suma | Condición |
|-----------|------|-----------|
| Base | +1 | siempre |
| Paralelos | +1 | el nodo es `parentId` de un `TParallelGroup` con `nodeIds.length >= 2` (lanza/orquesta paralelos) |
| Duración relativa | +1 | `durationMs > 2 × min(durationMs > 0 de los nodos de su línea)` |
| Forma alta: hijos | +1 | nº de hijos por `edges` ≥ `EFFORT_SHAPE_CHILDREN` |
| Forma alta: invocaciones | +1 | `metrics.invocations` ≥ `EFFORT_SHAPE_INVOCATIONS` |

`level = Math.min(EFFORT_MAX, 1 + condiciones)` con `EFFORT_MAX = 5` (FR-025, tope).

- **"Misma línea" (FR-023)** = tanda de ejecución = `plan.levelByNode` (nivel de `deriveExecutionLevels`), no el padre directo.
- **Línea de un solo nodo** (edge): el más rápido es el propio nodo → `d > 2d` falso → sin incremento.
- **Duraciones ausentes** (edge): la condición relativa no aplica; todo nodo recibe al menos el nivel base 1 y el nivel nunca queda indefinido.
- **Forma alta**: umbrales aislados en `lib/effort/constants.ts` (sin magic numbers).

## 3. Provisionalidad (FR-028)

- `provisional = true` si el nodo es activo **o** algún nodo de su línea es activo (los tiempos de la línea no están cerrados).
- Al cerrarse la línea, el recálculo produce el nivel final.
- Presentación: muescas con opacidad reducida + marca de "provisional" (design-direction §3.6).

## 4. Identidad y comparador (SC-006, recon)

- `deriveEffortByNode` recibe **todos** los nodos del modelo (garantiza el nivel base 1 también en nodos sin duración registrada) y se invoca en el **memo final** de `useGraphModel`, **no** en `enriched` ni en `deriveExecutionKey`.
- El memo devuelve el **mismo objeto** de nodo si `durationMs` y `effort` no cambiaron; así la identidad de render se preserva y no hay re-layout.
- `effort` **debe** entrar en `sameNodeData` vía `sameEffort(a, b)`: compara `level`, `provisional` y `sameStringArray(a.reasons, b.reasons)`. Sin este comparador, `reconcileGraphModel` no reemplazaría el nodo y el medidor quedaría congelado.

## 5. Presentación (FR-026, FR-027, SC-002)

- **Signature**: medidor de **5 muescas** en el `AgentNodeHeader`, en la **misma fila** que el badge de paralelos (no añade filas).
- Muescas encendidas = `--primary` (exclusivo del esfuerzo); apagadas = borde/base neutra. **Prohibido** hex suelto o usar colores de estado.
- Provisional: opacidad reducida + marca; cerrado: muescas plenas.
- **Solo lectura** (FR-027): `role="img"` (no botón); `aria-label` = `"Esfuerzo N de 5: <reasons>"`.
- `cardHeight.ts`: se ajusta `STATUS_WIDTH` para reservar el ancho del medidor en la fila, manteniendo la estimación de líneas del título.

| # | Criterio | Cómo se valida |
|---|----------|----------------|
| S1 | Nodo sin paralelos ni desviación de duración → nivel 1 | spec puro `effort.spec.ts` |
| S2 | Nodo que lanza paralelos → sube respecto al mínimo | spec puro |
| S3 | Nodo > 2× el más rápido de su línea → sube | spec puro |
| S4 | Forma alta suma hasta +2 (hijos e invocaciones); con todas las condiciones el nivel llega a 5 y nunca lo supera | spec puro |
| S5 | Línea de un solo nodo no infla el nivel | spec puro |
| S6 | Duración ausente no deja el nivel indefinido | spec puro |
| S7 | `provisional` verdadero con la línea en curso; falso al cerrar | spec puro |
| S8 | `sameEffort` detecta cambios y `sameNodeData` los propaga | spec `reconcileGraph.spec.ts` extendido |
| S9 | El medidor muestra N muescas encendidas y `aria-label` | spec de `EffortMeter`/`AgentNode` |
| S10 | El medidor no añade filas ni rompe `cardHeight` | spec `cardHeight.spec.ts` extendido |
| S11 | Identidad de nodo estable ante tick sin cambio de nivel | spec `useGraphModel.spec.tsx` extendido |
