---

description: "Task list for feature 007-fix-parallel-lanes-live"
---

# Tasks: Filas paralelas correctas en el grafo en vivo

**Input**: Design documents from `/specs/007-fix-parallel-lanes-live/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Incluidos. La constitución (Principio V: lógica pura con tests unitarios) y `quickstart.md` §1 (validación automatizada **obligatoria**) exigen specs para las funciones puras y hooks de esta feature. Los specs se escriben **antes** de su implementación (TDD) y deben fallar primero.

**Organization**: Tareas agrupadas por user story (US1/US2/US3) para permitir implementación y validación independientes. El arreglo es **mixto**: la mayor parte del código es infraestructura fundacional compartida; US2 y US3 son guardas de regresión que validan que el arreglo no degrada la semántica secuencial ni la estabilidad.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: User story (US1, US2, US3). Setup/Foundational/Polish no llevan story label.
- Rutas de archivo exactas en cada descripción.

## Path Conventions

Proyecto único frontend (SPA). Rutas relativas a la raíz del repo:
`src/Domains/Graph/`, `src/Domains/queryKeys.ts`, `src/Domains/Sessions/`, `src/Infrastructure/`.
Specs junto al código en carpetas `specs/` (Principio VIII).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar el punto de partida sin introducir dependencias ni scaffolding.

- [X] T001 [P] Confirmar que la rama es `007-fix-parallel-lanes-live` y registrar la línea base de calidad en verde (`npm test`, `npm run tsc`, `npm run lint`); verificar que **no** se agregan dependencias en `package.json` (plan.md Technical Context / Constraints).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Núcleo puro compartido —intervalo abierto, clave de ejecución, layout autoritativo y marca de actividad— del que dependen **todas** las user stories.

**⚠️ CRITICAL**: Ninguna user story puede empezar hasta completar esta fase.

### Intervalo de ejecución y layout puro

- [X] T002 [P] Extender `src/Domains/Graph/lib/specs/nodeInterval.spec.ts` (E1): `executionInterval` abre activos (`running`/`retrying`/`compacting`/`waiting-permission`/`waiting-input`) con fin `+∞` y cierra terminados con fin real (`updatedAt ?? metrics.endedAt`); `endOf` de activo → `now`; nunca infiere apertura de datos ausentes (FR-002, FR-011).
- [X] T003 Implementar `executionInterval(node)` en `src/Domains/Graph/lib/execution/nodeInterval.ts` (depende de T002): inicio `startOf`; fin `+∞` si `isActiveStatus`, `endOf(node, 0)` si terminado; clamp `Math.max`; conservar `startOf`/`endOf`/`nodeInterval` (data-model §2.2, contract §1).
- [X] T004 [P] Refactorizar `src/Domains/Graph/lib/parallelism.ts` (depende de T003): eliminar el `intervalOf` privado y consumir `executionInterval` en `overlaps` y en `deriveSiblingBatches`; una sola lógica de intervalos compartida (FR-010, contract §2).
- [X] T005 [P] Crear `src/Domains/Graph/lib/specs/executionKey.spec.ts` (E3): la clave cambia con topología y con clase/borde de intervalo (activo↔terminado, fin real distinto) y es estable ante eventos no estructurales; determinística y sin `Date.now()` (FR-003, FR-007).
- [X] T006 Implementar `deriveExecutionKey(model)` en `src/Domains/Graph/lib/execution/executionKey.ts` (depende de T005): `topologySignature(model)` + por nodo `id:startOf:(isActiveStatus ? 'open' : updatedAt ?? metrics.endedAt ?? 0)` ordenado (data-model §2.3, contract §3).
- [X] T007 [P] Crear `src/Domains/Graph/lib/specs/deriveExecutionLayout.spec.ts` (E4): plan/posiciones/grupos coherentes, `graph` con `data.parallel` aplicado, sin mutar la entrada (contract §4).
- [X] T008 Implementar `deriveExecutionLayout(model, now)` en `src/Domains/Graph/lib/execution/deriveExecutionLayout.ts` (depende de T003, T004, T006, T007): compone `deriveExecutionLevels` + `layoutExecution` + `indexPositions` + `deriveParallelGroups` + `toParallelByNode` + `assembleStructuralGraph`; exporta `TExecutionLayout` (contract §4).
- [X] T009 [P] Extender la fachada `src/Domains/Graph/lib/executionLevels.ts` para re-exportar `deriveExecutionKey`, `deriveExecutionLayout` y `TExecutionLayout` (mantiene el import specifier público del layout de ejecución).

### Marca de actividad (datos, sin red)

- [X] T010 [P] Agregar `TActivityMap = Record<string, number>` a `src/Domains/Graph/Graph.entity.ts` y actualizar el JSDoc de `updatedAt` (ahora `max(lista, actividad)`) (data-model §1.1/§2.1, contract session-activity §1/§4).
- [X] T011 [P] Agregar `sessions.activity: () => ['sessions', 'activity']` a `src/Domains/queryKeys.ts`, hermana de `sessions.status()` (data-model §2.1, contract session-activity §1).
- [X] T012 [P] Extender `src/Domains/Graph/lib/specs/eventReducer.spec.ts` (A1/A2): `reduceActivity` devuelve `set` sobre `sessions.activity()` para todo evento con `sessionID` (mensajes, ejecución/retry/compaction, ciclo de vida/status/idle, permisos, inbox/forms **y deltas** de texto/reasoning/tool/compaction) y `null` para `server.connected`; `setActivity` es monótono (`max`) y no muta la entrada.
- [X] T013 [P] Agregar `setActivity(prev, sessionID, at)` a `src/Domains/Graph/lib/eventReduce/cache.ts` (depende de T010): `{ ...prev, [sessionID]: Math.max(prev[sessionID] ?? 0, at) }`, sin mutar (contract session-activity §2).
- [X] T014 Crear `reduceActivity(event)` en `src/Domains/Graph/lib/eventReduce/activity.ts` y re-exportarlo desde `src/Domains/Graph/lib/eventReducer.ts` (depende de T010, T011, T012, T013): `set(queryKeys.sessions.activity(), prev => setActivity(prev, sessionID, event.created))`; `null` sin sesión (contract session-activity §2).
- [X] T015 [P] Crear `src/Infrastructure/specs/applyReducedEvent.spec.ts` (A3): `applyReducedEvent` aplica la actividad por `setQueryData` y mantiene intacto el resultado de `reduceEvent` (sin peticiones de red).
- [X] T016 Enganchar `reduceActivity` **antes** de `reduceEvent` en `src/Infrastructure/lib/applyReducedEvent.ts` (depende de T014, T015), reutilizando el batching existente de `EventStreamProvider` (sin red adicional) (contract session-activity §3).

### Frescura del nodo

- [X] T017 [P] Extender `src/Domains/Graph/lib/specs/buildGraph.spec.ts` (A4): `updatedAt = max(session.time.idle ?? session.time.updated ?? 0, activity[session.id] ?? 0)`; `null` si el máximo es `0`; compatibilidad cuando no se pasa `activity`.
- [X] T018 Extender `src/Domains/Graph/lib/graphBuild/toGraphNode.ts` (depende de T010, T017): agregar `activity?: TActivityMap` a `TGraphNodeContext` y calcular `updatedAt = max(lista, activity[id])` con `null` si queda `0` (data-model §1.1, contract session-activity §4).
- [X] T019 Propagar `activity?: TActivityMap` (opcional, compatibilidad total) por `src/Domains/Graph/lib/buildGraph.ts` y `src/Domains/Graph/lib/buildStructuralModel.ts` hasta `toGraphNode` (depende de T018) (contract session-activity §4).

**Checkpoint**: Núcleo puro listo (intervalo abierto, clave de ejecución, layout autoritativo, marca de actividad, `updatedAt` fresco) — las user stories pueden comenzar.

---

## Phase 3: User Story 1 - Ver los subagentes paralelos en una sola fila mientras corren (Priority: P1) 🎯 MVP

**Goal**: Los N subagentes concurrentes comparten fila durante el stream en vivo, sin refrescar; el refresco no cambia la disposición; filas y badge salen de la misma lógica de intervalos.

**Independent Test**: Abrir una sesión que lanza N subagentes concurrentes y observar el grafo durante el stream: los N comparten fila en todo momento y refrescar no cambia la disposición (quickstart.md §2 US1; specs E5/E6/A5).

- [X] T020 [P] [US1] Agregar el lector reactivo `useGetSessionActivity()` a `src/Domains/Sessions/Sessions.service.ts`, espejo de `useGetSessionStatus()` (query sobre `queryKeys.sessions.activity()` con `queryFn` que devuelve el valor cacheado, `staleTime: Infinity`, `initialData: {}`) (contract session-activity §4; Principio III).
- [X] T021 [US1] Extender `src/Domains/Graph/Hooks/useGraphStructure.ts` (depende de T009, T019, T020): leer `sessions.activity()`, pasarlo a `buildStructuralModel`, y memoizar `executionPlan`/`positions`/`parallelGroups` por `deriveExecutionKey(model)` en lugar de `topologySignature`; conservar el resto de la API y la garantía L4 (sin consultas de contenido) (contract execution-lanes §5, research R3/R4).
- [X] T022 [US1] Extender `src/Domains/Graph/Hooks/useGraphModel.ts` (depende de T008, T009, T021): derivar el plan/paralelismo **autoritativo** desde `enriched` con `deriveExecutionLayout(enriched, now)` memoizado por `deriveExecutionKey(enriched)`, con `now` vivo (`useNow({ enabled: hasActiveNode })`) leído vía ref; devolver ese `executionPlan`/`parallelGroups` y aplicar el tick de 1 s solo a `durationMs` sobre el grafo posicionado; conservar `UseGraphModelResult` (contract execution-lanes §5/§6, research R4).
- [X] T023 [US1] Extender `src/Domains/Graph/Hooks/specs/useGraphStructure.spec.tsx` (E6): `updatedAt` fresco por actividad, plan derivado de `deriveExecutionKey`, y sin consultas de contenido (L4 de 006 se preserva) (depende de T021).
- [X] T024 [US1] Extender `src/Domains/Graph/Hooks/specs/useGraphModel.spec.tsx` (E5/A5): filas paralelas en vivo desde el modelo enriquecido y disposición idéntica tras refrescar (paridad en vivo/refresco) (depende de T022).

**Checkpoint**: US1 funcional y validable de forma independiente (MVP).

---

## Phase 4: User Story 2 - Subagentes no concurrentes siguen en filas distintas (Priority: P2)

**Goal**: No degradar la semántica secuencial vs. paralela: los hermanos sin solape temporal quedan en filas distintas, antes arriba, en vivo y tras refrescar.

**Independent Test**: Un padre que lanza un subagente, espera a que termine y recién entonces lanza otro: quedan en filas separadas (quickstart.md §2 US2; specs E2).

> Esta story es una **guarda de regresión** sobre el núcleo de la Fase 2 (intervalo cerrado para terminados + orden por inicio); no requiere código de producción adicional. Su valor es demostrar que el arreglo del P1 no rompe la distinción secuencial/paralelo.

- [X] T025 [P] [US2] Extender `src/Domains/Graph/lib/specs/parallelism.spec.ts` (E2): hermanos activos concurrentes creados con diferencia de segundos comparten grupo; secuenciales (fin antes del inicio del siguiente) quedan en grupos distintos; dos grupos paralelos consecutivos quedan en grupos distintos y cada uno comparte su grupo; badge = filas (FR-005, FR-010).
- [X] T026 [P] [US2] Extender `src/Domains/Graph/lib/specs/executionLevels.spec.ts`: los hermanos secuenciales reciben niveles consecutivos distintos, una tanda paralela comparte un solo nivel y el orden temporal deja los anteriores arriba (FR-005, FR-006).

**Checkpoint**: US1 y US2 funcionan y se validan de forma independiente.

---

## Phase 5: User Story 3 - El agrupamiento no "salta" durante la ejecución (Priority: P3)

**Goal**: Las filas y el orden se mantienen estables ante eventos de contenido/estado no estructurales y ante el tick de 1 s.

**Independent Test**: Con subagentes paralelos ya alineados, dejar correr eventos de contenido y varios ticks: ningún nodo cambia de fila ni de orden (quickstart.md §2 US3; spec E7).

> Guarda de regresión sobre la memoización por `deriveExecutionKey` introducida en US1 (T021/T022); no requiere código de producción adicional.

- [X] T027 [P] [US3] Extender `src/Domains/Graph/Hooks/specs/useGraphModel.tick.spec.tsx` (E7): con hermanos paralelos alineados, avanzar el reloj (1 s) y aplicar eventos no estructurales no cambia `executionPlan`/posiciones/orden (identidad estable); solo cambia `durationMs` de los activos (FR-007, SC-004; Principio VII).

**Checkpoint**: Las tres user stories funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cierre opcional, puerta de calidad y validación de la feature.

- [X] T028 [P] (Opcional, R6) Extender `src/Infrastructure/Hooks/useActiveSessionsSeed.ts` para sembrar `activity[id] = now` de las sesiones activas del snapshot al (re)conectar, reforzando el edge case de reconexión (research R6, contract session-activity §5). No bloqueante.
- [X] T029 Ejecutar la validación automatizada de `specs/007-fix-parallel-lanes-live/quickstart.md` §1: `npx vitest run src/Domains/Graph`, `npx vitest run src/Infrastructure`, `npm test`, `npm run tsc`, `npm run lint` — todo en verde (depende de todas las fases previas).
- [ ] T030 Ejecutar la validación manual de `specs/007-fix-parallel-lanes-live/quickstart.md` §2 y registrar evidencia de SC-001..SC-005 (misma disposición en vivo y tras refrescar) (depende de T029).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; **bloquea** todas las user stories.
- **User Stories (Phase 3+)**: dependen de Foundational. US2/US3 dependen implícitamente del núcleo y de la memoización de US1 para su validación de hooks; US2 puede avanzar en paralelo con US1 en lo puro.
- **Polish (Phase 6)**: depende de todas las user stories deseadas.

### Foundational — orden interno

- T002 → T003 → T004 (intervalo → refactor de paralelismo).
- T005 → T006 (spec → `deriveExecutionKey`).
- T007 → T008 (spec → `deriveExecutionLayout`); T008 depende además de T003, T004, T006.
- T010 → T013 → T014 (tipo → `setActivity` → `reduceActivity`); T014 depende también de T011, T012.
- T015 → T016 (spec → enganche en `applyReducedEvent`).
- T017 → T018 → T019 (spec → `toGraphNode` → `buildGraph`/`buildStructuralModel`).
- T009 (fachada) puede hacerse en paralelo; T021 lo consume.

### User Story Dependencies

- **US1 (P1)**: depende de Foundational (T008, T009, T019) y T020; es el MVP.
- **US2 (P2)**: depende del núcleo puro (T003, T004, T006, T008); sus specs pueden escribirse en paralelo con US1.
- **US3 (P3)**: depende de la memoización de US1 (T021, T022).

### Within Each User Story

- Specs primero (deben fallar) → implementación → integración.
- Tipos/intervalo antes que layout; `setActivity` antes que `reduceActivity`; `toGraphNode` antes que `buildGraph`/`buildStructuralModel`.
- Cada story completa y verificable antes de pasar a la siguiente prioridad.

### Parallel Opportunities

- Foundational: T002/T005/T007/T010/T011/T012/T013/T015/T017 pueden escribirse en paralelo (archivos distintos); T009 y T013 son [P] dentro de su subgrupo.
- Tras Foundational: T020 (US1), T025/T026 (US2) pueden ejecutarse en paralelo.
- Specs [P] de una misma story pueden escribirse juntas (T023/T024; T025/T026).

---

## Parallel Example: Foundational (specs puros)

```bash
# Escribir en paralelo los specs puros (deben fallar primero):
Task: "nodeInterval.spec.ts — executionInterval abre activos / cierra terminados (T002)"
Task: "executionKey.spec.ts — cambios de topología/clase/borde, estabilidad (T005)"
Task: "deriveExecutionLayout.spec.ts — plan/posiciones/grupos sin mutar (T007)"
Task: "eventReducer.spec.ts — reduceActivity + setActivity (T012)"
Task: "buildGraph.spec.ts — updatedAt = max(lista, actividad) (T017)"
```

## Parallel Example: User Story 1

```bash
# Con la estructura y el modelo ya extendidos (T021/T022), correr los specs juntos:
Task: "useGraphStructure.spec.tsx — actividad + executionKey, sin consultas de contenido (T023)"
Task: "useGraphModel.spec.tsx — filas paralelas en vivo + paridad tras refresco (T024)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (T001).
2. Completar Phase 2: Foundational (T002–T019) — **crítico**, bloquea todo.
3. Completar Phase 3: US1 (T020–T024).
4. **STOP y VALIDAR**: correr los specs de US1 y la validación manual US1 (quickstart §2).
5. Demo si está listo: los subagentes paralelos comparten fila en vivo.

### Incremental Delivery

1. Setup + Foundational → núcleo puro y marca de actividad listos.
2. US1 → MVP: filas paralelas correctas en vivo y paridad con refresco.
3. US2 → guarda de regresión: secuenciales siguen en filas distintas.
4. US3 → guarda de regresión: sin saltos por tick/eventos no estructurales.
5. Polish → puerta de calidad + validación end-to-end de la feature.

### Notes

- [P] = archivos distintos, sin dependencias pendientes.
- Specs junto al código en `specs/` (Principio VIII); lógica pura sin React ni reloj implícito (Principio V).
- Sin cambios de UI visual, sin nuevas dependencias, sin red adicional (plan.md Constraints, research R5).
- Commits con Conventional Commits, scope `graph` (p. ej. `fix(graph): ...`) según `AGENTS.md`.
- Commit por tarea o grupo lógico; detenerse en cada checkpoint para validar la story de forma independiente.
