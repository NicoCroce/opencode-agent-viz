---

description: "Task list for feature 008-node-effort-inspector-ux"
---

# Tasks: Live Node Feedback, Effort Levels & Detail Panel UX

**Input**: Design documents from `/specs/008-node-effort-inspector-ux/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md, design-direction.md

**Tests**: Incluidos. La constitución (Principio V: lógica pura con tests unitarios) y `quickstart.md` §1 (validación automatizada **obligatoria**) exigen specs para las funciones puras y hooks nuevos (`deriveEffort`, `activeNode`, `parseDiff`, `panelWidth`, `useInspectorPanel`) y extensiones de los specs existentes (`reconcileGraph`, `cardHeight`, `useGraphModel`, `useFollowMode`, `AgentNode`, `InspectorPanel`, `FileChanges`). Los specs se escriben **antes** de su implementación (TDD) y deben fallar primero.

**Organization**: Tareas agrupadas por user story (US1..US6), en orden de prioridad (P1, P1, P1, P2, P2, P3). La Fase 2 (**Fundacional**) reúne el núcleo compartido: el campo de modelo `effort` y los helpers puros de panel (`panelWidth`, `useInspectorPanel`) de los que dependen varias historias. El resto de cada historia es autocontenido y validable de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: User story (US1..US6). Setup/Foundational/Polish no llevan story label.
- Rutas de archivo exactas en cada descripción.

## Path Conventions

Proyecto único frontend (SPA). Rutas relativas a la raíz del repo:
`src/Domains/Graph/`, `src/Domains/Inspector/`, `src/Infrastructure/`, `src/Application/`, `src/index.css`.
Specs junto al código en carpetas `specs/` (Principio VIII).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar el punto de partida sin introducir dependencias ni scaffolding.

- [X] T001 [P] Registrar la línea base de calidad en verde (`npm test`, `npm run tsc`, `npm run lint`) y verificar que **no** se agregan dependencias en `package.json` (plan.md Technical Context / Constraints; research R9).
- [X] T002 [P] Auditar `src/index.css`: confirmar los tokens de la feature (`--primary`, `--surface-0/1/2`, `--status-running/-done/-error`, `--muted-foreground`, `--radius-flat`), el bloque global de `prefers-reduced-motion` y la existencia de `<Container>` en `Application/Components` (design-direction §2/§5; restricciones de plan). Sin editar todavía.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Núcleo compartido por varias historias: el nuevo campo de modelo del nodo (`effort`, invisible si no entra en `sameNodeData`) y los helpers puros del panel de detalle (ancho + estado), usados por US1 y por US5/US6 respectivamente.

**⚠️ CRITICAL**: Ninguna user story puede empezar hasta completar esta fase.

- [X] T003 [P] Añadir la interfaz `TNodeEffort` (`{ level: 1|2|3|4|5; provisional: boolean; reasons: string[] }`) y el campo **opcional** `effort?: TNodeEffort | null` a `TGraphNodeData` en `src/Domains/Graph/Graph.entity.ts` (data-model §1.1/§2.1; effort-contract §1; Principio IV). Opcional por consistencia con `enrichment?` (evita churn en constructores/fixtures).
- [X] T004 [P] Crear `src/Domains/Graph/lib/effort/constants.ts` con `EFFORT_MAX = 5`, `EFFORT_SHAPE_CHILDREN = 3`, `EFFORT_SHAPE_INVOCATIONS = 5` (data-model §2.1; research R3; sin magic numbers, AGENTS §8.5).
- [ ] ~~T005 Inicializar `effort: null` en el literal de `TGraphNodeData` de `src/Domains/Graph/lib/graphBuild/toGraphNode.ts`~~ **NO APLICA** (superseded): el campo es opcional y lo puebla la derivación (T022); inicializarlo rompía la paridad de `buildGraph.spec`.
- [X] T006 [P] Crear `src/Application/Helpers/specs/panelWidth.spec.ts` (P1): `clampPanelWidth` acota por debajo (`< MIN`), por encima (`> MAX`) y sanea `NaN` → `DEFAULT`; las constantes `INSPECTOR_MIN_WIDTH`/`INSPECTOR_MAX_WIDTH`/`INSPECTOR_DEFAULT_WIDTH = 360`/`INSPECTOR_STEP` existen y son coherentes (inspector-panel-contract §1; quickstart P1).
- [X] T007 Implementar `src/Application/Helpers/panelWidth.ts` (puro) con `INSPECTOR_MIN_WIDTH`, `INSPECTOR_MAX_WIDTH`, `INSPECTOR_DEFAULT_WIDTH`, `INSPECTOR_STEP` y `clampPanelWidth(value)` (depende de T006) (inspector-panel-contract §1; Principio V).
- [X] T008 [P] Crear `src/Infrastructure/Hooks/specs/useInspectorPanel.spec.tsx` (P2, P3, P4, P8): el arrastre cambia el ancho dentro de límites, el ancho se persiste/restaura desde `localStorage` (acotado), `ArrowLeft`/`ArrowRight` ajustan ±`INSPECTOR_STEP`, y `isFullscreen` arranca `false` y **no** se persiste (inspector-panel-contract §1/§2; quickstart P2..P4, P8).
- [X] T009 Implementar `src/Infrastructure/Hooks/useInspectorPanel.ts` (depende de T007, T008): mantiene `TInspectorPanelState` (`width`, `isResizing`, `isFullscreen`) con el ancho leído/persistido en `localStorage` (clave constante, acotado por `clampPanelWidth`), `startResize` por puntero con limpieza en `window`, `onResizeKey`, y `toggleFullscreen`/`closeFullscreen` efímeros (inspector-panel-contract §1/§2; research R6/R7).

**Checkpoint**: Campo `effort` presente en todos los nodos y helpers puros de panel listos — las user stories pueden comenzar.

---

## Phase 3: User Story 1 - Identificar el esfuerzo de cada nodo de un vistazo (Priority: P1) 🎯 MVP

**Goal**: Cada nodo muestra un medidor de 5 muescas derivado de su paralelismo, su duración relativa a su línea (tanda) y su forma (hijos e invocaciones); provisional mientras su línea corre; de solo lectura y con descripción accesible.

**Independent Test**: Con una sesión con nodos en serie, un nodo que lanza paralelos y un nodo > 2× el más rápido de su línea, cada uno recibe un nivel distinto y legible sin abrir el detalle (quickstart.md §2 US1; specs S1..S11).

- [X] T010 [P] [US1] Crear `src/Domains/Graph/lib/specs/effort.spec.ts` (S1..S7): escala acumulativa base 1, +1 por lanzar paralelos (`parentId` de un grupo con ≥2), +1 por superar 2× el más rápido de la misma tanda, +2 por forma alta (hijos ≥ `EFFORT_SHAPE_CHILDREN` e invocaciones ≥ `EFFORT_SHAPE_INVOCATIONS`), tope 5 y nivel 5 alcanzable; línea de un solo nodo no infla; duración ausente no deja el nivel indefinido; `provisional` verdadero con la línea activa y falso al cerrar (effort-contract §2/§3; data-model §3; FR-021..FR-028).
- [X] T011 [US1] Implementar `deriveEffortByNode(model, plan, parallelGroups)` en `src/Domains/Graph/lib/effort/deriveEffort.ts` (puro, depende de T010 y T004): `level = min(EFFORT_MAX, 1 + condiciones)`, `reasons[]` legibles y `provisional` si el nodo o su línea están activos (effort-contract §1..§3; research R3).
- [X] T012 [P] [US1] Extender `src/Domains/Graph/lib/specs/reconcileGraph.spec.ts` (S8): `sameEffort` detecta cambios de `level`/`provisional`/`reasons` y `sameNodeData` los propaga (un nodo con el mismo `effort` no se reemplaza) (effort-contract §4; data-model §2.1).
- [X] T013 [US1] Añadir `sameEffort(a, b)` a `src/Domains/Graph/lib/reconcile/comparators.ts` y engancharlo en `sameNodeData` (depende de T012 y T003): compara `level`, `provisional` y `sameStringArray(a.reasons, b.reasons)` (effort-contract §4; recon: sin esto el medidor queda congelado).
- [X] T014 [P] [US1] Extender `src/Domains/Graph/lib/specs/cardHeight.spec.ts` (S10/A4): el medidor no añade filas; el alto estimado del título es consistente con el ancho reservado actualizado.
- [X] T015 [US1] Ajustar `STATUS_WIDTH` en `src/Domains/Graph/lib/cardHeight.ts` para reservar el ancho del medidor de 5 muescas en la fila del encabezado (depende de T014) (effort-contract §5; research R8; design-direction §6).
- [X] T016 [P] [US1] Crear `src/Domains/Graph/Components/specs/EffortMeter.spec.tsx` (S9): se renderizan `level` muescas encendidas, `role="img"`, `aria-label` del tipo `"Esfuerzo N de 5: …"`, estado provisional atenuado y **no** es un control (effort-contract §5; FR-026/FR-027).
- [X] T017 [P] [US1] Extender `src/Domains/Graph/Components/specs/AgentNode.spec.tsx` (S9): el nodo con `data.effort` muestra el medidor en la fila del encabezado, junto al badge de paralelos.
- [X] T018 [US1] Crear `src/Domains/Graph/Components/EffortMeter.tsx` (depende de T016): medidor de 5 muescas en `--primary` (apagadas neutras), variante provisional y `aria-label` con los `reasons`; solo lectura (effort-contract §5; design-direction §3.6).
- [X] T019 [US1] Extender `src/Domains/Graph/Components/AgentNodeHeader.tsx` para colocar `EffortMeter` en la **fila existente** del badge de paralelos (sin añadir filas) (depende de T018) (research R8; effort-contract §5).
- [X] T020 [US1] Extender `src/Domains/Graph/Components/AgentNode.tsx` para pasar `node.data.effort` al encabezado y exportar `EffortMeter` desde `src/Domains/Graph/Components/index.ts` (depende de T019). `EffortMeter` **no** se promueve a `Application/Components/Molecules` (un solo consumidor; plan.md, nota del barrel).
- [X] T021 [P] [US1] Extender `src/Domains/Graph/Hooks/specs/useGraphModel.spec.tsx` (S11): el grafo expone `data.effort` por nodo y la **identidad del nodo se preserva** ante un tick sin cambio de nivel (solo se reconstruye el objeto cuando cambian `durationMs` o `effort`).
- [X] T022 [US1] Extender el memo final de `src/Domains/Graph/Hooks/useGraphModel.ts` (depende de T011, T013 y T021): calcular `deriveEffortByNode(modelRefrescadoPorTick, layout.plan, layout.parallelGroups)` sobre los **nodos con la duración ya actualizada por el tick** (el mismo memo que recalcula `durationMs`; **no** sobre `positioned`) y adjuntar `effort` devolviendo el mismo objeto de nodo si `durationMs` y `effort` no cambiaron; el esfuerzo **no** entra en `deriveExecutionKey` ni en `enriched` (effort-contract §4; research R4; Principio VII/SC-006).

**Checkpoint**: US1 funcional y validable de forma independiente (MVP): nivel de esfuerzo legible de un vistazo, provisional en curso y sin coste perceptible.

---

## Phase 4: User Story 2 - Ver qué agentes están trabajando ahora (Priority: P1)

**Goal**: Los nodos activos muestran un barrido de brillo CSS continuo sobre su rail; la animación se detiene al dejar de estar activos y tiene variante estática con movimiento reducido.

**Independent Test**: Con una sesión en vivo con nodos en estados distintos, solo los activos muestran `.rail-scan`; al completarse se detiene; con movimiento reducido el rail queda sólido (quickstart.md §2 US2; specs A1..A3).

- [X] T023 [P] [US2] Extender `src/Domains/Graph/Components/specs/AgentNode.spec.tsx` (A1/A2): un nodo activo renderiza el rail con `.rail-scan`; un nodo terminal **no**; `prefers-reduced-motion` mantiene la clase base estática (active-node-feedback-contract §1; FR-001..FR-004).
- [X] T024 [P] [US2] Extender `src/index.css`: `@keyframes rail-scan` (banda de brillo que recorre el rail), la clase `.rail-scan` y su estado estático bajo el bloque global de `prefers-reduced-motion` (active-node-feedback-contract §1; design-direction §3.1; FR-003).
- [X] T025 [US2] Extender `src/Domains/Graph/Components/NodeStatusRail.tsx` (depende de T023/T024): nueva prop `active: boolean` que aplica `.rail-scan` **solo** cuando el nodo está activo y no está rayado por loop/reintento (se conserva `LOOP_STRIPE`) (active-node-feedback-contract §1).
- [X] T026 [P] [US2] Extender `src/Domains/Graph/Components/AgentNodeHeader.tsx`: retirar el punto `animate-pulse` (la señal principal pasa a ser el barrido del rail) (active-node-feedback-contract §1; design-direction §4).
- [X] T027 [US2] Extender `src/Domains/Graph/Components/AgentNode.tsx` (depende de T025): calcular `active = isActiveStatus(status)` y reenviarlo a `NodeStatusRail`; el rail aplica `.rail-scan` solo si `active` y **no** está rayado, reutilizando su condición `striped` existente (`hasLoop`/`retrying`) sin duplicarla (active-node-feedback-contract §1; FR-002/FR-004).

**Checkpoint**: US1 y US2 funcionan y se validan de forma independiente.

---

## Phase 5: User Story 3 - Seguir automáticamente al nodo activo más reciente (Priority: P1)

**Goal**: Con el seguimiento activado, el visor enfoca el nodo activo que **empezó más tarde** (mayor hora de inicio), sin reposicionar el resto del grafo y sin moverse cuando no hay activos ni cuando llegan eventos sin cambio de activo.

**Independent Test**: Con dos nodos que se activan en momentos distintos y el seguimiento activado, el enfoque va al más reciente; sin activos no se mueve; reactivar enfoca el más reciente (quickstart.md §2 US3; specs E1..E4).

- [X] T028 [P] [US3] Crear `src/Domains/Graph/lib/specs/activeNode.spec.ts` (E1/E2): `latestActiveNodeId` elige el nodo activo con mayor `activityStartOf = metrics.startedAt ?? createdAt ?? 0` (desempate determinista por `id`) y devuelve `null` sin activos (active-node-feedback-contract §2; FR-005/FR-007).
- [X] T029 [US3] Implementar `latestActiveNodeId(model)` en `src/Domains/Graph/lib/activeNode.ts` (puro, depende de T028) (active-node-feedback-contract §2; research R2).
- [X] T030 [P] [US3] Extender `src/Domains/Graph/Hooks/specs/useFollowMode.spec.tsx` (E3/E4): el follow se dispara al cambiar el id seguido y no con el mismo id; reactivar el seguimiento enfoca el activo más reciente vigente (active-node-feedback-contract §3; FR-008/FR-009).
- [X] T031 [P] [US3] Extender `src/Domains/Graph/Hooks/specs/useGraphModel.spec.tsx`: `UseGraphModelResult` expone `latestActiveNodeId` (aditivo; `activeNodeId` se conserva) (active-node-feedback-contract §2).
- [X] T032 [US3] Extender `src/Domains/Graph/Hooks/useGraphModel.ts` (depende de T029 y T031): calcular `latestActiveNodeId(graph)` y añadirlo a `UseGraphModelResult` sin alterar `activeNodeId` (active-node-feedback-contract §2; data-model §2.2).
- [X] T033 [US3] Extender `src/Infrastructure/WorkspacePage.tsx` (depende de T032): pasar `graph.latestActiveNodeId` a `useFollowMode` en lugar de `graph.activeNodeId` (firma de `useFollowMode` sin cambios) (active-node-feedback-contract §3; research R2).

**Checkpoint**: Las tres historias P1 funcionan de forma independiente.

---

## Phase 6: User Story 4 - Leer el diff de archivos con formato de editor (Priority: P2)

**Goal**: El diff de cada archivo se muestra con canal doble de numeración, fondo por línea y hunks colapsables expandidos por defecto, distinguiendo el estado del archivo y sin romperse en casos límite.

**Independent Test**: Con un archivo modificado, el diff muestra añadidas/eliminadas por color, encabezados de bloque con rango y numeración, bloques colapsables; un archivo añadido/borrado se distingue; patch vacío/binario no rompe (quickstart.md §2 US4; specs D1..D9).

- [X] T034 [P] [US4] Extender `src/Domains/Inspector/Inspector.entity.ts` con los tipos de vista `TDiffLineKind`, `TDiffLine` y `TDiffHunk` (prefijo `T`, sin redefinir tipos del SDK; `TFileChange` sigue siendo alias de `FileDiffInfo`) (file-diff-contract §1; data-model §2.4; Principio IV).
- [X] T035 [P] [US4] Crear `src/Domains/Inspector/lib/specs/parseDiff.spec.ts` (D1..D5): clasificación `+`/`-`/contexto` con numeración doble incremental, múltiples hunks y `count` por defecto 1, `\ No newline at end of file` → `meta` sin números ni líneas espurias, patch vacío → `[]`, cabeceras inesperadas/contenido no textual no lanzan (file-diff-contract §1/§2; FR-016..FR-020).
- [X] T036 [US4] Implementar `parseUnifiedDiff(patch)` en `src/Domains/Inspector/lib/parseDiff.ts` (puro, depende de T035 y T034): recorrido lineal, hunks `@@ -a[,b] +c[,d] @@` con rango y numeración incremental; nunca lanza (file-diff-contract §1/§2; research R5).
- [X] T037 [P] [US4] Crear `src/Domains/Inspector/Components/specs/FileDiff.spec.tsx` (D6..D8): líneas añadidas/eliminadas/contexto con clases de token, canal doble de números, encabezados de hunk con `aria-expanded` **expandidos por defecto** y colapsables por teclado (file-diff-contract §3/§4; FR-016..FR-018).
- [X] T038 [US4] Crear `src/Domains/Inspector/Components/FileDiff.tsx` (depende de T036 y T037): render estilo editor con estado de colapso local (set por hunk), tokens para fondo/borde de línea y numeración mono tabular (file-diff-contract §3; design-direction §3.5).
- [X] T039 [P] [US4] Extender `src/Domains/Inspector/Components/specs/FileChanges.spec.tsx` (D4/D9): patch vacío → "parche no disponible"; estado del archivo (`added`/`modified`/`deleted`) distinguible y selección conserva `aria-pressed`.
- [X] T040 [US4] Extender `src/Domains/Inspector/Components/FileChanges.tsx` (depende de T038 y T039): sustituir el `<pre>` crudo por `FileDiff` cuando hay patch, conservando el orden de estados error→carga→vacío→datos y el estado del archivo como punto LED/etiqueta (file-diff-contract §3; FR-019; Principio VI).
- [X] T041 [US4] Extender `src/Domains/Inspector/Components/index.ts` para exportar `FileDiff` (depende de T038).

**Checkpoint**: US1..US4 funcionan de forma independiente.

---

## Phase 7: User Story 5 - Ajustar el ancho del panel de detalle (Priority: P2)

**Goal**: El usuario redimensiona el panel de detalle arrastrando un separador accesible por teclado; el ancho respeta mínimo/máximo, se persiste entre sesiones y no altera el grafo ni el contenido.

**Independent Test**: Con un nodo seleccionado, arrastrar el separador cambia el ancho dentro de límites; recargar conserva el ancho; `←`/`→` ajustan por pasos; el contenido no cambia (quickstart.md §2 US5; specs P1..P5).

- [X] T042 [P] [US5] Extender `src/Infrastructure/specs/WorkspacePage.spec.tsx` (P5): cambiar el ancho del panel no altera el contenido del inspector ni el grafo; en móvil **no** se montan el separador **ni el control de fullscreen** (device-gating vía `useDevice`; inspector-panel-contract §1/§3; FR-012; AGENTS §9).
- [X] T043 [US5] Extender `src/Infrastructure/Components/WorkspaceLayout.tsx` (depende de T009/T042): insertar el separador vertical en la presentación de escritorio (`role="separator"`, `aria-orientation="vertical"`, `aria-valuenow/min/max`, `tabIndex={0}`, zona de agarre 12 px / 4 px visibles, `cursor-col-resize`; `--surface-2` en reposo, `--status-running` al arrastrar) y aplicar `style={{ width }}` a la columna del inspector (inspector-panel-contract §1; SC-007).
- [X] T044 [US5] Extender `src/Infrastructure/Components/InspectorPane.tsx` para reenviar el ancho y los handlers de resize desde el layout (depende de T043) (inspector-panel-contract §1; Principio VI: no se duplica el render).
- [X] T045 [US5] Extender `src/Infrastructure/WorkspacePage.tsx` para instanciar `useInspectorPanel` y cablear `width`/`startResize`/`onResizeKey`/`isResizing` hacia `WorkspaceLayout` (depende de T044) (inspector-panel-contract §1; research R6).

**Checkpoint**: US1..US5 funcionan de forma independiente.

---

## Phase 8: User Story 6 - Ver el panel de detalle a pantalla completa (Priority: P3)

**Goal**: El panel de detalle se expande a toda el área de trabajo conservando contenido y estados de pantalla, y vuelve al layout normal con el mismo control y con `Escape`; el fullscreen no se persiste.

**Independent Test**: Con un nodo seleccionado, expandir el panel conserva el contenido y los cuatro estados; el mismo control y `Escape` vuelven al layout normal; recargar arranca en layout normal (quickstart.md §2 US6; specs P6..P8).

- [X] T046 [P] [US6] Extender `src/Domains/Inspector/Components/specs/InspectorPanel.spec.tsx` (P7): el encabezado incluye el control expandir/colapsar con `aria-pressed`/`aria-label`; en fullscreen se conservan encabezado y los estados error→carga→vacío→datos (inspector-panel-contract §2; FR-013..FR-015; Principio VI).
- [X] T047 [US6] Extender `src/Domains/Inspector/Components/InspectorPanel.tsx` (depende de T046): añadir el encabezado del panel con el título/estado del nodo y el botón `Maximize2`/`Minimize2` (`aria-pressed`, `aria-label`) que invoca el toggle, **solo en presentación de escritorio** (gateado por `useDevice`; en móvil no se monta) (inspector-panel-contract §2/§3).
- [X] T048 [US6] Extender `src/Infrastructure/Components/WorkspaceLayout.tsx` (depende de T009/T047): montar el **mismo** `InspectorPanel` en un overlay que cubre el área de trabajo con fondo `--surface-0` cuando `isFullscreen` es `true` (inspector-panel-contract §2; FR-014; research R7).
- [X] T049 [US6] Extender `src/Infrastructure/Components/InspectorPane.tsx` para reenviar `isFullscreen`/`toggleFullscreen` y el estado de pantalla sin duplicar el orden (depende de T048) (Principio VI).
- [X] T050 [US6] Extender `src/Infrastructure/WorkspacePage.tsx` (depende de T045/T049): cablear `isFullscreen`/`toggleFullscreen`/`closeFullscreen` y dar prioridad a cerrar el fullscreen antes de limpiar la selección en el `useEscapeKey` existente (inspector-panel-contract §2; FR-015).
- [X] T051 [P] [US6] Extender `src/Infrastructure/specs/WorkspacePage.spec.tsx` (P6): `toggleFullscreen` expande y el mismo control/`Escape` vuelven al layout normal; `isFullscreen` arranca `false` y no se persiste (inspector-panel-contract §2; quickstart P6, P8).

**Checkpoint**: Las seis user stories funcionan de forma independiente.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cierre, accesibilidad y validación de la feature.

- [X] T052 [P] Auditar accesibilidad de los controles nuevos (separador de resize, botón de fullscreen, encabezados de hunk) y verificar operabilidad por teclado y anuncio (SC-007; inspector-panel-contract §1/§2; file-diff-contract §4).
- [X] T053 [P] Extender `src/Infrastructure/specs/WorkspacePage.perf.spec.tsx` para SC-006 (**bloqueante**): con del orden de 150 nodos, el tick de 1 s no reconstruye nodos cuyo `effort`/duración no cambian (identidad estable) (effort-contract §4; Principio VII).
- [ ] T054 Ejecutar la validación automatizada de `specs/008-node-effort-inspector-ux/quickstart.md` §1: `npx vitest run src/Domains/Graph`, `npx vitest run src/Domains/Inspector`, `npx vitest run src/Infrastructure src/Application`, `npm test`, `npm run tsc`, `npm run lint` — todo en verde, incluyendo una verificación de rendimiento del parser de diff para SC-004 (20 archivos < 1 s) (depende de todas las fases previas).
- [ ] T055 Ejecutar la validación manual de `specs/008-node-effort-inspector-ux/quickstart.md` §2 y registrar evidencia de SC-001..SC-008 (barrido en activos, medidor por nodo, follow al más reciente, ancho persistido, diff con hunks expandidos) (depende de T054).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; **bloquea** todas las user stories (campo `effort` + helpers de panel).
- **User Stories (Phase 3+)**: dependen de Foundational. US1/US2/US3 (P1) pueden abordarse en cualquier orden una vez fundacional; US4, US5 y US6 reutilizan helpers previos pero son validables de forma independiente.
- **Polish (Phase 9)**: depende de todas las user stories deseadas.

### Foundational — orden interno

- T003 → T005 (tipo + campo → inicialización en `toGraphNode`).
- T004 (constantes) es independiente.
- T006 → T007 (spec → `panelWidth.ts`).
- T008 → T009 (spec → `useInspectorPanel.ts`); T009 depende además de T007.

### User Story Dependencies

- **US1 (P1)**: depende de T003, T004, T005. Es el MVP.
- **US2 (P1)**: depende de T002 (tokens/reduced-motion) y de `AgentNode`/`AgentNodeHeader` de US1 (T019/T020) por compartir esos archivos; sus specs pueden escribirse en paralelo con US1.
- **US3 (P1)**: depende de T032/T033 sobre `useGraphModel` (ya tocado en US1/T022) y `WorkspacePage`.
- **US4 (P2)**: depende de T034 (tipos) y T035 (parser).
- **US5 (P2)**: depende de T006..T009 (panel puro) y toca `WorkspaceLayout`/`InspectorPane`/`WorkspacePage`.
- **US6 (P3)**: depende de US5 (T043..T045) por reutilizar layout/pan y el estado `isFullscreen` del hook.

### Archivos compartidos entre historias (secuencial, nunca en paralelo)

- `AgentNode.spec.tsx` → T017 (US1), T023 (US2).
- `AgentNode.tsx` → T020 (US1), T027 (US2).
- `AgentNodeHeader.tsx` → T019 (US1), T026 (US2).
- `useGraphModel.spec.tsx` → T021 (US1), T031 (US3).
- `useGraphModel.ts` → T022 (US1), T032 (US3).
- `WorkspacePage.tsx` → T033 (US3), T045 (US5), T050 (US6).
- `WorkspacePage.spec.tsx` → T042 (US5), T051 (US6).
- `WorkspaceLayout.tsx` / `InspectorPane.tsx` → T043/T044 (US5), T048/T049 (US6).

### Within Each User Story

- Specs primero (deben fallar) → implementación → integración.
- Tipos antes que parser; parser antes que render; render antes que `FileChanges`.
- `deriveEffort` antes del medidor; medidor antes del encabezado; encabezado antes del nodo.
- Cada story completa y verificable antes de pasar a la siguiente prioridad.

### Parallel Opportunities

- Foundational: T003, T004, T006, T008 (archivos distintos) pueden escribirse en paralelo.
- US1: T010, T012, T014, T016, T017, T021 (specs/tipos) en paralelo; luego implementación secuencial.
- US2: T023, T024 en paralelo; T026 puede ir con T025.
- US3: T028, T030, T031 en paralelo; T029 después de T028.
- US4: T034, T035, T037, T039 en paralelo; implementaciones después de sus specs.
- US5/US6: T042 y T046/T051 (specs) en paralelo con la implementación del layout.

---

## Parallel Example: US1 (specs puros)

```bash
# Escribir en paralelo los specs que deben fallar primero:
Task: "effort.spec.ts — escala acumulativa, tope 5, provisionalidad (T010)"
Task: "reconcileGraph.spec.ts — sameEffort + sameNodeData (T012)"
Task: "cardHeight.spec.ts — el medidor no añade filas (T014)"
Task: "EffortMeter.spec.tsx — N muescas + aria-label (T016)"
Task: "AgentNode.spec.tsx — medidor en el encabezado (T017)"
Task: "useGraphModel.spec.tsx — effort + identidad estable (T021)"
```

## Parallel Example: Foundational (helpers puros)

```bash
Task: "Graph.entity.ts — TNodeEffort + effort (T003)"
Task: "lib/effort/constants.ts — umbrales (T004)"
Task: "panelWidth.spec.ts — clamp (T006)"
Task: "useInspectorPanel.spec.tsx — resize/persistencia/fullscreen (T008)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (T001–T002).
2. Completar Phase 2: Foundational (T003–T009) — **crítico**, bloquea todo.
3. Completar Phase 3: US1 (T010–T022).
4. **STOP y VALIDAR**: correr los specs de US1 y la validación manual US1 (quickstart §2).
5. Demo si está listo: cada nodo muestra su nivel de esfuerzo de un vistazo.

### Incremental Delivery

1. Setup + Foundational → campo `effort` y helpers de panel listos.
2. US1 → MVP: medidor de esfuerzo por nodo.
3. US2 → animación "pensando" en activos.
4. US3 → follow al activo más reciente.
5. US4 → diff estilo editor.
6. US5 → resize del panel persistido.
7. US6 → fullscreen efímero del panel.
8. Polish → puerta de calidad + validación end-to-end de la feature.

### Notes

- [P] = archivos distintos, sin dependencias pendientes.
- Specs junto al código en `specs/` (Principio VIII); lógica pura sin React (Principio V).
- Restricciones de la feature: animación **CSS pura**; `effort` **debe** entrar en `sameNodeData`; el medidor va en una **fila existente** (o ajuste de `cardHeight`); **sin dependencias nuevas** y **sin SDK/SSE nuevos** (research R1/R4/R8/R9; plan.md Constraints).
- La decisión pendiente del barrel de `EffortMeter` se resuelve en US1/T020: se queda en `Graph/Components` (un solo consumidor).
- Commits con Conventional Commits, scope `graph`/`inspector`/`infra` (`feat(graph): …`, `feat(inspector): …`) según `AGENTS.md`.
- Commit por tarea o grupo lógico; detenerse en cada checkpoint para validar la story de forma independiente.
