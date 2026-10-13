# Implementation Plan: Descomposición de la vista de workspace y del enriquecimiento del grafo

**Branch**: `012-refactor-workspace-enrichment` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-refactor-workspace-enrichment/spec.md`

## Summary

Refactor **estrictamente interno** de dos archivos (`src/Infrastructure/WorkspacePage.tsx`, 500 líneas;
`src/Domains/Graph/Hooks/useGraphEnrichment.ts`, 255 líneas) para separar vista de lógica:
(a) la página queda como composición de hooks, con la lógica cross-domain/`Escape`/derivaciones en
`src/Infrastructure/Hooks/`, los cálculos puros en `src/Infrastructure/lib/` y los cinco slots de vista
en un componente presentacional en `src/Infrastructure/Components/`;
(b) el hook de enriquecimiento delega las piezas puras (nodos listos desde caché, medianas por agente,
fusión de nodos) en `src/Domains/Graph/lib/` con specs propios, conservando lotes por idle,
cancelación por cambio de plan y "lo vivo gana sobre la siembra".

Los cinco bloques de vista de la página se trasladan a la composición de **un único** componente
`WorkspaceView.tsx` (decisión del usuario, opción A): los cinco componentes de dominio implicados
(`SessionsRail`, `GraphPane`, `InspectorPane`, `ChatPanel`, `HistoryOverlay`) ya existen y **no** se
envuelven con wrappers.

Contrato público, rutas, `queryKeys`, `data-testid` y comportamiento observable **congelados** (FR-001/FR-002).
Las cuatro suites de regresión protegidas no se editan (FR-021).

## Technical Context

**Language/Version**: TypeScript 5.x strict (React 19, Vite 8)

**Primary Dependencies**: React 19, TanStack Query 5 (`useQuery`/`useQueryClient`/`QueryClient`),
React Router 7, `@opencode/client` 2.0.22 (tipos `T*`), Zustand, Vitest + Testing Library (jsdom)

**Storage**: N/A (caché de TanStack Query; ninguna persistencia nueva)

**Testing**: Vitest + Testing Library; specs en carpetas `specs/` junto al código (Principio VIII)

**Target Platform**: SPA en navegador (escritorio y móvil, una sola fuente de lógica)

**Project Type**: single project (frontend React/Vite, sin backend propio)

**Performance Goals**: mantener SC-006/VII — sin re-render del grafo por tick; un lote de carga por
turno de idle; memoización por identidad de entradas (FR-016/FR-019)

**Constraints**: ≤150 líneas por archivo nuevo (plan priorizado); sin nuevas consultas en las piezas puras;
sin cambios de copy, rutas, `data-testid`, `queryKeys` ni firmas exportadas; solo frontend + tests (FR-004)

**Scale/Scope**: 2 archivos objetivo + ~12 archivos nuevos pequeños (hooks/lib/componentes + specs);
0 cambios de contrato

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Puerto | Evaluación |
|---|---|---|
| I. Observador con modo interactivo | No se toca escritura/SDK; el chat se conserva igual | PASS |
| II. Arquitectura por dominios | Lo cross-domain permanece en Infrastructure (hook), no en componentes de dominio; no se importa un dominio desde un componente de otro dominio | PASS |
| III. Datos solo vía TanStack Query | Las lecturas nuevas (`pending`) siguen por `useQuery` sobre claves de caché; SDK solo en `*.service.ts` (sin cambios) | PASS |
| IV. Tipos del SDK | Se reutilizan `PermissionRequest`/`FormInfo`/`FormDetail` de `@opencode/client`; nada redefinido | PASS |
| V. Lógica pura y testeable | `collectReadyIds`, medianas por agente, fusión de nodos y helpers de atención salen a `lib/` con specs propios | PASS |
| VI. Estados de pantalla | Sin cambios; los componentes extraídos reciben las mismas props y renderizan los mismos estados | PASS |
| VII. Rendimiento en tiempo real | Lotes por idle, cancelación por cambio de plan y `useMemo` por identidad se preservan literalmente | PASS |
| VIII. Convenciones de repositorio | Specs en `specs/`, TS/ESLint strict, Conventional Commits | PASS |

**Gate Phase 0**: PASS (sin violaciones; `Complexity Tracking` queda vacío).
**Gate Phase 1 (post-diseño)**: PASS — ningún artefacto de diseño introduce estado nuevo, consulta nueva
ni cambio de contrato; ver §"Re-evaluación post-diseño" en [research.md](./research.md).

## Project Structure

### Documentation (this feature)

```text
specs/012-refactor-workspace-enrichment/
├── plan.md              # Este archivo
├── spec.md              # Spec (no se modifica)
├── research.md          # Phase 0: decisiones y alternativas
├── data-model.md        # Phase 1: entidades, campos, transiciones
├── quickstart.md        # Phase 1: guía de validación ejecutable
├── contracts/
│   ├── workspace-public-contract.md    # Superficie congelada (regresión)
│   └── enrichment-pure-api.md          # Firmas de las piezas puras nuevas
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit.tasks — NO lo crea este comando)
```

### Source Code (repository root)

```text
src/
├── Infrastructure/
│   ├── WorkspacePage.tsx                       # MODIFICADO: 500 → ~110 líneas (solo composición)
│   ├── WorkspacePage.constants.ts              # (sin cambios; fuente de constantes)
│   ├── Components/
│   │   ├── WorkspaceView.tsx                   # NUEVO: compone los 5 slots + layout + provider
│   │   ├── SessionsRail.tsx                    # (ya existe: bloque "rail"; NO se envuelve)
│   │   ├── GraphPane.tsx                       # (ya existe: bloque "panel de grafo"; NO se envuelve)
│   │   ├── InspectorPane.tsx                   # (ya existe: bloque "panel de inspector"; NO se envuelve)
│   │   ├── HistoryOverlay.tsx                  # (ya existe: bloque "overlay de histórico"; NO se envuelve)
│   │   └── specs/WorkspaceView.spec.tsx        # NUEVO
│   ├── Hooks/
│   │   ├── useChatPending.ts                   # NUEVO (FR-006): bandeja de pendientes cross-domain
│   │   ├── useAttentionNodeIds.ts              # NUEVO (FR-007): realce por nodo
│   │   ├── useAttentionByRoot.ts               # NUEVO (FR-007): badge por raíz
│   │   ├── useChatSelectionSeed.ts             # NUEVO (FR-008): semilla del nodo abierto
│   │   ├── useWorkspaceEscape.ts               # NUEVO (FR-009): precedencia de Escape
│   │   ├── useHistoryData.ts                   # NUEVO (FR-010): nodo/linaje/id + forms + contexto
│   │   ├── useHistoryOverlay.ts                # (ya existe; se consume desde useHistoryData)
│   │   ├── useSessionOpenPerf.ts               # (ya existe; FR-010 métricas de apertura)
│   │   └── specs/{useChatPending,useAttentionNodeIds,useAttentionByRoot,useChatSelectionSeed,useWorkspaceEscape,useHistoryData}.spec.tsx
│   ├── lib/
│   │   ├── countAttentionByRoot.ts             # MOVIDO desde WorkspacePage (puro)
│   │   ├── toPendingQuestionEntry.ts           # MOVIDO/extraído (puro)
│   │   ├── isFocusWithinChat.ts                # MOVIDO (puro + selector de testid)
│   │   └── specs/{countAttentionByRoot,toPendingQuestionEntry,isFocusWithinChat}.spec.ts
│   └── specs/
│       ├── WorkspacePage.spec.tsx              # PROTEGIDO — no se edita
│       └── WorkspacePage.perf.spec.tsx         # PROTEGIDO — no se edita
└── Domains/Graph/
    ├── Hooks/
    │   ├── useGraphEnrichment.ts               # MODIFICADO: 255 → ~130 líneas
    │   └── specs/{useGraphEnrichment,useGraphEnrichment.freshness}.spec.tsx  # PROTEGIDOS — no se editan
    └── lib/
        ├── readyNodeIds.ts                     # NUEVO (FR-011): nodos listos desde caché
        ├── agentLatencyMedians.ts              # NUEVO (FR-012): mediana por agente
        ├── mergeEnrichedNodes.ts               # NUEVO (FR-013): fusión de nodos (sin mutar)
        ├── executionSignal.ts                  # (ya existe: mergeExecutionSignals → FR-014)
        ├── enrichNodeData.ts                   # (ya existe: fusión de datos de un nodo)
        ├── reconcile/comparators.ts            # (sin cambios; FR-015 ya cubierto)
        └── specs/{readyNodeIds,agentLatencyMedians,mergeEnrichedNodes}.spec.ts
```

**Structure Decision**: single project. Se mantiene la separación `Infrastructure` (orquestación de la
vista de workspace) / `Domains/Graph` (modelo y enriquecimiento). Dentro de Infrastructure, la
convención del repo se respeta: **componentes** en `Components/`, **React con estado/efectos** en
`Hooks/`, **cálculos puros** en `lib/`. En Graph, las piezas puras van a `lib/` y los specs a
`lib/specs/` (patrón vigente de `lib/`).

## Complexity Tracking

> Sin violaciones a la constitución. Tabla vacía a propósito.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (ninguna) | — | — |

## Fases

- **Phase 0 — Outline & Research**: completada → [research.md](./research.md) (8 decisiones; 0 `NEEDS CLARIFICATION`).
- **Phase 1 — Design & Contracts**: completada → [data-model.md](./data-model.md),
  [contracts/](./contracts/), [quickstart.md](./quickstart.md).
- **Phase 2 — Tasks**: fuera de este comando (`/speckit.tasks`).
