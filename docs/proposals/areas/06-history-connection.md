# Área 06 — History + Connection

> Análisis **de solo lectura**. Propuesta de descomposición atómica y reutilizable.
> Leyenda de contexto: `docs/proposals/inventario-gordos.md`.
> Convenciones: `AGENTS.md` + `.specify/memory/constitution.md`.

## Resumen del área

**Dominio `History`** — 8 archivos fuente + 4 specs. **3 archivos GORDO (≥150 líneas):**

| Archivo | Líneas | Motivo |
|---------|-------:|--------|
| `src/Domains/History/lib/buildHistory.ts` | 409 | **(e) OTRO** — proyección pura con dos `switch` (tipo de mensaje / parte) + normalizadores + merge de preguntas |
| `src/Domains/History/History.entity.ts` | 247 | **(e) OTRO** — unión discriminada de 14 variantes + view-models de pregunta + alias de estado |
| `src/Domains/History/Components/HistoryHeader.tsx` | 164 | **(d) JSX-GORDO** — identidad + 7 métricas + navegación de linaje, con 2 constantes duplicadas |

**Dominio `Connection`** — 9 archivos, **ninguno ≥150** (máx. 26: `ConnectionBadge.tsx`). No requiere
corte por tamaño. Se incluye porque aporta piezas atómicas compartidas (`CONNECTION_LABEL`,
`DOT_COLOR`) y por deuda de convenciones (ver *Notas*).

**Concentración de responsabilidades detectada:**

- `buildHistory.ts` mezcla **4** preocupaciones independientes: (1) proyección por *tipo de mensaje*,
  (2) proyección de *partes del assistant*, (3) *normalización de campos* del SDK, (4) *merge de
  preguntas*. El corte natural es por tipo de entrada + aislamiento del subsistema de preguntas.
- `HistoryHeader.tsx` mezcla **navegación de linaje** + **identidad** + **métricas** + **derivación de
  valores**, y arrastra dos duplicaciones confirmadas en el inventario: `OUTCOME_LABEL` (Familia 2) y
  `totalTokens()` (Familia 5).
- `HistoryModal` / `HistoryTimeline` están bajo el umbral (140 / 134) pero comparten con
  `HistoryHeader` la navegación (`NavButton`) y el esqueleto de carga; se documentan por el "ojo
  especial".

---

## Propuestas por archivo

### `src/Domains/History/lib/buildHistory.ts` — 409 líneas (motivo: (e) OTRO)

Corte por tipo de entrada: el `switch` de `toMessageEntries` (11 casos) se sustituye por un
**registro exhaustivo** `MESSAGE_ENTRY_BUILDERS` (un builder por tipo de `SessionMessageInfo`); el
subsistema de preguntas (`mergeQuestions` + emparejamiento por título) se aísla en su propio módulo;
los normalizadores de campos del SDK se agrupan.

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| `buildHistory` (orquestador) | función pura | `lib/buildHistory.ts` *(permanece)* | `buildHistory(messages: TSessionMessage[], options?: BuildHistoryOptions): THistoryEntry[]` · export `BuildHistoryOptions` | `useHistoryPagination`, specs | ~50 |
| `MESSAGE_ENTRY_BUILDERS` + builders de mensaje | registro + funciones puras | `lib/entryBuilders.ts` | `type TEntryBuilder = (message: TSessionMessage, at: number, id: string) => THistoryEntry[]`; `const MESSAGE_ENTRY_BUILDERS: Record<TSessionMessage['info']['type'], TEntryBuilder>`; builders `toUserEntry`, `toAgentSwitchedEntry`, `toModelSwitchedEntry`, `toLocationSwitchedEntry`, `toSystemEntry`, `toSyntheticEntry`, `toSkillEntry`, `toShellEntry`, `toCompactionEntry`, `toIdleEntry` | `buildHistory` | ~110 |
| Builder de assistant + partes | funciones puras | `lib/assistantParts.ts` | `toAssistantEntries(info, parts, at): THistoryEntry[]`; `toTextEntry` / `toReasoningEntry` / `toToolEntryPart` privados | `entryBuilders` | ~45 |
| Proyección de tool + contenido | funciones puras | `lib/toolEntry.ts` | `toToolEntry(part: SessionMessageAssistantTool): TToolEntry`; `toolContentToText(content: readonly ToolContent[]): string` | `assistantParts`; **candidato** `Inspector/ToolHistory` (mismo problema) | ~40 |
| Normalizadores de campos SDK | funciones puras | `lib/normalizeSdkFields.ts` | `toAttachments(info: SessionMessageUser): THistoryAttachment[]`; `toExit(exit): number \| null`; `toCompactionSummary(info): string \| null` | `entryBuilders`, `assistantParts` | ~35 |
| Subsistema de preguntas | módulo puro | `lib/historyQuestions.ts` | `mergeQuestions(entries: THistoryEntry[], questions: THistoryQuestion[]): THistoryEntry[]`; `QUESTION_TOOL_NAMES`, `isQuestionTool`, `candidateTitles`, `pickAnchor`, `toQuestionEntry`, `TQuestionAnchor` (privados) | `buildHistory` | ~135 |

**Resultado estimado:** `buildHistory.ts` 409 → ~50 (orquestador) + ~365 repartidos en 5 módulos, todos
<150 líneas. Cada builder es testeable en aislamiento con un fixture por tipo de mensaje.

**Riesgos/specs afectados:** `lib/specs/buildHistory.spec.ts` (697 líneas) importa `buildHistory` y
`BuildHistoryOptions` → mantener el re-export desde `lib/buildHistory.ts` (o actualizar el import una
sola vez) para no romper 25+ casos. `Hooks/useHistoryPagination.ts` importa `buildHistory` de
`../lib/buildHistory` → sin cambios si se conserva la ruta pública. Riesgo **bajo**: el orden
determinista y los `id` estables se preservan si el registro cubre los 11 tipos; tipar el `Record` con
`TSessionMessage['info']['type']` hace que el compilador **exija** cobertura exhaustiva.

---

### `src/Domains/History/History.entity.ts` — 247 líneas (motivo: (e) OTRO)

Es un archivo de tipos/entidades con tres bloques separables: (1) entrada base + unión de 14 variantes,
(2) view-models de pregunta, (3) alias de estado del SDK.

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| Entrada base + unión + navegación | tipos | `History.entity.ts` *(permanece)* | `THistoryEntryBase`, `THistoryEntry`, `THistoryUserEntry`…`THistoryIdleEntry`, `THistoryTarget`, `TLineageNav`, `TToolEntry` | `History.service`, Componentes, `useHistory` | ~150 |
| View-models de pregunta | tipos | `HistoryQuestion.entity.ts` | `THistoryQuestionState`, `THistoryQuestionOption`, `THistoryQuestionField`, `THistoryQuestion`, `THistoryQuestionEntry` | `buildHistory`, `HistoryEntry`; **convergencia con Inspector** (Familia 6) | ~55 |
| Alias de estado del SDK | tipos | `HistoryStatus.entity.ts` | `TToolStatus`, `TCompactionStatus`, `TCompactionReason`, `TShellStatus`, `TIdleOutcome` | `buildHistory`, `HistoryEntry` | ~30 |

**Resultado estimado:** 247 → ~150 (core) + ~55 (pregunta) + ~30 (estados). El módulo de pregunta es la
pieza **atómica reutilizable**: converge con `Inspector/Inspector.entity.ts`
(`TQuestionState`/`TQuestionField`/`TQuestionOption`, hoy estructuralmente idénticos) → candidato a tipo
compartido en `Application` (ver *Piezas atómicas*).

**Riesgos/specs afectados:** `index.ts` hace `export * from './History.entity'` → al crear archivos hay
que añadirlos al barrel para no romper imports. `HistoryModal.spec.tsx` y `HistoryTimeline.spec.tsx`
importan de `@app/Domains/History/History.entity` → mantener `export *` desde `History.entity.ts` o
actualizar import. `TIdleOutcome` (Familia 8) → unificar en `TOutcome` compartido. Riesgo **bajo**
(solo tipos).

---

### `src/Domains/History/Components/HistoryHeader.tsx` — 164 líneas (motivo: (d) JSX-GORDO)

El componente mezcla tres bloques JSX (identidad, métricas, linaje) + derivación de 7 valores +
`NavButton` interno + 2 constantes duplicadas. Se descompone en subcomponentes de presentación pura
con la **derivación movida a un selector puro** (Principio V).

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| `HistoryIdentity` | componente presentación | `Components/HistoryIdentity.tsx` | `{ title: string; status: TNodeStatus; agentName: string }` → render título + `StatusDot` + `NODE_STATUS_LABEL` + agente | `HistoryHeader`; futuras cabeceras de overlay | ~25 |
| `HistoryMetrics` | componente presentación | `Components/HistoryMetrics.tsx` | `{ view: THistoryHeaderView }` → fila de `Metric` (Modelo, Estado, Costo, Tokens, Duración, Resultado, Directorio) | `HistoryHeader`; Inspector (resumen de nodo) | ~35 |
| `HistoryLineageNav` | componente presentación | `Components/HistoryLineageNav.tsx` | `{ parentId: string \| null; childrenIds: string[]; onNavigate: (sessionId: string) => void }` → "Invocado por"/"Invocó a" con `NavButton` + `UNAVAILABLE` | `HistoryHeader`; cabecera de overlay de sesión | ~45 |
| `NavButton` | componente presentación | `Application/Components/Molecules/NavButton.tsx` | `{ sessionId: string; onNavigate: (sessionId: string) => void; title?: string }` → chip monoespaciado | `HistoryLineageNav`, `HistoryModal` (navegación), futuras listas de linaje | ~20 |
| `deriveHistoryHeaderView` | selector puro | `lib/historyHeaderView.ts` | `(node: TGraphNode): THistoryHeaderView` con `{ title, agentName, status, modelValue, costValue, tokensValue, durationValue, outcomeValue, directoryValue }` | `HistoryHeader` (presentación pura), tests unitarios puros | ~40 |
| `OUTCOME_LABEL` | constante compartida | `Application/Helpers/outcomeLabel.ts` | `OUTCOME_LABEL: Record<TOutcome, string>` (`succeeded`→"Terminada con éxito", `failed`→"Fallida", `interrupted`→"Interrumpida") | `HistoryHeader` + `HistoryEntry` (hoy `IDLE_LABEL`, Familia 2) | ~10 |
| `totalTokens` | helper puro compartido | `Application/Helpers/totalTokens.ts` | `totalTokens(tokens: TTokenUsage \| null): number \| null` | `HistoryHeader`, `AgentNode`, `SessionSummaryBar` (Familia 5) | ~12 |

**Resultado estimado:** `HistoryHeader.tsx` 164 → ~40 (composición pura de `HistoryIdentity` +
`HistoryMetrics` + `HistoryLineageNav`) y ~165 repartidos en 3 subcomponentes locales + `NavButton`
compartido + selector en `lib/`. Todos <150 líneas.

**Riesgos/specs afectados:** `HistoryModal.spec.tsx` asserta `getAllByText('develop')` y
`getAllByLabelText('no disponible')` → preservar textos y el `aria-label="no disponible"` del fallback
de linaje. `HistoryEntry.spec.tsx` puede assertar "Terminada con éxito": unificar
`OUTCOME_LABEL`/`IDLE_LABEL` **mantiene el texto**. No se propone tocar el wording divergente de
`NODE_STATUS_LABEL` ("Terminada") → documentar como divergencia intencional o alinear según criterio
del owner. `WorkspacePage.spec.tsx` y `WorkspacePage.perf.spec.tsx` mockean `HistoryModal` (no
`HistoryHeader`) → no afectados.

---

### Archivos <150 con piezas compartidas (ojo especial: `HistoryModal` / `HistoryTimeline`)

`HistoryModal.tsx` (**140**) y `HistoryTimeline.tsx` (**134**) están bajo el umbral, pero contienen
piezas atómicas y deuda de convención relevantes:

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|---|---|---|---|---|---|
| `HistorySkeleton` (hoy interno en `HistoryModal`) | componente presentación | `Components/HistorySkeleton.tsx` | sin props | `HistoryModal`; cualquier overlay con timeline | ~10 |
| `useHistorySentinel` (hoy `useEffect`+`IntersectionObserver` en `HistoryTimeline`) | hook | `Hooks/useHistorySentinel.ts` | `({ sentinelRef, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage }) => void` | `HistoryTimeline`; listas infinitas futuras | ~35 |
| `HistoryLoadError` (hoy `<p role="alert">` interno) | componente presentación | `Components/HistoryLoadError.tsx` | sin props (texto FR-016 fijo) | `HistoryTimeline` | ~10 |

**Riesgos/specs afectados:** `HistoryTimeline.spec.tsx` (236) mockea `IntersectionObserver` y usa
`data-testid="history-sentinel"` → conservar ambos. `HistoryModal.spec.tsx` mockea
`../../Hooks/useHistoryPagination` → si el hook de sentinel se renombra, mantener ese import intacto.

---

### `src/Domains/Connection/**` — sin archivos ≥150

No hay archivos gordos (máximo 26 líneas). **No se propone descomposición por tamaño.** Piezas
atómicas y estado:

| Pieza existente | Ruta | Observación |
|---|---|---|
| `CONNECTION_LABEL` | `Connection.entity.ts` | `Record<TConnectionState, string>` — pieza atómica correcta; candidata a converger con el mapa semántico de estados (nota del inventario) |
| `DOT_COLOR` | `Components/ConnectionBadge.tsx` | `Record<TConnectionState, string>` con tokens `bg-status-*`; **no** comparte claves con `TNodeStatus` → solo nota de patrón, no duplicación estricta |
| `useConnectionStatus` | `Hooks/useConnectionStatus.ts` | Pass-through puro de `useEventStream().state`; correcto (lógica en hook, componente presentación) |
| `ConnectionBadgeSkeleton` | `Components/ConnectionBadgeSkeleton.tsx` | Exportado pero **sin consumidor** en `src/` (grep) → dead code o falta de rama de carga |

---

## Piezas atómicas listas para compartir

Consumidores previstos (reales o inmediatos):

| Pieza | Archivo destino | Consumidores previstos |
|---|---|---|
| `OUTCOME_LABEL` (3 terminales) | `Application/Helpers/outcomeLabel.ts` | `HistoryHeader` (hoy local), `HistoryEntry` (hoy `IDLE_LABEL`, copia literal) |
| `totalTokens` | `Application/Helpers/totalTokens.ts` | `HistoryHeader`, `AgentNode`, `SessionSummaryBar` (3 copias literales) |
| `THistoryQuestion` / `THistoryQuestionField` / `THistoryQuestionOption` / `THistoryQuestionState` | `HistoryQuestion.entity.ts` (o tipo compartido en `Application`) | `buildHistory`, `HistoryEntry`, `Inspector/Inspector.entity.ts` (`TQuestion*`, idénticos) |
| `NavButton` | `Application/Components/Molecules/NavButton.tsx` | `HistoryLineageNav`, navegación de `HistoryModal`, futuras listas de linaje |
| `TOutcome` (unión terminal `succeeded\|failed\|interrupted`) | `Application` (junto a `OUTCOME_LABEL`) | `History.entity.ts` (`TIdleOutcome`), `Graph.entity.ts` (`TExecutionSignal['outcome']`), `lib/nodeStatus.ts` |
| `HistorySkeleton` | `History/Components/HistorySkeleton.tsx` | `HistoryModal` (hoy interno) |
| `useHistorySentinel` | `History/Hooks/useHistorySentinel.ts` | `HistoryTimeline` |
| `HistoryLoadError` | `History/Components/HistoryLoadError.tsx` | `HistoryTimeline` |
| `toolContentToText` | `History/lib/toolEntry.ts` | `buildHistory`; candidato `Inspector/ToolHistory` |
| `CONNECTION_LABEL` | `Connection.entity.ts` | `ConnectionBadge` (ya compartido correctamente) |

---

## Notas / discrepancias con convenciones

1. **`div` con `flex` (regla: usar `<Container>`)** — violada en el área:
   - `HistoryModal.tsx` líneas 103, 107, 109, 137 (`fixed inset-0 flex flex-col`, `flex-1 overflow-y-auto`).
   - `HistoryTimeline.tsx` líneas 42, 96, 98, 120 (`flex flex-col gap-*`).
   - `ConnectionBadge.tsx` línea 15 (`flex items-center gap-2`).
   Al extraer subcomponentes y `HistorySkeleton`, migrar a `<Container>` (con `block`/`row`/`space`).
   El contenedor raíz `fixed inset-0` de `HistoryModal` probablemente requiera un `Container` con
   `className` de posicionamiento (Container ya acepta `className`).

2. **Estados de pantalla explícitos (Principio VI)** — `HistoryModal` cubre error→loading→vacío→datos
   correctamente (error local, `HistorySkeleton`, vacío en `HistoryTimeline`, datos). `ConnectionBadge`
   **no** tiene rama `isLoading` y su `ConnectionBadgeSkeleton` está huérfano → o se consume o se
   elimina; decisión de owner.

3. **`OUTCOME_LABEL` vs `NODE_STATUS_LABEL` (Familia 2)** — `HistoryHeader` usa "Terminada con éxito"
   para `succeeded` mientras `NODE_STATUS_LABEL` dice "Terminada". La unificación con `IDLE_LABEL` es
   segura; la unificación con `NODE_STATUS_LABEL` **no** es literal. Se recomienda extraer
   `OUTCOME_LABEL` como fuente propia y documentar la divergencia (o preguntar al owner antes de
   cambiar wording visible en tests).

4. **`Connection.service.ts`** — es un re-export de una sola línea
   (`export { useConnectionStatus } from './Hooks/useConnectionStatus'`), no un service con SDK. No
   viola la Constitución III (el SDK vive en `Infrastructure`), pero conviene notar que el dominio no
   tiene `*.service.ts` real; el estado viene de `EventStreamProvider`. No requiere cambio.

5. **Barrel impact** — crear subarchivos en `History` obliga a ampliar `Components/index.ts`,
   `Hooks/index.ts`, `lib/` (no hay barrel de lib) y `History/index.ts` (`export * from './History.entity'`
   sigue cubriendo si `History.entity.ts` re-exporta los nuevos módulos).

6. **Specs afectados (resumen):** `lib/specs/buildHistory.spec.ts` (697), `Components/specs/HistoryModal.spec.tsx`
   (212), `Components/specs/HistoryTimeline.spec.tsx` (236), `Hooks/specs/useHistoryPagination.spec.tsx`
   (200), `Hooks/specs/useHistory.spec.tsx`, `Application/Components/Organisms/specs/HistoryEntry.spec.tsx`,
   `Infrastructure/specs/WorkspacePage.spec.tsx` + `.perf.spec.tsx`, `Infrastructure/specs/EventStreamProvider.spec.tsx`,
   `Connection/Components/specs/ConnectionBadge.spec.tsx`, `Connection/Hooks/specs/useConnectionStatus.spec.tsx`.
   Todos los cortes propuestos son compatibles con mantener las rutas públicas actuales.
