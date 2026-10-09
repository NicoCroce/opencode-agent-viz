# Consolidación de duplicación transversal (frontend)

> Documento **de solo lectura + propuesta**. No se modificó código de producto.
> Cruza las 7 propuestas de `docs/proposals/areas/` contra la sección
> *Duplicación transversal* de `docs/proposals/inventario-gordos.md`.
> Los archivos y líneas citados fueron **verificados sobre `src/`** (no solo
> sobre lo que afirman las propuestas); donde el código real difiere del
> inventario se deja constancia.

## Cómo leer este documento

- **Destino único**: una única ruta propuesta por familia. Cuando dos áreas
  propusieron destinos distintos para lo mismo, se resuelve y se documenta en
  *Nombres unificados / conflictos resueltos*.
- **Consumidores que migran**: archivos de producción que deben cambiar de
  import al cerrar la familia (los bars de `index.ts` se cuentan aparte).
- **Contrato**: exports/nombres que expone la pieza compartida.

---

## Familias de duplicación resueltas

### Tabla resumen

| # | Familia | Archivos que la contienen (hoy, verificado) | Destino único propuesto | Contrato (símbolo) | Consumidores que migran | ¿Conflicto entre áreas? |
|---|---------|---------------------------------------------|-------------------------|--------------------|-------------------------|--------------------------|
| 1 | Color por `TNodeStatus` (9 estados) | `Application/Components/Molecules/StatusDot.tsx` (`STATUS_COLOR`) · `Graph/Components/NodeStatusRail.tsx` (`RAIL_COLOR`) · `Graph/Components/ExecutionLanes.tsx` (`STATUS_DOT`) | `src/Application/Helpers/nodeStatusColor.ts` | `NODE_STATUS_COLOR: Record<TNodeStatus, string>` | `StatusDot`, `NodeStatusRail`, `GutterNode`/`ExecutionLanes` | No. A01 lo difiere a Graph; A02 lo concreta en `Application/Helpers`. Convergen. |
| 2 | Etiqueta de resultado terminal | `History/Components/HistoryHeader.tsx` (`OUTCOME_LABEL`) · `Application/Components/Organisms/HistoryEntry.tsx` (`IDLE_LABEL`) · (`Helpers/nodeStatusLabel.ts` = subconjunto con otro wording) | `src/Application/Helpers/outcomeLabel.ts` | `OUTCOME_LABEL: Record<TOutcome,string>` + `isTerminalOutcome` | `HistoryHeader`, `HistoryEntry` | No en la ruta. Sí en el tipo (`TIdleOutcome` vs `TOutcome`, ver Familia 8). |
| 3 | Estado de pregunta (label + color) | `Application/Components/Organisms/HistoryEntry.tsx` (`QUESTION_STATE_LABEL`/`_COLOR`) · `Inspector/Components/QuestionsSection.tsx` (`STATE_LABEL`/`STATE_COLOR`) | `src/Application/Helpers/questionState.ts` (+ `Molecules/QuestionStateBadge.tsx`) | `QUESTION_STATE_LABEL`, `QUESTION_STATE_COLOR`, `TQuestionState`, `<QuestionStateBadge state/>` | `HistoryEntry`, `QuestionsSection`, `QuestionBlock` | **Sí (interno A04).** A04 propuso dos rutas; resuelto. |
| 4 | Color/etiqueta por estado de herramienta | `Application/Components/Organisms/ToolCallEntry.tsx` (`STATUS_LABEL`/`STATUS_COLOR`, `TToolStatus`) · `Inspector/Components/ToolHistory.tsx` (`STATUS_COLOR: Record<string,string>`) | `src/Application/Helpers/toolStatus.ts` (+ `Molecules/ToolStatusBadge.tsx`) | `TOOL_STATUS_LABEL`, `TOOL_STATUS_COLOR`, `TToolStatus` (unión), `<ToolStatusBadge status/>` | `ToolCallEntry`, `ToolHistory` | **Sí (naming).** `ToolStatusBadge` (A01) vs `ToolStatusLabel` (A04) → gana `ToolStatusBadge`. |
| 5 | Helper `totalTokens()` | `Graph/Components/AgentNode.tsx` (34-40) · `History/Components/HistoryHeader.tsx` (37-43) · `Graph/Components/SessionSummaryBar.tsx` (25-31) | `src/Application/Helpers/totalTokens.ts` | `totalTokens(tokens: TTokenUsage \| null): number \| null` | `AgentNode`, `HistoryHeader`, `SessionSummaryBar` | **Sí (ruta).** A03 propuso `Graph/lib/metrics/tokens.ts`/`tokens.ts`; A02/A06/A07 → `Application/Helpers`. Resuelto. |
| 6 | View-models de pregunta (tipos) | `History/History.entity.ts` (`THistoryQuestionState/Field/Option`) · `Inspector/Inspector.entity.ts` (`TQuestionState/Field/Option`) | Módulo compartido `Application` (junto a `questionState.ts`), re-exportado por ambos dominios | `TQuestionState`, `TQuestionOption`, `TQuestionField`, `TQuestionEntry` | `History.entity`, `Inspector.entity`, `buildHistory`, `HistoryEntry`, `QuestionsSection`, `Inspector.service` | **Sí (ubicación).** A04 (Application) vs A06 (`HistoryQuestion.entity.ts` o Application) → Application. |
| 7 | Señal de ejecución "vacía" | `Graph/Hooks/useExecutionSignals.ts` (`EMPTY_EXECUTION_SIGNAL`) · `Graph/lib/eventReducer.ts` (`EMPTY_SIGNAL`) | `src/Domains/Graph/lib/executionSignal.ts` | `EMPTY_EXECUTION_SIGNAL`, `normalizeSignal`, `mergeExecutionSignals`, `sameExecutionSignal` | `useExecutionSignals`, `eventReducer`, `useGraphEnrichment` | **Sí (ruta).** A02 `Graph/lib/executionSignal.ts` vs A03 `Graph/lib/eventReduce/signals.ts`. Resuelto. |
| 8 | Unión terminal `succeeded\|failed\|interrupted` | `History/History.entity.ts` (`TIdleOutcome`) · `Graph/Graph.entity.ts` (`TExecutionSignal['outcome']`) · `Graph/lib/nodeStatus.ts` (`NodeStatusInput['outcome']`) | `src/Application/Helpers/outcomeLabel.ts` (junto a Familia 2) | `TOutcome = 'succeeded' \| 'failed' \| 'interrupted'` | `History.entity`, `Graph.entity`, `nodeStatus.ts` | No. A01 usa `TIdleOutcome`; A06 propone `TOutcome` → se adopta `TOutcome`. |

---

### Familia 1 — Color por `TNodeStatus`

**Confirmación (código real):** los tres mapas son **idénticos byte a byte**
(9 claves `created…interrupted`, tokens `bg-status-*`):

- `StatusDot.tsx:12` → `STATUS_COLOR`
- `NodeStatusRail.tsx:10` → `RAIL_COLOR`
- `ExecutionLanes.tsx:23` → `STATUS_DOT`

**Decisión:** fuente única `NODE_STATUS_COLOR` en
`src/Application/Helpers/nodeStatusColor.ts`. Ruta elegida por A02; **no hay
destino contradictorio** (A01, que es dueña de `StatusDot`, explícitamente lo
deja a Graph/Application y solo lo anota).

**Contrato:** `export const NODE_STATUS_COLOR: Record<TNodeStatus, string>`.

**Consumidores que migran:** `StatusDot` (usa `NODE_STATUS_COLOR` en vez de
`STATUS_COLOR` local), `NodeStatusRail` (idem), y `GutterNode` cuando A02 lo
extraiga de `ExecutionLanes` (idem). Actualizar `Application/Helpers/index.ts`.

**Nota de paridad:** el spec `Components/specs/ExecutionLanes.spec.tsx` verifica
las 9 clases `bg-status-*`; el mapa compartido debe conservar **exactamente** los
mismos tokens.

---

### Familia 2 — Etiqueta de resultado terminal

**Confirmación (código real):**

- `HistoryEntry.tsx:81` → `IDLE_LABEL: Record<THistoryIdleEntry['outcome'], string>`
  = `{succeeded:'Terminada con éxito', failed:'Fallida', interrupted:'Interrumpida'}`.
- `HistoryHeader.tsx:30` → `OUTCOME_LABEL: Partial<Record<TNodeStatus, string>>`
  con **los mismos 3 pares** (el inventario lo describe como el subconjunto
  terminal; es `Partial<TNodeStatus>`, no una unión de 3).
- `Application/Helpers/nodeStatusLabel.ts:16` → `NODE_STATUS_LABEL.succeeded = 'Terminada'`
  (**wording divergente** del resto: "Terminada con éxito").

**Decisión:** `src/Application/Helpers/outcomeLabel.ts` con
`OUTCOME_LABEL: Record<TOutcome, string>` = wording de `IDLE_LABEL`/`OUTCOME_LABEL`
("Terminada con éxito"). **NO** se fusiona con `NODE_STATUS_LABEL`: es divergencia
intencional (etiqueta corta de nodo vs. resultado del turno). Se documenta; si el
owner quiere unificar wording, es un cambio de texto visible en tests.

**Contrato:** `OUTCOME_LABEL` + `isTerminalOutcome(status: TNodeStatus): status is TOutcome`
(el predicate es necesario porque `HistoryHeader` indexa con `data.status: TNodeStatus`).

**Consumidores que migran:** `HistoryEntry` (elimina `IDLE_LABEL`), `HistoryHeader`
(elimina `OUTCOME_LABEL` y pasa de `Partial<TNodeStatus>` a `Record<TOutcome>` con
guard). Actualizar `Application/Helpers/index.ts`.

**Specs:** `HistoryEntry.spec.tsx` (asserta "Terminada con éxito") y
`HistoryModal.spec.tsx` deben seguir verdes (mismo texto).

---

### Familia 3 — Estado de pregunta (label + color)

**Confirmación (código real):** valores idénticos.

- `HistoryEntry.tsx:103-113` → `QUESTION_STATE_LABEL` / `QUESTION_STATE_COLOR`
  (`pending:'pendiente'`, `answered:'respondida'`, `cancelled:'cancelada'`;
  `text-status-running` / `text-status-done` / `text-muted-foreground`).
- `QuestionsSection.tsx:22-32` → `STATE_LABEL` / `STATE_COLOR` (idénticos).

**Decisión (resuelve un conflicto interno de A04):** A04 propuso el mapa en
**dos** rutas distintas: `src/Domains/Inspector/lib/questionState.ts` (sección
QuestionsSection) y `src/Application/Entities/questionState.ts` (catálogo de
piezas compartidas). Además, `Application/Entities/` **no existe** en el repo.
Destino único: **`src/Application/Helpers/questionState.ts`** (consistente con
`nodeStatusLabel.ts`, que ya vive ahí y ya importa tipos del dominio).
Se añade la molécula `Molecules/QuestionStateBadge.tsx`.

**Contrato:**
`TQuestionState = 'pending' | 'answered' | 'cancelled'`;
`QUESTION_STATE_LABEL: Record<TQuestionState, string>`;
`QUESTION_STATE_COLOR: Record<TQuestionState, string>`;
`<QuestionStateBadge state={TQuestionState} />`.

**Consumidores que migran:** `HistoryEntry`, `QuestionsSection`, y `QuestionBlock`
(cuando A01/A04 lo extraigan como molécula compartida; ver catálogo).

**Specs:** `QuestionsSection.spec.tsx` (textos 'pendiente'/'respondida'/'cancelada')
y `HistoryEntry.spec.tsx`.

---

### Familia 4 — Color/etiqueta por estado de herramienta

**Confirmación (código real):**

- `ToolCallEntry.tsx:17-30` → `STATUS_LABEL: Record<TToolStatus,string>`
  (`streaming/running/completed/error`) + `STATUS_COLOR` (mismas claves).
- `ToolHistory.tsx:14-19` → `STATUS_COLOR: Record<string,string>`
  (`running/completed/error/pending`), **sin `STATUS_LABEL`** (muestra el estado
  crudo) y con la clave extra `pending` (`text-status-idle`).

**Solapan** en `running`/`completed`/`error` con tokens idénticos.

**Decisión (resuelve naming A01 vs A04):** mapas en
`src/Application/Helpers/toolStatus.ts`; pieza de presentación única
`Molecules/ToolStatusBadge.tsx`. A04 la llamó `ToolStatusLabel`; A01 la llamó
`ToolStatusBadge`. Se adopta **`ToolStatusBadge`** (renderiza label + color; A01
ya definió su contrato admitiendo la clave extra `pending`).

**Contrato:** unión `TToolStatus = 'streaming'|'running'|'completed'|'error'|'pending'`
(union de ambos dominios), `TOOL_STATUS_LABEL`, `TOOL_STATUS_COLOR`,
`<ToolStatusBadge status={TToolStatus} className? />`. Para conservar el
comportamiento de `ToolHistory` (solo color, estado crudo) el badge debe admitir
un modo `label?: false`.

**Consumidores que migran:** `ToolCallEntry` (usa `TOOL_STATUS_LABEL/COLOR` y
`<ToolStatusBadge/>`), `ToolHistory` (idem + gana etiqueta). Actualizar barrels.

**Specs:** `Organisms/specs/ToolCallEntry.spec.tsx` — conservar los textos exactos
"En curso"/"Ejecutando"/"Completada"/"Fallida" y `aria-expanded`.

---

### Familia 5 — `totalTokens()`

**Confirmación (código real):** tres copias **literales** (cambia solo el nombre
de parámetros `value`/`v`):

- `AgentNode.tsx:34-40`
- `HistoryHeader.tsx:37-43`
- `SessionSummaryBar.tsx:25-31`

**Decisión (conflicto de ruta resuelto):** A03 propuso `Graph/lib/metrics/tokens.ts`
o `Application/Helpers/tokens.ts`; A02, A06 y A07 propusieron, de forma
independiente, `Application/Helpers/totalTokens.ts`. Se adopta
**`src/Application/Helpers/totalTokens.ts`**. `Graph/lib/metrics/tokens.ts` (A03)
puede mantener `accumulateTokens`/`toTokenUsage` (son del pipeline de métricas de
Graph) e **importar** `totalTokens` de Helpers si lo necesita, o re-exportarlo.

**Contrato:** `totalTokens(tokens: TTokenUsage | null): number | null`
(suma `input + output + reasoning`, ignora `null`, `null` si no hay ninguno).

**Consumidores que migran:** `AgentNode`, `HistoryHeader`, `SessionSummaryBar`.
Actualizar `Application/Helpers/index.ts`.

**Specs:** specs de Graph (`AgentNode.spec`, `SessionSummaryBar.spec`) y
`HistoryModal.spec.tsx`; no deben cambiar textos.

---

### Familia 6 — View-models de pregunta (tipos)

**Confirmación (código real):** los propios comentarios del código declaran la
compatibilidad; `THistoryQuestionState/Option/Field` (History.entity:163-178) son
estructuralmente idénticos a `TQuestionState/Option/Field` (Inspector.entity:55-70).

**Decisión (conflicto A04 vs A06):** A04 pide "tipo compartido en `Application`";
A06 ofrece `HistoryQuestion.entity.ts` **o** un tipo compartido en `Application`.
Se adopta el **módulo compartido en `Application`** (`questionState.ts`, junto a
los mapas de la Familia 3), y `History.entity.ts`/`Inspector.entity.ts` pasan a
re-exportarlo como alias (`export type { TQuestionState as TQuestionState }` /
aliases `THistoryQuestion* = TQuestion*`) para no romper imports.

**Contrato:** `TQuestionState`, `TQuestionOption`, `TQuestionField`, `TQuestionEntry`.

**Consumidores que migran:** `History.entity.ts`, `Inspector.entity.ts`,
`buildHistory`, `HistoryEntry`, `QuestionsSection`, `Inspector.service`
(mappers `questionMappers`). **Riesgo bajo** (solo tipos) pero alto tráfico;
mantener re-exports de compatibilidad.

**Nota:** este es el nodo donde A04 y A06 se solapan; es la **única** parte con
valor real de dividir `Inspector.entity.ts` (A04 lo reconoce).

---

### Familia 7 — Señal de ejecución "vacía"

**Confirmación (código real):** `EMPTY_EXECUTION_SIGNAL` (`useExecutionSignals.ts:10`)
y `EMPTY_SIGNAL` (`eventReducer.ts:212`) son el mismo literal
`{ retry:null, compaction:null, outcome:null, interruptReason:null }`.

**Decisión (conflicto de ruta A02 vs A03):** A02 propuso
`src/Domains/Graph/lib/executionSignal.ts`; A03 propuso
`src/Domains/Graph/lib/eventReduce/signals.ts` (dentro del corte del reducer).
Canónico: **`src/Domains/Graph/lib/executionSignal.ts`**, porque la señal tiene
consumidores fuera del reducer (`useExecutionSignals`, `useGraphEnrichment`,
`deriveExecutionSignals`). El slice `eventReduce/signals.ts` (A03) **importa y
re-exporta** `EMPTY_EXECUTION_SIGNAL` desde `executionSignal.ts` en lugar de
declarar `EMPTY_SIGNAL`.

**Contrato:** `EMPTY_EXECUTION_SIGNAL`, `normalizeSignal`, `mergeExecutionSignals`,
`sameExecutionSignal`. Se **elimina** el nombre `EMPTY_SIGNAL` (queda como alias
reexportado temporal solo si algún spec lo importa; A03 propone reexportarlo).

**Consumidores que migran:** `useExecutionSignals`, `eventReducer` (usa la
constante y `patchExecution`), `useGraphEnrichment`. Reexportar
`EMPTY_EXECUTION_SIGNAL` desde `useExecutionSignals.ts` para compat de consumidores
externos (A02 lo pide explícitamente).

---

### Familia 8 — Unión terminal

**Confirmación (código real):**

- `History.entity.ts:34` → `TIdleOutcome = 'succeeded' | 'failed' | 'interrupted'` (exportado).
- `Graph.entity.ts:169` → `TExecutionSignal.outcome` literal inline.
- `Graph/lib/nodeStatus.ts:10` → `NodeStatusInput.outcome` literal inline.

**Decisión:** `TOutcome` (nombre propuesto por A06) se define en
`src/Application/Helpers/outcomeLabel.ts`, junto a `OUTCOME_LABEL`. Los tres
sitios lo consumen.

**Contrato:** `TOutcome = 'succeeded' | 'failed' | 'interrupted'` + los helpers
`isTerminalOutcome`.

**Consumidores que migran:** `History.entity.ts` (`TIdleOutcome` → alias de
`TOutcome`), `Graph.entity.ts` (`outcome: TOutcome | null`),
`nodeStatus.ts` (`outcome: TOutcome | null`).

**Dirección de dependencia (verificado):** `Application/Helpers/nodeStatusLabel.ts`
ya importa `TNodeStatus` de `Graph.entity`. `outcomeLabel.ts` **no** importa de
`Graph.entity`, solo define la unión; por tanto `Graph.entity → outcomeLabel.ts`
no crea ciclo. Documentado como decisión consciente (Application actúa de capa
compartida de estados).

---

## Catálogo de piezas compartidas

Piezas que **más de un área** pide, o que el enunciado lista como candidatas a
`Application/Components/Molecules`, `Application/Helpers` o libs. "Áreas/usos"
indica qué propuesta la pide (`A01`…`A07`).

| Pieza | Destino único | Áreas / usos que la piden | Contrato | ¿Ya existe algo parecido? |
|-------|---------------|---------------------------|----------|---------------------------|
| `totalTokens` | `Application/Helpers/totalTokens.ts` | A02, A03, A06, A07 · AgentNode/HistoryHeader/SessionSummaryBar | `(tokens: TTokenUsage\|null) => number\|null` | Sí: 3 copias privadas idénticas |
| `useNow` | `Application/Hooks/useNow.ts` | A05, A07 · Sessions `useSessionFilters`, Graph `useGraphModel`, `WorkspacePage` | `useNow(opts?: { enabled?: boolean; intervalMs?: number }): number`; `DEFAULT_NOW_INTERVAL_MS` | Sí: 2 hooks duplicados (firma invertida) |
| `formatClock` | `Application/Helpers/formatTimeRange.ts` (export) | A02, A07 · `AgentNode` (retry) | `(ms: number) => string` (`HH:mm`) | Sí: privado en `formatTimeRange` + reimplementado en `AgentNode` |
| `OUTCOME_LABEL` + `TOutcome` | `Application/Helpers/outcomeLabel.ts` | A01, A06 · HistoryHeader, HistoryEntry | `Record<TOutcome,string>` + `isTerminalOutcome` | Sí: `IDLE_LABEL` + `OUTCOME_LABEL` + subconjunto de `NODE_STATUS_LABEL` |
| `NODE_STATUS_COLOR` | `Application/Helpers/nodeStatusColor.ts` | A01, A02 · StatusDot, NodeStatusRail, GutterNode | `Record<TNodeStatus,string>` | Sí: `STATUS_COLOR` / `RAIL_COLOR` / `STATUS_DOT` |
| `questionState` (mapas) | `Application/Helpers/questionState.ts` | A01, A04 (+A06 tipos) · HistoryEntry, QuestionsSection | `QUESTION_STATE_LABEL`, `QUESTION_STATE_COLOR` | Sí: 2 copias + inline |
| `QuestionStateBadge` | `Application/Components/Molecules/QuestionStateBadge.tsx` | A04 (A01 implícito) · QuestionsSection, QuestionBlock | `{ state: TQuestionState }` | No existe; hoy label+color inline |
| `QuestionBlock` (`QuestionRow` en A04) | `Application/Components/Molecules/QuestionBlock.tsx` | A01, A04 · HistoryEntry, QuestionsSection | `{ title; fields; state; answer }` (forma normalizada) | Sí: bloque inline duplicado (HistoryEntry:262-294 ≡ QuestionsSection:114-154) |
| `toolStatus` (mapas) | `Application/Helpers/toolStatus.ts` | A01, A04 · ToolCallEntry, ToolHistory | `TOOL_STATUS_LABEL`, `TOOL_STATUS_COLOR`, `TToolStatus` | Sí: 2 mapas solapados |
| `ToolStatusBadge` (`ToolStatusLabel` en A04) | `Application/Components/Molecules/ToolStatusBadge.tsx` | A01, A04 · ToolCallEntry, ToolHistory | `{ status: TToolStatus; label?: boolean; className? }` | No existe |
| `formatModelRef` | `Application/Helpers/formatModelRef.ts` | A01, A02 · HistoryEntry (`formatModel`), AgentNode, cardHeight, Inspector ModelSection | `(model: { providerID; id }) => string` | Sí: `formatModel` inline + `provider/id` repetido 5× |
| `formatToolInput` | `Application/Helpers/formatToolInput.ts` | A01 (A04 ToolHistory implícito) · ToolCallEntry, ToolHistory | `(input: unknown) => string` (fallback `UNAVAILABLE`) | Sí: `formatInput` privado en ToolCallEntry |
| `toolContentToText` | `History/lib/toolEntry.ts` | A03, A06 · buildHistory, ToolHistory | `(content: readonly ToolContent[]) => string` | Sí: privado en `buildHistory.ts:256` |
| `UNAVAILABLE` / `UNAVAILABLE_LABEL` | `Application/Helpers/format/constants.ts` (o exportar de `formatDuration.ts`) | A02, A06, A07 · formatters + AgentNode + HistoryHeader | `UNAVAILABLE = '—'`, `UNAVAILABLE_LABEL = 'no disponible'` | Sí: en `formatTimeRange.ts:7` y `AgentNode.tsx:25`; `UNAVAILABLE` en `formatDuration.ts` |
| `UnavailableValue` | `Application/Components/Molecules/UnavailableValue.tsx` | A02, A06 · SessionSummaryBar (`Unavailable`), Inspector/History | `{ label?: string }` | Sí: local `Unavailable` en SessionSummaryBar |
| `executionSignal` | `Graph/lib/executionSignal.ts` | A02, A03 · useExecutionSignals, eventReducer, useGraphEnrichment | `EMPTY_EXECUTION_SIGNAL`, `normalizeSignal`, `mergeExecutionSignals`, `sameExecutionSignal` | Sí: `EMPTY_SIGNAL` + `EMPTY_EXECUTION_SIGNAL` |
| `nodeInterval` / `compareByTimeThenId` | `Graph/lib/execution/nodeInterval.ts` | A03 · executionLevels (`startOf`/`endOf`), parallelism (`intervalOf`), loadPriority (`compare`) | `startOf(node)`, `endOf(node, now)`, `compareByTimeThenId(byId)` | Sí: 2 derivaciones divergentes (bug, ver abajo) |
| View-models de pregunta | `Application/Helpers/questionState.ts` (re-export) | A04, A06 · History.entity, Inspector.entity, buildHistory | `TQuestionState`, `TQuestionOption`, `TQuestionField`, `TQuestionEntry` | Sí: History ≡ Inspector |
| `DetailRow` (`DetailListRow` en A04 → unificar) | `Application/Components/Molecules/DetailRow.tsx` | A04 (+A06 HistoryHeader) · ModelSection, ToolStats, ToolHistory, QuestionsSection, SubagentsSection | `{ label: string; value?: string; children?: ReactNode }` | Sí: privado en `ModelSection.tsx:10`; fila con borde repetida |
| `SectionFrame` | `Application/Components/Molecules/SectionFrame.tsx` | A04 · QuestionsSection, FileChanges, ToolHistory, ToolStats, ResourceList, SubagentsSection, ErrorsSection | `{ title; children; action?; isError?; isLoading?; isEmpty?; emptyLabel?; loadingLines? }` | No; andamiaje error→loading→vacío→contenido repetido en 7 secciones |
| `SectionHeading` | `Application/Components/Molecules/SectionHeading.tsx` | A01, A04 · 12 archivos (Inspector, History, Metric, HistoryEntry, ToolCallEntry…) | `{ children; className? }` | Sí: `<span className="text-[11px] font-medium uppercase …">` 21× |
| `ListSkeleton` | `Application/Components/Molecules/ListSkeleton.tsx` | A04 · QuestionsSection, FileChanges, CompactionContext | `{ lines?: number }` | Sí: bloques `Skeleton` inline |
| `Disclosure` | `Application/Components/Molecules/Disclosure.tsx` | A04 · AdvancedSection, ToolHistory | `{ title; children; expanded?; defaultExpanded?; onToggle? }` | Sí: Button colapsable + `aria-expanded` duplicado |
| `NavButton` | `Application/Components/Molecules/NavButton.tsx` | A06 · HistoryHeader, HistoryModal | `{ sessionId; onNavigate; title? }` | Sí: privado en `HistoryHeader.tsx:49` |
| `LabeledField` | `Application/Components/Molecules/LabeledField.tsx` | A01 · ToolCallEntry (`ToolField`), cuerpos HistoryEntry, Inspector | `{ label; children }` | Sí: `ToolField` privado |
| `LabeledSelect` | `Application/Components/Molecules/LabeledSelect.tsx` | A05 · TimeRangeFilter | `{ label; value; onChange; options; placeholder }` | Sí: wrapping manual en TimeRangeFilter |
| `MultiSelectFilterPopover` | `Application/Components/Molecules/MultiSelectFilterPopover.tsx` | A05 · ProjectFilter | `{ ariaLabel; summary; groupLabel; options; selected; onToggle; maxHeightClass? }` | Sí: implementado inline en ProjectFilter |
| `InProgressText` | `Application/Components/Molecules/InProgressText.tsx` | A01, A02 · HistoryEntry (`InProgress`), ToolCallEntry, AgentNode | `{ className? }` | Sí: literal "En curso" repetido |
| `AttachmentList` | `Application/Components/Molecules/AttachmentList.tsx` | A01 · HistoryEntry | `{ attachments: THistoryAttachment[] }` | Sí: `<ul>` inline |
| `ResourceRow` | `Inspector/Components/ResourceRow.tsx` | A04 · ResourceList | `{ label; items; emptyLabel }` | Sí: privado en `ResourceList.tsx` |
| `ALERT_VARIANT_ICON/_TITLE/_DESCRIPTION` | `Application/Components/Molecules/alertVariants.ts` | A01 · AlertMessage, Alert | `Record<TAlertVariant, IconDefinition \| string>`, `TAlertVariant` | Sí: mapas duplicados `Alert`/`AlertMessage` |
| `chunkArray<T>` | `Application/Helpers/array.ts` | A03 · `useGraphEnrichment` | `chunkArray<T>(items: readonly T[], size: number): T[][]` | Sí: `chunkLoadPlan` en `loadPriority.ts` |
| `sameQueryKey` | `Application/Helpers/queryKey.ts` (o `Infrastructure/queryKeys`) | A03 · eventReducer slice, useExecutionSignals | `sameQueryKey(a: readonly unknown[], b: readonly unknown[]): boolean` | Sí: `sameKey` en `useExecutionSignals.ts:29` (+ specs) |
| `sumNullable` | `Application/Helpers/number.ts` | A03 · `summarizeSession` | `sumNullable(values: readonly (number\|null)[]): number\|null` | Sí: privado en `deriveMetrics` |
| `scheduleIdle` | `Application/Helpers/scheduleIdle.ts` | A02 · `useGraphEnrichment` | `(cb: () => void) => { cancel: () => void }` | No; inline en el hook |
| `summarizeProjects` + `ALL_PROJECTS_LABEL` | `Sessions/lib/projectOptions.ts` | A05 · ProjectFilter, SessionFilterBar | `summarizeProjects(count): string`; `ALL_PROJECTS_LABEL` | Sí: copia literal en 2 componentes |
| `timeRangeLabel` | `Sessions/lib/timeRange.ts` | A05 · SessionFilterBar, TimeRangeFilter | `(range: TTimeRange) => string` | Sí: inline en `rangeSummary` |

> **Piezas de un solo área** que el enunciado pide explícitamente pero que no
> aparecen en más de una propuesta: `DetailRow`, `SectionFrame`, `NavButton`,
> `LabeledSelect`, `chunkArray`, `sameQueryKey`. Se consolidan aquí igualmente
> porque su destino es neutro (`Application/…`) y son consumibles por cualquier
> dominio; no hay colisión entre áreas que resolver.

> **Patrón, no duplicación estricta:** `CONNECTION_LABEL` / `DOT_COLOR`
> (Connection) y `STATUS_COLOR` de `FileChanges` usan `Record<estado, color>` con
> tokens `status-*` pero **claves propias de su dominio**. No se unifican; solo se
> documenta el patrón común (nota del inventario).

---

## Nombres unificados / conflictos resueltos

| ID | Conflicto | Áreas | Resolución | Constancia |
|----|-----------|-------|------------|------------|
| C1 | Destino de los mapas de estado de pregunta: `Inspector/lib/questionState.ts` **vs** `Application/Entities/questionState.ts` (y `Application/Entities/` no existe) | A04 (interno) | `Application/Helpers/questionState.ts` + `Molecules/QuestionStateBadge.tsx` | A04 se contradice a sí misma; se elige Helpers por consistencia con `nodeStatusLabel.ts`. |
| C2 | `QuestionBlock` (A01) vs `QuestionRow` (A04) — misma pieza | A01, A04 | `QuestionBlock` (molécula compartida) | `QuestionRow` de A04 queda superseded; `QuestionsSection` solo mapea filas. |
| C3 | `ToolStatusBadge` (A01) vs `ToolStatusLabel` (A04) | A01, A04 | `ToolStatusBadge` | Renderiza label+color; admite modo "solo color" para ToolHistory. |
| C4 | Firma de `useNow`: positional `(enabled, intervalMs)` (A07) vs objeto `{ enabled, intervalMs }` (A05) | A05, A07 | **Objeto de opciones (A05)** | Elimina el bug de orden invertido; A07 queda superseded. |
| C5 | Ruta de `toolContentToText`: `History/lib/history/toolEntry.ts` (A03) vs `History/lib/toolEntry.ts` (A06) | A03, A06 | `History/lib/toolEntry.ts` | Ambos analizan el mismo `buildHistory.ts`. |
| C6 | Split **completo** de `History/lib/buildHistory.ts`: A03 (`history/messageEntries.ts`, `history/toolEntry.ts`, `history/questions.ts` + facade) vs A06 (`entryBuilders.ts`, `assistantParts.ts`, `toolEntry.ts`, `normalizeSdkFields.ts`, `historyQuestions.ts` + orquestador) | A03, A06 | **Gana A06** (dominio History dueño del archivo) | A03 cubre `Graph/lib` y clasificó `buildHistory` como "History/lib"; su split queda superseded. Unificar criterio de corte por tipo de entrada (`MESSAGE_ENTRY_BUILDERS`). |
| C7 | Ruta de `totalTokens`: `Graph/lib/metrics/tokens.ts` / `Application/Helpers/tokens.ts` (A03) vs `Application/Helpers/totalTokens.ts` (A02/A06/A07) | A03, A02, A06, A07 | `Application/Helpers/totalTokens.ts` | A03 ofrecía dos alternativas; se fija la convergente. `Graph/lib/metrics/tokens.ts` mantiene `accumulateTokens`/`toTokenUsage`. |
| C8 | Señal vacía: `Graph/lib/executionSignal.ts` (A02) vs `Graph/lib/eventReduce/signals.ts` (A03) | A02, A03 | `Graph/lib/executionSignal.ts` canónico; `eventReduce/signals.ts` importa/reexporta | El símbolo tiene consumidores fuera del reducer. Se elimina `EMPTY_SIGNAL`. |
| C9 | `TIdleOutcome` (código/A01) vs `TOutcome` (A06) | A01, A06 | `TOutcome` | `TIdleOutcome` pasa a alias reexportado para no romper consumidores. |
| C10 | Ubicación de los view-models de pregunta: compartido en `Application` (A04) vs `HistoryQuestion.entity.ts` (A06) | A04, A06 | Módulo compartido en `Application` (`questionState.ts`) | History/Inspector reexportan alias. |
| C11 | `DetailRow` vs `DetailListRow` | A04 (interno) | Unificar en `DetailRow` con `value?`/`children?` | Evita dos moléculas para la misma fila. |
| C12 | `UnavailableValue` (A02) vs `Unavailable` local (SessionSummaryBar) vs `UNAVAILABLE`/`UNAVAILABLE_LABEL` (A07) | A02, A06, A07 | `UnavailableValue` (componente) + `format/constants.ts` (constantes) | El componente usa las constantes compartidas. |
| C13 | `useNow` exportado por Graph y Sessions (`Graph/index.ts:13`, `Sessions/Hooks/index.ts:1`) | A05, A07 | Un solo `Application/Hooks/useNow.ts`; ambos barriles reexportan | Borrar los 2 `useNow.ts` de dominio y fusionar los 2 specs. |

---

## Correcciones de bugs latentes

Hallazgos donde consolidar es **más que DRY**: se corrige una inconsistencia
funcional real.

1. **`useNow` con orden de parámetros invertido (bug latente confirmado).**
   - `Sessions/Hooks/useNow.ts:23` → `useNow(active: boolean, intervalMs = 1000)`.
   - `Graph/Hooks/useNow.ts:24` → `useNow(intervalMs = 1000, enabled = true)`.
   - `WorkspacePage.tsx:131` llama `useNow(1000, Boolean(id) && hasActiveNode)`
     (orden de **Graph**), `SessionFilterBar`/`useSessionFilters.ts:91` llama
     `useNow(range !== DEFAULT_TIME_RANGE)` (orden de **Sessions**), y
     `useGraphModel.ts:68` llama `useNow(DEFAULT_NOW_INTERVAL_MS, hasActiveNode)`.
   - **Corrección:** contrato con objeto de opciones
     `useNow({ enabled, intervalMs })`. Elimina la trampa de args posicionales.
   - **Impacto en tests:** `WorkspacePage.perf.spec.tsx` espía
     `useNow(1000, false|true)` a través del barrel `@app/Domains/Graph`; la
     aserción del espía **debe actualizarse** al nuevo contrato (de lo contrario
     rompe). `Sessions/Hooks/specs/useNow.spec.tsx` y `Graph/Hooks/specs/useNow.spec.tsx`
     se reapuntan/fusionan.

2. **`executionLevels` vs `parallelism`: fallbacks semánticamente distintos
   (bug latente confirmado).**
   - `Graph/lib/executionLevels.ts:62-66`:
     `startOf = createdAt ?? startedAt ?? 0`; `endOf = updatedAt ?? endedAt ?? now`
     (sin clamp).
   - `Graph/lib/parallelism.ts:10-15`:
     `startOf = createdAt ?? startedAt ?? **now**`; `end = updatedAt ?? endedAt ?? now`;
     devuelve `[start, Math.max(start, end)]` (con clamp).
   - Un nodo sin `createdAt`/`startedAt` se ordena **como el más antiguo** en
     `deriveExecutionLevels` (fallback `0`) pero se agrupa con "ahora" en
     `deriveSiblingBatches` (fallback `now`): la posición y los niveles/paralelismo
     pueden divergir para el mismo nodo.
   - **Corrección:** `Graph/lib/execution/nodeInterval.ts` con
     `startOf`/`endOf`/`nodeInterval` canónicos y fallback explícito (se propone
     `now` para el inicio, y clamp `Math.max(start, end)`), consumido por ambos.
   - **Impacto:** cambia el comportamiento de orden/agrupación cuando falta
     `createdAt`; revisar `lib/specs/executionLevels.spec.ts` y los specs de
     `parallelism`/`loadPriority`.

3. **`ToolHistory` no cubre todos los estados (inconsistencia funcional).**
   `ToolHistory.STATUS_COLOR: Record<string,string>` solo define
   `running/completed/error/pending`; un estado `streaming` (o cualquier otro)
   cae a `text-muted-foreground` sin color, mientras `ToolCallEntry` sí lo pinta.
   La pieza unificada `TOOL_STATUS_COLOR` (Familia 4) **debe cubrir la unión
   completa** (`streaming/running/completed/error/pending`) para eliminar el
   fallback silencioso.

4. **`totalTokens` triplicado = riesgo de deriva.** Hoy las 3 copias son
   idénticas, por lo que no es un bug activo; pero cualquier cambio de semántica
   (p. ej. incluir `cacheRead`/`cacheWrite`) debe tocar 3 sitios. La extracción
   cierra ese riesgo. (Se documenta como "riesgo latente", no bug reproducido.)

5. **`EMPTY_SIGNAL` vs `EMPTY_EXECUTION_SIGNAL`.** Mismo literal; si alguien
   añade un campo a `TExecutionSignal` (como ya ocurrió con `interruptReason`),
   puede actualizar solo uno y provocar `undefined` vs `null` en la señal.
   Extracción a `executionSignal.ts` cierra el riesgo.

6. **`OUTCOME_LABEL` con `Partial<Record<TNodeStatus, string>>` (no tipado a la
   unión terminal).** `HistoryHeader.tsx:30` indexa con `data.status: TNodeStatus`,
   de modo que cualquier estado no terminal devuelve `undefined` sin error de
   compilación. Tipar a `Record<TOutcome,string>` + `isTerminalOutcome` convierte
   ese acceso en el único permitido. (No es un bug visible hoy, es laxitud de tipos.)

7. **Doble definición de `'no disponible'`.** `formatTimeRange.ts:7`
   (`UNAVAILABLE_LABEL`) y `AgentNode.tsx:25` (`UNAVAILABLE_LABEL`) más el
   `UNAVAILABLE = '—'` de `formatDuration.ts` (importado por `formatCost`/`formatTokens`).
   La constante compartida evita que el texto/`aria-label` divergan.

---

## Impacto

Número de archivos a tocar al **cerrar cada familia** (producción; los specs se
listan aparte). "Nuevos" incluye solo archivos de la pieza compartida; los
barrels `index.ts` se cuentan como edición.

| Familia | Archivos nuevos | Producción editada | Specs a revisar | Total aproximado |
|---------|----------------:|-------------------:|-----------------|-----------------:|
| F1 · `NODE_STATUS_COLOR` | 1 | 4 (`StatusDot`, `NodeStatusRail`, `GutterNode`/`ExecutionLanes`, `Helpers/index`) | `ExecutionLanes.spec` | ~5 |
| F2 · `OUTCOME_LABEL` | 1 | 3 (`HistoryEntry`, `HistoryHeader`, `Helpers/index`) | `HistoryEntry.spec`, `HistoryModal.spec` | ~5 |
| F3 · `questionState` | 1 (+1 badge) | 4 (`HistoryEntry`, `QuestionsSection`, `QuestionBlock`, barrel) | `QuestionsSection.spec`, `HistoryEntry.spec` | ~6 |
| F4 · `toolStatus` | 2 (`toolStatus.ts` + `ToolStatusBadge.tsx`) | 3 (`ToolCallEntry`, `ToolHistory`, barrel) | `ToolCallEntry.spec` | ~5 |
| F5 · `totalTokens` | 1 | 4 (`AgentNode`, `HistoryHeader`, `SessionSummaryBar`, `Helpers/index`) | `AgentNode.spec`, `SessionSummaryBar.spec`, `HistoryModal.spec` | ~6 |
| F6 · view-models de pregunta | 0–1 (comparte `questionState.ts`) | 6 (`History.entity`, `Inspector.entity`, `buildHistory`, `HistoryEntry`, `QuestionsSection`, `Inspector.service`) | specs de History/Inspector (imports) | ~7 |
| F7 · `executionSignal` | 1 | 3 (`useExecutionSignals`, `eventReducer`, `useGraphEnrichment`) | `useExecutionSignals.spec`, `eventReducer.spec` | ~5 |
| F8 · `TOutcome` | 0 (comparte `outcomeLabel.ts`) | 3 (`History.entity`, `Graph.entity`, `nodeStatus.ts`) | `nodeStatus`/`buildGraph` specs | ~3 |

**Cierres encadenados (aprovechar el mismo PR):**

- **F2 + F8 comparten `outcomeLabel.ts`**: cerrar ambas juntas evita crear el
  archivo dos veces. Coste conjunto ≈ 4–5 archivos.
- **F3 + F6 comparten `questionState.ts`**: el módulo de mapas y el de tipos
  pueden vivir juntos → una sola creación, ~7–8 archivos al cerrar ambas.
- **F1 + F4 + F5** son las "3 familias de mapas/helpers de estado": mismo patrón,
  mismo PR posible (≈ 6 nuevos + ~10 edits).
- **F7** está acoplada al corte de `eventReducer.ts` (área 03) y a
  `useGraphEnrichment.ts` (área 02): no puede cerrarse sin coordinar con ambos.
- **F6** es la más invasiva (tipos compartidos entre dos dominios); se recomienda
  cerrarla después de F3 para reutilizar el mismo módulo.

**Total de producción estimado si se cierran las 8 familias:** ~4–5 archivos
nuevos (`nodeStatusColor.ts`, `outcomeLabel.ts`, `questionState.ts`,
`toolStatus.ts`, `executionSignal.ts`, `totalTokens.ts` — 6 en total) y ~20–25
archivos editados (consumidores + barrels), más las moléculas asociadas
(`QuestionStateBadge`, `ToolStatusBadge`).

---

## Bloqueos / dependencias externas a esta consolidación

- **F6/F3 dependen de `HistoryQuestion.entity` vs `questionState.ts`:** decidir
  si los tipos viven en `Application/Helpers` (propuesto) o en un `Application/Types`
  nuevo. Hoy `Application/Entities` **no existe**; cualquiera de las dos rutas
  requiere aprobar una convención nueva.
- **F7 depende del corte de `eventReducer.ts` (área 03)** y de
  `useGraphEnrichment.ts` (área 02): `EMPTY_EXECUTION_SIGNAL` debe existir antes de
  que el slice lo importe.
- **F1 depende de que A02 extraiga `GutterNode.tsx`**: mientras `STATUS_DOT` siga
  dentro de `ExecutionLanes.tsx`, el consumidor a migrar es ese archivo.
- **`WorkspacePage.perf.spec.tsx` (F-useNow)** ata el contrato de `useNow` y el
  import por barrel de Graph; cualquier cambio de firma exige tocar el espía.
- **`nodeInterval` (bug #2)** cambia comportamiento de orden cuando falta
  `createdAt`: requiere decisión del owner y revisión de `executionLevels.spec.ts`,
  no es un refactor "puro".
- **Wording `NODE_STATUS_LABEL` vs `OUTCOME_LABEL`:** divergencia intencional
  ("Terminada" vs "Terminada con éxito"); unificar es una decisión de producto,
  no técnica. Queda **sin resolver por diseño**.
