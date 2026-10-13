---
description: 'Task list: raíces de sesión listables, subárbol completo y paralelismo por invocación'
---

# Tasks: Raíces de sesión siempre listables, subárbol completo y paralelismo por invocación

**Feature**: `011-fix-session-roots-subtree`
**Input**: Design documents from `/specs/011-fix-session-roots-subtree/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (4 contratos), quickstart.md

**Tests**: incluidos (la spec los exige de forma explícita: SC-008, "Specs en riesgo" de research.md y los criterios de aceptación de cada contrato). Se escriben **primero** y deben fallar antes de implementar.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin depender de una tarea incompleta)
- **[Story]**: US1…US6 (solo en las fases de user story)
- Todas las tareas llevan paths de archivo exactos

## Path Conventions

Proyecto único frontend: `src/` en la raíz; specs en `specs/` junto al código (Principio VIII).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: piezas compartidas por E1/E2 (sin dependencias nuevas).

- [X] T001 [P] Crear `src/Infrastructure/Services/lib/sessionPagination.ts` con `SESSION_PAGE_SIZE = 200`, `SESSION_MAX_PAGES = 25`, el tipo `TRootSessionsResult { sessions; truncated }` y `collectAllRootSessions(client, directory)` (bucle por cursor calcado de `messagePagination.ts`: `order` solo en la 1ª página, `truncated` ⟺ se agotan las páginas con `cursor.next` presente)
- [X] T002 [P] Añadir en `src/Domains/queryKeys.ts` las keys `sessions.roots(directory) = [...all, directory, 'roots']`, `sessions.children(parentID) = [...all, 'children', parentID]` y la de respaldo por id `sessions.directory(id) = [...all, 'directory', id]`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: prerequisitos que bloquean a todas las user stories (servicio y banner compartido).

**⚠️ CRITICAL**: ninguna user story empieza antes de cerrar esta fase.

- [X] T003 Añadir a `SessionReadService` en `src/Infrastructure/Services/session.service.ts` los métodos `listRootSessions(directory?)`, `listChildSessions(parentID)` y `getSession(id)` (consumen T001; **no** tocar `listSessions`, que el grafo usa hasta E2)
- [X] T004 [P] Crear `src/Application/Components/Molecules/GraphTruncationBanner.tsx` (sobre `Alert` compartido, `variant="warning"`, `role="status"` + `aria-live="polite"`, informativo puro: sin acción ni cifras "N de M") y exportarlo en `src/Application/Components/Molecules/index.ts`
- [X] T005 [P] Crear `src/Application/Components/Molecules/specs/GraphTruncationBanner.spec.tsx` (`role="status"`, sin `role="alert"`, sin botón/acción, sin cifras)

**Checkpoint**: helper de paginación, service, keys y banner listos.

---

## Phase 3: User Story 1 - Ver todas las raíces del proyecto en el listado (Priority: P1) 🎯 MVP

**Goal**: el listado se compone de todas las **raíces** del proyecto y de ninguna hija; el corte por tope se declara.

**Independent Test**: con R raíces y H≫R hijas, el listado muestra las R raíces, 0 hijas, orden desc por última actividad dentro de cada carpeta; al tocar el tope aparece el aviso.

### Tests for User Story 1 ⚠️ (escribir primero, deben fallar)

- [X] T006 [P] [US1] Spec de `collectAllRootSessions` en `src/Infrastructure/Services/lib/specs/sessionPagination.spec.ts` (2 páginas → 2 requests, sin duplicados, `order` solo en la 1ª, `truncated` al agotar páginas)
- [X] T007 [P] [US1] Spec de servicio en `src/Infrastructure/Services/specs/session.service.spec.ts` (`listRootSessions` envía `parentID: null` y pagina con cursor)
- [X] T008 [P] [US1] Actualizar `src/Domains/Sessions/Hooks/specs/useRootSessions.spec.tsx` (respuesta con hijas mezcladas → solo raíces; `truncated` agregado)
- [X] T009 [P] [US1] Actualizar `src/Domains/Sessions/Pages/specs/SessionList.page.spec.tsx` (>200 sesiones mixtas → todas las raíces visibles; regresión directa del bug)

### Implementation for User Story 1

- [X] T010 [US1] Reapuntar `src/Domains/Sessions/Hooks/useRootSessions.ts` a `listRootSessions` con `queryKeys.sessions.roots(directory)`, conservando `.filter((s) => s.parentID === undefined)` (defensa en profundidad, con comentario) y exponiendo `truncated`; memoizar `items`/`groups`
- [X] T011 [US1] Renderizar el aviso de corte del listado con `GraphTruncationBanner` en `src/Domains/Sessions/Pages/SessionList.page.tsx` (entre cabecera/filtros y `<SessionList>`) y en `src/Infrastructure/Components/SessionsRail.tsx` cuando `truncated`
- [X] T012 [P] [US1] Eliminar el código muerto `useSessionInfo` de `src/Domains/History/History.service.ts` (R11)
- [X] T013 [P] [US1] Eliminar `src/Domains/Sessions/Hooks/useSelectSession.ts`, su spec `src/Domains/Sessions/Hooks/specs/useSelectSession.spec.tsx` y su re-export en `src/Domains/Sessions/Hooks/index.ts` (R11)

**Checkpoint**: `/sessions` y el riel listan todas las raíces y ninguna hija; el corte se declara.

---

## Phase 4: User Story 2 - Abrir por enlace directo una raíz que no está en el listado (Priority: P1)

**Goal**: resolver el `directory` desde la propia sesión y cargar el subárbol bajo demanda (E1 + E2 en el mismo cambio, para no dejar dos refrescos por evento).

**Independent Test**: abrir `?id=<raíz fuera del listado>` → muestra esa raíz y su subárbol (sin skeleton terminal); `?id=<inexistente>` → la fase 5 lo cubre como "no encontrada".

### Tests for User Story 2 ⚠️ (escribir primero, deben fallar)

- [X] T014 [P] [US2] Nuevo spec `src/Domains/Sessions/Hooks/specs/useSessionDirectory.spec.tsx` (`items` → `getSession` → `null`; no queda en loading)
- [X] T015 [P] [US2] Nuevo spec puro `src/Domains/Graph/lib/specs/subtree.spec.ts` (subárbol completo con hijos fuera de la primera página; fast path si la sesión está en `roots`; presupuesto **global** de nodos/requests → `truncated`; guarda anti-ciclo; `notFound`)
- [X] T016 [P] [US2] Actualizar `src/Infrastructure/specs/WorkspacePage.spec.tsx` (sesión fuera de `items` cae a `session.get`, resuelve `directory` y no queda en loading)
- [X] T017 [P] [US2] Actualizar `src/Domains/Graph/Hooks/specs/useGraphStructure.spec.tsx` (origen = subárbol; raíz fuera de `items`; la fase estructural no abre consultas de contenido)

### Implementation for User Story 2

- [X] T018 [US2] Crear `src/Domains/Sessions/Hooks/useSessionDirectory.ts` (cadena `items` → `opencodeService.getSession(id)` → `null`, key `sessions.directory(id)` con `staleTime: Infinity`) y exportarlo en `src/Domains/Sessions/Hooks/index.ts`
- [X] T019 [US2] Consumir `useSessionDirectory` en `src/Infrastructure/WorkspacePage.tsx`, sustituyendo el `useMemo` de resolución de `directory` (`items.find(...)`)
- [X] T020 [US2] Crear el cargador puro `src/Domains/Graph/lib/loadPlan/subtree.ts` (`loadSubtree({ sessionId, roots, getSession, listChildren })`: fast path si ∈ `roots`, subida con `ancestorChain` de `loadPlan/traversal.ts`, BFS por nivel con `Promise.all`, presupuesto global, `TRootSessionsResult` de data-model §3 con `truncated/loadedCount/reason?/notFound?`)
- [X] T021 [US2] Reapuntar `src/Domains/Graph/Hooks/useGraphStructure.ts` de `useGetSessions` + `filterSubtree` al cargador de T020 y refrescar explícitamente la profundidad 1 en `session.created`/`session.deleted`
- [X] T022 [US2] Reapuntar `src/Infrastructure/Hooks/useSessionOpenPerf.ts` a la key nueva del subárbol (R13)
- [X] T023 [US2] Actualizar el contrato `specs/006-graph-render-performance/contracts/graph-loading-contract.md` §1.1 y las líneas afectadas de `specs/006-graph-render-performance/data-model.md`, `plan.md` y `research.md` (FR-013, consultas estructurales ≠ consultas de contenido)

**Checkpoint**: cualquier raíz (aunque no esté en el listado) abre su subárbol; US1 + US2 ya conviven sin doble refresco.

---

## Phase 5: User Story 3 - Estados de pantalla honestos ante enlace raro o fallo de red (Priority: P1)

**Goal**: todo estado de carga termina en datos, error con reintento o vacío con acción; nunca un esqueleto terminal.

**Independent Test**: provocar directorio desconocido, sesión inexistente y error de red → cada uno con salida visible.

### Tests for User Story 3 ⚠️ (escribir primero, deben fallar)

- [X] T024 [P] [US3] Actualizar `src/Domains/Graph/Hooks/specs/useGraphModel.spec.tsx` (`notFound` aditivo; `isLoading`/`isError` combinados directorio+estructura)
- [X] T025 [P] [US3] Crear `src/Infrastructure/Components/specs/GraphPane.spec.tsx` (orden **error → loading acotada → no encontrada → vacío → datos**; "no encontrada" distinta de "sin agentes")

### Implementation for User Story 3

- [X] T026 [US3] Añadir `notFound: boolean` **aditivo** a `UseGraphModelResult` en `src/Domains/Graph/Hooks/useGraphModel.ts` (sin cambiar la forma pública, R6)
- [X] T027 [US3] Reordenar estados y añadir el estado "no encontrada" con acción a `/sessions` en `src/Infrastructure/Components/GraphPane.tsx` (FR-004/FR-005)

**Checkpoint**: ninguna URL queda en carga indefinida; los tres caminos tienen salida.

---

## Phase 6: User Story 4 - Ver el subárbol completo o saber que está truncado (Priority: P2)

**Goal**: propagar `truncated` del cargador hasta el aviso persistente y no bloqueante.

**Independent Test**: subárbol completo → sin aviso; forzar el presupuesto global → aviso persistente y grafo usable.

### Tests for User Story 4 ⚠️ (escribir primero, deben fallar)

- [X] T028 [US4] Añadir el caso de banner truncado a `src/Infrastructure/Components/specs/GraphPane.spec.tsx` (visible con `truncated`, ausente con subárbol completo, sin bloquear el lienzo)

### Implementation for User Story 4

- [X] T029 [US4] Propagar `truncated`/`reason`/`loadedCount` desde `src/Domains/Graph/Hooks/useGraphStructure.ts` a `src/Domains/Graph/Hooks/useGraphModel.ts` (`UseGraphModelResult.truncated`)
- [X] T030 [US4] Montar `GraphTruncationBanner` en `src/Infrastructure/Components/GraphPane.tsx` **entre cabecera y lienzo** cuando `truncated` (subárbol o listado), sin bloquear el grafo

**Checkpoint**: 0 recortes silenciosos en el subárbol.

---

## Phase 7: User Story 5 - Paralelismo por invocación, no por sesión (Priority: P2)

**Goal**: la unidad de paralelismo es la invocación; filas y badge salen de la misma fuente (E4).

**Independent Test**: hija reutilizada en dos pasos → dos invocaciones y dos lotes; fila y badge del mismo nodo coinciden; padre sin mensajes conserva el agrupamiento estructural.

### Tests for User Story 5 ⚠️ (escribir primero, deben fallar)

- [X] T031 [P] [US5] Nuevo spec `src/Domains/Graph/lib/specs/invocations.spec.ts` (paso con 2+ invocaciones → lote; hija reutilizada → 2 invocaciones y 2 lotes; pasos secuenciales separados; caso `background` con fin `max`)
- [X] T032 [P] [US5] Actualizar `src/Domains/Graph/lib/specs/executionKey.spec.ts` (la firma de lotes cambia la clave → las filas no quedan como no-op)
- [X] T033 [P] [US5] Actualizar `src/Domains/Graph/lib/specs/parallelism.spec.ts` (respaldo por solape de sesión intacto; `deriveSiblingBatches`/`deriveParallelGroups` sin regresión)
- [X] T034 [P] [US5] Nuevo spec de paridad fila ↔ badge en `src/Domains/Graph/lib/specs/invocationParity.spec.ts`

### Implementation for User Story 5

- [X] T035 [US5] Crear `src/Domains/Graph/lib/invocations.ts` (`TInvocation`, `deriveInvocations` con `sessionId = state.metadata.sessionID`, `deriveInvocationBatches` por `stepId`, `SUBAGENT_TOOLS` duplicada desde `Inspector/lib/deriveTasks.ts` con comentario al origen)
- [X] T036 [US5] Incorporar la **firma de lotes** (ids + miembros) a `deriveExecutionKey` en `src/Domains/Graph/lib/execution/executionKey.ts` (R8, FR-008)
- [X] T037 [US5] Actualizar `src/Domains/Graph/lib/parallelism.ts`: lotes por invocación como fuente principal, `deriveSiblingBatches` como respaldo (conservar `deriveParallelGroups`)
- [X] T038 [US5] Actualizar `src/Domains/Graph/lib/parallelByNode.ts` para fusionar ambas fuentes (la invocación gana cuando existe)
- [X] T039 [US5] Integrar las invocaciones en la fase de enriquecimiento (`src/Domains/Graph/Hooks/useGraphEnrichment.ts` + `src/Domains/Graph/Hooks/useGraphModel.ts`), memoizadas por `(sessionId, identidad de mensajes)` y sin consultas nuevas
- [X] T040 [US5] Actualizar el contrato de `specs/007-fix-parallel-lanes-live/` (FR-014): `spec.md` (FR-001/005/010 y Edge Case l.113), `contracts/execution-lanes-contract.md` §2/§6, `data-model.md` y `research.md`; dejar explícito que la paridad es fila ↔ badge y que la barra del nodo mantiene el intervalo de sesión

**Checkpoint**: 0 pasos secuenciales fusionados; paridad fila ↔ badge.

---

## Phase 8: User Story 6 - Ver las skills cargadas de un agente y su coste aproximado (Priority: P3)

**Goal**: el Inspector lista las skills cargadas con repeticiones y estimación rotulada como aproximada (E5).

**Independent Test**: sesión con skill → `nombre · ~N tokens`; skill en `error` → no cuenta; sin skills → "Sin skills cargadas" visible.

### Tests for User Story 6 ⚠️ (escribir primero, deben fallar)

- [X] T041 [P] [US6] Nuevo spec `src/Domains/Inspector/lib/specs/deriveSkills.spec.ts` (`input.name` e `input.id`, repetida → `count`, `state.status === 'error'` excluida, `estTokens` desconocido → `null`)
- [X] T042 [P] [US6] Nuevo spec `src/Domains/Inspector/lib/specs/deriveResources.spec.ts` (skills derivadas se propagan a `TResourceUsage.skills`)
- [X] T043 [P] [US6] Actualizar `src/Domains/Inspector/Components/specs/ResourceList.spec.tsx` con datos reales (nombre · ~N tokens, "Sin skills cargadas", sección visible aunque el resto esté vacía)
- [X] T044 [P] [US6] Nuevo spec `src/Application/Components/Molecules/specs/ResourceRow.spec.tsx` (con `note` pinta `label · note`; sin `note` conserva "disponible"; `aria-label` deletrea "aproximadamente")

### Implementation for User Story 6

- [X] T045 [US6] Crear `src/Domains/Inspector/lib/deriveSkills.ts` (`TSkillUsage { name; count; estTokens; firstLoadedAt }`, caracteres ÷ 4 sobre `content[].text`, excluye `error`)
- [X] T046 [US6] Extender `TResourceUsage.skills` a `TSkillUsage[]` en `src/Domains/Inspector/InspectorResources.entity.ts`
- [X] T047 [US6] Actualizar `src/Domains/Inspector/lib/deriveResources.ts` para recibir las skills ya derivadas en lugar de `skills: []`
- [X] T048 [US6] Actualizar `src/Domains/Inspector/Hooks/useInspectorData.ts` para derivar y memoizar las skills desde `messagesQuery.messages`
- [X] T049 [US6] Extender `src/Application/Components/Molecules/ResourceRow.tsx` a `items: { label: string; note?: string }[]`
- [X] T050 [US6] Actualizar `src/Domains/Inspector/Components/ResourceList.tsx` (`frontend-design · ~3.4k tokens` con `tabular-nums`, vacío → "Sin skills cargadas"; MCP/Instructions/Tools intactos)

**Checkpoint**: las skills cargadas son visibles en el 100 % de las sesiones que cargaron al menos una.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T051 [P] Añadir spec propio de `filterSubtree` en `src/Domains/Graph/lib/specs/filterSubtree.spec.ts` (se conserva como API pública del barrel, R12)
- [X] T052 [P] Reapuntar `src/Infrastructure/specs/WorkspacePage.perf.spec.tsx` a la key nueva del subárbol y validar la comparación de payload (200 → 38, −81 %)
- [X] T053 Ejecutar la validación de `specs/011-fix-session-roots-subtree/quickstart.md` (`pnpm test && pnpm tsc && pnpm lint`) y registrar la medición de `loadedCount`/`reason` y de la profundidad del árbol

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de T001 (T003 lo consume); **bloquea** a todas las user stories.
- **US1 (Phase 3)**: depende de Foundational. No depende de otras historias.
- **US2 (Phase 4)**: depende de Foundational **y de US1** (E1 antes de E2: el grafo deja de usar el listado global solo cuando ya existe la lista de raíces y el `directory` se resuelve con `useSessionDirectory`).
- **US3 (Phase 5)**: depende de US2 (los estados honestos necesitan el subárbol/`notFound`).
- **US4 (Phase 6)**: depende de US2 (el `truncated` nace en el cargador).
- **US5 (Phase 7)**: depende de US2 (necesita el subárbol completo para que la fila se vea); es independiente de US1 en lo funcional.
- **US6 (Phase 8)**: **independiente** de todas las etapas anteriores.
- **Polish (Phase 9)**: depende de todas las historias deseadas.

### User Story Dependencies

- **US1 (P1)**: MVP; no depende de otras historias.
- **US2 (P1)**: depende de US1 (E1 → E2). Se implementa en el mismo cambio que US1 cuando se quiere cerrar E1+E2 junto (evita dos refrescos por evento).
- **US3 (P1)**: depende de US2; añade las salidas de pantalla.
- **US4 (P2)**: depende de US2; solo añade el aviso del truncamiento.
- **US5 (P2)**: depende de US2; independiente de US1/US4.
- **US6 (P3)**: independiente; se puede hacer en cualquier momento.

### Within Each User Story

- Los tests se escriben y fallan antes de la implementación.
- Derivación pura → servicio/hook → integración en componente.
- Historia cerrada antes de pasar a la siguiente prioridad.

### Parallel Opportunities

- T001 y T002 (Phase 1) en paralelo.
- T004 y T005 (Phase 2) en paralelo; T003 puede correr junto a ellos.
- US1: T006–T009 (4 specs, archivos distintos) en paralelo; T012 y T013 en paralelo tras T010.
- US2: T014–T017 (4 specs distintos) en paralelo.
- US3: T024 y T025 en paralelo.
- US5: T031–T034 (4 specs distintos) en paralelo.
- US6: T041–T044 (4 specs distintos) en paralelo.
- Polish: T051 y T052 en paralelo.

---

## Parallel Example: User Story 1

```bash
# Specs de US1 (archivos distintos, en paralelo):
Task: "T006 sessionPagination.spec.ts"
Task: "T007 session.service.spec.ts"
Task: "T008 useRootSessions.spec.tsx"
Task: "T009 SessionList.page.spec.tsx"

# Tras T010, limpieza en paralelo:
Task: "T012 borrar useSessionInfo en History.service.ts"
Task: "T013 borrar useSelectSession.ts + spec + barrel"
```

## Parallel Example: User Story 5

```bash
Task: "T031 invocations.spec.ts"
Task: "T032 executionKey.spec.ts"
Task: "T033 parallelism.spec.ts"
Task: "T034 invocationParity.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2 (Setup + Foundational).
2. Phase 3 (US1): listado de raíces.
3. **STOP & VALIDAR**: proyecto con R raíces y H≫R hijas → R raíces, 0 hijas (SC-001).

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → MVP (raíces listables).
3. US2 + US3 → cualquier raíz abre por enlace directo, con estados honestos (SC-002) — el plan pide US1+US2 en el mismo cambio.
4. US4 → subárbol completo o truncado declarado (SC-006/SC-009).
5. US5 → paralelismo por invocación (SC-003/SC-004).
6. US6 → skills del Inspector (SC-007).
7. Polish → `filterSubtree` spec, perf re-point, quickstart (SC-008).

### Parallel Team Strategy

Tras Foundational: un dev en US1→US2→US3 (cadena E1/E2), otro en US6 (independiente), y US5 arranca cuando US2 cierre.

---

## Notes

- [P] = archivos distintos y sin dependencia entre tareas incompletas.
- El orden E1→E2 es obligatorio; E4 va tras E2; E5 es independiente.
- Las actualizaciones de contrato van con la etapa de la que dependen: `specs/006` con E2 (T023) y `specs/007` con E4 (T040).
- No hay dependencias nuevas ni cambios en `.specify/` ni en la constitución: solo frontend + tests.
- Commit por tarea o grupo lógico (Conventional Commits, Principio VIII).

---

## Phase 10: Convergence

**Purpose**: cerrar la brecha medida al terminar `implement` (backlog `converge-backlog` y `deuda-de-specs`). Solo tareas de arreglo, acotadas a archivo. Criterio de cierre: `pnpm tsc` = 0 errores y `pnpm test` = 0 rojos (SC-008).

- [X] T054 CRITICAL — Tipar el helper `call`/`step` de `src/Domains/Graph/lib/specs/invocations.spec.ts` (líneas 42-64) contra los tipos reales del SDK (`ToolPart`/`ToolContent`/`SessionStructuredError`; `metadata` como `JsonValue`) sin aflojar las aserciones, para eliminar los 7 errores de `pnpm tsc` per Constitution VIII (contradicts)
- [X] T055 Reapuntar el grupo «orden de estados error→carga→vacío→datos» de `src/Infrastructure/specs/WorkspacePage.spec.tsx` (~L374-480) al origen nuevo: sembrar el subárbol bajo `queryKeys.graph.for(DIRECTORY, id)` y mockear `listRootSessions`/`listChildSessions`/`getSession` en lugar de `listSessions`/`queryKeys.sessions.list` per US3/AC3 (partial)
- [X] T056 Reparar `resetServiceMocks` de `src/Domains/Graph/Hooks/specs/useGraphModel.tick.spec.tsx` (~L78-87): añadir `listRootSessions`/`listChildSessions`/`getSession` y sembrar los hijos por padre en lugar de `listSessions` per SC-008 (partial)
- [X] T057 Reapuntar `src/Domains/Graph/Hooks/specs/useGraphEnrichment.freshness.spec.tsx` (~L58, L275, L402) a `listRootSessions`/`listChildSessions`/`getSession` y a la key `graph.for` en lugar de `listSessions` per SC-008 (partial)
- [X] T058 Actualizar el texto obsoleto de `specs/006-graph-render-performance/plan.md` L15 y L120 («sesiones + estados + agentes, que ya están en caché global») al origen estructural = subárbol de la sesión per FR-013 (partial)
- [X] T059 Corregir `specs/011-fix-session-roots-subtree/data-model.md` §5 L86: `TInvocationBatch.parentId` es `string | null` en el código, no `string` per FR-014 (partial)
- [X] T060 Alinear `src/Domains/Inspector/lib/deriveResources.ts` L11-19: `skills` deja de ser opcional (default `[]`) porque `useInspectorData` siempre la pasa; ajustar llamadas/spec si aplica per T047/FR-009 (partial)
- [X] T061 Documentar en el mapa de código de `specs/011-fix-session-roots-subtree/plan.md` los dos módulos de `src/Domains/Graph/lib/execution/` tocados por el desvío U37 (`deriveExecutionLevels.ts`, `deriveExecutionLayout.ts`) per plan touch-points/desvio-u37 (unrequested)
