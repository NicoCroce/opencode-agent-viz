# Implementation Plan: Rendimiento del visualizador de grafo

**Branch**: `006-graph-render-performance` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-graph-render-performance/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

El cambio de sesión se percibe lento porque, al seleccionar una sesión, `useGraphModel` dispara en paralelo **siete familias de consultas para cada sesión del subárbol** (mensajes —paginados hasta 25×200—, permisos, log durable, señal en vivo, formularios, detalle de formularios e inbox), y además recalcula **todo** el modelo (incluida `deriveMetrics` sobre el contenido completo de cada agente) **en cada tick de 1 s** y **en cada hover/selección** del grafo. Con un subárbol de ~50 agentes eso es trabajo proporcional al volumen total de contenido antes de poder pintar, más un repintado global por interacción.

La feature es de **rendimiento incremental**, sin migrar el render a canvas ni rediseñar la vista (spec, Out of Scope). El enfoque técnico se apoya en cinco palancas, todas dentro de la arquitectura por dominios actual y sin dependencias nuevas:

1. **Modelo por fases (estructura → enriquecimiento)**: separar la construcción *estructural* del grafo (sesiones + estados + agentes, que ya están en caché global) de su *enriquecimiento* (métricas, señales, formularios, permisos) en dos hooks (`useGraphStructure`, `useGraphEnrichment(ids, structure)`). La estructura se pinta de inmediato con `EMPTY_METRICS`; las métricas se completan cuando llegan (FR-010, SC-007). En la fase de estructura solo son **definitivos** los estados derivables de `SessionStatus` (`running`, `retrying`, `created`); `compacting`, `waiting-permission`/`waiting-input` y los terminales (`succeeded`/`failed`/`interrupted`) requieren señales/log, formularios, permisos o `hasActivity` (mensajes) y quedan **provisionales** hasta que el nodo pasa a `enrichment: 'ready'` (ver data-model §2.2 y contrato de carga §1.1).
2. **Carga progresiva, priorizada y cancelable**: el subárbol se carga por lotes ordenados por prioridad (raíz → ancestros del nodo activo → niveles BFS → resto), con cancelación al cambiar de sesión, en vez de lanzar N×7 consultas de golpe (FR-003, FR-004, SC-002, SC-003, SC-008).
3. **Métricas separadas por coste temporal**: extraer de `deriveMetrics` la parte **independiente de `now`** (`deriveMetricBase`) y memoizarla por sesión; el tick de 1 s solo resuelve `durationMs`/`elapsed`. El tick además se **desactiva** en **ambos** consumidores (`useNow` de `useGraphModel` y el `useNow` del resumen de `WorkspacePage`, FR-024 de 003-execution-detail-views) cuando no hay ningún nodo activo (FR-006, SC-005).
4. **Identidad estable de nodos/aristas**: reconciliar el modelo para reutilizar objetos `node`/`data`/`edge` sin cambios; mover el resaltado de hover y linaje a `data`/contexto para que hover y selección **no reconstruyan el array completo** que consume React Flow (FR-005, SC-004).
5. **Instrumentación reproducible**: marcas `performance` puras (`graph.session.open`, `graph.session.revisit`, `graph.interaction`) para capturar línea base antes/después y verificar SC-001..SC-004 (FR-011).

La paridad funcional (FR-007) es la invariante de no-regresión: al terminar la carga progresiva, nodos, aristas, carriles, estados, métricas, linaje, selección, hover, redimensionado e histórico son **idénticos** a la línea base.

## Technical Context

**Language/Version**: TypeScript 5.6 (`strict`) + React 19

**Primary Dependencies**: Vite 8, TanStack Query 5, React Router 7, Tailwind 4 + shadcn/ui (Radix), `@xyflow/react` 12 + `@dagrejs/dagre`, `@opencode/client` 2.0.22, `lucide-react`, `zod`. **No se añaden dependencias** (la instrumentación usa la `Performance API` del navegador).

**Storage**: N/A — todo es estado en memoria (TanStack Query + estado de vista local). Las mejoras se apoyan en el caché de consultas que ya existe (`staleTime: Infinity`); no se persiste nada nuevo.

**Testing**: Vitest 2 + Testing Library + jsdom; specs junto al código en carpetas `specs/` (Principio VIII); fixture de eventos real `src/Domains/Graph/lib/__fixtures__/run.ndjson`; `renderWithProviders` para hooks/componentes; integración `test:live` opcional contra el server real (`VIZ_API_URL`).

**Target Platform**: Navegador moderno de escritorio (Chromium/Firefox/Safari) con presentación responsive en móvil (tabs/overlay), igual que el resto de la app.

**Project Type**: Aplicación web single-page (solo frontend; el backend es el servidor de OpenCode existente).

**Performance Goals**: SC-001 apertura de subárbol ~50 agentes encuadrado ≤ 1.5 s (p90); SC-002 apertura grande ≤ 2× la pequeña (≤ 5 agentes) con caché fría; SC-003 revisita ≤ 300 ms sin recarga; SC-004 interacción (pan/zoom/hover/selección) con ≥ 100 nodos < 100 ms y sin pausas; SC-005 una actualización de 1/100 no degrada la fluidez ni reacomoda; SC-006 100 % de paridad visual; SC-007 UI responsiva (< 100 ms de retraso perceptible) durante la carga; SC-008 sin trabajo de carga repetido ni contenido no mostrado.

**Constraints**: paridad funcional exacta (FR-007); estados de pantalla obligatorios error→carga→vacío→datos (FR-008, Principio VI); frescura de datos en vivo ≤ 1 s sin degradar (FR-009); **sin** migración a canvas/WebGL (spec, Out of Scope); sin cambios en lo que el server expone (Out of Scope); render DOM con `@xyflow/react` (Assumptions); tipos derivados del SDK con prefijo `T` (Principio IV); funciones puras y testeables (Principio V); event batching y sin re-layout por evento (Principio VII).

**Scale/Scope**: subárbol típico de ~50 agentes; techo objetivo **hasta ~200 agentes** con fluidez; mensajes por sesión en el orden de miles (paginados); una sesión raíz activa a la vez; dominios tocados: `Domains/Graph` (núcleo), `Application/Helpers` (instrumentación) e `Infrastructure/WorkspacePage` (solo orquestación); `Domains/Sessions` y `Infrastructure/Services` se reutilizan sin cambios de contrato.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Cumplimiento | Evidencia |
|---|-----------|--------------|-----------|
| I | Observador de solo lectura | ✅ PASS | No se añaden endpoints de escritura; se siguen usando solo lecturas (`session.list`, `message.list`, `session.log`, `permission.list`, `session.form.*`, `session.inbox.list`). La instrumentación es local (`performance`/`console`), no envía nada al server. |
| II | Arquitectura por dominios funcionales | ✅ PASS | Toda la optimización vive en `Domains/Graph` (hooks y libs puras). La instrumentación genérica vive en `Application/Helpers` (pieza compartida). `WorkspacePage` (Infrastructure) solo conecta los hooks; no se importan componentes de otros dominios. |
| III | Datos del servidor SOLO vía TanStack Query | ✅ PASS | El SDK se toca únicamente en `Infrastructure/Services/opencodeClient.ts` (sin cambios de interfaz). La carga progresiva consume `opencodeService` desde hooks del dominio `Graph`; los componentes siguen recibiendo todo por props/hooks. |
| IV | Tipos derivados del SDK | ✅ PASS | Los datos crudos siguen siendo tipos del SDK (`SessionInfo`, `SessionStatus`, `SessionLogItem`, `FormInfo`/`FormDetail`, `PermissionRequest`, `SessionInboxInfo`). Los view-models nuevos (`TMetricBase`, `TEnrichmentState`, `TLoadPlan`, `TGraphPerfMeasure`) son estado de vista con prefijo `T`, no redefiniciones del SDK. |
| V | Lógica pura y testeable | ✅ PASS | `deriveMetricBase()`, `resolveMetrics()`, `orderSubtreeForLoad()`, `reconcileGraphModel()`, `chunkLoadPlan()` y las marcas de `perf` son funciones puras sin React, con specs propias. |
| VI | Estados de pantalla obligatorios | ✅ PASS | Se conserva el orden error→carga→vacío→datos del `graphPane`. La estructura disponible permite sustituir el esqueleto por nodos reales antes; el esqueleto sigue existiendo para el arranque sin estructura. |
| VII | Rendimiento en tiempo real | ✅ PASS | **Es el principio central de la feature**: ambos `useNow` (el del modelo y el del resumen de `WorkspacePage`) se desactivan sin nodos activos; el tick ya no re-deriva métricas sobre todo el contenido; hover/selección no reconstruyen el modelo; los eventos SSE siguen procesándose por lotes en `EventStreamProvider` (sin cambios). |
| VIII | Convenciones de repositorio | ✅ PASS | Specs en `specs/` junto al código; Conventional Commits; ESLint strict; TypeScript strict; sin dependencias nuevas. |

**Resultado inicial**: 8/8 PASS. Sin violaciones. No se requiere *Complexity Tracking*.

**Re-check post-diseño (Phase 1)**: 8/8 PASS sin cambios. Los contratos confirman: solo lecturas y sin migración de render (I); todo el trabajo en `Graph` + helper compartido en `Application` (II); SDK solo en el wrapper (III); tipos `T` de vista y datos crudos del SDK (IV); siete funciones puras cubiertas por specs (V); estados de pantalla explícitos preservados (VI); eliminación de los dos puntos de recómputo global (métricas por tick y modelo por hover/selección) sin tocar el batching de eventos (VII); specs junto al código (VIII). No aparecieron violaciones que justificar.

**Nota fuera de alcance (D1)**: la Constitución (`Principio II`/`IV`) menciona la carpeta `entity/` y el paquete `@opencode-ai/sdk`, mientras el repositorio actual usa `lib/` y `@opencode/client`. Es una deriva **preexistente** ajena a esta feature (la spec no la incluye) y no se corrige en este pase; se deja constancia para no confundirla con las interfaces reales que este plan referencia.

## Project Structure

### Documentation (this feature)

```text
specs/006-graph-render-performance/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (decisiones resueltas)
├── data-model.md        # Phase 1 output (view-models y reglas)
├── quickstart.md        # Phase 1 output (guía de validación + línea base)
├── checklists/
│   └── requirements.md  # Calidad de la especificación (ya existe)
├── contracts/           # Phase 1 output (contratos de render, carga e instrumentación)
│   ├── README.md
│   ├── graph-render-contract.md
│   ├── graph-loading-contract.md
│   └── performance-instrumentation-contract.md
├── spec.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── Application/
│   └── Helpers/
│       ├── perf.ts                          # NUEVO (puro): perfMark/perfMeasure/PERF_METRIC + isEnabled
│       ├── index.ts                         # (extender) exporta perf
│       └── specs/
│           └── perf.spec.ts                 # NUEVO: nombres, payload y no-op sin `performance`
│
├── Infrastructure/
│   └── WorkspacePage.tsx                    # (extender) usa el modelo en dos fases y las marcas de perf
│                                             # (apertura/revisita/interacción); condiciona el `useNow`
│                                             # del resumen (FR-024 de 003-execution-detail-views) a que existan nodos activos; conserva
│                                             # el orden de estados
└── Domains/
    ├── queryKeys.ts                         # (sin cambios de forma) se reutilizan las claves actuales
    │
    └── Graph/
        ├── Graph.entity.ts                  # (extender) TMetricBase, TEnrichmentState, estado de carga por nodo
        ├── lib/
        │   ├── deriveMetrics.ts             # (extender) deriveMetricBase() puro (sin `now`); resolveMetrics()
        │   ├── loadPriority.ts              # NUEVO (puro): orderSubtreeForLoad() + chunkLoadPlan()
        │   ├── reconcileGraph.ts            # NUEVO (puro): reutiliza node/data/edge sin cambios
        │   ├── buildGraph.ts                # (extender) usa TMetricBase y marca `enrichment`
        │   ├── buildViewNodes.ts            # (sin cambios) ya devuelve el `height`; `AgentGraph` lo reutiliza
        │   ├── layoutGraph.ts               # (sin cambios): `topologySignature` sigue siendo la clave de layout
        │   └── specs/
        │       ├── deriveMetrics.spec.ts    # (extender) casos de deriveMetricBase/resolveMetrics
        │       ├── loadPriority.spec.ts     # NUEVO
        │       ├── reconcileGraph.spec.ts   # NUEVO
        │       └── buildGraph.spec.ts       # (extender) enrichment + paridad
        ├── Hooks/
        │   ├── useGraphModel.ts             # (refactor) compone estructura + enriquecimiento; API pública estable
        │   ├── useGraphStructure.ts         # NUEVO: modelo solo-estructura (sesiones+estados+agentes)
        │   ├── useGraphEnrichment.ts        # NUEVO: carga progresiva, priorizada y cancelable
        │   ├── useNow.ts                    # (extender) tick activo solo con nodos en curso
        │   └── specs/
        │       ├── useGraphStructure.spec.tsx  # NUEVO
        │       ├── useGraphEnrichment.spec.tsx # NUEVO
        │       └── useGraphModel.spec.tsx      # NUEVO/extender (paridad y progresividad)
        └── Components/
            ├── AgentGraph.tsx               # (extender) aristas/estables; hover y linaje vía contexto, no rebuild
            ├── AgentNode.tsx                # (extender) lectura de foco/hover desde contexto (sin cambiar el markup visual)
            ├── InvocationEdge.tsx           # (extender) resuelve el resaltado de hover/linaje desde contexto
            ├── NodeFocusContext.tsx         # NUEVO: contexto de foco (selección+linaje) y hover compartido
            └── specs/
                ├── AgentGraph.spec.tsx      # (extender) identidad estable + no rebuild por hover
                └── AgentNode.spec.tsx       # (extender) resaltado por contexto
```

**Structure Decision**: Single project (frontend SPA). Se conserva el scaffolding `entity/lib/Components/Hooks/index` de `AGENTS.md`. La optimización se concentra en `Domains/Graph`, que ya posee el modelo, el layout y el render; la instrumentación es transversal y por eso vive en `Application/Helpers` como pieza compartida (no se duplica por dominio). `Infrastructure/WorkspacePage` solo orquesta (llama a `useGraphModel` y registra las marcas de apertura/revisita) y mantiene intacto el orden de estados de pantalla. No se crean dominios nuevos ni se mueve lógica fuera de su dominio.

## Design Direction — Performance / Incremental

- **Sin cambios visuales** (paridad FR-007): se reutilizan `AgentNode`, `NodeStatusRail`, `ExecutionLanes`, `SessionSummaryBar` y los tokens semánticos existentes. El único estado nuevo visible es el temporal de "detalle aún no disponible" mientras el enriquecimiento corre, que debe leerse como el "no disponible" ya usado por el resto de la app (no un spinner nuevo por nodo).
- **Progresividad silenciosa**: la estructura aparece primero sin animaciones de entrada en cascada; el completado de métricas no debe provocar saltos de layout (las posiciones las manda el carril, no las métricas) ni parpadeo de color.
- **Interacción sin regresión**: hover y selección conservan exactamente la misma respuesta visual (resaltado de linaje y atenuación del resto); la diferencia es interna (identidad estable), no perceptible.

## Complexity Tracking

> No hay violaciones de la constitución. Sección no aplica.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
