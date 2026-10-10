# Inventario de "archivos gordos" (frontend)

> Análisis **de solo lectura**. Medición exacta de líneas sobre `src/` excluyendo
> `*/specs/*`, `*.spec.ts(x)`, `src/Application/Components/ui/` y `src/test/`.
> Umbral de archivo GORDO: **≥ 150 líneas**.

## Leyenda de motivos

- **(a) SUBCOMPONENTES** — varios subcomponentes hermanos en el mismo archivo.
- **(b) MAPAS** — constantes grandes de labels/colores/estilos (`Record<...>`, `STATUS_*`, `KIND_*`).
- **(c) LOGICA-MEZCLADA** — hooks/derivaciones de datos mezclados con el render dentro del componente.
- **(d) JSX-GORDO** — un solo render grande con muchos casos/condicionales/iteraciones.
- **(e) OTRO** — se describe el motivo (típicamente libs puras o servicios con muchas funciones).

## Tabla de archivos GORDO

| # | Archivo | Líneas | Motivo primario | Subcomp. internos |
|---|---------|-------:|-----------------|------------------:|
| 1 | `src/Domains/Graph/lib/eventReducer.ts` | 622 | **(e) OTRO** — reducer con un `switch` de dispatch gigante (~40 casos de evento) + helpers de normalización de caché | N/A |
| 2 | `src/Infrastructure/WorkspacePage.tsx` | 413 | **(c) LOGICA-MEZCLADA** — docena de hooks/`useMemo`/`useEffect` + instrumentación de perf + lógica del overlay histórico mezcladas con el render | 0 (3 bloques JSX inline: `rail`, `graphPane`, `inspectorPane`) |
| 3 | `src/Domains/History/lib/buildHistory.ts` | 409 | **(e) OTRO** — lib de proyección pura: dos `switch` por tipo de mensaje/parte + helpers + merge de preguntas | N/A |
| 4 | `src/Domains/Graph/Components/AgentGraph.tsx` | 358 | **(c) LOGICA-MEZCLADA** — derivaciones pesadas (nodos de vista, aristas, `statusByLevel`, layout de carriles, reconcile, métricas de interacción) dentro del componente + render de React Flow | 2 (`FollowController`, `FitViewController`) |
| 5 | `src/Domains/Graph/Hooks/useGraphEnrichment.ts` | 351 | **(e) OTRO** — hook con carga por lotes, scheduling en idle, escritura en caché compartida y fusión de enriquecimiento | N/A |
| 6 | `src/Application/Components/Organisms/HistoryEntry.tsx` | 330 | **(d) JSX-GORDO** — `renderBody` con `switch` de 14 casos que devuelven JSX + 8 mapas de label/estilo | 2 (`InProgress`, `Description`) + función `renderBody` |
| 7 | `src/Domains/Graph/lib/deriveMetrics.ts` | 320 | **(e) OTRO** — lib de métricas puras (`deriveMetricBase`, `resolveMetrics`, `summarizeSession`) | N/A |
| 8 | `src/Domains/History/History.entity.ts` | 247 | **(e) OTRO** — archivo de tipos/entidades: unión de 14 variantes + interfaces + tipos auxiliares | N/A |
| 9 | `src/Infrastructure/Services/opencodeClient.ts` | 237 | **(e) OTRO** — service SDK: ~18 métodos wrapper + paginación por cursor | N/A |
| 10 | `src/Infrastructure/EventStreamProvider.tsx` | 225 | **(c) LOGICA-MEZCLADA** — reconexión con backoff, buffering/flush de eventos y polling de sesiones activas; render mínimo | 0 |
| 11 | `src/Domains/Sessions/lib/sessionFilters.ts` | 221 | **(e) OTRO** — lib de filtros puros (parseo/serialización de URL, rangos temporales, intersección) + tipos | N/A |
| 12 | `src/Domains/Graph/lib/loadPriority.ts` | 221 | **(e) OTRO** — lib pura de priorización y troceado del plan de carga | N/A |
| 13 | `src/Domains/Graph/lib/executionLevels.ts` | 218 | **(e) OTRO** — lib pura de layout/niveles de ejecución + constantes geométricas | N/A |
| 14 | `src/Domains/Graph/Components/AgentNode.tsx` | 215 | **(d) JSX-GORDO** — un único render largo (~110 líneas) con múltiples condicionales; derivaciones locales (`retryLabel`, `interruptLabel`) | 0 |
| 15 | `src/Domains/Inspector/Inspector.service.ts` | 208 | **(e) OTRO** — service/hooks con 7 `useQuery` + helpers de mapeo de view-models | N/A |
| 16 | `src/Domains/Graph/Graph.entity.ts` | 202 | **(e) OTRO** — tipos de dominio + constantes `EMPTY_*` | N/A |
| 17 | `src/Domains/Graph/Hooks/useGraphStructure.ts` | 195 | **(e) OTRO** — hook estructural: BFS de subárbol + `buildGraph` + layout + paralelismo, todo memoizado | N/A |
| 18 | `src/Domains/Inspector/Components/InspectorPanel.tsx` | 188 | **(d) JSX-GORDO** — render extenso componiendo ~12 secciones + estado vacío | 0 |
| 19 | `src/Domains/Inspector/Inspector.entity.ts` | 179 | **(e) OTRO** — archivo de tipos/entidades (recursos, preguntas, permisos, cola, resumen) | N/A |
| 20 | `src/Domains/Graph/Components/ExecutionLanes.tsx` | 171 | **(a) SUBCOMPONENTES** — dos componentes hermanos (`GutterNode`, `ExecutionLanes`) + builder `buildGutterNodes` + mapa de 9 estados | 2 |
| 21 | `src/Domains/Inspector/Components/QuestionsSection.tsx` | 166 | **(d) JSX-GORDO** — render con ramas error/loading/vacío/datos + dos bloques anidados (permisos, preguntas) | 0 |
| 22 | `src/Domains/History/Components/HistoryHeader.tsx` | 164 | **(d) JSX-GORDO** — render extenso (métricas + navegación de linaje) | 1 (`NavButton`) |
| 23 | `src/Domains/Inspector/Hooks/useInspectorData.ts` | 163 | **(e) OTRO** — hook agregador de 8 queries + derivaciones (tools, tasks, errors, entries, resources) | N/A |
| 24 | `src/Domains/Graph/Components/SessionSummaryBar.tsx` | 163 | **(d) JSX-GORDO** — array de 8 contadores por estado + render largo de la barra | 1 (`Unavailable`) |
| 25 | `src/Domains/Graph/Hooks/useExecutionSignals.ts` | 161 | **(e) OTRO** — hook de siembra duradera + merge de señales de ejecución | N/A |
| 26 | `src/Domains/Graph/lib/reconcileGraph.ts` | 159 | **(e) OTRO** — lib pura de comparación/reconciliación (muchos comparadores `same*`) | N/A |
| 27 | `src/Domains/Graph/lib/buildGraph.ts` | 152 | **(e) OTRO** — lib pura constructora del modelo de grafo | N/A |

## Duplicación transversal

Familias de tablas/constantes de estado repetidas entre dominios.

### Familia 1 — Color por `TNodeStatus` (los 9 estados)

Tres mapas **idénticos** `Record<TNodeStatus, string>` con los tokens `bg-status-*`:

- `src/Application/Components/Molecules/StatusDot.tsx` → `STATUS_COLOR`
- `src/Domains/Graph/Components/NodeStatusRail.tsx` → `RAIL_COLOR`
- `src/Domains/Graph/Components/ExecutionLanes.tsx` → `STATUS_DOT`

### Familia 2 — Etiqueta de resultado terminal `{succeeded, failed, interrupted}`

- `src/Application/Helpers/nodeStatusLabel.ts` → `NODE_STATUS_LABEL` (fuente única oficial; "Terminada").
- `src/Domains/History/Components/HistoryHeader.tsx` → `OUTCOME_LABEL` ("Terminada con éxito").
- `src/Application/Components/Organisms/HistoryEntry.tsx` → `IDLE_LABEL` ("Terminada con éxito").

`OUTCOME_LABEL` e `IDLE_LABEL` son copias literales entre sí y, a la vez, duplican el
subconjunto terminal de `NODE_STATUS_LABEL` (con wording divergente).
Relacionado: `AgentGraph.tsx` → `STATUS_RANK` (mismo dominio de estados pero otra
preocupación: orden de dominancia, no etiqueta).

### Familia 3 — Estado de pregunta `{pending, answered, cancelled}` (label + color)

- `src/Application/Components/Organisms/HistoryEntry.tsx` → `QUESTION_STATE_LABEL` + `QUESTION_STATE_COLOR`
- `src/Domains/Inspector/Components/QuestionsSection.tsx` → `STATE_LABEL` + `STATE_COLOR`

Valores idénticos (mismos textos y mismas clases `text-status-*`).

### Familia 4 — Color por estado de herramienta

- `src/Application/Components/Organisms/ToolCallEntry.tsx` → `STATUS_COLOR` (`streaming`/`running`/`completed`/`error`)
- `src/Domains/Inspector/Components/ToolHistory.tsx` → `STATUS_COLOR` (`running`/`completed`/`error`/`pending`)

Solapan en `running`/`completed`/`error` → mismos tokens. `ToolHistory` además
muestra el estado crudo sin label, mientras `ToolCallEntry` sí tiene `STATUS_LABEL`.

### Familia 5 — Helper `totalTokens()` (input + output + reasoning)

Función duplicada **literalmente** en tres archivos:

- `src/Domains/Graph/Components/AgentNode.tsx` (líneas 34-40)
- `src/Domains/History/Components/HistoryHeader.tsx` (líneas 37-43)
- `src/Domains/Graph/Components/SessionSummaryBar.tsx` (líneas 25-31)

### Familia 6 — View-models de pregunta (tipos)

Definiciones estructuralmente idénticas (los propios comentarios las declaran compatibles):

- `src/Domains/History/History.entity.ts` → `THistoryQuestionState` / `THistoryQuestionField` / `THistoryQuestionOption`
- `src/Domains/Inspector/Inspector.entity.ts` → `TQuestionState` / `TQuestionField` / `TQuestionOption`

### Familia 7 — Señal de ejecución "vacía"

Objetos idénticos (`{ retry: null, compaction: null, outcome: null, interruptReason: null }`):

- `src/Domains/Graph/Hooks/useExecutionSignals.ts` → `EMPTY_EXECUTION_SIGNAL`
- `src/Domains/Graph/lib/eventReducer.ts` → `EMPTY_SIGNAL`

### Familia 8 — Unión de resultado terminal `'succeeded' | 'failed' | 'interrupted'`

Repetida como literal en tres sitios en lugar de una constante compartida:

- `src/Domains/History/History.entity.ts` → `TIdleOutcome`
- `src/Domains/Graph/Graph.entity.ts` → `TExecutionSignal['outcome']`
- `src/Domains/Graph/lib/nodeStatus.ts` → `NodeStatusInput['outcome']`

### Nota (patrón, no duplicación estricta)

El patrón "`Record<estado, color>` con tokens `status-*`" se repite también, con
claves propias de su dominio, en `Inspector/Components/FileChanges.tsx`
(`added`/`modified`/`deleted`) y `Connection/Components/ConnectionBadge.tsx`
(`connected`/`reconnecting`/`disconnected`). No comparten claves con `TNodeStatus`,
pero todos podrían converger en un mapa semántico compartido.

## Estadísticas

- **Archivos `.ts`/`.tsx` analizados** (tras exclusiones): **162**
- **Archivos GORDO (≥150 líneas): 27** (16,7 % del total)
- **Líneas totales de los GORDO: 6.658**
- **Líneas totales del conjunto analizado: 12.120** → el 54,9 % del código vive en
  los 27 archivos gordos.

### Distribución por motivo primario

| Motivo | Nº archivos | Archivos |
|--------|------------:|----------|
| (a) SUBCOMPONENTES | 1 | ExecutionLanes.tsx |
| (b) MAPAS | 0 | — (los mapas aparecen casi siempre como motivo secundario) |
| (c) LOGICA-MEZCLADA | 3 | WorkspacePage.tsx, AgentGraph.tsx, EventStreamProvider.tsx |
| (d) JSX-GORDO | 6 | HistoryEntry.tsx, AgentNode.tsx, InspectorPanel.tsx, QuestionsSection.tsx, HistoryHeader.tsx, SessionSummaryBar.tsx |
| (e) OTRO | 17 | eventReducer, buildHistory, useGraphEnrichment, deriveMetrics, History.entity, opencodeClient, sessionFilters, loadPriority, executionLevels, Inspector.service, Graph.entity, useGraphStructure, Inspector.entity, useInspectorData, useExecutionSignals, reconcileGraph, buildGraph |

### Concentración por dominio

| Dominio | Archivos GORDO |
|---------|---------------:|
| `Graph` | 14 |
| `Inspector` | 5 |
| `History` | 3 |
| `Infrastructure` | 3 |
| `Application` | 1 |
| `Sessions` | 1 |

**Observación:** el dominio `Graph` concentra más de la mitad de los archivos
gordos, y en su mayoría son **libs puras** (`(e) OTRO`), no componentes: el
grosor viene de acumular muchas funciones/derivaciones en un mismo módulo, no de
JSX. Los candidatos más claros a partir por JSX son `HistoryEntry.tsx` y
`AgentGraph.tsx`; los más claros a partir por subcomponentes, `ExecutionLanes.tsx`.
