# Implementation Plan: Refinamientos de experiencia del visor

**Branch**: `002-viz-ux-refinements` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-viz-ux-refinements/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Cinco refinamientos de UX sobre el visor ya existente, sin backend ni cambios de contrato con el servidor de OpenCode:

1. **Resize de nodos (P1)** — el bloque de agente se agranda arrastrando esquina/borde con `NodeResizer` de React Flow; el tamaño es por nodo, sobrevive a las actualizaciones en vivo y se reinicia al cambiar de sesión.
2. **Modo cadena (P1)** — al seleccionar un nodo se ocultan los nodos/conexiones ajenos y solo queda visible la cadena raíz→nodo, dispuesta en una sola fila; se vuelve al grafo completo con clic en el fondo o `Escape`.
3. **Historial de herramientas truncable (P2)** — el inspector muestra las primeras 10 entradas en orden cronológico y ofrece desplegar el resto hacia abajo, indicando cuántas quedan ocultas.
4. **Tarjeta de sesión (P2)** — el título de la sesión pasa a texto principal y el agente a texto secundario (con "no disponible" cuando falta).
5. **Rango horario (P3)** — tarjeta y nodo muestran `inicio – última ejecución` con hora de fin real; si sigue en curso, `inicio – en curso`; si falta un dato, "no disponible".

El enfoque técnico reutiliza la arquitectura por dominios existente (`Graph`, `Inspector`, `Sessions`), añade lógica pura y hooks testeables (`buildChain`, `layoutChain`, `formatTimeRange`, `reduceNodeOverrides`, `useToolHistory`) y mantiene intactos los principios de la constitución: solo lectura, SDK únicamente en `*.service.ts`, tipos derivados del SDK, sin relayout del grafo ante eventos de estado.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict) + React 19

**Primary Dependencies**: Vite 8, TanStack Query 5, React Router 7, Tailwind 4, `@xyflow/react` 12 (incluye `NodeResizer`; sin dependencias nuevas) + `@dagrejs/dagre`, `@opencode/client` 2.0.22, lucide-react/FontAwesome, zod

**Storage**: N/A — estado en memoria (TanStack Query + estado local de vista); el tamaño de nodo y el modo cadena **no** se persisten entre recargas (Assumptions de la spec)

**Testing**: Vitest 2 + Testing Library + jsdom; specs junto al código en `specs/`; fixture de eventos real `src/Domains/Graph/lib/__fixtures__/run.ndjson`

**Target Platform**: Navegador moderno de escritorio (Chromium/Firefox/Safari) con presentación responsive en móvil (tabs)

**Project Type**: Aplicación web single-page (solo frontend; backend = servidor de OpenCode existente)

**Performance Goals**: sin re-layout del grafo ante cambios de solo-estado (Principio VII); resize y modo cadena actualizan el DOM sin recalcular `dagre` por evento; transición a modo cadena < 1 frame de interacción percibida; UI fluida con ~50 nodos

**Constraints**: solo lectura (no se envía prompt, no se aborta, no se responden permisos — FR-019); dark mode / flat design (FR-018); estados de pantalla obligatorios error→loading→vacío→datos (FR-017); tipos derivados del SDK (Principio IV); umbral de 10 herramientas fijo

**Scale/Scope**: 1 sesión activa por vez; ~50 nodos; historiales de hasta ~1000 partes de herramienta; 3 dominios tocados (Graph, Inspector, Sessions) + 1 helper transversal en `Application/Helpers`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Cumplimiento | Evidencia |
|---|-----------|--------------|-----------|
| I | Observador de solo lectura | ✅ PASS | Ninguna mejora añade prompts/abort/permisos; resize, cadena y truncado son estado de vista (FR-019) |
| II | Arquitectura por dominios funcionales | ✅ PASS | Cambios dentro de `Domains/Graph`, `Domains/Inspector`, `Domains/Sessions`; helper transversal en `Application/Helpers`; no hay imports cruzados desde componentes |
| III | Datos del servidor SOLO vía TanStack Query | ✅ PASS | No se agregan llamadas al SDK; se reutilizan `useGraphModel`, `useInspectorData`, `useRootSessions`; el resize no toca datos |
| IV | Tipos derivados del SDK | ✅ PASS | `startedAt`/`endedAt`/`time.created`/`time.updated` son campos del SDK; los view-models nuevos (`TNodeSizeOverride`, `TTimeRangeInput`, `TToolHistoryView`) son estado de vista local, no datos del servidor. La cadena reutiliza `TGraphModel` (no se crea tipo extra) |
| V | Lógica pura y testeable | ✅ PASS | `buildChain()`, `layoutChain()`, `formatTimeRange()` y `reduceNodeOverrides()` son funciones puras sin React con specs propias; `useNodeResize`, `useChainSelection` y `useToolHistory` son hooks con specs |
| VI | Estados de pantalla obligatorios | ✅ PASS | Las vistas afectadas conservan error/loading/vacío/datos; el modo cadena cae al grafo completo si el nodo no existe (sin estado vacío inconsistente) |
| VII | Rendimiento en tiempo real | ✅ PASS | El resize y el modo cadena no disparan relayout global; `buildChain`/`layoutChain` son O(n) y memoizados por topología; el historial truncado reduce el DOM |
| VIII | Convenciones de repositorio | ✅ PASS | Specs en `specs/` junto al código; Conventional Commits; ESLint strict; TypeScript strict |

**Resultado inicial**: 8/8 PASS. Sin violaciones. No se requiere Complexity Tracking.

**Re-check post-diseño (Phase 1)**: 8/8 PASS sin cambios. Los contratos generados confirman que: no hay SDK en componentes (III), los tipos nuevos son estado de vista (IV), las cinco funciones puras quedan cubiertas por specs (V), el fallback del modo cadena preserva los estados de pantalla (VI) y el diseño evita relayout por evento (VII). No aparecieron violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/002-viz-ux-refinements/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (decisiones resueltas)
├── data-model.md        # Phase 1 output (view-models y reglas)
├── quickstart.md        # Phase 1 output (guía de validación end-to-end)
├── checklists/
│   └── requirements.md  # Calidad de la especificación (ya existe)
├── contracts/           # Phase 1 output (contratos de UI y de funciones puras)
│   ├── README.md
│   ├── graph-view-contract.md
│   ├── inspector-contract.md
│   ├── session-card-contract.md
│   └── time-range-contract.md
├── spec.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── Application/
│   ├── Helpers/
│   │   ├── formatTimeRange.ts            # NUEVO: rango "inicio – última ejecución | en curso | no disponible"
│   │   ├── index.ts                      # (extender) exporta formatTimeRange
│   │   └── specs/
│   │       └── formatTimeRange.spec.ts   # NUEVO
│   └── Hooks/
│       ├── useEscapeKey.ts               # NUEVO: listener Escape (limpia modo cadena)
│       └── index.ts                      # (extender) exporta useEscapeKey
│
└── Domains/
    ├── Graph/
    │   ├── Graph.entity.ts               # (extender) TNodeSizeOverride
    │   ├── lib/
    │   │   ├── chainGraph.ts             # NUEVO: buildChain() + layoutChain() (puras)
    │   │   ├── nodeResize.ts             # NUEVO: reduceNodeOverrides() (pura)
    │   │   └── specs/
    │   │       ├── chainGraph.spec.ts    # NUEVO
    │   │       └── nodeResize.spec.ts    # NUEVO
    │   ├── Components/
    │   │   ├── AgentGraph.tsx            # (extender) onNodesChange, onPaneClick, fitView por firma, onClearSelection
    │   │   ├── AgentNode.tsx             # (extender) NodeResizer + layout flexible + rango horario
    │   │   └── specs/
    │   │       └── AgentNode.spec.tsx    # (extender) rango horario y tirador
    │   ├── Hooks/
    │   │   ├── useNodeResize.ts          # NUEVO: overrides de tamaño por nodo, reset por sesión
    │   │   ├── useChainSelection.ts      # NUEVO: selección explícita + isChainMode + clear
    │   │   └── specs/
    │   │       ├── useNodeResize.spec.tsx
    │   │       └── useChainSelection.spec.tsx
    │   └── index.ts                      # (extender) exporta chainGraph/nodeResize y hooks
    │
    ├── Inspector/
    │   ├── Components/
    │   │   ├── ToolHistory.tsx           # (extender) 10 visibles + control desplegar/contraer + total oculto
    │   │   └── specs/
    │   │       └── ToolHistory.spec.tsx  # NUEVO
    │   ├── Hooks/
    │   │   ├── useToolHistory.ts         # NUEVO: visibles/ocultas + expandido
    │   │   └── specs/useToolHistory.spec.tsx
    │   └── index.ts                      # (extender) exporta useToolHistory
    │
    └── Sessions/
        ├── Components/
        │   ├── SessionCard.tsx           # (extender) título arriba / agente abajo / rango horario
        │   └── specs/
        │       └── SessionCard.spec.tsx  # (extender)
        └── index.ts                      # sin cambios de contrato

src/Infrastructure/WorkspacePage.tsx      # (extender) selección explícita vs inspección, displayGraph, Escape
```

**Structure Decision**: Single project (frontend SPA). Se conserva el scaffolding y la separación entity/lib/Components/Hooks/index de `AGENTS.md`. La lógica nueva vive en funciones puras (`lib/`) y hooks (`Hooks/`); los componentes quedan como presentación. `WorkspacePage` orquesta la vista (selección, modo cadena, panes) como ya lo hace hoy.

## Design Direction — Dark Mode / Flat Design

La dirección visual ya está fijada por la feature 001 (ver `specs/001-agent-viz-observability/plan.md` → Design Direction) y **no cambia**. Estas mejoras se integran con las reglas existentes:

- **Resize**: tiradores planos de 1px sobre los bordes del nodo (sin sombra), color `--border` en reposo y `--accent` en hover/selected; sin gradientes. El nodo agrandado mantiene la franja de estado (`NodeStatusRail`) de 3px y la tira monoespaciada de métricas.
- **Modo cadena**: los nodos de la cadena conservan su tratamiento; el nodo seleccionado mantiene el borde `--accent` y los ancestros el borde `--border`. Fondo del grafo sin cambios (`--surface-0`).
- **Historial**: el control de expansión es una fila plana con chevron (lucide) y texto mono `"Ver N más"` / `"Ver menos"`, alineado a la izquierda, sin caja.
- **Tarjeta y rango**: el rango horario usa `font-mono tabular-nums` en `--text-muted`, coherente con el resto de métricas; nunca desplaza la jerarquía título > agente.

## Complexity Tracking

> No hay violaciones de la constitución. Sección no aplica.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
