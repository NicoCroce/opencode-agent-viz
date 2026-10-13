# Research — Raíces siempre listables, subárbol completo y paralelismo por invocación

**Feature**: `011-fix-session-roots-subtree` · **Date**: 2026-10-12
**Insumo**: [discovery/rfc.md](./discovery/rfc.md) (decisiones D1–D11) y [discovery/pedido.md](./discovery/pedido.md) (E1–E5, T001–T028).
**Regla**: las correcciones de los researchers con medición/verificación **prevalecen** sobre el pedido donde hay discrepancia.

No quedan `NEEDS CLARIFICATION`: cada unknown del Technical Context se resuelve abajo.

---

## R1 — Paginación de raíces: cursor, no subir `limit`

- **Decisión**: `listRootSessions(directory)` pide `session.list({ directory, parentID: null, limit: SESSION_PAGE_SIZE, order: 'desc' })` y pagina con el cursor (`sessionPagination.ts`, calco de `messagePagination.ts`), devolviendo `{ sessions, truncated }`.
- **Rationale**: `limit=200` sin `parentID` devuelve 15-16 raíces; con `parentID=null` devuelve 38. Subir el `limit` no acota nada (el proyecto crece ~430 hijas/mes) y cada `session.created` —que ocurre en cada spawn— invalida la lista y dispara el refetch: paginar más por request empeora, no mejora.
- **Alternativas consideradas**: subir `limit` (rechazada, no escala); filtrar solo en cliente (rechazada, la ventana ya perdió las raíces viejas).
- **Constantes**: `SESSION_PAGE_SIZE = 200`, `SESSION_MAX_PAGES = 25` → techo 5.000 raíces/directorio. `order` solo en la primera página (la API rechaza `cursor`+`order`).

## R2 — Key de raíces que cuelga de `sessions.all`

- **Decisión**: `queryKeys.sessions.roots(directory) = [...sessions.all, directory, 'roots']`.
- **Rationale**: la invalidación por prefijo de `sessions.all` (que dispara `EventStreamProvider` con los 8 tipos de evento de sesión) sigue alcanzando la key sin tocar el reducer, y **no** alcanza `graph`/`metrics`/`permissions`. `staleTime: Infinity` no protege de la invalidación por prefijo, por eso la dependencia de prefijo es deliberada.
- **Alternativas consideradas**: key colgando de otra raíz (perdería la frescura por evento); `queryKeys.sessions.list(directory)` compartida con el grafo (D1 la prohíbe: el grafo se quedaría sin hijos).

## R3 — El `directory` no depende de la lista

- **Decisión**: `WorkspacePage` resuelve `directory` con la cadena `items` → `session.get({ sessionID })` → `null`.
- **Rationale**: `session.get` devuelve `SessionInfo.location.directory` para **cualquier** sesión, esté o no en el listado, y es casi inmutable (solo cambia `time.updated`).
- **Forma de la key (corrige el pedido)**: `queryKeys.sessions.detail(directory, id)` es **inimplementable** como respaldo porque necesita el `directory` que aún no se conoce. Se usa una key **por id**: `['sessions','directory', id]` con `staleTime: Infinity`. El respaldo sigue siendo `session.get` (no se reabre D4, solo se corrige la forma de la key).
- **Alternativas consideradas**: `sessions.detail(directory, id)` (imposible sin directory); derivar de `parentID` subiendo por `session.get` (queda para E2, que sí necesita la cadena).

## R4 — Subárbol del grafo bajo demanda, en `graph.*`

- **Decisión**: `useGraphStructure` deja de leer `sessions.list` y usa el cargador puro `Graph/lib/loadPlan/subtree.ts`; resultado `{ sessions, truncated, loadedCount, reason? }`. La frescura en vivo se conserva refrescando **explícitamente la profundidad 1** de la raíz observada en `session.created`/`session.deleted`.
- **Rationale**: mantener el BFS bajo `sessions.all` haría que los **8** tipos de evento de sesión lo invaliden sin coalescer → el BFS se re-ejecuta por evento y la revisita deja de ser barata (rompe SC-003/SC-008 de 006). El evento `session.created` de V2 no trae `parentID`, así que no permite invalidar la key exacta del padre.
- **Cargador**: subir con `session.get` si el abierto es descendiente (reutiliza `ancestorChain`, `traversal.ts:6`) → BFS descendente con `Promise.all` **por nivel** (`listChildSessions`), guarda anti-ciclo (precedente `filterSubtree.ts:28`) y `parentID` ausente ignorado.
- **Fast path**: si `sessionId ∈ items` (ya son todas las raíces tras E1) → 0 requests de subida. Bosque plano ⇒ **1 request por raíz**; el coste escala con nodos internos, no con nodos.
- **Alternativas consideradas**: `children(parentID)` bajo `sessions.all` (rechazada por el coste de refresco); subárbol completo en un request del server (no existe hoy, fuera de alcance).

## R5 — Presupuesto global de nodos/requests y aviso de truncamiento

- **Decisión**: el cargador tiene un **presupuesto global** de nodos/requests por carga (no un tope por padre), alineado al techo de fluidez ~200 agentes de `006`. Al superarlo, el resultado marca `truncated` y la UI muestra un banner persistente.
- **Rationale**: decidido en `/clarify` (Q del subárbol); el aviso es **informativo puro** (sin cifras tipo "N de M", sin acción, no bloqueante), pinta sobre el `Alert` compartido en variante `warning`, con `role="status"` y `aria-live="polite"` (patrón `ConnectionBadge`), entre cabecera y lienzo. El corte del listado de raíces recibe el mismo tratamiento (FR-002).
- **Alternativas consideradas**: tope por padre (no acota el global); truncar a ~200 (descarta sin declarar); `role="alert"` (ya lo ocupa el banner de atención del chat).
- **Diseño para el árbol medido**: plano, 38 raíces, la mayor 109 hijos, 0 nietos. No se diseña para profundidad inexistente, pero la guarda anti-ciclo y el presupuesto quedan como red de seguridad.

## R6 — Estados de pantalla honestos (Principio VI)

- **Decisión**: `isLoading = directorio pendiente de resolución || isLoading(estructura)` (acotado, nunca terminal); `isError = isError(estructura)` (fallo de la estructura); `notFound = notFound(estructura) || fallo de resolución del directorio`. **Limitación conocida**: el fallo del respaldo del directorio no se distingue de «sesión inexistente» (ambos llegan igual), así que se resuelve como «no encontrada». Sesión inexistente → `EmptyState` "no encontrada" con acción a `/sessions`, distinguida de "sin agentes" mediante `notFound: boolean` **aditivo** en el resultado del grafo; estado **no terminal**, con salida al listado.
- **Rationale**: hoy `directory` nulo fuerza `isLoading: true` (`useGraphStructure.ts:151`) y `isError` nunca se activa porque la query está deshabilitada → skeleton terminal sin salida.
- **`notFound` aditivo**: un `state: 'error'|'not-found'|…` rompería `useGraphStructure.spec.tsx`/`useGraphModel.spec.tsx`; el booleano aditivo no toca la forma pública de `UseGraphModelResult`.
- **Alternativas consideradas**: reusar `EmptyScreenFilter` (no aplica: no hay filtro).

## R7 — Unidad de paralelismo: la invocación

- **Decisión**: `deriveInvocations(messages)` recorre los tool parts `subagent`/`task` del padre y devuelve `{ sessionId, stepId, startedAt, endedAt, status }`; `deriveInvocationBatches(invocations)` agrupa por `stepId` (2+ = lote paralelo).
- **Rationale**: una hija reutilizada en varios pasos aporta **varios intervalos**, no uno largo. El agrupamiento por sesión fusionaba pasos secuenciales: 7 de 69 lotes en el caso medido, todos conteniendo una sesión reutilizada.
- **`SUBAGENT_TOOLS`**: es privado en `Inspector/lib/deriveTasks.ts:8`; importarlo cruzaría dominios (Principio II) → se **duplica** en `Graph/lib/invocations.ts` con comentario al origen (2 líneas).
- **Alternativas consideradas**: deep-import de `SUBAGENT_TOOLS` (viola Principio II).

## R8 — `deriveExecutionKey` incorpora la firma de lotes (E4 no puede ser un no-op)

- **Decisión**: la clave de memo pasa a incluir la firma de los lotes (ids + miembros), no solo topología+intervalo por nodo.
- **Rationale**: el plan/las posiciones/los grupos se memoizan por `deriveExecutionKey`; sin la firma de lotes, al llegar los mensajes del padre las **filas no cambiarían** y E4 sería un **no-op silencioso** que rompe la paridad fila↔badge (FR-008, D6).
- **Alternativas consideradas**: cambiar solo el badge (descartada: FR-010 exige paridad; las filas salen de `deriveExecutionLevels`).
- **Respaldo (FR-012)**: en la fase estructural (padre sin mensajes) manda el solape por sesión de `deriveSiblingBatches`, que **no se toca**; `deriveParallelGroups` se conserva para no romper sus specs; `parallelByNode` combina ambas fuentes y la invocación gana cuando existe.

## R9 — Fin de la invocación (T021)

- **Decisión**: el fin es el fin de la **tool call del padre** (`time.completed`). Si algún día aparece una invocación en `background`, el fin pasa a `max(fin del tool part, fin de la sesión hija)`.
- **Rationale**: medición 2026-10-12 → `background: true` = **0 casos**; en foreground el fin del tool part precede al de la hija en 325/356 (mediana 10 ms). Usar el fin de la hija alargaría el intervalo y podría **re-fusionar** pasos.
- **Alternativas consideradas**: fin = fin de la hija (regresa el síntoma).

## R10 — Skills del Inspector

- **Decisión**: `deriveSkills(messages)` acumula por tool de skill: `input.name` **o** `input.id` (ambas formas se usan en los datos), `estTokens` = caracteres ÷ 4 sobre `content[].text`, cuenta repeticiones y `firstLoadedAt`; excluye `state.status === 'error'`. `deriveResources` recibe las skills ya derivadas (no en render) y `TResourceUsage.skills` pasa a `{ name; count; estTokens }[]`.
- **Rationale**: `deriveResources.ts:24` hardcodea `skills: []` y `useInspectorData` ni pasa los mensajes; ningún test lo detectó porque `ResourceList.spec.tsx` solo prueba el vacío.
- **UI**: `ResourceRow` se extiende a `items: { label, note? }[]`; con `note` pinta `label · note` sin el sufijo "disponible" (MCP/Instructions/Tools intactos). Copy: `frontend-design · ~3.4k tokens` (`tabular-nums`), `estTokens` desconocido → solo el nombre; `aria-label` deletrea "aproximadamente"; vacío → **"Sin skills cargadas"**; Tools dice "usadas", Skills "cargadas".
- **Alternativas consideradas**: pintar `~N tokens` como cambio de una línea (descartada: `ResourceRow` recibe `string[]` y hardcodea "disponible").

## R11 — Borrado de código muerto

- **Decisión**: se eliminan `useSessionInfo` (`History/History.service.ts:30`) y `useSelectSession` (`Sessions/Hooks/useSelectSession.ts`) junto con su spec y su re-export en `Sessions/Hooks/index.ts`.
- **Rationale**: aprobado por el usuario (D7). `useSessionInfo` usa la key compartida y no se consume en ningún lado; dejarlo apuntando a una key que cambia de semántica es una trampa.

## R12 — `filterSubtree` se conserva

- **Decisión**: `filterSubtree` se mantiene como función pura y API pública del dominio; recibe su propio spec.
- **Rationale**: verificado: se invoca **una vez** (`useGraphStructure.ts:69`), `useGraphModel.ts:28` solo la re-exporta y **no tiene spec propio**. El plan original decía que la usaban varios consumidores; gana el informe (D10). Se conserva por compatibilidad del barrel.

## R13 — Instrumentación de apertura

- **Decisión**: `useSessionOpenPerf.ts:41-45` deja de mirar `sessions.list` y se reapunta a la key nueva del subárbol.
- **Rationale**: al cambiar el origen, la decisión open/revisit dejaría de medir. Arrastra `WorkspacePage.spec.tsx:290` y `WorkspacePage.perf.spec.tsx:177,390-397`.

## R14 — Coalescing fuera de alcance

- **Decisión**: no se coalescen las invalidaciones SSE en esta feature (D11).
- **Rationale**: la invalidación por prefijo **sí** alcanza la key nueva y el coste baja de 200 a 38 sesiones; el coalescing queda como seguimiento. Igual queda fuera el N+1 de `sessions.messages(id)` en el Inspector.

## Specs en riesgo (mitigación E3)

`useGraphStructure.spec.tsx` (7 tests, cambia la fuente y el contrato L4 del mock), `useRootSessions.spec.tsx` (método mockeado), `WorkspacePage.spec.tsx` y `.perf.spec.tsx` (`session.get`), `parallelism.spec.ts`, `deriveExecutionLayout.spec.ts`, `executionLevels.spec.ts`, `useGraphModel.spec.tsx`, `useInspectorData.spec.tsx`, `ResourceList.spec.tsx`. `buildSession({ parentID })` ya existe para fixtures.
