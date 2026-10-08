# Propuesta: componentes atómicos y reutilizables (frontend)

> **Entregable de la fase de análisis. Solo lectura: no se modificó código de producto.**
> Producido por 11 subagentes en 3 tandas (1 inventario → 7 análisis por área → 3 consolidaciones).
> Este documento es la **síntesis**; los detalles viven en `docs/proposals/`.

## Índice

- [1. Problema y objetivo](#1-problema-y-objetivo)
- [2. Diagnóstico](#2-diagnóstico)
- [3. Playbook de descomposición atómica](#3-playbook-de-descomposición-atómica)
- [4. Catálogo de piezas compartidas](#4-catálogo-de-piezas-compartidas)
- [5. Plan de refactor en 5 tandas](#5-plan-de-refactor-en-5-tandas)
- [6. Quick wins](#6-quick-wins)
- [7. Métricas objetivo](#7-métricas-objetivo)
- [8. Riesgos y decisiones pendientes](#8-riesgos-y-decisiones-pendientes)
- [9. Documentos fuente](#9-documentos-fuente)

---

## 1. Problema y objetivo

El 55 % de las líneas de producción del front vive en 27 archivos que superan las 150
líneas. Los problemas dominantes no son de complejidad algorítmica sino de
**organización**: subcomponentes hermanos apilados, tablas de estado/label duplicadas
entre dominios, lógica mezclada con render y JSX monolítico.

**Objetivo:** un catálogo de piezas atómicas y un plan priorizado para reducir el tamaño
de los archivos sin perder comportamiento, respetando `AGENTS.md` y la constitución.

**Alcance analizado:** todo `src/` (162 archivos), excluyendo `*/specs/`, `src/test/` y
`src/Application/Components/ui/` (shadcn). Umbral de "gordo": **≥150 líneas**.

## 2. Diagnóstico

| Métrica | Valor |
|---|--:|
| Archivos analizados | 162 |
| Archivos GORDO (≥150 L) | 27 (16,7 %) |
| Líneas en GORDO | 6.658 |
| Líneas totales | 12.120 (54,9 % en GORDO) |

**Top 7 gordos:** `eventReducer.ts` (622), `WorkspacePage.tsx` (413), `buildHistory.ts`
(409), `AgentGraph.tsx` (358), `useGraphEnrichment.ts` (351), `HistoryEntry.tsx` (330),
`deriveMetrics.ts` (320).

**Motivos primarios:** SUBCOMPONENTES 1 · LOGICA-MEZCLADA 3 · JSX-GORDO 6 · OTRO 17 (libs
puras y servicios con muchas responsabilidades). Los mapas de estado nunca son el motivo
primario, pero aparecen como motivo secundario en varios archivos.

**8 familias de duplicación transversal** (detalle en `inventario-gordos.md`):

| # | Familia | Copias |
|---|---|---|
| 1 | Color por `TNodeStatus` (9 estados) | 3 (idénticas) |
| 2 | Etiqueta de resultado terminal | 3 (wording divergente) |
| 3 | Estado de pregunta (label + color) | 2 (idénticas) |
| 4 | Color por estado de herramienta | 2 (solapan en 3 claves) |
| 5 | Helper `totalTokens()` | 3 (literales) |
| 6 | View-models de pregunta (tipos) | 2 (estructuralmente idénticos) |
| 7 | Señal de ejecución vacía | 2 (literales) |
| 8 | Unión terminal `succeeded\|failed\|interrupted` | 3 |

Además, el análisis detectó **violaciones preexistentes de convención** (`div` con `flex`
donde corresponde `<Container>`, cross-domain desde componentes, magic strings) y
**código muerto confirmado por grep** (~167 líneas sin consumidores).

## 3. Playbook de descomposición atómica

Reglas reutilizables para cualquier refactor futuro. Toda pieza debe cumplirlas:

**R1 — Una responsabilidad.** Si necesitas "y" para describirla, se parte.

**R2 — Separar por eje, no por tamaño.**
- Render → subcomponente.
- Lógica/derivación → hook (`Hooks/`) o función pura (`lib/`).
- Datos de presentación (label/color/estilo) → constante compartida.
- Tipos → módulo de tipos.

**R3 — Fachada que preserva import specifiers.** Nunca rompas la ruta pública:
`eventReducer.ts` + carpeta hermana `eventReduce/`, `deriveMetrics.ts` + `metrics/`,
o `HistoryEntry.tsx` + `HistoryEntry/`. Evita la ambigüedad TS/Vite `<x>.ts` vs
`<x>/index.ts` y mantiene verdes los specs sin tocar imports.

**R4 — Barrel append-only.** Los `index.ts` y `queryKeys.ts` solo reciben `export`. Son el
punto de registro, no lógica.

**R5 — Corte de estados/labels por familia, un destino único.** Si un mapa de estado
aparece en 2+ archivos, se cierra la familia con un solo módulo. Fuente única por concepto
(`NODE_STATUS_COLOR`, `OUTCOME_LABEL`, `totalTokens`, …).

**R6 — Presentación pura.** Componentes sin acceso al SDK ni a hooks de datos; reciben
props. Cross-domain **solo** desde hooks (AGENTS §8.3).

**R7 — Respetar contratos observables.** Textos, `aria-*`, `data-*`, testids, orden
error→carga→vacío→datos y deps de `useMemo` son contrato; el refactor no los cambia.

**R8 — Import por barrel.** Las piezas nuevas importan por barrel de dominio (no ruta
profunda) para no romper `vi.mock` en specs.

**R9 — Sin `div` + `flex`** (usar `<Container>`), sin `md:hidden`/`hidden md:block`
(usar `useDevice()`), sin magic strings.

**R10 — Código muerto fuera.** Antes de descomponer, borra lo que no tiene consumidores.

## 4. Catálogo de piezas compartidas

Destino único por familia (resuelto entre las áreas). **No se crea carpeta `Entities/`
nueva**: los mapas y tipos van a `Application/Helpers/` y la presentación a
`Application/Components/Molecules/`.

### 4.1 Cerrar familias de duplicación (helpers)

| Pieza | Destino | Contrato | Archivos que migran |
|---|---|---|---|
| `NODE_STATUS_COLOR` | `Application/Helpers/nodeStatusColor.ts` | `Record<TNodeStatus, string>` | `StatusDot`, `NodeStatusRail`, `GutterNode` |
| `OUTCOME_LABEL` + `TOutcome` + `isTerminalOutcome` | `Application/Helpers/outcomeLabel.ts` | `Record<TOutcome,string>` | `HistoryHeader`, `HistoryEntry`, `History.entity`, `Graph.entity`, `nodeStatus.ts` |
| `QUESTION_STATE_LABEL/COLOR` + tipos | `Application/Helpers/questionState.ts` | `Record<TQuestionState,string>` + `TQuestionState/Option/Field/Entry` | `HistoryEntry`, `QuestionsSection`, `History.entity`, `Inspector.entity`, `buildHistory`, `Inspector.service` |
| `TOOL_STATUS_LABEL/COLOR` | `Application/Helpers/toolStatus.ts` | `Record<TToolStatus,string>` | `ToolCallEntry`, `ToolHistory` |
| `totalTokens` | `Application/Helpers/totalTokens.ts` | `(tokens: TTokenUsage \| null): number \| null` | `AgentNode`, `HistoryHeader`, `SessionSummaryBar` |
| `EMPTY_EXECUTION_SIGNAL` + normalizadores | `Graph/lib/executionSignal.ts` | `EMPTY_EXECUTION_SIGNAL`, `normalizeSignal`, `mergeExecutionSignals`, `sameExecutionSignal` | `useExecutionSignals`, `eventReducer`, `useGraphEnrichment` |
| `formatModelRef` | `Application/Helpers/formatModelRef.ts` | `(ref) => string` | `HistoryEntry`, `HistoryHeader`, `ModelSection`, `AgentNode`, `cardHeight` |
| `useNow` unificado (opciones) | `Application/Hooks/useNow.ts` | `useNow({ enabled, intervalMs })` | `useSessionFilters`, `useGraphModel`, `WorkspacePage` (**corrige args invertidos**) |
| `chunkArray`, `sumNullable`, `sameQueryKey`, `scheduleIdle` | `Application/Helpers/{array,number,queryKey,scheduleIdle}.ts` | funciones puras genéricas | `loadPriority`, `deriveMetrics`, `eventReducer`, `useExecutionSignals`, `useGraphEnrichment` |
| Constantes de formato + `formatClock` | `Application/Helpers/format/constants.ts` | `UNAVAILABLE`, `UNAVAILABLE_LABEL` | `formatDuration/Tokens/Cost/TimeRange`, `AgentNode` |

### 4.2 Moléculas reutilizables (presentación)

| Patrón de UI | Destino | Consumidores |
|---|---|---|
| `SectionHeading` (21 usos), `DetailRow`, `DetailListRow`, `ListSkeleton` | `Molecules/*` | 12 archivos del Inspector, Graph, History |
| `SectionFrame` (error→carga→vacío→datos) | `Molecules/SectionFrame.tsx` | 7 secciones del Inspector |
| `Disclosure` | `Molecules/Disclosure.tsx` | `AdvancedSection`, `ToolHistory` |
| `QuestionStateBadge`, `ToolStatusBadge` | `Molecules/*` | `QuestionsSection`, `HistoryEntry`, `ToolCallEntry`, `ToolHistory` |
| `QuestionBlock` | `Molecules/QuestionBlock.tsx` | `HistoryEntry`, `QuestionsSection` |
| `NavButton` | `Molecules/NavButton.tsx` | `HistoryHeader`, `HistoryModal` |
| `LabeledSelect`, `MultiSelectFilterPopover` | `Molecules/*` | `TimeRangeFilter`, `ProjectFilter` |
| `LabeledField`, `InProgressText`, `UnavailableValue`, `ResourceRow`, `AttachmentList` | `Molecules/*` | `ToolCallEntry`, `HistoryEntry`, `SessionSummaryBar`, `ResourceList` |
| `alertVariants` + `AlertIconBadge` | `Molecules/*` | `AlertMessage`, `Alert` |

## 5. Plan de refactor en 5 tandas

Las tandas garantizan **disjunción estricta de archivos de lógica**. T1 crea solo
archivos nuevos / borra muertos; T2 y T3 pueden correr en paralelo; T4 y T5 dependen de T1.

| Tanda | Contenido | Acciones |
|---|---|---|
| **T1 — Fundaciones + borrado** | Crea todos los helpers y moléculas compartidas + borra código muerto | 19 SH-* + BD-01 + 3 módulos |
| **T2 — Libs puras gordas** | `eventReducer`, `buildHistory`, `deriveMetrics`, `sessionFilters`, `loadPriority`, `executionLevels`, `reconcileGraph`, `buildGraph` + consumo de helpers | 13 |
| **T3 — Inspector + hooks** | `Inspector.service`, `InspectorPanel`, `useInspectorData`, `QuestionsSection`, hooks/filas de Inspector (paralelizable con T2) | 10 |
| **T4 — Componentes Graph + History** | `AgentGraph`, `AgentNode`, `ExecutionLanes`, `SessionSummaryBar`, `HistoryEntry`, `HistoryHeader`, `useGraphEnrichment`, `useExecutionSignals` | 8 |
| **T5 — Infrastructure** | `WorkspacePage`, `EventStreamProvider`, `opencodeClient`, `useURLParams`, magic strings | 6 |

**Descomposiciones destacadas** (antes → después por pieza máxima):

| ID | Archivo | Antes | Después | Corte |
|---|---|--:|--:|---|
| DC-01 | `Graph/lib/eventReducer.ts` | 622 | ≤120 | slices por familia de evento + facade |
| DC-02 | `Infrastructure/WorkspacePage.tsx` | 413 | ~90 | 4 hooks + 5 componentes de layout |
| DC-03 | `History/lib/buildHistory.ts` | 409 | ~50 | builders por tipo de mensaje + facade |
| DC-04 | `Graph/Components/AgentGraph.tsx` | 358 | ~80 | controladores React Flow + 4 hooks |
| DC-05 | `Graph/Hooks/useGraphEnrichment.ts` | 351 | ~120 | libs puras + hooks de carga |
| DC-06 | `Organisms/HistoryEntry.tsx` | 330 | ~45 | `HistoryEntryBody` + 9 `bodies/*` |
| DC-07 | `Graph/lib/deriveMetrics.ts` | 320 | ≤115 | `metrics/*` por fase + facade |
| DC-10 | `Infrastructure/EventStreamProvider.tsx` | 225 | ~50 | backoff/batching/despacho a libs puras |

Detalle de las 51 acciones (IDs, orígenes, destinos, puntuación) en
`consolidacion/plan-priorizado.md`.

## 6. Quick wins

Máxima rentabilidad, mínimo riesgo, todos en **T1**:

1. **BD-01** — borrar ~167 líneas de código muerto (verificado por grep, 0 consumidores).
2. **SH-01** — `totalTokens` compartido (cierra Familia 5, 3 copias).
3. **SH-03** — `NODE_STATUS_COLOR` (cierra Familia 1, 3 mapas idénticos).
4. **SH-04** — `OUTCOME_LABEL` + `TOutcome` (cierra Familias 2 y 8).
5. **SH-05** — `questionState` + `QuestionStateBadge` (Familia 3).
6. **SH-07** — tipos de pregunta compartidos (Familia 6).
7. **SH-09** — `formatModelRef` (5 sitios → 1).
8. **SH-16** — `alertVariants` + `AlertIconBadge` (2 mapas sin tipar → 1 tipado).

## 7. Métricas objetivo

| Métrica | Actual | Objetivo |
|---|--:|--:|
| Archivos de producción > 200 L | 13 | **0** |
| Archivos de producción > 150 L | 27 | ≤ 4 (residuales justificados) |
| p95 de líneas por archivo de producción | — | ≤ 150 |
| Familias de duplicación abiertas | 8 | **0** |
| Copias de `totalTokens` / `useNow` | 3 / 2 | 1 / 1 |
| Código muerto sin consumidores | ~167 L | **0** |

## 8. Riesgos y decisiones pendientes

### Riesgos críticos (ver `consolidacion/validacion-normativa.md`)

- **R1 — `WorkspacePage.perf.spec.tsx`** espía `useNow` por barrel con firma posicional.
  Cambiar `useNow` rompe el spec → mitigación: shim en `Graph/Hooks/useNow.ts` y actualizar
  el spec en la misma tanda.
- **R2 — mocks de barril**: las piezas nuevas de Infrastructure deben importar por barrel
  (R8) o los `vi.mock` dejan de interceptar y montan React Flow real.
- **R3 — `.parentElement` en `InspectorPanel.spec`**: `SectionFrame` no debe añadir una
  envoltura extra.
- **R4 — `AgentGraph`**: preservar deps exactas de `useMemo`, reconciliación y puntos
  `perfMark/perfMeasure` (specs C3/P5).
- **R5 — contratos de texto/aria** (`Terminada` vs `Terminada con éxito`, `data-status`,
  testids) y **reexports obligatorios**.

### Decisiones del owner

1. **Wording de outcome**: unificar `OUTCOME_LABEL` ("Terminada con éxito") con
   `NODE_STATUS_LABEL` ("Terminada"), o mantener la divergencia documentada.
2. **`nodeInterval`**: `executionLevels` vs `parallelism` tienen fallbacks distintos
   (0 vs now). Unificarlos es **corrección de comportamiento** → requiere revisar
   `executionLevels.spec.ts`.
3. **Firma canónica de `useNow`**: adopción propuesta = objeto `{ enabled, intervalMs }`.
4. **Discrepancia documental**: `AGENTS.md`/constitución citan `@opencode-ai/sdk` pero el
   código importa de `@opencode/client`. Alinear la redacción de la norma (sin cambio de código).
5. **`Graph/Graph.entity.ts` (202 L)**: quedó sin propuesta de corte en ningún área —
   único posible archivo ≥150 residual.

## 9. Documentos fuente

```
docs/proposals/
├── componentes-atomicos.md          ← este documento (síntesis)
├── inventario-gordos.md             ← 27 gordos + 8 familias de duplicación
├── areas/
│   ├── 01-application-components.md
│   ├── 02-graph-view.md
│   ├── 03-graph-lib.md
│   ├── 04-inspector.md
│   ├── 05-sessions.md
│   ├── 06-history-connection.md
│   └── 07-infrastructure.md
└── consolidacion/
    ├── deduplicacion.md             ← destino único por familia + 13 conflictos resueltos
    ├── validacion-normativa.md      ← violaciones, impacto en specs, veredictos
    └── plan-priorizado.md           ← 51 acciones, ranking, tandas, quick wins
```
