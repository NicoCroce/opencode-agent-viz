# 04 — Área Inspector (propuesta de descomposición)

> Análisis de solo lectura. Sin cambios de código de producto.
> Base: `docs/proposals/inventario-gordos.md` + `AGENTS.md` + `.specify/memory/constitution.md`.

## Resumen del área

El dominio `Inspector` tiene **5 archivos ≥150 líneas** (los #15, #18, #19, #21, #23 del inventario):

| Archivo | Líneas | Motivo |
|---------|-------:|--------|
| `Inspector.service.ts` | 208 | (e) OTRO — 7 `useQuery` + 5 helpers de mapeo SDK→view-model |
| `Components/InspectorPanel.tsx` | 188 | (d) JSX-GORDO — orquesta ~12 secciones + header de identidad + estado vacío |
| `Inspector.entity.ts` | 179 | (e) OTRO — tipos/entidades de recursos, preguntas, permisos, cola, contexto, tareas, resumen |
| `Components/QuestionsSection.tsx` | 166 | (d) JSX-GORDO — ramas error/loading/vacío/datos + 2 bloques anidados + 2 mapas |
| `Hooks/useInspectorData.ts` | 163 | (e) OTRO — agregador de 8 queries + 5 derivaciones |

**Diagnóstico estructural:** el grueso del dominio son **secciones de presentación pura ya bien aisladas** (MetricsSection, ModelSection, ToolStats, ToolHistory, SubagentsSection, AnswersSection, FileChanges, ResourceList, AdvancedSection, ErrorsSection, LoopBadge) y **hooks/lib puros** (`deriveTasks`, `medianToolDurations`, `useToolHistory`). El problema no es acoplamiento, sino **repetición de andamiaje**: cada sección reimplementa el mismo encabezado de sección, el mismo bloque skeleton de carga y la misma fila de lista con borde. El panel es un orquestador delgado; el service y el hook agregador mezclan queries con mapeos/derivaciones puras que deberían vivir en `lib/`.

**Oportunidad transversal principal:** 3 piezas de andamiaje (`SectionHeading`, `SectionFrame`, `ListSkeleton`) + 2 dedupes de estado (`questionState`, `toolStatus`) eliminan repetición en **todo** el panel y parte de `Application`/`History` (ver sección de piezas compartidas).

---

## Propuestas por archivo

### `src/Domains/Inspector/Inspector.service.ts` — 208 líneas (motivo: (e) OTRO)

Mezcla 7 `useQuery` con 5 helpers de mapeo SDK→view-model (`fieldOptions`, `formatFormValue`, `formatAnswer`, `toQuestionEntry`, `toPermissionEntry`) que son **lógica pura** y hoy no se pueden testear ni reutilizar aisladamente.

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|-----------------|------|------------------------|--------------------------|------------------|-----------------:|
| `questionMappers` | lib pura | `src/Domains/Inspector/lib/questionMappers.ts` | `toQuestionEntry(form: FormDetail): TQuestionEntry`; `toPermissionEntry(request: PermissionRequest): TPermissionEntry`; `formatAnswer(answer: FormAnswer): string`; `formatFormValue(value: FormValue): string`; `fieldOptions(field: FormField): TQuestionOption[]` | `Inspector.service`, `History/lib/buildHistory` (proyección de preguntas), tests de mapeo | ~55 |
| `InspectorResources.service.ts` | service (hooks query) | `src/Domains/Inspector/InspectorResources.service.ts` | `useGetMcpServers(directory: string \| null)`; `useGetInstructions(sessionId: string \| null)` | `useInspectorData` | ~40 |
| `Inspector.service.ts` (resto) | service (hooks query) | `src/Domains/Inspector/Inspector.service.ts` | `useSessionDiff`, `useSessionForms`, `useSessionPermissions`, `useSessionInbox`, `useSessionContext` — todas `(sessionId) => T*Result` | `useInspectorData` | ~120 |

**Resultado estimado:** 208 → ~120 (service) + ~55 (lib) + ~40 (resources) = ~215 líneas, pero con **toda la lógica pura extraída a un archivo testeable** y las dos queries "de recursos" separadas de las queries "de sesión". El service de sesión queda homogéneo: un `useQuery` → un `{ data, isError, isLoading }`.

**Riesgos/specs afectados:** `specs/Inspector.service.spec.tsx` importa `useSessionForms` de `../Inspector.service` — si el mapper se extrae, mantener el re-export o actualizar el import. `useInspectorData.spec.tsx` mockea `opencodeService`; los mappers son internos, sin impacto. Los query keys (`queryKeys.sessions.questions/context/…`) no cambian → no afecta la coexistencia con el grafo documentada en el spec.

---

### `src/Domains/Inspector/Components/InspectorPanel.tsx` — 188 líneas (motivo: (d) JSX-GORDO)

Orquesta ~12 secciones, pero además mezcla: (1) un **header de identidad** inline de ~28 líneas, (2) el **estado vacío** sin nodo, y (3) la **resolución controlado/no-controlado del razonamiento** (`showReasoning ?? local.visible`), que es lógica de hook dentro del componente.

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|-----------------|------|------------------------|--------------------------|------------------|-----------------:|
| `InspectorIdentity` | componente presentación | `Components/InspectorIdentity.tsx` | `{ node: TGraphNode; invokedBy?: TGraphNode \| null }` — renderiza título, `StatusDot` + `agentName` + `NODE_STATUS_LABEL`, directorio (`folderName`) e "Invocado por" | `InspectorPanel`; cualquier superficie de detalle de nodo (popover/tooltip del grafo) | ~40 |
| `InspectorEmptyPrompt` | componente presentación | `Components/InspectorEmptyPrompt.tsx` | sin props — cabecera "Inspector" + "Selecciona un nodo del grafo para ver su detalle." | `InspectorPanel` | ~14 |
| `useControlledReasoning` | hook | `Hooks/useControlledReasoning.ts` | `(showReasoning?: boolean, onToggle?: () => void) => { visible: boolean; toggle: () => void }` — envuelve `useReasoningVisibility` y resuelve controlado vs. local | `InspectorPanel`; panel de histórico | ~18 |
| `InspectorPanel` (resto) | orquestador | mismo archivo | mismas props públicas actuales (`node`, `parallelPeers`, `invokedBy`, `showReasoning`, `onToggleReasoning`, `onOpenHistory`) | — | ~95 |

**Resultado estimado:** 188 → ~95 (solo composición `<InspectorIdentity/>` + secciones + `<AdvancedSection>`), más dos componentes de ~14/~40 y un hook de ~18. El panel queda como mapa de composición en el orden FR-001.

**Riesgos/specs afectados:** `Components/specs/InspectorPanel.spec.tsx` es sensible al **orden del DOM** y al **scoping por `.parentElement`** (Métricas, Subagentes). Extraer el header a un subcomponente **mantiene el orden** (identidad antes de Modelo) mientras se preserve la posición en el árbol. Las aserciones de texto ('Tarea raíz', 'opencode/deepseek', etc.) no cambian. No tocar el contrato de props: `WorkspacePage.tsx:343` lo consume con `showReasoning`/`onToggleReasoning`/`onOpenHistory` (modo controlado US2).

---

### `src/Domains/Inspector/Inspector.entity.ts` — 179 líneas (motivo: (e) OTRO)

Archivo de tipos que agrupa **seis preocupaciones** distintas: recursos, preguntas/permisos, diff, cola, contexto, tareas y resumen de sesión. Bajo riesgo funcional (tipos), pero alto tráfico de imports cruzados.

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|-----------------|------|------------------------|--------------------------|------------------|-----------------:|
| `InspectorQuestions.entity.ts` | tipos | `src/Domains/Inspector/InspectorQuestions.entity.ts` | `TQuestionState`, `TQuestionOption`, `TQuestionField`, `TQuestionEntry`, `TPermissionEntry`, `TSessionFormsResult`, `TSessionPermissionsResult` | `Inspector.service`, `QuestionsSection`, specs | ~62 |
| `InspectorSession.entity.ts` | tipos | `src/Domains/Inspector/InspectorSession.entity.ts` | `TFileChange`, `TSessionDiffResult`, `TSessionInboxResult`, `TSessionContextResult`, `TToolHistoryEntry`, `TToolStat` | `useInspectorData`, `FileChanges`, `ToolHistory`, `ToolStats`, `medianToolDurations` | ~56 |
| `InspectorResources.entity.ts` | tipos | `src/Domains/Inspector/InspectorResources.entity.ts` | `TMcpStatus`, `TResourceUsage` | `useInspectorData`, `ResourceList`, **`Graph/lib/deriveMetrics`, `Graph/Components/SessionSummaryBar`, `WorkspacePage`** | ~16 |
| `Inspector.entity.ts` (barrel) | tipos | mismo archivo | re-export de los tres + `TTaskEntry`, `TNodeDetail`, `TSessionSummary` | todo el dominio | ~20 |

**Resultado estimado:** 179 → 3 módulos de ~62/56/16 + barrel de ~20. Se separa lo que **realmente es del dominio Inspector** (preguntas, sesión) de lo que **ya es compartido con `Graph`** (`TResourceUsage`, `TSessionSummary`).

**Riesgos/specs afectados:** `TResourceUsage`/`TSessionSummary` los importa `Graph/lib/deriveMetrics.ts`, `Graph/Components/SessionSummaryBar.tsx`, `WorkspacePage.tsx` y sus specs — todos por ruta `Inspector/Inspector.entity`; el barrel conserva esas rutas, así que el riesgo es bajo si se re-exporta. `TNodeDetail` solo aparece en specs/contratos (`specs/001…`, `specs/004…`), **no en código** → candidato a deprecado (verificar antes de borrar). Esta división es de **prioridad baja**: el archivo son solo tipos y el coste/beneficio es menor que el de las piezas compartidas; alternativa recomendada = dejar el archivo y solo resolver el duplicado de la Familia 6 (ver piezas compartidas).

---

### `src/Domains/Inspector/Components/QuestionsSection.tsx` — 166 líneas (motivo: (d) JSX-GORDO)

Un solo render con 4 ramas de pantalla, dos listas anidadas (permisos, preguntas), render de campos/opciones/respuesta y dos mapas de estado (`STATE_LABEL`, `STATE_COLOR`) que **duplican** los de `HistoryEntry` (Familia 3 del inventario).

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|-----------------|------|------------------------|--------------------------|------------------|-----------------:|
| `questionState` | lib (mapas) | `src/Domains/Inspector/lib/questionState.ts` | `QUESTION_STATE_LABEL: Record<TQuestionState, string>`; `QUESTION_STATE_COLOR: Record<TQuestionState, string>` | `QuestionsSection` **y `Application/Organisms/HistoryEntry`** (elimina la Familia 3) | ~14 |
| `QuestionRow` | componente presentación | `Components/QuestionRow.tsx` | `{ question: TQuestionEntry }` — título + `QuestionStateBadge`, campos/opciones y respuesta si `answered` | `QuestionsSection`; render de preguntas en histórico | ~45 |
| `PermissionRow` | componente presentación | `Components/PermissionRow.tsx` | `{ permission: TPermissionEntry }` — `action`, `resources[]`, `message` | `QuestionsSection` | ~22 |
| `QuestionsSection` (resto) | sección | mismo archivo | props actuales (`permissions`, `questions`, `queuedTurns`, `isError`, `isLoading`) | `InspectorPanel` | ~70 |

**Resultado estimado:** 166 → ~70 (sección que solo mapea filas) + ~14 (mapas) + ~45 + ~22. Los textos exactos ('pendiente', 'respondida', 'cancelada', 'Turnos en cola: N', 'Sin permisos ni preguntas') se preservan en los nuevos componentes.

**Riesgos/specs afectados:** `Components/specs/QuestionsSection.spec.tsx` (8 tests) asserta textos exactos y el estado vacío/error/loading — se mantienen. Adoptar `QUESTION_STATE_LABEL/COLOR` compartido toca `HistoryEntry.tsx` y su spec (`HistoryEntry.spec.tsx`) como cambio de import, no de comportamiento.

---

### `src/Domains/Inspector/Hooks/useInspectorData.ts` — 163 líneas (motivo: (e) OTRO)

Agrega 8 queries y 5 derivaciones, **y llama al SDK directamente** (`opencodeService.getSessionMessages`, línea 94) en violación del Principio III (SDK solo en `*.service.ts`).

| Pieza propuesta | Tipo | Ruta destino propuesta | Contrato (props/exports) | Reutilizable por | Líneas estimadas |
|-----------------|------|------------------------|--------------------------|------------------|-----------------:|
| `toolsFromMessages` | lib pura | `src/Domains/Inspector/lib/toolsFromMessages.ts` | `isToolPart(part: TContentPart): part is TToolPart`; `toolsFromMessages(messages: TSessionMessage[]): TToolHistoryEntry[]` | `useInspectorData`, tests de derivación | ~18 |
| `errorsFromMessages` | lib pura | `src/Domains/Inspector/lib/errorsFromMessages.ts` | `errorsFromMessages(messages: TSessionMessage[]): { message: string; at: number }[]` | `useInspectorData`, tests | ~22 |
| `deriveResources` | lib pura | `src/Domains/Inspector/lib/deriveResources.ts` | `deriveResources({ mcpServers, instructions, tools }: {...}): TResourceUsage` | `useInspectorData`, `Graph/lib/deriveMetrics` (comparte `TResourceUsage`) | ~28 |
| `useSessionMessages` | service (query) | `Inspector.service.ts` | `(sessionId: string \| null) => { messages: TSessionMessage[]; isError: boolean; isLoading: boolean }` — **mueve la llamada SDK fuera del hook** | `useInspectorData` | ~35 |
| `useInspectorDerivations` | hook | `Hooks/useInspectorDerivations.ts` | `(messages: TSessionMessage[], questions: TQuestionEntry[]) => { tools, tasks, errors, toolsUsed, entries }` (memos internos) | `useInspectorData` | ~40 |
| `useInspectorData` (resto) | hook agregador | mismo archivo | mantiene `InspectorData` (misma interfaz pública) | `InspectorPanel` | ~70 |

**Resultado estimado:** 163 → ~70 (composición de queries + derivaciones) + ~35 (query de mensajes en el service) + ~40 (hook de derivaciones) + 3 libs puras de ~18/22/28. Además corrige la violación del Principio III.

**Riesgos/specs afectados:** `Hooks/specs/useInspectorData.spec.tsx` (454 líneas) valida la **forma de salida** (`diff`, `forms`, `permissions`, `inbox`, `context`, `entries`, `resources`) — se preserva porque `InspectorData` no cambia. `utils.tsx`/`renderWithProviders` sin cambios. Los mocks de `opencodeService` siguen válidos si `useSessionMessages` sigue llamando `getSessionMessages`.

---

## Piezas atómicas listas para compartir

Ordenadas por apalancamiento. Los "consumidores previstos" cruzan dominios cuando aplica.

1. **`SectionHeading`** — `src/Application/Components/Molecules/SectionHeading.tsx`
   - Props: `{ children: ReactNode; className?: string }`.
   - Motivo: el `<span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">` aparece **21 veces en 12 archivos** (todas las secciones del Inspector, `HistoryHeader`, `Metric`, `CompactionContext`, `ToolCallEntry`, `HistoryEntry`, `SessionList`, `WorkspacePage`).
   - Consumidores previstos: todas las secciones del Inspector + `Application/History`.

2. **`SectionFrame`** — `src/Application/Components/Molecules/SectionFrame.tsx` (patrón de sección reutilizable)
   - Props: `{ title: string; children: ReactNode; action?: ReactNode; isError?: boolean; isLoading?: boolean; isEmpty?: boolean; emptyLabel?: string; loadingLines?: number }`.
   - Renderiza `SectionHeading` + el orden obligatorio **error → loading → vacío → contenido** (Principio VI). Encapsula el andamiaje que hoy repiten `QuestionsSection`, `FileChanges`, `ToolHistory`, `ToolStats`, `ResourceList`, `SubagentsSection`, `ErrorsSection`.
   - Consumidores previstos: las 7 secciones anteriores (reduce ~8-12 líneas por cada una).

3. **`DetailRow`** — `src/Application/Components/Molecules/DetailRow.tsx`
   - Props: `{ label: string; value: string }` (hoy privado en `ModelSection.tsx:10`).
   - Motivo: fila etiqueta/valor monoespaciada reutilizable en cualquier panel de detalle. Es el candidato explícito al que apunta el enunciado.
   - Consumidores previstos: `ModelSection`, futuros detalles de nodo/conexión, `HistoryHeader`.

4. **`Disclosure`** (o `CollapsibleSection`) — `src/Application/Components/Molecules/Disclosure.tsx`
   - Props: `{ title: string; children: ReactNode; defaultExpanded?: boolean; expanded?: boolean; onToggle?: () => void }`.
   - Motivo: `AdvancedSection.tsx` y el toggle "Ver N más/Ver menos" de `ToolHistory.tsx` comparten **exactamente** la misma `Button` con chevrons, `aria-expanded`/`aria-controls` y una className larga duplicada (magic string). Unifica el patrón de header colapsable del panel.
   - Consumidores previstos: `AdvancedSection`, `ToolHistory`; cualquier sección colapsable futura.

5. **`questionState`** + **`QuestionStateBadge`** — `src/Application/Entities/questionState.ts` (o reexport desde Inspector) + `Application/Components/Molecules/QuestionStateBadge.tsx`
   - `QUESTION_STATE_LABEL` / `QUESTION_STATE_COLOR` (`Record<TQuestionState,string>`) + `<QuestionStateBadge state={...} />`.
   - Motivo: dedupe de la **Familia 3** del inventario (`QuestionsSection` `STATE_LABEL/COLOR` ≡ `HistoryEntry` `QUESTION_STATE_LABEL/COLOR`; valores idénticos). El enunciado lo señala explícitamente.
   - Consumidores previstos: `QuestionsSection`, `HistoryEntry`.

6. **`toolStatus`** + **`ToolStatusLabel`** — `src/Application/Entities/toolStatus.ts` + `Application/Components/Molecules/ToolStatusLabel.tsx`
   - `TOOL_STATUS_LABEL` / `TOOL_STATUS_COLOR` + `<ToolStatusLabel status={...} />` (label + color).
   - Motivo: dedupe de la **Familia 4** (`ToolHistory.STATUS_COLOR` ≡ subconjunto de `ToolCallEntry.STATUS_COLOR`; `ToolHistory` además muestra el estado crudo sin label).
   - Consumidores previstos: `ToolHistory`, `ToolCallEntry`.

7. **`ListSkeleton`** — `src/Application/Components/Molecules/ListSkeleton.tsx`
   - Props: `{ lines?: number }` (default 2). Renderiza los `Skeleton` de `h-4 w-full` + `h-4 w-4/5`.
   - Motivo: bloque de carga idéntico en `QuestionsSection`, `FileChanges` y (variante) `CompactionContext`.
   - Consumidores previstos: `QuestionsSection`, `FileChanges`, `CompactionContext`, futuras secciones con carga.

8. **`DetailListRow`** — `src/Application/Components/Molecules/DetailListRow.tsx`
   - Props: `{ children: ReactNode; className?: string }`; renderiza `<Container row space="small" justify="between" align="center" className="border-b border-border py-1 last:border-b-0 …">`.
   - Motivo: la fila con borde inferior se repite en `ToolStats`, `ToolHistory` y en las filas de permiso/pregunta de `QuestionsSection`; además fija el uso de `<Container>` (hoy son `div` con `flex`).
   - Consumidores previstos: `ToolStats`, `ToolHistory`, `QuestionsSection`, `SubagentsSection`.

9. **`ResourceRow`** — `src/Domains/Inspector/Components/ResourceRow.tsx`
   - Props: `{ label: string; items: string[]; emptyLabel: string }` (hoy privado en `ResourceList.tsx`).
   - Motivo: fila `label + chips`, hoy solo dentro de `ResourceList`; candidata a compartir si el detalle de conexión/sesión lista recursos.
   - Consumidores previstos: `ResourceList` (y, a futuro, paneles de detalle).

---

## Notas / discrepancias con convenciones

- **SDK usado fuera de `*.service.ts` (Principio III):** `Hooks/useInspectorData.ts:4,94` importa y llama `opencodeService.getSessionMessages` directamente en el hook. La descomposición propuesta lo mueve a `useSessionMessages` en `Inspector.service.ts`.
- **`div` con `flex` (prohibido por convenciones):** se usan `div` con clases `flex` en
  `ToolHistory.tsx:45`, `ToolStats.tsx:33`, `SubagentsSection.tsx:31,41`, `ResourceList.tsx:17,24`, `ModelSection.tsx:11`, `LoopBadge.tsx:7`, y `span` con `flex` en `InspectorPanel.tsx:104,110`. Deben migrar a `<Container>` al extraer las piezas compartidas.
- **Magic strings / className duplicada:** la `Button` colapsable de `AdvancedSection.tsx:52` y `ToolHistory.tsx:75` comparte literalmente una className larga con `!important`; el `Disclosure` la centraliza. Los tokens de estado (`'text-status-running'`, `'text-status-done'`, …) se repiten en 4+ mapas del dominio y en `Application` -> centralizar en `questionState`/`toolStatus`.
- **Duplicación cross-domain (inventario):** el dominio materializa dos familias del inventario — **Familia 3** (estado de pregunta) y **Familia 4** (color de estado de herramienta) — además de **Familia 6** (view-models de pregunta `TQuestionState/Field/Option` ≡ `History.entity` `THistoryQuestionState/Field/Option`). Las dos primeras se resuelven con las piezas 5 y 6; la tercera requiere un tipo compartido en `Application` (afecta a `History`, fuera del alcance de este documento) y es la única parte valiosa de dividir `Inspector.entity.ts`.
- **`useSessionForms` tiene N+1:** resuelve cada formulario con `getSessionForm` dentro de un `Promise.all` (una request por form). No es un problema de tamaño, pero conviene anotarlo como riesgo de rendimiento al refactorizar el service.
- **Código posiblemente muerto:** `Components/InspectorSkeleton.tsx` (10 líneas) se exporta en el barrel pero **no se consume** en `src/` (solo `WorkspacePage` importa `InspectorPanel`). `TNodeDetail` (Inspector.entity.ts:147) solo aparece en specs/contratos, no en código. Verificar antes de eliminar; no forma parte de esta propuesta de descomposición.
- **`useDevice()`/`md:hidden`:** no hay usos indebidos en el área Inspector (correcto según AGENTS). La presentación mobile/desktop la decide `WorkspacePage`.
- **`AdvancedSection.defaultExpanded`** existe pero el único consumo (`InspectorPanel`) usa el default `false`; el modo controlado (`expanded`/`onToggle`) tampoco se usa hoy. Mantener el contrato al extraer `Disclosure`, ya que los specs verifican el estado por `aria-expanded`.
