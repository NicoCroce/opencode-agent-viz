# 02 — Graph View (Components + Hooks)

> Análisis **de solo lectura** del área `src/Domains/Graph/Components/**` y
> `src/Domains/Graph/Hooks/**`. Solo archivos ≥150 líneas (umbral del
> `inventario-gordos.md`). Los `.ts` puros de `src/Domains/Graph/lib/**` los
> analiza otro agente: aquí se proponen **destinos nuevos** dentro de `lib/`,
> nunca la reescritura de los existentes.

## Resumen del área

Siete archivos superan el umbral, **3 componentes + 3 hooks + 1 hook de señales**.
A diferencia de otros dominios, aquí el peso no es solo JSX: tres hooks superan
las 160 líneas por acumular derivación pura, I/O de caché y planificación.

| # | Archivo | Líneas | Motivo primario |
|---|---------|-------:|-----------------|
| 1 | `Components/AgentGraph.tsx` | 358 | **(c) LOGICA-MEZCLADA** — derivaciones (nodos de vista, aristas, `statusByLevel`, `rowLayout`, reconcile, métricas de interacción) + 2 controladores React Flow + JSX |
| 2 | `Hooks/useGraphEnrichment.ts` | 351 | **(e) OTRO** — scheduling en idle, carga por lotes, escritura en caché y fusión de enriquecimiento |
| 3 | `Components/AgentNode.tsx` | 215 | **(d) JSX-GORDO** — render único con 4 secciones condicionales + `totalTokens`/`formatClock` locales |
| 4 | `Hooks/useGraphStructure.ts` | 195 | **(e) OTRO** — BFS de subárbol + `buildGraph` + layout + paralelismo, todo memoizado |
| 5 | `Components/ExecutionLanes.tsx` | 171 | **(a) SUBCOMPONENTES** — `GutterNode` + `ExecutionLanes` + builder `buildGutterNodes` + mapa `STATUS_DOT` |
| 6 | `Components/SessionSummaryBar.tsx` | 163 | **(d) JSX-GORDO** — array de 8 contadores + 3 grupos de métrica + `Unavailable` + `totalTokens` |
| 7 | `Hooks/useExecutionSignals.ts` | 161 | **(e) OTRO** — siembra durable + merge de señales de ejecución |

**Observaciones decisivas del área:**

1. **Familia 1 de duplicación** (color por `TNodeStatus`) tiene aquí **dos de sus
   tres copias**: `ExecutionLanes.STATUS_DOT` y `NodeStatusRail.RAIL_COLOR`,
   idénticas entre sí y con `StatusDot.STATUS_COLOR` (`Application`).
2. **`AgentGraph` mezcla** dos controladores React Flow (`FollowController` +
   `FitViewController`, líneas 88-119) con 7 `useMemo` de derivación y el render.
3. **`totalTokens` está triplicado** (AgentNode, SessionSummaryBar,
   `History/HistoryHeader`) — último consumidor en el área.
4. **Duplicación de señal vacía**: `EMPTY_EXECUTION_SIGNAL` (`useExecutionSignals`)
   vs `EMPTY_SIGNAL` (`lib/eventReducer`), y `mergeExecutionSignals`/
   `normalizeSignal` repartidos entre `useExecutionSignals` y `useGraphEnrichment`.
5. **`buildGutterNodes` y `filterSubtree` son funciones puras que viven en
   archivos de componentes/hooks** — deberían estar en `lib/`.
6. **Acoplamiento cross-domain no resuelto**: `SessionSummaryBar` (componente)
   importa `TSessionSummary` de `Inspector/Inspector.entity`.

---

## Propuestas por archivo

### `src/Domains/Graph/Components/AgentGraph.tsx` — 358 líneas (motivo: (c) LOGICA-MEZCLADA)

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|-----------------|------|------------------------|--------------------------|------------------|-----------------:|
| `ViewportControllers` | subcomponente | `src/Domains/Graph/Components/ViewportControllers.tsx` | `FollowController({ nodeId: string \| null })`; `FitViewController({ signature: string })` — ambos devuelven `null` y usan `useReactFlow` | Solo Graph; cualquier grafo React Flow que siga un nodo/encuadre por firma | ~34 |
| `useStableGraphModel` | hook | `src/Domains/Graph/Hooks/useStableGraphModel.ts` | `(graph: TGraphModel) => { graph: TGraphModel; signature: string }` (usa `reconcileGraphModel` + `topologySignature`) | `AgentGraph`; futuros consumidores de React Flow (identidad estable) | ~28 |
| `useGraphFocusModel` | hook | `src/Domains/Graph/Hooks/useGraphFocusModel.ts` | `(graph: TGraphModel, selectedNodeId: string \| null) => { hoveredNodeId; setHoveredNodeId; focus: TNodeFocus }` (deriva `deriveLineage`) | `AgentGraph`; paneles de linaje que lean el foco | ~30 |
| `useGraphLayoutModel` | hook | `src/Domains/Graph/Hooks/useGraphLayoutModel.ts` | `(graph, plan: TExecutionPlan, overrides) => { statusByLevel; activeLevel; rowLayout; heightByNode; viewNodes; nodes; edges }` | `AgentGraph`; `ExecutionLanes` reutiliza `rowLayout`/`activeLevel` | ~110 |
| `useInteractionPerf` | hook | `src/Domains/Graph/Hooks/useInteractionPerf.ts` | `({ hoveredNodeId, selectedNodeId, nodeCount }) => void` — marca/mide `graph.interaction` por transición | `AgentGraph`; cualquier superficie interactiva instrumentada | ~32 |
| `STATUS_RANK` + `dominantStatus` | funcion-pura | `src/Domains/Graph/lib/nodeStatusRank.ts` | `STATUS_RANK: Record<TNodeStatus, number>`; `dominantStatus(current: TNodeStatus \| undefined, candidate: TNodeStatus): TNodeStatus` | `useGraphLayoutModel`; agregación de estado por nivel/sesión | ~22 |
| `isGutterNode` | funcion-pura | `src/Domains/Graph/Components/GutterNode.tsx` (export) | `(node: { type?: unknown }) => boolean` | `AgentGraph` (los 3 handlers con guard) | ~4 |
| `REST_EDGE_STYLE` | constante/compartido | `src/Domains/Graph/Components/InvocationEdge.tsx` (export) | `CSSProperties` (stroke `--muted-foreground`, 1.25, 0.45) | `AgentGraph` (fallback de aristas), `InvocationEdge` | ~6 |

**Resultado estimado:** `AgentGraph.tsx` baja a **~70-90 líneas** (solo
orquestación: `ReactFlowProvider` + `NodeFocusProvider` + `<ReactFlow>` + los 2
controladores). El resto del archivo (~200 líneas) pasa a 2 hooks de derivación,
3 hooks auxiliares y 1 lib pura.

**Riesgos/specs afectados:**
- `Components/specs/AgentGraph.spec.tsx` verifica: estabilidad de referencia de
  `nodes`/`edges` ante hover/selección (C3), número de medidas `perf` por
  transición (P5, con `perfMark`/`perfMeasure` mockeados), paridad de linaje
  (FR-007/SC-006) y doble clic → histórico (T039). Hay que **preservar las deps
  exactas de cada `useMemo`** y los nombres de las marcas (`INTERACTION_HOVER_MARK`
  / `INTERACTION_SELECT_MARK`) al extraer; mover el perf a `useInteractionPerf`
  no debe cambiar cuántas medidas emite por transición.
- El mock de `@xyflow/react` captura las props de `<ReactFlow>`; el orden/forma
  de `nodes`/`edges` no debe cambiar.

---

### `src/Domains/Graph/Hooks/useGraphEnrichment.ts` — 351 líneas (motivo: (e) OTRO)

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|-----------------|------|------------------------|--------------------------|------------------|-----------------:|
| `executionSignal` | funcion-pura + constante | `src/Domains/Graph/lib/executionSignal.ts` | `EMPTY_EXECUTION_SIGNAL`; `normalizeSignal(s): TExecutionSignal`; `mergeExecutionSignals(seed, live?): TExecutionSignal`; `sameExecutionSignal(a,b): boolean` | `useExecutionSignals`, `useGraphEnrichment`, `deriveExecutionSignals`, `eventReducer` (Familia 7) | ~45 |
| `scheduleIdle` | funcion-pura | `src/Application/Helpers/scheduleIdle.ts` | `(callback: () => void) => { cancel: () => void }` (rIC con fallback a `setTimeout`) | `useGraphEnrichment`; cualquier trabajo diferido por lotes | ~14 |
| `sessionInfoFromNode` | funcion-pura | `src/Domains/Graph/lib/sessionInfoFromNode.ts` | `(node: TGraphNode, parentId?: string) => SessionInfo` (reconstruye la `SessionInfo` mínima) | `buildEnrichmentPlan`; cualquier fase que necesite `SessionInfo` desde un nodo | ~20 |
| `loadNodeContent` | funcion-pura (async, I/O de caché) | `src/Domains/Graph/lib/loadNodeContent.ts` | `(queryClient: QueryClient, id: string) => Promise<void>` — escribe las 6 claves compartidas con `eventReducer` | `useGraphEnrichment`; reutilizable por precarga | ~52 |
| `enrichNodeData` | funcion-pura | `src/Domains/Graph/lib/enrichNodeData.ts` | `(input: { node; messages; permissions; formDetails; sessionStatus; signal; now }) => TGraphNodeData` (recibe datos resueltos, no `queryClient`) | `useGraphEnrichment`; paridad con `buildGraph` (R1/R3) | ~65 |
| `buildEnrichmentPlan` | funcion-pura | `src/Domains/Graph/lib/buildEnrichmentPlan.ts` | `(structure: TGraphModel, ids: string[], readyIds: ReadonlySet<string>) => TLoadPlan` | `useGraphEnrichment`; tests de planificación | ~45 |

**Resultado estimado:** `useGraphEnrichment.ts` baja a **~110-130 líneas** (estado
de progreso, `readyIds`, efecto de idle y `useMemo` de fusión).

**Riesgos/specs afectados:**
- `Hooks/specs/useGraphEnrichment.spec.tsx` y
  `Hooks/specs/useGraphEnrichment.freshness.spec.tsx` mockean
  `opencodeService` y observan batching, frescura (`readyIds`) y cancelación (L6).
  La semántica de reinicio del plan y de "lo vivo gana sobre la siembra" debe
  quedar **idéntica** al cambiar `enrichNodeData` de leer la caché a recibir
  argumentos resueltos.
- `enrichNodeData` hoy recibe `queryClient`; al pasar a inputs puros, reescribir
  el `useMemo` final para resolverlos desde `queryClient` antes de llamar.
- Coordinar `lib/executionSignal.ts` con el agente de `lib/` (que analiza
  `eventReducer.ts`, donde vive `EMPTY_SIGNAL`): la consolidación toca su área.

---

### `src/Domains/Graph/Components/AgentNode.tsx` — 215 líneas (motivo: (d) JSX-GORDO)

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|-----------------|------|------------------------|--------------------------|------------------|-----------------:|
| `totalTokens` | funcion-pura | `src/Application/Helpers/totalTokens.ts` | `(tokens: TTokenUsage \| null) => number \| null` | `AgentNode`, `SessionSummaryBar`, `History/HistoryHeader` (Familia 5) | ~10 |
| `formatClock` | funcion-pura | `src/Application/Helpers/formatTimeRange.ts` (export) | `(ms: number) => string` (`HH:mm`) | `AgentNode` (reintento); uso interno de `formatTimeRange` | ~6 |
| `NodeResizeHandles` | subcomponente | `src/Domains/Graph/Components/NodeResizeHandles.tsx` | `{ nodeId: string; selected: boolean }` — envuelve `<NodeResizer>` con `MIN_NODE_*` y clases planas | `AgentNode`; cualquier nodo redimensionable | ~25 |
| `useNodeFocusOpacity` | hook | `src/Domains/Graph/Components/NodeFocusContext.tsx` (export) | `(nodeId: string) => number \| undefined` (lee `useNodeFocus`) | `AgentNode`; nuevos tipos de nodo del grafo | ~10 |
| `AgentNodeHeader` | subcomponente | `src/Domains/Graph/Components/AgentNodeHeader.tsx` | `{ title: string; agentName: string; parallel: TNodeParallelism \| null; isRunning: boolean; status: TNodeStatus }` (título 2 líneas + `∥N` + pulso + label) | `AgentNode` | ~40 |
| `AgentNodeModelLine` | subcomponente | `src/Domains/Graph/Components/AgentNodeModelLine.tsx` | `{ model: ModelRef \| null }` (nombre `provider/id` + variante) | `AgentNode`; inspector si unifica la línea de modelo | ~20 |
| `AgentNodeFooter` | subcomponente | `src/Domains/Graph/Components/AgentNodeFooter.tsx` | `{ metrics: TNodeMetrics; isRunning: boolean; status: TNodeStatus; currentTool: TCurrentTool \| null; retry: TGraphNodeData['retry']; interruptReason: string \| null }` | `AgentNode` | ~55 |

**Resultado estimado:** `AgentNode.tsx` baja a **~50-60 líneas** (card = rail +
handles + header + model line + footer).

**Riesgos/specs afectados:**
- `Components/specs/AgentNode.spec.tsx` es extenso y consulta DOM por texto y
  por selectores: `[data-testid="agent-progress"]`, `.rounded-full` (pulso),
  opacidad de linaje (`1`/`0.15`), títulos "Intento N · próximo …",
  "Motivo: …". Hay que **conservar `data-testid`, textos y el nodo raíz** al
  descomponer, o actualizar el spec (preferible conservar).
- `resizeControlClassName` y el `title` del badge de paralelo deben quedar en
  `NodeResizeHandles`/`AgentNodeHeader` exactamente con los mismos valores.

---

### `src/Domains/Graph/Hooks/useGraphStructure.ts` — 195 líneas (motivo: (e) OTRO)

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|-----------------|------|------------------------|--------------------------|------------------|-----------------:|
| `filterSubtree` | funcion-pura | `src/Domains/Graph/lib/filterSubtree.ts` | `(sessions: SessionInfo[], rootId: string \| null) => SessionInfo[]` (BFS O(n)) | `useGraphStructure`; reexport de compatibilidad desde `useGraphModel` | ~32 |
| `toParallelByNode` | funcion-pura | `src/Domains/Graph/lib/parallelByNode.ts` | `(groups: TParallelGroup[]) => Record<string, TNodeParallelism>` | `useGraphStructure`; vista de paralelismo | ~14 |
| `assembleStructuralGraph` | funcion-pura | `src/Domains/Graph/lib/assembleStructuralGraph.ts` | `(model: TGraphModel, positions: Record<string,{x:number;y:number}>, parallelByNode) => TGraphModel` | `useGraphStructure`; cualquier fase que pegue layout + paralelismo | ~20 |
| `indexPositions` | funcion-pura | `src/Domains/Graph/lib/indexPositions.ts` | `(nodes: Array<{ id: string; position: {x:number;y:number} }>) => Record<string,{x:number;y:number}>` | `useGraphStructure` | ~8 |

**Resultado estimado:** `useGraphStructure.ts` baja a **~105-120 líneas** (3
queries + `buildGraph` + 4 `useMemo` de composición).

**Riesgos/specs afectados:**
- `Hooks/specs/useGraphStructure.spec.tsx` importa `useGraphStructure` y
  `UseGraphStructureResult`; la firma pública no cambia.
- **Compatibilidad de barrel**: `filterSubtree` se exporta desde
  `useGraphStructure.ts` y se reexporta en `useGraphModel.ts` (que a su vez lo
  reexpone por `Hooks/index.ts`). Al moverlo a `lib/`, mantener ambos
  re-exports (`export { filterSubtree } from '../lib/filterSubtree'`) para no
  romper consumidores externos.
- El guardado de `executionPlan`/`positions` con `eslint-disable` keyed por
  `signature` (no por identidad de modelo) es deliberado (Principio VII): no
  cambiar deps al extraer.

---

### `src/Domains/Graph/Components/ExecutionLanes.tsx` — 171 líneas (motivo: (a) SUBCOMPONENTES)

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|-----------------|------|------------------------|--------------------------|------------------|-----------------:|
| `GutterNode` (+ `TGutterNodeData`, `TGutterNode`, `GUTTER_NODE_TYPE`) | subcomponente | `src/Domains/Graph/Components/GutterNode.tsx` | `NodeProps<TGutterNode>`; exports `GUTTER_NODE_TYPE`, `TGutterNodeData`, `TGutterNode`, `isGutterNode` | `ExecutionLanes`/`AgentGraph` | ~95 |
| `buildGutterNodes` | funcion-pura | `src/Domains/Graph/lib/buildGutterNodes.ts` | `(plan: TExecutionPlan, rowLayout: TRowLayout, statusByLevel: Record<number,TNodeStatus>, activeLevel: number \| null) => TGutterNode[]` | `AgentGraph`; test de builder puro | ~28 |
| `NODE_STATUS_COLOR` | constante/compartido | `src/Application/Helpers/nodeStatusColor.ts` | `Record<TNodeStatus, string>` (tokens `bg-status-*`) | `GutterNode` (ex `STATUS_DOT`), `NodeStatusRail` (ex `RAIL_COLOR`), `StatusDot` (ex `STATUS_COLOR`) | ~14 (pieza nueva; deduplica 3 copias) |
| `ExecutionLanes` (bandas) | subcomponente | `src/Domains/Graph/Components/ExecutionLanes.tsx` (permanece, adelgazado) | `{ plan: TExecutionPlan; rowLayout: TRowLayout; activeLevel: number \| null }` | `AgentGraph` | ~45 |

**Resultado estimado:** `ExecutionLanes.tsx` baja a **~45 líneas** (solo las
bandas). `GutterNode.tsx` (~95) absorbe su componente + tipos + guard.
`STATUS_DOT` desaparece en favor de `NODE_STATUS_COLOR`.

**Riesgos/specs afectados:**
- `Components/specs/ExecutionLanes.spec.tsx` importa `{ GutterNode, TGutterNodeData } from '../ExecutionLanes'`. Opciones: (1) **reexportar** `GutterNode`/`TGutterNodeData` desde `ExecutionLanes.tsx` (`export { GutterNode } from './GutterNode'`) para no tocar el spec, o (2) actualizar el import. Recomendado (1).
- El spec verifica las 9 clases `bg-status-*` sobre `.rounded-full` y que los
  estados activos se lean "en curso" (`isActiveStatus`). El mapa compartido debe
  mantener **exactamente** los mismos tokens.

---

### `src/Domains/Graph/Components/SessionSummaryBar.tsx` — 163 líneas (motivo: (d) JSX-GORDO)

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|-----------------|------|------------------------|--------------------------|------------------|-----------------:|
| `totalTokens` | funcion-pura | `src/Application/Helpers/totalTokens.ts` | (ya listado en AgentNode) | ver Familia 5 | — |
| `UnavailableValue` | subcomponente | `src/Application/Components/Molecules/UnavailableValue.tsx` | `{ label?: string }` → `UNAVAILABLE` + `sr-only` | `SessionSummaryBar`; Inspector y History (mismo "no disponible") | ~15 |
| `SummaryMetric` | subcomponente | `src/Domains/Graph/Components/SummaryMetric.tsx` | `{ label: string; value: number \| null; format: (value: number) => string }` (usa `UnavailableValue`) | `SessionSummaryBar` (Costo/Tokens/Tiempo, 3×); otros resúmenes | ~18 |
| `buildSummaryCounters` | funcion-pura | `src/Domains/Graph/lib/summaryCounters.ts` | `(summary: TSessionSummary) => TSummaryCounter[]`; `TSummaryCounter = { status: TNodeStatus; label: string; count: number; always: boolean }` | `SessionSummaryBar`; test de conteo (FR-024) | ~55 |
| `SummaryCounterBadge` | subcomponente | `src/Domains/Graph/Components/SummaryCounterBadge.tsx` | `{ status: TNodeStatus; count: number; label: string }` (`data-status` + `StatusDot` + conteo) | `SessionSummaryBar` | ~15 |

**Resultado estimado:** `SessionSummaryBar.tsx` baja a **~50 líneas**
(`Container` + map de badges + 3 `SummaryMetric`).

**Riesgos/specs afectados:**
- `Components/specs/SessionSummaryBar.spec.tsx` consulta
  `document.querySelector('[data-status="…"]')` y textos ("En curso",
  "Esperando", "Fallida", "1 agente"). `SummaryCounterBadge` **debe conservar
  `data-status`** en el mismo elemento y el `label` exacto.
- La regla `always` (running/waiting/error siempre visibles) y la agrupación de
  ambas esperas en "Esperando" (FR-024/FR-019) viven hoy en el array del
  componente: mudarlas a `buildSummaryCounters` debe preservar el orden.

---

### `src/Domains/Graph/Hooks/useExecutionSignals.ts` — 161 líneas (motivo: (e) OTRO)

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|-----------------|------|------------------------|--------------------------|------------------|-----------------:|
| `executionSignal` | funcion-pura + constante | `src/Domains/Graph/lib/executionSignal.ts` | (ya listado en useGraphEnrichment) — `EMPTY_EXECUTION_SIGNAL`, `normalizeSignal`, `mergeExecutionSignals`, `sameExecutionSignal` | `useExecutionSignals`, `useGraphEnrichment`, `eventReducer` | — |
| `deriveExecutionSignals` (+ `TERMINAL_OUTCOME_TYPES`) | funcion-pura | `src/Domains/Graph/lib/deriveExecutionSignals.ts` | `(log: readonly SessionLogItem[], sessionId: string) => TExecutionSignal` | `useExecutionSignals`, `useGraphEnrichment` (siembra durable) | ~50 |

**Resultado estimado:** `useExecutionSignals.ts` baja a **~60-70 líneas** (dos
`useQuery` + efecto de siembra + `useMemo` final).

**Riesgos/specs afectados:**
- `Hooks/specs/useExecutionSignals.spec.tsx` importa solo el hook y
  `reduceEvent`; la firma pública no cambia.
- `EMPTY_EXECUTION_SIGNAL` hoy se exporta desde `useExecutionSignals.ts`. Si se
  mueve a `lib/`, **reexportarlo** desde el hook para no romper consumidores
  (coordinación con el agente de `lib/`, que toca `eventReducer`/`EMPTY_SIGNAL`).

---

## Piezas atómicas listas para compartir

Candidatas a salir del dominio (o a `Graph/lib`) con consumidores previstos.

### A `Application/Helpers`

| Pieza | Ruta destino | Firma | Consumidores previstos |
|-------|--------------|-------|------------------------|
| `totalTokens` | `Application/Helpers/totalTokens.ts` | `(tokens: TTokenUsage \| null) => number \| null` | `Graph/AgentNode`, `Graph/SessionSummaryBar`, `History/HistoryHeader` (Familia 5 — 3 copias literales) |
| `NODE_STATUS_COLOR` | `Application/Helpers/nodeStatusColor.ts` | `Record<TNodeStatus, string>` | `Application/StatusDot`, `Graph/NodeStatusRail`, `Graph/GutterNode` (Familia 1 — 3 copias idénticas) |
| `formatClock` | `Application/Helpers/formatTimeRange.ts` | `(ms: number) => string` | `Graph/AgentNode` (reintento); interno de `formatTimeRange` |
| `scheduleIdle` | `Application/Helpers/scheduleIdle.ts` | `(cb: () => void) => { cancel: () => void }` | `Graph/useGraphEnrichment`; futuros schedulers por lotes |

### A `Application/Components`

| Pieza | Ruta destino | Props | Consumidores previstos |
|-------|--------------|-------|------------------------|
| `UnavailableValue` | `Application/Components/Molecules/UnavailableValue.tsx` | `{ label?: string }` | `Graph/SessionSummaryBar`; Inspector y History (todos muestran "no disponible", FR-038) |
| `NodeResizeHandles` | `Graph/Components/NodeResizeHandles.tsx` (candidato futuro a Application si aparece otro nodo resizable) | `{ nodeId: string; selected: boolean }` | `Graph/AgentNode`; próximos nodos React Flow |

### A `Domains/Graph/lib` (nuevos módulos puros, testables con Vitest)

| Pieza | Ruta destino | Firma | Consumidores previstos |
|-------|--------------|-------|------------------------|
| `executionSignal` | `Graph/lib/executionSignal.ts` | `EMPTY_EXECUTION_SIGNAL`, `normalizeSignal`, `mergeExecutionSignals`, `sameExecutionSignal` | `useExecutionSignals`, `useGraphEnrichment`, `deriveExecutionSignals`, `eventReducer` (Familia 7) |
| `deriveExecutionSignals` | `Graph/lib/deriveExecutionSignals.ts` | `(log, sessionId) => TExecutionSignal` | `useExecutionSignals`, `useGraphEnrichment` |
| `buildGutterNodes` | `Graph/lib/buildGutterNodes.ts` | `(plan, rowLayout, statusByLevel, activeLevel) => TGutterNode[]` | `AgentGraph` |
| `nodeStatusRank` | `Graph/lib/nodeStatusRank.ts` | `STATUS_RANK`, `dominantStatus` | `useGraphLayoutModel` |
| `sessionInfoFromNode` | `Graph/lib/sessionInfoFromNode.ts` | `(node, parentId?) => SessionInfo` | `buildEnrichmentPlan` |
| `loadNodeContent` | `Graph/lib/loadNodeContent.ts` | `(queryClient, id) => Promise<void>` | `useGraphEnrichment` |
| `enrichNodeData` | `Graph/lib/enrichNodeData.ts` | `({node, messages, permissions, formDetails, sessionStatus, signal, now}) => TGraphNodeData` | `useGraphEnrichment` |
| `buildEnrichmentPlan` | `Graph/lib/buildEnrichmentPlan.ts` | `(structure, ids, readyIds) => TLoadPlan` | `useGraphEnrichment` |
| `filterSubtree` | `Graph/lib/filterSubtree.ts` | `(sessions, rootId) => SessionInfo[]` | `useGraphStructure`, reexport de `useGraphModel` |
| `toParallelByNode` | `Graph/lib/parallelByNode.ts` | `(groups) => Record<string, TNodeParallelism>` | `useGraphStructure` |
| `assembleStructuralGraph` | `Graph/lib/assembleStructuralGraph.ts` | `(model, positions, parallelByNode) => TGraphModel` | `useGraphStructure` |
| `summaryCounters` | `Graph/lib/summaryCounters.ts` | `(summary: TSessionSummary) => TSummaryCounter[]` | `SessionSummaryBar` |

---

## Notas / discrepancias con convenciones

1. **`div` con `flex` en lugar de `<Container>`** (AGENTS.md §8.4): `AgentNode`
   (líneas 125, 127, 131, 157, 170, 171), `GutterNode` (líneas 65, 81) y el
   contenedor de `AgentGraph` (línea 316, este último es wrapper de React Flow,
   aceptable). Los nodos de React Flow usan posicionamiento absoluto y pueden
   requerir `div` raíz crudo, pero los **layouts internos** (columnas/filas) sí
   pueden migrar a `<Container row …>`. Anotado como deuda, no bloqueante.

2. **Cross-domain en componente** (AGENTS.md §8.3 prohíbe importar otro dominio
   desde un componente; permitido desde hooks): `SessionSummaryBar` importa
   `TSessionSummary` de `../../Inspector/Inspector.entity`. Es un import de
   **tipo**, sin acceso a datos, pero rompe la regla al pie de la letra. Opción:
   mover el consumo a un `useSessionSummaryBar()` que devuelva el view-model ya
   derivado, o mover `TSessionSummary` a un lugar neutro. `buildSummaryCounters`
   (propuesto en `Graph/lib`) heredaría ese acoplamiento Graph→Inspector: evaluar
   moverlo a `Inspector/lib` si se quiere respetar direccionalidad.

3. **Familia 1 (color por `TNodeStatus`) está a un archivo de cerrarse**:
   `NodeStatusRail.RAIL_COLOR` y `ExecutionLanes.STATUS_DOT` son del área; con
   `StatusDot.STATUS_COLOR` (Application) o son tres copias. `NODE_STATUS_COLOR`
   en `Application/Helpers` (con el precedente de `nodeStatusLabel.ts`, que ya
   importa `TNodeStatus` de `Graph.entity`) es el punto de convergencia natural.
   Requiere tocar `StatusDot` (fuera de esta área) → coordinar.

4. **Familia 5 (`totalTokens`)**: esta área aporta 2 de las 3 copias
   (`AgentNode`, `SessionSummaryBar`); la tercera (`History/HistoryHeader`) queda
   para el agente de History. Extraer el helper compartido es condición para
   cerrarla.

5. **Familia 7 (señal vacía)**: `EMPTY_EXECUTION_SIGNAL` (aquí) y
   `EMPTY_SIGNAL` (`lib/eventReducer`, otra área) son el mismo objeto literal.
   `lib/executionSignal.ts` sería la fuente única; **coordinar con el agente de
   `lib/`** para que `eventReducer` importe de ahí en vez de declarar el suyo.

6. **Magic strings de color de arista**: `'hsl(var(--muted-foreground))'` está
   duplicado en `AgentGraph` (línea 268) e `InvocationEdge` (`REST_STROKE`).
   `AgentGraph` sigue pasando un `style` resuelto como fallback (transición
   T028); la constante `REST_EDGE_STYLE` compartida evita que diverjan.

7. **Barrels**: al crear los archivos nuevos hay que actualizar
   `Components/index.ts` (7 exports hoy) y `Hooks/index.ts` (8 exports hoy) para
   exponer `GutterNode`, `ViewportControllers`, `NodeResizeHandles`,
   `SummaryMetric`, `SummaryCounterBadge` y los hooks nuevos. Mantener los
   re-exports de compatibilidad (`GutterNode`/`TGutterNodeData` desde
   `ExecutionLanes`, `filterSubtree` desde `useGraphModel`) para no romper specs.

8. **`isGutterNode`**: el guard `String(node.type) === GUTTER_NODE_TYPE` se repite
   3 veces en `AgentGraph` (líneas 330, 334, 338). Un predicado concreto en
   `GutterNode.tsx` elimina la repetición y el cast `String(...)`.

9. **Barrel de `Types`**: no se proponen tipos nuevos de SDK; todos los tipos de
   estado siguen derivando de `Graph.entity`/`Inspector.entity` (Principio IV).
   `TSummaryCounter` es un tipo de vista local, no de SDK.
