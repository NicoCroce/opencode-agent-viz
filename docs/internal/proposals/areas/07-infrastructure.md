# Área 07 — `Infrastructure` + `Application` (Hooks / Helpers / lib)

> Análisis **de solo lectura**. No se modificó código de producto.
> Umbral GORDO: **≥150 líneas** (excluye `*/specs/*`, `*.spec.ts(x)`).
> Base: `docs/internal/proposals/inventario-gordos.md`, `AGENTS.md`, `.specify/memory/constitution.md`.

## Resumen del área

El área contiene **3 archivos gordos** (todos en `src/Infrastructure`):

| # | Archivo | Líneas | Motivo |
|---|---------|-------:|--------|
| 1 | `src/Infrastructure/WorkspacePage.tsx` | 413 | (c) LOGICA-MEZCLADA |
| 2 | `src/Infrastructure/Services/opencodeClient.ts` | 237 | (e) OTRO (service SDK) |
| 3 | `src/Infrastructure/EventStreamProvider.tsx` | 225 | (c) LOGICA-MEZCLADA |

El resto del área (`src/Application/Hooks/**`, `src/Application/Helpers/**`,
`src/Application/lib/**`, `src/App.tsx`, `src/queryClient.ts`,
`Routes.tsx`, `AppShell.tsx`) está por debajo del umbral, pero concentra la
**deuda transversal**: helpers duplicados entre dominios (`useNow`, `totalTokens`,
`formatClock`), código muerto (`formatter.ts`, `IPagination.ts`, `useDebounce`) y
uso de magic strings (`'isMobile'`, `'backButtonEnabled'`, literales de métricas
y constantes de tiempo del stream). Se tratan en la sección de consolidación.

Diagnóstico por archivo:

- **`WorkspacePage.tsx`** mezcla tres capas en un solo componente: (1) orquestación
  de una docena de hooks de 4 dominios distintos, (2) instrumentación de perf
  (refs + 2 `useEffect`), (3) lógica del overlay histórico con *render-phase state
  correction*, y (4) tres bloques JSX inline (`rail`, `graphPane`, `inspectorPane`)
  más un layout móvil/desktop duplicado. No tiene subcomponentes nombrados.
- **`opencodeClient.ts`** es un único módulo con ~18 métodos wrapper de dominios
  dispares (sessions, messages, forms, inbox, permissions, instructions, agents,
  mcp, projects, event) + tipos + normalización + paginación por cursor.
- **`EventStreamProvider.tsx`** mezcla, en un componente, cuatro responsabilidades
  independientes: máquina de conexión con backoff, batching (~100 ms), despacho de
  eventos al `queryClient` y sondeo/reconciliación de sesiones activas. Solo
  `applyActiveSeed` está extraída como función pura; el resto vive en refs y
  efectos del componente.

---

## Propuestas por archivo

### `src/Infrastructure/WorkspacePage.tsx` — 413 líneas (motivo: LOGICA-MEZCLADA)

Responsabilidad objetivo del archivo: **composición**. Debe quedar como un
componente que llama hooks, arma las piezas y elige presentación
(presentación pura, sin derivaciones pesadas ni instrumentación).

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| `useSessionOpenPerf` | Hook | `src/Infrastructure/Hooks/useSessionOpenPerf.ts` | `(params: { id: string\|null; directory: string\|null; isLoading: boolean; isError: boolean; nodeCount: number }): void` — encapsula `queryClient.getQueryData`, `perfMark`/`perfMeasure` y el `useRef` de la métrica pendiente (líneas 91–117) | Solo Workspace (específico) | ~40 |
| `useWorkspaceSummary` | Hook | `src/Infrastructure/Hooks/useWorkspaceSummary.ts` | `(params: { items: TRootSessionItem[]; id: string\|null; graph: TGraphModel; resourceUsage?: TResourceUsage }): { summary: TSessionSummary\|null; now: number }` — agrupa `hasActiveNode`, `useNow` y `summarizeSession` (líneas 127–138) | Solo Workspace (específico) | ~30 |
| `useHistoryOverlay` | Hook | `src/Infrastructure/Hooks/useHistoryOverlay.ts` | `(params: { graph: TGraphModel; targetId: string\|null; rootId: string\|null; onClose: () => void }): { node: TGraphNode\|null; lineage: TLineageNav; missingId: string\|null; clearMissing: () => void }` — unifica reset por cambio de raíz, detección de objetivo ausente y linaje padre/hijos (líneas 146–209, 172–188) | Solo Workspace; la lógica de linaje podría reusarla el dominio History | ~55 |
| `useInspectedNodeContext` | Hook | `src/Infrastructure/Hooks/useInspectedNodeContext.ts` | `(params: { graph: TGraphModel; inspectedNodeId: string\|null }): { node: TGraphNode\|null; peers: TGraphNode[]; invokedBy: TGraphNode\|null }` — deriva nodo, peers de `parallelGroups` y padre por arista (líneas 164–170, 211–233) | Solo Workspace | ~35 |
| `GraphPane` | Componente | `src/Infrastructure/Components/GraphPane.tsx` | `{ graph: TGraphModel; summary: TSessionSummary\|null; follow: TFollowMode; selectedNodeId: string\|null; onSelectNode: (id: string) => void; onClearSelection: () => void; onOpenHistory: (id: string) => void }` — cabecera (contador + `SessionSummaryBar` + botón seguir) y ternario de estados error→carga→vacío→datos (líneas 293–340) | Futuro `GraphPage` dedicada; tests de estados | ~65 |
| `SessionsRail` | Componente | `src/Infrastructure/Components/SessionsRail.tsx` | `{ groups: TSessionGroup[]; statuses: Record<string, SessionStatus>; selectedId: string\|null; isLoading: boolean; onSelect: (id: string) => void }` — envuelve `SessionList`/`SessionListSkeleton` con el título "Sesiones" (líneas 273–291) | Cualquier layout con rail lateral | ~25 |
| `InspectorPane` | Componente | `src/Infrastructure/Components/InspectorPane.tsx` | `{ graph: TGraphModel; inspectedNodeId: string\|null; showReasoning: boolean; onToggleReasoning: () => void; onOpenHistory: (sessionId: string) => void }` — usa `useInspectedNodeContext` internamente y rinde `InspectorPanel` (líneas 342–351) | Solo Workspace | ~30 |
| `HistoryOverlay` | Componente | `src/Infrastructure/Components/HistoryOverlay.tsx` | `{ node: TGraphNode\|null; lineage: TLineageNav; missingId: string\|null; onClearMissing: () => void; showReasoning: boolean; onToggleReasoning: () => void; onNavigate: (id: string) => void; onClose: () => void; questions: TQuestionEntry[]; context: { messages; isError; isLoading } }` — `HistoryModal` o diálogo "no disponible" (líneas 235–271) | Solo Workspace | ~45 |
| `WorkspaceMobileTabs` | Componente | `src/Infrastructure/Components/WorkspaceMobileTabs.tsx` | `{ tab: TWorkspaceTab; onChange: (tab: TWorkspaceTab) => void; sessions: ReactNode; graph: ReactNode; inspector: ReactNode }` — tablist + panel activo (líneas 353–389) | Cualquier pantalla de workspace | ~40 |
| `WORKSPACE_TABS` / `TWorkspaceTab` / `EMPTY_LINEAGE` / `EMPTY_RESOURCE_USAGE` | Constantes/Tipos | `src/Infrastructure/WorkspacePage.constants.ts` | `export const WORKSPACE_TABS = ['sessions','graph','inspector'] as const; export type TWorkspaceTab = typeof WORKSPACE_TABS[number]` + los dos `EMPTY_*` (líneas 53–69) | WorkspacePage + WorkspaceMobileTabs | ~15 |

**Resultado estimado:** `WorkspacePage.tsx` queda en ~80–100 líneas de composición
pura (hooks + armado de nodos + elección móvil/desktop). Se crean ~8 piezas
atómicas por un total ~345 líneas repartidas; el código total del área no baja
mucho, pero deja de haber un monolito de orquestación.

**Riesgos/specs afectados:**
- `src/Infrastructure/specs/WorkspacePage.spec.tsx` y
  `WorkspacePage.perf.spec.tsx` **mockean `@app/Domains/Graph`, `@app/Domains/Sessions`,
  `@app/Domains/Inspector`, `@app/Domains/History`** y afirman sobre el DOM
  (`screen.getByText('Error')`, `'Sin agentes'`, `'1 agentes'`, `graph-skeleton`,
  `agent-graph`). Las piezas nuevas **deben importar desde los barrels de dominio**
  (no por ruta profunda) para que los `vi.mock` sigan interceptando.
- `WorkspacePage.perf.spec.tsx` espía `graphHooks.useNow` **a través del barrel
  `@app/Domains/Graph`** y verifica `useNow(1000, false|true)`. Si `useWorkspaceSummary`
  importa `useNow` por ruta profunda, el espía deja de observarlo → el test rompe.
  Hay que mantener el import por barrel o reubicar el espía.
- El orden del ternario error→carga→vacío→datos es **contrato verificado** (FR-008,
  Principio VI). `GraphPane` debe conservar exactamente ese orden de ramas.
- `WorkspacePage.perf.spec.tsx` depende de que `useGraphModel` real siga en el
  árbol; no mover esa llamada fuera de la página sin ajustar el mock.

---

### `src/Infrastructure/Services/opencodeClient.ts` — 237 líneas (motivo: OTRO / service SDK)

Responsabilidad objetivo: **fachada** que compone el acceso read-only al SDK y
reexporta los tipos de mensaje. La implementación se reparte por sub-dominio.

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| `resolveBaseUrl` + `opencodeClient` | Módulo/Singleton | `src/Infrastructure/Services/client.ts` | `export const resolveBaseUrl = (): string`; `export const opencodeClient = OpenCode.make({ baseUrl: resolveBaseUrl() })` (líneas 57–65) | Todos los services + specs | ~15 |
| `TContentPart`, `TSessionMessage`, `normalizeMessages` | Tipos + pure fn | `src/Infrastructure/Services/message.entity.ts` | `TSessionMessage = { info: SessionMessageInfo; parts: TContentPart[] }`; `normalizeMessages(messages: SessionMessageInfo[]): TSessionMessage[]` (líneas 26–74) | message services; dominio History | ~40 |
| `collectAllMessages` + `MESSAGE_PAGE_SIZE`/`MESSAGE_MAX_PAGES` | Lib pura | `src/Infrastructure/Services/lib/messagePagination.ts` | `collectAllMessages(client: OpenCode, id: string): Promise<SessionMessageInfo[]>` — loop de cursor sin `order` + `limit` (líneas 77–78, 158–170) | `getSessionMessages`; cualquier lectura completa de mensajes | ~35 |
| `sessionReadService` | Service | `src/Infrastructure/Services/session.service.ts` | `{ listSessions, getActiveSessions, getSessionMessages, getHistoryMessages, getSessionDiff, getSessionStats, getSessionContext, getSessionLog, exportSession, getSessionPermissions, getSessionInstructions }` (líneas 82–116, 138–223) | Consumidores actuales de `opencodeService` | ~70 |
| `formReadService` | Service | `src/Infrastructure/Services/form.service.ts` | `{ listSessionForms, getSessionForm, listSessionInbox }` (líneas 109–112, 191–199) | Inspector | ~25 |
| `catalogReadService` | Service | `src/Infrastructure/Services/catalog.service.ts` | `{ listProjects, listAgents, getMcpServers }` (líneas 81, 124–125, 135–137, 224–233) | Sessions/Graph (agents, mcp) | ~30 |
| `eventReadService` | Service | `src/Infrastructure/Services/event.service.ts` | `{ subscribeEvents(signal?): AsyncIterable<V2Event> }` (líneas 131, 234–236) | EventStreamProvider | ~15 |
| `OpenCodeService` (agregador) | Interfaz + fachada | `src/Infrastructure/Services/opencodeClient.ts` (permanece) | Reexporta `opencodeClient`, `resolveBaseUrl`, `TSessionMessage`, `TContentPart`, `normalizeMessages` y compone `opencodeService = { ...sessionReadService, ...formReadService, ...catalogReadService, ...eventReadService }` con los mismos nombres de método | Todos los imports actuales (`@app/Infrastructure/Services/opencodeClient`) | ~45 |

**Resultado estimado:** `opencodeClient.ts` baja de 237 a ~45 líneas (fachada +
reexports). La superficie pública no cambia, así que ningún consumidor necesita
editar imports.

**Riesgos/specs afectados:**
- `src/Infrastructure/Services/specs/opencodeClient.spec.ts` importa
  `{ opencodeClient, opencodeService }` desde `../opencodeClient` y espía
  `opencodeClient.message.list` / `session.diff` / `session.log`. La fachada debe
  **reexportar** `opencodeClient` y `opencodeService` con los mismos métodos.
- El test de FR-037 enumera nombres de método sobre `opencodeService`: el
  agregador debe exponer exactamente la misma lista (incluye `listSessions`,
  `getHistoryMessages`, `exportSession`, `subscribeEvents`, etc.).
- `collectAllMessages` recibe el cliente por parámetro (no importa el singleton),
  lo que la hace testeable en aislamiento; el test de paginación actual seguirá
  pasando vía la fachada.
- Convención: `OpenCodeService` es una interfaz de service; mantener el prefijo
  solo para tipos de entidad (`TSessionMessage`, `TContentPart` cumplen).

---

### `src/Infrastructure/EventStreamProvider.tsx` — 225 líneas (motivo: LOGICA-MEZCLADA)

Responsabilidad objetivo: **provider fino** que compone (1) la conexión SSE, (2)
el batching y (3) el seed de sesiones activas, y expone el contexto de conexión.
Las tres lógicas se extraen a módulos/hook independientes y testeables.

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| `eventStream.constants.ts` | Constantes | `src/Infrastructure/lib/eventStream.constants.ts` | `FLUSH_INTERVAL_MS = 100`, `MAX_ATTEMPTS = 5`, `ACTIVE_POLL_MS = 2500`, `BACKOFF_BASE_MS = 1000`, `BACKOFF_MAX_MS = 30000` (líneas 28–36, 197) | Provider + tests | ~10 |
| `computeBackoffDelay` | Lib pura | `src/Infrastructure/lib/backoff.ts` | `computeBackoffDelay(attempt: number, opts?: { baseMs: number; maxMs: number }): number` — hoy inline `Math.min(1000 * 2 ** attempt, 30000)` (línea 197) | Cualquier reconexión con backoff | ~12 |
| `applyActiveSeed` | Lib pura | `src/Infrastructure/lib/applyActiveSeed.ts` | `(prev, seed, { reset, missing }): Record<string, SessionStatus>` — mover tal cual (líneas 54–87). Reexportar desde el provider para compat del spec **o** actualizar el import del spec | Provider + test | ~35 |
| `createEventBatcher` | Lib pura | `src/Infrastructure/lib/eventBatcher.ts` | `createEventBatcher<T>({ flushIntervalMs, onFlush }: { flushIntervalMs: number; onFlush: (items: T[]) => void }): { push(item: T): void; flushNow(): void; cancel(): void }` — encapsula `bufferRef` + `flushTimerRef` + `scheduleFlush` (líneas 97–120) | Provider; cualquier stream que necesite batching | ~35 |
| `applyReducedEvent` | Lib pura | `src/Infrastructure/lib/applyReducedEvent.ts` | `applyReducedEvent(event: TReducibleEvent, queryClient: QueryClient): void` — corre `reduceEvent` y aplica `setQueryData`/`invalidateQueries` (líneas 101–111) | Provider; tests puros sin React | ~25 |
| `useActiveSessionsSeed` | Hook | `src/Infrastructure/Hooks/useActiveSessionsSeed.ts` | `(queryClient: QueryClient, pollMs?: number): { refreshActive: (reset: boolean) => Promise<void> }` — encapsula `missingActiveRef`, `refreshActive` y el `setInterval` (líneas 92–159) | Provider | ~45 |
| `useEventStreamConnection` | Hook | `src/Infrastructure/Hooks/useEventStreamConnection.ts` | `(handlers: { onEvent: (e: V2Event) => void; onConnected?: () => void; onReconnected?: () => void }): TConnectionState` — máquina de conexión: `AbortController`, loop `while`, backoff, `server.connected`, StrictMode-safe (líneas 91–218) | Provider; tests de reconexión | ~70 |
| `EventStreamContext` | Contexto + hook | `src/Infrastructure/EventStreamContext.ts` | `interface EventStreamContextValue { state: TConnectionState }`; `export const useEventStream = () => useContext(...)` (líneas 17–26) | Componentes que muestran el estado | ~15 |
| `EventStreamProvider` | Provider | `src/Infrastructure/EventStreamProvider.tsx` (permanece) | `({ children }: { children: ReactNode })` — ref del batcher, `useEventStreamConnection`, `useActiveSessionsSeed`, provee contexto (composición final) | `main.tsx` | ~50 |

**Resultado estimado:** `EventStreamProvider.tsx` baja de 225 a ~50 líneas. Las
cuatro libs puras (~107 líneas) se testean sin React; los dos hooks (~115 líneas)
se testean con `renderWithProviders`.

**Riesgos/specs afectados:**
- `src/Infrastructure/specs/applyActiveSeed.spec.ts` importa
  `applyActiveSeed` desde `../EventStreamProvider`. Al moverlo a
  `src/Infrastructure/lib/applyActiveSeed.ts` hay que **reexportarlo** o actualizar
  el spec. (Propuesta: reexport para no tocar specs; se documenta la ruta canónica.)
- `src/Infrastructure/specs/EventStreamProvider.spec.tsx` mockea
  `@app/Infrastructure/Services/opencodeClient` y verifica: (1) eventos aplicados
  al caché, (2) `Conectado` bajo StrictMode, (3) seed de sesiones activas. La
  composición debe conservar el orden `refreshActive(true)` al conectar y el
  tratamiento de `server.connected`.
- El contrato SSE del `AGENTS.md` (una sola suscripción, batching ~100 ms,
  backoff) se preserva **íntegro**: la extracción es puramente estructural.
- Cuidado con el *doble montaje* de StrictMode: el flag `cancelled` y el
  `AbortController` deben permanecer en el hook de conexión; no fragmentarlos
  entre módulos de forma que se pierda la garantía.

---

## Piezas atómicas listas para compartir

Con consumidores previstos:

| Pieza | Ruta | Consumidores previstos |
|---|---|---|
| `normalizeMessages` | `Services/message.entity.ts` | `session.service` (getSessionMessages, getHistoryMessages); dominio History |
| `collectAllMessages` | `Services/lib/messagePagination.ts` | `session.service`; lecturas completas de mensajes |
| `resolveBaseUrl` / `opencodeClient` | `Services/client.ts` | Todos los sub-services + specs (`opencodeClient.spec`) |
| `createEventBatcher` | `Infrastructure/lib/eventBatcher.ts` | EventStreamProvider; cualquier pipeline con flush ~100 ms |
| `computeBackoffDelay` | `Infrastructure/lib/backoff.ts` | EventStreamProvider; futuras reconexiones |
| `applyActiveSeed` | `Infrastructure/lib/applyActiveSeed.ts` | EventStreamProvider + test puro |
| `applyReducedEvent` | `Infrastructure/lib/applyReducedEvent.ts` | EventStreamProvider; tests de despacho sin React |
| `GraphPane` | `Infrastructure/Components/GraphPane.tsx` | WorkspacePage; futura `GraphPage` |
| `SessionsRail` | `Infrastructure/Components/SessionsRail.tsx` | WorkspacePage; cualquier layout con rail |
| `HistoryOverlay` | `Infrastructure/Components/HistoryOverlay.tsx` | WorkspacePage |
| `WorkspaceMobileTabs` | `Infrastructure/Components/WorkspaceMobileTabs.tsx` | WorkspacePage; pantallas de workspace móviles |
| `useNow` (unificado) | `Application/Hooks/useNow.ts` | Graph (`useGraphModel`) y Sessions (`useSessionFilters`) |
| `totalTokens` | `Application/Helpers/totalTokens.ts` | AgentNode, HistoryHeader, SessionSummaryBar |
| `formatClock` (exportado) | `Application/Helpers/formatTimeRange.ts` | AgentNode (retry) + formatTimeRange interno |

---

## Hooks y Helpers: consolidación

### 1. `useNow` duplicado (Graph vs Sessions)

Dos implementaciones casi idénticas:

- `src/Domains/Graph/Hooks/useNow.ts` (44 líneas) — firma `useNow(intervalMs = 1000, enabled = true)`.
- `src/Domains/Sessions/Hooks/useNow.ts` (48 líneas) — firma `useNow(active: boolean, intervalMs = 1000)`.

Comparten lógica y comentarios; **discrepan en el orden de parámetros**, lo que es
una trampa. Propuesta:

- Crear `src/Application/Hooks/useNow.ts` con firma canónica
  `useNow(enabled: boolean, intervalMs = DEFAULT_NOW_INTERVAL_MS): number`.
- `useGraphModel` (`useNow(DEFAULT_NOW_INTERVAL_MS, hasActiveNode)`) y
  `useSessionFilters` (`useNow(range !== DEFAULT_TIME_RANGE)`) adaptan la llamada.
- Reexportar desde `Domains/Graph/index.ts` y `Domains/Sessions/index.ts` para no
  romper imports externos; **fusionar** los dos `specs/useNow.spec.tsx`.
- `DEFAULT_NOW_INTERVAL_MS` queda exportado una sola vez.

### 2. `totalTokens()` duplicado 3× (Familia 5 del inventario)

Copia literal en `AgentNode.tsx` (34–40), `HistoryHeader.tsx` (37–43) y
`SessionSummaryBar.tsx` (25–31). Propuesta: `src/Application/Helpers/totalTokens.ts`
con `totalTokens(tokens: TTokenUsage | null): number | null` (suma
input+output+reasoning). Los tres componentes lo importan del barrel.

### 3. Formatters numéricos y `UNAVAILABLE`

`formatTokens`, `formatCost` y `formatDuration` son cohesivos, pero:

- `formatCost` y `formatTokens` **importan `UNAVAILABLE` desde `formatDuration`**
  (dependencia cruzada semántica).
- Existe además `UNAVAILABLE_LABEL = 'no disponible'` duplicado en
  `formatTimeRange.ts` (línea 7) y `AgentNode.tsx` (línea 25).

Propuesta: `src/Application/Helpers/format/constants.ts` con
`UNAVAILABLE = '—'` y `UNAVAILABLE_LABEL = 'no disponible'`; los tres formatters y
`formatTimeRange` los consumen. (Opcional: agrupar `formatTokens/Cost/Duration` en
`format/numbers.ts`; no es obligatorio, ya están separados por archivo.)

### 4. `formatClock` duplicado

`formatClock` (`HH:mm`) es privado en `formatTimeRange.ts` (11–15) y se reimplementa
en `AgentNode.tsx` (28–33). Propuesta: exportar `formatClock` desde
`Application/Helpers/formatTimeRange.ts` y consumirlo en `AgentNode`.

### 5. Código muerto (sin consumidores)

- `src/Application/Helpers/formatter.ts` (65 líneas): `format.ARS/USD/percent`,
  `formatDate`, `formatCurrency`, `formatPercent` — **cero consumidores**. Solapa
  conceptualmente con `formatCost`. Propuesta: eliminar (o mover a un futuro
  módulo de moneda si se cablea).
- `src/Application/Helpers/IPagination.ts` (27 líneas): tipos `TPagination`,
  `IPaginationResponse` y `initPagination` — **cero consumidores**.
- `src/Application/Hooks/useDebounce.ts` (26 líneas): **cero consumidores**
  (solo exportado en el barrel).
- `src/Application/Hooks/useIsEditable.ts` (5 líneas): *placeholder* que retorna
  siempre `true` con `TODO`; usado por `ui/textarea.tsx` e `Input.tsx`. No es
  muerto, pero está incompleto.

### 6. Magic strings de estado global (`useGlobalStore` / `device.ts`)

`useDevice` lee `useGlobalStore('isMobile')` y `device.ts` escribe
`queryClient.setQueryData(['isMobile'], ...)`; `Page.tsx` usa
`useGlobalStore('backButtonEnabled')`. Las claves `'isMobile'`/`'backButtonEnabled'`
son literales compartidos. Propuesta: exportar `STORE_KEY` desde
`src/Application/Hooks/useGlobalStore.ts` (`{ isMobile: 'isMobile', backButtonEnabled: 'backButtonEnabled' }`)
y consumirla en `useDevice`, `device.ts` y `Page.tsx`.

### 7. `useURLParams` — superficie sobredimensionada

Solo se usan `getParam` y `updateParams` (en `useSessionFilters`,
`useSelectSession`). `params`, `updateDebouncedParams`, `clearParams`, `hasParam`
y el alias `searchParams` no tienen consumidores. Propuesta: recortar a la
superficie usada o, si se mantiene genérica, marcar el resto como API pública
documentada (hoy es código que aparenta uso inexistente).

---

## Notas / discrepancias con convenciones

1. **`div` con `flex` en `WorkspacePage.tsx` (línea 255).** El diálogo "Histórico
   no disponible" usa `<div className="fixed inset-0 z-50 flex flex-col ...">`, lo
   que **viola** la regla `AGENTS.md` §8.4 ("NO divs con `flex`; usar `<Container>`
   con las props correctas"). Al extraer `HistoryOverlay` debe migrarse a
   `<Container>` conservando `role="dialog"`, `aria-modal` y `aria-label`.
2. **`applyActiveSeed` se exporta desde un archivo de componente.**
   `EventStreamProvider.tsx` exporta una función pura testeada; mezcla
   responsabilidades componente/lógica. Debe vivir en `Infrastructure/lib/`.
3. **Magic strings de tabs.** `(['sessions','graph','inspector'] as TTab[])` en
   `WorkspacePage.tsx` (línea 363) usa literales inline en varios sitios
   (`useState<TTab>('graph')`, comparaciones). Extraer `WORKSPACE_TABS` +
   `TWorkspaceTab` (regla `AGENTS.md` §8.5).
4. **Magic numbers del stream.** `100`, `5`, `2500`, `1000`, `30000` inline en
   `EventStreamProvider.tsx`; extraer a `eventStream.constants.ts`.
5. **`useDevice` depende de un side-effect fuera de React.** El default `true`
   antes de que `registerEventViewport` (llamado en `main.tsx`) escriba el store
   produce un primer render "móvil" en desktop; es un acoplamiento implícito
   `main.tsx ↔ useDevice`. Documentar o inicializar el store de forma sincrónica.
6. **Instrumentación de perf fuera de su dominio.** `PERF_METRIC` (Helpers) y la
   lógica de decisión open/revisit viven en `WorkspacePage`; el contrato de
   performance es del dominio Graph. Al extraer `useSessionOpenPerf` conviene
   ubicarlo donde el contrato lo pueda referenciar (Infrastructure está aceptable
   porque orquesta; documentar la decisión).
7. **Nombres de tipos.** `OpenCodeService` (interface de service) no sigue el
   prefijo `T`; los tipos de entidad del área (`TSessionMessage`, `TContentPart`,
   `TReasoningVisibility`) sí. Coherente con la convención (el prefijo es para
   entidades), solo se deja constancia.
8. **`useNow` con orden de parámetros divergente** (ver consolidación §1) es la
   discrepancia funcional más relevante del área: unificar antes de extraer más
   piezas que lo consuman.
9. **`opencodeService` es un barrel barato de reescribir**: cualquier split debe
   mantener el nombre `opencodeService` y su objeto completo para no romper el
   contrato FR-037 ni los imports existentes.
