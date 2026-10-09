# Plan de refactor priorizado y ejecutable

> Consolidación de los 7 documentos de `docs/proposals/areas/01..07-*.md` y del
> `docs/proposals/inventario-gordos.md` en un plan de tandas **sin conflictos de
> archivos**. Solo lectura + propuesta: **no se modifica código de producto**.

## Método y convenciones de puntuación

- **Escala**: H = 3 · M = 2 · L = 1. `Ratio impacto/esfuerzo = Impacto / Esfuerzo`.
- **Impacto**: reducción de líneas del archivo origen (≥60 % = H, 30–60 % = M,
  <30 % = L) **+** reutilización cross-dominio (≥3 consumidores o cierre de una
  familia de duplicación = H, 2 = M, 1 = L).
- **Esfuerzo**: nº de piezas y acoplamiento → S (1–2 piezas, acoplamiento bajo),
  M (3–5), L (≥6 o dispatch/contrato delicado).
- **Riesgo**: acoplamiento a specs/contratos observables → L (tipos/puros,
  barrel-compatible), M (specs que assertean texto/DOM, pero sin cambio de
  contrato público), H (specs de perf/estabilidad, StrictMode/SSE, contratos FR).
- **Desempate**: a igual ratio, primero el riesgo más bajo.
- **Supuesto de ejecución (barrels)**: los `index.ts` y `queryKeys.ts` son puntos
  de registro *append-only*; las tandas garantizan disjunción estricta sobre los
  **archivos de código con lógica** (`.ts`/`.tsx` no-barrel). Los appends a
  barrels se consolidan por dominio dentro de la tanda y no generan conflicto real.
- **Módulos compartidos entre acciones**: los módulos puros consumidos por más de
  una acción se crean en la **Tanda 1** (fase de fundaciones). Los módulos internos
  de una sola acción se crean dentro de la tanda de esa acción.

---

## Tabla maestra de acciones

### A. Transversales — piezas compartidas (`SH-*`)

| ID | Acción (piezas extraídas) | Origen (líneas) | Destino | Antes → Después |
|---|---|---|---|---|
| **SH-01** | `totalTokens` (Familia 5) | `AgentNode` (34-40), `HistoryHeader` (37-43), `SessionSummaryBar` (25-31) | `Application/Helpers/totalTokens.ts` | 3 copias → 1 helper |
| **SH-02** | `useNow` unificado (firma por opciones) + `DEFAULT_NOW_INTERVAL_MS` | `Sessions/Hooks/useNow.ts` (48) + `Graph/Hooks/useNow.ts` (49) | `Application/Hooks/useNow.ts` | 97 → 40 · **−2 archivos** |
| **SH-03** | `NODE_STATUS_COLOR` (Familia 1) | `StatusDot.STATUS_COLOR`, `NodeStatusRail.RAIL_COLOR`, `ExecutionLanes.STATUS_DOT` | `Application/Helpers/nodeStatusColor.ts` | 3 mapas → 1 |
| **SH-04** | `OUTCOME_LABEL` + `TOutcome` (Familias 2 y 8) | `HistoryHeader.OUTCOME_LABEL`, `HistoryEntry.IDLE_LABEL`, `History.entity.TIdleOutcome`, `Graph.entity`/`nodeStatus` | `Application/Helpers/outcomeLabel.ts` | 2 copias + unión suelta → 1 |
| **SH-05** | `QUESTION_STATE_LABEL/COLOR` + `QuestionStateBadge` (Familia 3) | `HistoryEntry` (103-112), `QuestionsSection` (22-31) | `Application/Entities/questionState.ts` + `Molecules/QuestionStateBadge.tsx` | 2 pares → 1 par |
| **SH-06** | `TOOL_STATUS_LABEL/COLOR` + `ToolStatusBadge` (Familia 4) | `ToolCallEntry` (25), `ToolHistory` (14) | `Application/Entities/toolStatus.ts` + `Molecules/ToolStatusBadge.tsx` | 2 mapas → 1 |
| **SH-07** | Tipos de pregunta compartidos (Familia 6) | `History.entity` (`THistoryQuestion*`), `Inspector.entity` (`TQuestion*`) | `Application/Entities/question.ts` | 2 definiciones → 1 |
| **SH-08** | `executionSignal` (`EMPTY_EXECUTION_SIGNAL`, `normalizeSignal`, `mergeExecutionSignals`, `sameExecutionSignal`) (Familia 7) | `useExecutionSignals` (10), `eventReducer.EMPTY_SIGNAL` (212) | `Graph/lib/executionSignal.ts` | 2 literales + merge repartido → 1 |
| **SH-09** | `formatModelRef` | `HistoryEntry.formatModel`, `HistoryHeader` (84), `ModelSection` (27), `AgentNode` (159), `cardHeight` (51) | `Application/Helpers/formatModelRef.ts` | 5 sitios → 1 |
| **SH-10** | Constantes `UNAVAILABLE` / `UNAVAILABLE_LABEL` + export `formatClock` | `formatDuration.ts`, `formatTokens.ts`, `formatCost.ts`, `formatTimeRange.ts`, `AgentNode` (25,28-33) | `Application/Helpers/format/constants.ts` + export en `formatTimeRange.ts` | dependencia cruzada + 2 copias → 1 |
| **SH-11** | `sameQueryKey` | `eventReducer`, `useExecutionSignals.sameKey` (+ specs, sin tocar) | `Application/Helpers/queryKey.ts` | 2 copias prod → 1 |
| **SH-12** | `chunkArray<T>` + `sumNullable` | `loadPriority.chunkLoadPlan`, `deriveMetrics.sumNullable` | `Application/Helpers/array.ts` + `Helpers/number.ts` | 2 helpers genéricos → 2 |
| **SH-13** | `SectionHeading`, `DetailRow`, `DetailListRow`, `ListSkeleton`, `Disclosure` | 21 apariciones del `<span text-[11px] uppercase…>` en 12 archivos + filas/skeletons del Inspector | `Application/Components/Molecules/*` | andamiaje repetido → 5 moléculas |
| **SH-14** | `SectionFrame` (error→loading→vacío→contenido, Principio VI) | 7 secciones del Inspector | `Molecules/SectionFrame.tsx` | −8/12 líneas por sección |
| **SH-15** | Moléculas pequeñas: `LabeledField`, `InProgressText`, `UnavailableValue`, `NavButton`, `QuestionBlock`, `AttachmentList`, `ResourceRow`, `LabeledSelect`, `MultiSelectFilterPopover` | `ToolCallEntry`, `HistoryEntry`, `SessionSummaryBar`, `HistoryHeader`, `HistoryModal`, `QuestionsSection`, `ResourceList`, `TimeRangeFilter`, `ProjectFilter` | `Molecules/*` | duplicación de bloques JSX |
| **SH-16** | `ALERT_VARIANT_ICON/TITLE/DESCRIPTION` (`TAlertVariant`) + `AlertIconBadge` | `AlertMessage` (2 `cva` + 3 mapas), `Alert.defaultIcons` | `Molecules/alertVariants.ts` + `Molecules/AlertIconBadge.tsx` | 2 mapas sin tipar → 1 tipado |
| **SH-17** | `scheduleIdle(cb)` (rIC + fallback) | `useGraphEnrichment` (scheduling por lotes) | `Application/Helpers/scheduleIdle.ts` | inline → helper puro |
| **SH-18** | `STORE_KEY` (`isMobile`, `backButtonEnabled`) | `useGlobalStore`, `useDevice`, `device.ts`, `Page.tsx` | `Application/Hooks/useGlobalStore.ts` | magic strings → constantes |
| **SH-19** | `buildProjectOptions`, `ALL_PROJECTS_LABEL`, `summarizeProjects`, `timeRangeLabel` | `ProjectFilter` (23-29), `SessionFilterBar` (12,25-29,32-33), `TimeRangeFilter` | `Sessions/lib/projectOptions.ts` + `Sessions/lib/timeRange.ts` | 2 duplicaciones literales → 1 |
| **SH-20** | Recorte de `useURLParams` a superficie usada (`getParam`, `updateParams`) | `useURLParams.ts` (112) | mismo archivo | 112 → ~45 |

### B. Descomposiciones de archivos GORDO (`DC-*`)

| ID | Acción (piezas) | Origen (antes) | Destino (después por pieza) | Antes → Después |
|---|---|---|---|---|
| **DC-01** | eventReducer → `queryUpdates`(40), `eventTypes`(25), `cache`(45), `messageParts`(120), `signals`(20), `permissions`(20), 7 `slices/`(12–85), facade(90) | `Graph/lib/eventReducer.ts` (622) | `Graph/lib/eventReduce/**` + facade | 622 → **max 120** |
| **DC-02** | WorkspacePage → `useSessionOpenPerf`(40), `useWorkspaceSummary`(30), `useHistoryOverlay`(55), `useInspectedNodeContext`(35), `GraphPane`(65), `SessionsRail`(25), `InspectorPane`(30), `HistoryOverlay`(45), `WorkspaceMobileTabs`(40), `WorkspacePage.constants`(15) | `Infrastructure/WorkspacePage.tsx` (413) | `Infrastructure/Hooks/*`, `Infrastructure/Components/*` | 413 → ~90 |
| **DC-03** | buildHistory → `entryBuilders`(~110), `assistantParts`(45), `toolEntry`(40), `normalizeSdkFields`(35), `historyQuestions`(135), facade(50) | `History/lib/buildHistory.ts` (409) | `History/lib/**` + facade | 409 → ~50 |
| **DC-04** | AgentGraph → `ViewportControllers`(34), `useStableGraphModel`(28), `useGraphFocusModel`(30), `useGraphLayoutModel`(110), `useInteractionPerf`(32), `nodeStatusRank`(22), `isGutterNode`(4), `REST_EDGE_STYLE`(6) | `Graph/Components/AgentGraph.tsx` (358) | `Graph/Components/*`, `Graph/Hooks/*`, `Graph/lib/*` | 358 → ~80 |
| **DC-05** | useGraphEnrichment → `executionSignal`(45), `scheduleIdle`(14), `sessionInfoFromNode`(20), `loadNodeContent`(52), `enrichNodeData`(65), `buildEnrichmentPlan`(45) | `Graph/Hooks/useGraphEnrichment.ts` (351) | `Graph/lib/**` | 351 → ~120 |
| **DC-06** | HistoryEntry → `HISTORY_KIND_LABEL`(16), `HISTORY_KIND_STRIPE`(16), `HistoryEntryBody`(40), 9 `bodies/*`(8–35), `InProgressText`, `AttachmentList`, `QuestionBlock`, `formatModelRef`, `OUTCOME_LABEL` | `Application/Components/Organisms/HistoryEntry.tsx` (330) | `Organisms/HistoryEntry/**` + `Application/Helpers/*` | 330 → ~45 |
| **DC-07** | deriveMetrics → `metrics/tokens`(70), `metrics/deriveMetricBase`(110), `metrics/resolveMetrics`(60), `metrics/summarizeSession`(115), facade(15) | `Graph/lib/deriveMetrics.ts` (320) | `Graph/lib/metrics/**` + facade | 320 → max 115 |
| **DC-08** | History.entity → `HistoryQuestion.entity`(55), `HistoryStatus.entity`(30), core(150) | `History/History.entity.ts` (247) | `History/*.entity.ts` | 247 → ~150 |
| **DC-09** | opencodeClient → `client`(15), `message.entity`(40), `messagePagination`(35), `session.service`(70), `form.service`(25), `catalog.service`(30), `event.service`(15), agregador(45) | `Infrastructure/Services/opencodeClient.ts` (237) | `Infrastructure/Services/*` | 237 → ~45 |
| **DC-10** | EventStreamProvider → `eventStream.constants`(10), `backoff`(12), `applyActiveSeed`(35), `eventBatcher`(35), `applyReducedEvent`(25), `useActiveSessionsSeed`(45), `useEventStreamConnection`(70), `EventStreamContext`(15), provider(50) | `Infrastructure/EventStreamProvider.tsx` (225) | `Infrastructure/lib/*`, `Infrastructure/Hooks/*` | 225 → ~50 |
| **DC-11** | sessionFilters → `timeRange`(55), `filterUrl`(50), `projectOptions`(35), `groupFilter`(42), barrel(6) | `Sessions/lib/sessionFilters.ts` (221) | `Sessions/lib/*` + barrel | 221 → max 55 |
| **DC-12** | loadPriority → `toStructuralModel`(45), `traversal`(60), `orderSubtreeForLoad`(95), `chunk`(30), facade(15) | `Graph/lib/loadPriority.ts` (221) | `Graph/lib/loadPlan/**` + facade | 221 → max 95 |
| **DC-13** | executionLevels → `geometry`(45), `nodeInterval`(25), `deriveExecutionLevels`(100), `layoutRows`(55), facade(15) | `Graph/lib/executionLevels.ts` (218) | `Graph/lib/execution/**` + facade | 218 → max 100 |
| **DC-14** | AgentNode → `totalTokens`, `formatClock`, `NodeResizeHandles`(25), `useNodeFocusOpacity`(10), `AgentNodeHeader`(40), `AgentNodeModelLine`(20), `AgentNodeFooter`(55) | `Graph/Components/AgentNode.tsx` (215) | `Graph/Components/*` | 215 → ~55 |
| **DC-15** | Inspector.service → `questionMappers`(55), `InspectorResources.service`(40), service sesión(120) | `Inspector/Inspector.service.ts` (208) | `Inspector/lib/*`, `Inspector/*.service.ts` | 208 → 120 + 55 + 40 |
| **DC-16** | useGraphStructure → `filterSubtree`(32), `parallelByNode`(14), `assembleStructuralGraph`(20), `indexPositions`(8) | `Graph/Hooks/useGraphStructure.ts` (195) | `Graph/lib/*` | 195 → ~115 |
| **DC-17** | InspectorPanel → `InspectorIdentity`(40), `InspectorEmptyPrompt`(14), `useControlledReasoning`(18), panel(95) | `Inspector/Components/InspectorPanel.tsx` (188) | `Inspector/Components/*`, `Inspector/Hooks/*` | 188 → ~95 |
| **DC-18** | Inspector.entity → `InspectorQuestions.entity`(62), `InspectorSession.entity`(56), `InspectorResources.entity`(16), barrel(20) | `Inspector/Inspector.entity.ts` (179) | `Inspector/*.entity.ts` | 179 → 3 módulos + barrel |
| **DC-19** | ExecutionLanes → `GutterNode`(95), `buildGutterNodes`(28), `NODE_STATUS_COLOR`, bandas(45) | `Graph/Components/ExecutionLanes.tsx` (171) | `Graph/Components/GutterNode.tsx`, `Graph/lib/*` | 171 → ~45 |
| **DC-20** | QuestionsSection → `questionState`(14), `QuestionRow`(45), `PermissionRow`(22), sección(70) | `Inspector/Components/QuestionsSection.tsx` (166) | `Inspector/Components/*` | 166 → ~70 |
| **DC-21** | HistoryHeader → `HistoryIdentity`(25), `HistoryMetrics`(35), `HistoryLineageNav`(45), `NavButton`, `deriveHistoryHeaderView`(40), `OUTCOME_LABEL`, `totalTokens` | `History/Components/HistoryHeader.tsx` (164) | `History/Components/*`, `History/lib/*`, `Application/*` | 164 → ~40 |
| **DC-22** | useInspectorData → `toolsFromMessages`(18), `errorsFromMessages`(22), `deriveResources`(28), `useSessionMessages`(35), `useInspectorDerivations`(40), agregador(70) | `Inspector/Hooks/useInspectorData.ts` (163) | `Inspector/lib/*`, `Inspector/Inspector.service.ts` | 163 → ~70 (+ corrige Principio III) |
| **DC-23** | SessionSummaryBar → `UnavailableValue`(15), `SummaryMetric`(18), `buildSummaryCounters`(55), `SummaryCounterBadge`(15), barra(50) | `Graph/Components/SessionSummaryBar.tsx` (163) | `Graph/Components/*`, `Graph/lib/*` | 163 → ~50 |
| **DC-24** | useExecutionSignals → `executionSignal`, `deriveExecutionSignals`(50) | `Graph/Hooks/useExecutionSignals.ts` (161) | `Graph/lib/*` | 161 → ~65 |
| **DC-25** | reconcileGraph → `reconcile/comparators`(100), `reconcileGraphModel`(60) | `Graph/lib/reconcileGraph.ts` (159) | `Graph/lib/reconcile/**` | 159 → max 100 |
| **DC-26** | buildGraph → `hasPendingForm`(12), `toGraphNode`(80), `buildEdges`(25), facade(35) | `Graph/lib/buildGraph.ts` (152) | `Graph/lib/graphBuild/**` + facade | 152 → max 80 |
| **DC-27** | AlertMessage → `alertVariants`, `AlertIconBadge`, renombrar `EmptyStateProps`→`AlertMessageProps` | `Application/Components/Organisms/AlertMessage.tsx` (148) | `Molecules/*` | 148 → ~85 |
| **DC-28** | ToolCallEntry → `formatToolInput`(12), `ToolStatusBadge`(28), `LabeledField`(12); migra 3 `div.flex` | `Application/Components/Organisms/ToolCallEntry.tsx` (128) | `Molecules/*`, `Application/Helpers/*` | 128 → ~75 |
| **DC-29** | HistoryModal/HistoryTimeline → `HistorySkeleton`(10), `useHistorySentinel`(35), `HistoryLoadError`(10) | `History/Components/HistoryModal.tsx` (140) + `HistoryTimeline.tsx` (134) | `History/Components/*`, `History/Hooks/*` | sin gordo, extrae atomicidad |
| **DC-30** | Corrección de encapsulamiento: `useSessionNodeStatus` (cross-domain vía hook, AGENTS §8.3) | `Sessions/Components/SessionCard.tsx` (66) | `Sessions/Hooks/useSessionNodeStatus.ts` | deuda de convención |
| **(sin propuesta)** | `Graph/Graph.entity.ts` (202) — solo tipos + `EMPTY_*`; ningún área propuso corte | — | — | **sin acción** (bajo prioridad) |

### C. Código muerto (`BD-*`)

| ID | Acción | Archivos | Líneas | Verificación |
|---|---|---|---|---|
| **BD-01** | Borrado seguro (cero consumidores) | `Application/Helpers/formatter.ts`, `Application/Helpers/IPagination.ts`, `Application/Hooks/useDebounce.ts`, `Inspector/Components/InspectorSkeleton.tsx`, `Connection/Components/ConnectionBadgeSkeleton.tsx`, `Application/Components/Layout/AnimatedLayout.tsx`, `TNodeDetail` en `Inspector.entity.ts` | 65+27+26+10+5+34 ≈ **167** + barrel | grep abajo (sección *Código muerto*) |

---

## Ranking impacto/esfuerzo

Orden descendente por ratio; desempate por riesgo ascendente.

| # | ID | Acción | Imp | Esf | Ratio | Riesgo |
|---:|---|---|:--:|:--:|:--:|:--:|
| 1 | SH-01 | `totalTokens` compartido | H | S | **3.00** | L |
| 2 | SH-03 | `NODE_STATUS_COLOR` (Familia 1) | H | S | **3.00** | M |
| 3 | SH-04 | `OUTCOME_LABEL` + `TOutcome` | M | S | **2.00** | L |
| 4 | SH-05 | `questionState` + `QuestionStateBadge` | M | S | **2.00** | L |
| 5 | SH-07 | Tipos de pregunta compartidos | M | S | **2.00** | L |
| 6 | SH-09 | `formatModelRef` | M | S | **2.00** | L |
| 7 | SH-16 | `alertVariants` + `AlertIconBadge` | M | S | **2.00** | L |
| 8 | SH-19 | `summarizeProjects` + `timeRangeLabel` | M | S | **2.00** | L |
| 9 | DC-24 | Descomponer `useExecutionSignals` | M | S | **2.00** | L |
| 10 | DC-27 | Descomponer `AlertMessage` | M | S | **2.00** | L |
| 11 | SH-06 | `toolStatus` + `ToolStatusBadge` | M | S | **2.00** | M |
| 12 | SH-08 | `executionSignal` (Familia 7) | M | S | **2.00** | M |
| 13 | DC-28 | Descomponer `ToolCallEntry` | M | S | **2.00** | M |
| 14 | DC-29 | `HistorySkeleton` + `useHistorySentinel` + `HistoryLoadError` | M | S | **2.00** | M |
| 15 | DC-11 | Atomizar `sessionFilters` | H | M | **1.50** | L |
| 16 | DC-12 | Atomizar `loadPriority` | H | M | **1.50** | L |
| 17 | SH-02 | Unificar `useNow` | H | M | **1.50** | M |
| 18 | SH-13 | Andamiaje `SectionHeading`/`DetailRow`/`DetailListRow`/`ListSkeleton`/`Disclosure` | H | M | **1.50** | M |
| 19 | SH-14 | `SectionFrame` | H | M | **1.50** | M |
| 20 | DC-03 | Descomponer `buildHistory` | H | M | **1.50** | M |
| 21 | DC-07 | Descomponer `deriveMetrics` | H | M | **1.50** | M |
| 22 | DC-13 | Atomizar `executionLevels` | H | M | **1.50** | M |
| 23 | DC-14 | Descomponer `AgentNode` | H | M | **1.50** | M |
| 24 | DC-21 | Descomponer `HistoryHeader` | H | M | **1.50** | M |
| 25 | DC-23 | Descomponer `SessionSummaryBar` | H | M | **1.50** | M |
| 26 | BD-01 | Borrado seguro | L | S | **1.00** | L |
| 27 | SH-10 | Constantes de formato + `formatClock` | L | S | **1.00** | L |
| 28 | SH-11 | `sameQueryKey` | L | S | **1.00** | L |
| 29 | SH-12 | `chunkArray` + `sumNullable` | L | S | **1.00** | L |
| 30 | SH-15 | Moléculas pequeñas | M | M | **1.00** | M |
| 31 | SH-17 | `scheduleIdle` | L | S | **1.00** | L |
| 32 | SH-18 | `STORE_KEY` magic strings | L | S | **1.00** | L |
| 33 | SH-20 | Recorte `useURLParams` | L | S | **1.00** | L |
| 34 | DC-15 | Descomponer `Inspector.service` | M | M | **1.00** | L |
| 35 | DC-16 | Atomizar `useGraphStructure` | M | M | **1.00** | L |
| 36 | DC-20 | Descomponer `QuestionsSection` | M | M | **1.00** | L |
| 37 | DC-25 | Aislar comparadores `reconcileGraph` | L | S | **1.00** | L |
| 38 | DC-30 | Fix encapsulamiento `SessionCard` | L | S | **1.00** | L |
| 39 | DC-08 | Atomizar `History.entity` | M | M | **1.00** | L |
| 40 | DC-01 | Descomponer `eventReducer` | H | L | **1.00** | H |
| 41 | DC-02 | Descomponer `WorkspacePage` | H | L | **1.00** | H |
| 42 | DC-04 | Descomponer `AgentGraph` | H | L | **1.00** | H |
| 43 | DC-05 | Descomponer `useGraphEnrichment` | H | L | **1.00** | H |
| 44 | DC-06 | Descomponer `HistoryEntry` | H | L | **1.00** | M |
| 45 | DC-09 | Descomponer `opencodeClient` | H | L | **1.00** | M |
| 46 | DC-10 | Descomponer `EventStreamProvider` | H | L | **1.00** | H |
| 47 | DC-17 | Descomponer `InspectorPanel` | M | M | **1.00** | M |
| 48 | DC-19 | Descomponer `ExecutionLanes` | M | M | **1.00** | M |
| 49 | DC-22 | Descomponer `useInspectorData` | M | M | **1.00** | M |
| 50 | DC-26 | Descomponer `buildGraph` | M | M | **1.00** | M |
| 51 | DC-18 | Atomizar `Inspector.entity` | L | M | **0.50** | L |

---

## Tandas de ejecución (sin conflictos de archivos)

5 tandas. **Tanda 1** es la fase de fundaciones (solo crea archivos nuevos y borra
muertos). Las tandas 2–5 quedan garantizadas sin solapamiento de archivos de
lógica. T2 y T3 pueden ejecutarse en paralelo tras T1.

### Tanda 1 — Fundaciones + borrado seguro
> Solo **archivos nuevos** y **archivos eliminados** (sin solapamiento posible).

| Acción | Escribe (nuevos) | Elimina |
|---|---|---|
| **BD-01** | — | `formatter.ts`, `IPagination.ts`, `useDebounce.ts`, `InspectorSkeleton.tsx`, `ConnectionBadgeSkeleton.tsx`, `AnimatedLayout.tsx`, `TNodeDetail` (+ líneas de barrel) |
| **SH-01** | `Helpers/totalTokens.ts` | — |
| **SH-02** | `Hooks/useNow.ts` | — |
| **SH-03** | `Helpers/nodeStatusColor.ts` | — |
| **SH-04** | `Helpers/outcomeLabel.ts` | — |
| **SH-05** | `Entities/questionState.ts`, `Molecules/QuestionStateBadge.tsx` | — |
| **SH-06** | `Entities/toolStatus.ts`, `Molecules/ToolStatusBadge.tsx` | — |
| **SH-07** | `Entities/question.ts` | — |
| **SH-08** | `Graph/lib/executionSignal.ts` | — |
| **SH-09** | `Helpers/formatModelRef.ts` | — |
| **SH-10** | `Helpers/format/constants.ts` | — |
| **SH-11** | `Helpers/queryKey.ts` | — |
| **SH-12** | `Helpers/array.ts`, `Helpers/number.ts` | — |
| **SH-13** | `Molecules/SectionHeading.tsx`, `DetailRow.tsx`, `DetailListRow.tsx`, `ListSkeleton.tsx`, `Disclosure.tsx` | — |
| **SH-14** | `Molecules/SectionFrame.tsx` | — |
| **SH-15** | `Molecules/LabeledField.tsx`, `InProgressText.tsx`, `UnavailableValue.tsx`, `NavButton.tsx`, `QuestionBlock.tsx`, `AttachmentList.tsx`, `ResourceRow.tsx`, `LabeledSelect.tsx`, `MultiSelectFilterPopover.tsx` | — |
| **SH-16** | `Molecules/alertVariants.ts`, `Molecules/AlertIconBadge.tsx` | — |
| **SH-17** | `Helpers/scheduleIdle.ts` | — |
| **SH-18** | (edita `useGlobalStore.ts` en T5) | — |
| **SH-19** | `Sessions/lib/projectOptions.ts` (parcial), `Sessions/lib/timeRange.ts` | — |
| Módulos puros compartidos entre acciones | `Graph/lib/nodeStatusRank.ts`, `Graph/lib/execution/nodeInterval.ts`, `Graph/lib/graphBuild/buildEdges.ts` | — |

**Nº de acciones:** 19 (SH-01…SH-17, SH-19) + BD-01 + 3 módulos compartidos.
**Archivos tocados:** solo nuevos + borrados.

### Tanda 2 — Libs puras gordas + helpers puros (consumo)
Depende solo de **T1**.

| Acción | Archivos origen tocados |
|---|---|
| DC-01 | `Graph/lib/eventReducer.ts` |
| DC-03 | `History/lib/buildHistory.ts` |
| DC-07 | `Graph/lib/deriveMetrics.ts` |
| DC-11 | `Sessions/lib/sessionFilters.ts` |
| DC-12 | `Graph/lib/loadPriority.ts` |
| DC-13 | `Graph/lib/executionLevels.ts` |
| DC-25 | `Graph/lib/reconcileGraph.ts` |
| DC-26 | `Graph/lib/buildGraph.ts` |
| SH-02 (consumo) | `Sessions/Hooks/useNow.ts` (borra), `Graph/Hooks/useNow.ts` (borra), `Sessions/Hooks/useSessionFilters.ts`, `Graph/Hooks/useGraphModel.ts` |
| SH-03 (consumo) | `Application/Components/Molecules/StatusDot.tsx`, `Graph/Components/NodeStatusRail.tsx` |
| SH-10 (consumo) | `Helpers/formatDuration.ts`, `formatTokens.ts`, `formatCost.ts`, `formatTimeRange.ts` |
| SH-19 (consumo) | `Sessions/Components/ProjectFilter.tsx`, `SessionFilterBar.tsx`, `TimeRangeFilter.tsx` |
| DC-30 | `Sessions/Components/SessionCard.tsx` + `Sessions/Hooks/useSessionNodeStatus.ts` (nuevo) |

**Nº de acciones:** 13. Todos los archivos origen son distintos entre sí.

### Tanda 3 — Inspector + Sessions/Graph hooks + filas de Inspector
Depende solo de **T1**. Paralelizable con T2.

| Acción | Archivos origen tocados |
|---|---|
| DC-15 | `Inspector/Inspector.service.ts` (+ `InspectorResources.service.ts`, `lib/questionMappers.ts` nuevos) |
| DC-16 | `Graph/Hooks/useGraphStructure.ts` |
| DC-17 | `Inspector/Components/InspectorPanel.tsx` (+ `InspectorIdentity`, `InspectorEmptyPrompt`, `useControlledReasoning` nuevos) |
| DC-18 | `Inspector/Inspector.entity.ts` |
| DC-20 | `Inspector/Components/QuestionsSection.tsx` (+ `QuestionRow`, `PermissionRow`, `lib/questionState.ts`) |
| DC-24 | `Graph/Hooks/useExecutionSignals.ts` (+ `lib/deriveExecutionSignals.ts`) |
| DC-27 | `Application/Components/Organisms/AlertMessage.tsx` + `Molecules/Alert.tsx` |
| DC-28 | `Application/Components/Organisms/ToolCallEntry.tsx` |
| DC-05 | `Graph/Hooks/useGraphEnrichment.ts` |
| SH-13/14/15 consumo (Inspector) | `Inspector/Components/FileChanges.tsx`, `ToolHistory.tsx`, `ToolStats.tsx`, `ResourceList.tsx`, `SubagentsSection.tsx`, `ErrorsSection.tsx`, `ModelSection.tsx`, `AdvancedSection.tsx`, `Application/Components/Molecules/Metric.tsx`, `CompactionContext.tsx` |

**Nº de acciones:** 10. Archivos distintos entre sí.

### Tanda 4 — Componentes Graph + History
Depende de **T1** y, para DC-22, de **T3** (DC-15).

| Acción | Archivos origen tocados |
|---|---|
| DC-04 | `Graph/Components/AgentGraph.tsx` (+ `ViewportControllers`, hooks nuevos) |
| DC-14 | `Graph/Components/AgentNode.tsx` (+ `NodeResizeHandles`, `AgentNodeHeader`, `AgentNodeModelLine`, `AgentNodeFooter`) |
| DC-19 | `Graph/Components/ExecutionLanes.tsx` (+ `GutterNode.tsx`, `lib/buildGutterNodes.ts`) |
| DC-23 | `Graph/Components/SessionSummaryBar.tsx` (+ `SummaryMetric`, `SummaryCounterBadge`, `lib/summaryCounters.ts`) |
| DC-21 | `History/Components/HistoryHeader.tsx` (+ `HistoryIdentity`, `HistoryMetrics`, `HistoryLineageNav`, `lib/historyHeaderView.ts`) |
| DC-06 | `Application/Components/Organisms/HistoryEntry.tsx` (+ subdirectorio `Organisms/HistoryEntry/**`) |
| DC-29 | `History/Components/HistoryModal.tsx`, `HistoryTimeline.tsx` (+ `HistorySkeleton`, `useHistorySentinel`, `HistoryLoadError`) |
| DC-22 | `Inspector/Hooks/useInspectorData.ts` (+ `lib/*`, `useSessionMessages` en `Inspector.service.ts`) |

**Nº de acciones:** 8. Archivos distintos entre sí.

### Tanda 5 — Infrastructure
Depende de **T1** y de **T2** (SH-02 `useNow`, consumido por `WorkspacePage`).

| Acción | Archivos origen tocados |
|---|---|
| DC-02 | `Infrastructure/WorkspacePage.tsx` (+ `Infrastructure/Components/*`, `Infrastructure/Hooks/*`, `WorkspacePage.constants.ts`) |
| DC-09 | `Infrastructure/Services/opencodeClient.ts` (+ `client.ts`, `message.entity.ts`, `lib/messagePagination.ts`, `session.service.ts`, `form.service.ts`, `catalog.service.ts`, `event.service.ts`) |
| DC-10 | `Infrastructure/EventStreamProvider.tsx` (+ `Infrastructure/lib/*`, `Infrastructure/Hooks/*`) |
| SH-18 | `Application/Hooks/useGlobalStore.ts`, `useDevice.ts`, `Helpers/device.ts`, `Components/Layout/Page.tsx` |
| SH-20 | `Application/Hooks/useURLParams.ts` |
| SH-13 (consumo restante) | `Sessions/Components/SessionList.tsx` |

**Nº de acciones:** 6. Archivos distintos entre sí.

---

## Quick wins

Las de máxima rentabilidad y mínimo riesgo para arrancar (todas fundacionales o de
borrado; se ejecutan en T1 y desbloquean el resto):

| # | ID | Acción | Por qué | Ratio / Riesgo |
|---:|---|---|---|---|
| 1 | **BD-01** | Borrar `formatter.ts`, `IPagination.ts`, `useDebounce.ts`, `InspectorSkeleton`, `ConnectionBadgeSkeleton`, `AnimatedLayout`, `TNodeDetail` | 0 consumidores confirmados por grep; elimina ~167 líneas y ruido | — / **L** |
| 2 | **SH-01** | Extraer `totalTokens` | Cierra la **Familia 5** (3 copias literales) con un helper de ~10 líneas | 3.00 / L |
| 3 | **SH-03** | Extraer `NODE_STATUS_COLOR` | Cierra la **Familia 1** (3 mapas idénticos de 9 estados) | 3.00 / M |
| 4 | **SH-04** | Extraer `OUTCOME_LABEL` + `TOutcome` | Cierra **Familias 2 y 8**; textos visibles preservados | 2.00 / L |
| 5 | **SH-05** | `questionState` + `QuestionStateBadge` | Cierra **Familia 3**; 2 pares label/color idénticos | 2.00 / L |
| 6 | **SH-07** | Tipos de pregunta compartidos | Cierra **Familia 6**; solo tipos, sin riesgo runtime | 2.00 / L |
| 7 | **SH-09** | `formatModelRef` | Elimina el `provider/id` repetido en **5 sitios** | 2.00 / L |
| 8 | **SH-16** | `alertVariants` + `AlertIconBadge` | Unifica 2 mapas sin tipar entre `AlertMessage` y `Alert`; tipa contra `TAlertVariant` | 2.00 / L |

> Extra rentable opcional: **DC-24** (`useExecutionSignals`, ratio 2.00 / L) y
> **DC-27** (`AlertMessage`, ratio 2.00 / L), ambos de bajo riesgo.

---

## Métricas objetivo (actual → objetivo)

| Métrica | Actual | Objetivo | Fuente |
|---|---:|---:|---|
| Archivos de producción `> 200` líneas | **16** | **0** | `find`+`wc` (162 archivos) |
| Archivos de producción `≥ 150` líneas | **27** | **0** (máx. ≤2 justificados: `Graph.entity.ts`) | inventario |
| `p95` de líneas por archivo | **225** | **≤ 120** | distribución medida |
| `p90` de líneas por archivo | **188** | **≤ 100** | distribución medida |
| `p99` de líneas por archivo | **409** | **≤ 150** | distribución medida |
| Línea máxima del repo | **622** (`eventReducer.ts`) | **≤ 150** (mayor pieza ~135, `historyQuestions.ts`) | inventario |
| Líneas totales en archivos `≥ 150` | **6 658** (54,9 %) | **0** | inventario |
| Mediana de líneas | 43 | ≤ 45 (no empeorar; +~150 archivos nuevos pequeños) | distribución medida |
| Mapas de color por `TNodeStatus` duplicados | **3** | **0** | Familia 1 |
| Copias de `totalTokens` | **3** | **1** | Familia 5 |
| Copias de `OUTCOME_LABEL`/label terminal | **2** | **1** | Familia 2 |
| Mapas de estado de pregunta duplicados | **2** | **0** | Familia 3 |
| Mapas de color de estado de tool duplicados | **2** | **0** | Familia 4 |
| Definiciones de tipos de pregunta duplicadas | **2** | **1** | Familia 6 |
| Señal de ejecución "vacía" duplicada | **2** | **1** | Familia 7 |
| Implementaciones de `useNow` | **2** | **1** | Área 05/07 |
| Elementos de código muerto confirmado | **7** | **0** | sección siguiente |
| `div` con `flex` en archivos refactorizados | ~20 usos | **0** en archivos tocados | AGENTS §8.4 |
| Módulos nuevos con spec focalizado | — | ≥1 por pieza pura compartida | Principio VIII |

> Nota: el nº total de archivos crece (162 → ~300). Es esperado: el objetivo es
> **ningún archivo gordo**, no reducir el total de líneas (el código total casi no
> baja; se redistribuye en módulos atómicos y testeables).

---

## Código muerto a eliminar (con verificación)

Verificado con `grep` sobre `src/` (solo lectura). "Consumidores" excluye la
definición y su línea de export en el barrel.

| Elemento | Líneas | Referencias encontradas | Veredicto |
|---|---:|---|---|
| `Application/Helpers/formatter.ts` | 65 | Solo su definición + `Helpers/index.ts:1` | **Eliminar** (0 consumidores) |
| `Application/Helpers/IPagination.ts` | 27 | Solo su definición + `Helpers/index.ts:3` | **Eliminar** (0 consumidores) |
| `Application/Hooks/useDebounce.ts` | 26 | Solo su definición + `Hooks/index.ts:1` | **Eliminar** (0 consumidores) |
| `Inspector/Components/InspectorSkeleton.tsx` | 10 | Solo su definición + `Components/index.ts:2` | **Eliminar** (0 consumidores) |
| `Connection/Components/ConnectionBadgeSkeleton.tsx` | 5 | Solo su definición + `Components/index.ts:2` | **Eliminar** (0 consumidores; `ConnectionBadge` no tiene rama `isLoading`) |
| `Application/Components/Layout/AnimatedLayout.tsx` | 34 | Solo su definición + `Layout/index.ts:3`; `framer-motion` solo aquí | **Eliminar** (componente sin consumidor; además `return <>{children}</>` deja inalcanzable el `motion.div`) |
| `TNodeDetail` (`Inspector/Inspector.entity.ts:147`) | — | Solo su definición; no aparece en `src/` fuera de specs/contratos | **Deprecar/eliminar** (verificado) |
| `useURLParams` superficie extra (`params`, `updateDebouncedParams`, `clearParams`, `hasParam`, `searchParams`) | ~67 | Solo `getParam`/`updateParams` tienen consumidores | **Recortar** (SH-20) |

> `useIsEditable.ts` **no** es muerto pese al `TODO`: lo consumen `Molecules/Input.tsx`
> y `ui/textarea.tsx`. No se elimina.

---

## Dependencias entre tandas

```
T1 (fundaciones: crea módulos SH + módulos puros compartidos; borra muertos)
 ├──> T2 (libs puras gordas + consumo de helpers puros)   ──┐
 ├──> T3 (Inspector + Graph hooks + filas Inspector)      ──┤ T2∥T3 en paralelo
 │        └── DC-15 (questionMappers/useSessionMessages) ──┐│
 ├──> T4 (Graph components + History)        ◄── T1 y DC-15 ┘│
 └──> T5 (Infrastructure)                    ◄── T1 y SH-02 ─┘
```

Dependencias duras (no se puede adelantar la acción consumidora):

| Consumidor | Requiere (T1 salvo indicación) |
|---|---|
| DC-01, DC-05, DC-24 | `SH-08` (`executionSignal`) |
| DC-06, DC-21 | `SH-04` (`OUTCOME_LABEL`), `SH-05`, `SH-09`, `SH-13`, `SH-15` |
| DC-19, DC-04 | `SH-03` (`nodeStatusColor`) |
| DC-14 | `SH-01`, `SH-09`, `SH-10`, `SH-15` |
| DC-23 | `SH-01`, `SH-15` |
| DC-27 | `SH-16` |
| DC-28 | `SH-06`, `SH-15` |
| DC-20 | `SH-05`, `SH-15` |
| DC-22 | **DC-15** (T3) — `questionMappers`/`useSessionMessages` |
| DC-02 | **SH-02** (T2) — `useNow` unificado |
| DC-16, DC-05, DC-12, DC-13 | módulos puros compartidos de T1 (`nodeInterval`, `filterSubtree`, etc.) |
| Todos | **T1** completo |

### Notas de riesgo por tanda

- **T2**: `DC-01` (eventReducer) y `DC-12`/`DC-13` usan el patrón **facade +
  subcarpeta con nombre distinto** para no romper specifiers ni specs; preservar deps
  exactas de `useMemo`/guardado keyed por `signature` (Principio VII).
- **T3**: `DC-05` debe mantener la semántica "lo vivo gana sobre la siembra" y el
  batching/cancelación (`useGraphEnrichment.*.spec`); `DC-22` corrige la violación del
  Principio III (SDK fuera de `*.service.ts`).
- **T4**: `DC-04` preserva los nombres de marcas `INTERACTION_*` y el número de
  medidas `perf`; `DC-14` conserva `data-testid`/textos/`resizeControlClassName`;
  `DC-06` no cambia props públicas de `HistoryEntry` (solo imports).
- **T5**: `DC-02` debe importar `useNow` **por el barrel** `@app/Domains/Graph` para
  que el espía de `WorkspacePage.perf.spec.tsx` siga interceptando; `DC-10` preserva
  `refreshActive(true)` al conectar y el `AbortController`/StrictMode-safe.

### Bloqueos / decisiones de owner pendientes

1. **`OUTCOME_LABEL` vs `NODE_STATUS_LABEL`** (Áreas 01/06): unificar `IDLE_LABEL` es
   seguro; unificar con `NODE_STATUS_LABEL` ("Terminada" vs "Terminada con éxito") **no**
   es literal. Recomendación: fuente propia + documentar divergencia (no bloquea T1).
2. **`Graph/Graph.entity.ts` (202)** sin propuesta de corte en ningún área: queda como
   único posible archivo `≥150` residual. Decidir si se descompone o se acepta.
3. **`useSessionForms` N+1** (Área 04): fuera del alcance de tamaño, anotado como
   riesgo de rendimiento al tocar `Inspector.service` (T3).
4. **`SectionFrame`** (SH-14) unifica el orden error→loading→vacío→datos; validar con
   owner que ninguna sección tiene un orden especial.

---

## Resumen ejecutivo

- **Artefacto**: `docs/proposals/consolidacion/plan-priorizado.md`.
- **Top quick wins**: BD-01 (borrado seguro), SH-01 `totalTokens`, SH-03
  `NODE_STATUS_COLOR`, SH-04 `OUTCOME_LABEL`+`TOutcome`, SH-05 `questionState`,
  SH-07 tipos de pregunta, SH-09 `formatModelRef`, SH-16 `alertVariants`.
- **Nº de tandas**: **5** (T1 fundaciones → T2/T3 en paralelo → T4 → T5).
- **Acciones en el plan**: 51 acciones + 1 borrado seguro (BD-01).
- **Bloqueos**: solo decisiones de owner (wording de `NODE_STATUS_LABEL`, destino de
  `Graph.entity.ts`, orden de `SectionFrame`); ninguno impide arrancar T1.
