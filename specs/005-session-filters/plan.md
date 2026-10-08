# Implementation Plan: Filtros de proyecto y recencia en el listado de sesiones

**Branch**: `005-session-filters` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-session-filters/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Feature de **presentación y estado de vista** sobre la página del listado de sesiones: se añade una **barra de filtros siempre visible** entre el título y el listado, con dos controles combinables por intersección:

1. **Filtro de proyecto (P1)** — multiselección (vacío = todos) sobre los proyectos que tienen al menos una sesión; cada opción muestra el **nombre de carpeta** como etiqueta principal y la **ruta completa** como texto secundario (resuelve homónimos, FR-023).
2. **Filtro temporal de recencia (P1)** — rangos predefinidos (`1h`, `24h`, `7d`, `30d`, `all`) evaluados sobre la **última actividad** de la sesión (`time.updated`), con **ventana rodante en vivo** que recompone la lista por el mero paso del tiempo sin recargar (FR-009, FR-022, SC-007).
3. **Continuidad (P2)** — el estado de ambos filtros vive en la **dirección de la página** (search params), de modo que sobrevive a abrir/volver de una sesión, a recargar y a compartir el enlace; valores inválidos se degradan a los defaults sin error (FR-013..FR-015).

Enfoque técnico: **sin dependencias nuevas y sin tocar el origen de datos**. La lógica de filtrado es **pura y testeable** en `Sessions/lib/sessionFilters.ts` (parseo/serialización de la URL, evaluación de rango, intersección, opciones de proyecto). Un hook `useSessionFilters(groups: TSessionGroup[])` **recibe los grupos ya calculados** — la página hace una única llamada a `useRootSessions` y la pasa, evitando doble suscripción y doble fetch — posee el estado (leído/escrito vía `useURLParams` existente) y expone un tick de reloj en vivo. La UI se compone de `SessionFilterBar` (orquesta `ProjectFilter` con Popover + Checkbox de Radix, y `TimeRangeFilter` con el `Select` ya existente), reutilizando primitivas de `@app/Application/Components`. `SessionList` gana el conteo por grupo (FR-016) y el estado vacío de filtros reutiliza `EmptyScreenFilter` (FR-011). No cambian `Sessions.service.ts`, `queryKeys.ts`, el reducer SSE ni los tipos del SDK.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict) + React 19

**Primary Dependencies**: Vite 8, TanStack Query 5, React Router 7 (`useSearchParams` vía `useURLParams`), Tailwind 4 + shadcn/ui (Radix: `@radix-ui/react-popover`, `@radix-ui/react-checkbox`, `@radix-ui/react-select`), `@fortawesome/react-fontawesome`. **Sin dependencias nuevas**: Popover, Checkbox y Select ya están instalados y exportados por `@app/Application/Components`.

**Storage**: N/A — el único estado persistente es la **URL** (search params `projects` y `range`). No hay persistencia en `localStorage` más allá de lo que la URL representa (Assumptions).

**Testing**: Vitest 2 + Testing Library + jsdom; specs junto al código en carpetas `specs/` (Principio VIII). Se añaden specs de la lógica pura (`lib/specs/sessionFilters.spec.ts`), del hook (`Hooks/specs/useSessionFilters.spec.tsx`) y de los componentes nuevos (`Components/specs/`), y se actualiza `SessionList.spec.tsx` por el conteo de grupo.

**Target Platform**: Navegador moderno de escritorio (Chromium/Firefox/Safari) con presentación responsive en móvil.

**Project Type**: Aplicación web single-page (solo frontend; backend = servidor de OpenCode existente).

**Performance Goals**: sin regresiones de contenido ni de orden con filtros desactivados (SC-004). El tick en vivo re-renderiza solo el subárbol de la página (nunca re-fetch): el resultado filtrado se memoiza y la lista se reconcilia por keys estables (`group.directory`, `session.id`), preservando scroll y foco.

**Constraints**: solo lectura (Principio I); estados de pantalla obligatorios error→carga→vacío-sin-sesiones→datos, con un estado vacío **específico de filtros** encima (FR-019, FR-011); tipos `T` (Principio IV); sin imports de componentes entre dominios (los datos cruzan por hooks); sin `md:hidden`/`hidden md:block`; filtros **solo** en la página del listado, nunca en el listado lateral del espacio de trabajo (FR-018); reloj local sin conversión de zona horaria (Assumptions). La primitiva compartida `Select` se extiende de forma **retrocompatible**: `defaultValue` pasa a ser opcional, se añade `value` controlado y un `className` que se aplica al **trigger** interno (que hoy fija `w-20`, insuficiente para "Últimas 24 horas"). Hoy `Select` no tiene consumidores, así que no hay regresiones. `EmptyScreenFilter` se extiende con una etiqueta de acción opcional para poder ofrecer "Limpiar filtros" en lugar de su texto fijo actual.

**Scale/Scope**: 1 dominio afectado (`Sessions`), 3 componentes nuevos + 1 modificado, 1 hook nuevo, 1 módulo puro nuevo, 1 página modificada. El filtro temporal reevalúa contra `Date.now()`; con "todo" activo no hay corte y el tick se desactiva (edge case).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Cumplimiento | Evidencia |
|---|-----------|--------------|-----------|
| I | Observador de solo lectura | ✅ PASS | No se añade ninguna mutación, prompt ni aborto. Los filtros son estado de vista local/URL; ninguna llamada nueva al SDK. |
| II | Arquitectura por dominios funcionales | ✅ PASS | Todo vive en `Domains/Sessions` (`lib/`, `Hooks/`, `Components/`, `Pages/`). No hay imports cruzados de componentes entre dominios; las primitivas compartidas vienen de `@app/Application/Components`. |
| III | Datos del servidor SOLO vía TanStack Query | ✅ PASS | `useRootSessions` no cambia y sigue siendo la única fuente; el hook de filtros **deriva** de sus `groups` en memoria. Ningún componente toca el SDK. |
| IV | Tipos derivados del SDK | ✅ PASS | `TSession` sigue derivando de `SessionInfo`. Los tipos nuevos (`TTimeRange`, `TProjectOption`, `TSessionFilters`) son de **presentación/estado de vista**, no redefinen entidades del SDK. Se usa `session.time.updated` y `session.location.directory` existentes. |
| V | Lógica pura y testeable | ✅ PASS | `Sessions/lib/sessionFilters.ts` concentra parseo/serialización de URL, `isWithinTimeRange`, intersección y opciones de proyecto como funciones puras con specs; el tick de reloj se inyecta (`now`) para testear la ventana rodante sin temporizadores reales. |
| VI | Estados de pantalla obligatorios | ✅ PASS | Se preserva error→carga→vacío-sin-sesiones→datos (FR-019) y se **añade** un estado vacío de filtros accionable (`EmptyScreenFilter`) por encima de "datos" (FR-011/SC-005), distinto de "Sin sesiones". |
| VII | Rendimiento en tiempo real | ✅ PASS | Sin cambios en el reducer/SSE ni en la carga de datos. El tick en vivo solo recomputa un `useMemo` (sin red) y se desactiva con rango "todo". |
| VIII | Convenciones de repositorio | ✅ PASS | Specs en `specs/` junto al código; Conventional Commits; ESLint strict; TypeScript strict; sin `div.flex` crudo (se usa `Container`). |

**Resultado inicial**: 8/8 PASS. Sin violaciones. No se requiere Complexity Tracking.

**Re-check post-diseño (Phase 1)**: 8/8 PASS sin cambios. El contrato de UI fija el parseo tolerante de la URL (FR-013..FR-015), la semántica "vacío = todos" (FR-003), la intersección (FR-010), la ocultación de grupos vacíos y el conteo (FR-016/FR-017) y la reevaluación en vivo (FR-022/SC-007). No aparecieron violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/005-session-filters/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (decisiones resueltas)
├── data-model.md        # Phase 1 output (view-models y reglas de filtrado)
├── quickstart.md        # Phase 1 output (guía de validación end-to-end)
├── checklists/
│   └── requirements.md  # Calidad de la especificación (ya existe)
├── contracts/           # Phase 1 output (contrato de UI + contrato de URL)
│   ├── README.md
│   └── session-filters-contract.md
├── spec.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
└── Domains/
    └── Sessions/
        ├── lib/
        │   ├── sessionFilters.ts              # NUEVO: lógica pura (rangos, URL, intersección, opciones)
        │   └── specs/
        │       └── sessionFilters.spec.ts     # NUEVO
        ├── Hooks/
        │   ├── useSessionFilters.ts           # NUEVO: estado de filtros + URL + tick en vivo
        │   ├── useNow.ts                      # NUEVO: reloj en vivo (activable, intervalo inyectable)
        │   ├── useRootSessions.ts             # (sin cambios) fuente de groups
        │   ├── index.ts                       # (modificar) exporta los hooks nuevos
        │   └── specs/
        │       ├── useSessionFilters.spec.tsx # NUEVO
        │       └── useNow.spec.tsx            # NUEVO
        ├── Components/
        │   ├── SessionFilterBar.tsx           # NUEVO: barra siempre visible (FR-024/FR-025)
        │   ├── ProjectFilter.tsx              # NUEVO: multiselección (Popover + Checkbox)
        │   ├── TimeRangeFilter.tsx            # NUEVO: rangos predefinidos (Select existente)
        │   ├── SessionList.tsx                # (modificar) conteo de sesiones por grupo (FR-016)
        │   ├── index.ts                       # (modificar) exporta los componentes nuevos
        │   └── specs/
        │       ├── SessionFilterBar.spec.tsx  # NUEVO
        │       ├── ProjectFilter.spec.tsx     # NUEVO
        │       ├── TimeRangeFilter.spec.tsx   # NUEVO
        │       └── SessionList.spec.tsx       # (modificar) aserción de conteo
        ├── Pages/
        │   └── SessionList.page.tsx           # (modificar) barra + estado vacío de filtros
        ├── Session.entity.ts                  # (sin cambios)
        ├── Sessions.service.ts                # (sin cambios)
        └── Sessions.routes.ts                 # (sin cambios; se conserva la ruta base)
```

**Structure Decision**: Single project (frontend SPA). Se conserva el scaffolding del dominio `Sessions` (`lib/`, `Hooks/`, `Components/`, `Pages/`, `specs/`) según `AGENTS.md`. La feature **no** toca `Sessions.service.ts`, `queryKeys.ts`, `Session.entity.ts`, `useRootSessions.ts` ni el reducer de eventos: consume los `groups` ya calculados y solo añade una capa de derivación/estado de vista. No se crea un componente compartido genérico de "multi-select" en `Application`: `ProjectFilter` es el único consumidor previsto y se mantiene dentro del dominio que lo usa (se evita abstracción prematura); sí se reutilizan las primitivas `ui/popover`, `ui/checkbox` y el `Select` de `Application`.

## Design Direction — Dark Mode / Flat Design

La dirección visual ya está fijada por la feature 001 (ver `specs/001-agent-viz-observability/plan.md` → Design Direction) y **no cambia**. La feature reutiliza los patrones existentes:

- **Barra de filtros**: una fila sin tarjeta ni sombra, con `Container` (`row`, `space="small"`, `justify="between"`), separada del listado por espaciado, no por un borde nuevo. Coherente con la cabecera de grupo actual (`# carpeta`).
- **Controles**: `Select` y `Popover`/`Checkbox` con los estilos base ya instalados (bordes `border-input`, `rounded-md`, `focus:ring-1`). El disparador del filtro de proyecto sigue la altura `h-control` del resto de controles.
- **Opciones de proyecto**: nombre de carpeta en `text-sm text-foreground` y ruta completa en `font-mono text-[11px] text-muted-foreground truncate`, mismo tratamiento que la ruta de las tarjetas de sesión.
- **Resumen y limpiar**: texto en `text-[11px] uppercase tracking-wide text-muted-foreground` y acción como `Button` `variant="link"`, sin convertirlo en tarjeta.
- **Datos**: se mantiene `tabular-nums` y el conteo de grupo en el mismo tono del encabezado existente.

## Complexity Tracking

> No hay violaciones de la constitución. Sección no aplica.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
