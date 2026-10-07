# Implementation Plan: Detalle de ejecución de agentes

**Branch**: `003-execution-detail-views` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-execution-detail-views/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Esta feature expone en la interfaz los datos de ejecución que el servidor de OpenCode ya reporta pero que el visor todavía no explota. No hay backend ni escritura: se amplía el wrapper de solo lectura del SDK y se añaden vistas derivadas, todo sobre la arquitectura por dominios existente.

1. **Respuestas y razonamiento (P1)** — el texto consolidado de cada agente (`SessionMessageAssistantText` / `SessionMessageAssistantReasoning`) se renderiza con formato enriquecido y saneado; el razonamiento se muestra/oculta con independencia de las respuestas.
2. **Histórico completo (P1)** — una vista dedicada (overlay a pantalla completa) con la conversación íntegra de cualquier agente o subagente, en orden cronológico, con navegación de linaje padre↔hijo y carga progresiva sin tope fijo.
3. **Estado de ejecución enriquecido (P1)** — el estado del nodo pasa de 5 a 9 situaciones (creada, ejecutando, reintentando, compactando, esperando permiso, esperando respuesta, terminada, fallida, interrumpida), consistente entre nodo y detalle.
4. **Resumen de sesión (P2)** — barra con contadores por estado, coste, tokens y tiempo transcurrido, agregada de los agentes ya cargados (el tipo `TSessionSummary` vive en `Inspector.entity.ts`; la agregación pura, en `Graph`).
5. **Impacto en el repositorio (P2)** — `session.diff` lista archivos con estado y líneas, y el parche de cada uno.
6. **Por qué espera (P2)** — permisos (operación y recursos) y preguntas al usuario (texto, opciones y estado) vía `session.form.*`.
7. **Diagnóstico de contexto y herramientas (P3)** — episodios de compactación marcados en el histórico, turnos en cola (`session.inbox.list`) y duración mediana por herramienta.

Enfoque técnico: se **amplía `opencodeClient.ts`** con los endpoints de lectura `session.diff`, `session.stats`, `session.form.list/get`, `session.inbox.list`, `session.context`, `session.log` y `session.export`; se añade un dominio nuevo **`Domains/History`** para el histórico; el estado enriquecido y el resumen viven en **`Domains/Graph`**; las secciones de detalle (respuestas, archivos, preguntas, herramientas) viven en **`Domains/Inspector`**; el render enriquecido y el toggle de razonamiento son piezas compartidas en **`Application`**. La lógica nueva es pura y testeable (`buildHistory`, `toNodeStatus`, `summarizeSession`, `medianToolDurations`) y los eventos SSE se extienden sin procesar deltas de texto.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict) + React 19

**Primary Dependencies**: Vite 8, TanStack Query 5 (incluye `useInfiniteQuery`), React Router 7, Tailwind 4 + shadcn/ui (Radix), `@xyflow/react` 12 + `@dagrejs/dagre`, `@opencode/client` 2.0.22, lucide-react, zod. **Nuevas**: `react-markdown` + `remark-gfm` + `rehype-sanitize` (render enriquecido y saneado de FR-001).

**Storage**: N/A — todo es estado en memoria (TanStack Query + estado de vista local). El histórico, el estado enriquecido y las secciones de detalle no se persisten entre recargas.

**Testing**: Vitest 2 + Testing Library + jsdom; specs junto al código en carpetas `specs/` (Principio VIII); fixture de eventos real `src/Domains/Graph/lib/__fixtures__/run.ndjson`; `renderWithProviders` para hooks y componentes.

**Target Platform**: Navegador moderno de escritorio (Chromium/Firefox/Safari) con presentación responsive en móvil (tabs y overlay a pantalla completa).

**Project Type**: Aplicación web single-page (solo frontend; backend = servidor de OpenCode existente).

**Performance Goals**: sin re-layout del grafo por cambios de estado (Principio VII); histórico fluido con miles de entradas (carga progresiva + `content-visibility: auto`); **nunca** se procesan deltas de texto (`session.text.delta`/`reasoning.delta`/`tool.input.delta` se ignoran); el resumen y el estado se actualizan en el sitio sin reordenar la vista.

**Constraints**: solo lectura (no se envía prompt, no se aborta, no se responden permisos ni formularios — FR-037); dark mode / flat design (FR-039); estados de pantalla obligatorios error→loading→vacío→datos (FR-015, Principio VI); tipos derivados del SDK con prefijo `T` (Principio IV); "no disponible" ante datos ausentes (FR-038); sin duplicar lógica entre escritorio y móvil (FR-040).

**Scale/Scope**: 1 sesión activa por vez; ~50 nodos; históricos de miles de entradas; 4 dominios tocados (Graph, Inspector, History nuevo, Sessions) + `Infrastructure/Services` y piezas compartidas en `Application`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Cumplimiento | Evidencia |
|---|-----------|--------------|-----------|
| I | Observador de solo lectura | ✅ PASS | Los 9 métodos nuevos (sobre 7 familias de endpoints) son de lectura (`session.diff`, `session.stats`, `session.form.list/get`, `session.inbox.list`, `session.context`, `session.log`, `session.export`). No se usan `form.reply/cancel`, `inbox.cancel/update`, `interrupt` ni `import` (FR-037). |
| II | Arquitectura por dominios funcionales | ✅ PASS | Estado enriquecido y resumen en `Domains/Graph`; secciones de detalle en `Domains/Inspector`; histórico en el nuevo `Domains/History`; render enriquecido y toggle de razonamiento en `Application` (compartidos). Sin imports cruzados de componentes entre dominios: el orquestador `WorkspacePage` (Infrastructure) conecta las piezas. |
| III | Datos del servidor SOLO vía TanStack Query | ✅ PASS | El SDK se toca únicamente en `Infrastructure/Services/opencodeClient.ts`; los dominios consumen hooks (`History.service.ts`, `Inspector.service.ts`, `Graph` vía `useGraphModel`). Ningún componente llama al SDK. |
| IV | Tipos derivados del SDK | ✅ PASS | Los datos crudos usan tipos del SDK (`FileDiffInfo`, `FormInfo`/`FormDetail`, `SessionInboxInfo`, `SessionMessageInfo`, `SessionStatsInfo`, `SessionLogItem`, `SessionTransferData`). Los view-models nuevos (`THistoryEntry`, `TToolEntry`, `TFileChange`, `TQuestionEntry`, `TPermissionEntry`, `TExecutionSignal`, `TSessionSummary`) son estado de vista con prefijo `T`, no redefiniciones del SDK. |
| V | Lógica pura y testeable | ✅ PASS | `buildHistory()`, `toNodeStatus()`, `summarizeSession()`, `medianToolDurations()`, `deriveExecutionSignals()` y las extensiones de `reduceEvent()` son funciones puras sin React con specs propias. |
| VI | Estados de pantalla obligatorios | ✅ PASS | El histórico y cada sección de detalle renderizan error→loading→vacío→datos (FR-015, FR-030, edge cases de "no disponible"). El resumen no introduce una vista sin datos. |
| VII | Rendimiento en tiempo real | ✅ PASS | El evento en vivo solo parchea estado; no relayouta (Principio VII). El histórico carga por páginas y usa `content-visibility`. Los deltas de texto se descartan explícitamente (FR-005). |
| VIII | Convenciones de repositorio | ✅ PASS | Specs en `specs/` junto al código; Conventional Commits; ESLint strict; TypeScript strict. |

**Resultado inicial**: 8/8 PASS. Sin violaciones. No se requiere Complexity Tracking.

**Re-check post-diseño (Phase 1)**: 8/8 PASS sin cambios. Los contratos confirman: solo endpoints de lectura (I); separación Graph/Inspector/History + piezas compartidas en Application (II); SDK solo en el wrapper (III); tipos `T` de vista y datos crudos del SDK (IV); seis funciones puras cubiertas por specs (V); estados de pantalla explícitos en cada sección (VI); carga progresiva y sin deltas (VII); specs junto al código (VIII). No aparecieron violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/003-execution-detail-views/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (decisiones resueltas)
├── data-model.md        # Phase 1 output (view-models y reglas)
├── quickstart.md        # Phase 1 output (guía de validación end-to-end)
├── checklists/
│   └── requirements.md  # Calidad de la especificación (ya existe)
├── contracts/           # Phase 1 output (contratos de UI, funciones puras y endpoints)
│   ├── README.md
│   ├── client-read-contract.md
│   ├── execution-state-contract.md
│   ├── history-contract.md
│   ├── rich-text-contract.md
│   ├── inspector-detail-contract.md
│   └── session-summary-contract.md
├── spec.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── Application/
│   ├── Components/
│   │   ├── Molecules/
│   │   │   ├── RichText.tsx                 # NUEVO: markdown seguro (react-markdown + remark-gfm + rehype-sanitize)
│   │   │   ├── index.ts                     # (extender) exporta RichText
│   │   │   └── specs/
│   │   │       └── RichText.spec.tsx        # NUEVO: listas, código, tablas, énfasis y neutralización
│   │   └── index.ts                         # (extender) exporta RichText
│   └── Hooks/
│       ├── useReasoningVisibility.ts        # NUEVO: toggle compartido respuestas/razonamiento (FR-002)
│       ├── index.ts                         # (extender) exporta useReasoningVisibility
│       └── specs/
│           └── useReasoningVisibility.spec.tsx
│
├── Infrastructure/
│   ├── Services/
│   │   ├── opencodeClient.ts                # (extender) endpoints de lectura nuevos + paginación por cursor
│   │   └── specs/
│   │       └── opencodeClient.spec.ts       # (extender) wrappers nuevos
│   └── WorkspacePage.tsx                    # (extender) orquesta histórico, razonamiento, resumen y doble clic
│
└── Domains/
    ├── queryKeys.ts                         # (extender) execution/history/diff/forms/inbox/context
    │
    ├── Graph/
    │   ├── Graph.entity.ts                  # (extender) TNodeStatus a 9 estados; retry/interrupt/compaction en TGraphNodeData
    │   ├── lib/
    │   │   ├── nodeStatus.ts                # (extender) toNodeStatus() con prioridad y FR-020
    │   │   ├── buildGraph.ts                # (extender) usa señales de ejecución + forms + inbox
    │   │   ├── deriveMetrics.ts             # (extender) summarizeSession() con conteos nuevos y elapsed
    │   │   ├── eventReducer.ts              # (extender) text/reasoning ended, retry, compaction, outcome, inbox, forms
    │   │   └── specs/
    │   │       ├── nodeStatus.spec.ts       # NUEVO
    │   │       ├── buildGraph.spec.ts       # (extender)
    │   │       ├── deriveMetrics.spec.ts    # (extender)
    │   │       └── eventReducer.spec.ts     # (extender)
    │   ├── Components/
    │   │   ├── AgentNode.tsx                # (extender) etiqueta y color por estado enriquecido
    │   │   ├── NodeStatusRail.tsx           # (extender) color por estado
    │   │   ├── ExecutionLanes.tsx           # (extender) punto por estado
    │   │   ├── AgentGraph.tsx               # (extender) onNodeDoubleClick → histórico
    │   │   ├── SessionSummaryBar.tsx        # NUEVO: contadores, coste, tokens, tiempo
    │   │   └── specs/
    │   │       ├── AgentNode.spec.tsx       # (extender)
    │   │       └── SessionSummaryBar.spec.tsx
    │   └── Hooks/
    │       ├── useExecutionSignals.ts       # NUEVO: señales de ejecución por sesión
    │       └── useGraphModel.ts             # (extender) combina señales + forms + inbox
    │
    ├── Inspector/
    │   ├── Inspector.entity.ts              # (extender) TFileChange, TQuestionEntry, TPermissionEntry, TToolStat
    │   ├── Inspector.service.ts             # (extender) useSessionDiff/Forms/Inbox/Permissions/Context
    │   ├── Components/
    │   │   ├── InspectorPanel.tsx           # (extender) integra secciones + botón "Ver histórico completo"
    │   │   ├── AnswersSection.tsx           # NUEVO: respuestas + razonamiento (toggle)
    │   │   ├── FileChanges.tsx              # NUEVO: archivos + parche (FR-028..030)
    │   │   ├── QuestionsSection.tsx         # NUEVO: permisos + preguntas + cola (FR-031..034)
    │   │   ├── ToolHistory.tsx              # (extender) mediana por herramienta (FR-036)
    │   │   └── specs/                       # (extender) + specs nuevos
    │   ├── Hooks/
    │   │   └── useInspectorData.ts          # (extender) respuestas, archivos, preguntas, cola, toolStats
    │   └── lib/
    │       ├── medianToolDurations.ts       # NUEVO (puro)
    │       └── specs/medianToolDurations.spec.ts
    │
    └── History/                             # NUEVO dominio
        ├── History.entity.ts                # THistoryEntry (unión), THistoryTarget, TLineageNav
        ├── History.service.ts               # useHistoryMessages (infinite), useSessionInfo
        ├── Components/
        │   ├── HistoryModal.tsx             # overlay a pantalla completa
        │   ├── HistoryHeader.tsx            # identidad, modelo, estado, coste, tokens, resultado, directorio, linaje
        │   ├── HistoryTimeline.tsx          # timeline + sentinel + content-visibility
        │   ├── HistoryEntry.tsx             # render por tipo de entrada
        │   ├── ToolCallEntry.tsx            # expandir input/resultado/error
        │   └── specs/                       # specs de componentes
        ├── Hooks/
        │   ├── useHistory.ts                # NUEVO: objetivo abierto/cerrado + linaje
        │   ├── useHistoryPagination.ts      # NUEVO: infinite query + sentinel
        │   └── specs/
        ├── lib/
        │   ├── buildHistory.ts              # NUEVO (puro): mensajes → THistoryEntry[]
        │   └── specs/buildHistory.spec.ts
        └── index.ts
```

**Structure Decision**: Single project (frontend SPA). Se conserva el scaffolding `entity/lib/Components/Hooks/index` de `AGENTS.md`. El histórico es un dominio propio (`Domains/History`) porque es una vista dedicada con su propia carga de datos; el estado enriquecido y el resumen se quedan en `Domains/Graph` porque son propiedades del grafo; las secciones de detalle (respuestas, archivos, preguntas, herramientas) se quedan en `Domains/Inspector` porque el panel de detalles es su lugar natural. Las piezas compartidas entre dominios (render enriquecido, toggle de razonamiento) viven en `Application` para no romper el encapsulamiento. `WorkspacePage` (Infrastructure) orquesta el overlay, el doble clic y el estado de razonamiento.

## Design Direction — Dark Mode / Flat Design

La dirección visual ya está fijada por la feature 001 (ver `specs/001-agent-viz-observability/plan.md` → Design Direction) y **no cambia**. Las nuevas piezas se integran con las reglas existentes:

- **Estado enriquecido**: se reutilizan los tokens semánticos existentes (`--status-running`, `--status-waiting`, `--status-done`, `--status-error`, `--status-idle`). Reintentando y compactando usan el tono `running`; esperando respuesta y esperando permiso usan `waiting`; interrumpido usa `error` pero con la etiqueta "Interrumpido" y el motivo, nunca confundido con un fallo propio. El rayado diagonal plano de loop se conserva para reintentos (FR-018/019).
- **Histórico**: overlay de superficie `--surface-1` con borde `--border`, cabecera fija y timeline con `font-mono tabular-nums` para horas/duraciones. Cada entrada usa una franja/etiqueta de tipo plana (sin cajas con sombra): usuario, respuesta, razonamiento, herramienta, sistema, skill, compactación, cierre. El razonamiento se atenúa (`--text-muted`) para distinguirse de la respuesta.
- **Respuestas**: el texto enriquecido respeta la tipografía del visor (Inter para prosa, JetBrains Mono para bloques de código); tablas y código con borde 1px, sin gradientes.
- **Resumen de sesión**: tira monoespaciada compacta de métricas en la cabecera del grafo, coherente con la firma de la feature 001; nunca un grid de "número grande + label".
- **Archivos/preguntas/cola**: filas planas etiqueta/valor; el parche usa mono con fondo `--surface-0`; el control de expandir es una fila con chevron, sin caja.

## Complexity Tracking

> No hay violaciones de la constitución. Sección no aplica.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
