# Research — Live Node Feedback, Effort Levels & Detail Panel UX

**Feature**: `008-node-effort-inspector-ux`
**Date**: 2026-10-09
**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [design-direction.md](./design-direction.md)

La spec está cerrada con clarificaciones (checklist de requisitos al 100 %): **no quedan `NEEDS CLARIFICATION`**. Este documento resuelve las decisiones técnicas de implementación apoyándose en el código existente. **No se añaden dependencias**, **no se añade red** y **no cambia el contrato del SDK**. Toda la lógica nueva de negocio es pura y testeable (Principio V).

---

## Diagnóstico verificado (base de las decisiones)

1. **El follow apunta al primer activo, no al más reciente** — `WorkspacePage.tsx:41` hace `useFollowMode(graph.activeNodeId)`; `useGraphModel.ts:143-147` define `activeNodeId = graph.nodes.find(isActiveStatus)?.id`, es decir el **primero** del array (orden topológico), no el que empezó más tarde. `FollowController` (`ViewportControllers.tsx:9`) centra en `nodeId` y no falla si el nodo desaparece (`getNode` → `null` → return).
2. **El nodo activo muestra solo un pulso genérico** — `AgentNodeHeader.tsx:40-48` renderiza un punto con `animate-pulse` (FR-022 previo). El rail (`NodeStatusRail.tsx`) es un `span` de 3 px con color de estado, sin animación. Es exactamente el "look genérico" que `design-direction.md` §4 pide evitar.
3. **El panel es de ancho fijo y sin fullscreen** — `WorkspaceLayout.tsx:59-64` fija el inspector en `w-[360px] shrink-0`; `InspectorPanel.tsx` no tiene encabezado ni control de expansión. No existe persistencia de ancho ni patrón overlay para el panel (sí existe `HistoryOverlay` como patrón de overlay).
4. **El diff es un `<pre>` con el patch crudo** — `FileChanges.tsx:92-94` vuelca `selected.patch` tal cual, sin hunks, sin numeración, sin color por línea. El tipo `TFileChange` es alias de `FileDiffInfo` (`file`, `patch`, `additions`, `deletions`, `status`), y `patch` puede venir vacío.
5. **El nodo no tiene noción de esfuerzo** — `TGraphNodeData` no expone nivel. El plan de líneas/tandas ya existe (`deriveExecutionLevels` → `TExecutionPlan.levels`/`levelByNode`) y el paralelismo ya existe (`deriveParallelGroups` → `TParallelGroup.parentId/nodeIds`, `TNodeParallelism`). Ambos son la materia prima del esfuerzo.
6. **Un campo nuevo es invisible si no entra en el comparador** — `reconcile/comparators.ts:85` (`sameNodeData`) compara campo a campo; React Flow/`reconcileGraphModel` solo reemplaza nodos si `sameNodeData` da `false`. Un `effort` sin comparador propio **nunca se re-renderiza**.
7. **La altura del card se estima, no se mide** — `cardHeight.ts` reserva `STATUS_WIDTH = 72` para estado + badge de paralelos; añadir un medidor en esa fila estrecha el título disponible y puede desalinear el alto estimado de los carriles.

---

## R1. Animación "pensando": CSS puro sobre el rail (US2 · FR-001..FR-004 · SC-001)

**Decision**: El estado activo se señaliza con un **barrido de brillo** CSS sobre `NodeStatusRail`, no con un pulso genérico:

- Se añade a `index.css` un `@keyframes rail-scan` (banda de luz que recorre el rail de arriba abajo) y la clase `.rail-scan`.
- `NodeStatusRail` recibe `active: boolean` (derivado de `isActiveStatus(status)` en `AgentNode`) y aplica `.rail-scan` solo cuando activo **y no** está rayado por loop/reintento (el rayado es la firma de loop y se conserva).
- El punto `animate-pulse` de `AgentNodeHeader` **se retira** (el barrido del rail pasa a ser la señal principal, `design-direction.md` §3.1).
- `prefers-reduced-motion`: el bloque global (`index.css:138-147`) ya anula animaciones; además el diseño exige el estado **estático** (rail en color de actividad sólido) que el color base ya provee.

**Rationale**:
- Cero estado por nodo y cero JS por frame: la animación es declarativa y se detiene sola al cambiar la clase cuando el nodo deja de estar activo (FR-002/FR-004).
- El barrido es *direccional* ("está procesando") y aporta información, frente al parpadeo ambiguo del pulso (justificación de diseño).
- No añade filas ni altura: el rail ya existe (FR de `cardHeight` intacto).

**Alternatives considered**:
- **Mantener `animate-pulse` y añadir otro punto**: descartado por `design-direction.md` §4 (es el look genérico) y por redundancia.
- **Animación con JS/`requestAnimationFrame`**: descartada; viola el objetivo de coste no perceptible (SC-006) y Principio VII.
- **`animate-ping`/transformaciones sobre el card**: descartadas; mueven layout o compiten con el foco/opacidad del nodo.

---

## R2. Follow al nodo activo más reciente (US3 · FR-005..FR-009 · SC-003)

**Decision**: Derivar un `latestActiveNodeId` puro y consumirlo desde el `useFollowMode` existente **sin cambiar su firma**:

- Nueva función pura `lib/activeNode.ts`: `latestActiveNodeId(model): string | null` = entre los nodos `isActiveStatus`, el de **mayor `activityStartOf(node)`** (`metrics.startedAt ?? createdAt ?? 0`, es decir, la hora de inicio de ejecución con la fecha de creación de la sesión solo como último recurso), con desempate determinista por `id`. Helper propio; **no** reutiliza el `startOf` de `nodeInterval.ts` (precedencia inversa).
- `useGraphModel` calcula `latestActiveNodeId` sobre el `graph` final y lo **añade** a `UseGraphModelResult` (additivo; `activeNodeId` se conserva para compatibilidad).
- `WorkspacePage` pasa `graph.latestActiveNodeId` a `useFollowMode` (hoy recibe `graph.activeNodeId`). `useFollowMode` no cambia: sigue devolviendo `followNodeId = enabled ? id : null`.
- `FollowController` no cambia: si el nodo enfocado ya no existe, `getNode` devuelve `null` y no mueve el viewport (edge case "se completa justo cuando el enfoque iba hacia él").

**Rationale**:
- FR-005 pide "el que empezó más tarde" por su **hora de inicio de ejecución**; el follow usa su propio comparador (`metrics.startedAt ?? createdAt`), independiente del `startOf` del layout (`createdAt ?? metrics.startedAt`), que ordena niveles y columnas con otro criterio.
- Al ser un `string`, `followNodeId` es estable entre ticks: el `useEffect` de `FollowController` depende del **id**, no del objeto, así que eventos sin cambio de activo no reposicionan (FR-006/FR-009) y el seguimiento no "tiembla".
- FR-008 (reactivar enfoca al más reciente en ese momento): al pasar de `null` a id al reactivar, el efecto se dispara con el `latestActiveNodeId` vigente.
- FR-007 (sin activos no mueve): `latestActiveNodeId` es `null` → `followNodeId` `null` → el efecto no hace nada.

**Alternatives considered**:
- **Cambiar la semántica de `activeNodeId`**: descartado; rompe la API observada por 006/007 y otros consumidores.
- **Recalcular el más reciente por tick dentro de `useFollowMode`**: descartado; el tick no cambia qué nodo es el más reciente y reevaluarlo por segundo reintroduce trabajo y riesgo de movimiento espurio.
- **Que `FollowController` ordene los nodos activos**: descartado; pone lógica de negocio en un componente (AGENTS §4) y separa la decisión de dónde vive `activeNodeId`.

---

## R3. Derivación de los 5 niveles de esfuerzo (US1 · FR-021..FR-028 · SC-002)

**Decision**: Una función pura `lib/effort/deriveEffort.ts` calcula el nivel por nodo a partir del plan de líneas y del paralelismo:

```ts
// Domains/Graph/Graph.entity.ts (tipo de vista)
export interface TNodeEffort {
  level: 1 | 2 | 3 | 4 | 5;
  provisional: boolean;
  reasons: string[];          // para la descripción accesible
}
// lib/effort/deriveEffort.ts (puro)
export const deriveEffortByNode = (
  model: TGraphModel,
  plan: TExecutionPlan,
  parallelGroups: TParallelGroup[],
): Record<string, TNodeEffort>;
```

**Regla acumulativa** (base 1, tope 5):

| Condición | Suma | Fuente |
|-----------|------|--------|
| Base | 1 | — |
| Lanza al menos un nodo paralelo (orquesta paralelismo) | +1 | `parallelGroups` con `parentId === node.id` y `nodeIds.length >= 2` |
| Duración > 2 × la del nodo más rápido de su **misma línea** | +1 | `plan.levelByNode` + `metrics.durationMs` |
| Forma alta: hijos (muchos hijos lanzados) | +1 | nº de hijos por aristas (`edges`) ≥ `EFFORT_SHAPE_CHILDREN` |
| Forma alta: invocaciones (muchas herramientas) | +1 | `metrics.invocations` ≥ `EFFORT_SHAPE_INVOCATIONS` |

`level = Math.min(EFFORT_MAX, 1 + condiciones)` con `EFFORT_MAX = 5`.

- **"Misma línea" = tanda de ejecución** (FR-023): el `TExecutionLevel` de `plan.levels`, es decir el grupo de hermanos que arrancaron juntos. "El más rápido de su línea" = `min(durationMs)` de los nodos del mismo nivel con duración conocida y `> 0`.
- **Línea de un solo nodo** (edge): el más rápido es el propio nodo → `d > 2d` es falso → no se infla (edge case de la spec).
- **Duraciones desconocidas / nodos paralelos sin duración**: no penalizan; si no hay mínimo válido, la condición de duración no suma. El nivel nunca queda indefinido (edge case).
- **Provisional** (FR-028): `provisional = true` si el nodo es activo **o** algún nodo de su línea es activo (los tiempos de la línea no están cerrados). Al cerrarse, el recálculo produce el nivel final. En la UI, provisional = muescas con opacidad reducida + marca de "provisional" (design-direction §3.6).
- **Solo lectura** (FR-027): `TNodeEffort` no es editable ni interactivo; el medidor no es un control.

**Umbrales** (constantes en `lib/effort/constants.ts`, sin magic numbers, AGENTS §8.5): `EFFORT_SHAPE_CHILDREN = 3`, `EFFORT_SHAPE_INVOCATIONS = 5`. Cada umbral superado suma **+1** (delegar a ≥3 hijos y realizar ≥5 invocaciones suman hasta +2); quedan aislados para ajustarlos en `tasks` si la muestra lo pide.

**Rationale**:
- Es la lectura literal de `clarify` y de las FR-024/FR-025; base 1 con tope 5 y forma alta +2 da exactamente la escala pedida (1 + 1 + 1 + 2 = 5).
- Reutiliza plan y paralelismo ya derivados (una sola fuente de verdad de "línea" y "paralelo"); no se recalcula topología.
- Es pura y determinista, testeable con fixtures (SC-008).
- El `reasons[]` alimenta la **leyenda/descripción accesible** (FR-026) sin duplicar lógica.

**Alternatives considered**:
- **Puntuar por percentiles/umbrales absolutos de duración**: descartado; "misma línea" es relativo por decisión del usuario (FR-023) y un umbral absoluto no distingue tandas.
- **Reutilizar `TNodeParallelism.size` (el nodo *es parte* de un grupo) para "lanza paralelos"**: descartado; FR-024 habla de levantar/orquestar paralelos (relación padre→hijos), no de correr en paralelo.
- **Calcular el nivel en el componente**: descartado; viola AGENTS §4 y no sería testeable en aislamiento.
- **`Math.round`/media en vez de umbral 2×**: descartado; la spec fija "supera 2× el más rápido" literal.

---

## R4. Dónde se deriva el esfuerzo y cómo se preserva la identidad (FR-021 .. FR-028 · SC-006 · Principio VII)

**Decision**: El esfuerzo se deriva en el **memo final** de `useGraphModel`, sobre **todos** los nodos (garantizando el nivel base 1 incluso sin duración registrada), y se aplica campo a campo conservando objetos:

- `useGraphModel` ya construye `graph` en un memo dependiente de `[positioned, now]`, donde recalcula `durationMs` de los activos. En ese mismo paso:
  1. se obtiene la lista de nodos con duración viva (paso existente);
  2. `effortByNode = deriveEffortByNode({ nodes, edges }, layout.plan, layout.parallelGroups)`;
  3. para cada nodo se devuelve el **mismo objeto** si `durationMs` y `effort` no cambiaron; si no, se reconstruye con el `effort` nuevo.
- `deriveExecutionKey` y el memo de `layout` **no** cambian: el esfuerzo **no entra** en `enriched` ni en la clave, así que no dispara re-layout ni invalida el plan. El cálculo de esfuerzo es O(n) por tick (trivial a 150 nodos) y solo muta nodos cuyo nivel cambió.

**Salvaguarda del comparador (recon)**: `effort` se añade a `TGraphNodeData` y **debe** entrar en `sameNodeData` mediante un comparador puro `sameEffort` (compara `level`, `provisional` y `reasons`). Sin esto, `reconcileGraphModel` no reemplazaría el nodo y el medidor quedaría congelado.

**Rationale**:
- El esfuerzo depende de duraciones que avanzan con el tick, así que **no** puede vivir en el memo del plan (congelado por `deriveExecutionKey`); vive junto a `durationMs`, que ya es el único punto de actualización por reloj.
- Mantener la identidad de nodo cuando nada cambió respeta la garantía de render de 006 y SC-006.
- `sameEffort` es la contrapartida mínima del comparador para que el campo sea visible.

**Alternatives considered**:
- **Calcular el esfuerzo dentro de `deriveExecutionLayout` / `assembleStructuralGraph`**: descartado; esas piezas se memoizan por `deriveExecutionKey` y no reaccionan a las duraciones vivas.
- **Añadir `effort` al modelo enriquecido antes del plan**: descartado; ensancha la identidad de `enriched` cada tick y roza el memo del layout.
- **Leer `effort` desde el componente con la lista completa de nodos**: descartado; el nodo no tiene acceso al resto de la línea y duplicaría la derivación.

---

## R5. Parser de diff unificado, puro (US4 · FR-016..FR-020 · SC-004, SC-008)

**Decision**: Una función pura `lib/parseDiff.ts` convierte el `patch` unificado en estructura de vista:

```ts
// lib/parseDiff.ts (puro)
export interface TDiffLine {
  kind: 'added' | 'removed' | 'context' | 'meta';   // 'meta' = \ No newline / cabecera
  content: string;
  oldNumber: number | null;
  newNumber: number | null;
}
export interface TDiffHunk {
  header: string;         // '@@ -a,b +c,d @@'
  oldStart: number; oldCount: number;
  newStart: number; newCount: number;
  lines: TDiffLine[];
}
export const parseUnifiedDiff = (patch: string): TDiffHunk[];
```

- Recorre el patch **linealmente**, sin dependencias. Reconoce cabeceras `@@ -a[,b] +c[,d] @@`, líneas `+`/`-`/` ` y `\ No newline at end of file`.
- Calcula `oldNumber`/`newNumber` incrementales desde el rango del hunk: `+` avanza solo el nuevo, `-` solo el viejo, contexto avanza ambos.
- **Casos límite seguros** (FR-020): `patch` vacío/`trim()` vacío → `[]` → "parche no disponible" (comportamiento actual preservado); contenido no textual o cabeceras inesperadas → no se rompe (se tratan como `meta`/contexto sin numeración); rename-only sin hunks → `[]` pero el encabezado del archivo sigue mostrando su estado; ausencia de salto de línea final → línea `meta`, sin numeración.

**Rationale**:
- SC-004 (20 archivos < 1 s) exige un parser lineal sin librerías; SC-008 exige tests de reglas reales sobre el formato.
- Mantener `TFileChange = FileDiffInfo` (Principio IV) y añadir tipos `T` de vista evita redefinir el SDK.
- Aislar el parseo permite memoizarlo por archivo seleccionado y testearlo con strings reales sin DOM.

**Alternatives considered**:
- **Añadir una librería de diff (`diff`, `diff2html`)**: descartado; el `patch` ya viene en formato unificado y la feature no requiere calcular diffs (el servidor los provee). Añadir dependencia viola el espíritu de la feature.
- **Renderizar el `<pre>` y colorear por regex en el componente**: descartado; lógica en componente (AGENTS §4) y no testeable de forma pura.
- **Parsear en el hook de datos (`useSessionDiff`)**: descartado; mezcla transporte con presentación y obliga a re-parsear todos los archivos aunque solo se vea uno.

---

## R6. Resize del panel: ancho persistido, clamp puro y accesible (US5 · FR-010..FR-012 · SC-005, SC-007)

**Decision**: Hook `Infrastructure/Hooks/useInspectorPanel.ts` + helper puro `Application/Helpers/panelWidth.ts`:

- Constantes `INSPECTOR_MIN_WIDTH` (p. ej. 280), `INSPECTOR_MAX_WIDTH` (p. ej. 720), `INSPECTOR_DEFAULT_WIDTH = 360` (el actual), `INSPECTOR_STEP` (teclado, p. ej. 16).
- `clampPanelWidth(value)` puro: acota a `[MIN, MAX]` y saneia `NaN` → `DEFAULT` (testeable).
- El hook mantiene `width` (inicializado desde `localStorage` con fallback a `DEFAULT` y clamp) y lo **persiste** en `localStorage` al cambiar (FR-010). El fullscreen vive en el **mismo hook** pero **no** se persiste (FR-013).
- `WorkspaceLayout` desktop inserta un separador entre grafo e inspector: `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow/min/max`, `tabIndex=0`, `cursor-col-resize`, zona de agarre de 12 px con 4 px visibles (`--surface-2` en reposo, `--status-running` al arrastrar). Arrastre por puntero (`pointerdown` + `pointermove/up` sobre `window`, con limpieza) y ajuste por teclado con `ArrowLeft/ArrowRight` (±`STEP`).
- El ancho se aplica como `style={{ width }}` en la columna del inspector; el resto del layout no cambia (FR-012). En móvil **no** se monta el separador: se conserva una sola fuente de lógica y dos presentaciones (AGENTS §9).

**Rationale**:
- Persistir solo el ancho (no el fullscreen) es decisión fija del usuario y de FR-010/FR-013.
- `clampPanelWidth` puro + `localStorage` accedido **desde el hook** cumple AGENTS (lógica en hooks, no en componentes).
- El clamp garantiza legibilidad (FR-011); `role="separator"` + teclado cubre SC-007.
- La zona de agarre de 12 px con 4 px visibles sigue `design-direction.md` §3.3.

**Alternatives considered**:
- **Persistir en el servidor o en el query cache**: descartado; el ancho es preferencia local, no dato del servidor (Principio I/III).
- **`react-resizable-panels` u otra lib**: descartado; añade dependencia para un caso de un solo separador.
- **Guardar ancho por sesión**: descartado; FR-010 pide persistencia entre sesiones, no por sesión.

---

## R7. Fullscreen del panel: efímero y reutilizando estados (US6 · FR-013..FR-015 · SC-005, SC-007)

**Decision**: Estado `isInspectorFullscreen` en `useInspectorPanel` (arranca `false`, no se persiste), cableado en `WorkspacePage`:

- `InspectorPanel` gana un **encabezado** con el título del nodo/estado y un botón de expandir/colapsar (icono `lucide` ya disponible: `Maximize2`/`Minimize2`), con `aria-pressed` y `aria-label`.
- En `WorkspaceLayout`, cuando `isFullscreen` es `true`, el contenido del inspector se monta en un **overlay** que cubre el área de trabajo con fondo `--surface-0`, **manteniendo el mismo `InspectorPanel`** (mismo contenido y mismos estados error→carga→vacío→datos, FR-014).
- Cierre: el mismo botón y `Escape` (FR-015). `WorkspacePage` combina el `useEscapeKey` existente con la prioridad "cerrar fullscreen antes que limpiar selección".

**Rationale**:
- Reutilizar el mismo nodo React evita duplicar el orden de estados y garantiza FR-014 (design-direction §3.4).
- No persistir el fullscreen es decisión fija (FR-013): al recargar, el panel arranca normal.
- Reutiliza el patrón overlay ya montado en `WorkspacePage` (`HistoryOverlay`) y `useEscapeKey` ya existente.

**Alternatives considered**:
- **Reusar el `Modal`/`Dialog` de shadcn**: descartado; el fullscreen no es un diálogo modal con foco atrapado ni fondo atenuado; el diseño pide cubrir el área de trabajo manteniendo el encabezado.
- **Persistir el fullscreen**: descartado explícitamente por FR-013.
- **Duplicar `InspectorPanel` en dos ramas**: descartado; duplicaría estados y rompería la garantía VI.

---

## R8. `cardHeight` y la fila del medidor (FR-021, SC-002)

**Decision**: El medidor de 5 muescas se coloca en la **fila existente** del encabezado, junto al badge de paralelos (`AgentNodeHeader`), para no añadir filas ni cambiar la altura. Como esa fila ya reserva `STATUS_WIDTH = 72` para estado + badge, se **ajusta `STATUS_WIDTH`** en `cardHeight.ts` para incluir el ancho del medidor (5 muescas + gaps), de modo que la estimación de líneas del título siga siendo correcta.

**Rationale**:
- El recon es explícito: añadir filas/badges exige ajustar `cardHeight` o ir en una fila existente. Se hace **ambas**: fila existente + ajuste de la reserva de ancho, para no desalinear los carriles.
- `cardHeight` es pura (Principio V) y tiene spec propia; el ajuste es verificable.

**Alternatives considered**:
- **Añadir una fila propia al medidor**: descartado; cambia la altura del card y obliga a tocar los carriles.
- **Medidor en el pie del nodo**: descartado; el pie es denso y numérico, y `design-direction.md` §6 exige la fila del badge de paralelos.
- **Tooltip/leyenda dentro del propio medidor**: el texto accesible va por `aria-label` (no añade altura).

---

## R9. Alcance y no-cambios (Principios I/III/VII)

**Decision**: La feature **no** toca: `Infrastructure/Services/opencodeClient.ts` (firma de `OpenCodeService`), `EventStreamProvider` (batching, reconexión), `reduceEvent` y sus slices, `deriveExecutionKey`/`deriveExecutionLayout`/`layoutGraph` (salvo el ajuste de `cardHeight`), el modelo de eventos, ni el contrato del SDK. No migra el render ni añade dependencias. No hay cambios de backend, de la lista de sesiones ni de la caché de queries.

**Rationale**: La spec acota la feature a feedback de nodos, follow, esfuerzo y UX del panel; mantener intactos los contratos de datos y de eventos protege la paridad en vivo/refresco y minimiza el riesgo de regresión.

**Alternatives considered**:
- **Aprovechar para recalcular el plan con las duraciones vivas**: descartado; reintroduce re-layout por tick (Principio VII) y no lo pide ninguna FR.
- **Añadir un endpoint o evento nuevo**: descartado; solo lectura (Principio I).

---

## Resumen de decisiones

| # | Decisión | FR / SC |
|---|----------|---------|
| R1 | Barrido CSS puro sobre `NodeStatusRail`; se retira `animate-pulse`; estático con reduced-motion | FR-001..FR-004, SC-001 |
| R2 | `latestActiveNodeId` puro; `useFollowMode` consume el más reciente sin cambiar firma | FR-005..FR-009, SC-003 |
| R3 | `deriveEffortByNode` acumulativo (base 1, tope 5) sobre línea (tanda) + paralelismo + forma; provisional si la línea corre | FR-021..FR-028, SC-002 |
| R4 | Esfuerzo en el memo final del grafo; identidad estable; `effort` entra en `sameNodeData` vía `sameEffort` | FR-021..FR-028, SC-006, Principio VII |
| R5 | `parseUnifiedDiff` puro; hunks, canal doble, casos límite seguros; `TFileChange` sigue siendo alias del SDK | FR-016..FR-020, SC-004/SC-008 |
| R6 | `useInspectorPanel` + `clampPanelWidth`; ancho persistido en `localStorage`; separador accesible por teclado | FR-010..FR-012, SC-005/SC-007 |
| R7 | Fullscreen efímero reutilizando `InspectorPanel`; cierre con botón y `Escape` | FR-013..FR-015, SC-005/SC-007 |
| R8 | Medidor en la fila existente + ajuste de `STATUS_WIDTH` en `cardHeight` | FR-021, SC-002 |
| R9 | Sin cambios de SDK/SSE/reducer/plan; sin dependencias | Principios I/III/VII |

**Trazabilidad sin decisión propia**: FR-016/FR-019 (diferenciación por color y estado del archivo) se resuelven con R5 + design-direction §3.5; FR-017 (hunks expandidos por defecto) con R5 + estado local de colapso; FR-026 (leyenda accesible) con R3 (`reasons[]`) + R8 (`aria-label`); FR-027 (solo lectura) con R3/R8 (el medidor no es control).
