---

description: "Task list for OpenCode Agent Viz — Observabilidad Multi-Agente"
---

# Tasks: OpenCode Agent Viz — Observabilidad Multi-Agente

**Input**: Design documents from `/specs/001-agent-viz-observability/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Incluidos porque la Constitución (Principio V) y `AGENTS.md` §7 exigen tests de la lógica pura y de los hooks. Los tests de UI se limitan a componentes con estado/derivación relevante.

**Organization**: Tareas agrupadas por user story para implementación y validación independientes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: user story a la que pertenece (US1…US10)
- Rutas de archivo exactas en cada tarea

## Path Conventions

- Single project (frontend SPA): `src/` en la raíz del repositorio.
- Tests en carpetas `specs/` junto al código (Constitución VIII).
- Fixtures reales en `__fixtures__/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialización del proyecto y estructura base

- [x] T001 Instalar fuentes self-hosted: `pnpm add @fontsource/inter @fontsource/jetbrains-mono` (actualiza `package.json`)
- [x] T002 [P] Añadir tokens Dark/Flat (superficies `--surface-0/1/2`, `--border`, `--text*`, `--accent`, colores de estado) y familias `font-sans`/`font-mono` en `src/index.css` siguiendo `plan.md` → Design Direction
- [x] T003 [P] Aplicar modo oscuro por defecto y fuentes: clase `dark` en `document.documentElement` y `import '@fontsource/...'` en `src/main.tsx`; `<html class="dark">` en `index.html`
- [x] T004 Crear keys centralizadas en `src/Domains/queryKeys.ts` según `contracts/sdk-service-contract.md`
- [x] T005 Crear el cliente y wrappers de solo lectura en `src/Infrastructure/Services/opencodeClient.ts` (`createOpencodeClient({ baseUrl: '/oc' })` + `listSessions`, `getSessionStatus`, `getSession`, `getSessionChildren`, `getSessionMessages`, `getSessionTodos`, `listAgents`, `getMcpStatus`, `getConfig`, `subscribeEvents`) y crear `src/Infrastructure/Services/specs/opencodeClient.spec.ts` que verifique que solo se exponen métodos de lectura (FR-016)
- [x] T006 [P] Crear `src/Application/Helpers/formatDuration.ts`
- [x] T007 [P] Crear `src/Application/Helpers/formatCost.ts`
- [x] T008 [P] Crear `src/Application/Helpers/formatTokens.ts`
- [x] T009 [P] Tests de formateo (incluye caso `null` → `"—"`) en `src/Application/Helpers/specs/formatDuration.spec.ts`, `.../formatCost.spec.ts`, `.../formatTokens.spec.ts`
- [x] T010 [P] Exportar helpers desde `src/Application/Helpers/index.ts` y `src/Application/index.ts`

**Checkpoint**: Base lista para el trabajo fundacional.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura compartida que BLOQUEA todas las historias

**⚠️ CRITICAL**: Ninguna user story puede empezar hasta completar esta fase

- [x] T011 [P] Crear entidad `src/Domains/Connection/Connection.entity.ts` (`TConnectionState`)
- [x] T012 [P] Crear entidades `src/Domains/Sessions/Session.entity.ts` (`TSession`, `TSessionStatus`), `src/Domains/Graph/Graph.entity.ts` (`TNodeStatus`, `TNodeMetrics`, `TTokenUsage`, `TGraphNode`, `TGraphEdge`, `TGraphModel`) e `src/Domains/Inspector/Inspector.entity.ts` (`TResourceUsage`, `TNodeDetail`, `TSessionSummary`) según `data-model.md`
- [x] T013 Implementar reducer puro en `src/Domains/Graph/lib/eventReducer.ts` (`reduceEvent(event): TEventUpdate | null`) según `contracts/event-stream-contract.md`
- [x] T014 [P] Test del reducer con fixture en `src/Domains/Graph/lib/specs/eventReducer.spec.ts`
- [x] T015 Implementar métricas puras en `src/Domains/Graph/lib/deriveMetrics.ts` (`deriveMetrics`, `summarizeSession`) según `contracts/metrics-contract.md`
- [x] T016 [P] Test de métricas (duración/costo/tokens/invocaciones/retry, casos `null`) en `src/Domains/Graph/lib/specs/deriveMetrics.spec.ts`
- [x] T017 Implementar `src/Infrastructure/EventStreamProvider.tsx`: suscripción única `subscribeEvents()`, buffer + flush ~100ms/`requestAnimationFrame`, backoff exponencial, `TConnectionState`, `invalidateQueries()` al reconectar
- [x] T018 Crear `src/Domains/Connection/Connection.service.ts` (`useConnectionStatus`) y `src/Domains/Connection/Hooks/useConnectionStatus.ts`
- [x] T019 Crear componentes compartidos: `src/Application/Components/Molecules/Metric.tsx`, `StatusDot.tsx`, `DurationBar.tsx` (variante `flat`, `tabular-nums`) y exportarlos en `src/Application/Components/Molecules/index.ts` y `Components/index.ts`
- [x] T020 [P] Tests de `Metric` (valor `null` → "no disponible") en `src/Application/Components/Molecules/specs/Metric.spec.tsx`
- [x] T021 Crear script de captura de fixture y grabar `src/Domains/Graph/lib/__fixtures__/run.ndjson` (R1) documentado en `quickstart.md`
- [x] T022 Montar `EventStreamProvider` en `src/main.tsx` y crear el shell de aplicación (topbar + zonas) en `src/Infrastructure/Routes.tsx`/`src/App.tsx` en modo oscuro

**Checkpoint**: Fundación lista — las user stories pueden empezar.

---

## Phase 3: User Story 1 - Estado de conexión (Priority: P1) 🎯 MVP

**Goal**: Ver de un vistazo si el visor está conectado, reconectando o desconectado.

**Independent Test**: Abrir con servidor arriba → "Conectado"; detenerlo → "Desconectado"; reiniciarlo → "Reconectando" → "Conectado".

### Implementation for User Story 1

- [x] T023 [P] [US1] Test de `ConnectionBadge` en `src/Domains/Connection/Components/specs/ConnectionBadge.spec.tsx`
- [x] T024 [P] [US1] Crear `src/Domains/Connection/Components/ConnectionBadge.tsx` y `ConnectionBadgeSkeleton.tsx` (LED plano + texto accesible)
- [x] T025 [US1] Test del hook en `src/Domains/Connection/Hooks/specs/useConnectionStatus.spec.ts` con `renderWithProviders`
- [x] T026 [US1] Crear `src/Domains/Connection/Connection.routes.ts`, `Connection.router.tsx` e `src/Domains/Connection/index.ts`
- [x] T027 [US1] Integrar `ConnectionBadge` en el shell (topbar) en `src/Infrastructure/Routes.tsx`
- [x] T028 [US1] Manejar transición a `disconnected` tras agotar reintentos en `src/Infrastructure/EventStreamProvider.tsx`

**Checkpoint**: US1 funcional y testeable de forma independiente.

---

## Phase 4: User Story 2 - Listar y elegir sesiones raíz (Priority: P1)

**Goal**: Ver sesiones raíz (agente, título, estado, hora) y elegir una; la más reciente por defecto.

**Independent Test**: Con una sesión creada, aparece listada; al seleccionarla queda activa; sin sesiones se ve estado vacío.

### Implementation for User Story 2

- [x] T029 [P] [US2] Implementar `src/Domains/Sessions/Sessions.service.ts` (`useGetSessions`, `useGetSessionStatus`, `useGetAgents`)
- [x] T030 [US2] Implementar hooks de selección y upsert de eventos: `src/Domains/Sessions/Hooks/useSelectSession.ts`, `useUpsertSessionFromEvent.ts`
- [x] T031 [P] [US2] Componentes `SessionCard.tsx`, `SessionList.tsx`, `SessionListSkeleton.tsx` en `src/Domains/Sessions/Components/`
- [x] T032 [US2] Crear `Sessions.routes.ts` (`SESSIONS_LIST_ROUTE`, `SESSION_DETAIL_ROUTE`), `Sessions.router.tsx` e `index.ts` en `src/Domains/Sessions/`
- [x] T033 [US2] Crear `src/Domains/Sessions/Pages/SessionList.page.tsx` envuelta en `<Page>` con estados error/loading/empty/datos
- [x] T034 [US2] Registrar `SessionsRouter` en `src/Infrastructure/Routes.tsx`
- [x] T035 [US2] Implementar selección por defecto = sesión con mayor `time.updated` y deep-link `?session=`
- [x] T036 [P] [US2] Tests de `SessionList` (vacío/error) y `useSelectSession` en `src/Domains/Sessions/Components/specs/` y `Hooks/specs/`

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 - Grafo jerárquico en vivo (Priority: P1)

**Goal**: Un nodo por agente, relación padre→hijo y estado en vivo; el subagente nuevo aparece < 1s.

**Independent Test**: Lanzar un flujo con subagente y comprobar nodo hijo conectado a su padre con estado en vivo.

### Implementation for User Story 3

- [x] T037 [P] [US3] Implementar `src/Domains/Graph/lib/buildGraph.ts` según `contracts/graph-contract.md`
- [x] T038 [P] [US3] Test de `buildGraph` (topología padre→hijo, atribución de agente, nodo sin padre) en `src/Domains/Graph/lib/specs/buildGraph.spec.ts`. Incluir casos: sesión sin subagentes (nodo raíz único) y permiso pendiente al terminar la sesión
- [x] T039 [P] [US3] Implementar `src/Domains/Graph/lib/layoutGraph.ts` (dagre TB, layout estable por firma de topología)
- [x] T040 [P] [US3] Test de `layoutGraph` (posiciones estables ante cambio de solo-estado) en `src/Domains/Graph/lib/specs/layoutGraph.spec.ts`
- [x] T041 [US3] Implementar `src/Domains/Graph/Hooks/useGraphModel.ts` (compone queries + `buildGraph` + `layoutGraph` memoizados)
- [x] T042 [US3] Implementar `src/Domains/Graph/Components/AgentNode.tsx` y `NodeStatusRail.tsx` (franja 3px por estado; datos sin relayout)
- [x] T043 [US3] Implementar `src/Domains/Graph/Components/AgentGraph.tsx` (React Flow) y `GraphSkeleton.tsx`
- [x] T044 [US3] Crear `Graph.routes.ts` (`GRAPH_VIEW_ROUTE`), `Graph.router.tsx`, `Pages/GraphView.page.tsx` e `index.ts` en `src/Domains/Graph/`
- [x] T045 [US3] Registrar `GraphRouter` y conectar selección de sesión → grafo en `src/Infrastructure/Routes.tsx`
- [x] T046 [US3] Wire de eventos `session.*`/`message.part.updated` del reducer hacia el grafo (nodo nuevo < 1s)
- [x] T047 [P] [US3] Test de `AgentNode` en `src/Domains/Graph/Components/specs/AgentNode.spec.tsx`

**Checkpoint**: MVP (US1+US2+US3) completo y validable.

---

## Phase 6: User Story 4 - Inspeccionar un nodo (Priority: P2)

**Goal**: Seleccionar un nodo y ver agente, modelo, duración, herramienta actual, historial, tareas y errores.

**Independent Test**: Seleccionar un nodo terminado y ver todas las secciones; nodo con error muestra el mensaje.

### Implementation for User Story 4

- [x] T048 [P] [US4] Implementar `src/Domains/Inspector/Inspector.service.ts` (`useGetNodeDetail`)
- [x] T049 [US4] Implementar `src/Domains/Inspector/Hooks/useInspectorData.ts` (deriva `TNodeDetail` del grafo/mensajes)
- [x] T050 [P] [US4] Componentes `MetricsSection.tsx`, `ToolHistory.tsx`, `InspectorPanel.tsx`, `InspectorSkeleton.tsx` en `src/Domains/Inspector/Components/`. `MetricsSection` muestra la presencia de los campos duración/costo/tokens (FR-006); el comportamiento en vivo/fijado de la duración se implementa en T056 (FR-007)
- [x] T051 [US4] Integrar el panel en el shell, reaccionando a la selección de nodo (`src/Infrastructure/Routes.tsx`)
- [x] T052 [US4] Estados vacíos por sección (sin tools/todos/errores) con textos explicativos
- [x] T053 [P] [US4] Tests de `InspectorPanel` (secciones y estados vacíos) en `src/Domains/Inspector/Components/specs/InspectorPanel.spec.tsx`

**Checkpoint**: US4 independiente y funcional.

---

## Phase 7: User Story 5 - Duración por agente y subagente (Priority: P2)

**Goal**: Ver la duración de cada agente/subagente, en vivo y fijada al terminar.

**Independent Test**: Padre e hijo muestran duración que crece y se fija; identificable el más lento.

### Implementation for User Story 5

- [x] T054 [P] [US5] Extender `deriveMetrics` para duración en vivo usando `now` inyectable y `time.completed ?? now`
- [x] T055 [US5] Mostrar duración en `AgentNode` (tira monoespaciada) usando `formatDuration` + `DurationBar`
- [x] T056 [US5] Añadir duración en vivo (crecimiento y fijado al terminar) al `MetricsSection` del inspector (FR-007)
- [x] T057 [US5] Calcular duración agregada en `summarizeSession` y mostrarla en el resumen de sesión, e indicar el agente de mayor duración (orden o marca visual) para SC-004
- [x] T058 [P] [US5] Tests de duración (vivo vs fijada, `null`) en `src/Domains/Graph/lib/specs/deriveMetrics.spec.ts`

**Checkpoint**: US5 independiente y funcional.

---

## Phase 8: User Story 6 - Costo y tokens (Priority: P2)

**Goal**: Ver costo y tokens por agente y el total de sesión, con "no disponible" cuando falte.

**Independent Test**: Cada agente muestra costo y desglose de tokens; el total es la suma.

### Implementation for User Story 6

- [x] T059 [P] [US6] Extender `deriveMetrics` para sumar `cost` + tokens (input/output/reasoning/cache) de `AssistantMessage` y `StepFinishPart`
- [x] T060 [US6] Mostrar costo y tokens en `MetricsSection` con `formatCost`/`formatTokens` y `"—"` cuando `null`
- [x] T061 [US6] Mostrar totales de costo/tokens de sesión en `SessionSummary`, e indicar el agente de mayor costo (orden o marca visual) para SC-004
- [x] T062 [P] [US6] Tests de costo/tokens (sumas y campos ausentes) en `src/Domains/Graph/lib/specs/deriveMetrics.spec.ts`

**Checkpoint**: US6 independiente y funcional.

---

## Phase 9: User Story 7 - Invocaciones y loops (Priority: P3)

**Goal**: Ver cuántas veces se ejecutó cada agente y marcar posibles loops (reintentos).

**Independent Test**: Agente reejecutado muestra conteo; reintento del proveedor marca "Posible loop" con evidencia.

### Implementation for User Story 7

- [x] T063 [P] [US7] Extender `deriveMetrics` con `invocations`, `retryCount`, `hasLoop`, `loopEvidence` (`invocations` a nivel de nodo + agregado `agentInvocations` por nombre de agente en `summarizeSession`, FR-010)
- [x] T064 [US7] Manejar partes `retry` y status `retry` en `src/Domains/Graph/lib/eventReducer.ts`
- [x] T065 [P] [US7] Crear `src/Domains/Inspector/Components/LoopBadge.tsx` y la franja rayada diagonal del nodo en `NodeStatusRail.tsx`
- [x] T066 [US7] Mostrar conteo de invocaciones (y `agentInvocations` desde el resumen de sesión) y evidencia de loop en `InspectorPanel`
- [x] T067 [P] [US7] Tests de loop (retry → `hasLoop`, alto conteo de invocaciones NO marca loop) en `src/Domains/Graph/lib/specs/deriveMetrics.spec.ts`

**Checkpoint**: US7 independiente y funcional.

---

## Phase 10: User Story 8 - Recursos disponibles (Priority: P3)

**Goal**: Ver skills, instructions y MCP disponibles por agente, etiquetados como "disponible".

**Independent Test**: Con MCP e instructions configurados, el inspector los lista como "disponible"; sin recursos, estado vacío.

### Implementation for User Story 8

- [x] T068 [P] [US8] Implementar derivación de `TResourceUsage` desde `mcp.status()`, `config.get().instructions` y `Agent.tools` en `src/Domains/Inspector/Inspector.service.ts`
- [x] T069 [US8] Implementar `src/Domains/Inspector/Components/ResourceList.tsx` con etiqueta "disponible" y estado vacío
- [x] T070 [US8] Integrar `ResourceList` en `InspectorPanel` (sección de recursos)
- [x] T071 [P] [US8] Test de `ResourceList` (lista, etiqueta "disponible", vacío) en `src/Domains/Inspector/Components/specs/ResourceList.spec.tsx`

**Checkpoint**: US8 independiente y funcional.

---

## Phase 11: User Story 9 - Seguir ejecución (Priority: P3)

**Goal**: Activar/desactivar el seguimiento del nodo activo.

**Independent Test**: Al activar, la vista se centra en el nodo activo; al desactivar, deja de recentrar.

### Implementation for User Story 9

- [x] T072 [US9] Implementar `src/Domains/Graph/Hooks/useFollowMode.ts` (`enabled`, `toggle`, `activeNodeId`)
- [x] T073 [US9] Añadir el toggle "seguir" en el shell y el centrado del canvas (`fitView`/`setCenter`) en `src/Domains/Graph/Components/AgentGraph.tsx`
- [x] T074 [P] [US9] Test de `useFollowMode` en `src/Domains/Graph/Hooks/specs/useFollowMode.spec.ts`

**Checkpoint**: US9 independiente y funcional.

---

## Phase 12: User Story 10 - Nodos esperando permiso (Priority: P3)

**Goal**: Destacar nodos que esperan una acción del usuario.

**Independent Test**: Una solicitud de permiso resalta el nodo; al resolverse, el resalte desaparece.

### Implementation for User Story 10

- [x] T075 [P] [US10] Manejar `permission.updated`/`permission.replied` en `src/Domains/Graph/lib/eventReducer.ts` (estado `waiting` con prioridad)
- [x] T076 [US10] Resaltar `waiting` en `NodeStatusRail.tsx` e indicar el permiso en `InspectorPanel`
- [x] T077 [P] [US10] Test de prioridad de estado `waiting` y limpieza al responder en `src/Domains/Graph/lib/specs/buildGraph.spec.ts`

**Checkpoint**: Las 10 user stories funcionan de forma independiente.

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Mejoras que cruzan historias

- [x] T078 [P] Responsive con `useDevice()`: tabs Sessions | Graph | Inspector en móvil (sin duplicar lógica) en `src/Infrastructure/Routes.tsx`
- [x] T079 [P] Accesibilidad: contraste WCAG AA, foco visible, `prefers-reduced-motion` en `src/index.css` y componentes de estado
- [x] T080 [P] Rendimiento: memoización y verificación con 50 nodos + 1000 partes (sin relayout por estado) en `src/Domains/Graph/Hooks/useGraphModel.ts`
- [x] T081 [P] Actualizar `README.md`/`docs/agent-viz-plan.md` con el resultado implementado
- [ ] T082 Ejecutar validación de `quickstart.md` V1–V8
- [x] T083 Ejecutar `pnpm tsc`, `pnpm lint` y `pnpm test` y corregir hallazgos
- [ ] T084 Commit(s) siguiendo Conventional Commits (`feat(connection|sessions|graph|inspector): ...`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup — BLOQUEA todas las historias
- **User Stories (Phase 3+)**: dependen de Foundational; luego pueden ir en paralelo o en orden de prioridad
- **Polish (Phase 13)**: depende de las historias deseadas

### User Story Dependencies

- **US1 (P1)**: solo requiere Fundacional
- **US2 (P1)**: solo requiere Fundacional (no depende de US1)
- **US3 (P1)**: requiere Fundacional (usa `buildGraph`, `deriveMetrics`, reducer)
- **US4 (P2)**: requiere Fundacional; integra con la selección de nodo de US3 (degradable sin ella)
- **US5/US6 (P2)**: requieren Fundacional (`deriveMetrics`); muestran datos en US3/US4
- **US7 (P3)**: extiende `deriveMetrics` (independiente)
- **US8 (P3)**: independiente dentro del inspector
- **US9 (P3)**: depende de US3 (canvas)
- **US10 (P3)**: extiende reducer y rail del grafo

### Within Each User Story

- Tests antes de la implementación cuando aplique
- Entidades → servicios → hooks → componentes → integración
- Historia completa y testeada antes de pasar a la siguiente prioridad

### Parallel Opportunities

- T002–T010 (Setup) mayormente en paralelo
- T011, T012, T014, T016, T020 en paralelo dentro de Fundacional
- US1 y US2 en paralelo tras Fundacional
- Todos los `[P]` de tests en paralelo por historia
- US5, US6, US7, US8 pueden avanzar en paralelo (archivos distintos)

---

## Parallel Example: Foundational

```bash
Task: "T011 Crear Connection.entity.ts"
Task: "T012 Crear Session/Graph/Inspector entity.ts"
Task: "T014 Test del reducer"
Task: "T016 Test de métricas"
Task: "T020 Test de Metric"
```

## Parallel Example: User Story 3

```bash
Task: "T037 buildGraph.ts"
Task: "T039 layoutGraph.ts"
Task: "T038 buildGraph.spec.ts"
Task: "T040 layoutGraph.spec.ts"
Task: "T047 AgentNode.spec.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 (US1) + Phase 4 (US2) + Phase 5 (US3)
3. **STOP and VALIDATE**: escenarios V1–V3 de `quickstart.md`
4. Demo del visor en vivo (conexión + sesiones + grafo)

### Incremental Delivery

1. Fundación lista
2. US1 → V1
3. US2 → V2
4. US3 → V3 (MVP completo)
5. US4 → V4 (inspector)
6. US5/US6 → métricas de tiempo y costo
7. US7/US8 → loops y recursos
8. US9/US10 → seguir y permisos
9. Polish → V8 y validación final

### Parallel Team Strategy

Tras Fundacional: Dev A (US1/US2), Dev B (US3/US4), Dev C (US5–US8), Dev D (US9/US10 + polish).

---

## Notes

- `[P]` = archivos distintos, sin dependencias
- `[Story]` mapea cada tarea a su user story
- Cada historia es completable y testeable de forma independiente
- Verificar que los tests fallan antes de implementar
- Commit por tarea o grupo lógico; evitar tareas vagas o conflictos de archivo
