---

description: "Task list for feature implementation"
---

# Tasks: Rendimiento del visualizador de grafo

**Input**: Design documents from `/specs/006-graph-render-performance/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: **Sí, requeridos.** El plan (`Technical Context` → Testing), la Constitución (Principio VIII), los tres contratos (`contracts/*.md`, criterios C1..C6, L1..L9, P1..P5) y `quickstart.md` §1 exigen specs junto al código. Cada spec se escribe contra el contrato congelado y debe fallar antes de la implementación.

**Organization**: Tareas agrupadas por historia de usuario para permitir implementación y prueba independientes. El trabajo puro y los tipos de vista compartidos por varias historias viven en la fase fundacional.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (ficheros distintos, sin dependencias de tareas incompletas)
- **[Story]**: Historia a la que pertenece la tarea (`[US1]`, `[US2]`, `[US3]`, `[US4]`)
- Cada tarea incluye la ruta exacta del fichero

## Path Conventions

- Proyecto único (SPA frontend): `src/`, specs junto al código en carpetas `specs/` (Constitución VIII).
- Dominio núcleo: `src/Domains/Graph/` (`lib/`, `Hooks/`, `Components/`).
- Pieza transversal: `src/Application/Helpers/` (instrumentación).
- Orquestación: `src/Infrastructure/WorkspacePage.tsx`.
- **Sin dependencias nuevas** y **sin migración a canvas** (plan.md, research.md R7).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificar herramientas/fixtures e introducir el helper de instrumentación con el que se captura la línea base. **No se añaden dependencias** (plan.md, research.md).

- [X] T001 [P] Verificar herramientas y fixtures de test (Vitest, `src/test/renderWithProviders.tsx`, fixtures `src/Domains/Graph/lib/__fixtures__/run.ndjson` y `run.v2.ndjson`) y crear builders reutilizables de `SessionInfo`/`SessionStatus`/mensajes para los specs nuevos en `src/Domains/Graph/lib/specs/fixtures.ts`
- [X] T002 [P] Crear el helper puro de instrumentación `src/Application/Helpers/perf.ts` (`PERF_METRIC`, `TPerfMetricName`, `perfMark`, `perfMeasure`, no-op seguro sin `performance`, `detail` acotado a métricas) y exportarlo desde `src/Application/Helpers/index.ts` (FR-011, contrato de instrumentación §2-§3)
- [X] T003 [P] Escribir `src/Application/Helpers/specs/perf.spec.ts`: nombres de medida correctos y `detail` con stub de `performance`; no-op seguro sin `performance` (P1..P3)
- [ ] T004 Capturar la **línea base** con la implementación actual (perfil de DevTools) según `specs/006-graph-render-performance/quickstart.md` §2 para sesión pequeña (≤ 5 agentes) y grande (~50 agentes), en apertura fría, revisita e interacción, y registrar p50/p90 (FR-011, Dependencies)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos de vista y funciones puras compartidas por todas las historias (base de métricas, enriquecimiento en `buildGraph`, índice del subárbol). **⚠️ CRÍTICO**: ninguna historia puede empezar hasta completar esta fase.

- [X] T005 [P] Extender `src/Domains/Graph/Graph.entity.ts` con `TEnrichmentState` (`'pending' | 'ready'`), el campo `enrichment` en `TGraphNodeData` y el tipo de vista `TMetricBase` (métricas independientes del reloj) (data-model §1.3, §2.1)
- [X] T006 [P] Dividir `src/Domains/Graph/lib/deriveMetrics.ts`: extraer `deriveMetricBase(messages): TMetricBase` (sin `now`; incluye `model`, `currentTool` y `lastAssistantErrored` además de `startedAt`/`endedAt`/`cost`/`tokens`/`retryCount`/`hasLoop`/`loopEvidence`) y `resolveMetrics(base, status, now, subtaskInvocations): TNodeMetrics` (posicional), dejando `deriveMetrics(input: DeriveMetricsInput)` como envoltorio de objeto equivalente `{ messages, status, subtaskInvocations, now }` para no romper consumidores ni `buildGraph` (R3, data-model §2.1, Principio V)
- [X] T007 [P] Extender `src/Domains/Graph/lib/specs/deriveMetrics.spec.ts`: `deriveMetricBase` estable frente al reloj + `resolveMetrics` (`durationMs = (endedAt ?? now) - startedAt`, retry del `status`)
- [X] T008 Extender `src/Domains/Graph/lib/buildGraph.ts` para consumir `deriveMetricBase`/`resolveMetrics` y emitir `data.enrichment` (entrada opcional con default `'ready'` para preservar la firma y la paridad actual) (R1, R3)
- [X] T009 Extender `src/Domains/Graph/lib/specs/buildGraph.spec.ts` con casos de `enrichment` (`'pending'` y `'ready'`) sin alterar los casos de paridad existentes (mismo fichero que T034 → ejecutar en orden)
- [X] T010 Reemplazar el `sessions.find` del BFS de `filterSubtree` por un índice `Map<string, SessionInfo>` en `src/Domains/Graph/Hooks/useGraphModel.ts` (de O(n²) a O(n), R4)

**Checkpoint**: Tipos y funciones puras listos; las historias pueden empezar.

---

## Phase 3: User Story 1 - Cambiar de sesión sin esperas largas (Priority: P1) 🎯 MVP

**Goal**: Modelo por fases (estructura primero con datos ya cacheados; enriquecimiento después) y carga progresiva, priorizada y cancelable, para que el cambio de sesión se perciba inmediato y el grafo aparezca dentro del objetivo de tiempo.

**Independent Test**: Abrir una sesión con subárbol grande y medir el tiempo hasta que el grafo está visible/encuadrado (≤ 1.5 s p90) y compararlo con una pequeña (≤ 2×); reabrir una sesión visitada y comprobar que aparece sin recarga (≤ 300 ms); interactuar con lista/cabecera durante la carga.

### Tests for User Story 1 ⚠️

> **NOTA: escribir estos tests primero y comprobar que fallan antes de implementar.**

- [X] T011 [P] [US1] Escribir `src/Domains/Graph/lib/specs/loadPriority.spec.ts`: orden 1→5 determinista, `skippedIds = intersección con readyIds` y `chunkLoadPlan` sin pérdidas/duplicados (`size <= 0` → `1`) (L1..L3)
- [X] T012 [P] [US1] Escribir `src/Domains/Graph/Hooks/specs/useGraphStructure.spec.tsx` con `renderWithProviders` y espía de `opencodeService`: la estructura se deriva sin llamar a `getSessionMessages`/`getSessionLog`/`getSessionPermissions`/formularios/inbox (L4)
- [X] T013 [P] [US1] Escribir `src/Domains/Graph/Hooks/specs/useGraphEnrichment.spec.tsx` con fake timers/idle: procesa por lotes, transición `pending→ready` y reinicio del plan al cambiar de sesión sin bloquear (L5..L6)
- [X] T014 [P] [US1] Escribir `src/Domains/Graph/Hooks/specs/useGraphModel.spec.tsx`: forma pública de `UseGraphModelResult` sin cambios y revisita sin recarga (`skippedIds` completos) (L7..L8)
- [X] T015 [P] [US1] Escribir `src/Infrastructure/specs/WorkspacePage.perf.spec.tsx`: `open` vs `revisit` se distinguen por presencia de estructura en caché (P4)

### Implementation for User Story 1

- [X] T016 [P] [US1] Crear `src/Domains/Graph/lib/loadPriority.ts` con `TLoadOptions`, `TLoadPlan`, `LOAD_CHUNK_SIZE = 8`, `orderSubtreeForLoad(subtree, options)` (raíz → ancestros/descendientes del seleccionado → activos → BFS por nivel de ejecución → resto por `time.created` → desempate por `id`) y `chunkLoadPlan(ids, size)` (FR-003, contrato de carga §2)
- [X] T017 [US1] Crear `src/Domains/Graph/Hooks/useGraphStructure.ts`: construye el `TGraphModel` solo con `queryKeys.sessions.list(directory)`, `queryKeys.sessions.status()` y `queryKeys.agents.list(directory)`, con `data.metrics = EMPTY_METRICS` y `enrichment: 'pending'`; sin consultas de contenido nuevas. En esta fase solo son definitivos los estados derivables de `SessionStatus` (`running`/`retrying`/`created`); `compacting`, esperas y terminales quedan provisionales hasta `enrichment: 'ready'` (contrato de carga §1.1, data-model §2.2) (FR-010, SC-007)
- [X] T018 [US1] Crear `src/Domains/Graph/Hooks/useGraphEnrichment.ts` con firma `useGraphEnrichment(ids, structure)` (`structure` = `TGraphModel` de la fase estructural): consume `orderSubtreeForLoad`/`chunkLoadPlan`, carga por lotes (`requestIdleCallback` con fallback a `setTimeout`), escribe en las **mismas claves** que `eventReducer`, marca `enrichment: 'ready'` y cancela/reinicia el plan al cambiar `sessionId`/`ids` (FR-003, FR-004, SC-002, SC-003, SC-008, contrato de carga §1.2)
- [X] T019 [US1] Refactorizar `src/Domains/Graph/Hooks/useGraphModel.ts` para componer `useGraphStructure` + `useGraphEnrichment`, conservando firma y forma de `UseGraphModelResult`, el `isLoading` (estructura aún ausente) y el `isError`/`error` de `sessionsQuery` (FR-002, FR-008, contrato de carga §1)
- [X] T020 [US1] Actualizar `src/Domains/Graph/Hooks/index.ts` para exportar `useGraphStructure` y `useGraphEnrichment` (y confirmar que `src/Domains/Graph/index.ts` mantiene la API pública sin exponerlas si el contrato las define internas)
- [X] T021 [US1] Instrumentar `src/Infrastructure/WorkspacePage.tsx` con `perfMark`/`perfMeasure` de `graph.session.open` (estructura no cacheada) y `graph.session.revisit` (cacheada) al cambiar de sesión (FR-011, contrato de instrumentación §4)

**Checkpoint**: US1 funcional y probable de forma independiente: cambio de sesión inmediato, estructura primero, métricas progresivas, revisita sin recarga (MVP).

---

## Phase 4: User Story 2 - Mantener fluidez con grafos de muchos nodos (Priority: P1)

**Goal**: Identidad estable de nodos/aristas y foco (hover/linaje) por contexto para que pan/zoom/hover/selección no reconstruyan el modelo ni provoquen re-render global.

**Independent Test**: Cargar una sesión de ≥ 100 nodos y ejecutar pan, zoom, hover y selección comprobando que no hay pausas perceptibles (interacción < 100 ms) y que hover/selección **no** recrean los arrays de nodos/aristas.

### Tests for User Story 2 ⚠️

- [X] T022 [P] [US2] Escribir `src/Domains/Graph/lib/specs/reconcileGraph.spec.ts`: `prev = null` → `next`; reutiliza el **mismo objeto** de nodo por identidad (`===`) cuando `id`/`position`/`data` no cambian; `edges === prev.edges` si la firma de topología no cambia; no muta entradas (C1..C2)
- [X] T023 [P] [US2] Extender `src/Domains/Graph/lib/specs/buildViewNodes.spec.ts`: el `height` sale ya calculado y `cardHeight` no se recalcula aguas abajo (espía/mock de `cardHeight`) (C5)
- [X] T024 [P] [US2] Extender `src/Domains/Graph/Components/specs/AgentGraph.spec.tsx`: referencia de `nodes`/`edges` estable ante hover/selección y número de medidas de interacción acotado a la transición (C3, P5)
- [X] T025 [P] [US2] Extender `src/Domains/Graph/Components/specs/AgentNode.spec.tsx`: la opacidad de **linaje** del nodo (sin `hover`) se resuelve por contexto con la tabla de precedencia del contrato y `EMPTY_NODE_FOCUS` fuera del provider (el hover solo afecta a las aristas) (C4)

### Implementation for User Story 2

- [X] T026 [P] [US2] Crear `src/Domains/Graph/lib/reconcileGraph.ts`: `reconcileGraphModel(prev, next)` puro que reutiliza nodos por `id`/`position`/`data` (campo a campo) y `edges` por `topologySignature` (R4, contrato de render §1.1)
- [X] T027 [P] [US2] Crear `src/Domains/Graph/Components/NodeFocusContext.tsx`: `TNodeFocus`, `EMPTY_NODE_FOCUS`, `NodeFocusProvider` y `useNodeFocus` (contrato de render §2)
- [X] T028 [US2] Actualizar `src/Domains/Graph/Components/AgentGraph.tsx`: aplicar `reconcileGraphModel`, retirar `hoveredNodeId` y `lineage` de las dependencias de los `useMemo` de `nodes`/`edges`, envolver el árbol en `NodeFocusProvider`, reutilizar `node.height` de `buildViewNodes` (sin volver a llamar `cardHeight`) y marcar `graph.interaction` por transición (C2..C3, FR-005, SC-004)
- [X] T029 [US2] Actualizar `src/Domains/Graph/Components/AgentNode.tsx` para leer el resaltado de foco desde `useNodeFocus` (opacidad por **linaje**: `1` en linaje, `0.15` fuera; el hover solo afecta a las **aristas**, según la tabla del contrato de render §2) sin cambiar el markup visual (paridad FR-007)
- [X] T030 [US2] Actualizar `src/Domains/Graph/Components/InvocationEdge.tsx` para resolver el resaltado de hover/linaje desde `useNodeFocus` en lugar de recibirlo horneado en `style` (tabla de resaltado del contrato §2)

**Checkpoint**: US1 y US2 funcionan de forma independiente; con ≥ 100 nodos la interacción es fluida y los arrays de React Flow son estables ante hover/selección.

---

## Phase 5: User Story 3 - Actualizaciones en vivo sin degradar la interacción (Priority: P2)

**Goal**: El tick de 1 s resuelve solo `durationMs`/`elapsed` (O(nodos), no O(contenido)) y se desactiva sin nodos activos **en ambos consumidores** (`useGraphModel` y el `useNow` del resumen de `WorkspacePage`, FR-024 de 003-execution-detail-views); una actualización local no reacomoda ni repinta el grafo completo.

**Independent Test**: Con una sesión activa y grafo grande, observar varios ciclos de tiempo comprobando que los tiempos avanzan sin reacomodo ni parpadeo y que una actualización de 1 de 100 agentes no degrada la fluidez.

### Tests for User Story 3 ⚠️

- [X] T031 [P] [US3] Escribir `src/Domains/Graph/Hooks/specs/useNow.spec.tsx`: tick solo con actividad, sin tick sin nodos activos y limpieza del `setInterval` al desactivar/desmontar
- [X] T032 [P] [US3] Escribir `src/Domains/Graph/Hooks/specs/useGraphModel.tick.spec.tsx`: al avanzar `now`, solo los nodos activos cambian de `durationMs`; los inactivos conservan identidad (`===`) y no se reacomodan (SC-005, FR-006)

### Implementation for User Story 3

- [X] T033 [US3] Ajustar `src/Domains/Graph/Hooks/useNow.ts` y su consumo en `src/Domains/Graph/Hooks/useGraphModel.ts` para activar el tick de 1 s solo si hay al menos un nodo con `isActiveStatus` (FR-006, R3). El segundo consumidor (`useNow` del resumen en `WorkspacePage`) se cubre en T041.

**Checkpoint**: US3 funciona de forma independiente sobre el modelo ya reconciliado (US2); sin tick en ningún consumidor cuando no hay nodos activos; frescura ≤ 1 s preservada (mismas claves que `eventReducer`, FR-009/L9).

---

## Phase 6: User Story 4 - Paridad funcional sin regresiones (Priority: P2)

**Goal**: Garantizar que, terminado el enriquecimiento, la información y las interacciones visibles son idénticas a la línea base (nodos, aristas, carriles, estados, métricas, linaje, selección, hover, redimensionado, histórico).

**Independent Test**: Comparar una muestra de sesiones representativas antes/después y verificar 100 % de coincidencia; forzar error/vacío/carga y confirmar el orden error→carga→vacío→datos.

### Tests for User Story 4 ⚠️

- [X] T034 [US4] Extender `src/Domains/Graph/lib/specs/buildGraph.spec.ts` con el spec de **paridad campo a campo** sobre `run.ndjson` y `run.v2.ndjson`, contrastando **solo** nodos con `enrichment === 'ready'` (excluyendo `enrichment` del contraste; los estados provisionales de la fase de estructura no participan) (FR-007, SC-006, C6; mismo fichero que T009 → ejecutar después)
- [X] T035 [US4] Extender `src/Infrastructure/specs/WorkspacePage.spec.tsx` (o crear el spec si no existe) para verificar el orden error→carga→vacío→datos tras el modelo en dos fases (FR-008)
- [X] T036 [US4] Ampliar la cobertura de paridad de resize/linaje/histórico en `src/Domains/Graph/Hooks/specs/useNodeResize.spec.tsx` y `src/Domains/Graph/Components/specs/AgentGraph.spec.tsx` (reseteo de tamaños al cambiar de sesión y linaje idéntico) (FR-007, SC-006). Comparte fichero con T024: **ejecutar después de T024** (sin `[P]`)

**Checkpoint**: Las cuatro historias funcionan; la paridad queda verificada por specs + validación manual (T040).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Puerta de calidad del repo, no-regresión de alcance y cierre de la línea base antes/después.

- [X] T037 [P] Ejecutar la validación automatizada de `specs/006-graph-render-performance/quickstart.md` §1 (`npx vitest run src/Domains/Graph`, `npx vitest run src/Application/Helpers`, `npm test`, `npm run tsc`, `npm run lint`) y corregir lo que aparezca
- [X] T038 [P] Verificar que no hay cambios fuera de alcance: sin dependencias nuevas, sin cambios en `src/Infrastructure/Services/opencodeClient.ts`, `src/Infrastructure/EventStreamProvider.tsx`, `src/Domains/Graph/lib/eventReducer.ts`, `src/Domains/queryKeys.ts` ni migración a canvas (R6, R7, Principios I/III/VII)
- [ ] T039 Capturar la tabla **antes/después** de SC-001..SC-004 con la muestra y el equipo de referencia (quickstart §5) y adjuntarla al PR
- [ ] T040 Validar manualmente la paridad (SC-006) y los edge cases sobre la muestra siguiendo `quickstart.md` §3 (US4 + Edge cases)

---

## Phase 8: Seguimiento del pase de análisis (`/speckit.analyze`)

**Purpose**: Cerrar los hallazgos de consistencia HIGH/MEDIUM detectados por el pase de análisis, **sin renumerar** las tareas anteriores (IDs nuevos T041+).

- [X] T041 [US3] Condicionar el `useNow(1000, Boolean(id))` de `src/Infrastructure/WorkspacePage.tsx` (tick del resumen, FR-024 de 003-execution-detail-views) a que exista al menos un nodo con `isActiveStatus` en `graph.graph.nodes`; extender `src/Infrastructure/specs/WorkspacePage.perf.spec.tsx` (o `WorkspacePage.spec.tsx`) comprobando que sin nodos activos no hay tick del resumen y con nodos activos sí (FR-006, FR-024 de 003-execution-detail-views, SC-005; hallazgo E1). Depende de T033.
- [X] T042 [US3] Escribir `src/Domains/Graph/Hooks/specs/useGraphEnrichment.freshness.spec.tsx` (o extender `useGraphEnrichment.spec.tsx`): el enriquecimiento escribe en las **mismas claves** que parchea `eventReducer` (`sessions.messages`, `permissions.for`, `sessions.log`, `sessions.execution`, `sessions.forms`, `sessions.inbox`) y un evento en vivo posterior gana, con desfase ≤ 1 s (FR-009, criterio L9; hallazgo E2). Depende de T018.

**Checkpoint**: Los dos consumidores de `useNow` se desactivan sin nodos activos y FR-009 queda verificado de forma automatizada.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; puede empezar de inmediato. T004 (línea base) debe completarse **antes** de las tareas de implementación de carga/render (Fase 3+).
- **Foundational (Phase 2)**: depende de Setup; **bloquea** las cuatro historias (tipos + `deriveMetricBase`/`resolveMetrics` + `buildGraph` con `enrichment`).
- **User Stories (Phase 3–6)**: dependen de Foundational.
  - US1 y US2 pueden avanzar en paralelo por personal.
  - US3 depende de US2 (`reconcileGraphModel`) para que el tick no reconstruya nodos inalterados.
  - US4 depende de US1 (modelo final enriquecido) para el spec de paridad.
- **Polish (Phase 7)**: depende de las historias que se quieran entregar.
- **Seguimiento (Phase 8)**: T041 depende de T033 (US3) y T042 de T018 (US1); pueden ejecutarse en paralelo entre sí (ficheros distintos).

### User Story Dependencies

- **US1 (P1)**: tras Foundational. Sin dependencias de otras historias. **MVP**.
- **US2 (P1)**: tras Foundational. Independiente en comportamiento; edita `AgentGraph.tsx`/`AgentNode.tsx` (no tocados por US1, salvo `useGraphModel.ts` que US1 refactoriza).
- **US3 (P2)**: tras Foundational y US2; ajusta `useNow.ts` y su consumo en `useGraphModel.ts` (ya refactorizado en US1) y el `useNow` del resumen en `WorkspacePage.tsx` (T041).
- **US4 (P2)**: tras US1 (y de facto US2/US3) para contrastar la paridad del modelo final.

### Within Each User Story

- Tests primero y fallando; luego librerías puras; después hooks; por último componentes/integración.
- `loadPriority` antes de `useGraphEnrichment`; `useGraphStructure`/`useGraphEnrichment` antes del refactor de `useGraphModel`.
- `reconcileGraph` y `NodeFocusContext` antes de `AgentGraph`/`AgentNode`/`InvocationEdge`.
- T036 se ejecuta **después** de T024 (mismo fichero `AgentGraph.spec.tsx`). T041 tras T033; T042 tras T018.

### Parallel Opportunities

- Setup: T001, T002 y T003 en paralelo (ficheros distintos). T004 es manual/secuencial.
- Foundational: T005, T006 y T007 en paralelo; T008 depende de T005/T006; T009 y T010 tras T008.
- US1: T011..T015 (specs) en paralelo con T016; T017/T018 dependen de T016; T019 tras T017/T018; T020/T021 tras T019.
- US2: T022, T023, T024 y T025 (specs) junto con T026/T027 en paralelo; T028 depende de T026/T027; T029/T030 dependen de T027.
- US3: T031 y T032 en paralelo; T033 depende de US2 (T026).
- US4: T034 y T035 en paralelo; T036 va **después de T024** (mismo fichero `AgentGraph.spec.tsx`, sin `[P]`); T034 debe ejecutarse después de T009 (mismo fichero).
- Seguimiento: T041 y T042 en paralelo entre sí (ficheros distintos); T041 tras T033 y T042 tras T018.

---

## Parallel Example: User Story 1

```bash
# Specs de US1 en paralelo (contrato ya congelado):
Task: "loadPriority.spec.ts en src/Domains/Graph/lib/specs/"
Task: "useGraphStructure.spec.tsx en src/Domains/Graph/Hooks/specs/"
Task: "useGraphEnrichment.spec.tsx en src/Domains/Graph/Hooks/specs/"
Task: "useGraphModel.spec.tsx en src/Domains/Graph/Hooks/specs/"
Task: "WorkspacePage.perf.spec.tsx en src/Infrastructure/specs/"

# Librerías puras sin conflicto de fichero:
Task: "loadPriority.ts en src/Domains/Graph/lib/"
```

## Parallel Example: User Story 2

```bash
# Librerías/componentes base en paralelo:
Task: "reconcileGraph.ts en src/Domains/Graph/lib/"
Task: "reconcileGraph.spec.ts en src/Domains/Graph/lib/specs/"
Task: "NodeFocusContext.tsx en src/Domains/Graph/Components/"
Task: "buildViewNodes.spec.ts (extender) en src/Domains/Graph/lib/specs/"
```

## Parallel Example: Foundational

```bash
# Tras verificar fixtures (T001), lanzar tipos + métricas puras:
Task: "Graph.entity.ts (tipos de vista) en src/Domains/Graph/"
Task: "deriveMetrics.ts (deriveMetricBase + resolveMetrics) en src/Domains/Graph/lib/"
Task: "deriveMetrics.spec.ts (extender) en src/Domains/Graph/lib/specs/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Fase 1 (Setup) — incluida la **captura de línea base** (T004).
2. Completar Fase 2 (Foundational) — **crítico**, bloquea todo.
3. Completar Fase 3 (US1): modelo por fases + carga progresiva priorizada + instrumentación open/revisit.
4. **PARAR y VALIDAR**: apertura grande ≤ 1.5 s p90, ≤ 2× la pequeña, revisita ≤ 300 ms, UI responsiva durante la carga.
5. Demo si está listo: ya entrega el valor principal (cambio de sesión rápido).

### Incremental Delivery

1. Setup + Foundational → tipos y funciones puras listos.
2. US1 → validar apertura/revisita → demo (MVP).
3. US2 → validar fluidez con ≥ 100 nodos → demo.
4. US3 → validar tick O(nodos) y refresco local → demo.
5. US4 → confirmar paridad y estados de pantalla → cierre.
6. Cada historia añade valor sin romper las anteriores.

### Parallel Team Strategy

1. El equipo completa Setup + Foundational en conjunto.
2. Tras Foundational:
   - Dev A: US1 (carga progresiva + instrumentación).
   - Dev B: US2 (identidad estable + foco por contexto).
   - Tras US1/US2: Dev C: US3 (tick condicionado) y US4 (paridad).
3. Integrar en orden US1 → US2 → US3 → US4 por las ediciones compartidas de `useGraphModel.ts`, `AgentGraph.spec.tsx` y `buildGraph.spec.ts`.

---

## Notes

- `[P]` = ficheros distintos, sin dependencias de tareas incompletas.
- `[Story]` mapea cada tarea a su historia para trazabilidad.
- Sin dependencias nuevas; sin cambios en `opencodeClient.ts`, `EventStreamProvider.tsx`, `eventReducer`, `queryKeys.ts`, layout, resumen ni histórico (R6, R7).
- Los contratos `contracts/graph-render-contract.md` (C1..C6), `contracts/graph-loading-contract.md` (L1..L9) y `contracts/performance-instrumentation-contract.md` (P1..P5) son la fuente de verdad de los criterios de aceptación de cada spec.
- Los ficheros `buildGraph.spec.ts` (T009/T034) y `useGraphModel.ts`/`AgentGraph.spec.tsx` (T024/T036) se editan en varias fases: ejecutar en el orden de los IDs.
- Nuevas tareas del pase de análisis (`/speckit.analyze`): T041 (tick del resumen en `WorkspacePage`, hallazgo E1) y T042 (spec de frescura FR-009, hallazgo E2). No se renumeraron tareas.
- Deriva preexistente de la Constitución (`@opencode-ai/sdk`/carpeta `entity/` frente a `@opencode/client`/`lib/`): **fuera de alcance** de esta feature (nota en `plan.md`; no se corrige).
- Commit tras cada tarea o grupo lógico, siguiendo Conventional Commits.

---

## Dependencies Graph (historias)

```text
Foundational
   ├── US1 (P1) ─────────────┐
   ├── US2 (P1) ───► US3 (P2) │
   └──────────────────────────┴──► US4 (P2) ──► Polish
```
