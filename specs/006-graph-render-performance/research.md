# Research — Rendimiento del visualizador de grafo

**Feature**: `006-graph-render-performance`
**Date**: 2026-10-08
**Input**: [spec.md](./spec.md), [plan.md](./plan.md)

La spec está cerrada con clarificaciones (checklist de requisitos al 100 %): **no quedan `NEEDS CLARIFICATION`**. Este documento resuelve las decisiones técnicas de implementación. Todas se apoyan en código existente del dominio `Graph` y en primitivas ya instaladas; **no se añaden dependencias** y **no se migra el render a canvas** (spec, Out of Scope).

---

## Diagnóstico de los cuellos de botella (base de las decisiones)

Punto de partida medido por lectura del código actual (`useGraphModel`, `AgentGraph`, `buildGraph`, `deriveMetrics`):

1. **Amplificación de carga por sesión (N×7)** — `useGraphModel.ts:109-226` abre `useQueries` para **mensajes, permisos, log, señal en vivo, lista de formularios, detalle de formularios e inbox** por **cada** sesión del subárbol. `getSessionMessages` (opencodeClient.ts:154) pagina hasta `MESSAGE_MAX_PAGES = 25` × 200 = 5 000 mensajes **por sesión**. Un subárbol de 50 agentes lanza ~300+ requests y puede descargar cientos de miles de mensajes antes del primer pintado.
2. **Recómputo por tick de 1 s** — `useNow(1000)` entra como dependencia de `buildGraph` (useGraphModel.ts:98,252-276), así que cada segundo se re-ejecuta `deriveMetrics` sobre el **contenido completo** de **todas** las sesiones, más `deriveParallelGroups` y `summarizeSession`.
3. **Rebuild del modelo por interacción** — en `AgentGraph.tsx` el `useMemo` de `edges` depende de `hoveredNodeId` (línea 269) y el de `nodes` de `lineage`/`selectedNodeId`/`overrides` (líneas 214-223): un hover reconstruye **todas** las aristas y una selección reconstruye **todos** los nodos, aunque `AgentNode` esté `memo` (la identidad de `data` cambia).
4. **Trabajo duplicado** — `cardHeight` se calcula en `buildViewNodes` (línea 37) y otra vez en `AgentGraph.heightByNode` (línea 171); `filterSubtree` usa `sessions.find` dentro del BFS (useGraphModel.ts:46) → O(n²).

Estos cuatro puntos cubren, en orden, FR-001/003/008 (carga), FR-006/SC-005 (tick), FR-005/SC-004 (interacción) y FR-002/SC-002/SC-008 (coste).

---

## R1. Modelo por fases: estructura vs enriquecimiento (FR-001, FR-002, FR-010, SC-007)

**Decision**: Partir `useGraphModel` en dos capas internas y mantener su **API pública estable** para no tocar `WorkspacePage` más de lo necesario:

- **`useGraphStructure(sessionId, directory)`** — construye nodos y aristas solo con datos **ya cacheados globalmente**: la lista de sesiones de `useRootSessions` (misma clave `queryKeys.sessions.list(directory)`, ya cargada por el listado), el mapa de estados global (`queryKeys.sessions.status()`, sembrado por `EventStreamProvider`) y la lista de agentes (`queryKeys.agents.list(directory)`). No abre ninguna consulta nueva por sesión. Rellena `data.metrics` con `EMPTY_METRICS` y marca `data.enrichment = 'pending'`.
- **`useGraphEnrichment(ids, structure)`** — carga progresivamente mensajes/permisos/log/señales/formularios/inbox y **fusiona** métricas/estado final en los nodos ya existentes (`enrichment = 'ready'`). `structure` es el `TGraphModel` de la fase estructural (fuente de la topología y de los ids a enriquecer).

`useGraphModel` orquesta ambas y devuelve la misma forma `UseGraphModelResult` que hoy.

**Rationale**:
- La estructura del subárbol se puede derivar de `SessionInfo.parentID` y `SessionStatus`, que **ya están en caché** para el listado de sesiones; por tanto la primera pintura no depende de descargar contenido (FR-010, SC-007).
- "Progresivo" está **explicitamente aceptado** en la clarificación del 2026-10-08 (estructura primero, métricas/detalles después), y el estado de nodo sigue siendo significativo sin mensajes. En la **fase de estructura** solo son definitivos los estados derivables de `SessionStatus`: `running`, `retrying` y `created`; en cambio `compacting`, `waiting-permission`/`waiting-input` y los terminales `succeeded`/`failed`/`interrupted` requieren `compaction`/`outcome` (señal desde `session.log`), formularios, permisos o `hasActivity` (mensajes), que llegan en el enriquecimiento. Mientras `enrichment === 'pending'`, esos últimos son **provisionales** (el nodo se muestra con el mejor estado derivable) y se fijan al pasar a `'ready'`; la paridad (FR-007) se contrasta solo con nodos `ready`.
- Al terminar el enriquecimiento el resultado es **idéntico** al actual → FR-007 (paridad) se mantiene como invariante verificable.

**Alternatives considered**:
- **Mantener una sola fase y solo memoizar**: descartado; no elimina la amplificación de carga (R2) ni el bloqueo del primer pintado sobre todo el contenido.
- **Suspense/placeholder por nodo**: descartado; añade complejidad de límites de suspensión y no mejora el coste de red.
- **Virtualizar el grafo (renderizar solo lo visible)**: descartado en esta feature; cambia la semántica de `fitView` y del layout de carriles, y la spec prioriza lo incremental sin rediseño.

---

## R2. Carga progresiva, priorizada y cancelable (FR-003, FR-004, SC-002, SC-003, SC-008)

**Decision**: Introducir un plan de carga puro y aplicarlo por lotes:

- **`orderSubtreeForLoad(subtree, { activeIds, selectedId, rootId, readyIds })`** (puro, `lib/loadPriority.ts`) devuelve los ids ordenados por prioridad: raíz → ancestros del nodo activo/seleccionado → resto en BFS por **nivel de ejecución** (mismo criterio que `deriveExecutionLevels`) → resto por `time.created`; los ids ya `enrichment === 'ready'` (`readyIds`) se excluyen del plan (`skippedIds`). Los nodos activos (`running/retrying/compacting/waiting-*`) adelantan.
- **`chunkLoadPlan(ids, size)`** divide el plan en lotes (p. ej. 8 ids). `useGraphEnrichment` procesa un lote, deja pintar, y sigue con el siguiente (`requestIdleCallback` con fallback a `setTimeout`), de modo que la lentitud de red no congela la UI.
- **Cancelación por cambio de sesión**: al cambiar `sessionId` (o el subárbol) se descarta el plan en vuelo; los resultados de una sesión abandonada se escriben igualmente en el caché (son válidos y reutilizables, FR-004) pero **no** se esperan para la nueva sesión.
- **Sin recarga en revisita**: la estructura sale del caché global (instantánea) y el enriquecimiento ya cacheado (`staleTime: Infinity`) se reusa; solo se cargan los ids que aún no tienen datos (SC-003, SC-008).
- **No cargar contenido no mostrado**: los nodos con `enrichment === 'ready'` no se vuelven a pedir; un nodo nunca seleccionado igual necesita métricas para su tarjeta, pero su carga se **difiere** hasta que su lote llega, y se puede acotar a los ids del subárbol visible (no se descarga el histórico completo: eso ya lo hace `useHistoryMessages` bajo demanda al abrir el histórico).

**Rationale**:
- FR-003 exige que el coste de preparar una sesión **no** crezca linealmente con el volumen total; el enriquecimiento por lotes y priorizado desacopla el pintado del volumen y mantiene el trabajo acotado a lo que aporta valor visible.
- FR-004/SC-003 exigen revisita ≤ 300 ms sin recarga: al servir la estructura desde caché y no repetir enriquecimiento ya hecho, la revisita es un render puro.
- La priorización por nivel de ejecución reaprovecha el orden que el propio layout ya usa, evitando una heurística nueva.

**Alternatives considered**:
- **Mantener `useQueries` con todas las claves y confiar en `staleTime`**: descartado; no evita el pico inicial de N×7 requests en la primera visita.
- **Limitar `MESSAGE_MAX_PAGES`**: descartado; rompería la paridad de métricas (coste/tokens se suman sobre todos los mensajes).
- **Cargar solo los nodos dentro del viewport medido**: descartado por ahora; exige medir el viewport antes de tener nodos posicionados y complica el determinismo de tests. El orden por nivel/actividad cubre el caso sin esa dependencia.

---

## R3. Métricas separadas por coste temporal + tick condicionado (FR-006, SC-005)

**Decision**: Dividir `deriveMetrics` en dos funciones puras:

- **`deriveMetricBase(messages)`** → `TMetricBase` **independiente de `now`**: `startedAt`, `endedAt`, `cost`, `tokens`, `retryCount`, `hasLoop`, `loopEvidence`, y (reutilizando los recorridos que ya hace `buildGraph`) `model`, `currentTool`, `lastAssistantErrored`. Se memoiza por **identidad de `messages`** (por sesión).
- **`resolveMetrics(base, status, now, subtaskInvocations)`** → `TNodeMetrics` completo, **solo** resuelve `durationMs = (endedAt ?? now) - startedAt` e incorpora el `retry` del `status`. Es O(1) por nodo y por tick. Firma **posicional** fija: `(base: TMetricBase, status: SessionStatus | undefined, now: number, subtaskInvocations: number)`.
- **`deriveMetrics(input)`** se conserva como **envoltorio equivalente** con la firma de objeto actual `{ messages, status, subtaskInvocations, now }` (`DeriveMetricsInput`), de modo que `buildGraph` y los consumidores actuales no cambian; internamente compone `deriveMetricBase(input.messages)` + `resolveMetrics(base, input.status, input.now, input.subtaskInvocations ?? 0)`. `model`, `currentTool` y `lastAssistantErrored` viven en `TMetricBase` (los usa `buildGraph` para `data.model`/`data.currentTool`/`hasError`) y **no** se añaden a `TNodeMetrics`.
- **`useNow` se activa solo si hay al menos un nodo activo** (`isActiveStatus`): sin nodos en curso, un tiempo que no avanza visualmente no necesita tick. El mismo criterio se aplica al `useNow` del **resumen de `WorkspacePage`** (FR-024 de 003-execution-detail-views): sin nodos activos no hay tick del resumen.

**Rationale**:
- El tick de 1 s deja de recorrer el contenido de todas las sesiones; pasa a ser O(nodos). Eso es exactamente FR-006 ("refrescar únicamente lo que cambió") y SC-005.
- `deriveMetricBase` es pura y testeable de forma aislada (Principio V), y la memoización por identidad de `messages` encaja con que `eventReducer` **reemplaza** arrays de mensajes al parchear (nueva referencia) y las conserva cuando no cambia nada.
- Desactivar el tick sin actividad evita re-renders inútiles (Principio VII) sin afectar la frescura cuando hay algo que mostrar (FR-009).

**Alternatives considered**:
- **Mantener `deriveMetrics(messages, now)` y memoizar con `now` redondeado**: descartado; seguiría recomputando O(contenido) cada segundo.
- **`setInterval` global con corte de frecuencia**: descartado; no ataca la causa (el recorrido de mensajes) y complica los tests de temporizadores.
- **Invalidar solo nodos activos**: se logra de forma natural con `resolveMetrics`, que es barato para todos y solo cambia el resultado de los activos.

---

## R4. Identidad estable de nodos y aristas (FR-005, SC-004)

**Decision**: Eliminar los rebuilds del modelo por interacción:

- **`reconcileGraphModel(prev, next)`** (puro, `lib/reconcileGraph.ts`): devuelve, para cada nodo, el **mismo objeto** que en `prev` cuando `id`, `position` y `data` no cambiaron (comparación campo a campo de `TGraphNodeData`); devuelve el mismo array `edges` si su firma de topología no cambió. Así `AgentNode`/`InvocationEdge` (`memo`) solo re-renderizan cuando sus props cambian de verdad.
- **Hover y linaje vía contexto**: `NodeFocusContext` publica `{ selectedNodeId, lineage, hoveredNodeId }`. `AgentNode` e `InvocationEdge` leen de ahí el resaltado **en lugar** de recibirlo horneado en `data`/`style`. El array `nodes`/`edges` que consume `ReactFlow` queda estable frente a hover y selección.
- **`height` calculado una sola vez**: `buildViewNodes` devuelve el nodo con su `height` ya resuelto; `AgentGraph` reutiliza `node.height` (o el override) en vez de recalcular `cardHeight`.
- **`filterSubtree` con índice**: construir `byId = new Map(sessions.map(...))` una vez y usarlo en el BFS (elimina el O(n²)).

**Rationale**:
- React Flow re-renderiza el conjunto de nodos/aristas cuando cambia la referencia del array; mantenerla estable frente a hover/selección es la vía estándar para que `memo` sea efectivo y cumple SC-004 (interacción < 100 ms con ≥ 100 nodos).
- El contexto concentra el estado de foco en un solo sitio (más simple que duplicar `opacity` en `data` de cada nodo) y el markup visual visible no cambia (paridad FR-007).
- Reutilizar `filterSubtree` con `Map` mantiene la función pura y su spec existente.

**Alternatives considered**:
- **Recalcular arrays con `useMemo` "más fino"**: descartado; el problema es la dependencia `hoveredNodeId`/`lineage`, no la falta de memo.
- **Pasar el foco por `data` de cada nodo**: viable, pero obliga a recrear `data` de todos los nodos en cada selección (vuelve el churn). El contexto evita tocar el modelo.
- **`onlyRenderVisibleElements` de React Flow**: complementario y barato de activar, pero no sustituye la estabilidad de identidad; se documenta como opción si los tests de fluidez lo requieren (no bloqueante).

---

## R5. Instrumentación reproducible (FR-011, SC-001..SC-004)

**Decision**: Un helper puro `Application/Helpers/perf.ts` sobre la **Performance API** del navegador:

- `PERF_METRIC = { sessionOpen: 'graph.session.open', sessionRevisit: 'graph.session.revisit', interaction: 'graph.interaction' }`.
- `perfMark(name, detail?)` / `perfMeasure(name, startMark, detail?)` con guarda `typeof performance === 'undefined'` (no-op en SSR/tests sin polyfill); devuelven/registran medidas nombradas y, opcionalmente, `console.debug` en `import.meta.env.DEV`.
- `WorkspacePage` marca `sessionOpen` al seleccionar una sesión sin estructura cacheada y `sessionRevisit` cuando la estructura ya estaba en caché; `AgentGraph` marca `interaction` alrededor de las transiciones de hover/selección/pan (sin instrumentar cada `mousemove`).
- Los **specs** verifican que las funciones registran la medida correcta (con un stub de `performance`) y que son no-op seguras.

**Rationale**:
- FR-011 pide medir de forma **reproducible** apertura, revisita e interacción para capturar línea base antes/después; `performance.mark/measure` es nativo, sin dependencias, y sus entradas se leen desde DevTools o desde un `PerformanceObserver` puntual.
- Mantener la instrumentación fuera del camino caliente (solo en transiciones, no por frame) evita contaminar la propia medición.
- La distinción open vs revisit es la que separa SC-001/SC-002 de SC-003.

**Alternatives considered**:
- **`console.time`**: descartado; no produce entradas estructuradas reutilizables ni timeline.
- **Librería de métricas (web-vitals, etc.)**: descartada; Web Vitals mide navegación/pintado, no las transiciones internas que pide SC-001..SC-003.
- **Solo tests con `vi.useFakeTimers`**: insuficiente; no da la línea base real del equipo de referencia que exige la spec.

---

## R6. Reutilización de caché y claves de consulta (FR-004, SC-003, SC-008)

**Decision**: **No cambiar** la forma de `queryKeys` ni la política `staleTime: Infinity`. El enriquecimiento escribe en las mismas claves actuales (`messages(id)`, `permissions.for(id)`, `sessions.log(id)`, `sessions.execution(id)`, `sessions.forms(id)`, `sessions.inbox(id)`), de modo que la carga progresiva y el `eventReducer` siguen compartiendo estado sin cambios. Un spec dedicado verifica que el enriquecimiento escribe en esas **mismas claves** que parchea `eventReducer` (frescura ≤ 1 s, FR-009).

**Rationale**:
- El reducer en vivo ya parchea esas claves (eventReducer.ts); cambiar claves rompería la coherencia entre carga inicial y eventos, y con ella la paridad.
- Con las mismas claves, la revisita lee del caché y no repite trabajo (SC-003/SC-008) sin lógica nueva de persistencia.

**Alternatives considered**:
- **Nuevas claves con metadatos de "enrichment"**: descartado; duplicaría estado y arriesgaría desincronización con los eventos.
- **Bajar `staleTime`**: descartado; provocaría refetch y trabajo repetido (contradice SC-008).

---

## R7. Alcance y no-cambios (Out of Scope, Principios I/III/VII)

**Decision**: La feature **no** toca: `Infrastructure/Services/opencodeClient.ts` (firma de `OpenCodeService`), `EventStreamProvider` (batching, reconexión, poll de activas), `eventReducer`, `layoutGraph.topologySignature`, `ExecutionLanes`, `SessionSummaryBar`, `History`/`Inspector`, ni el modelo visual de `AgentNode`. Tampoco migra el render a canvas.

**Rationale**: La spec acota la feature a rendimiento incremental sin rediseño y sin cambios en lo que el server expone; mantener intactos los contratos de datos y de eventos protege la paridad (FR-007) y minimiza el riesgo de regresión.

**Alternatives considered**:
- **Migrar a canvas** (mencionado en el input original): descartado explícitamente por la spec (Out of Scope); se reevalúa solo si los objetivos no se alcanzan.
- **Mover el layout a un Web Worker**: descartado; el layout ya está memoizado por firma de topología y no es el cuello de botella medido.

---

## Resumen de decisiones

| # | Decisión | FR / SC |
|---|----------|---------|
| R1 | Modelo por fases: `useGraphStructure` + `useGraphEnrichment`, API pública estable | FR-001, FR-002, FR-010, SC-007 |
| R2 | Carga progresiva priorizada por nivel/actividad, por lotes y cancelable | FR-003, FR-004, SC-002, SC-003, SC-008 |
| R3 | `deriveMetricBase` (sin `now`) + `resolveMetrics` O(nodos) + tick solo con nodos activos (modelo y resumen) | FR-006, SC-005 |
| R4 | Identidad estable (`reconcileGraphModel`) + hover/linaje por contexto + `cardHeight` una vez + `filterSubtree` con índice | FR-005, SC-004 |
| R5 | Instrumentación pura con Performance API (open/revisit/interaction) | FR-011, SC-001..SC-004 |
| R6 | Mismas claves y `staleTime: Infinity`; sin estado nuevo de persistencia | FR-004, SC-003, SC-008 |
| R7 | Sin cambios en SDK/SSE/layout/summary/histórico; sin canvas | FR-007, Principios I/III/VII |

**Trazabilidad de requisitos sin decisión propia**: FR-008 (estados de pantalla) se preserva por R1/R7 y se valida en [quickstart.md](./quickstart.md); FR-009 (frescura ≤ 1 s) se preserva por R1/R3/R6 y se verifica además con el spec de claves compartidas descrito en R6 (mismas claves que `eventReducer`); ninguno requiere una decisión técnica adicional.
