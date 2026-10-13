---
description: "Task list for 012-refactor-workspace-enrichment"
---

# Tasks: Descomposición de la vista de workspace y del enriquecimiento del grafo

**Input**: Design documents from `/specs/012-refactor-workspace-enrichment/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md),
`.specify/memory/constitution.md`

**Tests**: SÍ solicitados — la spec los exige (FR-020 "cada pieza pura nueva MUST tener su propio archivo
de pruebas"; FR-021 "las suites existentes pasan sin modificarse"; US1/US2/US3 tienen *Independent Test*
explícito). Todas las tareas de test de este documento son de creación de archivos **nuevos**; ninguna
edita un spec existente.

**Organization**: por historia de usuario (US1 P1 = vista de workspace; US2 P2 = enriquecimiento en
piezas puras; US3 P3 = verificación de no regresión).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencia de tareas incompletas).
- **[Story]**: US1 / US2 / US3. Setup, Foundational y Polish no llevan etiqueta.
- Cada descripción lleva las rutas exactas de los archivos que escribe (`writes:`).

## Ficheros intocables (FR-021 — solo lectura, PROHIBIDO en cualquier `writes`)

| Fichero | Motivo |
|---|---|
| `src/Infrastructure/specs/WorkspacePage.spec.tsx` | suite protegida de la página |
| `src/Infrastructure/specs/WorkspacePage.perf.spec.tsx` | suite protegida de rendimiento |
| `src/Domains/Graph/Hooks/specs/useGraphEnrichment.spec.tsx` | suite protegida del enriquecimiento |
| `src/Domains/Graph/Hooks/specs/useGraphEnrichment.freshness.spec.tsx` | suite protegida de frescura/siembra |

Los specs **nuevos** de las piezas puras nuevas **sí** se crean: `src/Infrastructure/lib/specs/` (T005, T006,
T007), `src/Infrastructure/Hooks/specs/` (T008–T013), `src/Infrastructure/Components/specs/` (T015),
`src/Domains/Graph/lib/specs/` (T024, T025, T026) y `src/Infrastructure/specs/integration/` (T017–T023,
T028–T030).

## Unidades y fronteras (base de las tareas E2E)

Unidades del refactor: **U1**=`Infrastructure/lib` (puros), **U2**=`Infrastructure/Hooks` (orquestación),
**U3**=`Infrastructure/Components` (`WorkspaceView` + panes), **U4**=`Domains/Chat`, **U5**=`Domains/Sessions`,
**U6**=`Domains/Graph`, **U7**=`Domains/Inspector`, **U8**=`Domains/History`.

Toda cadena de estado de `contracts/` que cruza dos unidades tiene **un dueño E2E** con caso negativo
(dato inexistente / 404). Ninguna frontera queda sin dueño:

| Frontera | Cadena de estado (contracts) | Dueño E2E | Caso negativo |
|---|---|---|---|
| U1 ↔ U2 | `countAttentionByRoot` → `useAttentionByRoot` | T018 | raíz sin permisos ⇒ `0`; `openRootId=null` |
| U2 ↔ U3 | hooks → `WorkspaceView` (5 slots + `panel` + `attentionCount`) | T023 | sin `?id` ⇒ slot `chat` `null`, resto montado |
| U2 ↔ U4 | `permissions.list()`/`for(id)` + `sessions.forms(id)` → bandeja | T017 | `FormDetail.state ≠ 'pending'` y sesión fuera del subárbol ⇒ sin ítem |
| U2 ↔ U4 | `useChatSelectionSeed` → `useChatController` | T020 | sesión sin nodo ⇒ `{agent:null, model:null}` = "no cambiar" |
| U2 ↔ U5 | `items` de `useRootSessions` + permisos → badge del rail | T018 | raíz ausente de `counts` ⇒ sin badge |
| U2 ↔ U6 | `useAttentionNodeIds` → realce del grafo | T019 | `nodeId === null` ⇒ no realza nada |
| U2 ↔ U3/U6 | `Escape` → fullscreen / `clearSelection` | T021 | foco en el chat ⇒ no propaga ni cierra ni limpia |
| U2 ↔ U7/U8 | `useHistoryData` → `HistoryOverlay` (questions/context/`missingId`) | T022 | `targetId` inexistente ⇒ `missingId` (404) + `clearMissing` |
| U6 ↔ U2/U4/U7 | siembra (`permissions.for`, `sessions.forms`+`FormDetail`, `sessions.messages`) → consumidores | T028 | lote sin caché ⇒ nodo sigue `pending` y bandeja sin ítem |
| U6 ↔ U3 | modelo enriquecido → `GraphPane`/`InspectorPane` | T029 | nodo no-ready conserva referencia; `ready` no se degrada |
| U6 ↔ U5 | `useGetSessionStatus` + `sessions.execution(id)` → nodo | T030 | sesión inexistente ⇒ sin estado, sin romper el enriquecimiento |

---

## Phase 1: Setup (línea base de no regresión)

**Purpose**: fijar el verde de partida antes de tocar código, para poder comparar la no regresión
(SC-001/SC-004). Sin esta fase no hay prueba de que el refactor no cambió nada.

- [X] T001 Ejecutar la línea base completa de pruebas y registrarla con archivos + nº de tests + duración:
  `pnpm test` (suite completa) y las 4 suites protegidas por separado (`pnpm test -- WorkspacePage.spec`,
  `pnpm test -- WorkspacePage.perf.spec`, `pnpm test -- useGraphEnrichment.spec`,
  `pnpm test -- useGraphEnrichment.freshness.spec`); crear
  `specs/012-refactor-workspace-enrichment/baseline.md` con una tabla (suite, fichero, nº tests, duración,
  verde/rojo) y el `git rev-parse HEAD` de partida. `writes: specs/012-refactor-workspace-enrichment/baseline.md`
- [X] T002 Fijar la línea base de compuertas y de alcance y anexarla a `baseline.md`: `pnpm tsc`,
  `pnpm tsc:node`, `pnpm lint` (0 errores, 0 warnings), `git status --short` y
  `git diff --name-only -- src/Infrastructure/specs src/Domains/Graph/Hooks/specs` (debe salir vacío);
  registrar además los `sha256` de los 4 specs protegidos para el arbitraje de T031.
  `writes: specs/012-refactor-workspace-enrichment/baseline.md` (depende de T001: mismo fichero)

**Checkpoint**: baseline verde y firmada; recién ahora se puede empezar a tocar código.

---

## Phase 2: Foundational (prerrequisitos bloqueantes de las dos historias)

**Purpose**: andamiaje compartido que necesitan tanto las piezas de U1 (specs puros de Infrastructure) como
las tareas E2E de las dos fronteras de historia.

**⚠️ CRITICAL**: ninguna historia (US1/US2) puede empezar hasta completar esta fase.

- [X] T003 Crear el arnés compartido de integración `src/Infrastructure/specs/integration/harness.tsx`:
  helpers de `renderWithProviders`, sembrado de caché (`seedSessions`, `seedPermissions`,
  `seedForms`, `seedExecution`) y utilidades de mock por barrel (`@app/Domains/Graph`,
  `@app/Domains/Chat`, `@app/Domains/Sessions`, `@app/Domains/Inspector`, `@app/Domains/History`) reutilizables
  por T017–T023 y T028–T030. El fichero **no** es `*.spec.tsx` (Vitest no lo recolecta como suite).
  `writes: src/Infrastructure/specs/integration/harness.tsx`
- [X] T004 [P] Crear los fixtures puros compartidos `src/Infrastructure/lib/specs/fixtures.ts`
  (constructores deterministas de `PermissionRequest`, `FormInfo`, `FormDetail` y `TAttentionItem` con
  `sessionID`/`id` explícitos) usados por T005, T006, T007 y T008–T013.
  `writes: src/Infrastructure/lib/specs/fixtures.ts`

**Checkpoint**: arnés + fixtures listos; US1 y US2 arrancan en paralelo.

---

## Phase 3: User Story 1 - Vista de workspace descompuesta, comportamiento idéntico (Priority: P1) 🎯 MVP

**Goal**: la página deja de construir JSX y de contener lógica; los cinco slots viven en **un** componente
presentacional `WorkspaceView.tsx` y toda la lógica cross-domain/`Escape`/derivaciones vive en hooks de
`Infrastructure/Hooks`, con los cálculos puros en `Infrastructure/lib`.

**Independent Test**: `pnpm test -- WorkspacePage` y `pnpm test -- WorkspacePage.perf` pasan **sin editar**
`src/Infrastructure/specs/WorkspacePage.spec.tsx` ni `WorkspacePage.perf.spec.tsx`; `git diff --name-only
-- src/Infrastructure/specs` vacío.

### Piezas puras nuevas (U1) — `FR-005/FR-007/FR-009`

- [X] T005 [P] [US1] Crear la pieza pura movida `src/Infrastructure/lib/countAttentionByRoot.ts`
  (`countAttentionByRoot(roots, permissions, openRootId, openSubtreeSessionIds, openQuestionCount)`, misma
  firma y mismo valor que hoy, sin mutar entradas; `countAttentionByRoot` deja de exportarse desde
  `WorkspacePage.tsx`) y su spec `src/Infrastructure/lib/specs/countAttentionByRoot.spec.ts` (raíz abierta
  suma el subárbol; el resto solo su sesión; `+openQuestionCount` en la abierta; entradas no mutadas).
  `writes: src/Infrastructure/lib/countAttentionByRoot.ts, src/Infrastructure/lib/specs/countAttentionByRoot.spec.ts`
- [X] T006 [P] [US1] Extraer la proyección pura `src/Infrastructure/lib/toPendingQuestionEntry.ts`
  (`FormInfo → TQuestionEntry`: `state: 'pending'`, `answer: null`, `options` solo en `string`/`multiselect`)
  con su spec `src/Infrastructure/lib/specs/toPendingQuestionEntry.spec.ts`.
  `writes: src/Infrastructure/lib/toPendingQuestionEntry.ts, src/Infrastructure/lib/specs/toPendingQuestionEntry.spec.ts`
- [X] T007 [P] [US1] Extraer el predicado puro y el selector `src/Infrastructure/lib/isFocusWithinChat.ts`
  (`CHAT_PANEL_SELECTOR = '[data-testid="chat-panel"]'`, `isFocusWithinChat()` vía
  `document.activeElement?.closest(...)`) con su spec `src/Infrastructure/lib/specs/isFocusWithinChat.spec.ts`
  (dentro ⇒ `true`; fuera y `activeElement === null` ⇒ `false`).
  `writes: src/Infrastructure/lib/isFocusWithinChat.ts, src/Infrastructure/lib/specs/isFocusWithinChat.spec.ts`

### Hooks de la página (U2) — `FR-006/FR-007/FR-008/FR-009/FR-010`

- [X] T008 [P] [US1] Crear `src/Infrastructure/Hooks/useChatPending.ts` (`useChatPending(attention, nodes)`:
  `permissions.list()` por `useQuery` —`staleTime: Infinity`, `initialData: []`, `queryFn` que lee caché—,
  semillas `permissions.for(sessionId)`, preguntas accionables del subárbol desde `sessions.forms(sessionId)`,
  respeto de `FormDetail.state !== 'pending'`, dedupe `permission:<id>` / `question:<formId>`; mismas claves de
  dependencia que el `useMemo` que reemplaza) + `src/Infrastructure/Hooks/specs/useChatPending.spec.tsx`.
  `writes: src/Infrastructure/Hooks/useChatPending.ts, src/Infrastructure/Hooks/specs/useChatPending.spec.tsx`
- [X] T009 [P] [US1] Crear `src/Infrastructure/Hooks/useAttentionNodeIds.ts` (de `attention`, `nodeId !== null`;
  memo por identidad de `attention`) + `src/Infrastructure/Hooks/specs/useAttentionNodeIds.spec.tsx`.
  `writes: src/Infrastructure/Hooks/useAttentionNodeIds.ts, src/Infrastructure/Hooks/specs/useAttentionNodeIds.spec.tsx`
- [X] T010 [P] [US1] Crear `src/Infrastructure/Hooks/useAttentionByRoot.ts` (envoltorio memoizado de
  `countAttentionByRoot` con las mismas dependencias: `items`, `listedPermissions`, `id`, `graph.nodes`,
  `attention`) + `src/Infrastructure/Hooks/specs/useAttentionByRoot.spec.tsx`.
  `writes: src/Infrastructure/Hooks/useAttentionByRoot.ts, src/Infrastructure/Hooks/specs/useAttentionByRoot.spec.tsx`
- [X] T011 [P] [US1] Crear `src/Infrastructure/Hooks/useChatSelectionSeed.ts`
  (`{ nodes, sessionId }` → `{ agent, model }` del nodo con `data.sessionId === sessionId`; sin nodo ⇒
  `{ agent: null, model: null }` = "no cambiar"; memo por `nodes`+`sessionId`) +
  `src/Infrastructure/Hooks/specs/useChatSelectionSeed.spec.tsx`.
  `writes: src/Infrastructure/Hooks/useChatSelectionSeed.ts, src/Infrastructure/Hooks/specs/useChatSelectionSeed.spec.tsx`
- [X] T012 [P] [US1] Crear `src/Infrastructure/Hooks/useWorkspaceEscape.ts`
  (`{ isFullscreen, closeFullscreen, clearSelection, selectedNodeId }`; orden foco-chat → fullscreen →
  selección y `useEscapeKey(handler, isFullscreen || selectedNodeId !== null)`; una sola fuente con
  `isFocusWithinChat`) + `src/Infrastructure/Hooks/specs/useWorkspaceEscape.spec.tsx`.
  `writes: src/Infrastructure/Hooks/useWorkspaceEscape.ts, src/Infrastructure/Hooks/specs/useWorkspaceEscape.spec.tsx`
- [X] T013 [P] [US1] Crear `src/Infrastructure/Hooks/useHistoryData.ts` (compone `useHistoryOverlay` +
  `useSessionForms(sessionIdForForms)` + `useSessionContext(sessionIdForForms)` y devuelve
  `{ node, lineage, missingId, clearMissing, questions, context }`, misma composición que hoy) +
  `src/Infrastructure/Hooks/specs/useHistoryData.spec.tsx`.
  `writes: src/Infrastructure/Hooks/useHistoryData.ts, src/Infrastructure/Hooks/specs/useHistoryData.spec.tsx`

### Componente de vista y página (U3) — `FR-005/FR-023`

- [X] T014 [US1] Crear el componente presentacional `src/Infrastructure/Components/WorkspaceView.tsx`
  (sin lógica de datos): recibe los cinco slots ya construidos (`sessions`, `graph`, `inspector`, `chat`,
  `history`) + `panel` + `attentionCount` + `isMobile`/`tab`/`onChangeTab`, y compone
  `WorkspaceChatAttentionContext.Provider` + `WorkspaceLayout` con las mismas props y los mismos
  `data-testid` que hoy; ≤150 líneas. Depende de T005–T013.
  `writes: src/Infrastructure/Components/WorkspaceView.tsx`
- [X] T015 [US1] Crear `src/Infrastructure/Components/specs/WorkspaceView.spec.tsx`: renderiza el componente
  con slots de prueba y verifica los cinco slots, el `Provider` con `attentionCount`, el layout móvil/escritorio
  y que los slots `null` (sin sesión) no rompen. Depende de T014.
  `writes: src/Infrastructure/Components/specs/WorkspaceView.spec.tsx`
- [X] T016 [US1] Reescribir `src/Infrastructure/WorkspacePage.tsx` (500 → ~110 líneas) para que sea solo
  composición: consume T008–T013 + `useInspectorPanel`/`useDetailTabs`/`useSessionOpenPerf`/
  `useWorkspaceSummary`/`useChainSelection`/`useGraphModel`, construye los cinco slots y renderiza
  `WorkspaceView`; **elimina** la exportación `countAttentionByRoot` y las funciones privadas movidas, sin
  cambiar `data-testid`, copy, rutas ni `queryKeys`. Depende de T014.
  `writes: src/Infrastructure/WorkspacePage.tsx`

### Integración E2E de fronteras de US1 (una por frontera, con caso negativo)

- [X] T017 [P] [US1] E2E frontera U2↔U4 — bandeja de pendientes: montar `WorkspacePage` con caché sembrada
  (`permissions.list()`, `permissions.for(id)`, `sessions.forms(id)` + `FormDetail`) y comprobar `chat-pending-tray`
  con permiso y pregunta del subárbol (origen y acción correctos) **y** el caso negativo: `FormDetail` con
  `state !== 'pending'`, permiso de una sesión fuera del subárbol y claves ausentes ⇒ sin ítem y sin error.
  `writes: src/Infrastructure/specs/integration/workspaceChatPending.integration.spec.tsx`
- [X] T018 [P] [US1] E2E frontera U1↔U2↔U5 — atención por raíz del rail: `countAttentionByRoot` →
  `useAttentionByRoot` → `SessionsRail.attentionByRoot` con raíz abierta (subárbol + preguntas) y otra raíz
  (solo su sesión); caso negativo: raíz sin permisos ⇒ cuenta `0`, `openRootId === null` ⇒ sin `+preguntas`,
  y raíz ausente de `counts` ⇒ sin badge.
  `writes: src/Infrastructure/specs/integration/workspaceAttentionByRoot.integration.spec.tsx`
- [X] T019 [P] [US1] E2E frontera U2↔U6 — realce por nodo: `useSessionAttention` (U4, entrada `graph.graph`)
  → `useAttentionNodeIds` → `GraphPane.attentionNodeIds` hasta el nodo del grafo; caso negativo: ítem con
  `nodeId === null` ⇒ conjunto vacío y ningún nodo realzado (y sin re-layout).
  `writes: src/Infrastructure/specs/integration/workspaceAttentionNodeIds.integration.spec.tsx`
- [X] T020 [P] [US1] E2E frontera U2↔U4 — semilla de selección: `useChatSelectionSeed` → `ChatPanel.selectionSeed`
  → `useChatController`; caso negativo (404 de dato inexistente): sesión sin nodo en el grafo ⇒
  `{ agent: null, model: null }` y los `switch*` no se aplican ("no cambiar").
  `writes: src/Infrastructure/specs/integration/workspaceChatSelectionSeed.integration.spec.tsx`
- [X] T021 [P] [US1] E2E frontera U2↔U3/U6 — precedencia de `Escape`: foco fuera del chat con fullscreen y con
  selección ⇒ cierra fullscreen primero y limpia la selección después; caso negativo: foco dentro de
  `[data-testid="chat-panel"]` ⇒ no propaga (no cierra fullscreen, no limpia selección) y sin fullscreen ni
  selección ⇒ listener inactivo.
  `writes: src/Infrastructure/specs/integration/workspaceEscape.integration.spec.tsx`
- [X] T022 [P] [US1] E2E frontera U2↔U7/U8 — datos del histórico: `useHistoryData` → `HistoryOverlay` con
  `node`/`lineage`/`questions`/`context` de una sesión del grafo; caso negativo: `targetId` inexistente ⇒
  `missingId` (equivale al 404 de la sesión) + `clearMissing` lo limpia, sin `questions` ni `context`.
  `writes: src/Infrastructure/specs/integration/workspaceHistoryData.integration.spec.tsx`
- [X] T023 [P] [US1] E2E frontera U2↔U3 — cableado de la vista: los cinco slots construidos por los hooks
  llegan a `WorkspaceView` con sus mismas props/`data-testid` y el `attentionCount` correcto; caso negativo
  (dato inexistente): sin `?id`/sesión ⇒ slot `chat` `null` y el resto de slots montados, sin estados de error
  forzados.
  `writes: src/Infrastructure/specs/integration/workspaceViewWiring.integration.spec.tsx`

**Checkpoint**: US1 completa y verificable por sí sola (MVP). Las 4 suites protegidas siguen verdes sin editarse.

---

## Phase 4: User Story 2 - Enriquecimiento del grafo en piezas puras verificables (Priority: P2)

**Goal**: `useGraphEnrichment.ts` delega nodos listos, medianas por agente y fusión de nodos en
`src/Domains/Graph/lib/`, conservando lotes por idle, cancelación por cambio de plan y "lo vivo gana sobre la
siembra"; el path y las firmas exportadas del hook **no cambian**.

**Independent Test**: `pnpm test -- readyNodeIds`, `-- agentLatencyMedians`, `-- mergeEnrichedNodes` y
`pnpm test -- useGraphEnrichment` verdes, con `useGraphEnrichment.spec.tsx` y `.freshness.spec.tsx` sin editar
(`git diff --name-only -- src/Domains/Graph/Hooks/specs` vacío).

### Piezas puras nuevas (U6) — `FR-011/FR-012/FR-013`

- [X] T024 [P] [US2] Crear `src/Domains/Graph/lib/readyNodeIds.ts`
  (`collectReadyIds(ids, enriched, hasMessages) → Set<string>`, nuevo `Set`, sin consultas) y su spec
  `src/Domains/Graph/lib/specs/readyNodeIds.spec.ts` (id cacheado no se repite; `enriched` se une; el
  predicado se invoca sin abrir consulta).
  `writes: src/Domains/Graph/lib/readyNodeIds.ts, src/Domains/Graph/lib/specs/readyNodeIds.spec.ts`
- [X] T025 [P] [US2] Crear `src/Domains/Graph/lib/agentLatencyMedians.ts`
  (`deriveAgentMedians(entries) → Record<string, number | null>`, reutilizando `deriveLatency` + `median` de
  `lib/metrics/latency.ts`, sin reimplementarlas) y su spec
  `src/Domains/Graph/lib/specs/agentLatencyMedians.spec.ts` (mediana por agente; `totalMs` nulos ignorados;
  agente sin muestras ⇒ `null`).
  `writes: src/Domains/Graph/lib/agentLatencyMedians.ts, src/Domains/Graph/lib/specs/agentLatencyMedians.spec.ts`
- [X] T026 [P] [US2] Crear `src/Domains/Graph/lib/mergeEnrichedNodes.ts`
  (`mergeEnrichedNodes(structure, readyIds, buildNodeData) → TGraphModel`: solo `readyIds.has(id)` cambia `data`,
  `edges` por referencia, sin mutar) y su spec `src/Domains/Graph/lib/specs/mergeEnrichedNodes.spec.ts` (nodo
  no-ready conserva referencia; ready cambia `data`; entrada no mutada; `edges` idénticas).
  `writes: src/Domains/Graph/lib/mergeEnrichedNodes.ts, src/Domains/Graph/lib/specs/mergeEnrichedNodes.spec.ts`

### Refactor del hook (U6) — `FR-016/FR-018/FR-019`

- [X] T027 [US2] Refactorizar `src/Domains/Graph/Hooks/useGraphEnrichment.ts` (255 → ~130 líneas) para
  consumir T024/T025/T026 conservando **literalmente** el estado `progress`/`signature`, `EMPTY_IDS`, el
  `useEffect` de un lote por turno de `scheduleIdle` con cancelación al cambiar el plan, el reloj estable, el
  memo de salida y las firmas exportadas `useGraphEnrichment` y `useInvocationBatches` (el path
  `Hooks/useGraphEnrichment.ts` es contrato: los specs importan `'../useGraphEnrichment'`). Depende de T024–T026.
  `writes: src/Domains/Graph/Hooks/useGraphEnrichment.ts`

### Integración E2E de fronteras de US2 (una por frontera, con caso negativo)

- [X] T028 [P] [US2] E2E frontera U6↔U2/U4/U7 — siembra → consumo: con caché vacía, dejar correr los lotes de
  idle y comprobar que lo escrito en `sessions.messages(id)`, `permissions.for(id)`, `sessions.forms(id)` (+
  `FormDetail`) y `sessions.execution(id)` llega a los consumidores (`useChatPending` ⇒ ítem en la bandeja;
  `useHistoryData` ⇒ `questions`); caso negativo (dato inexistente / fallo de red): lote que no escribe caché ⇒
  el nodo permanece `pending` y la bandeja no inventa ítem, sin bloquear el resto.
  `writes: src/Infrastructure/specs/integration/enrichmentSeeding.integration.spec.tsx`
- [X] T029 [P] [US2] E2E frontera U6↔U3 — modelo enriquecido → vista: el `TGraphModel` de
  `useGraphEnrichment` (vía `useGraphModel`) llega a `GraphPane`/`InspectorPane` con `enrichment: 'ready'` y
  `edges` idénticas; caso negativo: nodo sin mensajes conserva la referencia previa y `ready` **no** se degrada
  a `pending`.
  `writes: src/Infrastructure/specs/integration/enrichmentModelToView.integration.spec.tsx`
- [X] T030 [P] [US2] E2E frontera U6↔U5 — estado de sesión → nodo: `useGetSessionStatus` (Sessions) +
  `sessions.execution(id)` alimentan `enrichNodeData`; caso negativo (dato inexistente/404): sesión sin estado ni
  señal ⇒ el nodo se enriquece sin romper (sin señal y sin mediana de agente de referencia), sin degradar
  `enrichment`.
  `writes: src/Infrastructure/specs/integration/enrichmentSessionStatus.integration.spec.tsx`

**Checkpoint**: US1 y US2 funcionan de forma independiente; ninguna frontera entre U1–U8 sin dueño E2E.

---

## Phase 5: User Story 3 - Verificación de no regresión del refactor (Priority: P3)

**Goal**: probar, sin leer el diff completo, que el refactor no alteró nada observable ni tocó archivos fuera
de alcance.

**Independent Test**: compuertas de calidad en verde con los mismos conteos que `baseline.md` y diff de specs
protegidos vacío.

- [X] T031 [US3] Ejecutar las 4 suites protegidas y comparar contra `baseline.md`:
  `pnpm test -- WorkspacePage.spec`, `-- WorkspacePage.perf.spec`, `-- useGraphEnrichment.spec`,
  `-- useGraphEnrichment.freshness.spec`, más `git diff --name-only -- src/Infrastructure/specs
  src/Domains/Graph/Hooks/specs` (vacío) y `shasum -a 256` de los 4 ficheros igual a los de T002; crear
  `specs/012-refactor-workspace-enrichment/verification.md` con la tabla comparativa (nº tests y duración
  baseline vs. actual, SC-001).
  `writes: specs/012-refactor-workspace-enrichment/verification.md`
- [X] T032 [US3] Ejecutar las compuertas completas `pnpm tsc && pnpm tsc:node && pnpm lint && pnpm test` y
  anexar a `verification.md` el resultado (0 errores, sin warnings nuevos) con el nº total de tests y la
  duración comparados con `baseline.md` (FR-022/SC-004). Depende de T031 (mismo fichero).
  `writes: specs/012-refactor-workspace-enrichment/verification.md`
- [X] T033 [US3] Auditar el alcance: `git status --short` y `git diff --name-only HEAD~1...HEAD` (o `main...HEAD`)
  deben contener solo `src/Infrastructure/WorkspacePage.tsx`, los vecinos nuevos de
  `src/Infrastructure/{Components,Hooks,lib,specs}/`, `src/Domains/Graph/{Hooks,lib}/` con sus `specs/`, y
  `specs/012-refactor-workspace-enrichment/**`; anexar la lista y el veredicto (0 archivos ajenos, SC-005) a
  `verification.md`. Depende de T032 (mismo fichero).
  `writes: specs/012-refactor-workspace-enrichment/verification.md`

**Checkpoint**: no regresión demostrada con evidencia comparable contra la línea base.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: cierre de la superficie congelada y de las restricciones del plan (`≤150` líneas, FR-023).

- [X] T034 Verificar la superficie congelada de `contracts/workspace-public-contract.md` por inspección de los
  ficheros nuevos: exports y firmas (`WorkspacePage`, `useGraphEnrichment`, `useInvocationBatches`), formas de
  props de `SessionsRail`/`GraphPane`/`InspectorPane`/`HistoryOverlay`/`ChatPanel`/`WorkspaceLayout`, los
  `data-testid` (§3), rutas y `queryKeys` (§4) sin claves nuevas ni renombradas; anexar el checklist a
  `verification.md` (FR-001/FR-002/SC-002). Sin cambios de código esperados.
  `writes: specs/012-refactor-workspace-enrichment/verification.md`
- [X] T035 Auditar tamaño y no duplicación: `wc -l` de cada fichero nuevo (≤150 líneas) y comprobación de que
  no se reimplementan `deriveLatency`/`median`/`enrichNodeData`/`mergeExecutionSignals` ni se crean componentes
  genéricos dentro de un dominio; anexar el resultado a `verification.md` (FR-023/SC-006).
  `writes: specs/012-refactor-workspace-enrichment/verification.md`
- [X] T036 Correr [quickstart.md](./quickstart.md) §0–§6 completa (incluidos los `pnpm test -- <pieza>` de §3 y
  §4) y registrar el veredicto final SC-001…SC-006 en `verification.md`.
  `writes: specs/012-refactor-workspace-enrichment/verification.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; T002 depende de T001 (mismo `baseline.md`).
- **Foundational (Phase 2)**: depende de Setup; **bloquea** US1 y US2. T003 y T004 son paralelos.
- **US1 (Phase 3)** y **US2 (Phase 4)**: dependen de Foundational; son independientes entre sí (US1 toca
  `Infrastructure/**`, US2 toca `Domains/Graph/lib` + `useGraphEnrichment.ts`).
- **US3 (Phase 5)**: depende de US1 + US2 (verifica el árbol completo); T031 → T032 → T033 por compartir
  `verification.md`.
- **Polish (Phase 6)**: depende de US3; T034 → T035 → T036 por compartir `verification.md`.

### Dentro de cada historia

- US1: puros (T005–T007) y hooks (T008–T013) en paralelo → `WorkspaceView` (T014) → su spec (T015) → página
  (T016) → E2E (T017–T023, en paralelo entre sí; todos dependen de T016 para el montaje completo).
- US2: puros (T024–T026) en paralelo → hook (T027, depende de los tres) → E2E (T028–T030, en paralelo).

### Ficheros compartidos (por eso NO llevan `[P]`)

- `specs/012-refactor-workspace-enrichment/baseline.md`: T001, T002.
- `specs/012-refactor-workspace-enrichment/verification.md`: T031, T032, T033, T034, T035, T036.
- `src/Infrastructure/WorkspacePage.tsx`: solo T016.
- `src/Domains/Graph/Hooks/useGraphEnrichment.ts`: solo T027.

---

## Parallel Example: User Story 1

```bash
# Piezas puras + hooks (13 tareas [P], 26 ficheros nuevos sin solape) en un solo lote:
Task: "T005 countAttentionByRoot.ts + spec en src/Infrastructure/lib/specs/"
Task: "T006 toPendingQuestionEntry.ts + spec en src/Infrastructure/lib/specs/"
Task: "T007 isFocusWithinChat.ts + spec en src/Infrastructure/lib/specs/"
Task: "T008 useChatPending.ts + spec en src/Infrastructure/Hooks/specs/"
Task: "T012 useWorkspaceEscape.ts + spec en src/Infrastructure/Hooks/specs/"

# Tras T016, las 7 fronteras E2E en paralelo (7 ficheros nuevos):
Task: "T017 workspaceChatPending.integration.spec.tsx"
Task: "T021 workspaceEscape.integration.spec.tsx"
Task: "T023 workspaceViewWiring.integration.spec.tsx"
```

## Parallel Example: User Story 2

```bash
# T024, T025, T026 en paralelo (6 ficheros nuevos, sin solape):
Task: "T024 readyNodeIds.ts + spec en src/Domains/Graph/lib/specs/"
Task: "T025 agentLatencyMedians.ts + spec en src/Domains/Graph/lib/specs/"
Task: "T026 mergeEnrichedNodes.ts + spec en src/Domains/Graph/lib/specs/"
# Luego T027 (único dueño de useGraphEnrichment.ts) y en paralelo T028/T029/T030.
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (T001–T002): línea base registrada.
2. Phase 2 (T003–T004): arnés y fixtures.
3. Phase 3 (T005–T023): US1 completa.
4. **STOP & VALIDATE**: `pnpm test -- WorkspacePage` + `-- WorkspacePage.perf` verdes sin editar el spec
   protegido; `git diff --name-only -- src/Infrastructure/specs` vacío.
5. US1 es el incremento entregable: la mitad de mayor riesgo observable del refactor.

### Incremental Delivery

1. Setup + Foundational → andamiaje listo.
2. US1 → validar → la vista queda descompuesta con comportamiento idéntico (MVP).
3. US2 → validar → el enriquecimiento queda en piezas puras con specs propios.
4. US3 + Polish → compuertas en verde, alcance auditado, veredicto SC-001…SC-006 registrado.

### Notas

- Ninguna tarea escribe los 4 ficheros protegidos; T031/T002 los verifican por `git diff` y `sha256`.
- Los specs nuevos nunca importan por deep-import entre dominios: se usan los barrel (`@app/Domains/*`) para no
  romper los `vi.mock` de las suites protegidas (research D7).
- Commit por tarea o grupo lógico con Conventional Commits (`refactor(workspace|graph): …`).

---

## Phase 7: Convergence

**Assessed**: 2026-10-13 · `spec.md` + `plan.md` + `tasks.md` (36 tareas) contra el árbol implementado.
El código satisface la spec/plan/tasks: 36 tareas implementadas, compuertas en verde, specs protegidos
intactos y ninguna frontera de `contracts/` sin dueño E2E. Las tres tareas siguientes cierran **registros de
verificación** (`verification.md`) y alinean `contracts/` con las desviaciones documentadas (C2); ninguna
toca `src/`.

- [X] T037 Completar en `verification.md` el checklist de la superficie congelada de
  `contracts/workspace-public-contract.md` §1–§4 (exports/firmas, formas de props, `data-testid`, rutas y
  `queryKeys` sin claves nuevas ni renombradas) por inspección de los ficheros nuevos, per
  FR-001/FR-002/SC-002 (partial) — cierra T034, que quedó sin anexar.
- [X] T038 Correr `quickstart.md` §0–§6 (incluidos los `pnpm test -- <pieza>` de §3 y §4) y registrar en
  `verification.md` el veredicto final SC-001…SC-006, per SC-001…SC-006 (partial) — cierra T036, que quedó sin
  anexar.
- [X] T039 Alinear `contracts/enrichment-pure-api.md` §2 con C2: `sessionIdForForms` de `useHistoryData` es
  **opcional** (`?: string | null`) y por defecto se deriva de `node.data.sessionId ?? null`, per
  contracts §2 / FR-010 (partial). Sin cambio de código. F2 (`useSessionAttention.ts`) queda fuera de alcance
  y a decisión del usuario.
