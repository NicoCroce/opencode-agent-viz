# Consolidación — Validación normativa y de impacto en specs

> Análisis **de solo lectura** (no se toca código de producto). Este documento
> valida las 7 propuestas de área (`docs/proposals/areas/01..07-*.md`) contra
> `AGENTS.md`, `.specify/memory/constitution.md` y los `specs/` reales del repo.
>
> Evidencia verificada sobre el árbol actual (`src/**/*.spec.tsx|ts` = 78 specs;
> `specs/` = 6 features spec-kit). Fuente del umbral GORDO:
> `docs/proposals/inventario-gordos.md`.

---

## Violaciones de convención preexistentes (tabla)

Leyenda de la columna **¿Propuesta?**:
- `corrige` = alguna propuesta la arregla explícitamente.
- `parcial` = la detecta pero solo la arregla en algunos sitios.
- `mantiene` = la propuesta la conserva o no la aborda (queda como deuda).
- `gap` = **no aparece** en ninguna propuesta (hallazgo de esta validación).

### A. Arquitectura de datos / encapsulamiento

| # | Convención | Violación (archivo:línea) | Detalle | ¿Propuesta? | Área |
|---|-----------|---------------------------|---------|-------------|------|
| 1 | Const. III / AGENTS §8.1 — SDK **solo** en `*.service.ts` | `Domains/Inspector/Hooks/useInspectorData.ts:4,94` | El hook llama `opencodeService.getSessionMessages` directamente (lectura) | **corrige** (→ `useSessionMessages` en `Inspector.service.ts`) | 04 |
| 2 | AGENTS §8.3 — **no** cross-domain desde un componente | `Domains/Sessions/Components/SessionCard.tsx:4` | Componente importa `toNodeStatus` de `Domains/Graph/lib/nodeStatus` | **corrige** (→ `useSessionNodeStatus` + prop) | 05 |
| 3 | AGENTS §8.3 (type-only) | `Domains/Graph/Components/SessionSummaryBar.tsx:3` | Componente importa `TSessionSummary` de `Inspector.entity` | **parcial** (la detecta; ofrece hook o mover tipo) | 02 |
| 4 | AGENTS §8.3 (type-only) | `Domains/History/Components/HistoryModal.tsx:8` | Componente History importa `TGraphNode` de `Graph.entity` | **gap** | — |
| 5 | AGENTS §8.3 (type-only) | `Application/Components/Organisms/ToolCallEntry.tsx:9` | Componente `Application` importa `TToolEntry`/`TToolStatus` de `History.entity` | **gap** (el área 01 solo documenta el de `HistoryEntry`) | 01 |
| 6 | AGENTS §8.3 (type-only) | `Inspector/Components/{AnswersSection.tsx:3, ModelSection.tsx:3, MetricsSection.tsx:3, SubagentsSection.tsx:2, InspectorPanel.tsx:8}` | Componentes Inspector importan tipos de `History.entity` y `Graph.entity` | **gap** | 04 |
| 7 | AGENTS §8.3 (type-only) | `Application/Components/Organisms/HistoryEntry.tsx:3` | Importa `ModelRef` de `@opencode/client` (el SDK, no un dominio) | detectada (no la corrige; sugiere reexport) | 01 |
| 8 | AGENTS §4 / Const. II — `chunkArray` a `Application/Helpers` vs `Graph/lib` | `Domains/Graph/lib/loadPriority.ts` (chunk) | Ubicación de piezas compartidas en discusión entre áreas | **mantiene** | 02/03 |

> **Hallazgo transversal:** la regla §8.3 se incumple sobre todo por **imports de tipo**
> (`import type`) desde componentes. Ninguna área propone una solución sistemática
> (p. ej. reexport de tipos de `Graph.entity`/`Inspector.entity` desde un barril neutro
> o `Application/Entities`). Es deuda que sobrevive al refactor.

### B. Layout / responsive / presentación

| # | Convención | Violación (archivo:línea) | ¿Propuesta? | Área |
|---|-----------|---------------------------|-------------|------|
| 9 | AGENTS §8.4 — no `div` con `flex` → `<Container>` | `Application/Components/Organisms/ToolCallEntry.tsx:51,74,98` | **corrige** | 01 |
| 10 | AGENTS §8.4 | `Application/Components/Organisms/HistoryEntry.tsx:233,245,264,265` | **corrige** (al extraer cuerpos) | 01 |
| 11 | AGENTS §8.4 | `Application/Components/Molecules/CompactionContext.tsx:60,76` | **gap** | — |
| 12 | AGENTS §8.4 | `Domains/Graph/Components/AgentNode.tsx:125,127,170,171` (+ 131,157 en el área) | **parcial** (deuda "no bloqueante") | 02 |
| 13 | AGENTS §8.4 | `Domains/History/Components/HistoryTimeline.tsx:96,120` | **corrige** (al extraer) | 06 |
| 14 | AGENTS §8.4 | `Domains/History/Components/HistoryModal.tsx:42,137` (área reporta 103/107/109/137) | **corrige** | 06 |
| 15 | AGENTS §8.4 | `Inspector/Components/{ModelSection.tsx:11, ResourceList.tsx:17,24, SubagentsSection.tsx:31,41}` | **corrige** (vía `DetailListRow`/`SectionFrame`) | 04 |
| 16 | AGENTS §8.4 | `Infrastructure/WorkspacePage.tsx:255` (`Histórico no disponible`) | **corrige** (→ `HistoryOverlay`) | 07 |
| 17 | AGENTS §9 — prohibido `md:hidden`/`hidden md:block` | **sin violaciones** (grep: 0) | n/a | todas |
| 18 | AGENTS §9 — presentación por `useDevice()` | `Container` (div) dentro de `span`/`label`/`button` | aceptable (no son `div`) | 05 |

### C. Tipos, magic strings, validación, higiene

| # | Convención | Violación (archivo:línea) | ¿Propuesta? | Área |
|---|-----------|---------------------------|-------------|------|
| 19 | Const. IV / AGENTS §3 — tipos `T` derivados del **SDK** | Discrepancia doc: se cita `@opencode-ai/sdk` pero el código importa `@opencode/client` (47 usos) | detectada, no corregida (solo doc) | 03/07 |
| 20 | AGENTS §10 — **Zod** para input de usuario | **0 usos** de Zod en `src/`; filtros hacen parseo tolerante propio | **mantiene** (desvío consciente) | 05 |
| 21 | AGENTS §8.5 — no magic strings | `Infrastructure/WorkspacePage.tsx:53,75,363` (`'sessions'/'graph'/'inspector'`) | **corrige** (`WORKSPACE_TABS`) | 07 |
| 22 | AGENTS §8.5 — magic numbers | `Infrastructure/EventStreamProvider.tsx:28-36,197` (`100/5/2500/1000/30000`) | **corrige** (`eventStream.constants.ts`) | 07 |
| 23 | Const. I — observador read-only | `opencodeService` sin métodos de escritura (FR-037) | preservado | 07 |
| 24 | AGENTS §7 / Const. VIII — tests en `specs/` | Cubierto; varias extracciones exigen **nuevos** specs por pieza | **corrige** (añade) | 02/03/04 |
| 25 | AGENTS §2 — naming | `AlertMessage.tsx` exporta `EmptyStateProps` | **corrige** (→ `AlertMessageProps`) | 01 |
| 26 | Código muerto | `Helpers/formatter.ts`, `Helpers/IPagination.ts`, `Hooks/useDebounce.ts`, `Inspector/Components/InspectorSkeleton.tsx`, `Connection/Components/ConnectionBadgeSkeleton.tsx`, `TNodeDetail` | detectado, **no** se elimina en la propuesta | 04/06/07 |
| 27 | `applyActiveSeed` exportada desde un componente | `Infrastructure/EventStreamProvider.tsx:54` | **corrige** (→ `Infrastructure/lib/`) | 07 |
| 28 | Deep import vs barrel | `HistoryEntry.tsx:2` importa `RichText` por ruta profunda | detectada (nota menor) | 01 |
| 29 | Alias `cn` inconsistente | `ToolCallEntry` usa `@app/...`, `AlertMessage` usa `@/...` | detectada | 01 |
| 30 | `useNow` duplicado con **firma divergente** | `Graph/Hooks/useNow.ts` `(intervalMs, enabled)` vs `Sessions/Hooks/useNow.ts` `(active, intervalMs)` | **corrige** (pero 05 y 07 proponen firmas **distintas**) | 05/07 |
| 31 | `Connection.service.ts` no es un service real | re-export de una línea | detectada (no corrige) | 06 |

---

## Consistencia de las propuestas con AGENTS.md / constitución

Evaluación por área (✅ conforme · ⚠️ requiere ajuste · ❌ contradicción entre áreas).

- **Área 01 (Application/Components)** — ✅ Lógica extraída a `Helpers/` y moléculas de
  presentación pura; descomposición de `HistoryEntry` con barrel que no cambia imports.
  Corrige `div.flex` (ToolCallEntry/HistoryEntry) y naming. ⚠️ Deja `CompactionContext`
  (Molecules, su alcance) sin migrar sus `div.flex`.
- **Área 02 (Graph view)** — ✅ Hooks de derivación + libs puras; evita reescribir los
  `lib/` (los trata el área 03). ⚠️ `buildSummaryCounters` propuesto en `Graph/lib`
  hereda el acoplamiento Graph→Inspector (cross-domain que el propio área señala como
  no deseado); recomienda evaluar moverlo. ⚠️ `NODE_STATUS_COLOR` a `Application/Helpers`
  requiere tocar `StatusDot` (fuera de su alcance).
- **Área 03 (Graph/lib + History/lib + Inspector/lib)** — ✅ Patrón *facade + subcarpeta*
  preserva **todos** los import specifiers y respeta Principio V (puro y testeable) y
  VIII (specs junto al código). Defiende barrido único (`deriveMetricBase`) por
  Principio VII. ✅ No introduce cross-domain nuevo.
- **Área 04 (Inspector)** — ✅ Introduce `SectionFrame` que **encapsula el orden
  obligatorio error→loading→vacío→contenido** (Principio VI): buena alineación. ✅
  Mueve la llamada SDK del hook al service (Principio III). ⚠️ Duplica propuesta de
  `questionState`/`ToolStatusLabel` con el área 01 (ubicaciones distintas).
- **Área 05 (Sessions)** — ✅ Atomización de `sessionFilters` con barrel; corrige el
  cross-domain de `SessionCard`. ⚠️ Documenta la ausencia de Zod como desvío consciente
  (AGENTS §10 no satisfecho). ❌ **Contradice al área 07** en la firma canónica de `useNow`.
- **Área 06 (History + Connection)** — ✅ Subcomponentes de presentación + selector puro
  (`deriveHistoryHeaderView`), Principio V. ✅ Preserva wording ("Terminada con éxito")
  y advierte no unificarlo con `NODE_STATUS_LABEL` ("Terminada"). ⚠️ No detecta el
  cross-domain type-only de `HistoryModal.tsx:8`.
- **Área 07 (Infrastructure + Application)** — ✅ Facade de `opencodeClient` que conserva
  `opencodeService` (Const. I/III); provider fino con libs puras; extracción de overlays.
  ⚠️ Cambia el **home** de `useNow` a `Application/Hooks` y la firma → riesgo en
  `WorkspacePage.perf.spec`. ❌ Contradice al área 05 en la firma de `useNow`.

### Colisiones entre áreas (a resolver antes de implementar)

| Tema | Área A | Área B | Conflicto |
|------|--------|--------|-----------|
| Firma de `useNow` | 05: `useNow(options?: { enabled?; intervalMs? })` | 07: `useNow(enabled, intervalMs=DEFAULT)` | **Incompatibles.** Ambas rompen `WorkspacePage.perf.spec` (`(1000, false)`). |
| Hogar de `totalTokens` | 02/07: `Application/Helpers/totalTokens.ts` | 03: `Graph/lib/metrics/tokens.ts` **o** `Application/Helpers` | Ubicación sin decidir; 3 copias (AgentNode/HistoryHeader/SessionSummaryBar). |
| `questionState` / `ToolStatusBadge` | 01: `Molecules/QuestionBlock.tsx` + `ToolStatusBadge` | 04: `Application/Entities/questionState.ts` + `Molecule QuestionStateBadge`/`ToolStatusLabel` | Nombres y ubicación divergentes para la misma Familia 3/4. |
| Señal vacía | 02: `lib/executionSignal.ts` (`EMPTY_EXECUTION_SIGNAL`) | 03: `lib/eventReduce/signals.ts` (`EMPTY_SIGNAL`) | Dos destinos para el mismo literal (Familia 7); coordinar. |
| `sameQueryKey` | 03: `Application/Helpers`/`Infrastructure/queryKeys` | — | Sin consumidor definido fuera de 03; bajo riesgo. |
| `OUTCOME_LABEL` | 01: `Helpers/outcomeLabel.ts` | 06: `Helpers/outcomeLabel.ts` | **Coinciden** (bien). |

---

## Impacto en specs (tabla)

> "¿Se rompe?" = `SÍ` (rompe sin cambios), `no*` (no rompe si se aplica la mitigación),
> `riesgo` (depende de preservar detalle observable).

| Pieza / refactor | Specs que la cubren | ¿Se rompe? | Por qué | Mitigación |
|---|---|---|---|---|
| `HistoryEntry` → subdirectorio + `bodies/*` (01) | `Organisms/specs/HistoryEntry.spec.tsx`, `HistoryTimeline.spec.tsx`, `HistoryModal.spec.tsx`, `InspectorPanel.spec.tsx`, `AnswersSection.spec.tsx` | no* | El spec importa `../HistoryEntry`; debe resolver al `HistoryEntry/index.ts`. Props públicas FR-003/006/007/011/033/035 | Mantener `index.ts` y props; barrel `Organisms` `export *`; conservar textos ('Pregunta','respondida','cancelada','Respuesta: …') |
| `ToolCallEntry` `div.flex`→`<Container>` (01) | `Organisms/specs/ToolCallEntry.spec.tsx` | no* | `Container` sigue siendo `div`; el spec no asserta clases flex | Preservar `aria-expanded`, 'Entrada','Completada','Fallida','Ejecutando','Sin resultado todavía.','Error','En curso' |
| `AlertMessage` rename + `alertVariants` (01) | (indirecta) `SessionList.page.spec`, `WorkspacePage.spec` | no* | No hay spec propia | Mantener 6 variantes y textos por defecto ("Algo salió mal", "Sin resultados") |
| `AgentGraph` → hooks/lib/controladores (02) | `Graph/Components/specs/AgentGraph.spec.tsx` | **riesgo** | C3: `reactFlowSpy.nodes/edges` deben ser **misma referencia** tras hover/selección; P5: 1 sola medida `graph.interaction` por transición; el mock hace `import('../NodeFocusContext')` | Preservar deps exactas de cada `useMemo`, marcas `INTERACTION_HOVER/SELECT_MARK`, y la ruta `Components/NodeFocusContext`; no cambiar orden/forma de `nodes`/`edges` |
| `AgentNode` → `AgentNodeHeader/Footer/ModelLine` + `NodeResizeHandles` (02) | `AgentNode.spec.tsx` | **riesgo** | `container.querySelector('.bg-surface-2')` asume **un solo** nodo con esa clase; `.react-flow__resize-control.line/.handle`; `data-testid="agent-progress"`, `animate-pulse`, `aria-hidden`; `∥4` con `title="4 agentes ejecutados en paralelo"`; `Intento N · próximo HH:mm`; `Motivo: …`; opacidad 1/0.15 | No duplicar `bg-surface-2` en subcomponentes; conservar clases de `NodeResizer`, testids, textos y `title` |
| `ExecutionLanes` → `GutterNode.tsx` + reexport (02) | `ExecutionLanes.spec.tsx` | no* | Importa `{ GutterNode, TGutterNodeData } from '../ExecutionLanes'` | **Reexportar** desde `ExecutionLanes.tsx`; conservar las 9 clases `bg-status-*` sobre `.rounded-full` y 'en curso' |
| `SessionSummaryBar` → `buildSummaryCounters`/`UnavailableValue`/`SummaryCounterBadge` (02) | `SessionSummaryBar.spec.tsx` | **riesgo** | `[data-status="…"]` debe quedar en el mismo elemento; textos 'En curso','Esperando','Fallida','Reintentando','Compactando','Interrumpida','Creada'; `getAllByLabelText('no disponible')` = 3 | Conservar `data-status`, `label` exacto y `aria-label="no disponible"`; no usar `NODE_STATUS_LABEL` (''Esperando permiso''≠'Esperando') |
| `useExecutionSignals` → `lib/executionSignal` (02) | `useExecutionSignals.spec.tsx`, `buildGraph.spec.ts`, `eventReducer.spec.ts` | no* | El spec importa el hook y `reduceEvent`, no `EMPTY_*` | **Reexportar** `EMPTY_EXECUTION_SIGNAL` desde el hook |
| `useGraphStructure` → libs + reexport `filterSubtree` (02) | `useGraphStructure.spec.tsx`, `useGraphModel.spec.tsx`, `useGraphModel.tick.spec.tsx` | no* | Firma pública igual; `filterSubtree` se reexporta por `useGraphModel` y `Hooks/index.ts` | Mantener ambos re-exports |
| `useGraphEnrichment` → libs (`enrichNodeData` recibe datos resueltos) (02) | `useGraphEnrichment.spec.tsx`, `useGraphEnrichment.freshness.spec.tsx`, `useGraphModel.spec.tsx` | **riesgo** | Los specs mockean `opencodeService` y observan batching/frescura (`readyIds`)/cancelación; semántica "lo vivo gana a la siembra" | Reescribir el `useMemo` final resolviendo desde `queryClient` **antes** de `enrichNodeData`; preservar claves de caché y `LOAD_CHUNK_SIZE` |
| `eventReducer` → facade `lib/eventReduce/*` (03) | `eventReducer.spec.ts`, `buildGraph.spec.ts`, `live.integration.spec.ts`, `useExecutionSignals.spec.tsx`, `EventStreamProvider` | no* | La facade reexporta `reduceEvent`, `TReducibleEvent`, `TQueryUpdate`, `TSessionMessageCache` | No cambiar ningún specifier; vigilar `noUnusedLocals`/`noFallthroughCasesInSwitch` |
| `buildHistory` → facade `lib/history/*` (03/06) | `buildHistory.spec.ts` (697), `live.integration.spec.ts` (importa `@app/...`), `useHistoryPagination.spec.tsx` | no* | Firma y orden de entradas preservados | Mantener `lib/buildHistory.ts` como facade y `BuildHistoryOptions` |
| `deriveMetrics` → facade `lib/metrics/*` (03) | `deriveMetrics.spec.ts`, `buildGraph.spec.ts`, `useGraphEnrichment.spec.tsx` | no* | Firma igual; barrido único de `deriveMetricBase` | Facade; decidir hogar de `totalTokens` (colisión 02/03/07) |
| `loadPriority` → facade `lib/loadPlan/*` (03) | `loadPriority.spec.ts`, `useGraphEnrichment.spec.tsx` | no* | Importan `LOAD_CHUNK_SIZE`, `chunkLoadPlan`, `orderSubtreeForLoad`, `TLoadOptions` | Facade reexporta todo |
| `executionLevels` → facade `lib/execution/*` (03) | `executionLevels.spec.ts`, `AgentGraph.spec.tsx` (`TExecutionPlan`) | no* | Tipos/funciones reexportados | Facade; mantener dependencia con `layoutGraph` |
| `reconcileGraph` → `lib/reconcile/*` (03) | `reconcileGraph.spec.ts` | no* | Importa `../reconcileGraph` | Facade o reexport |
| `buildGraph` → `lib/graphBuild/*` (03) | `buildGraph.spec.ts` (990, contraste de paridad), `useGraphEnrichment*.spec` | no* | Paridad campo a campo sensible al orden de spreads/`null` | `toGraphNode` debe emitir los mismos campos, en el mismo orden |
| `Inspector.service` mappers → `lib/questionMappers` (04) | `Inspector/specs/Inspector.service.spec.tsx` (importa `useSessionForms` de `../Inspector.service`) | no* | Si `useSessionForms` permanece en `Inspector.service.ts` | Mantener el export o actualizar 1 import |
| `InspectorPanel` → `InspectorIdentity`/`InspectorEmptyPrompt`/`useControlledReasoning` (04) | `InspectorPanel.spec.tsx` (375) | **riesgo** | Orden DOM por `isBefore` (**Modelo→Métricas→Recursos→…→Archivos**; identidad antes de Modelo); scoping por `.parentElement` en 'Métricas' (Loop) y 'Subagentes'; texto `'Selecciona un nodo del grafo para ver su detalle.'` | Conservar la posición/estructura de cada sección (el `.parentElement` del heading debe **seguir conteniendo** su contenido); no cambiar orden ni textos |
| `Inspector.entity` split (+ barrel) (04) | `useInspectorData.spec.tsx`, `SessionSummaryBar.spec.tsx`, `ResourceList.spec.tsx`, `deriveMetrics.spec.ts`, `ModelSection.spec.tsx` | no* | Todos importan por `Inspector/Inspector.entity` | Mantener `Inspector.entity.ts` reexportando los 3 módulos; **no borrar** `TResourceUsage`/`TSessionSummary` del recorrido |
| `QuestionsSection` → `QuestionRow`/`PermissionRow` + `questionState` lib (04) | `QuestionsSection.spec.tsx` (8 tests) | no* | Textos exactos + estados error/loading/vacío | Conservar 'pendiente','respondida','cancelada','Turnos en cola: N','Sin permisos ni preguntas','Ocurrió un error al cargar los datos' |
| `useInspectorData` → `useSessionMessages` (mueve SDK) (04) | `useInspectorData.spec.tsx` (454) | no* | El spec mocks `opencodeService`; valida la **forma** de salida (`InspectorData`) | `useSessionMessages` debe seguir llamando `opencodeService.getSessionMessages` importado del agitador `@app/Infrastructure/Services/opencodeClient` |
| `sessionFilters` → 4 libs + barrel (05) | `sessionFilters.spec.ts`, `useSessionFilters.spec.tsx`, `SessionList.page.spec.tsx`, `ProjectFilter.spec.tsx`, `TimeRangeFilter.spec.tsx`, `SessionFilterBar.spec.tsx` | no* | Todos importan `../lib/sessionFilters` / `../../lib/sessionFilters` | Barrel `export *` que preserve nombres/firmas del contrato §5–§6 |
| **`useNow` unificado** (05/07) | `Sessions/Hooks/specs/useNow.spec.tsx`, `Graph/Hooks/specs/useNow.spec.tsx`, **`WorkspacePage.perf.spec.tsx`** | **SÍ** | (a) `perf.spec` espía el barril `@app/Domains/Graph` y re-importa `@app/Domains/Graph/Hooks/useNow`; (b) asserta `useNow(1000, false|true)` posicional | (1) Elegir **una** firma y actualizar ambos specs + `perf.spec`; (2) mantener un shim `Graph/Hooks/useNow.ts`; (3) el nuevo `useWorkspaceSummary` debe importar `useNow` **por el barril `@app/Domains/Graph`** |
| `SessionCard` recibe `nodeStatus` por prop (05) | `SessionCard.spec.tsx` | **riesgo** | La firma de props cambia (nueva prop obligatoria/opcional) | Actualizar el spec y el render de la página; o prop opcional con default |
| `HistoryHeader` → `HistoryIdentity/Metrics/LineageNav` + `deriveHistoryHeaderView` (06) | `HistoryModal.spec.tsx` (usa `HistoryHeader` internamente) | **riesgo** | `getAllByText('develop')`, `getAllByLabelText('no disponible')`, botones /cerrar|/razonamiento/, `aria-pressed` | Conservar textos, `aria-label="no disponible"` y orden |
| `HistoryModal` → `HistorySkeleton`/`useHistorySentinel`/`HistoryLoadError` (06) | `HistoryTimeline.spec.tsx` (236), `HistoryModal.spec.tsx` | **riesgo** | Mock por ruta profunda `../../Hooks/useHistoryPagination`; `IntersectionObserver` mockeado; `data-testid="history-sentinel"`; textos 'Sin actividad registrada','No se pudo cargar el histórico de la sesión.' | No renombrar/mover `useHistoryPagination`; conservar sentinel/testids/textos |
| `ConnectionBadge` rama de carga (06) | `ConnectionBadge.spec.tsx` | no* | Mock por ruta profunda `../../Hooks/useConnectionStatus`; asserta `getByRole('status')`='Conectado' | Conservar el path del hook; si se consume `ConnectionBadgeSkeleton`, mantener `role="status"` |
| **`WorkspacePage`** → `GraphPane/SessionsRail/InspectorPane/HistoryOverlay/MobileTabs` + hooks (07) | `WorkspacePage.spec.tsx`, **`WorkspacePage.perf.spec.tsx`** | **riesgo** | Los specs mockean **barrels de dominio** (`@app/Domains/Graph|Sessions|Inspector|History`) y `opencodeClient`; assertan `graph-skeleton`, `agent-graph`, 'Sin agentes', 'Error', '1 agentes'; el perf espía `graphHooks.useNow` | Las piezas nuevas **deben** importar por barrels de dominio; conservar el ternario **error→carga→vacío→datos**; mantener `useGraphModel` real en el árbol |
| `opencodeClient` → facade + sub-services (07) | `opencodeClient.spec.ts` (espía `opencodeClient.message.list`/`session.diff|log`), `InspectorPanel.spec.tsx`, `EventStreamProvider.spec.tsx`, `WorkspacePage*.spec.tsx` | no* | Todos importan `{ opencodeClient, opencodeService }` del mismo módulo | La facade debe reexportar `opencodeClient` y componer `opencodeService` con **exactamente** la lista FR-037 |
| `EventStreamProvider` → libs + hooks; `applyActiveSeed` a `lib/` (07) | `applyActiveSeed.spec.ts` (importa `../EventStreamProvider`), `EventStreamProvider.spec.tsx` | no* | El spec importa `applyActiveSeed` desde el provider | **Reexportar** `applyActiveSeed` desde `EventStreamProvider.tsx` (o actualizar 1 import); conservar orden `refreshActive(true)` y `server.connected` |
| Formatters consolidados / `UNAVAILABLE` → `format/constants` (07) | `ModelSection.spec.tsx` (importa `UNAVAILABLE` de `@app/Application/Helpers/formatDuration`), `formatX.spec` | **SÍ** (si se elimina el export actual) | El spec usa ruta profunda `formatDuration` | Mantener reexport `UNAVAILABLE` desde `formatDuration.ts` **o** actualizar el spec |
| `formatClock` exportado (07) | `AgentNode.spec.tsx` (usa reloj (`HH:mm`) inline) | no* | El spec reimplementa `clock` local | Sin impacto; solo no cambiar el formato |
| Tipos de pregunta compartidos (Familia 6) (04/06) | `HistoryEntry.spec.tsx`, `QuestionsSection.spec.tsx`, `HistoryModal.spec.tsx` | no* | Solo tipos | Reexport desde los entity barrels |
| `NODE_STATUS_COLOR` compartido (Familia 1) (02) | `ExecutionLanes.spec.tsx`, `AgentNode.spec.tsx`, (indirectos `StatusDot`) | no* | Se assertan las 9 clases `bg-status-*` | Conservar **exactamente** los tokens |

### Specs que importan por ruta profunda (vigilancia prioritaria)

- `ExecutionLanes.spec.tsx` → `../ExecutionLanes` (`GutterNode`, `TGutterNodeData`).
- `useGraphEnrichment.spec.tsx` → `../../lib/loadPriority` (`LOAD_CHUNK_SIZE`).
- `ModelSection.spec.tsx` → `@app/Application/Helpers/formatDuration` (`UNAVAILABLE`).
- `HistoryModal.spec.tsx` → `../../Hooks/useHistoryPagination` (mock) y `@app/Domains/History/Hooks/useHistoryPagination` (tipo).
- `ConnectionBadge.spec.tsx` → `../../Hooks/useConnectionStatus` (mock).
- `WorkspacePage*.spec.tsx` → `@app/Domains/Graph/Hooks/useNow` (re-import en mock), `@app/Domains/Graph/lib/deriveMetrics`, `@app/Domains/Graph/lib/nodeStatus`, `@app/Domains/Graph/Hooks/useGraphModel|useChainSelection|useFollowMode`.
- `AgentGraph.spec.tsx` → `../NodeFocusContext` (dentro del factory de `vi.mock`).
- `AgentNode.spec.tsx` → `../NodeFocusContext` (`EMPTY_NODE_FOCUS`, `NodeFocusProvider`).
- `applyActiveSeed.spec.ts` → `../EventStreamProvider`.

### Specs que mockean barrels

- `WorkspacePage.spec.tsx` / `WorkspacePage.perf.spec.tsx`: `@app/Domains/{Graph,Sessions,Inspector,History}` y `@app/Infrastructure/Services/opencodeClient`.
- `InspectorPanel.spec.tsx`, `useInspectorData.spec.tsx`, `EventStreamProvider.spec.tsx`: `@app/Infrastructure/Services/opencodeClient`.
- `useGraphEnrichment*.spec.tsx`, `useGraphStructure.spec.tsx`, `useGraphModel*.spec.tsx`: `opencodeService`.

---

## Riesgos de regresión y mitigaciones

### R1 — `WorkspacePage.perf.spec.tsx` es el punto más frágil (CRÍTICO)
El spec:
1. mockea el **barril** `@app/Domains/Graph` y expone `useNow: graphHooks.useNow` (espía);
2. en `beforeEach` reimporta el **deep path** `@app/Domains/Graph/Hooks/useNow` y le
   re-aplica la implementación real;
3. asserta `useNow).toHaveBeenCalledWith(1000, false|true)` y
   `summaryTicks = calls.map(([, enabled]) => enabled)` (segundo argumento).

Implicaciones:
- Mover `useNow` a `Application/Hooks/useNow.ts` y borrar `Graph/Hooks/useNow.ts` hace
  **fallar el import del spec** (módulo inexistente) → error de carga.
- Cambiar la firma a `(enabled, intervalMs)` u objeto → rompe `toHaveBeenCalledWith`
  y `summaryTicks`.
- **Mitigación:** (a) mantener un shim `Domains/Graph/Hooks/useNow.ts`
  (`export * from '@app/Application/Hooks/useNow'`); (b) decidir firma **única** y
  actualizar los 3 specs de forma coordinada; (c) que `useWorkspaceSummary` consuma
  `useNow` por el barril `@app/Domains/Graph` para que el espía lo observe; (d) preservar
  el orden del ternario y `'1 agentes'`.

### R2 — Mocks de barril vs imports profundos (ALTO)
Los specs de `WorkspacePage` sustituyen **barrels completos**. Si `GraphPane`,
`SessionsRail`, `InspectorPane`, `HistoryOverlay` o los nuevos hooks importan
componentes/hooks por rutas profundas (p. ej. `@app/Domains/Graph/Components/AgentGraph`),
el `vi.mock` deja de interceptar y se monta React Flow real → fallos y ruido.
**Mitigación:** las piezas nuevas deben importar por barrels de dominio (área 07 lo
reconoce). Excepción: reutilizar el patrón "mock del barril + import profundo de hooks
reales" que ya usan los specs.

### R3 — Contratos observables de texto/aria/orden
Preservar literalmente (asertados):
- **Resultado terminal**: `NODE_STATUS_LABEL` = `succeeded:'Terminada'`; `OUTCOME_LABEL`/`IDLE_LABEL` = `'Terminada con éxito'`. Unificar `OUTCOME_LABEL` (HistoryHeader≡HistoryEntry) mantiene el texto; unificar con `NODE_STATUS_LABEL` **no** (cambia el wording). No tocar salvo decisión del owner.
- **AgentNode**: `'1m 23s'`, `'1.5k tok'`, `'$0.0200'`, `` `${stamp} – en curso` ``, `'Intento N · próximo HH:mm'`, `'Motivo: …'`, `∥4`+`title`, `data-testid="agent-progress"`+`aria-hidden`+`animate-pulse`, opacidad `1`/`0.15`.
- **SessionSummaryBar**: `[data-status]`, `'En curso'`, `'Esperando'`, `'Fallida'`, `'Reintentando'`, `'Compactando'`, `'Interrumpida'`, `'Creada'`, `getAllByLabelText('no disponible')`=3.
- **ExecutionLanes/GutterNode**: `${stamp} – en curso`, `'8h 37m'`, `'∥ 3 en paralelo'`, `'1 agente'`, 9 clases `bg-status-*` sobre `.rounded-full`.
- **ToolCallEntry**: `aria-expanded`, `'Entrada'`, `'Resultado'`, `'Error'`, `'Completada'`, `'Fallida'`, `'Ejecutando'`, `'En curso'`, `'Sin resultado todavía.'`.
- **HistoryEntry/QuestionsSection**: `'respondida'`, `'cancelada'`, `'pendiente'`, `/Opción · A, B/`, `'Respuesta: …'`, `'Turnos en cola: N'`, `'Sin permisos ni preguntas'`, `'Ocurrió un error al cargar los datos'`.
- **HistoryModal**: `'develop'`, `getAllByLabelText('no disponible')`, `'Sin actividad registrada'`, `'Error'`, `'No se pudo cargar el histórico de la sesión.'`, `/cerrar/i`, `/razonamiento/i`+`aria-pressed`.
- **InspectorPanel**: orden Modelo→Métricas→Recursos→Duración mediana→Subagentes→Archivos, identidad antes de Modelo, `'Selecciona un nodo del grafo para ver su detalle.'`, `aria-expanded` de "Avanzado".
- **WorkspacePage**: `'Sin agentes'`, `'Error'`, `'1 agentes'`, `graph-skeleton`, `agent-graph`.

### R4 — Scoping por `.parentElement` en `InspectorPanel.spec` (ALTO)
El spec localiza el contenedor de sección con `screen.getByText('Métricas').parentElement`
y `screen.getByText('Subagentes').parentElement`. Introducir `SectionFrame`/`SectionHeading`
con un nivel extra de envoltura deja el contenido **fuera** del `parentElement` →
`within(...).getByText(...)` falla. **Mitigación:** que el heading sea hijo directo del
contenedor que también envuelve el contenido, o actualizar el spec (preferible conservar).

### R5 — Identidad de referencias / perf en `AgentGraph` (ALTO)
`reactFlowSpy.nodes`/`edges` deben conservar referencia ante hover/selección (C3) y
emitirse 1 sola medida `graph.interaction` por transición (P5, "no marcar por frame").
Extraer `useStableGraphModel`/`useGraphFocusModel`/`useGraphLayoutModel`/`useInteractionPerf`
puede cambiar deps de `useMemo` o el momento de marca. **Mitigación:** preservar deps
exactas, reconciliación (`reconcileGraphModel`+`topologySignature`) y los puntos de
`perfMark`/`perfMeasure`.

### R6 — Cambio de SDK por el split de `opencodeClient` (MEDIO)
Los specs mockean el módulo `@app/Infrastructure/Services/opencodeClient` con **solo**
`opencodeService` (algunos con solo `{ opencodeService: service }`). Si algún consumidor
pasa a importar un sub-service (`session.service.ts`, `catalog.service.ts`, …), el mock
no lo intercepta y se ejecuta el SDK real. **Mitigación:** todos los consumidores siguen
importando el agregador `opencodeService` desde la ruta canónica; los sub-services son
solo detalle de implementación de la facade.

### R7 — Reexports obligatorios (MEDIO)
Borrar cualquiera de estos rompe specs/consumidores:
`GutterNode`/`TGutterNodeData` (desde `ExecutionLanes`), `filterSubtree` (desde
`useGraphModel`), `EMPTY_EXECUTION_SIGNAL` (desde `useExecutionSignals`),
`applyActiveSeed` (desde `EventStreamProvider`), `UNAVAILABLE` (desde `formatDuration`),
`useNow`/`DEFAULT_NOW_INTERVAL_MS` en `Graph/Hooks/useNow.ts`, y las fachadas
`eventReducer`/`buildGraph`/`buildHistory`/`deriveMetrics`/`loadPriority`/`executionLevels`/`reconcileGraph`.

### R8 — `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch` (MEDIO)
Al mover helpers/imports, TypeScript **falla el build** si quedan imports muertos. El
dispatch por `case` agrupados (fallthrough sin statements) es válido, pero cualquier
statement nuevo entre labels rompe `noFallthroughCasesInSwitch`.

### R9 — `moduleResolution: "bundler"` (BAJO)
Crear a la vez `foo.ts` y `foo/index.ts` produce resolución ambigua. El patrón *facade +
subcarpeta con nombre distinto* del área 03 lo evita; `HistoryEntry/` (área 01) sustituye
el archivo, no coexiste.

### R10 — Cobertura (BAJO)
`vitest.config` excluye `Domains/**/index.ts`; los slices/helpers extraídos **sí** cuentan
para cobertura → cada pieza nueva presiona a añadir specs (alineado con Principio V/VIII).

---

## Veredicto por propuesta

| # | Propuesta | Veredicto | Frase |
|---|-----------|-----------|-------|
| 01a | `HistoryEntry` → subdirectorio + `bodies` | **segura** | Barrel/props públicos intactos; solo conservar textos y `index.ts`. |
| 01b | `ToolCallEntry` → `div.flex`→`Container` + moléculas | **segura** | Migración de markup sin cambio de contrato (aria/textos). |
| 01c | `AlertMessage` → `alertVariants` + rename | **segura** | No hay spec propia y se preservan textos/variantes. |
| 01d | `QuestionBlock`/`OUTCOME_LABEL`/`formatModelRef` compartidos | **requiere ajuste** | Colisiona con la propuesta de `questionState` del área 04 (nombre/ubicación). |
| 02a | `AgentGraph` → hooks + `ViewportControllers` + `useInteractionPerf` | **riesgosa** | C3 (identidad de refs) y P5 (medidas por transición) son contrato verificado. |
| 02b | `AgentNode` → subcomponentes + `NodeResizeHandles` | **riesgosa** | `.bg-surface-2` único, clases de `NodeResizer`, testids y textos. |
| 02c | `ExecutionLanes` → `GutterNode.tsx` + reexport | **segura** *(con reexport)* | El spec importa por `../ExecutionLanes`; reexport obligatorio. |
| 02d | `SessionSummaryBar` → `buildSummaryCounters` | **requiere ajuste** | `data-status` y etiquetas ('Esperando','Creada') deben conservarse; ojo con `NODE_STATUS_LABEL`. |
| 02e | `useGraphStructure`/`useExecutionSignals` → libs + reexports | **segura** *(con reexport)* | Firmas públicas iguales; reexportar `filterSubtree`/`EMPTY_EXECUTION_SIGNAL`. |
| 03a | `eventReducer` facade + slices | **segura** | La facade preserva todos los specifiers; cuidar lint estricto. |
| 03b | `buildHistory`/`deriveMetrics`/`loadPriority`/`executionLevels`/`reconcileGraph`/`buildGraph` facades | **segura** | Fachada + subcarpeta; paridad de campos en `buildGraph`. |
| 04a | `Inspector.service` mappers → lib + resources service | **segura** | Mantener el export de `useSessionForms`. |
| 04b | `InspectorPanel` → `InspectorIdentity`/`EmptyPrompt`/hook | **requiere ajuste** | Orden DOM y `.parentElement` son contrato. |
| 04c | `Inspector.entity` split + barrel | **segura** *(prioridad baja)* | Barrel conserva rutas; solo tipos. |
| 04d | `QuestionsSection` → filas + `questionState` | **requiere ajuste** | Duplica propuesta del área 01 (Familia 3/4); textos exactos. |
| 04e | `useInspectorData` → `useSessionMessages` (mueve SDK) | **segura** | Corrige Const. III; mantener path del agregador para el mock. |
| 05a | `sessionFilters` → 4 libs + barrel | **segura** | Barrel `export *`; contrato §5–§6 intacto. |
| 05b | `SessionCard` `nodeStatus` por prop | **segura** *(con ajuste de spec)* | Cambia props; actualizar `SessionCard.spec`. |
| 05c | `useNow` unificado (firma options) | **riesgosa** | Rompe `WorkspacePage.perf.spec` y **contradice** al área 07. |
| 05d | `LabeledSelect`/`MultiSelectFilterPopover` | **segura** | 4 conserva a11y; 5 es opcional (1 consumidor). |
| 06a | `buildHistory` (variante registro) | **segura** | Coincide con 03 en la facade; registro exhaustivo tipado. |
| 06b | `History.entity` split + barrels | **segura** | Solo tipos; mantener `export *`. |
| 06c | `HistoryHeader` → subcomponentes + selector | **requiere ajuste** | `HistoryModal.spec` asserta textos/aria y orden. |
| 06d | `HistoryModal`/`Timeline` → skeleton/sentinel/loadError | **riesgo** | Mock profundo de `useHistoryPagination`, `IntersectionObserver`, `history-sentinel`. |
| 06e | Connection: consolidar labels / rama de carga | **segura** | Mock profundo de `useConnectionStatus` debe permanecer. |
| 07a | `WorkspacePage` → panes/hooks/overlays | **riesgosa** | Barrel mocks + espía `useNow` + orden del ternario. |
| 07b | `opencodeClient` → facade + sub-services | **segura** *(con reexport)* | Debe conservar `opencodeClient`+`opencodeService` y la lista FR-037. |
| 07c | `EventStreamProvider` → libs + hooks | **segura** *(con reexport `applyActiveSeed`)* | Preservar StrictMode/backoff/batching. |
| 07d | Consolidación `totalTokens`/`formatClock`/`UNAVAILABLE` & dead code | **requiere ajuste** | Decidir hogar de `totalTokens` (colisión) y reexportar `UNAVAILABLE`. |
| 07e | `useNow` unificado (firma posicional) | **riesgosa** | Rompe `WorkspacePage.perf.spec` y **contradice** al área 05. |

---

## Discrepancias documentales

1. **`@opencode-ai/sdk` vs `@opencode/client`.** `AGENTS.md` (§Stack, §3) y la
   constitución (Principio IV) dicen que los tipos se derivan de `@opencode-ai/sdk`; el
   código importa **`@opencode/client`** (47 usos; `package.json` fija `@opencode/client`
   `2.0.22`). No existe `@opencode-ai/sdk` en dependencias. → Alinear la redacción de
   `AGENTS.md` y `constitution.md`.
2. **Zod declarado pero ausente.** AGENTS §10 exige Zod para input de usuario; `zod`
   está en `dependencies` pero **no se usa en `src/`**. Las áreas 05 (filtros) y 07
   (validación) no lo introducen. → Confirmar si §10 sigue vigente o se relaja.
3. **Firma canónica de `useNow`.** 05 propone objeto de opciones; 07 propone posicional
   `(enabled, intervalMs)`. Ambas describen el mismo objetivo (eliminar el orden invertido
   `active`/`intervalMs`) pero son **incompatibles** entre sí. → Decidir una.
4. **Hogar de `totalTokens`.** 02 y 07 → `Application/Helpers/totalTokens.ts`; 03 →
   `Graph/lib/metrics/tokens.ts` «o» `Application/Helpers`. → Unificar.
5. **Naming `questionState`/`ToolStatusBadge`.** 01 propone `Molecules/QuestionBlock.tsx`
   + `ToolStatusBadge`; 04 propone `Application/Entities/questionState.ts` +
   `QuestionStateBadge`/`ToolStatusLabel`. Misma Familia 3/4 con dos taxonomías.
6. **Dominio `Projects`.** El árbol incluye `src/Domains/Projects/` y el barrel
   `Sessions` lo consume vía hook; el listado de dominios de `AGENTS.md` (§Arquitectura)
   no menciona `Projects`. → Añadirlo.
7. **`specs/` de spec-kit.** Varias áreas citan `specs/005-session-filters/contracts/...`
   y `specs/006-graph-render-performance/contracts/...` como contrato congelado; el
   `AGENTS.md` no mapea qué features spec-kit rigen qué dominios. → Añadir índice.
8. **Números de línea de `div.flex` en `HistoryModal`.** El área 06 reporta
   `103/107/109/137`; el grep de `<div ... flex` sobre `className` literal solo ve `42,137`
   (posible uso de `cn()`/template literals). → Verificar al implementar.
9. **`ConnectionBadgeSkeleton` e `InspectorSkeleton`** están exportados en barrels sin
   consumidores (dead code) pero las áreas las dejan "para decisión del owner". → Resolver.

---

## Bloqueos (antes de implementar)

1. **Decidir la firma canónica de `useNow`** (05 vs 07) y su hogar
   (`Application/Hooks` + shim `Graph/Hooks/useNow.ts`).
2. **Coordinar `totalTokens`** (hogar único) y `questionState`/`ToolStatusBadge`
   (naming/ubicación única) entre áreas 01/02/03/04/07.
3. **Plan de actualización conjunta** de `WorkspacePage.perf.spec.tsx` (espía `useNow`,
   import profundo, `(1000, enabled)`) — sin esto, 05c/07e quedan **riesgosas**.
4. **Regla operativa para imports nuevos**: todas las piezas de `Infrastructure` deben
   importar por **barrels de dominio** para sobrevivir a los `vi.mock`.
5. **Preservar `.parentElement`** en la descomposición del panel (04b) o actualizar el
   spec de forma controlada.
6. **Confirmar `AGENTS.md`**: alias SDK real, vigencia de §10 (Zod) y lista de dominios.

---

### Resumen ejecutivo

- **Artefacto creado:** `docs/proposals/consolidacion/validacion-normativa.md`.
- **Veredictos:** mayormente **seguras** las de `lib/` con fachada (03) y las de
  `HistoryEntry`/`ToolCallEntry`/barrels; **requieren ajuste** las que tocan DOM/orden
  (`InspectorPanel`, `SessionSummaryBar`, `HistoryHeader`, `totalTokens`, `UNAVAILABLE`);
  **riesgosas** las de `AgentGraph`, `AgentNode`, `useNow` (firma/hogar) y `WorkspacePage`.
- **Riesgos críticos:** (R1) `WorkspacePage.perf.spec` (espía `useNow` + import profundo),
  (R2) mocks de barril vs imports profundos, (R4) `.parentElement` en `InspectorPanel`,
  (R5) identidad de referencias/medidas en `AgentGraph`.
- **Bloqueos:** firma de `useNow`, hogar de `totalTokens`, naming `questionState`, plan de
  actualización de specs de perf, y confirmación de discrepancias documentales (SDK/Zod).
