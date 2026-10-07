# Implementation Plan: Reordenar y agrupar el panel de detalles

**Branch**: `004-inspector-panel-layout` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-inspector-panel-layout/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Feature de **pura presentación**: reordena las secciones del panel de detalles (Inspector) y agrupa el contenido técnico dentro de un desplegable **"Avanzado"** cerrado por defecto. No cambia el origen ni la obtención de datos: reutiliza el nodo de ejecución y los mismos datos que ya consume `useInspectorData`.

1. **Orden predecible (P1)** — el panel se compone, de arriba a abajo: identidad → Modelo → Métricas (con el aviso de Loop dentro) → Recursos → Duración mediana por herramienta → Subagentes → Archivos → Avanzado.
2. **"Avanzado" colapsado (P1)** — Herramientas, Respuestas, Preguntas y permisos y Errores viven dentro de un desplegable cerrado por defecto, abierto por acción explícita del usuario y con el estado de expansión conservado mientras dura la sesión de UI.
3. **"Subagentes" agrupado (P2)** — tareas del subagente y agentes en paralelo conviven bajo un único encabezado, con estado vacío explícito.

Enfoque técnico: todo ocurre en `src/Domains/Inspector/Components`. Se extrae la "Duración mediana por herramienta" de `ToolHistory` (hoy dentro de él) a una sección propia `ToolStats` que reutiliza la función pura `medianToolDurations()`; se agrupan tareas + paralelos en `SubagentsSection`; se extrae el bloque de errores a `ErrorsSection`; se aísla la fila de Modelo en `ModelSection`; y se introduce `AdvancedSection`, un disclosure accesible (botón + `aria-expanded`/`aria-controls`, render condicional) con estado local no controlado por defecto. `InspectorPanel` queda como orquestador puro que ordena las secciones. Sin nuevas dependencias, sin cambios en `*.service.ts`, hooks ni SDK.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict) + React 19

**Primary Dependencies**: Vite 8, TanStack Query 5, React Router 7, Tailwind 4 + shadcn/ui (Radix), `@xyflow/react` 12 + `@dagrejs/dagre`, `@fortawesome/react-fontawesome`. **Sin dependencias nuevas** para esta feature (el disclosure se construye con un `Button` + estado de React, patrón ya usado en `ToolHistory`).

**Storage**: N/A — todo es estado de vista en memoria (estado de expansión de "Avanzado" y selección de archivo). No se persiste entre recargas.

**Testing**: Vitest 2 + Testing Library + jsdom; specs junto al código en carpetas `specs/` (Principio VIII). Se actualizan `InspectorPanel.spec.tsx` y `ToolHistory.spec.tsx` y se añaden specs para las secciones nuevas.

**Target Platform**: Navegador moderno de escritorio (Chromium/Firefox/Safari) con presentación responsive en móvil.

**Project Type**: Aplicación web single-page (solo frontend; backend = servidor de OpenCode existente).

**Performance Goals**: ninguna regresión de rendimiento. La feature no cambia la carga de datos ni el manejo de eventos SSE (Principio VII). El contenido de "Avanzado" se **renderiza condicionalmente** (no solo se oculta con CSS), de modo que colapsado no monta las secciones internas.

**Constraints**: solo lectura (Principio I); estados de pantalla obligatorios error→loading→vacío→datos en cada sección (Principio VI, FR-016); tipos `T` (Principio IV); sin imports de componentes entre dominios (los datos cruzan por hooks); sin `md:hidden`/`hidden md:block`; "no disponible" ante datos ausentes.

**Scale/Scope**: panel de un único nodo seleccionado a la vez; ~8 secciones; 1 dominio afectado (`Inspector`) + registro de barrel.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Cumplimiento | Evidencia |
|---|-----------|--------------|-----------|
| I | Observador de solo lectura | ✅ PASS | No se añade ninguna mutación ni llamada al SDK. La feature solo reordena y agrupa presentación (FR-001..FR-016). |
| II | Arquitectura por dominios funcionales | ✅ PASS | Todo vive en `Domains/Inspector/Components`; no hay imports cruzados de componentes entre dominios. Las piezas compartidas se toman de `@app/Application/Components`. |
| III | Datos del servidor SOLO vía TanStack Query | ✅ PASS | `useInspectorData` no cambia; las secciones siguen recibiendo datos por props desde el hook. Ningún componente toca el SDK. |
| IV | Tipos derivados del SDK | ✅ PASS | No se introducen entidades nuevas. Se reutilizan `TToolStat`, `TTaskEntry`, `TNodeMetrics`, `TResourceUsage`, `TGraphNode`; los datos crudos siguen siendo tipos del SDK. |
| V | Lógica pura y testeable | ✅ PASS | La agregación de duraciones ya es la función pura `medianToolDurations()` (specs existentes). El reordenamiento es composición JSX verificable por test de orden. |
| VI | Estados de pantalla obligatorios | ✅ PASS | Cada sección conserva su error→loading→vacío→datos (FR-016). `SubagentsSection` y `ErrorsSection` incluyen estado vacío explícito (FR-008, FR-015); "Avanzado" no oculta estados, solo agrupa. |
| VII | Rendimiento en tiempo real | ✅ PASS | Sin cambios en el reducer/SSE ni en la carga de datos. El contenido colapsado no se monta (render condicional). |
| VIII | Convenciones de repositorio | ✅ PASS | Specs en `specs/` junto al código; Conventional Commits; ESLint strict; TypeScript strict. |

**Resultado inicial**: 8/8 PASS. Sin violaciones. No se requiere Complexity Tracking.

**Re-check post-diseño (Phase 1)**: 8/8 PASS sin cambios. El contrato de UI confirma el orden exacto de secciones (FR-001/SC-003), el comportamiento del disclosure (FR-010..FR-012) y la preservación de estados de pantalla en cada subsección (FR-016/Principio VI). No aparecieron violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/004-inspector-panel-layout/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (decisiones resueltas)
├── data-model.md        # Phase 1 output (composición de secciones y view-models reutilizados)
├── quickstart.md        # Phase 1 output (guía de validación end-to-end)
├── checklists/
│   └── requirements.md  # Calidad de la especificación (ya existe)
├── contracts/           # Phase 1 output (contrato de UI del panel)
│   ├── README.md
│   └── inspector-layout-contract.md
├── spec.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
└── Domains/
    └── Inspector/
        ├── Components/
        │   ├── InspectorPanel.tsx            # (modificar) solo orden de secciones + composición
        │   ├── ModelSection.tsx              # NUEVO: fila Modelo (Nombre + Razonamiento) extraída
        │   ├── MetricsSection.tsx            # (sin cambios de datos; asume LoopBadge dentro)
        │   ├── ResourceList.tsx              # (sin cambios)
        │   ├── ToolStats.tsx                 # NUEVO: sección "Duración mediana por herramienta" (extraída de ToolHistory)
        │   ├── SubagentsSection.tsx          # NUEVO: agrupa tareas del subagente + agentes en paralelo
        │   ├── FileChanges.tsx               # (sin cambios)
        │   ├── AdvancedSection.tsx           # NUEVO: disclosure "Avanzado" (colapsado por defecto)
        │   ├── ToolHistory.tsx               # (modificar) solo la lista de ejecuciones; sin bloque de mediana
        │   ├── AnswersSection.tsx            # (sin cambios; se monta dentro de Avanzado)
        │   ├── QuestionsSection.tsx          # (sin cambios; se monta dentro de Avanzado)
        │   ├── ErrorsSection.tsx             # NUEVO: bloque de errores extraído de InspectorPanel
        │   ├── LoopBadge.tsx                 # (sin cambios)
        │   └── index.ts                      # (modificar) exporta las secciones nuevas
        └── Components/specs/
            ├── InspectorPanel.spec.tsx       # (modificar) orden, Avanzado colapsado/expandible
            ├── ToolHistory.spec.tsx          # (modificar) ya no incluye la mediana
            ├── ToolStats.spec.tsx            # NUEVO
            ├── SubagentsSection.spec.tsx     # NUEVO
            ├── AdvancedSection.spec.tsx      # NUEVO
            └── ErrorsSection.spec.tsx        # NUEVO
```

**Structure Decision**: Single project (frontend SPA). Se conserva el scaffolding del dominio `Inspector` (`Components/`, `Hooks/`, `lib/`, `specs/`) según `AGENTS.md`. La feature es exclusivamente de presentación, por lo que **no** toca `Inspector.entity.ts`, `Inspector.service.ts`, `useInspectorData.ts`, `lib/medianToolDurations.ts` ni `Application`. No se crea un componente compartido genérico de "collapsible" porque `Avanzado` es el único consumidor previsto: se evita una abstracción prematura y el disclosure queda dentro del dominio que lo usa.

## Design Direction — Dark Mode / Flat Design

La dirección visual ya está fijada por la feature 001 (ver `specs/001-agent-viz-observability/plan.md` → Design Direction) y **no cambia**. La feature reutiliza los patrones existentes:

- **Encabezados de sección**: la misma firma ya usada (`text-[11px] font-medium uppercase tracking-wide text-muted-foreground`), sin convertirlos en tarjetas ni añadir sombras.
- **"Avanzado"**: fila de encabezado con un botón de divulgación sin caja (chevron + etiqueta), coherente con el control de expansión de `ToolHistory` (`aria-expanded`, fondo transparente, `font-mono`). Nada de acordeón con tarjetas ni animaciones llamativas.
- **Subsecciones dentro de "Avanzado"**: mismo tono y espaciado que el resto del panel; el agrupamiento es una jerarquía de encabezados, no un contenedor con borde/sombra.
- **Datos**: monoespaciado y `tabular-nums` para duraciones y nombres de herramienta, como ya hace `ToolHistory`.

## Complexity Tracking

> No hay violaciones de la constitución. Sección no aplica.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
