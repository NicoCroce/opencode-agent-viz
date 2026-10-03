# Implementation Plan: OpenCode Agent Viz — Observabilidad Multi-Agente

**Branch**: `001-agent-viz-observability` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-agent-viz-observability/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Visor web de solo lectura que consume el stream de eventos de OpenCode y presenta, en tiempo real, la ejecución de un sistema multi-agente: estado de conexión, sesiones raíz, un grafo jerárquico de agentes y subagentes, y un inspector con métricas de observabilidad (duración, tokens/costo, conteo de invocaciones, reintentos/loops y recursos disponibles). La UI es Dark Mode / Flat Design.

El enfoque técnico está fijado por el plan base (`docs/agent-viz-plan.md`): cliente SDK con proxy `/oc`→`127.0.0.1:4096`, una única suscripción SSE en un `EventStreamProvider` que aplica eventos al `queryClient` de TanStack Query en lotes, un grafo derivado por una función pura `buildGraph()` (React Flow + dagre) y datos siempre consumidos vía hooks. Las métricas nuevas se derivan de campos que el SDK ya expone (`AssistantMessage.cost/tokens/time`, `StepFinishPart`, `subtask.agent`, `RetryPart.attempt`, `Session.parentID`, `Agent`, `McpStatus`, `Config.instructions`) sin necesidad de backend propio.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict) + React 19

**Primary Dependencies**: Vite 8, TanStack Query 5, React Router 7, Tailwind 4, `@xyflow/react` 12 + `@dagrejs/dagre`, `@opencode-ai/sdk` ^1.0.0, shadcn/ui (Radix), lucide-react, sonner, zod, framer-motion

**Storage**: N/A — estado en memoria (TanStack Query); sin persistencia de historial en v1

**Testing**: Vitest 2 + Testing Library + jsdom; fixtures de eventos reales (`.ndjson`) en `__fixtures__/`

**Target Platform**: Navegador moderno de escritorio (Chromium/Firefox/Safari) con presentación responsive en móvil

**Project Type**: Aplicación web single-page (solo frontend; el backend es el servidor de OpenCode existente)

**Performance Goals**: subagente nuevo visible en el grafo < 1s; UI fluida con 50 nodos y 1000 partes de herramientas; actualizaciones por lotes con flush ~100ms o `requestAnimationFrame`; sin re-layout del grafo ante cambios de solo-estado

**Constraints**: solo lectura (no se envía prompt, no se aborta, no se responden permisos); un solo proyecto/instancia local; proxy Vite `/oc` sin buffering para SSE; tipos derivados del SDK; sin definir interfaces manuales de datos del servidor

**Scale/Scope**: 1 sesión activa por vez; ~50 nodos; ~1000 eventos de herramienta por ejecución; 4 dominios (Connection, Sessions, Graph, Inspector)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Cumplimiento | Evidencia |
|---|-----------|--------------|-----------|
| I | Observador de solo lectura | ✅ PASS | Sin mutations de control; solo `session.list/status/get/children/messages/todo`, `app.agents`, `mcp.status`, `config.get`, `event.subscribe` |
| II | Arquitectura por dominios funcionales | ✅ PASS | `src/Domains/{Connection,Sessions,Graph,Inspector}/` con entity/service/routes/router/Components/Hooks/Pages/index |
| III | Datos del servidor SOLO vía TanStack Query | ✅ PASS | SDK invocado únicamente en `*.service.ts`; componentes consumen hooks |
| IV | Tipos derivados del SDK (prefijo `T`) | ✅ PASS | `T` tipos re-exportados desde `@opencode-ai/sdk` (Session, Agent, Message, Part, Event, McpStatus, SessionStatus) |
| V | Lógica pura y testeable | ✅ PASS | `buildGraph()`, reducer de eventos y derivación de métricas como funciones puras con tests unitarios y fixtures |
| VI | Estados de pantalla obligatorios | ✅ PASS | `isError` → `EmptyScreenError`; `isLoading` → skeleton; vacío → `EmptyState`/`EmptyScreenFilter`; datos → contenido. Estado de conexión siempre visible |
| VII | Rendimiento en tiempo real | ✅ PASS | Batching de eventos; deltas de texto ignorados; topología y estados desacoplados para evitar relayout |
| VIII | Convenciones de repositorio | ✅ PASS | Tests en `specs/`; commits Conventional Commits; ESLint strict; TypeScript strict |

**Resultado inicial**: 8/8 PASS. Sin violaciones. No se requiere Complexity Tracking.

**Re-check post-diseño (Phase 1)**: 8/8 PASS sin cambios. Los artefactos generados respetan la constitución: los contratos de SDK viven en `*.service.ts` (III), los tipos son derivados del SDK (IV), `buildGraph`/`deriveMetrics`/`eventReducer` son puros (V), los estados de pantalla se declaran en los contratos de UI (VI), el batching y la estabilidad de layout se fijan en `event-stream-contract.md` y `graph-contract.md` (VII). No aparecieron violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/001-agent-viz-observability/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (decisiones resueltas)
├── data-model.md        # Phase 1 output (entidades y tipos derivados)
├── quickstart.md        # Phase 1 output (guía de validación end-to-end)
├── checklists/
│   └── requirements.md  # Calidad de la especificación
├── contracts/           # Phase 1 output (contratos de servicio/eventos/grafo/UI)
│   ├── README.md
│   ├── sdk-service-contract.md
│   ├── event-stream-contract.md
│   ├── graph-contract.md
│   └── metrics-contract.md
├── spec.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── main.tsx                         # QueryClientProvider + EventStreamProvider
├── App.tsx                          # BrowserRouter + Toaster (dark mode por defecto)
├── queryClient.ts                   # (existente) staleTime: Infinity, retry: 0
├── index.css                        # (extender) tokens dark flat + fuentes
│
├── Infrastructure/
│   ├── Routes.tsx                   # (extender) agrega Session/Graph/Inspector routers
│   └── Services/
│       ├── opencodeClient.ts        # createOpencodeClient({ baseUrl: '/oc' }) + wrappers
│       └── specs/
│           └── opencodeClient.spec.ts
│
├── Application/
│   ├── Components/                  # (existente) ui/, Molecules/, Organisms/, Layout/
│   │   └── Molecules/
│   │       ├── Metric.tsx           # NUEVO: número tabular + label + estado "no disponible"
│   │       ├── StatusDot.tsx        # NUEVO: LED de estado (running/idle/waiting/error)
│   │       └── DurationBar.tsx      # NUEVO: barra plana de duración relativa
│   ├── Helpers/
│   │   ├── formatDuration.ts        # NUEVO: ms → "1m 23s"
│   │   ├── formatCost.ts            # NUEVO: costo → "$0.0123"
│   │   ├── formatTokens.ts          # NUEVO: conteo compacto (12.3k)
│   │   └── specs/ (formatDuration.spec.ts, formatCost.spec.ts, formatTokens.spec.ts)
│   └── Hooks/                       # (existente) useDevice, useDebounce, useGlobalStore
│
└── Domains/
    ├── queryKeys.ts                 # NUEVO: keys centralizadas (sessions, agents, mcp, config, metrics)
    │
    ├── Connection/
    │   ├── Connection.entity.ts     # TConnectionState ('connected'|'reconnecting'|'disconnected')
    │   ├── Connection.service.ts    # useGetConnectionState / useSubscribeConnection
    │   ├── Connection.routes.ts
    │   ├── Connection.router.tsx
    │   ├── Components/
    │   │   ├── ConnectionBadge.tsx
    │   │   ├── ConnectionBadgeSkeleton.tsx
    │   │   └── specs/ConnectionBadge.spec.tsx
    │   ├── Hooks/
    │   │   ├── useConnectionStatus.ts
    │   │   └── specs/useConnectionStatus.spec.ts
    │   ├── Pages/ (no aplica pantalla propia; se monta en el shell)
    │   └── index.ts
    │
    ├── Sessions/
    │   ├── Session.entity.ts        # TSession, TSessionStatus, TSessionList
    │   ├── Sessions.service.ts      # useGetSessions, useGetSessionStatus, useGetAgents
    │   ├── Sessions.routes.ts       # SESSIONS_LIST_ROUTE, SESSION_DETAIL_ROUTE
    │   ├── Sessions.router.tsx
    │   ├── Components/
    │   │   ├── SessionList.tsx, SessionCard.tsx, SessionListSkeleton.tsx
    │   │   └── specs/
    │   ├── Hooks/
    │   │   ├── useGetSessions.ts, useSelectSession.ts, useUpsertSessionFromEvent.ts
    │   │   └── specs/
    │   ├── Pages/
    │   │   ├── SessionList.page.tsx
    │   │   └── specs/SessionList.page.spec.tsx
    │   └── index.ts
    │
    ├── Graph/
    │   ├── Graph.entity.ts          # TGraphNode, TGraphEdge, TGraphModel, TNodeStatus
    │   ├── Graph.service.ts         # useGetGraph(sessionId)
    │   ├── Graph.routes.ts
    │   ├── Graph.router.tsx         # GRAPH_VIEW_ROUTE
    │   ├── lib/
    │   │   ├── buildGraph.ts        # NUEVO: función pura (sessions, statuses, agents, metrics) → {nodes, edges}
    │   │   ├── layoutGraph.ts       # dagre top→bottom, posiciones estables
    │   │   ├── deriveMetrics.ts     # NUEVO: duración/costo/tokens/invocaciones/loop desde messages+parts
    │   │   ├── eventReducer.ts      # NUEVO: Event → actualizaciones de queryClient (puro)
    │   │   └── specs/ (buildGraph.spec.ts, layoutGraph.spec.ts, deriveMetrics.spec.ts, eventReducer.spec.ts)
    │   ├── Components/
    │   │   ├── AgentGraph.tsx, AgentNode.tsx, NodeStatusRail.tsx, GraphSkeleton.tsx
    │   │   └── specs/
    │   ├── Hooks/
    │   │   ├── useGraphModel.ts, useFollowMode.ts, useGraphLayout.ts
    │   │   └── specs/
    │   ├── Pages/
    │   │   └── GraphView.page.tsx
    │   └── index.ts
    │
    └── Inspector/
        ├── Inspector.entity.ts      # TNodeDetail, TResourceUsage, TInvocationStats, TSessionSummary
        ├── Inspector.service.ts     # useGetNodeDetail(sessionId), useGetSessionSummary(sessionId)
        ├── Inspector.routes.ts
        ├── Inspector.router.tsx
        ├── Components/
        │   ├── InspectorPanel.tsx, InspectorSkeleton.tsx, MetricsSection.tsx,
        │   ├── ResourceList.tsx, LoopBadge.tsx, ToolHistory.tsx
        │   └── specs/
        ├── Hooks/
        │   ├── useInspectorData.ts, useSessionSummary.ts
        │   └── specs/
        ├── Pages/ (panel; no ruta propia en v1)
        └── index.ts
```

**Structure Decision**: Single project (frontend SPA). Se reutiliza el scaffolding existente (`src/Application`, `src/Infrastructure`, `src/test`) y se implementan los 4 dominios definidos por la constitución (Connection, Sessions, Graph, Inspector) bajo `src/Domains/`, respetando la estructura de carpetas y la separación entity/service/routes/router/Components/Hooks/Pages de `AGENTS.md`.

## Design Direction — Dark Mode / Flat Design

> Basado en las skills `frontend-design` e `interface-design`. El brief fija la dirección (dark, flat); el resto de los ejes se deciden aquí de forma explícita.

**Dominio (mundo del producto)**: árboles de procesos, trazas de ejecución, handoffs entre agentes, llamadas a herramientas, medidores de tokens, reintentos, DAGs de orquestación.

**Mundo de color**: grafito de terminal, LEDs de estado (rojo/ámbar/verde), fósforo ámbar, diagramas de red, trazas de osciloscopio.

**Paleta (4–6 hex nombrados)**:

| Token | Hex | Uso |
|-------|-----|-----|
| `--surface-0` (canvas) | `#0A0C0F` | Fondo de la app y del canvas del grafo |
| `--surface-1` (panel) | `#10141A` | Rails laterales e inspector |
| `--surface-2` (raised) | `#161B22` | Nodos, cards y popovers |
| `--border` | `#232A34` | Bordes 1px (profundidad por borde, no por sombra) |
| `--text` / `--text-muted` | `#E7ECF2` / `#8B96A5` | Jerarquía primaria/secundaria |
| `--accent` | `#F97316` | Identidad OpenCode; acento escaso (~10%) |

**Colores de estado (semánticos, LED plano)**: running `#38BDF8`, waiting/permiso `#F5A524`, done `#3FB950`, error `#F85149`, idle `#6E7681`.

**Tipografía**: par deliberado de dos roles — UI sans (Inter) para texto y etiquetas, y mono (JetBrains Mono) para identificadores de agente, modelo y toda métrica numérica con `tabular-nums`. Escala 1.25 desde base 14px: `caption 11 · body 14 · h4 16 · h3 18 · h2 22 · h1 28`. Jerarquía por peso + color, no solo tamaño.

**Layout**: workspace de tres zonas — rail de sesiones (280px) · canvas del grafo (fluido) · inspector (360px); topbar con estado de conexión, selector de sesión y toggle "seguir". En móvil, la misma lógica en tabs (Sessions | Graph | Inspector), sin duplicar componentes.

```text
┌──────────────────────────────────────────────────────────┐
│ ● conectado   │ sesión activa ▾ │                ▶ seguir  │
├───────────┬──────────────────────────────┬───────────────┤
│ SESIONES  │        GRAFO (dagre)          │  INSPECTOR    │
│  rail     │   ●─┐                          │  agente       │
│  280px    │     ├─●                         │  ─────────    │
│           │     └─●                         │  dur · tok · $│
│           │                                  │  recursos     │
└───────────┴──────────────────────────────┴───────────────┘
```

**Firma (signature)**: el **"rail de ejecución"** — cada nodo lleva una franja plana de 3px en su borde de entrada, coloreada por estado, más una barra fina de duración relativa; debajo del nombre del agente, una tira monoespaciada de métricas (`01:23 · 12.4k tok · $0.03`) que se actualiza en el sitio. Un nodo en loop cambia su franja por un rayado diagonal plano (único para reintentos). Todo ello sin sombras ni gradientes: profundidad solo por cambio de superficie y borde de 1px.

**Default rechazados**: (1) rejilla de cards "número grande + label pequeño" para métricas → tira monoespaciada compacta + rail de sesión; (2) dark violeta/neón "AI SaaS" con glow → grafito + ámbar + LEDs de estado; (3) markers numerados 01/02/03 → solo la topología padre→hijo codifica orden.

## Complexity Tracking

> No hay violaciones de la constitución. Sección no aplica.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
