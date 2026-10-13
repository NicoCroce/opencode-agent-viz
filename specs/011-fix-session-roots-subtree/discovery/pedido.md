# Plan — Fix: la ventana de sesiones se satura con sesiones hijas

**Estado:** propuesto (Plan mode, sin cambios aplicados)
**Fecha:** 2026-10-12
**Ámbito:** `Infrastructure/Services`, `Domains/Sessions`, `Domains/Graph`, `Domains/Inspector`,
`Infrastructure/WorkspacePage`

---

## 1. Problema

El visor pide la lista de sesiones con `limit: 200` y **sin filtrar por padre**. Como
`GET /api/session` devuelve raíces **e** hijas juntas, los subagentes consumen la ventana
y desplazan a las sesiones raíz antiguas.

Consecuencia: sesiones raíz reales (y sus subárboles completos) desaparecen del visor, y
abrir su URL deja la página colgada en un skeleton sin error.

## 2. Evidencia (medida contra el server y el store, 2026-10-12)

Proyecto `opencode-agent-viz`: **468 sesiones** (37 raíces + 431 hijas).

| Consulta | Devuelve | Raíces | Hijas |
|---|---|---|---|
| `limit=200&order=desc` (lo que pide el visor hoy) | 200 | **15** | 185 |
| `limit=200&order=desc&parentID=null` | 37 | **37** | 0 |

- **22 de 37 raíces** quedan fuera de la ventana y son invisibles.
- Verificado puntualmente: `ses_ee308fe0` (50 hijos) y `ses_ee40c3ae` (40 hijos) **no están**
  en la respuesta de 200.
- La raíz visible más antigua es `ses_ee27bedb`; todo lo anterior desapareció.

Descendientes fuera de la ventana (incluye la propia raíz):

| Raíz | Hijos | Fuera de la ventana |
|---|---|---|
| `ses_ee308fe0` | 50 | 51 (raíz + todos los hijos) |
| `ses_ee40c3ae` | 40 | 41 (idem) |
| `ses_eed20c896` | 44 | 45 (idem) |
| `ses_efbdf4713` | 32 | 33 (idem) |
| `ses_ed8a1bdd0` | 109 | 0 (entra completa) |

## 3. Causa raíz

1. `src/Infrastructure/Services/session.service.ts:59-66` — `listSessions` pide
   `{ directory, order: 'desc', limit: 200 }`, sin `parentID`, y **descarta el cursor**
   (`const { data } = ...` cuando la respuesta es `SessionsResponse = { data, cursor }`).
2. `src/Domains/Sessions/Hooks/useRootSessions.ts:46` — filtra raíces **en cliente**
   (`.filter((s) => s.parentID === undefined)`). El filtro es correcto, pero se aplica
   sobre una página que ya perdió las raíces viejas.
3. `src/Infrastructure/WorkspacePage.tsx:137-141` — el `directory` se resuelve **solo**
   desde `items` (raíces cargadas). Si la sesión no está en la ventana → `directory = null`.
4. `src/Domains/Graph/Hooks/useGraphStructure.ts:151` — con `directory` nulo fuerza
   `isLoading: true`. `GraphPane.tsx:83` muestra skeleton **indefinidamente, sin error**.
5. `src/Domains/Graph/lib/filterSubtree.ts` — el grafo hace BFS sobre esa misma lista, así
   que un subárbol fuera de la ventana sale vacío (o cortado a la mitad, que es peor porque
   no se nota).

## 4. Objetivo y no-objetivos

**Objetivo**

- Toda sesión raíz del proyecto es listable y accesible, sin depender de la ventana.
- Abrir una sesión por URL nunca queda en loading por no resolver el `directory`.
- El grafo del subárbol es completo (o declara explícitamente que está truncado).

**No-objetivos**

- Cambiar el modelo de datos del grafo, el layout o las métricas.
- Paginar el histórico de mensajes (ya está resuelto con `collectAllMessages`).
- Cambiar la vista de Chat, Inspector o History.

## 5. Decisiones de diseño

**D1. La lista de raíces y la del grafo dejan de compartir caché.**
Hoy `useRootSessions` y `useGetSessions` comparten `queryKeys.sessions.list(directory)`.
Si se agrega `parentID: null` al servicio compartido, el grafo se queda sin hijos y todos
los árboles se rompen. Se separan en dos claves/servicios.

**D2. Se pagina con cursor, no se sube el `limit`.**
`SessionsResponse.cursor.next` funciona con `parentID=null` (verificado: la paginación
avanza y el cursor lleva el filtro embebido en base64). Precedente a copiar:
`src/Infrastructure/Services/lib/messagePagination.ts` (`MESSAGE_PAGE_SIZE`, `MESSAGE_MAX_PAGES`,
loop de cursor, `order` solo en la primera página porque la API rechaza `cursor` + `order`).

**D3. La key nueva cuelga de `sessions.all`.**
`queryKeys.sessions.roots(directory)` se define como `[...all, directory, 'roots']` para que
la invalidación por prefijo de `sessions.all` (que dispara `EventStreamProvider`) siga
alcanzándola sin tocar el reducer.

**D4. El `directory` no depende de la lista.**
Respaldo vía `session.get({ sessionID })` → `SessionInfo.location.directory`, que funciona
para cualquier sesión, esté o no en la ventana.

**Alternativas descartadas**

- *Subir el `limit`*: no escala. El proyecto crece ~430 hijas/mes y `specs/006` fija el techo
  de diseño en "~200 agentes con fluidez" (`plan.md:41`). Además cada `session.created`
  (que ocurre en **cada** spawn de subagente) invalida la lista y dispara el refetch: paginar
  más sesiones por request es lo que empeora, no lo que mejora.
- *Filtrar solo en cliente*: es lo que ya se hace y no resuelve el problema; el daño ocurre
  antes, en el server, al recortar la página.

---

## 6. Etapas

El orden está pensado para **no romper nada** entre etapas: E1 agrega un camino nuevo sin
tocar el que usa el grafo; E2 recién después reemplaza el origen del grafo. E3 cierra los
tests. **E4 y E5 son independientes** de E1–E3 y entre sí: se pueden hacer en cualquier
orden, aunque conviene E4 después de E2 (necesita el subárbol completo para que la fila se
vea) y E5 en cualquier momento.

### E1 — Lista de raíces paginada (arregla síntomas 1 y 2)

**T001** — Nuevo helper `src/Infrastructure/Services/lib/sessionPagination.ts`, calcado de
`messagePagination.ts`: `SESSION_PAGE_SIZE = 200`, `SESSION_MAX_PAGES` (proponer 25 → 5.000
sesiones), devuelve `{ sessions, truncated }` para poder avisar si se cortó.

**T002** — En `session.service.ts`, agregar `listRootSessions(directory)`:
`session.list({ directory, parentID: null, limit: SESSION_PAGE_SIZE, order: 'desc' })`
+ paginación por cursor. **No** tocar `listSessions` (la sigue usando el grafo hasta E2).

**T003** — `src/Domains/queryKeys.ts`: agregar `sessions.roots(directory)` según D3.

**T004** — `useRootSessions.ts`: consumir `listRootSessions` con la key nueva. Mantener el
`.filter((s) => s.parentID === undefined)` como red de seguridad, con comentario que explique
por qué sigue ahí (defensa en profundidad si el server ignorara el filtro).

**T005** — `WorkspacePage.tsx:137-141`: nuevo hook `useSessionDirectory(id, items)` (o helper
en `Domains/Sessions/Hooks/`) que resuelve el `directory` así: `items` → `session.get` →
`null`. Con `session.get` el caso "raíz fuera de la ventana" deja de colgar la página.
Usar `queryKeys.sessions.detail(directory, id)` para cachear.

**T006** — Revisar `src/Domains/History/History.service.ts:30` (`useSessionInfo`): hoy usa la
key compartida y **no se consume en ningún lado** (código muerto). Decidir: eliminarlo o
migrarlo a `sessions.detail`. No dejarlo apuntando a una key que cambia de semántica.

### E2 — Subárbol del grafo bajo demanda (arregla síntoma 3)

**T007** — `session.service.ts`: agregar `listChildSessions(parentID, directory?)` usando
`session.list({ parentID, ... })` + paginación. Key propia:
`queryKeys.sessions.children(parentID)`.

**T008** — Nuevo cargador puro `src/Domains/Graph/lib/loadPlan/collectSubtree.ts`:
1. Resolver la raíz subiendo por `parentID` desde `sessionId` con `session.get`
   (`traversal.ts:16` ya tiene la lógica de `ancestorChain`, reutilizarla).
2. BFS hacia abajo con `listChildSessions` por nodo.
3. Devolver `{ sessions, truncated }`.

Para árboles planos (raíz + N hijos, el caso común) es **1 request**; para anidados, una por
nodo interno. Esto encaja con el orden de prioridad que ya existe en
`orderSubtreeForLoad.ts` (raíz → linaje del seleccionado → activos → resto por nivel).

**T009** — `useGraphStructure.ts:62-71`: reemplazar `useGetSessions(directory)` +
`filterSubtree(sessions, sessionId)` por el cargador de T008. `filterSubtree` se conserva como
función pura (la usan `useGraphModel` y el barrel de `Hooks`, y tiene specs).

**T010** — Si el subárbol se trunca (`truncated: true`), exponerlo en el resultado y mostrarlo
en la UI (banner discreto en `GraphPane`). Un grafo incompleto silencioso es el peor caso.

**T011** — Actualizar el "contrato de carga" en `specs/006-graph-render-performance/`
(`data-model.md`, `plan.md`): el origen estructural deja de ser la lista global del proyecto.

### E3 — Tests y cierre

**T012** — `src/Infrastructure/Services/specs/`: test del input de `listRootSessions`
(`parentID: null` presente) y de la paginación (2 páginas con cursor → 2 requests, sin
duplicados, `order` solo en la primera).

**T013** — `useRootSessions.spec.tsx`: caso con hijas mezcladas en la respuesta → solo
aparecen raíces. Hoy no existe ningún caso con `parentID`.

**T014** — `SessionList.page.spec.tsx`: caso con > 200 sesiones mixtas → todas las raíces
visibles (regresión directa del bug).

**T015** — `WorkspacePage.spec.tsx`: sesión que **no** está en `items` → cae a `session.get`,
resuelve el `directory` y **no** queda en loading.

**T016** — `useGraphStructure.spec.tsx`: subárbol con hijos fuera de la primera página → el
grafo los incluye; caso `truncated` → se declara.

**T017** — Fixture: reutilizar `buildSession({ parentID })` de
`src/Domains/Sessions/specs/fixtures.ts` (el campo ya existe).

### E4 — Paralelismo por invocación, no por sesión

**Síntoma:** hay pasos del padre que lanzaron varios subagentes en paralelo y no se ven
como una fila, y hay pasos secuenciales que sí se ven como paralelos.

**Diagnóstico medido** (contra `opencode.db`, con la verdad de fondo = subagentes lanzados
en el mismo paso del padre):

| Ejecución | Pasos paralelos partidos | Lotes que mezclan pasos distintos |
|---|---|---|
| `ses_ed8a1bdd0` (109 hijos, 77 pasos, 117 spawns) | 0 | 7 |
| `ses_ee27bedb1` | 0 | 1 |
| `ses_ee40c3ae6` | 0 | 1 |

El agrupamiento por solape de intervalos **acierta cuando los datos están completos** (los 17
lotes paralelos de `ses_ed8a1bdd0` coinciden con los 17 pasos del padre que lanzaron 2+
subagentes). La causa de los lotes falsos es que **una sesión hija puede reanudarse en varios
pasos** (parámetro `task_id` en V1, `sessionID` en V2): pasó en **8 de los 117 spawns**. El
visor la dibuja como un solo nodo con un intervalo largo, que se solapa con los vecinos y
fusiona pasos secuenciales. En las tres ejecuciones, **todos** los lotes mezclados contienen
una sesión reutilizada, y ninguno aparece sin ella.

**Decisión:** la unidad de paralelismo pasa a ser la **invocación** (una llamada `subagent`/
`task` del padre), no la sesión. Una sesión reanudada son dos invocaciones.

**T018** — Función pura `src/Domains/Graph/lib/invocations.ts`: `deriveInvocations(messages)`
que, por cada parte `tool` con `name` en `SUBAGENT_TOOLS` (`{subagent, task}`, ya definido en
`Inspector/lib/deriveTasks.ts`), devuelve `{ sessionId, stepId, startedAt, endedAt, status }`.
- `sessionId` sale de `metadata.sessionID` (verificado: presente en el 100% de los spawns).
- `stepId` es el id del mensaje assistant que contiene la llamada.
- `startedAt`/`endedAt` salen de los tiempos del tool part.

**T019** — Función pura `deriveInvocationBatches(invocations)`: agrupa por `stepId`; un paso
con 2+ invocaciones es un lote paralelo. Reemplaza a `deriveSiblingBatches` como fuente
principal, y esta última queda como **respaldo** para nodos sin datos de invocación (fase
estructural). Conservar `deriveParallelGroups` para no romper sus specs.

**T020** — Integrar en la fase de enriquecimiento: `useGraphEnrichment`/`useGraphModel` ya
cargan los mensajes de cada sesión. `parallelByNode` combina ambas fuentes y **la invocación
gana** cuando existe. Mientras el padre no tenga sus mensajes cargados, se mantiene el
comportamiento actual por solape, de modo que el grafo estructural no cambia (contrato de
carga §1.1 de `specs/006`).

**T021** — Caso `background: true` (solo `subagent`, 8 llamadas en los datos): el tool part
puede completarse antes de que la hija termine. Definir si el fin de la invocación es el del
tool part o el de la sesión hija. **Punto a verificar con datos** antes de implementar; la
muestra es chica.

**T022** — Actualizar el contrato de `specs/007-fix-parallel-lanes-live/` (`data-model.md`,
`contracts/`): el agrupamiento deja de ser solo por solape de intervalos de sesión.

**T023** — Tests (`Graph/lib/specs/`): paso con 2+ invocaciones → un lote; sesión reutilizada
en dos pasos → dos invocaciones y **dos** lotes; pasos secuenciales → lotes distintos; caso
`background`.

### E5 — Skills cargadas en el detalle del Inspector

**Síntoma:** la sección SKILLS del Inspector muestra "Sin skills configuradas" siempre.

**Causa (confirmada):** no es un fallo de pintado. `src/Domains/Inspector/lib/deriveResources.ts:24`
fija `skills: []`, y `useInspectorData.ts:70-74` ni siquiera pasa los mensajes. Ningún test lo
detectó: `ResourceList.spec.tsx` solo prueba con `skills: []`.

**Alcance acordado:** solo las skills que la sesión **cargó**. No se muestran las permitidas por
la definición del agente (`skill allow/deny`), que exigiría leer los permisos del agente.

**Fuente:** los mensajes de la sesión que el Inspector ya carga (`useSessionMessages`). Cada
carga es una parte `tool` con `name: 'skill'` (367 llamadas en las hijas del store). En
`state.status === 'completed'`:
- `input.name` o `input.id` — el nombre de la skill (ambas claves se usan en los datos; con una
  sola se perderían casos como `{'id': 'commit-conventions'}`).
- `content[].text` — el texto que entró al contexto, base de la estimación de tokens.

**T024** — Función pura `src/Domains/Inspector/lib/deriveSkills.ts`: `deriveSkills(messages)`
devuelve, por skill, `{ name, count, firstLoadedAt, estTokens }`. Acepta `input.name` e
`input.id`. Una llamada con `state.status === 'error'` (por ejemplo, denegada por permisos) se
excluye y no cuenta como cargada.

**T025** — `TResourceUsage.skills` (`InspectorResources.entity.ts`) pasa de `{ name: string }[]`
a `{ name: string; count: number; estTokens: number }[]`.

**T026** — `deriveResources` y `useInspectorData` reciben los mensajes y propagan las skills.

**T027** — `ResourceList.tsx:36-40`: mostrar `nombre · ~N tokens` (con `~` porque la estimación
es caracteres/4, un orden de magnitud, no el valor real) y cambiar el texto vacío a
**"Sin skills cargadas"**. La fila de Tools dice "usadas"; Skills debe decir "cargadas".

**T028** — Tests: `deriveSkills` con `input.name`, con `input.id`, con skill repetida, con
estado `error`; `ResourceList.spec.tsx` con datos reales (hoy solo prueba el vacío).

---

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| E2 regresiona layout/paralelismo/métricas | Correr los specs existentes del grafo como red: `useGraphStructure.spec.tsx`, `buildGraph.spec.ts`, `useGraphModel.spec.tsx`, `deriveExecutionLayout.spec.ts`. Fixture con 109 hijos (`ses_ed8a1bdd0`) |
| Refetch por `session.created` en cada spawn | La lista de raíces es mucho más chica (37 vs 468): el refetch se **abarata**, no se encarece. Verificar en E1 que la invalidación por prefijo alcanza la key nueva (D3) |
| BFS del subárbol = N+1 requests en árboles profundos | Solo paga por nodos internos; los planos son 1 request. Añadir cache por `parentID` con `staleTime: Infinity` y poda con `orderSubtreeForLoad` |
| `session.get` por sesión no cacheada | Key `sessions.detail` con `staleTime: Infinity`; el dato es casi inmutable (solo cambia `time.updated`) |
| E4 depende de los mensajes del padre, que se cargan en enriquecimiento | Mantener el solape por sesión como respaldo en la fase estructural; la invocación solo refina cuando llegan los mensajes. No abrir consulta nueva en la fase estructural |
| E4 con `background: true` (8 llamadas) | Verificar con datos si el fin es el del tool part o el de la hija antes de implementar (T021). Muestra chica: no generalizar |
| `estTokens` de E5 es una estimación (caracteres/4) | Rotular con `~` en la UI; no usarlo como métrica de coste |

## 8. Criterios de aceptación

1. `/sessions` y el riel listan **las 37 raíces** del proyecto (hoy 15), sin subagentes.
2. Ninguna raíz del store queda inaccesible: abrir la URL de `ses_ee308fe0` renderiza.
3. El grafo de `ses_ee308fe0` muestra **51 nodos** (raíz + 50 hijos), no vacío.
4. Ninguna pantalla queda en skeleton infinito por `directory` no resuelto.
5. Una ejecución con sesión hija reutilizada (`ses_ed8a1bdd0`) no muestra pasos secuenciales
   como una fila paralela (hoy: 7 lotes mezclados; objetivo: 0).
6. El Inspector de una hija que cargó una skill (`sddorch-researcher-code` con
   `frontend-design`) lista la skill con su nombre y `~N tokens` (hoy: "Sin skills cargadas").
7. `npm test` verde, sin cambios en specs preexistentes más allá de los agregados.

## 9. Verificación

```bash
# 1. El server devuelve las raíces correctas
opencode api get "/api/session?directory=$PWD&parentID=null&limit=200&order=desc"

# 2. Suite completa + tipos + lint
pnpm test
pnpm tsc
pnpm lint

# 3. Manual: /sessions muestra 37 raíces; deep link a ses_ee308fe0 renderiza 51 nodos
```

## 10. Fuera de alcance / seguimiento

- `useSessionInfo` muerto (`History.service.ts:30`) — T006.
- ¿Conviene un filtro de raíces en el server para el grafo (subárbol completo en un request)?
  No existe hoy; si el BFS molesta, proponerlo como issue.
- El riel lateral (`SessionsRail`) usa los mismos `groups`; queda cubierto por E1 sin cambios.
- E5 no muestra las skills **permitidas** por el agente (solo las cargadas). Exigiría leer los
  permisos del agente por sesión; la API no lo expone hoy de forma clara.
- El coste de arranque por nodo (prefijo del primer paso) queda fuera; pertenece a la spec 010
  y hay que verificar su alcance antes de proponerlo.
