# Implementation Plan: Context Composition, Parallel Speedup & Latency Insights

**Branch**: `010-context-metrics-insights` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-context-metrics-insights/spec.md`

**Note**: Plantilla de `/speckit.plan`; su definición describe el flujo de ejecución.

## Summary

Una sola feature con **cinco mejoras analíticas** sobre el visor de solo lectura, todas en el cliente y sin dependencias nuevas:

1. **Composición del contexto** (US1): derivación **pura** `deriveContextBreakdown(messages)` que clasifica el contenido en `toolResult`, `toolInput`, `reasoning`, `assistantText` y `userText`, y **reparte los tokens reales de la ventana** proporcionalmente al peso de caracteres (R2). Los porcentajes suman 100% (SC-002). Se muestra como barra apilada con leyenda y valores.
2. **Aceleración por paralelismo** (US2): por grupo de `deriveParallelGroups`, `speedup = serialMs / wallMs` y `efficiency = speedup / size`; global de sesión con la **unión** de intervalos (R4). Se muestra como badge `×N` en el nodo, desglose en el detalle y métrica global en la barra de resumen.
3. **Contexto in/out e impacto en el padre** (US3): el nodo expone `in → out`; el aporte al padre se mide localizando el tool de spawn (`subagent`/`task` con `metadata.sessionID`, R5) en los mensajes del padre, calculado **bajo demanda** en el hook del Inspector.
4. **Cobertura de métricas de contexto en el detalle** (US4): nueva sección **Contexto** con ventana, caché y tasa de acierto, composición, evolución, salida, compactaciones, aporte al padre y coste por 1k tokens.
5. **Velocidad de respuesta y anomalías** (US5): serie de TTFT y latencia total por respuesta; referencia = **mediana histórica del nodo** (del agente como respaldo), umbral **±40% configurable** (R7), alerta **bidireccional** (lentitud y rapidez anómala).

El enfoque evita las trampas de recon: **los campos nuevos del nodo entran en `sameNodeData`** (AGENTS §11); la composición y la latencia se derivan en el **enriquecimiento** (R3), memoizables por identidad de `messages`, no en el render; el aporte al padre no viaja en el modelo del grafo; la barra apilada y las marcas llevan **texto además de color** (a11y). No se añaden dependencias ni red.

## Technical Context

**Language/Version**: TypeScript 5.6 (`strict`) + React 19

**Primary Dependencies**: Vite 8, TanStack Query 5, React Router 7, Tailwind 4 + shadcn/ui (Radix), `@xyflow/react` 12 + `@dagrejs/dagre`, `lucide-react`, `@opencode/client`. **No se añaden dependencias.**

**Storage**: estado de vista en memoria (TanStack Query + estado local). En `localStorage`, **un solo** valor nuevo: el umbral de anomalía (FR-022, patrón de `useInspectorPanel`). Nada se envía al servidor (Principio I).

**Testing**: Vitest 2 + Testing Library + jsdom; specs junto al código en carpetas `specs/` (Principio VIII); fixtures existentes (`lib/specs/fixtures.ts`, `__fixtures__/run*.ndjson`); `renderWithProviders` para hooks. Tests de lógica pura para composición, ventana/caché, aporte al padre, speedup, latencia, umbral y comparadores.

**Target Platform**: navegador moderno de escritorio con presentación responsive en móvil, igual que el resto de la app.

**Project Type**: aplicación web single-page (solo frontend; el backend es el servidor de OpenCode, de solo lectura, Principio I).

**Performance Goals**: con subárboles de ~50–150 nodos, las nuevas derivaciones **no deben ser perceptibles**: composición y latencia son O(mensajes) y se calculan **una vez por lote de enriquecimiento**, memoizadas por identidad de `messages`; el speedup es O(n) por tick con identidad de nodo estable; el tick no relayouta (memo por `deriveExecutionKey` intacto). SC-001 — lectura de composición en < 10 s. SC-005 — panel completo sin cambiar de vista.

**Constraints**: solo lectura (Principio I); SDK **solo** desde `*.service.ts` (Principio III); lógica en hooks/funciones puras, **no** en componentes (AGENTS §4); tipos `T` (Principio IV); orden de estados error→carga→vacío→datos (Principio VI); tokens en vez de hex y `<Container>` en vez de `div` flex (AGENTS §8); todo control nuevo accesible por teclado; **un campo nuevo del nodo es invisible si no se actualiza `sameNodeData`**.

**Scale/Scope**: dominios tocados: `Domains/Graph` (nuevas métricas puras, entidades, enriquecimiento, comparadores, footer del nodo, barra de resumen), `Domains/Inspector` (secciones y hook del panel de contexto), `Application` (formateadores si faltan). Sin cambios de backend, de contrato del SDK ni del stream SSE.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Cumplimiento | Evidencia |
|---|-----------|--------------|-----------|
| I | Observador de solo lectura | ✅ PASS | Todas las métricas se **derivan** de datos ya consumidos; no se envía nada al servidor. El umbral vive en `localStorage`. |
| II | Arquitectura por dominios funcionales | ✅ PASS | Métricas puras en `Graph/lib/metrics`; entidades del nodo en `Graph.entity.ts`; secciones y hook en `Inspector`. Sin dominios nuevos ni imports cruzados desde componentes. |
| III | Datos del servidor SOLO vía TanStack Query | ✅ PASS | No se añade ninguna llamada al SDK; el aporte al padre reutiliza `useSessionMessages` (ya existente en `Inspector.service.ts`). |
| IV | Tipos derivados del SDK | ✅ PASS | Los tipos nuevos (`TContextBreakdown`, `TGroupSpeedup`, `TLatencySample`, …) son **tipos de vista** con prefijo `T`; no se redefine ningún tipo del SDK. |
| V | Lógica pura y testeable | ✅ PASS | Puras: `deriveContextBreakdown`, `deriveContextWindow`, `deriveParentImpact`, `deriveGroupSpeedup`, `deriveSessionSpeedup`, `deriveLatency`, `detectAnomalies`, `clampThreshold` y los comparadores. |
| VI | Estados de pantalla obligatorios | ✅ PASS | La sección de contexto y cada apartado representan error→carga→vacío→datos (FR-017). |
| VII | Rendimiento en tiempo real | ✅ PASS | Composición/latencia O(mensajes) memoizadas por identidad en el enriquecimiento; speedup O(n) con identidad estable; sin re-layout por tick. |
| VIII | Convenciones de repositorio | ✅ PASS | Specs en `specs/`; Conventional Commits; ESLint/TS strict; sin dependencias nuevas; tokens en vez de hex. |

**Resultado inicial**: 8/8 PASS. Sin violaciones. No se requiere *Complexity Tracking*.

**Re-check post-diseño (Phase 1)**: 8/8 PASS. Los contratos confirman: solo lecturas (I); cada artefacto en su dominio (II); sin SDK nuevo (III); tipos `T` de vista (IV); derivaciones puras cubiertas por specs (V); mismos estados (VI); derivaciones O(mensajes) memoizadas y speedup O(n) (VII); specs junto al código (VIII). Salvaguardas explícitas del recon: incluir `context`/`speedup` en `sameNodeData` y no añadir filas a `cardHeight`.

## Project Structure

### Documentation (this feature)

```text
specs/010-context-metrics-insights/
├── plan.md              # Este archivo (/speckit.plan)
├── research.md          # Phase 0 (decisiones resueltas)
├── data-model.md        # Phase 1 (entidades de vista y reglas)
├── quickstart.md        # Phase 1 (guía de validación)
├── checklists/
│   └── requirements.md  # Calidad de la especificación
├── contracts/           # Phase 1
│   ├── README.md
│   ├── context-metrics-contract.md
│   ├── parallel-speedup-contract.md
│   ├── latency-anomaly-contract.md
│   └── context-panel-contract.md
├── spec.md
└── tasks.md             # Phase 2 (/speckit.tasks - NO creado aquí)
```

### Source Code (repository root)

```text
src/
├── Application/
│   └── Helpers/
│       ├── totalTokens.ts                      # (reutilizar)
│       └── format/                             # (reutilizar/extender) formato de porcentaje, ratio, ms
│
├── Domains/
│   ├── Graph/
│   │   ├── Graph.entity.ts                     # (extender) TNodeContextMetrics, TGroupSpeedup, TNodeSpeedup,
│   │   │                                       #   TLatencySample/-Report/-Anomaly, campos context?/speedup?
│   │   ├── lib/
│   │   │   ├── metrics/
│   │   │   │   ├── contextBreakdown.ts         # NUEVO (puro) composición + ventana de tokens
│   │   │   │   ├── windowStats.ts              # NUEVO (puro) caché, hitRate, costPerKToken
│   │   │   │   ├── parentImpact.ts             # NUEVO (puro) aporte al padre
│   │   │   │   ├── latency.ts                  # NUEVO (puro) muestras, mediana, anomalías
│   │   │   │   ├── anomalyThreshold.ts         # NUEVO umbral por defecto + clamp + persistencia
│   │   │   │   ├── speedup.ts                  # NUEVO (puro) por grupo + global de sesión
│   │   │   │   └── summarizeSession.ts         # (extender) sessionSpeedup en TSessionSummary
│   │   │   ├── enrichNodeData.ts               # (extender) deriva context (breakdown+window+latency)
│   │   │   └── reconcile/comparators.ts        # (extender) sameContext, sameSpeedup, sameNodeData
│   │   ├── Components/
│   │   │   ├── AgentNodeFooter.tsx             # (extender) línea in/out
│   │   │   ├── AgentNodeSpeedupBadge.tsx       # NUEVO badge ×N + provisional
│   │   │   ├── AgentNodeLatencyMark.tsx        # NUEVO marca textual de anomalía
│   │   │   ├── AgentNode.tsx                   # (extender) cablea context/speedup
│   │   │   ├── SessionSummaryBar.tsx           # (extender) métrica global de paralelismo
│   │   │   └── index.ts                        # (extender) barrel
│   │   ├── Hooks/
│   │   │   └── useGraphModel.ts                # (extender) speedup por nodo en el memo final
│   │   └── lib/specs/
│   │       ├── contextBreakdown.spec.ts        # NUEVO
│   │       ├── windowStats.spec.ts             # NUEVO
│   │       ├── parentImpact.spec.ts            # NUEVO
│   │       ├── latency.spec.ts                 # NUEVO
│   │       ├── anomalyThreshold.spec.ts        # NUEVO
│   │       ├── speedup.spec.ts                 # NUEVO
│   │       ├── reconcileGraph.spec.ts          # (extender) sameContext/sameSpeedup
│   │       └── summarizeSession.spec.ts        # (extender) sessionSpeedup (si existe; si no, nuevo)
│   │
│   └── Inspector/
│       ├── Components/
│       │   ├── ContextSection.tsx              # NUEVO bloque completo de contexto
│       │   ├── ContextCompositionBar.tsx       # NUEVO barra apilada + leyenda
│       │   ├── ParallelismSection.tsx          # NUEVO desglose del grupo
│       │   ├── LatencySection.tsx              # NUEVO serie + anomalías
│       │   ├── ContextSectionSkeleton.tsx      # NUEVO skeleton del dominio
│       │   ├── InspectorPanel.tsx              # (extender) inserta las secciones
│       │   └── specs/                          # NUEVO/extender specs de las secciones
│       ├── Hooks/
│       │   ├── useContextMetrics.ts            # NUEVO orquestador (nodo + padre)
│       │   └── specs/useContextMetrics.spec.tsx# NUEVO
│       └── index.ts                            # (extender) barrel
│
└── Infrastructure/
    └── (sin cambios)                           # el wiring del panel ya vive en WorkspacePage
```

**Structure Decision**: single project (frontend SPA). Se conserva el scaffolding `entity/lib/Components/Hooks/index` de `AGENTS.md`. La feature se reparte por responsabilidad: (a) **Graph** posee el modelo del nodo y todas las derivaciones puras, porque es donde ya viven `deriveMetricBase`, `parallelism.ts` y el comparador de reconciliación; (b) **Inspector** posee el panel de detalle y el hook que orquesta la lectura (incluido el aporte al padre, que necesita los mensajes del padre); (c) **Application** solo aporta formateadores. No se crean dominios ni se mueve lógica fuera de su dominio. El estado de UI (umbral de anomalía) se cablea en el hook del Inspector.

## Design Direction (incorporada)

- **El color codifica estado; la cantidad codifica esfuerzo** (008). Los nuevos elementos respetan la paleta existente y no introducen un tercer acento: la composición usa una escala neutra/`--primary` contenida; la anomalía usa `--status-error` (lenta) y `--status-waiting`/`--status-running` (rápida) **con etiqueta textual**.
- **Cifras en mono tabular** (`font-mono tabular-nums`) para porcentajes, ratios, ms y factores `×N`, coherente con el footer y la barra de resumen.
- **Contención**: el nodo gana como máximo una marca discreta (badge `×N`) y una línea de in/out; el detalle concentra el análisis. No se añaden filas nuevas al card si se puede reutilizar una existente.
- **Composición**: barra apilada horizontal fina + leyenda textual; segmentos sin borde, separados por el fondo del card; orden por peso descendente.

## Complexity Tracking

> No hay violaciones de la constitución. Sección no aplica.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
