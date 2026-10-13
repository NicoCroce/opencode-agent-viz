# RFC — Raíces siempre listables, subárbol completo y paralelismo por invocación

> Decisión técnica con alternativas. Entrada de `plan`; una vez que existe `plan.md`, manda este.
> Correcciones de los researchers **prevalecen** sobre el plan donde hay medición o verificación.

## Contexto

Estado actual (verificado por lectura, con `archivo:línea` en los informes):
- La lista pide `{directory, order:'desc', limit:200}` y **descarta el cursor** (`session.service.ts:59-66`); el filtro de raíces se hace en cliente (`useRootSessions.ts:46`), así que las hijas ya consumieron la ventana.
- Raíces y grafo **comparten** `queryKeys.sessions.list(directory)` (`useRootSessions.ts:32`, `useGraphStructure.ts:62`).
- El `directory` se resuelve **solo** desde `items` (`WorkspacePage.tsx:137-142`) y `useGraphStructure.ts:151` fuerza `isLoading: true` con `directory` nulo, sin salida; `isError` nunca se activa (la query está deshabilitada).
- Los lotes salen de `deriveSiblingBatches` por solape de intervalos de **sesión** (`parallelism.ts:33-99`, llamado desde `executionLevels.ts:55`), y el plan/layout está memoizado por `deriveExecutionKey` (`execution/executionKey.ts:32-42`), que **no** incluye el agrupamiento.
- `deriveResources.ts:24` hardcodea `skills: []`.

Medición del store (2026-10-12): **486 sesiones, 38 raíces, 448 hijas**; `limit=200&order=desc` → 15–16 raíces; `limit=200&parentID=null&order=desc` → 38 raíces, 0 hijas. Bosque **plano**:
25 raíces sin hijos, 13 con hijos directos, 0 con nietos. `background: true` → **0 casos**.

## Propuesta

1. **E1**: la lista de raíces se pide al servidor **filtrando raíces** (`parentID=null`) y **paginando por cursor**; el filtro de cliente se conserva como red de seguridad. Las raíces dejan de compartir caché con el grafo.
2. **E2**: el subárbol del grafo se carga **bajo demanda** desde la raíz (subir con `session.get` si el abierto es descendiente, bajar con BFS por `parentID`), con resultado `{sessions, truncated, loadedCount, reason}`.
3. **E3**: tests que fijan cada invariante, empezando por los specs que hoy mockean los métodos viejos.
4. **E4**: `deriveInvocations(messages)` (tool parts `subagent`/`task` del padre) alimenta **filas y badge**; el solape se calcula **entre invocaciones** y la firma de lotes entra en `deriveExecutionKey`.
5. **E5**: `deriveSkills(messages)` llena la sección SKILLS del Inspector con `nombre · ~N tokens`.

## Alternativas consideradas

| Alternativa | Pros | Contras | Descartada porque |
|---|---|---|---|
| Subir `limit` (p. ej. 500/2000) | cambio mínimo | no acota nada; el problema vuelve con el crecimiento (~430 hijas/mes) | D2: cursor, no subir limit |
| Filtrar raíces solo en cliente | sin cambios de servicio | la ventana ya está consumida por hijas | no resuelve el bug medido |
| Mantener `children(parentID)` bajo `sessions.all` | frescura total | los **8** tipos de evento de sesión invalidan el prefijo sin coalescer → el BFS se re-ejecuta por evento y la revisita deja de ser barata (rompe SC-003/SC-008 de 006) | D5: subárbol bajo `graph.*` con refresco explícito del padre observado |
| E4 solo cambiando el badge (plan literal) | menos churn en specs/007 | **no-op silencioso**: `deriveExecutionKey` no incluye el agrupamiento, así que las filas no cambiarían y FR-010 (paridad fila↔badge) se rompe | D6: E4 completa (filas + badge) |
| Fin de invocación = fin de la hija | mantiene el solape | alarga el intervalo y puede **re-fusionar** pasos (regresa el síntoma) | D8: fin del tool part |
| Importar `SUBAGENT_TOOLS` desde `Inspector/lib` | cero duplicación | deep-import cross-domain | Principio II: se duplica en `Graph/lib/invocations.ts` |
| `state: 'error'\|'not-found'\|…` en el resultado del grafo | modelo limpio | rompe `useGraphStructure.spec.tsx` / `useGraphModel.spec.tsx` | se añade `notFound: boolean` aditivo |

## Diseño por etapa

### E1 — lista de raíces (flujo de datos)

`useRootSessions` → `sessionReadService.listRootSessions(directory)`
→ `opencodeClient.session.list({directory, parentID: null, limit: 200, order: 'desc'})`
→ bucle por cursor (`sessionPagination.ts`, precedente `messagePagination.ts`; **`order` solo en la
primera página** porque la API rechaza `cursor`+`order`) → `{sessions, truncated}` →
filtro de raíces + orden global por `time.updated` desc + agrupación por `location.directory`
(se conserva `useRootSessions.ts:38-70`). Query key nueva **`sessions.roots(directory)` =
`[...sessions.all, directory, 'roots']`** (D3): verificada como alcanzable por la invalidación de
prefijo de `sessions.all` y **no** alcanza `graph`/`metrics`/`permissions`.
`SESSION_PAGE_SIZE=200`, `SESSION_MAX_PAGES=25` (techo 5.000 raíces/directorio).
Riesgo de staging: mientras el grafo siga leyendo `sessions.list`, cada evento paga 2 refrescos
(37 + 200 ítems) → mitigación: implementar **E1+E2 en el mismo cambio** o aceptar la ventana con
medición intermedia.

### E2 — subárbol del grafo

`useGraphStructure` deja de leer `sessions.list`: usa el cargador puro nuevo
(`Graph/lib/loadPlan/subtree.ts`), apoyado en `ancestorChain` (`loadPlan/traversal.ts:6`, que existe
y es reutilizable una vez poblado el `byId`).
- Fast path: si `sessionId ∈ items` (ya son **todas** las raíces tras E1), **0 requests** de subida.
- BFS descendente con `Promise.all` **por nivel**; guarda anti-ciclo (precedente `filterSubtree.ts:28`)
  y `parentID` ausente ignorado (`filterSubtree.ts:20`).
- Bosque plano ⇒ **1 request por raíz**; el coste escala con nodos internos, no con nodos.
- Resultado `{sessions, truncated, loadedCount, reason?}`; el truncamiento se pinta en un banner
  persistente (ver UX).
- `sessions.children(parentID)`: la decisión D5 deja el subárbol en `graph.*`; la frescura en vivo
  se conserva refrescando **explícitamente la profundidad 1** de la raíz observada en
  `session.created`/`session.deleted` (los dos eventos que cambian el árbol), porque el evento
  `session.created` de V2 no trae `parentID` y no permite invalidar la key exacta del padre.
- Regresión conocida a corregir: `useSessionOpenPerf.ts:41-45` decide open/revisit mirando
  `sessions.list`; al cambiar el origen deja de medir → se reapunta a la key nueva (arrastra
  `WorkspacePage.spec.tsx:290`, `WorkspacePage.perf.spec.tsx:177,390-397`).

### E4 — paralelismo por invocación

`deriveInvocations(messages)` recorre los tool parts `subagent`/`task` tomando
`state.input.background`, `state.metadata.sessionID`, `time.created`/`time.completed`
(mismo patrón que `deriveTasks.ts:40-68`; la constante `SUBAGENT_TOOLS` se **duplica** en
`Graph/lib/invocations.ts` con comentario al origen).
- **Solape entre invocaciones**: una sesión reutilizada aporta **varios intervalos**, no uno largo
  (hoy eso fusiona pasos secuenciales: 7 de 69 lotes en el caso medido).
- `deriveInvocationBatches` agrupa por `stepId` del padre → alimenta **`deriveExecutionLevels`
  (filas/carriles)** y `parallelByNode` **(badge)** ⇒ se mantiene la paridad de FR-010.
- **`deriveExecutionKey` incorpora la firma de lotes** (ids + miembros): sin esto el memo por clave
  no se invalida al llegar los mensajes del padre y E4 sería un **no-op silencioso**.
- Respaldo: en la fase estructural (padre sin mensajes) sigue mandando el solape por sesión de
  `deriveSiblingBatches`, que **no se toca** (T019 lo deja como respaldo).
- `background: true` → fin = fin del tool part (0 casos medidos; documentado, no generalizado). Si
  algún día aparece, el fin pasa a `max(fin del tool part, fin de la hija)`.
- Coste: **ninguna consulta nueva** (los mensajes ya están en `queryKeys.sessions.messages(id)`);
  se deriva **solo para nodos con hijos** y memoizado por (sessionId, identidad de los mensajes).
- Incoherencia declarada: si la fila se agrupa por invocación y la barra del nodo se dibuja con el
  intervalo de sesión, la diferencia se **documenta** (no se fusiona implícitamente).

### E5 — skills del Inspector

`deriveSkills(messages)`: por cada tool de skill, `input.name` (o `input.id`), acumula `estTokens`
(caracteres ÷ 4 sobre `content[].text`), excluye `state.status === 'error'` y cuenta repeticiones.
`deriveResources` pasa de `skills: []` a recibir las skills ya derivadas, memoizado con el resto de
los derivados (no en render). UI: `ResourceRow` se extiende a `items: {label, note?}[]`; con `note`
pinta `label · note` sin el sufijo "disponible" (MCP/Instructions/Tools siguen igual). Copy: chip
`frontend-design · ~3.4k tokens` (`tabular-nums`), `estTokens` desconocido → solo el nombre;
`aria-label` deletrea "aproximadamente"; vacío → **"Sin skills cargadas"**; filas de Tools dicen
"usadas", Skills "cargadas".

### Estados de pantalla (E2/E3, Principio VI)

`isLoading` = `isFetching(directorio) || isLoading(estructura)`; `isError` = `isError(directorio) || isError(estructura)`.
Raíz fuera de ventana → carga acotada a `session.get` → datos; sesión inexistente → `EmptyState`
"no encontrada" con acción a `/sessions` (vía `notFound: boolean` aditivo en el resultado del
grafo); fallo de red → `EmptyScreenError`. `EmptyScreenFilter` no aplica. Banner de truncamiento:
`GraphTruncationBanner` nuevo en `Application/Components/Molecules/`, sobre `Alert`
`variant="warning"`, `role="status" aria-live="polite"` (patrón `ConnectionBadge`; **no**
`role="alert"`, que ya lo ocupa el banner de atención del chat), montado en `GraphPane` entre
cabecera y canvas, informativo puro y sin acción.

## Impacto por área

- **UX**: se gana la lista completa y estados honestos; el listado pasa de ~15 a 38 tarjetas
  (coste de render ×2,5, ver Riesgos); el riel de 280 px queda largo y la tarjeta seleccionada
  puede quedar fuera del viewport (no hay `scrollIntoView`).
- **Rendimiento**: payload de la lista 200→38 ítems (−81 %, 5,4×); subárbol 1 request/raíz en el
  bosque medido; `staleTime: Infinity` **no** protege de la invalidación por prefijo; los 8 tipos
  de evento de sesión (no solo `session.created`) invalidan la lista; el memo de enriquecimiento
  re-deriva todos los nodos listos por chunk (O(N²/2)) y E2 lo amplía.
- **Calidad**: 10 specs preexistentes en riesgo; los dos primeros fallan con `TypeError` (mocks sin
  los métodos nuevos), no por aserción.
- **Accesibilidad**: el banner usa `role="status"`/`aria-live="polite"`, no interrumpe y no se
  re-anuncia por tick; el `~` no es la única señal semántica (se deletrea en `aria-label`).
- **Seguridad**: sin hallazgos ni cambios (no se investigó superficie de autorización).

## Conflictos entre áreas y resolución

- **Plan vs. performance — E4 solo badge**: gana la medición. El plan describía cambiar el badge,
  pero las filas salen de `deriveExecutionLevels` y el memo por `deriveExecutionKey` (sin lotes) lo
  habría convertido en no-op. Resuelto por decisión **D6**: filas y badge desde invocaciones, firma
  de lotes en la clave. `specs/007` pasa a contrato mutable en FR-001/005/010.
- **Plan y norte vs. medición — cifras**: 468/37/431 (plan) vs **486/38/448** (store, 2026-10-12).
  Gana la medición; los criterios de aceptación se redactan sobre "**todas las raíces**", no sobre
  "37", y el baseline correcto es **200→38**. Motivo: el drift del store caduca cualquier número fijo.
- **Plan vs. quality — `filterSubtree` (T009)**: el plan dice que la usan `useGraphModel` y el
  barrel y que tiene specs. Verificado: se invoca **una vez** (`useGraphStructure.ts:69`),
  `useGraphModel.ts:28` solo la re-exporta y **no tiene spec propio**. Gana el informe (D10): se
  conserva como API pública por el barrel y se le añade spec propio.
- **Plan vs. quality — `SUBAGENT_TOOLS`**: el plan asume que se puede reutilizar; es privado
  (`Inspector/lib/deriveTasks.ts:8`) e importarlo cruzando dominios viola el Principio II. Se
  duplica en `Graph/lib/invocations.ts`.
- **Plan vs. medición — `background: true` (T021)**: el plan pedía verificar; la medición da **0
  casos** y dentro de foreground el fin del tool part precede al de la hija en 325/356 (mediana
  10 ms). Gana la medición (D8): fin = fin del tool part, con el fallback documentado.
- **Plan T027 vs. UX — `ResourceRow`**: el plan sugiere que pintar `nombre · ~N tokens` es un
  cambio de una línea; su contrato es `items: string[]` con "disponible" hardcodeado. Gana el
  informe: se amplía la molecule (los tres consumidores actuales quedan intactos).
- **Plan vs. UX — sesión no encontrada (omisión)**: sin ella, E2 cambiaría skeleton infinito por un
  "Sin agentes" **falso**. Se añade el caso (D9) con `notFound` aditivo.
- **Plan vs. performance — ¿bosque plano?**: performance no pudo medirlo y lo dejó como hipótesis.
  Gana la medición posterior (25 raíces sin hijos, 13 con hijos directos, 0 con nietos) ⇒ el BFS es
  **1 request por raíz** y el N+1 temido no existe.
- **Performance vs. usuario — coalescing SSE**: performance lo recomienda; decisión **D11** lo deja
  **fuera de alcance** (la invalidación por prefijo sí alcanza la key nueva; el coste baja de 200 a
  38 sesiones). Gana la decisión del usuario; queda como seguimiento.
- **Equilibrio de estados de carga**: seguridad y accesibilidad no entran en conflicto en este
  cambio; no hay tensión que requiera decisión del usuario.

## Archivos y contratos afectados

- `src/Infrastructure/Services/session.service.ts` — `listRootSessions`, `listChildSessions`, `getSession`.
- `src/Infrastructure/Services/lib/sessionPagination.ts` — **nuevo** (cursor; precedente `messagePagination.ts`, sin spec).
- `src/Domains/queryKeys.ts` — `sessions.roots(directory)`, `sessions.children(parentID)`; forma de la key del respaldo.
- `src/Domains/Sessions/Hooks/useRootSessions.ts` — consume el servicio nuevo; memoiza `items`/`groups`.
- `src/Infrastructure/WorkspacePage.tsx` — `directory` con `session.get` como respaldo.
- `src/Domains/Graph/Hooks/useGraphStructure.ts` — origen del subárbol, estados de pantalla.
- `src/Domains/Graph/Hooks/useGraphModel.ts` — `notFound` aditivo.
- `src/Domains/Graph/lib/loadPlan/subtree.ts` — **nuevo** cargador (reutiliza `ancestorChain`).
- `src/Domains/Graph/lib/invocations.ts` — **nuevo** (`deriveInvocations`, `deriveInvocationBatches`, `SUBAGENT_TOOLS` duplicada).
- `src/Domains/Graph/lib/execution/executionKey.ts` — firma de lotes.
- `src/Domains/Graph/lib/parallelism.ts`, `parallelByNode.ts` — respaldo y fusión de fuentes.
- `src/Application/Components/Molecules/GraphTruncationBanner.tsx` — **nuevo**.
- `src/Infrastructure/Components/GraphPane.tsx` — orden de estados + banner.
- `src/Domains/Inspector/lib/deriveSkills.ts` (**nuevo**), `deriveResources.ts`, `Components/ResourceList.tsx`, `Application/Components/Molecules/ResourceRow.tsx`.
- `src/Infrastructure/Hooks/useSessionOpenPerf.ts` — reapuntar a la key nueva.
- **Borrados**: `useSessionInfo` (`History/History.service.ts:30`) y `useSelectSession` (+ su spec).
- **Pendiente de resolver en el plan**: la forma de la key del respaldo. D4 dice "`session.get` como
  respaldo"; performance demuestra que `sessions.detail(directory, id)` es **inimplementable**
  (necesita el `directory` que aún no se conoce) y propone key por id (`['sessions','directory',id]`,
  `staleTime: Infinity`). El RFC adopta la propuesta de performance: **no reabre D4** (el respaldo
  sigue siendo `session.get`), solo corrige la forma de la key.

## Cambios de contrato

`specs/006-graph-render-performance/` (**4 archivos**):
1. `contracts/graph-loading-contract.md` §1.1 (líneas 28-36) — "Entradas de red: ninguna nueva…" queda
   falso; reescribir y añadir la distinción "consultas estructurales de sesiones" vs "consultas de contenido".
2. `data-model.md` — línea 16 (fuente `sessions.list`) y línea 135 ("sin cambios" en `queryKeys`).
3. `plan.md` — línea 41 (scope reutilizado sin cambios) y línea 102 (`queryKeys` sin cambios de forma).
4. `research.md` — líneas 28 y 132 ("No cambiar la forma de `queryKeys`").
   *Anotar* (no reescribir) `tasks.md:152,277` (R6/R7, histórico).

`specs/007-fix-parallel-lanes-live/` (**4 archivos**):
1. `spec.md` — **normativo**: FR-001 (línea 82, "agrupa **hermanos**"), FR-005 (86) y FR-010 (91,
   paridad fila↔badge), más Edge Cases línea 113 (semántica de paralelo). La unidad pasa de sesión a
   **invocación**.
2. `contracts/execution-lanes-contract.md` §2 (líneas 30-37) — el contrato más afectado: define la
   agrupación por solape de `executionInterval` y la garantía de paridad.
3. `data-model.md` — línea 29 (`TParallelGroup` vía `deriveSiblingBatches`), 104 (decisión 1), 108 (FR-005).
4. `research.md` — líneas 23-33 (decisión de "una sola lógica de intervalos").
   *Anotar* `plan.md:19-21` y `quickstart.md:43`.

## Riesgos

- **E4 no-op silencioso** — sin la firma de lotes en `deriveExecutionKey` el síntoma persiste sin test
  rojo. *Mitigación*: D6 + test que fije que las filas cambian al llegar los mensajes del padre.
- **E1 aislada duplica keys** — 2 refrescos por evento hasta que E2 saque al grafo de `sessions.list`.
  *Mitigación*: E1+E2 en el mismo cambio o medición intermedia aceptada.
- **Refresco por ráfaga** — los 8 tipos de evento sesión invalidan la lista sin coalescer; `staleTime`
  no protege. *Mitigación*: coste ya reducido a 38 ítems; coalescing como seguimiento (D11).
- **Coste de render del listado** — 38 tarjetas en vez de 15, con `useQueries` sin `combine`, memos
  inestables y sin `React.memo`; se repinta con el tick de 1 Hz y con cada flush de actividad.
  *Mitigación*: memoizar `items`/`groups`, `combine` y `React.memo` en `SessionCard`.
- **Specs en riesgo** — `useGraphStructure.spec.tsx` (7 tests, cambia la fuente y el contrato L4 del
  mock), `useRootSessions.spec.tsx` (cambia el método mockeado), `WorkspacePage.spec.tsx` y
  `.perf.spec.tsx` (`session.get`), `parallelism.spec.ts`, `deriveExecutionLayout.spec.ts`,
  `executionLevels.spec.ts`, `useGraphModel.spec.tsx`, `useInspectorData.spec.tsx`,
  `ResourceList.spec.tsx`. *Mitigación*: E3 los toca explícitamente; `buildSession({parentID})` ya existe.
- **Paridad fila↔badge sin cobertura** — es el fallo que originó la feature y no lo cubre ningún spec.
  *Mitigación*: test nuevo de paridad en E3.
- **Deriva de `SUBAGENT_TOOLS` duplicada** — divergencia futura entre Inspector y Graph.
  *Mitigación*: comentario que apunte al origen; 2 líneas.
- **Techo de fluidez de 006 (~200 agentes)** — el cargador no tiene presupuesto global y
  `deriveSiblingBatches` es O(n²) por grupo, recalculado por chunk. *Mitigación*: presupuesto de
  nodos/requests (pregunta abierta) y memoizar orden base por `(structure, ids)`.
- **Falta de medición por bloqueos** — no se pudo medir payload en bytes ni la profundidad real del
  árbol con la API. *Mitigación*: exponer `requestCount`/`depth` en el resultado del cargador.

## Seguimiento (fuera de alcance)

Refresco agresivo y **coalescing de invalidaciones SSE**: se verifica que la invalidación por prefijo
de `sessions.all` alcanza `[...all, directory, 'roots']` y no a `graph`/`metrics`/`permissions`; el
coalescing queda como issue aparte (D11). También queda fuera el N+1 de
`queryKeys.sessions.messages(id)` en el Inspector (la query activa se invalida con los 8 eventos y
re-descarga el histórico paginado), detectado por performance como más caro que E1/E2 y no tocado
por este run.

## Decisiones

`decision/cache-subtree` (D5) · `decision/e4-completa` (D6) · `decision/borrado-codigo-muerto` (D7) ·
`decision/t021-fin-invocacion` (D8) · `decision/ux-estados-graph` (D9) · `decision/filter-subtree-spec`
(D10) · `decision/coalescing-fuera-de-alcance` (D11); del plan: D1 (raíces y grafo no comparten
caché), D2 (cursor, no subir `limit`), D3 (`roots(directory) = [...sessions.all, directory, 'roots']`),
D4 (`directory` con `session.get` como respaldo).

## Preguntas abiertas

- **Presupuesto global del cargador de subárbol**: (A) presupuesto de nodos/requests + aviso por
  encima de ~200 agentes, (B) solo tope por padre, (C) truncar a ~200. **Recomendada: A.**
- **Ventana de la barra del nodo vs. ventana de la invocación**: documentar la diferencia o
  unificarlas. **Recomendada: documentar** (la barra mantiene el intervalo de sesión).
- **Plan no accesible**: `improvements/fix-session-list-parent-window.md` no pudo leerse en este
  subagente (permiso denegado). Este RFC se reconstruyó desde el norte, los tres informes y las
  decisiones, que citan el plan por línea. Si el plan contiene un requisito no reflejado aquí, hay
  que añadirlo antes de `plan`.
