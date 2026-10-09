# Implementation Plan: Filas paralelas correctas en el grafo en vivo

**Branch**: `007-fix-parallel-lanes-live` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-fix-parallel-lanes-live/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Los subagentes lanzados en paralelo no comparten fila durante la ejecución en vivo, pero sí tras refrescar. La causa es doble y está verificada en el código actual:

1. **El intervalo de solape se cierra cerca de la creación.** El layout agrupa hermanos por el solape de `[createdAt, updatedAt]`, con `updatedAt = session.time.idle ?? session.time.updated` (`graphBuild/toGraphNode.ts`). Los eventos `session.status`/`session.idle`/de actividad parchean `sessions.status()` y `sessions.execution(id)`, pero **nunca** la lista de sesiones (`sessions.list(directory)`); solo `session.created`/`renamed`/… la invalidan. En vivo, `updatedAt` queda congelado cerca de la creación, así que dos hermanos creados con segundos de diferencia producen intervalos puntuales que no solapan → filas distintas. Al refrescar, la lista trae `time.updated`/`time.idle` reales y los intervalos solapan → misma fila.
2. **El intervalo no distingue "activo" de "terminado".** Aun con la marca fresca, una sesión activa se trata como intervalo cerrado; el `now` de la fase estructural (`useState(() => Date.now())` en `useGraphStructure`) queda congelado al montar y solo actúa como fallback de un fin ausente. Además, la lógica de intervalos está duplicada: `parallelism.ts` tiene su propio `intervalOf` (fallback de inicio `now`) divergente de `execution/nodeInterval.ts` (fallback `0`), lo que puede hacer que el badge de paralelismo y las filas no coincidan (FR-010).

El arreglo es **mixto**, tal como cerró `clarify`, y no añade red ni dependencias:

- **Frescura de la marca de actividad** (FR-009): un mapa global `queryKeys.sessions.activity()` (`Record<sessionID, number>`), parcheado con `event.created` de cada evento de sesión por `applyReducedEvent` (aprovechando el batching de `EventStreamProvider`, **sin red adicional**). `updatedAt` pasa a ser `max(time.idle ?? time.updated, activity[id])`.
- **Intervalo abierto para estados activos explícitos** (FR-002, FR-011): el solape trata a los nodos con `isActiveStatus` (`running`/`retrying`/`compacting`/esperas) como intervalo abierto hasta el presente. Para el agrupamiento esto se modela como cota superior no acotada (`+∞`), que es equivalente a evaluar en cualquier `now ≥ max(inicio)` y **elimina la dependencia del reloj en el agrupamiento** (función pura, Principio V). Los nodos terminados usan su fin real de actividad.
- **Recálculo por clave de ejecución** (FR-003): el plan de filas/columnas y el paralelismo se memoizan sobre `deriveExecutionKey(model) = topología + clase de intervalo por nodo` (abierto vs. `[inicio, fin]`), de modo que se recalcula cuando cambia el conjunto en curso o los bordes de los intervalos, y **no** por tick ni por eventos no estructurales (FR-007, Principio VII).
- **Una sola lógica de intervalos** (FR-010): `parallelism.ts` deja de duplicar `intervalOf` y usa `execution/nodeInterval.ts`; filas y badge derivan de los mismos grupos.

El plan autoritativo se deriva **del modelo enriquecido** (`useGraphModel`, estados finales que incluyen `compacting`/esperas), conservando el plan estructural de `useGraphStructure` como primera pintura. La paridad en vivo vs. refresco (FR-004/SC-002/SC-005) queda garantizada porque, con el mapa de actividad, los nodos terminados conservan el mismo fin real que reporta el servidor al reabrir.

## Technical Context

**Language/Version**: TypeScript 5.6 (`strict`) + React 19

**Primary Dependencies**: Vite 8, TanStack Query 5, React Router 7, Tailwind 4 + shadcn/ui (Radix), `@xyflow/react` 12 + `@dagrejs/dagre`, `@opencode/client` 2.0.22. **No se añaden dependencias.**

**Storage**: N/A — estado en memoria (TanStack Query + estado de vista local). Se **añade una clave de caché** (`queryKeys.sessions.activity()`), hermana de la ya existente `queryKeys.sessions.status()`; no se persiste nada nuevo ni se cambia `staleTime: Infinity`.

**Testing**: Vitest 2 + Testing Library + jsdom; specs junto al código en carpetas `specs/` (Principio VIII); fixtures existentes (`lib/specs/fixtures.ts`, `__fixtures__/run.ndjson`); `renderWithProviders` / `QueryClientProvider` para hooks; integración `test:live` opcional (`VIZ_API_URL`).

**Target Platform**: Navegador moderno de escritorio (Chromium/Firefox/Safari) con presentación responsive en móvil, igual que el resto de la app.

**Project Type**: Aplicación web single-page (solo frontend; el backend es el servidor de OpenCode existente, de solo lectura, Principio I).

**Performance Goals**: FR-007/SC-004 — el agrupamiento y las posiciones **no** se recalculan por tick de 1 s ni por eventos de contenido/estado no estructurales; solo cuando cambia la clave de ejecución (topología + clase de intervalo). FR-009 — frescura de la marca de actividad ≤ 1 s con el mismo batching existente. Sin regresión de los objetivos de rendimiento de 006 (carga progresiva, tick O(nodos), identidad estable).

**Constraints**: paridad en vivo vs. refresco exacta (FR-004, SC-002, SC-005); solo lectura (Principio I); funciones puras y testeables, sin reloj implícito en el agrupamiento (Principio V); sin red adicional (clarify); mismas convenciones de tipos `T` derivados del SDK (Principio IV); sin cambiar el contrato del SDK ni `EventStreamProvider`.

**Scale/Scope**: subárboles típicos de ~50 agentes, techo objetivo ~200; dominio tocado: `Domains/Graph` (núcleo: intervalos, layout, reducer, hooks) + `Domains/queryKeys.ts` (clave nueva) + `Infrastructure/lib/applyReducedEvent.ts` (aplicar la marca de actividad) + `Infrastructure/Hooks/useActiveSessionsSeed.ts` (siembra opcional). Sin cambios de UI visual: solo se corrige la ubicación en filas y la coherencia del badge ya existentes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Cumplimiento | Evidencia |
|---|-----------|--------------|-----------|
| I | Observador de solo lectura | ✅ PASS | No se añaden endpoints ni escrituras; se siguen usando solo lecturas. La marca de actividad es estado de caché local derivado de eventos SSE del propio stream (sin peticiones nuevas). |
| II | Arquitectura por dominios funcionales | ✅ PASS | El núcleo vive en `Domains/Graph` (`lib/execution`, `lib/eventReduce`, `Hooks`). La ejecución del parche de actividad se engancha en `Infrastructure/lib/applyReducedEvent` (orquestación ya existente); `useActiveSessionsSeed` es un ajuste opcional. No se crean dominios nuevos ni se importan componentes de otros dominios desde componentes. |
| III | Datos del servidor SOLO vía TanStack Query | ✅ PASS | La lista de sesiones se sigue leyendo por `useGetSessions`; la nueva clave `sessions.activity()` se lee con `getQueryData`/`useQuery` desde hooks del dominio `Graph`, nunca desde componentes. El SDK no se toca en componentes ni en el layout. |
| IV | Tipos derivados del SDK | ✅ PASS | Se siguen usando `SessionInfo`, `SessionStatus` y los eventos del SDK (`V2Event`). El único tipo nuevo (`TActivityMap = Record<string, number>`) es estado de vista con prefijo `T`, no una redefinición del SDK. |
| V | Lógica pura y testeable | ✅ PASS | `endOf`/`executionInterval` (intervalo abierto), `deriveExecutionKey`, `deriveExecutionLayout`, `reduceActivity` y `setActivity` son funciones puras sin React y **sin reloj implícito** en el agrupamiento; con specs propias. |
| VI | Estados de pantalla obligatorios | ✅ PASS | No cambia el orden error→carga→vacío→datos de `GraphPane`; el arreglo es de disposición/intervalos, no de estados de pantalla. |
| VII | Rendimiento en tiempo real | ✅ PASS | El agrupamiento deja de depender del reloj y solo se recalcula con la clave de ejecución; no hay re-layout por tick ni por eventos no estructurales. La marca de actividad se procesa por lotes con el batching existente (FR-009 ≤ 1 s). |
| VIII | Convenciones de repositorio | ✅ PASS | Specs en `specs/` junto al código; Conventional Commits; ESLint/TypeScript strict; sin dependencias nuevas. |

**Resultado inicial**: 8/8 PASS. Sin violaciones. No se requiere *Complexity Tracking*.

**Re-check post-diseño (Phase 1)**: 8/8 PASS sin cambios. Los contratos confirman: solo lecturas (I); todo el trabajo en `Graph` + `queryKeys` + la orquestación de aplicación existente (II); SDK solo en el wrapper y datos vía hooks (III); datos crudos del SDK y un único tipo de vista `T` (IV); cinco funciones puras sin reloj implícito cubiertas por specs (V); estados de pantalla intactos (VI); agrupamiento desacoplado del reloj y sin re-layout por evento (VII); specs junto al código (VIII).

**Nota fuera de alcance (D1)**: igual que en 006, la Constitución (Principios II/IV) menciona la carpeta `entity/` y el paquete `@opencode-ai/sdk`, mientras el repositorio usa `lib/` y `@opencode/client`. Deriva **preexistente** y ajena a esta feature; no se corrige aquí (la spec no la incluye).

## Project Structure

### Documentation (this feature)

```text
specs/007-fix-parallel-lanes-live/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (decisiones resueltas)
├── data-model.md        # Phase 1 output (entidades de vista y reglas)
├── quickstart.md        # Phase 1 output (guía de validación)
├── checklists/
│   └── requirements.md  # Calidad de la especificación (ya existe)
├── contracts/           # Phase 1 output
│   ├── README.md
│   ├── execution-lanes-contract.md
│   └── session-activity-contract.md
├── spec.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── Domains/
│   ├── queryKeys.ts                          # (extender) sessions.activity()
│   └── Graph/
│       ├── Graph.entity.ts                   # (extender) TActivityMap
│       ├── lib/
│       │   ├── execution/
│       │   │   ├── nodeInterval.ts           # (extender) intervalo abierto (startOf/endOf/executionInterval)
│       │   │   ├── executionKey.ts           # NUEVO (puro) deriveExecutionKey(model)
│       │   │   └── deriveExecutionLayout.ts  # NUEVO (puro) plan + posiciones + grupos + paralelismo
│       │   ├── parallelism.ts                # (refactor) usa el intervalo compartido; sin intervalOf duplicado
│       │   ├── buildGraph.ts                 # (extender) entrada activity?
│       │   ├── buildStructuralModel.ts       # (extender) propaga activity
│       │   ├── graphBuild/toGraphNode.ts     # (extender) updatedAt = max(lista, actividad)
│       │   ├── eventReduce/
│       │   │   ├── cache.ts                  # (extender) setActivity
│       │   │   ├── activity.ts               # NUEVO (puro) reduceActivity(event)
│       │   │   └── eventReducer.ts           # (extender) reexporta reduceActivity
│       │   └── specs/
│       │       ├── nodeInterval.spec.ts      # (extender) intervalo abierto / terminado
│       │       ├── parallelism.spec.ts       # (extender) hermandad activa y paridad badge/filas
│       │       ├── executionLevels.spec.ts   # (extender) secuenciales en niveles distintos
│       │       ├── buildGraph.spec.ts        # (extender) updatedAt = max(lista, actividad)
│       │       ├── executionKey.spec.ts      # NUEVO
│       │       ├── deriveExecutionLayout.spec.ts  # NUEVO
│       │       └── eventReducer.spec.ts      # (extender) reduceActivity por tipo de evento
│       └── Hooks/
│           ├── useGraphStructure.ts          # (extender) lee activity; plan por executionKey
│           ├── useGraphModel.ts              # (extender) plan autoritativo desde enriched + now vivo
│           └── specs/
│               ├── useGraphStructure.spec.tsx  # (extender) actividad/frescura del plan estructural
│               └── useGraphModel.spec.tsx      # (extender) filas paralelas en vivo (L10/L11)
└── Infrastructure/
    ├── lib/
    │   └── applyReducedEvent.ts              # (extender) aplica reduceActivity antes del reducer
    ├── specs/
    │   └── applyReducedEvent.spec.ts         # NUEVO (actividad aplicada sin red)
    └── Hooks/
        └── useActiveSessionsSeed.ts          # (opcional) siembra la marca de actividad de las activas
```

**Structure Decision**: Single project (frontend SPA). Se conserva el scaffolding `entity/lib/Components/Hooks/index` de `AGENTS.md`. El arreglo se concentra en `Domains/Graph`, que ya posee el layout (`lib/execution`), la deduplicación de intervalos (`lib/parallelism`) y el reducer de eventos (`lib/eventReduce`). La marca de actividad se **ejecuta** desde la orquestación de aplicación ya existente (`applyReducedEvent`), sin introducir un dominio nuevo ni mover lógica fuera de su dominio. No hay cambios de UI visual ni de contratos del SDK.

## Design Direction — Disposición / tiempo real

- **Sin cambios visuales**: se reutilizan `AgentNodeHeader` (`∥n`), `ExecutionLanes`, `GutterNode` y los tokens existentes. Lo único que cambia es *en qué fila* cae cada nodo durante el vivo y la coherencia del badge con esa fila.
- **Estabilidad antes que exactitud sub-segundo**: el agrupamiento es deliberadamente **independiente del reloj** para que los nodos no salten de fila mientras corren (FR-007/SC-004). El reloj vivo sigue alimentando `durationMs` (006) y las ventanas de tiempo mostradas.
- **Paridad como invariante**: la disposición en vivo y la reconstruida al reabrir deben ser idénticas (SC-002/SC-005); la marca de actividad es la que iguala ambas fuentes de tiempo.

## Complexity Tracking

> No hay violaciones de la constitución. Sección no aplica.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
