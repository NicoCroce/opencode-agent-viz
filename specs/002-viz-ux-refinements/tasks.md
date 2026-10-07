---
description: "Task list for feature 002-viz-ux-refinements"
---

# Tasks: Refinamientos de experiencia del visor

**Input**: Design documents from `/specs/002-viz-ux-refinements/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Incluidos — la spec ([quickstart.md](./quickstart.md) → "Tests automáticos esperados"), [research.md](./research.md) R6 y la Constitución (Principio V) los exigen explícitamente.

**Organization**: Tareas agrupadas por user story para permitir implementación y testeo independientes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias)
- **[Story]**: User story a la que pertenece (US1..US5)
- Cada tarea incluye la ruta exacta del archivo

## Path Conventions

- Single project (SPA frontend): `src/` en la raíz del repositorio.
- Specs de tests junto al código, en carpetas `specs/` (Constitución VIII).
- Convenciones de dominio y nombres en `AGENTS.md` (entity/lib/Components/Hooks/index, prefijo `T`).

## Nota de reconciliación (contratos vs. data-model)

Los contratos en [contracts/](./contracts/) son la fuente de verdad para firmas:
`buildChain(model: TGraphModel, nodeId: string): TGraphModel | null` y
`layoutChain(model: TGraphModel): TGraphModel`. El `TChainView` de
[data-model.md](./data-model.md) se materializa como `TGraphModel` con `nodes`
ordenados raíz→nodo (`nodeIds` es derivable con `nodes.map(n => n.id)`), por lo
que **no** se crea un tipo extra. Único tipo nuevo de entidad: `TNodeSizeOverride`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar la superficie de dependencias y el tooling de tests antes de tocar código.

- [X] T001 Verificar que `@xyflow/react` 12 exporta `NodeResizer` y los tipos `OnNodesChange`, `NodeChange`, `NodeDimensionChange` y `NodePositionChange`, y que Vitest/Testing Library y `renderWithProviders` están listos; confirmar que **no** se requieren dependencias nuevas en `package.json`

**Checkpoint**: Superficie de APIs confirmada — no se instala nada.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Primitivas de view-model y helper puro compartidos por las vistas del grafo y de sesiones. Ninguna UI de historia puede consumirlos hasta que existan.

**⚠️ CRITICAL**: Ninguna user story debe empezar hasta completar esta fase.

- [X] T002 [P] Agregar el tipo `TNodeSizeOverride` (`{ width: number; height: number; x?: number; y?: number }`) en `src/Domains/Graph/Graph.entity.ts` (estado de vista local, sin persistencia; Principio IV)
- [X] T003 [P] Crear `formatTimeRange` con la interfaz `TTimeRangeInput` (`startedAt`, `endedAt`, `isRunning`) en `src/Application/Helpers/formatTimeRange.ts` y exportarlo desde `src/Application/Helpers/index.ts` (reglas "en curso"/"no disponible"/`HH:mm`, sin `Date.now()` interno)
- [X] T004 [P] Crear los tests puros `src/Application/Helpers/specs/formatTimeRange.spec.ts` (ambos extremos, en curso, `endedAt` faltante, `startedAt` faltante, ambos faltantes, formato `HH:mm`)

**Checkpoint**: Tipos y helper listos — las historias pueden comenzar.

---

## Phase 3: User Story 1 - Resize del nodo de agente (Priority: P1) 🎯 MVP

**Goal**: El usuario agranda el bloque de un agente arrastrando esquina/borde; el tamaño es por nodo, sobrevive a las actualizaciones en vivo y se reinicia al cambiar de sesión (FR-001..FR-004).

**Independent Test**: Abrir una sesión con un nodo cuyo contenido exceda el tamaño actual, redimensionarlo y comprobar que el contenido se ve completo, que el tamaño persiste ante actividad en vivo y que vuelve al default al cambiar de sesión (quickstart V1).

### Tests for User Story 1 (escribir y ver fallar antes de implementar) ⚠️

- [X] T005 [P] [US1] Crear `src/Domains/Graph/lib/specs/nodeResize.spec.ts`: dimensiones actualizan `width`/`height`, posición de resize actualiza `x`/`y`, cambios no relevantes (select) se ignoran, inmutabilidad y reset
- [X] T006 [P] [US1] Crear `src/Domains/Graph/Hooks/specs/useNodeResize.spec.tsx`: `onNodesChange` delega en `reduceNodeOverrides` y los overrides se limpian al cambiar `resetKey`
- [X] T007 [P] [US1] Extender `src/Domains/Graph/Components/specs/AgentNode.spec.tsx`: verificar que el nodo renderiza los controles de resize de `NodeResizer` (clase `react-flow__resize-control`) dentro de `ReactFlowProvider`, y que el nodo `selected` usa `border-accent` mientras un ancestro no seleccionado no lo usa (cubre FR-008 de US2)

### Implementation for User Story 1

- [X] T008 [P] [US1] Crear `reduceNodeOverrides` con las constantes `MIN_NODE_WIDTH = 180` y `MIN_NODE_HEIGHT = 72` en `src/Domains/Graph/lib/nodeResize.ts` (pura, sin React; no muta la entrada)
- [X] T009 [US1] Crear `useNodeResize(resetKey)` en `src/Domains/Graph/Hooks/useNodeResize.ts` delegando en `reduceNodeOverrides`, con limpieza por `resetKey`, y exportarlo desde `src/Domains/Graph/Hooks/index.ts` (depende de T008)
- [X] T010 [US1] Extender `src/Domains/Graph/Components/AgentNode.tsx`: agregar `<NodeResizer nodeId={id} isVisible minWidth={180} minHeight={72} />` con tiradores planos revelados en hover/focus/selected, y layout `h-full w-full` con `min-w-0`/`flex-wrap` para evitar superposición al agrandar (depende de T002, T008)
- [X] T011 [US1] Extender `src/Domains/Graph/Components/AgentGraph.tsx`: convertir el grafo en controlado (`onNodesChange` desde `useNodeResize(resetKey)`), combinar `graph.nodes` con los overrides (`width`/`height`/`x`/`y`) y agregar la prop `resetKey` (depende de T009, T010)
- [X] T012 [US1] Extender `src/Infrastructure/WorkspacePage.tsx`: pasar `resetKey={rootId}` a `AgentGraph` para que el tamaño no se filtre entre sesiones (depende de T011)

**Checkpoint**: US1 funcional y testeable de forma independiente (MVP).

---

## Phase 4: User Story 2 - Modo cadena de ejecución (Priority: P1)

**Goal**: Al seleccionar un nodo, ocultar el resto y mostrar solo la cadena raíz→nodo en una sola fila; volver al grafo completo con clic en el fondo o `Escape` (FR-005..FR-008).

**Independent Test**: Seleccionar un nodo con al menos un ancestro, comprobar que solo se ven los nodos/conexiones de la cadena raíz→nodo en una fila y en orden; volver con clic en el fondo y con `Escape` (quickstart V2).

### Tests for User Story 2 (escribir y ver fallar antes de implementar) ⚠️

- [X] T013 [P] [US2] Crear `src/Domains/Graph/lib/specs/chainGraph.spec.ts`: orden raíz→nodo, raíz sola sin aristas, nodo ausente → `null`, ignora hermanos/descendientes, y `layoutChain` deja `y` constante con `x` creciente
- [X] T014 [P] [US2] Crear `src/Domains/Graph/Hooks/specs/useChainSelection.spec.tsx`: `selectNode` activa `isChainMode`, `clearSelection` lo desactiva, `inspectedNodeId = selectedNodeId ?? rootId` y reset al cambiar `rootId`

### Implementation for User Story 2

- [X] T015 [P] [US2] Crear `buildChain(model, nodeId): TGraphModel | null` y `layoutChain(model): TGraphModel` (con la constante `CHAIN_GAP`) en `src/Domains/Graph/lib/chainGraph.ts` (puras, O(n), sin dagre) y exportarlas desde `src/Domains/Graph/index.ts` (depende de T002)
- [X] T016 [P] [US2] Crear `useEscapeKey(handler, enabled)` en `src/Application/Hooks/useEscapeKey.ts` (listener `keydown` con limpieza) y exportarlo desde `src/Application/Hooks/index.ts`
- [X] T017 [US2] Crear `useChainSelection(rootId)` en `src/Domains/Graph/Hooks/useChainSelection.ts` con `{ selectedNodeId, inspectedNodeId, isChainMode, selectNode, clearSelection }`, reset por `rootId`, y exportarlo desde `src/Domains/Graph/Hooks/index.ts` (depende de T015)
- [X] T018 [US2] Extender `src/Domains/Graph/Components/AgentGraph.tsx`: props `isChainMode`/`onClearSelection`, `onPaneClick` → `onClearSelection`, y un `FitViewController` interno que llama `fitView` cuando cambia `topologySignature(graph)` (depende de T011, T015)
- [X] T019 [US2] Extender `src/Infrastructure/WorkspacePage.tsx`: derivar `displayGraph` con `buildChain`/`layoutChain` (fallback al grafo completo si `null`), separar selección explícita de inspección vía `useChainSelection` (pasar `AgentGraph.selectedNodeId = selectedNodeId` explícito, que puede ser `null` al montar, y `InspectorPanel` con `inspectedNodeId = selectedNodeId ?? rootId`), y conectar `useEscapeKey` para salir del modo cadena (depende de T016, T017, T018)

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 - Historial de herramientas truncado (Priority: P2)

**Goal**: El inspector muestra las primeras 10 entradas en orden cronológico y ofrece desplegar el resto hacia abajo indicando cuántas quedan ocultas (FR-009..FR-012).

**Independent Test**: Abrir el inspector de un nodo con más de 10 herramientas y comprobar 10 visibles + control "Ver N más"; con ≤10 no aparece control (quickstart V3).

### Tests for User Story 3 (escribir y ver fallar antes de implementar) ⚠️

- [X] T020 [P] [US3] Crear `src/Domains/Inspector/Hooks/specs/useToolHistory.spec.tsx`: 0/10/11 entradas, `hiddenCount`, `canExpand`, `toggle` y orden cronológico preservado
- [X] T021 [P] [US3] Crear `src/Domains/Inspector/Components/specs/ToolHistory.spec.tsx`: con 11 muestra 10 + control; con 10 no muestra control; expandir revela el resto y contraer vuelve a 10

### Implementation for User Story 3

- [X] T022 [P] [US3] Crear `TOOL_HISTORY_LIMIT = 10` y `useToolHistory(tools)` en `src/Domains/Inspector/Hooks/useToolHistory.ts` con `{ visibleTools, hiddenCount, canExpand, isExpanded, toggle }` (mismo orden, sin invertir) y exportarlo desde `src/Domains/Inspector/Hooks/index.ts`
- [X] T023 [US3] Extender `src/Domains/Inspector/Components/ToolHistory.tsx`: renderizar `visibleTools` y, si `canExpand`, un control plano con chevron `"Ver {hiddenCount} más"` / `"Ver menos"` accesible (`aria-expanded`), conservando el estado vacío y las filas actuales (depende de T022)

**Checkpoint**: US3 funcional y testeable de forma independiente.

---

## Phase 6: User Story 4 - Tarjeta de sesión: título arriba, agente abajo (Priority: P2)

**Goal**: Cada tarjeta muestra el título de la sesión como texto principal y el agente como texto secundario, con `"agente no disponible"` cuando falta (FR-013).

**Independent Test**: Observar la lista y comprobar título arriba / agente abajo, y el fallback cuando no hay agente (quickstart V4).

### Tests for User Story 4 (escribir y ver fallar antes de implementar) ⚠️

- [X] T024 [P] [US4] Extender `src/Domains/Sessions/Components/specs/SessionCard.spec.tsx`: el título es la línea principal (arriba) y el agente la secundaria (abajo); con `agentName: null` se muestra `"agente no disponible"`; `onSelect` no cambia

### Implementation for User Story 4

- [X] T025 [US4] Extender `src/Domains/Sessions/Components/SessionCard.tsx`: fila principal `StatusDot` + `session.title` (`text-sm font-medium`, truncado) y fila secundaria con `agentName` (`text-xs text-muted-foreground`) o `"agente no disponible"`; conservar `selected` y `onSelect(session.id)` (depende de T024)

**Checkpoint**: US4 funcional y testeable de forma independiente.

---

## Phase 7: User Story 5 - Rango horario "inicio – última ejecución" (Priority: P3)

**Goal**: Tarjeta y nodo muestran `inicio – última ejecución` con hora de fin real; si sigue en curso, `inicio – en curso`; si falta un dato, `"no disponible"` (FR-014..FR-016).

**Independent Test**: Comprobar el rango en una sesión terminada, en un nodo terminado, en un nodo en curso (`en curso`) y en un origen sin hora (`no disponible`) (quickstart V5).

### Tests for User Story 5 (escribir y ver fallar antes de implementar) ⚠️

- [X] T026 [P] [US5] Extender `src/Domains/Graph/Components/specs/AgentNode.spec.tsx`: el nodo muestra el rango con `metrics.startedAt`/`metrics.endedAt`, `"– en curso"` con estado `running`/`waiting` y `"no disponible"` cuando falta un extremo
- [X] T027 [P] [US5] Extender `src/Domains/Sessions/Components/specs/SessionCard.spec.tsx`: la tarjeta muestra el rango con `time.created`/`time.updated`, `"– en curso"` con `busy`/`retry` y `"no disponible"` cuando corresponde

### Implementation for User Story 5

- [X] T028 [US5] Integrar `formatTimeRange` en `src/Domains/Graph/Components/AgentNode.tsx` usando `metrics.startedAt`/`metrics.endedAt` e `isRunning = status === 'running' || status === 'waiting'`, junto a la duración existente (depende de T003, T010)
- [X] T029 [US5] Integrar `formatTimeRange` en `src/Domains/Sessions/Components/SessionCard.tsx` usando `session.time.created`/`session.time.updated` e `isRunning = status?.type === 'busy' || status?.type === 'retry'`, reemplazando el `formatTime` local (depende de T003, T025)

**Checkpoint**: Las cinco historias funcionan de forma independiente.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Mejoras que afectan a varias historias y validación final.

- [X] T030 [P] Verificar y completar (solo lo que falte) los barrel exports en `src/Domains/Graph/index.ts`, `src/Domains/Inspector/index.ts`, `src/Application/Hooks/index.ts` y `src/Application/Helpers/index.ts` para exponer `chainGraph`, `nodeResize`, `useNodeResize`, `useChainSelection`, `useToolHistory`, `useEscapeKey` y `formatTimeRange`
- [X] T031 Ejecutar `npm run tsc` (`tsconfig.json`), `npm run lint` (`eslint.config.js`) y `npm test` (`vitest.config.ts`) y corregir cualquier fallo de tipado, lint o tests en `src/`
- [ ] T032 [P] Ejecutar la validación manual de [quickstart.md](./quickstart.md) (V1–V6) y verificar SC-001..SC-009
- [X] T033 Verificar FR-018..FR-020 en las vistas afectadas (`src/Domains/Graph/Components/AgentGraph.tsx`, `src/Domains/Graph/Components/AgentNode.tsx`, `src/Domains/Inspector/Components/ToolHistory.tsx`, `src/Domains/Sessions/Components/SessionCard.tsx`): consistencia Dark Mode / Flat Design, uso en pantallas pequeñas vía tabs (`src/Infrastructure/WorkspacePage.tsx`) sin duplicar lógica y condición de solo lectura (sin prompts/abort/permisos nuevos)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — puede empezar ya.
- **Foundational (Phase 2)**: depende de Setup — **bloquea** todas las historias.
- **User Stories (Phase 3+)**: dependen de Foundational; pueden ir en paralelo (si hay equipo) o en orden de prioridad (US1 → US2 → US3 → US4 → US5).
- **Polish (Phase 8)**: depende de que las historias deseadas estén completas.

### User Story Dependencies

- **US1 (P1)**: arranca tras Foundational — sin dependencias de otras historias.
- **US2 (P1)**: arranca tras Foundational — comparte archivos con US1 (`AgentGraph.tsx`, `WorkspacePage.tsx`), por lo que sus tareas de esos archivos deben ejecutarse **después** de las de US1.
- **US3 (P2)**: arranca tras Foundational — sin dependencias de otras historias.
- **US4 (P2)**: arranca tras Foundational — sin dependencias de otras historias.
- **US5 (P3)**: depende de T003 (helper) y de las integraciones de US1 (`AgentNode.tsx`, T010) y US4 (`SessionCard.tsx`, T025); debe ser independientemente testeable con esos archivos ya extendidos.

### Within Each User Story

- Tests primero y deben **fallar** antes de implementar.
- Funciones puras (`lib/`) antes que hooks; hooks antes que componentes.
- Componentes antes de la orquestación (`WorkspacePage`).
- Historia completa antes de pasar a la siguiente prioridad.

### Parallel Opportunities

- T002, T003, T004 (Foundational) en paralelo.
- US1: T005, T006, T007, T008 en paralelo (archivos distintos); T009→T010→T011→T012 en cadena.
- US2: T013, T014, T015, T016 en paralelo; T017→T018→T019 en cadena.
- US3: T020, T021, T022 en paralelo; T023 depende de T022.
- US5: T026 y T027 en paralelo; T028 y T029 en paralelo (archivos distintos) tras sus dependencias.
- US3 y US4 pueden desarrollarse en paralelo por completo (dominios distintos).

### Shared-file sequencing (evitar conflictos)

- `src/Domains/Graph/Components/AgentGraph.tsx`: T011 (US1) antes de T018 (US2).
- `src/Infrastructure/WorkspacePage.tsx`: T012 (US1) antes de T019 (US2).
- `src/Domains/Graph/Components/AgentNode.tsx`: T010 (US1) antes de T028 (US5).
- `src/Domains/Sessions/Components/SessionCard.tsx`: T025 (US4) antes de T029 (US5).
- `AgentNode.spec.tsx` / `SessionCard.spec.tsx` se extienden en varias historias; respetar el orden de fases.

---

## Parallel Example: User Story 1

```bash
# Tests de US1 en paralelo:
Task: "nodeResize.spec.ts en src/Domains/Graph/lib/specs/"
Task: "useNodeResize.spec.tsx en src/Domains/Graph/Hooks/specs/"
Task: "extender AgentNode.spec.tsx"
Task: "nodeResize.ts en src/Domains/Graph/lib/"
```

## Parallel Example: User Story 3

```bash
Task: "useToolHistory.spec.tsx en src/Domains/Inspector/Hooks/specs/"
Task: "ToolHistory.spec.tsx en src/Domains/Inspector/Components/specs/"
Task: "useToolHistory.ts en src/Domains/Inspector/Hooks/"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Phase 1: Setup.
2. Completar Phase 2: Foundational (bloqueante).
3. Completar Phase 3: US1 (resize).
4. **STOP y VALIDAR**: probar US1 de forma independiente (quickstart V1).
5. Como US2 también es P1, el siguiente incremento recomendado es US2 (modo cadena).

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → validar → demo (MVP).
3. US2 → validar → demo.
4. US3 → validar → demo.
5. US4 → validar → demo.
6. US5 → validar → demo.
7. Polish (T030–T033) → `tsc`/`lint`/`test` verdes y quickstart completo.

### Parallel Team Strategy

1. El equipo completa Setup + Foundational.
2. Tras Foundational:
   - Dev A: US1 → luego US2 (archivos compartidos de Graph).
   - Dev B: US3 (Inspector).
   - Dev C: US4 (Sessions) y luego US5 (requiere US1 y US4).
3. Integración y validación final en Polish.

---

## Notes

- [P] = archivos distintos, sin dependencias.
- [Story] mapea cada tarea a su user story para trazabilidad.
- Escribir los tests primero y verlos fallar.
- Commit por tarea o grupo lógico (Conventional Commits; ver `AGENTS.md`).
- No tocar `.opencode/commands/`, `.specify/scripts/`, `.specify/templates/` ni la constitución.
- El SDK de OpenCode se invoca **solo** desde `*.service.ts`; esta feature no agrega llamadas (Principio III).
- Sin re-layout del grafo por eventos de estado (Principio VII).
- Los tests nuevos usan modelos sintéticos para las proyecciones puras (hallazgo V1 del analyze: aceptado; el fixture `run.ndjson` se reserva para los tests de integración existentes).

---

## Phase 9: Convergence

- [X] T034 Filtrar en `reduceNodeOverrides` (`src/Domains/Graph/lib/nodeResize.ts`) los cambios `dimensions` de **medición automática** de React Flow (los que no traen `resizing` ni `setAttributes`) y conservar solo los del resize del usuario, para que el alto del nodo siga siendo automático por contenido hasta que el usuario lo redimensione y no se recorte la línea de herramienta actual cuando aparece o desaparece; extender `src/Domains/Graph/lib/specs/nodeResize.spec.ts` con el caso de medición ignorada per FR-002 (partial)
- [X] T035 Evitar que los overrides de posición (`x`/`y`) de un resize previo en el grafo completo se apliquen a las posiciones calculadas por `layoutChain` en modo cadena (en `src/Domains/Graph/Components/AgentGraph.tsx`, ignorando `position` del override cuando `isChainMode` es `true`), para que la cadena visible siga siendo una sola fila en orden raíz→nodo; agregar cobertura que no dependa de `ResizeObserver` per FR-006 (partial)
