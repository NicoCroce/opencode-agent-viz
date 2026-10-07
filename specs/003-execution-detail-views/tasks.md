---

description: "Task list — Detalle de ejecución de agentes"
---

# Tasks: Detalle de ejecución de agentes

**Feature**: `003-execution-detail-views`
**Input**: Design documents from `/specs/003-execution-detail-views/`

**Prerequisites**: [plan.md](./plan.md) (requerido), [spec.md](./spec.md) (requerido para las user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Incluidos. La constitución (Principio V y VIII) y [quickstart.md](./quickstart.md) §"Tests automáticos esperados" exigen specs junto al código para las funciones puras, hooks y componentes. Las tareas de test van antes de la implementación correspondiente.

**Organization**: Las tareas se agrupan por user story para permitir implementación y prueba independientes. Prioridades: US1–US3 = P1, US4–US6 = P2, US7 = P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivos distintos, sin dependencias sobre tareas incompletas *dentro de la misma fase*).
- **[Story]**: user story a la que pertenece la tarea (US1…US7). Setup, Foundational y Polish no llevan etiqueta.
- Cada descripción incluye la ruta exacta del archivo.

## Path Conventions

Single project (SPA frontend). Raíz del repo:
- Código: `src/`
- Specs junto al código en carpetas `specs/` (Principio VIII).
- Documentación de la feature: `specs/003-execution-detail-views/`.

> **Archivos compartidos entre historias (no paralelizables entre sí)**: `src/Domains/Inspector/Components/InspectorPanel.tsx` (US1/US2/US3/US5/US6), `src/Domains/Inspector/Inspector.service.ts` y `src/Domains/Inspector/Hooks/useInspectorData.ts` + su spec (US1/US5/US6/US7), `src/Domains/Inspector/Inspector.entity.ts` (US4/US5/US6/US7), `src/Domains/Graph/Components/AgentGraph.tsx` (US2/US3), `src/Domains/Graph/lib/specs/live.integration.spec.ts` (US1/US3), `src/Infrastructure/WorkspacePage.tsx` (US2/US4) y `src/Domains/History/Components/HistoryEntry.tsx` (US1/US7). Estas historias deben avanzar en el orden de fases indicado cuando toquen dichos archivos.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencias e inicialización de la base de pruebas.

- [X] T001 Añadir las dependencias `react-markdown`, `remark-gfm` y `rehype-sanitize` a `package.json` e instalarlas (`npm install`).
- [X] T002 [P] Verificar el baseline y la estructura por dominios: ejecutar `npm run tsc`, `npm run lint` y `npm test`, y confirmar que los barrels `src/Application/Components/Molecules/index.ts`, `src/Application/Hooks/index.ts`, `src/Domains/Graph/Components/index.ts` y `src/Domains/Inspector/Components/index.ts` existen.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Núcleo compartido por varias historias: keys de query, wrapper de lectura del SDK, tipos de estado de ejecución, reducción de eventos, dominio `History` (tipos + función pura) y primitivas compartidas de `Application` (texto enriquecido y toggle de razonamiento).

**⚠️ CRITICAL**: Ninguna user story puede empezar hasta completar esta fase.

- [X] T003 [P] Extender `src/Domains/queryKeys.ts` con las keys nuevas: `sessions.execution(id)`, `sessions.history(id)`, `sessions.diff(id)`, `sessions.forms(id)`, `sessions.inbox(id)`, `sessions.context(id)` y `sessions.log(id)`.
- [X] T004 [P] Extender `src/Infrastructure/Services/opencodeClient.ts`: ampliar la interfaz `OpenCodeService` e implementar los 9 métodos de solo lectura (`getHistoryMessages`, `getSessionDiff`, `getSessionStats`, `listSessionForms`, `getSessionForm`, `listSessionInbox`, `getSessionContext`, `getSessionLog` con `follow: false`, `exportSession`), reutilizando `normalizeMessages()` para el histórico y sin exponer métodos de escritura (contrato [contracts/client-read-contract.md](./contracts/client-read-contract.md)).
- [X] T005 [P] Extender `src/Infrastructure/Services/specs/opencodeClient.spec.ts` con los wrappers nuevos: paginación por cursor de `getHistoryMessages` (`nextCursor`), propagación de errores y ausencia de métodos de escritura.
- [X] T006 [P] Extender `src/Domains/Graph/Graph.entity.ts`: `TNodeStatus` pasa a 9 valores (`created | running | retrying | compacting | waiting-permission | waiting-input | succeeded | failed | interrupted`); añadir `retry: { attempt: number; next: number | null } | null` e `interruptReason: string | null` a `TGraphNodeData`; declarar `TExecutionSignal` (contrato [contracts/execution-state-contract.md](./contracts/execution-state-contract.md)).
- [X] T007 Extender `src/Domains/Graph/lib/nodeStatus.ts` con `toNodeStatus(input)` (nueva firma con `hasPendingForm`, `compaction`, `outcome`, `lastAssistantErrored` y la prioridad exacta de FR-020) y el predicado puro `isActiveStatus(status)`. Depende de T006.
- [X] T008 [P] Crear `src/Domains/Graph/lib/specs/nodeStatus.spec.ts`: los 9 estados, la prioridad completa y el caso FR-020 (error superado no tiñe de `failed` una ejecución activa ni `succeeded`). Depende de T007.
- [X] T009 Extender `src/Domains/Graph/lib/eventReducer.ts`: procesar `session.text.ended`, `session.reasoning.ended` y `session.message.content.updated`; parchear `queryKeys.sessions.execution(id)` desde `session.retry.scheduled`, `session.status` (retry), `session.compaction.started/ended/failed`, `session.execution.succeeded/failed/interrupted` (con `interruptReason`), `session.idle`; e inbox/forms. **Ignorar explícitamente** `session.text.delta`, `session.reasoning.delta`, `session.tool.input.delta` y `session.tool.progress` (FR-005, Principio VII). Depende de T003.
- [X] T010 [P] Extender `src/Domains/Graph/lib/specs/eventReducer.spec.ts`: text/reasoning `ended`, `content.updated`, retry, compaction, outcome, interrupción con motivo, inbox, forms y verificación de que los deltas se ignoran. Depende de T009.
- [X] T011 [P] Crear `src/Domains/History/History.entity.ts` con la unión discriminada `THistoryEntry` (todos los `kind` de [data-model.md](./data-model.md) §2.3), `TToolEntry`, `THistoryTarget` y `TLineageNav`.
- [X] T012 Crear `src/Domains/History/lib/buildHistory.ts`: función pura `buildHistory(messages: TSessionMessage[]): THistoryEntry[]` (orden por `info.time.created`, intercalado de partes, `id` estable, `isComplete` según `time.completed`, adjuntos del usuario, compaction e idle). Depende de T011.
- [X] T013 [P] Crear `src/Domains/History/lib/specs/buildHistory.spec.ts`: orden cronológico, intercalado de tools, respuesta "en curso", adjuntos (con y sin nombre), cambios de agente/modelo/ubicación, system/synthetic/skill/shell, compaction (running/completed/failed) e idle (FR-006/007/009/035). Depende de T012.
- [X] T014 [P] Crear `src/Application/Components/Molecules/RichText.tsx` con `react-markdown` + `remark-gfm` + `rehype-sanitize` y `variant: 'answer' | 'reasoning'` (FR-001/002; sin `dangerouslySetInnerHTML`). Depende de T001.
- [X] T015 [P] Crear `src/Application/Components/Molecules/specs/RichText.spec.tsx`: listas, código, tablas, énfasis y neutralización de HTML/`<script>`/`javascript:` (FR-001). Depende de T014.
- [X] T016 [P] Crear `src/Application/Hooks/useReasoningVisibility.ts` (`{ visible, toggle }`, estado local sin persistencia). Ver contrato [contracts/rich-text-contract.md](./contracts/rich-text-contract.md).
- [X] T017 [P] Crear `src/Application/Hooks/specs/useReasoningVisibility.spec.tsx`: `toggle` alterna `visible` y arranca en `false` (o en el valor inicial). Depende de T016.
- [X] T018 Extender los barrels de `Application`: exportar `RichText` en `src/Application/Components/Molecules/index.ts` y `src/Application/Components/index.ts`, y `useReasoningVisibility` en `src/Application/Hooks/index.ts`. Depende de T014 y T016.

**Checkpoint**: Núcleo listo — las user stories pueden empezar (US1→US2→US3 en P1; el resto en orden de prioridad).

---

## Phase 3: User Story 1 - Leer las respuestas y el razonamiento de un agente (Priority: P1) 🎯 MVP

**Goal**: Mostrar en el detalle del agente las respuestas y el razonamiento con formato enriquecido y saneado, en orden cronológico e intercalados con las llamadas a herramienta, con un toggle de razonamiento independiente.

**Independent Test**: Abrir el detalle de un agente con al menos una respuesta de texto y comprobar que se lee el texto completo, en orden, junto a sus tool calls; expandir una herramienta terminada y una fallida; activar y desactivar el razonamiento (FR-001..FR-007; SC-001/002).

### Implementation for User Story 1

- [X] T019 [P] [US1] Crear `src/Application/Components/Organisms/HistoryEntry.tsx`: render por `kind` (user, answer, reasoning, tool, system, synthetic, skill, shell, agent/model/location-switched, compaction, idle), con franja/etiqueta plana de tipo, `RichText` para answer/reasoning (reasoning atenuado) y "en curso" cuando `isComplete === false` (FR-003/006). Depende de T011, T012 y T014.
- [X] T020 [P] [US1] Crear `src/Application/Components/Organisms/ToolCallEntry.tsx`: fila expandible/contraíble con chevron (sin caja) que muestra `input`, `result` y `error`, y el estado real sin inventar resultado (FR-004/011). Depende de T011.
- [X] T021 [P] [US1] Crear `src/Application/Components/Organisms/specs/ToolCallEntry.spec.tsx`: expandir/contraer, resultado completo, error en fallida e "incompleta/en curso" sin resultado. Depende de T020.
- [X] T022 [US1] Crear `src/Domains/Inspector/Components/AnswersSection.tsx`: lista las entradas conversacionales (`user`, `answer`, `reasoning`, `tool`) de `buildHistory` en orden, con `RichText`; toggle de razonamiento con `Button` `aria-pressed`; estado vacío explícito ("Sin respuestas todavía"); botón "Ver histórico completo" (prop `onOpenHistory`). Depende de T019, T020 y T016.
- [X] T023 [P] [US1] Crear `src/Domains/Inspector/Components/specs/AnswersSection.spec.tsx`: respuestas en orden con tools intercaladas, toggle de razonamiento que no oculta respuestas, "en curso" y vacío explícito. Depende de T022.
- [X] T024 [US1] Extender `src/Domains/Inspector/Hooks/useInspectorData.ts`: derivar `entries` (respuestas/razonamiento/herramientas) con `buildHistory` desde los mensajes ya cacheados, exponiendo `isError`/`isLoading`. Depende de T012.
- [X] T025 [US1] Extender `src/Domains/Inspector/Components/InspectorPanel.tsx`: renderizar `AnswersSection` con los datos de T024 y pasar `showReasoning`/`onToggleReasoning`. Depende de T022 y T024.
- [X] T026 [P] [US1] Extender `src/Domains/Inspector/Components/specs/InspectorPanel.spec.tsx`: la sección de respuestas aparece, el toggle funciona y el vacío se muestra sin respuestas. Depende de T025.
- [X] T027 [P] [US1] Extender `src/Domains/Graph/lib/specs/live.integration.spec.ts` (o crear un spec dedicado) para verificar que `buildHistory` deriva respuestas/razonamiento/tools en orden desde un fixture de eventos real (`src/Domains/Graph/lib/__fixtures__/run.ndjson`; re-capturar/adaptar a eventos V2 si hace falta). Depende de T012.

**Checkpoint**: US1 funcional y testeable de forma independiente (MVP).

---

## Phase 4: User Story 2 - Abrir el histórico completo de un agente o subagente (Priority: P1)

**Goal**: Overlay a pantalla completa con la conversación íntegra de cualquier agente/subagente, en orden cronológico, con cabecera de identidad/métricas, carga progresiva sin tope, navegación de linaje padre↔hijo y cierre que devuelve al grafo con la selección previa.

**Independent Test**: Abrir el histórico de un subagente desde el grafo (doble clic) y desde el detalle, ver toda su actividad en orden, expandir una herramienta, navegar al padre y volver sin cerrar, desplazarse en una sesión larga y cerrar volviendo al grafo con la misma selección (FR-008..FR-016; SC-003/004/011).

### Implementation for User Story 2

- [X] T028 [US2] Crear `src/Domains/History/History.service.ts`: `useHistoryMessages(sessionId)` con `useInfiniteQuery` sobre `queryKeys.sessions.history(id)` y `getHistoryMessages`, y `useSessionInfo`/helpers de cabecera. Depende de T003 y T004.
- [X] T029 [US2] Crear `src/Domains/History/Hooks/useHistoryPagination.ts`: `entries`, `isLoading`, `isError`, `hasNextPage`, `isFetchingNextPage`, `isFetchNextPageError`, `fetchNextPage`; invierte/aplana las páginas `desc` a orden ascendente. Depende de T028.
- [X] T030 [P] [US2] Crear `src/Domains/History/Hooks/specs/useHistoryPagination.spec.tsx`: cursor, orden ascendente, error de página (`isFetchNextPageError`) y fin normal sin aviso. Depende de T029.
- [X] T031 [US2] Crear `src/Domains/History/Hooks/useHistory.ts`: `{ targetId, open, close, navigateTo }` para el overlay y el linaje (FR-008/012/014).
- [X] T032 [P] [US2] Crear `src/Domains/History/Hooks/specs/useHistory.spec.tsx`: abrir, cerrar y `navigateTo` sin cerrar. Depende de T031.
- [X] T033 [P] [US2] Crear `src/Domains/History/Components/HistoryHeader.tsx`: identidad (título/nombre), modelo, estado, coste, tokens, resultado final y directorio (o "no disponible", FR-038); navegación "Invocado por" / "Invocó a" con `onNavigate` (FR-010/012). Depende de T011.
- [X] T034 [US2] Crear `src/Domains/History/Components/HistoryTimeline.tsx`: lista `THistoryEntry` con `HistoryEntry`/`ToolCallEntry`, centinela superior con `IntersectionObserver` que dispara `fetchNextPage`, `content-visibility: auto` + `contain-intrinsic-size` y aviso explícito de `isFetchNextPageError` (FR-013/016, SC-011). Depende de T019 y T029.
- [X] T035 [P] [US2] Crear `src/Domains/History/Components/specs/HistoryTimeline.spec.tsx`: render de entradas, vacío, "en curso", disparo de carga y aviso de truncación. Depende de T034.
- [X] T036 [US2] Crear `src/Domains/History/Components/HistoryModal.tsx`: overlay a pantalla completa (`--surface-1`, cabecera fija + timeline scrollable) con las props `node`, `lineage`, `showReasoning`, `onToggleReasoning`, `onNavigate`, `onClose`; estados error→loading→vacío→datos (`EmptyScreenError`/skeleton/`EmptyState`). Depende de T033 y T034.
- [X] T037 [P] [US2] Crear `src/Domains/History/Components/specs/HistoryModal.spec.tsx`: cabecera con "no disponible", estado vacío, error y cierre. Depende de T036.
- [X] T038 [US2] Crear los barrels del dominio `History`: `src/Domains/History/Components/index.ts`, `src/Domains/History/Hooks/index.ts` y `src/Domains/History/index.ts`. Depende de T028, T029, T031, T033, T034 y T036.
- [X] T039 [US2] Extender `src/Domains/Graph/Components/AgentGraph.tsx` y su prop en `AgentGraphProps` con `onNodeDoubleClick`/`onOpenHistory` (doble clic en un nodo `agent` abre el histórico; el clic simple sigue seleccionando). Depende de T038.
- [X] T040 [US2] Extender `src/Domains/Inspector/Components/InspectorPanel.tsx` para conectar el botón "Ver histórico completo" de `AnswersSection` con `onOpenHistory`. Depende de T025 y T038.
- [X] T041 [US2] Extender `src/Infrastructure/WorkspacePage.tsx`: estado `historySessionId`, estado de razonamiento (`useReasoningVisibility`), cálculo de `TLineageNav` desde las aristas del grafo, render de `HistoryModal`, wiring del doble clic y del botón, cierre al cambiar de sesión raíz y "no disponible" si el objetivo desaparece (FR-014, edge cases). Depende de T031, T036, T038, T039 y T040.

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 - Distinguir el estado real de cada ejecución (Priority: P1)

**Goal**: 9 estados de ejecución consistentes entre nodo y detalle (creada, ejecutando, reintentando, compactando, esperando permiso, esperando respuesta, terminada, fallida, interrumpida), con reintento y motivo de interrupción, sin que un error superado tiña de error a una ejecución activa.

**Independent Test**: Reproducir (o cargar con fixture) un reintento, una compactación, una espera de permiso, un fallo y una interrupción y comprobar que cada situación se distingue con su etiqueta propia y coincide entre nodo y detalle (FR-017..FR-023; SC-005/006/007).

### Implementation for User Story 3

- [X] T042 [P] [US3] Crear `src/Domains/Graph/Hooks/useExecutionSignals.ts`: combinar la siembra durable de `getSessionLog` (`follow: false`) con la caché en vivo `queryKeys.sessions.execution(id)` (retry/compaction/outcome/interruptReason). Depende de T004, T006 y T009.
- [X] T043 [P] [US3] Crear `src/Domains/Graph/Hooks/specs/useExecutionSignals.spec.tsx`: siembra desde log + eventos en vivo, motivo de interrupción ausente → "no disponible". Depende de T042.
- [X] T044 [US3] Extender `src/Domains/Graph/lib/buildGraph.ts` y `BuildGraphInput` para aceptar señales de ejecución + forms + inbox y llamar a `toNodeStatus` con la nueva firma; propagar `retry` e `interruptReason` a `TGraphNodeData`. Depende de T007.
- [X] T045 [P] [US3] Extender `src/Domains/Graph/lib/specs/buildGraph.spec.ts`: reintento, compactación, espera de permiso, espera de formulario, outcome succeeded/failed/interrupted, `created` vs `succeeded` y FR-020. Depende de T044.
- [X] T046 [US3] Extender `src/Domains/Graph/Hooks/useGraphModel.ts`: combinar `useExecutionSignals`, statuses, permisos, forms e inbox por nodo y usar `isActiveStatus` en `activeNodeId`. Depende de T042 y T044.
- [X] T047 [P] [US3] Extender `src/Domains/Graph/Components/AgentNode.tsx`: `STATUS_LABEL` a los 9 estados y `isRunning` vía `isActiveStatus`; mostrar número de intento/proximo intento, motivo de interrupción y una señal de progreso perceptible que **no** dependa del texto en generación (FR-022). Depende de T006 y T007.
- [X] T048 [P] [US3] Extender `src/Domains/Graph/Components/NodeStatusRail.tsx`: `RAIL_COLOR` a los 9 estados (reutilizando tokens; reintento/compactación con rayado de loop para retry). Depende de T006.
- [X] T049 [P] [US3] Extender `src/Domains/Graph/Components/ExecutionLanes.tsx`: `STATUS_DOT` a los 9 estados. Depende de T006.
- [X] T050 [P] [US3] Extender `src/Application/Components/Molecules/StatusDot.tsx`: `STATUS_COLOR` y `STATUS_LABEL` a los 9 estados (interrumpido ≠ error). Depende de T006.
- [X] T051 [US3] Extender `src/Domains/Graph/Components/AgentGraph.tsx`: `STATUS_RANK` y detección de nivel activo a los 9 estados con `isActiveStatus` (comparte archivo con T039; correr después de US2). Depende de T006 y T007.
- [X] T052 [P] [US3] Extender `src/Domains/Graph/Components/specs/AgentNode.spec.tsx`: etiqueta por estado enriquecido, estado consistente y señal de progreso visible sin depender del texto (FR-022). Depende de T047.
- [X] T053 [US3] Extender `src/Domains/Inspector/Components/InspectorPanel.tsx`: `STATUS_LABEL` a los 9 estados, consistente con el nodo (FR-023; comparte archivo con US1/US2). Depende de T006.
- [X] T054 [P] [US3] Extender `src/Domains/Graph/lib/specs/live.integration.spec.ts` para derivar el estado enriquecido desde el fixture (`run.ndjson`, re-capturado a eventos V2 si hace falta). Depende de T044.

**Checkpoint**: US1, US2 y US3 completas e independientemente funcionales (P1 entregado).

---

## Phase 6: User Story 4 - Ver el resumen de toda la sesión (Priority: P2)

**Goal**: Barra de resumen agregado (contadores por estado, coste, tokens y tiempo transcurrido) en la cabecera del grafo, actualizada en vivo sin reordenar la vista.

**Independent Test**: Abrir una sesión con varios agentes y comprobar contadores por estado, coste/tokens acumulados y tiempo transcurrido, con actualización sin saltos (FR-024..FR-027; SC-008).

### Implementation for User Story 4

- [X] T055 [US4] Extender `src/Domains/Inspector/Inspector.entity.ts`: añadir a `TSessionSummary` los campos `createdCount`, `retryingCount`, `compactingCount`, `interruptedCount`, `succeededCount` y `elapsedMs`. Depende de T006.
- [X] T056 [US4] Extender `src/Domains/Graph/lib/deriveMetrics.ts`: `summarizeSession(root, graph, resourceUsage, now)` calcula los conteos nuevos, `runningCount`/`waitingCount` agrupados, `errorCount` (`failed`) e `interruptedCount` por separado, y `elapsedMs` (FR-024..FR-027). Depende de T055.
- [X] T057 [P] [US4] Extender `src/Domains/Graph/lib/specs/deriveMetrics.spec.ts`: conteos nuevos, agrupación de waiting, `interruptedCount` ≠ `errorCount`, `elapsedMs` activo/inactivo/vacío y sumas de coste/tokens. Depende de T056.
- [X] T058 [US4] Crear `src/Domains/Graph/Components/SessionSummaryBar.tsx`: tira monoespaciada (`font-mono tabular-nums`) con contadores por estado, `formatCost`, `formatTokens` y `formatDuration`; dato ausente → "no disponible" (FR-038; contrato [contracts/session-summary-contract.md](./contracts/session-summary-contract.md)). Depende de T055.
- [X] T059 [P] [US4] Crear `src/Domains/Graph/Components/specs/SessionSummaryBar.spec.tsx`: contadores, coste/tokens/tiempo y "no disponible". Depende de T058.
- [X] T060 [US4] Extender `src/Infrastructure/WorkspacePage.tsx` (y la cabecera del grafo) para renderizar `SessionSummaryBar` alimentado por `summarizeSession` sobre los nodos ya cargados, sin provocar relayout (FR-027; comparte archivo con US2). Depende de T056 y T058.

**Checkpoint**: US4 funcional de forma independiente.

---

## Phase 7: User Story 5 - Ver el impacto de un agente en el repositorio (Priority: P2)

**Goal**: Lista de archivos afectados por un agente (estado y líneas añadidas/quitadas) y el parche de cada archivo, con estado vacío explícito.

**Independent Test**: Inspeccionar un agente que modificó archivos y comprobar la lista con estado y líneas, y el parche de un archivo; sin cambios → mensaje explícito (FR-028..FR-030; SC-009).

### Implementation for User Story 5

- [X] T061 [US5] Extender `src/Domains/Inspector/Inspector.service.ts` (o `useInspectorData.ts`) con `useSessionDiff(sessionId)` sobre `queryKeys.sessions.diff(id)` y `getSessionDiff`, exponiendo `isError`/`isLoading` (comparte archivo con US1/US6/US7). Depende de T003 y T004.
- [X] T062 [P] [US5] Extender `src/Domains/Inspector/Hooks/specs/useInspectorData.spec.tsx` con el caso de diff (datos, vacío y error). Depende de T061.
- [X] T063 [P] [US5] Extender `src/Domains/Inspector/Inspector.entity.ts` con `TFileChange` (alias de `FileDiffInfo`) y el tipo de resultado de `useSessionDiff`. Depende de T004.
- [X] T064 [US5] Crear `src/Domains/Inspector/Components/FileChanges.tsx`: lista `TFileChange` con `file`, estado (añadido/modificado/borrado) y `+additions`/`-deletions`; seleccionar un archivo muestra su `patch` en mono (parche vacío → "parche no disponible"); sin cambios → "Sin cambios de archivos" (FR-028..FR-030). Depende de T061 y T063.
- [X] T065 [P] [US5] Crear `src/Domains/Inspector/Components/specs/FileChanges.spec.tsx`: lista, selección de parche, parche ausente y vacío explícito. Depende de T064.
- [X] T066 [US5] Extender `src/Domains/Inspector/Components/InspectorPanel.tsx` para renderizar `FileChanges` con error→loading→vacío→datos (comparte archivo con US1/US2/US3/US6). Depende de T064.

**Checkpoint**: US5 funcional de forma independiente.

---

## Phase 8: User Story 6 - Entender por qué una ejecución está esperando (Priority: P2)

**Goal**: Mostrar el motivo de la espera: permisos (operación y recursos), preguntas al usuario (texto y opciones) con su estado (pendiente/respondida/cancelada) y turnos en cola.

**Independent Test**: Reproducir una ejecución que pide permiso y otra que pregunta al usuario, y comprobar motivo, texto/opciones, respuesta y cola; pendiente/cancelada nunca como respondida (FR-031..FR-034; SC-010).

### Implementation for User Story 6

- [X] T067 [US6] Extender `src/Domains/Inspector/Inspector.service.ts` y `useInspectorData.ts` con `useSessionForms` (`listSessionForms` + `getSessionForm` por formulario), `useSessionPermissions` y `useSessionInbox` (`queuedTurns = items.filter(delivery === 'queue').length`), con `isError`/`isLoading` (comparte archivo con US1/US5/US7). Depende de T003 y T004.
- [X] T068 [P] [US6] Extender `src/Domains/Inspector/Inspector.entity.ts` con `TQuestionEntry` y `TPermissionEntry` (FR-031..FR-033). Depende de T004.
- [X] T069 [P] [US6] Extender `src/Domains/Inspector/Hooks/specs/useInspectorData.spec.tsx` con forms/permissions/inbox (estados pending/answered/cancelled y `queuedTurns`). Depende de T067.
- [X] T070 [US6] Crear `src/Domains/Inspector/Components/QuestionsSection.tsx`: permisos (`action` + `resources[]`), preguntas (`title`, `fields[].title/options`, respuesta cuando existe; pending/cancelled ≠ answered) y cola (`queuedTurns`); vacío explícito (FR-031..FR-034). Depende de T067 y T068.
- [X] T071 [P] [US6] Crear `src/Domains/Inspector/Components/specs/QuestionsSection.spec.tsx`: permiso, pregunta pendiente/respondida/cancelada y cola. Depende de T070.
- [X] T072 [US6] Extender `src/Domains/Inspector/Components/InspectorPanel.tsx` para renderizar `QuestionsSection` con error→loading→vacío→datos (comparte archivo con US1/US2/US3/US5). Depende de T070.

**Checkpoint**: US6 funcional de forma independiente.

---

## Phase 9: User Story 7 - Diagnosticar contexto, cola y rendimiento de herramientas (Priority: P3)

**Goal**: Marcar episodios de compactación en el histórico con su estado, mostrar el contexto resultante, y añadir la duración mediana por herramienta.

**Independent Test**: Inspeccionar un agente que compactó contexto y que tiene herramientas registradas, y comprobar que la compactación aparece marcada con su estado, el contexto resultante y la duración mediana por herramienta (FR-035/FR-036; la cola de turnos, FR-034, se verifica en US6).

### Implementation for User Story 7

- [X] T073 [P] [US7] Extender `src/Domains/Inspector/Inspector.entity.ts` con `TToolStat` (`name`, `calls`, `medianMs`). Depende de T004.
- [X] T074 [P] [US7] Crear `src/Domains/Inspector/lib/medianToolDurations.ts`: función pura `medianToolDurations(tools: TToolHistoryEntry[]): TToolStat[]` (agrupa por `name`, cuenta y mediana de `endedAt - startedAt` con ambos tiempos; `null` sin datos). Depende de T073.
- [X] T075 [P] [US7] Crear `src/Domains/Inspector/lib/specs/medianToolDurations.spec.ts`: 0/1/varias herramientas, mediana par/impar y tiempos faltantes (FR-036). Depende de T074.
- [X] T076 [US7] Extender `src/Domains/Inspector/Components/ToolHistory.tsx`: conservar el truncado de 10 (feature 002) y añadir una fila por herramienta con `calls` y `medianMs` ("no disponible" sin datos). Depende de T074.
- [X] T077 [P] [US7] Extender `src/Domains/Inspector/Components/specs/ToolHistory.spec.tsx`: fila de mediana, sin datos → "no disponible" y ejecuciones individuales conservadas. Depende de T076.
- [X] T078 [US7] Extender `src/Domains/Inspector/Inspector.service.ts` y `useInspectorData.ts` con `useSessionContext(sessionId)` (bajo demanda, `getSessionContext`) (comparte archivo con US1/US5/US6). Depende de T003 y T004.
- [X] T079 [P] [US7] Extender `src/Domains/Inspector/Hooks/specs/useInspectorData.spec.tsx` con el caso de `session.context`. Depende de T078.
- [X] T080 [US7] Crear `src/Domains/History/Components/CompactionContext.tsx`: muestra el contexto resultante (mensajes de `session.context`) de un episodio de compactación, con error→loading→vacío→datos. Depende de T078.
- [X] T081 [US7] Integrar `CompactionContext` en el `kind: 'compaction'` de `src/Domains/History/Components/HistoryEntry.tsx`, marcando el estado (en curso/completada/fallida) en su posición cronológica (FR-035; comparte archivo con US1). Depende de T080 y T019.
- [X] T082 [P] [US7] Extender `src/Domains/History/lib/specs/buildHistory.spec.ts` con compactación `running`/`completed`/`failed` y verificación de que una fallida nunca se presenta como exitosa (FR-035). Depende de T012.

**Checkpoint**: Todas las user stories funcionan de forma independiente.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Mejoras que afectan a varias historias y validación final.

- [X] T088 [P] Unificar las etiquetas de los 9 estados en una única fuente de verdad (`NODE_STATUS_LABEL`) y usarla en `AgentNode`, `StatusDot`, `InspectorPanel`, `HistoryHeader` y `AgentNode.spec` (FR-023: coherencia nodo↔detalle).
- [X] T089 [P] Migrar los literales del estado antiguo en los specs de Graph (`chainGraph`, `lineage`, `cardHeight`, `buildViewNodes`, `parallelism`, `executionLevels`, `layoutGraph`) a `succeeded`, y el fallback `?? 'idle'` de `ExecutionLanes.tsx` a `?? 'created'`.
- [X] T090 [P] Migrar `src/Domains/Sessions/Components/SessionCard.tsx` a la nueva firma de `toNodeStatus` (el campo `hasError` ya no existe; usar `outcome`/`lastAssistantErrored` y los 9 estados).
- [X] T091 Cablear `sessionId` de extremo a extremo hasta `HistoryEntry` (desde `AnswersSection`/`InspectorPanel` y desde `HistoryTimeline`/`HistoryModal`) para que `CompactionContext` cargue el contexto de compactación (FR-035).
- [X] T083 [P] Extender los barrels públicos con los componentes nuevos: `src/Domains/Graph/Components/index.ts` (`SessionSummaryBar`), `src/Domains/Inspector/Components/index.ts` (`AnswersSection`, `FileChanges`, `QuestionsSection`) y confirmar `src/Domains/History/index.ts`.
- [X] T084 [P] Actualizar la documentación de la feature (`README.md` y/o `specs/003-execution-detail-views/quickstart.md`) con las nuevas vistas, endpoints de lectura y dependencias (`react-markdown`/`remark-gfm`/`rehype-sanitize`).
- [X] T085 Ejecutar la verificación del repositorio definida en `package.json` (`npm run tsc`, `npm run lint`, `npm test`) y corregir cualquier regresión de tipos, lint o tests.
- [X] T086 [P] Validar los escenarios V1–V7 de `specs/003-execution-detail-views/quickstart.md` (respuestas, histórico, estado, resumen, archivos, espera/diagnóstico y regresiones), incluyendo explícitamente: render responsive sin duplicar lógica (FR-040), diseño oscuro/plano con contraste legible (FR-039) y ausencia de regresiones en los estados de conexión, carga, vacío y error (FR-041, SC-012).
- [X] T087 [P] Auditoría de solo lectura (FR-037) sobre `src/Infrastructure/Services/opencodeClient.ts`: confirmar que no se exponen ni usan `form.reply`/`form.cancel`, `inbox.cancel`/`inbox.update`, `session.interrupt` ni `session.import`, y que no se procesan deltas de texto (FR-005).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — puede empezar de inmediato.
- **Foundational (Phase 2)**: depende de Setup — **bloquea** todas las user stories.
- **User Stories (Phase 3+)**: dependen de Foundational. En orden de prioridad: US1 → US2 → US3 (P1), US4 → US5 → US6 (P2), US7 (P3). Las historias comparten algunos archivos (ver aviso de "Archivos compartidos"), por lo que el orden de fases es el camino seguro.
- **Polish (Phase 10)**: depende de todas las historias deseadas.

### User Story Dependencies

- **US1 (P1)**: tras Foundational. Sin dependencias de otras historias. Es el MVP.
- **US2 (P1)**: tras Foundational. Reutiliza `HistoryEntry`/`ToolCallEntry` de US1 (T019/T020) y `buildHistory`/`RichText` de Foundational; también toca `InspectorPanel` (T040) y `WorkspacePage` (T041).
- **US3 (P1)**: tras Foundational. Independiente de US1/US2 salvo `AgentGraph` (T051 tras T039) e `InspectorPanel` (T053 tras T040).
- **US4 (P2)**: tras Foundational. Toca `WorkspacePage` (T060) después de US2 (T041).
- **US5 (P2)**: tras Foundational. Toca `Inspector.service`/`useInspectorData` (T061) y `InspectorPanel` (T066) tras US3.
- **US6 (P2)**: tras Foundational. Toca los mismos archivos de Inspector que US5 (T067, T072) — ejecutar tras US5.
- **US7 (P3)**: tras Foundational. Toca `HistoryEntry` (T081) tras US1/US2 y los archivos de Inspector (T078) tras US6.

### Within Each User Story

- Tests de funciones puras/hook/componente antes de la implementación correspondiente.
- Tipos/entidades → funciones puras → hooks/servicios → componentes → integración.
- Cada historia completa antes de pasar a la siguiente prioridad.

### Parallel Opportunities

- Setup: T002 en paralelo con T001 (archivos distintos).
- Foundational: T003, T004, T005, T006, T011, T014, T015, T016, T017 en paralelo (archivos distintos). T007 depende de T006; T009 de T003; T012 de T011; T008 de T007; T010 de T009; T013 de T012; T018 de T014/T016.
- US1: T019, T020, T021, T023, T026, T027 en paralelo; T022 depende de T019/T020; T024 independiente; T025 de T022/T024.
- US2: T028 → T029/T031 → T030/T032; T033, T034, T035, T037 en paralelo tras sus deps; T036 de T033/T034; T038 de los anteriores; T039/T040/T041 en orden.
- US3: T042, T044 en paralelo; T043 de T042; T045 de T044; T047, T048, T049, T050, T052, T054 en paralelo; T046 de T042/T044; T051 tras T039; T053 tras T040.
- US4: T055 → T056/T058; T057 de T056; T059 de T058; T060 de T056/T058.
- US5: T061/T063 en paralelo; T062 de T061; T064 de T061/T063; T065 de T064; T066 de T064.
- US6: T067/T068 en paralelo; T069 de T067; T070 de T067/T068; T071 de T070; T072 de T070.
- US7: T073 → T074; T075 de T074; T076 de T074; T077 de T076; T078 independiente; T079 de T078; T080 de T078; T081 de T080/T019; T082 de T012.
- Polish: T083, T084, T086, T087 en paralelo; T085 al final.

---

## Parallel Example: User Story 1

```bash
# Componentes base en paralelo (archivos distintos):
Task: "Crear src/Domains/History/Components/HistoryEntry.tsx"
Task: "Crear src/Domains/History/Components/ToolCallEntry.tsx"

# Tests en paralelo tras sus dependencias:
Task: "Crear src/Domains/History/Components/specs/ToolCallEntry.spec.tsx"
Task: "Crear src/Domains/Inspector/Components/specs/AnswersSection.spec.tsx"
Task: "Extender src/Domains/Inspector/Components/specs/InspectorPanel.spec.tsx"
```

## Parallel Example: User Story 3

```bash
# Mapas de estado en paralelo (archivos distintos):
Task: "Extender src/Domains/Graph/Components/AgentNode.tsx"
Task: "Extender src/Domains/Graph/Components/NodeStatusRail.tsx"
Task: "Extender src/Domains/Graph/Components/ExecutionLanes.tsx"
Task: "Extender src/Application/Components/Molecules/StatusDot.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1 (Setup).
2. Completar Phase 2 (Foundational) — **crítico**: bloquea todas las historias.
3. Completar Phase 3 (US1).
4. **PARAR y VALIDAR**: probar US1 de forma independiente (escenario V1 de quickstart).
5. Desplegar/demostrar si está listo (SC-001/002).

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → validar → entregar (MVP).
3. US2 → validar → entregar.
4. US3 → validar → entregar (cierra P1).
5. US4, US5, US6 → validar cada una → entregar (P2).
6. US7 → validar → entregar (P3).
7. Polish → validación final de V1–V7 y `npm run tsc && npm run lint && npm test`.

### Parallel Team Strategy

1. El equipo completa Setup + Foundational en conjunto.
2. Tras Foundational:
   - Dev A: US1 (bloquea US2 por `HistoryEntry`/`ToolCallEntry`).
   - Dev B: US3 (independiente salvo `AgentGraph`/`InspectorPanel`).
   - Dev C: US4 (independiente salvo `WorkspacePage`).
3. US2 después de US1; US5/US6/US7 en orden por los archivos compartidos de Inspector/History.

---

## Notes

- `[P]` = archivos distintos y sin dependencia sobre tareas incompletas de la misma fase.
- `[Story]` mapea la tarea a la user story para trazabilidad.
- Los tests se escriben y **fallan** antes de implementar (Principio V y VIII).
- No se procesan deltas de texto (`session.text.delta`/`reasoning.delta`/`tool.input.delta`); solo texto consolidado (FR-005, Principio VII).
- Solo lectura: ninguna tarea expone o usa métodos de escritura (FR-037).
- Commit por tarea o grupo lógico (Conventional Commits).
- Parar en cada checkpoint para validar la historia de forma independiente.
- Evitar: tareas vagas, conflictos por el mismo archivo y dependencias cruzadas que rompan la independencia.

---

## Phase 11: Convergence

- [X] T092 Incorporar las preguntas del usuario (`session.form.list` + `getSessionForm`) y su respuesta al histórico en su posición cronológica, manteniéndolas también en `QuestionsSection`, de modo que al recorrer el histórico se encuentre la pregunta junto a la respuesta dada y se distinga `pending`/`cancelled` de `answered` per FR-033 / US6/AC3 (partial).
- [X] T093 Desacoplar el render del contexto de compactación del histórico para eliminar el acoplamiento entre dominios introducido al mover `HistoryEntry` a `Application`: `src/Application/Components/Organisms/HistoryEntry.tsx` no debe importar `Domains/History/Components/CompactionContext`, ni un componente de un dominio debe consumir el service de otro (`CompactionContext` → `Inspector.service`); invertir la dependencia (que el llamador del dominio inyecte el render del contexto, o mover la pieza a `Application` con los datos provistos por el hook del dominio llamador) per Constitution II (contradicts).

---

## Phase 12: Convergence

- [X] T094 Separar las claves de query de los formularios: `useGraphModel` cachea los `FormInfo[]` crudos de `session.form.list` bajo `queryKeys.sessions.forms(id)` (`src/Domains/Graph/Hooks/useGraphModel.ts`) mientras que `Inspector.service.useSessionForms` cachea los `TQuestionEntry[]` resueltos bajo la misma clave (`src/Domains/Inspector/Inspector.service.ts`), de modo que comparten caché con formas incompatibles y gana quien carga primero (el grafo, que siempre está montado); al abrir el inspector o el histórico, `forms.questions` puede contener `FormInfo[]` sin `state`/`answer`, rompiendo FR-032/FR-033 (pregunta pendiente/respondida/cancelada y respuesta en su posición cronológica) y pudiendo reventar en `QuestionsSection`/`HistoryEntry` cuando un campo no trae `options`. Dar a las preguntas resueltas una clave propia (p. ej. `sessions.questions(id)`) o derivarlas de la lista cruda sin pisarla, manteniendo `sessions.forms(id)` para los `FormInfo[]` crudos, y cubrir con un spec que ambos consumidores (Inspector e histórico) reciben la forma correcta per FR-032/FR-033 (partial).
