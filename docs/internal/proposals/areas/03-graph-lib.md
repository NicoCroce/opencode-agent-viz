# Área 03 — `Graph/lib` (+ `History/lib`, `Inspector/lib`)

> Análisis **de solo lectura**. Fuente de contexto: `docs/internal/proposals/inventario-gordos.md`
> (#1, #3, #7, #12, #13, #26, #27). Convenciones: `AGENTS.md` y `.specify/memory/constitution.md`
> (Principios IV, V, VII, VIII).

## Resumen del área

Archivos ≥150 líneas que caen en esta área (7 de los 27 GORDO del inventario):

| # inv. | Archivo | Líneas | Motivo |
|---:|---|---:|---|
| 1 | `src/Domains/Graph/lib/eventReducer.ts` | 622 | (e) OTRO |
| 3 | `src/Domains/History/lib/buildHistory.ts` | 409 | (e) OTRO |
| 7 | `src/Domains/Graph/lib/deriveMetrics.ts` | 320 | (e) OTRO |
| 12 | `src/Domains/Graph/lib/loadPriority.ts` | 221 | (e) OTRO |
| 13 | `src/Domains/Graph/lib/executionLevels.ts` | 218 | (e) OTRO |
| 26 | `src/Domains/Graph/lib/reconcileGraph.ts` | 159 | (e) OTRO |
| 27 | `src/Domains/Graph/lib/buildGraph.ts` | 152 | (e) OTRO |

**No hay archivos ≥150 en `Inspector/lib/`** (`medianToolDurations.ts` 48, `deriveTasks.ts` 69)
y **History/lib solo aporta `buildHistory.ts`**. `buildViewNodes.ts` (Graph) tiene 49 líneas:
**no aplica descomposición** (se mantiene como pieza atómica única; ver nota en §Notas).

Todas son **libs puras** (Principio V): el grosor viene de acumular derivaciones y
ramas de proyección, no de JSX. El patrón de corte es **separar por eje de
responsabilidad** (slices por familia de evento, proyección por tipo de mensaje,
cómputo por fase) y dejar un **facade** en la ruta pública original.

### Regla transversal del refactor (preservar specifiers)

Todo corte propuesto usa el patrón **facade + subcarpeta con nombre distinto**:

- El archivo público (`lib/eventReducer.ts`, `lib/buildGraph.ts`, …) **se conserva**
  y pasa a re-exportar los símbolos (fachada).
- Los internos van en una **carpeta hermana con nombre no colisionante**
  (`lib/eventReduce/`, `lib/graphBuild/`, …).

Esto evita la resolución ambigua de TypeScript/Vite (`moduleResolution: "bundler"`)
cuando existen a la vez `<nombre>.ts` y `<nombre>/index.ts`, y deja **intactos todos
los import specifiers** de consumidores y specs. En consecuencia, los specs de
`lib/specs/` **no requieren cambios de import** si la fachada re-exporta la API
pública exacta.

---

## Propuestas por archivo

### `src/Domains/Graph/lib/eventReducer.ts` — 622 líneas (motivo: (e) OTRO)

Contiene: tipos de update, ~15 helpers de normalización de caché (mensajes, contenido,
tool, señales, permisos) y un `switch` de ~40 casos. **Corte concreto por familia de
evento** (slices) + helpers por dominio:

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (firma/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| Contrato de update + scopes | tipo + funcion-pura | `lib/eventReduce/queryUpdates.ts` | `TQueryUpdate`, `TEventUpdate`; `set(queryKey, updater)`, `invalidate(queryKey)`, `invalidateSessionLists()`, `sameQueryKey(a,b): boolean` | `eventReducer` index; specs `eventReducer`/`buildGraph`; `useExecutionSignals` (hoy reimplementa `sameKey`) | 40 |
| Tipos de evento reducible | tipo | `lib/eventReduce/eventTypes.ts` | `TReducibleEvent = V2Event \| SessionMessageContentUpdated`; `TToolEvent` (unión de los 4 eventos de tool) | index; specs; `useExecutionSignals` | 25 |
| Primitivas de caché | funcion-pura | `lib/eventReduce/cache.ts` | `messagesOf(prev): TSessionMessage[]`, `signalsOf(prev): Record<string, TExecutionSignal>`, `setStatus(prev, sessionID, status)`, `removeSession(prev, id): SessionInfo[]`, `asRecord(value): Record<string, never>` | `messageParts`, slices | 45 |
| Patchers de mensaje/contenido/tool | funcion-pura | `lib/eventReduce/messageParts.ts` | `withParts`, `patchMessage`, `patchAssistantInfo`, `upsertAssistantShell`, `textPart`, `reasoningPart`, `upsertContentPart`, `replaceContent`, `upsertToolPart`, `toolPartFrom`, `inheritedInput` | slice `messages`; Inspector (reutilizar construcción de `TToolPart` desde eventos) | 120 |
| Señal de ejecución | constante + funcion-pura | `lib/eventReduce/signals.ts` | `EMPTY_SIGNAL: TExecutionSignal`; `patchExecution(prev, sessionID, patch)` | slice `execution`; `useExecutionSignals` (unifica Familia 7 con `EMPTY_EXECUTION_SIGNAL`) | 20 |
| Permisos | funcion-pura | `lib/eventReduce/permissions.ts` | `upsertPermission(prev, permission)`, `removePermission(prev, permissionID)` | slice `permissions` | 20 |
| Slice conexión | reducer-slice | `lib/eventReduce/slices/connection.ts` | `reduceConnection(event): TEventUpdate \| null` — `server.connected` | index | 12 |
| Slice ciclo de vida de sesión | reducer-slice | `lib/eventReduce/slices/sessionLifecycle.ts` | `reduceSessionLifecycle(event): TEventUpdate \| null` — `session.created / renamed / metadata.updated / moved / usage.updated / forked / agent.selected / model.selected` (invalidan listas), `session.deleted`, `session.status`, `session.idle` | index | 75 |
| Slice ejecución / señales | reducer-slice | `lib/eventReduce/slices/execution.ts` | `reduceExecution(event): TEventUpdate \| null` — `session.execution.started / succeeded / failed / interrupted`, `session.retry.scheduled`, `session.compaction.started / ended / failed` | index | 70 |
| Slice mensajes | reducer-slice | `lib/eventReduce/slices/messages.ts` | `reduceMessages(event): TEventUpdate \| null` — `session.step.started / ended / failed`, `session.text.ended`, `session.reasoning.ended`, `session.message.content.updated`, `session.tool.input.started / called / success / failed` | index | 85 |
| Slice permisos | reducer-slice | `lib/eventReduce/slices/permissions.ts` | `reducePermissions(event): TEventUpdate \| null` — `permission.asked`, `permission.replied` | index | 25 |
| Slice forms / inbox | reducer-slice | `lib/eventReduce/slices/formsInbox.ts` | `reduceFormsInbox(event): TEventUpdate \| null` — `session.inbox.delivered / enqueued / cancelled / delivery.changed`, `form.created / replied / cancelled` | index | 25 |
| Slice deltas ignorados | reducer-slice | `lib/eventReduce/slices/ignored.ts` | `IGNORED_EVENT_TYPES: ReadonlySet<string>` (`session.text.delta`, `reasoning.delta`, `tool.input.delta`, `tool.progress`, `compaction.delta`) → `null` documentado (FR-005, Principio VII) | index; specs (iteran deltas) | 15 |
| Facade / dispatch público | funcion-pura | `lib/eventReducer.ts` (**se conserva**) | `reduceEvent(event: TReducibleEvent): TEventUpdate \| null`; re-exporta `TQueryUpdate`, `TEventUpdate`, `TReducibleEvent`, `TSessionMessageCache` | `EventStreamProvider`, `useExecutionSignals`, specs | 90 |

**Estrategia de dispatch (tipado):** mantén un `switch (event.type)` en el facade con
**cases agrupados por fallthrough** hacia el slice correspondiente
(`case 'session.created': … return reduceSessionLifecycle(event);`). El fallthrough agrupado
respeta `noFallthroughCasesInSwitch` (no hay statements entre labels) y deja que TS
narrowée el parámetro del slice a la unión de sus eventos sin `as` ni tablas `Record`
con narrowing manual. Cada slice replica internamente su `switch` exhaustivo.

**Resultado estimado:** 13 archivos, **mayor pieza ~120 líneas** (facade 90, mensajes 85).
Sin archivo >150. Lógica y orden de casos idénticos (paridad byte-a-byte del comportamiento).

**Riesgos/specs afectados:**
- Specs que importan el reducer: `lib/specs/eventReducer.spec.ts` (`../eventReducer`, `TReducibleEvent`),
  `lib/specs/buildGraph.spec.ts` (`../eventReducer`, `TQueryUpdate`),
  `lib/specs/live.integration.spec.ts` (ídem), `Hooks/specs/useExecutionSignals.spec.tsx`,
  `Hooks/specs/useGraphEnrichment.freshness.spec.tsx`, `Components`/`EventStreamProvider` (runtime).
  **Con facade no cambia ningún import**; solo se añadiría cobertura unitaria nueva por slice.
- Riesgo real: `noUnusedLocals`/`noUnusedParameters` estrictos al mover helpers (imports muertos).
- `TSessionMessageCache` está exportado hoy; debe seguir re-exportado por el facade.
- Al extraer `sameQueryKey` se unifica el helper `sameKey` hoy duplicado en `buildGraph.spec.ts`,
  `eventReducer.spec.ts` y `useExecutionSignals.ts` (no tocar los specs; solo el helper de prod).

---

### `src/Domains/History/lib/buildHistory.ts` — 409 líneas (motivo: (e) OTRO)

Contiene: proyección de mensajes (`switch` de 14 tipos de `SessionMessageInfo`),
proyección de partes del assistant (`switch` de 3 tipos), normalizadores
(attachments/tool/exit/compaction) y el bloque FR-033 de merge de preguntas.

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (firma/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| Entrada `id`/`at` de mensaje | funcion-pura | `lib/history/messageEntries.ts` | `toMessageEntries(message: TSessionMessage): THistoryEntry[]`; incluye `toAssistantEntries(info, parts, at)`, `toAttachments(info: SessionMessageUser)`, `toExit(exit)`, `toCompactionSummary(info)` | `buildHistory`; Inspector (entradas de mensaje) | 120 |
| Proyección de tool | funcion-pura | `lib/history/toolEntry.ts` | `toToolEntry(part: SessionMessageAssistantTool): TToolEntry`; `toolContentToText(content: readonly ToolContent[]): string` | `messageEntries`; `Inspector/Components/ToolHistory` (serialización de output) | 45 |
| Merge de preguntas (FR-033) | funcion-pura | `lib/history/questions.ts` | `mergeQuestions(entries, questions): THistoryEntry[]`; `candidateTitles(input: unknown): string[]`; `pickAnchor(anchors, used, question)`; `toQuestionEntry(question, at, anchorId)`; `TQuestionAnchor` | `buildHistory`; Inspector (matching form↔tool) | 105 |
| Facade público | funcion-pura | `lib/buildHistory.ts` (**se conserva**) | `buildHistory(messages, options?): THistoryEntry[]`; `BuildHistoryOptions` | `useHistoryPagination` (History), `useInspectorData` (Inspector) | 60 |

**Resultado estimado:** 4 archivos, **mayor pieza ~120 líneas**. Sin archivo >150.
Se preserva la firma pública y el orden de entradas.

**Riesgos/specs afectados:**
- `lib/specs/buildHistory.spec.ts` importa `../buildHistory` → **sin cambios** con facade.
- `lib/specs/live.integration.spec.ts` importa `@app/Domains/History/lib/buildHistory` → sin cambios.
- `candidateTitles` es heurística recursiva con `depth > 4`; al aislarla conviene un spec
  propio (`lib/specs/questions.spec.ts`) para fijar el contrato de extracción de títulos.
- No mover tipos: `THistoryEntry`/`THistoryQuestion` se quedan en `History.entity.ts`.

---

### `src/Domains/Graph/lib/deriveMetrics.ts` — 320 líneas (motivo: (e) OTRO)

Contiene: acumulación de tokens, `deriveMetricBase` (barrido único), `resolveMetrics`,
`deriveMetrics` (wrapper) y `summarizeSession` + `sumNullable`.

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (firma/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| Acumulación/forma de tokens | funcion-pura + tipo | `lib/metrics/tokens.ts` | `accumulateTokens(tokens: SdkTokens, acc: TokenAccumulator, seen: TokenSeen): void`; `toTokenUsage(acc, seen): TTokenUsage \| null`; `totalTokens(usage: TTokenUsage \| null): number \| null`; `SdkTokens`, `TokenAccumulator`, `TokenSeen` | `deriveMetricBase`, `summarizeSession`; `AgentNode`/`HistoryHeader`/`SessionSummaryBar` (unifica Familia 5 `totalTokens()`) | 70 |
| Base sin reloj | funcion-pura | `lib/metrics/deriveMetricBase.ts` | `deriveMetricBase(messages: TSessionMessageLike[]): TMetricBase` | `buildGraph`, `useGraphEnrichment`, specs | 110 |
| Resolución dependiente del reloj | funcion-pura | `lib/metrics/resolveMetrics.ts` | `resolveMetrics(base: TMetricBase, status: SessionStatus \| undefined, now: number, subtaskInvocations: number): TNodeMetrics`; `deriveMetrics(input: DeriveMetricsInput): TNodeMetrics`; `DeriveMetricsInput` | `buildGraph`, hooks, specs | 60 |
| Resumen de sesión | funcion-pura | `lib/metrics/summarizeSession.ts` | `summarizeSession(root: SessionInfo, graph: TGraphModel, resourceUsage: TResourceUsage, now: number): TSessionSummary`; `sumNullable(values: readonly (number \| null)[]): number \| null` | `SessionSummaryBar` (vía hook); `sumNullable` genérico | 115 |
| Facade público | funcion-pura | `lib/deriveMetrics.ts` (**se conserva**) | Re-exporta `deriveMetricBase`, `resolveMetrics`, `deriveMetrics`, `summarizeSession`, `TSessionMessageLike`, `DeriveMetricsInput` | `buildGraph`, `useGraphEnrichment`, barrel `Graph/index.ts`, specs | 15 |

**Decisión explícita:** `deriveMetricBase` **no se trocea internamente**. Calcula
`model`, `currentTool`, `lastAssistantErrored`, tiempos, costo y tokens en **un solo
recorrido** (comentario R3 del archivo). Separarlos a funciones por campo rompería la
garantía de barrido único / rendimiento (Principio VII). El corte es por **fase**
(base estructural → resolución por reloj → agregación), no por campo.

**Resultado estimado:** 5 archivos, **mayor pieza ~115 líneas**. Sin archivo >150.

**Riesgos/specs afectados:**
- `lib/specs/deriveMetrics.spec.ts` importa `deriveMetricBase`, `deriveMetrics`,
  `resolveMetrics`, `summarizeSession` de `../deriveMetrics` → **sin cambios** con facade.
- `lib/specs/buildGraph.spec.ts` y `Hooks/specs/useGraphEnrichment.spec.tsx` importan
  `deriveMetrics`/`deriveMetricBase`/`resolveMetrics` → sin cambios.
- `TSessionMessageLike` es un alias trivial de `TSessionMessage`; se puede eliminar y
  usar el tipo directo (limpieza opcional, no obligatoria para el corte).

---

### `src/Domains/Graph/lib/loadPriority.ts` — 221 líneas (motivo: (e) OTRO)

Contiene: constantes de tamaño de lote, tipos de opciones/plan, `toStructuralModel`,
`ancestorChain`, `executionLevelOrder`, `orderSubtreeForLoad` y `chunkLoadPlan`.

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (firma/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| Modelo estructural mínimo | funcion-pura | `lib/loadPlan/toStructuralModel.ts` | `toStructuralModel(subtree: readonly SessionInfo[]): TGraphModel` | `executionLevelOrder`; cualquier `SessionInfo[]`→topología (enriquecimiento, tests) | 45 |
| Recorrido de árbol | funcion-pura | `lib/loadPlan/traversal.ts` | `ancestorChain(id, byId): string[]`; `executionLevelOrder(subtree, byId): string[]`; `compareByTimeThenId(byId): (a,b)=>number` | `orderSubtreeForLoad`; `executionLevels` (mismo criterio `created`+`id`) | 60 |
| Orden de prioridad | funcion-pura | `lib/loadPlan/orderSubtreeForLoad.ts` | `TLoadOptions`, `TLoadPlan`; `orderSubtreeForLoad(subtree, options): TLoadPlan` | `useGraphEnrichment` | 95 |
| Troceado genérico | funcion-pura + constante | `lib/loadPlan/chunk.ts` | `LOAD_CHUNK_SIZE = 8`; `chunkLoadPlan(orderedIds, size?): string[][]` (o `chunkArray<T>` genérico) | `useGraphEnrichment`; candidato a `Application/Helpers` | 30 |
| Facade público | funcion-pura | `lib/loadPriority.ts` (**se conserva**) | Re-exporta `LOAD_CHUNK_SIZE`, `chunkLoadPlan`, `orderSubtreeForLoad`, `TLoadOptions`, `TLoadPlan` | `useGraphEnrichment`, specs | 15 |

**Resultado estimado:** 5 archivos, **mayor pieza ~95 líneas**. Sin archivo >150.

**Riesgos/specs afectados:**
- `lib/specs/loadPriority.spec.ts` importa `LOAD_CHUNK_SIZE`, `chunkLoadPlan`,
  `orderSubtreeForLoad`, `TLoadOptions` de `../loadPriority` → **sin cambios** con facade.
- `Hooks/specs/useGraphEnrichment.spec.tsx` importa `LOAD_CHUNK_SIZE` → sin cambios.
- `toStructuralModel` comparte el comparador `executionLevelOrder` con
  `deriveExecutionLevels`; extraerlo evita divergencia futura (ver §Piezas compartidas).

---

### `src/Domains/Graph/lib/executionLevels.ts` — 218 líneas (motivo: (e) OTRO)

Contiene: 6 constantes geométricas, `executionColumnX`/`executionRailX`, tipos de
plan/fila, `startOf`/`endOf` y 3 derivaciones de layout.

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (firma/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| Geometría de carriles | constante + funcion-pura | `lib/execution/geometry.ts` | `EXECUTION_GUTTER`, `EXECUTION_COLUMN_LEFT_PAD`, `EXECUTION_COLUMN_GAP`, `EXECUTION_RAIL_OFFSET`, `EXECUTION_ROW_PAD`, `EXECUTION_ROW_HEIGHT`; `executionColumnX(column): number`; `executionRailX(column): number` | `ExecutionLanes.tsx`, edge routing, specs | 45 |
| Intervalo temporal de nodo | funcion-pura + tipo | `lib/execution/nodeInterval.ts` | `startOf(node: TGraphNode): number`; `endOf(node: TGraphNode, now: number): number` | `deriveExecutionLevels`; **unifica** `intervalOf` de `parallelism.ts` (ver §Piezas) | 25 |
| Niveles de ejecución | funcion-pura + tipo | `lib/execution/deriveExecutionLevels.ts` | `TExecutionLevel`, `TExecutionPlan`; `deriveExecutionLevels(model, now): TExecutionPlan` | `AgentGraph`, `ExecutionLanes`, `useGraphModel`, `useGraphStructure`, `loadPriority` | 100 |
| Layout de filas / posicionamiento | funcion-pura + tipo | `lib/execution/layoutRows.ts` | `TRowLayout`; `deriveRowLayout(plan, heightByNode): TRowLayout`; `layoutExecution(model, plan): TGraphModel` | `AgentGraph`, specs | 55 |
| Facade público | funcion-pura | `lib/executionLevels.ts` (**se conserva**) | Re-exporta constantes, tipos, `executionColumnX`, `executionRailX`, `deriveExecutionLevels`, `deriveRowLayout`, `layoutExecution` | barrel `Graph/index.ts`, componentes, specs | 15 |

**Resultado estimado:** 5 archivos, **mayor pieza ~100 líneas**. Sin archivo >150.

**Riesgos/specs afectados:**
- `lib/specs/executionLevels.spec.ts` importa constantes + funciones de `../executionLevels`
  → **sin cambios** con facade.
- `lib/specs/loadPriority.spec.ts` (usa `deriveExecutionLevels` indirectamente).
- `Components/specs/AgentGraph.spec.tsx` importa `TExecutionPlan` de `../../lib/executionLevels`
  → sin cambios.
- `EXECUTION_ROW_HEIGHT` deriva de `NODE_CARD_HEIGHT`; al mover la constante se mantiene la
  dependencia con `layoutGraph.ts` (import bidireccional dentro del dominio, aceptable).

---

### `src/Domains/Graph/lib/reconcileGraph.ts` — 159 líneas (motivo: (e) OTRO)

Contiene: 9 comparadores `same*` + `reconcileGraphModel`.

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (firma/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| Comparadores de valor | funcion-pura | `lib/reconcile/comparators.ts` | `sameStringArray(a,b)`, `sameTokenUsage(a,b)`, `sameMetrics(a,b)`, `sameModel(a,b)`, `sameRetry(a,b)`, `sameCurrentTool(a,b)`, `sameParallel(a,b)`, `sameNodeData(a,b)`, `sameNode(a,b)` | `reconcileGraphModel`; comparadores de props de `React.memo`; specs | 100 |
| Reconciliación de modelo | funcion-pura | `lib/reconcileGraph.ts` (**se conserva**) | `reconcileGraphModel(prev: TGraphModel \| null, next: TGraphModel): TGraphModel`; re-exporta comparadores si se desean testear aislados | `AgentGraph`, specs | 60 |

**Resultado estimado:** 2 archivos, **mayor pieza ~100 líneas**. Sin archivo >150.

**Riesgos/specs afectados:**
- `lib/specs/reconcileGraph.spec.ts` importa `../reconcileGraph` → **sin cambios**.
- `sameStringArray` y `sameTokenUsage` son genéricos de facto → candidatos a un
  `equals` compartido (§Piezas atómicas).
- El corte más pequeño (~60) no es urgente, pero aísla los comparadores, que son la
  pieza reutilizable real; el `reconcileGraphModel` en sí ya es atómico.

---

### `src/Domains/Graph/lib/buildGraph.ts` — 152 líneas (motivo: (e) OTRO)

Contiene: `BuildGraphInput`, `hasPendingForm` y `buildGraph` (construcción por nodo
campo a campo + aristas).

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (firma/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| Detección de form pendiente | funcion-pura | `lib/graphBuild/hasPendingForm.ts` | `hasPendingForm(forms: FormDetail[], sessionId: string): boolean` | `buildGraph`; Inspector (espera de input) | 12 |
| Construcción de nodo | funcion-pura | `lib/graphBuild/toGraphNode.ts` | `TGraphNodeContext` (statuses, messages, permissions, signals, forms, agents, enrichment, now); `toGraphNode(session: SessionInfo, ctx: TGraphNodeContext): TGraphNode` | `buildGraph` | 80 |
| Construcción de aristas | funcion-pura | `lib/graphBuild/buildEdges.ts` | `buildEdges(sessions: readonly SessionInfo[], nodeIds: ReadonlySet<string>): TGraphEdge[]` | `buildGraph`; `toStructuralModel` (misma forma de arista) | 25 |
| Facade público | funcion-pura | `lib/buildGraph.ts` (**se conserva**) | `buildGraph(input: BuildGraphInput): TGraphModel`; `BuildGraphInput` | `useGraphStructure`, hooks, specs, barrel | 35 |

**Resultado estimado:** 4 archivos, **mayor pieza ~80 líneas**. Sin archivo >150.

**Riesgos/specs afectados:**
- `lib/specs/buildGraph.spec.ts` (990 líneas, incluye contraste de paridad) importa
  `buildGraph`, `BuildGraphInput` de `../buildGraph` → **sin cambios** con facade.
  La paridad campo a campo sigue garantizada si `toGraphNode` conserva exactamente los
  mismos campos (mismos `null`, mismo orden de spreads).
- `Hooks/specs/useGraphEnrichment*.spec.tsx` importan `buildGraph` → sin cambios.
- Riesgo: el contraste de paridad es sensible al orden/valores de los campos del nodo;
  mover la construcción a `toGraphNode` sin tocar la semántica es seguro.

---

## Piezas atómicas listas para compartir

Candidatas a `Application/Helpers` o a un futuro `Graph/lib/shared` (con consumidores
concretos previstos, no "helpers genéricos"):

| Pieza | Origen | Firma propuesta | Destino sugerido | Consumidores previstos |
|---|---|---|---|---|
| `chunkArray<T>` | `loadPriority.chunkLoadPlan` | `chunkArray<T>(items: readonly T[], size: number): T[][]` | `Application/Helpers/array.ts` | `useGraphEnrichment`; paging/batching en cualquier dominio |
| `sumNullable` | `deriveMetrics` | `sumNullable(values: readonly (number \| null)[]): number \| null` | `Application/Helpers/number.ts` | `summarizeSession`; métricas de `SessionSummaryBar` |
| `toTokenUsage` + `accumulateTokens` | `deriveMetrics` | `toTokenUsage(acc: TokenAccumulator, seen: TokenSeen): TTokenUsage \| null`; `accumulateTokens(tokens: SdkTokens, acc, seen): void` | `Graph/lib/metrics/tokens.ts` (dominio) | `deriveMetricBase`, `summarizeSession` |
| `totalTokens` (unifica Familia 5) | componentes `AgentNode`, `HistoryHeader`, `SessionSummaryBar` | `totalTokens(usage: TTokenUsage \| null): number \| null` | `Graph/lib/metrics/tokens.ts` o `Application/Helpers/tokens.ts` | los 3 componentes de la Familia 5 del inventario |
| `sameQueryKey` | `eventReducer` (y 3 copias de `sameKey`) | `sameQueryKey(a: readonly unknown[], b: readonly unknown[]): boolean` | `Application/Helpers` o `Infrastructure/queryKeys` | `eventReducer` slice; `useExecutionSignals`; specs |
| `nodeInterval` / `compareByTimeThenId` | `executionLevels.startOf/endOf` + `parallelism.intervalOf` + `loadPriority.compare` | `startOf(node)`, `endOf(node, now)`, `compareByTimeThenId` | `Graph/lib/execution/nodeInterval.ts` | `deriveExecutionLevels`, `deriveSiblingBatches`, `orderSubtreeForLoad` |
| `toolContentToText` | `buildHistory` | `toolContentToText(content: readonly ToolContent[]): string` | `History/lib/history/toolEntry.ts` | `ToolHistory` (Inspector) para output serializado |
| `buildEdges` | `buildGraph` | `buildEdges(sessions, nodeIds): TGraphEdge[]` | `Graph/lib/graphBuild/buildEdges.ts` | `buildGraph`, `loadPriority.toStructuralModel` |

**Duplicación confirmada dentro del área (hallazgo decisivo):**
- `executionLevels.startOf/endOf` (líneas 62–66) y `parallelism.intervalOf` (líneas 10–15)
  derivan el mismo intervalo `[inicio, fin]` de un nodo, pero **divergen en el fallback
  del inicio**: `startOf` usa `0`, `intervalOf` usa `now`. Unificar en un solo
  `nodeInterval` es una mejora de corrección además de DRY.
- `EMPTY_SIGNAL` (`eventReducer.ts:212`) y `EMPTY_EXECUTION_SIGNAL`
  (`useExecutionSignals.ts:10`) son el mismo literal (Familia 7); el corte permite
  exportar uno canónico desde `lib/eventReduce/signals.ts`.

---

## Notas / discrepancias con convenciones

1. **`buildViewNodes.ts` (49 líneas) no se descompone.** Es una única función pura con
   contrato claro (`node + overrides + selección → view node`); no aplica el umbral ni
   hay eje de corte. Se mantiene como pieza atómica.
2. **`deriveMetricBase` no se trocea por campo** (barrido único, R3 / Principio VII).
   El corte es por fase, no por derivación.
3. **Nomenclatura de tipos SDK:** el inventario/`AGENTS.md` dicen "derivados de
   `@opencode-ai/sdk`", pero el código importa de **`@opencode/client`** (p. ej. `V2Event`,
   `SessionInfo`, `FormDetail`). Discrepancia preexistente documental; el refactor no la
   cambia, pero conviene alinear la redacción de `AGENTS.md`/constitución con el alias real.
4. **Tests en `lib/specs/`:** toda pieza extraída debe testearse ahí (Principio VIII).
   Recomendación: mantener los specs existentes apuntando a las fachadas (sin cambios) y
   **añadir** specs focalizados para las piezas nuevas reutilizables:
   `lib/specs/questions.spec.ts` (History), `lib/specs/tokens.spec.ts`,
   `lib/specs/reconcileComparators.spec.ts`, `lib/specs/nodeInterval.spec.ts`.
   Ojo: `Graph/lib/specs/*` cubre solo Graph; los de History van en
   `History/lib/specs/` (junto a `buildHistory.spec.ts`).
5. **`noFallthroughCasesInSwitch`** y **`noUnusedLocals`** están activos: el dispatch por
   cases agrupados es válido, pero el movimiento de imports debe ser limpio o el build falla.
6. **Coverage de Vitest** excluye `Domains/**/index.ts`; los slices/helpers nuevos **sí
   cuentan** para cobertura, lo que empuja a tests por pieza (alineado con Principio V).
7. **Cross-domain en libs:** `deriveMetrics` importa `TResourceUsage`/`TSessionSummary` de
   `Inspector.entity`, y `useInspectorData`/`useHistoryPagination` consumen `buildHistory`.
   Eso ya existe y está permitido (la restricción de cross-domain aplica a componentes);
   el corte no debe introducir nuevos acoplamientos entre dominios: las piezas compartidas
   genéricas van a `Application/Helpers`, no a un dominio ajeno.
