# Implementation Plan: Detalle del nodo por secciones (tablist) en el Inspector

**Branch**: `014-inspector-detail-tabs` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-inspector-detail-tabs/spec.md`

**Insumos**: [discovery/prd.md](./discovery/prd.md), [discovery/rfc.md](./discovery/rfc.md) (decisiones
`decision/*`, no se reabren) y `.specify/memory/constitution.md` (principios I–VIII).

## Summary

Reemplazar el desplegable "Avanzado" del detalle del nodo por un **tablist de siete secciones** al
final del scroll del panel: Subagentes · Archivos · Herramientas · Respuestas · Preguntas y permisos ·
Errores · Latencia. La pestaña activa es la única visible, arranca en **Subagentes**, es efímera (sin
persistencia), se mantiene al cambiar de nodo y vuelve a Subagentes al cerrar y reabrir el detalle. El
resumen sigue siendo una lectura continua —Identidad → Modelo → Métricas → **Contexto (Paralelismo +
Aporte al padre)** → Recursos → Duración mediana por herramienta— y las siete secciones salen de él.

Approach (fijado por el RFC, resuelto en [research.md](./research.md)):

1. **Lógica pura en un hook** `useInspectorSectionTabs` (espejo de `useDetailTabs`): tupla `as const`
   de ids, items con etiquetas, guarda de id y estado `useState` efímero (Principio V). El estado vive
   en el componente `InspectorSectionTabs`, así que el reset al cerrar el detalle es el **límite de
   montaje** de React, sin efectos ni estado extra (FR-003).
2. **Presentación en el dominio Inspector**: `InspectorSectionTabs` consume el hook y rinde
   `Tabs`/`TabsList`/7 `TabsTrigger`/7 `TabsContent` a partir de un `Record<TInspectorSectionTab,
   ReactNode>` exhaustivo por tipo que construye `InspectorPanel` (Principio II).
3. **Corrección upstream del primitivo compartido** `src/Application/Components/ui/tabs.tsx`:
   alto automático + envoltura (`min-h-control flex-wrap`, conservando el alto del tablist
   `Detalle | Chat` en una fila), indicador activo con separación ≥3:1 (1.4.11) perceptible en
   `forced-colors` y foco por `outline` con respaldo `forced-colors:outline-[Highlight]` (2.4.7).
4. **Hilado de estados**: `isLoading`/`isError` de `useInspectorData` llegan a Subagentes,
   Herramientas, Respuestas y Errores (error → carga → vacío → datos, Principio VI).
5. **Retirada del desplegable**: se elimina `AdvancedSection` (y su spec); `Disclosure` se conserva
   (lo usa `ToolHistory`).
6. **Contrato**: [contracts/inspector-section-tabs-contract.md](./contracts/inspector-section-tabs-contract.md)
   sustituye §1 ítem 7, §2.1-2.3, §3.1 y §5:157 de `specs/004-inspector-panel-layout/contracts/inspector-layout-contract.md`
   y `specs/010-context-metrics-insights/contracts/context-panel-contract.md:58`. La edición literal
   de esos dos ficheros superseded es trabajo de implementación (FR-010), con el alcance acotado que
   fijó la spec: solo los contratos vigentes superseded y los comentarios del código tocado.

Fuera de alcance (decidido, no se reabre): badges/contadores, `activationMode="manual"`, footer fijo o
sticky, scroll horizontal, renombrar "Respuestas", promoción del encabezado interno a encabezado
semántico, corrección del contraste del texto inactivo en tema claro y cambios en el comportamiento de
`Detalle | Chat` o de la navegación móvil.

## Technical Context

**Language/Version**: TypeScript 5 strict sobre React 19 (Vite 8)

**Primary Dependencies**: React 19, Radix UI Tabs (`@radix-ui/react-tabs` 1.1.21, vía
`src/Application/Components/ui/tabs.tsx`), Tailwind 4 (`@tailwindcss/postcss`, tokens de
`src/index.css`), TanStack Query 5, Vitest + Testing Library + jsdom

**Storage**: N/A — el estado de la pestaña es efímero en memoria; no hay persistencia ni claves de
caché nuevas

**Testing**: Vitest (`vitest.config.ts`) + Testing Library; specs en carpetas `specs/` junto al código
(Principio VIII). Se amplía el spec del primitivo con fixture anidado y se añaden specs de hook y
componente

**Target Platform**: SPA en navegador (escritorio con panel lateral redimensionable 280–720 px y móvil
con el detalle como destino de pantalla completa; una sola fuente de lógica)

**Project Type**: single project (frontend React/Vite, sin backend propio)

**Performance Goals**: solo el panel activo monta hijos (Radix), así que el coste de render no crece
con 7 pestañas; el camino SSE/enriquecimiento del grafo no se toca (Principio VII). Se vigila el
montaje/desmontaje de paneles al recorrer con flechas (activación automática) y el reflujo del pill al
redimensionar el panel; si aparece jank real se **mide** antes de proponer `activationMode="manual"`
(reabriría `decision/scroll-y-activacion`)

**Constraints**: sin consultas, `queryKeys`, rutas, `data-testid` externos ni copy nuevos; sin SDK;
sin persistencia; props de las siete secciones conservadas literalmente; prohibido duplicar en el call
site el override de alto del primitivo; prohibidas utilidades de `display` en `TabsContent`; sin
badges; TS/ESLint strict

**Scale/Scope**: 1 primitivo compartido + ~5 componentes del dominio tocados, 4 componentes nuevos
(hook, componente y sus dos specs), 2 ficheros eliminados, ~8 specs ajustados, 0 cambios de datos y 0
cambios de superficie pública

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Verificación | Veredicto |
|---|---|---|
| I. Observador con modo interactivo | No se toca escritura, SDK ni acceso al dev server; el cambio es presentación de lectura | PASS |
| II. Arquitectura por dominios | Hook y componente viven en `Domains/Inspector/`; el primitivo corregido ya es compartido (`Application/Components/ui`); ningún dominio importa a otro | PASS |
| III. Datos del servidor solo vía TanStack Query | Cero consultas o claves nuevas; `isLoading`/`isError` ya los expone `useInspectorData` | PASS |
| IV. Tipos derivados del SDK | No se redefinen tipos del SDK; `TInspectorSectionTab`/`TInspectorSectionTabItem` son tipos de vista del dominio | PASS |
| V. Lógica pura y testeable | `useInspectorSectionTabs` + constantes + guarda con spec propio, fuera del componente | PASS |
| VI. Estados de pantalla obligatorios | Las cuatro secciones sin estado pasan a resolver error → carga → vacío → datos | PASS |
| VII. Rendimiento en tiempo real | Solo el panel activo monta hijos; no se altera el procesado por lotes ni el grafo; riesgo de jank vigilado, no resuelto a ciegas | PASS |
| VIII. Convenciones de repositorio | Specs junto al código, TS/ESLint strict, Conventional Commits, magic strings centralizadas en constantes y corrección upstream sin duplicar overrides | PASS |

**Gate pre-Phase 0**: PASS — sin violaciones que justificar (`Complexity Tracking` vacío).
**Gate post-diseño**: PASS — ver §"Re-evaluación post-diseño" en [research.md](./research.md)
(R1–R10 no introducen estado nuevo de servidor, consultas, rutas ni tokens; el único cambio compartido
es el primitivo, con su superficie y su regresión acotadas por contrato).

## Project Structure

### Documentation (this feature)

```text
specs/014-inspector-detail-tabs/
├── plan.md                                          # Este archivo (/speckit.plan)
├── spec.md                                          # Spec (no se modifica)
├── research.md                                      # Phase 0: R1–R10, 0 NEEDS CLARIFICATION
├── data-model.md                                    # Phase 1: entidades, estados, invariantes
├── quickstart.md                                    # Phase 1: guía de validación ejecutable
├── contracts/
│   └── inspector-section-tabs-contract.md           # Phase 1: contrato nuevo (supersede specs/004 §2/§3.1 y specs/010:58)
├── discovery/
│   ├── prd.md                                       # insumo (no se modifica)
│   └── rfc.md                                       # insumo (no se modifica)
├── checklists/requirements.md                       # checklist vigente (no se modifica)
└── tasks.md                                         # Phase 2 (/speckit.tasks — NO lo crea este comando)
```

Documentos **superseded** que la implementación debe actualizar (FR-010, alcance acotado):

```text
specs/004-inspector-panel-layout/contracts/inspector-layout-contract.md   # §1 ítem 7, §2.1-2.3, §3.1, §5:157
specs/010-context-metrics-insights/contracts/context-panel-contract.md    # §4 (línea 58)
```

El resto de documentos de `specs/004` y `specs/010` queda **histórico** y no se reescribe.

### Source Code (repository root)

```text
src/
├── Application/
│   └── Components/
│       ├── Molecules/
│       │   └── Disclosure.tsx                     # MODIFICADO: solo comentarios (ya no lo usa "Avanzado")
│       └── ui/
│           ├── tabs.tsx                           # MODIFICADO: primitivo compartido (alto auto + wrap,
│           │                                      #   indicador activo ≥3:1, foco por outline + forced-colors)
│           └── specs/tabs.a11y.spec.tsx           # MODIFICADO: fixture anidado, 7 tabs, guardias de clase/foco
└── Domains/Inspector/
    ├── Components/
    │   ├── InspectorPanel.tsx                     # MODIFICADO: Record de secciones + <InspectorSectionTabs>
    │   ├── InspectorSectionTabs.tsx               # NUEVO: presentación del tablist (hook + 7 paneles)
    │   ├── AdvancedSection.tsx                    # ELIMINADO
    │   ├── SubagentsSection.tsx                   # MODIFICADO: isLoading/isError
    │   ├── ToolHistory.tsx                        # MODIFICADO: isLoading/isError
    │   ├── AnswersSection.tsx                     # MODIFICADO: isLoading/isError (cabecera y botón permanecen)
    │   ├── ErrorsSection.tsx                      # MODIFICADO: isLoading/isError
    │   ├── index.ts                               # MODIFICADO: −AdvancedSection, +InspectorSectionTabs
    │   └── specs/
    │       ├── InspectorSectionTabs.spec.tsx      # NUEVO: APG, un panel vivo, wrap, estados
    │       ├── AdvancedSection.spec.tsx           # ELIMINADO
    │       ├── InspectorPanel.spec.tsx            # MODIFICADO: bloque "Avanzado" → tablist
    │       ├── SubagentsSection.spec.tsx          # MODIFICADO: error/carga/vacío
    │       ├── ToolHistory.spec.tsx               # MODIFICADO: error/carga/vacío
    │       ├── AnswersSection.spec.tsx            # MODIFICADO: error/carga/vacío
    │       ├── ErrorsSection.spec.tsx             # MODIFICADO: error/carga/vacío
    │       └── LatencySection.spec.tsx            # (sin cambios; se conserva como regresión de FR-009)
    ├── Hooks/
    │   ├── useInspectorSectionTabs.ts             # NUEVO: ids, items, guarda y estado efímero
    │   ├── index.ts                               # MODIFICADO: +export del hook
    │   └── specs/useInspectorSectionTabs.spec.tsx # NUEVO: 7 items, orden, inicial, ids inválidos
    └── (resto del dominio: sin cambios)

src/Infrastructure/
├── Components/InspectorPane.tsx                   # SIN CAMBIOS (tablist externo "Detalle | Chat")
└── Components/specs/
    ├── InspectorPane.spec.tsx                     # MODIFICADO: queries acotadas por aria-label/within
    ├── WorkspaceLayout.spec.tsx                   # MODIFICADO si monta el panel real (stub ⇒ sin cambios)
    └── WorkspaceMobileTabs.spec.tsx               # MODIFICADO si monta el panel real (stub ⇒ sin cambios)
```

**Structure Decision**: single project (SPA por dominios, estructura única del repo).
La feature respeta la convención vigente del dominio Inspector: **lógica** en `Hooks/` (hook puro y
testeable, Principio V), **presentación** en `Components/` (Principio II) y **specs** en carpetas
`specs/` junto al código (Principio VIII). El único fichero compartido que se toca es el primitivo de
pestañas, que ya lo es (lo usan `InspectorPane` y el nuevo tablist); su corrección es upstream-first
por decisión del usuario y por VIII (`h-control` es una clase custom que `twMerge` no agrupa, así que
un override en el call site quedaría duplicado y decidido por orden en el CSS).

## Complexity Tracking

> Sin violaciones a la constitución. Tabla vacía a propósito.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (ninguna) | — | — |

## Phase 0 — Outline & Research (salida)

Completa: [research.md](./research.md) — decisiones R1–R10, **0 `NEEDS CLARIFICATION`**.

- **R1** — El estado de la pestaña vive en `InspectorSectionTabs`; el límite de montaje (solo se monta
  con nodo) cumple FR-003 (se mantiene entre nodos, se reinicia al cerrar/reabrir) sin efectos ni `key`.
- **R2** — Hook espejo de `useDetailTabs` con ids `as const`, items etiquetados, guarda y constantes
  (`aria-label`, clases del call site) para no repetir magic strings.
- **R3** — Primitivo: `min-h-control flex-wrap` en `TabsList` (el tablist externo conserva su alto al
  píxel; `w-full`/`justify-start` van en el call site porque sí los agrupa `twMerge`).
- **R4** — Indicador activo por `border-foreground` (≥3:1 en ambos temas y perceptible en
  `forced-colors`; `ring`/`box-shadow` se descartan porque el contraste forzado lo elimina).
- **R5** — Foco por `outline` + `forced-colors:outline-[Highlight]` (patrón de `ui/input.tsx`), sin
  `focus-visible:outline-none` ni `ring`.
- **R6** — Radix mantiene el `div` inactivo `hidden` **sin hijos**; guardia de contrato contra
  utilidades de `display` en `TabsContent`.
- **R7** — `isLoading`/`isError` a las cuatro secciones; en `AnswersSection` la cabecera (toggle de
  razonamiento) y "Ver histórico completo" permanecen montados en los cuatro estados.
- **R8** — Eliminación de `AdvancedSection` + limpieza documental acotada; `Disclosure` se conserva.
- **R9** — Specs desambiguados con `within`/`aria-label`/`data-testid` por el anidamiento de tablists.
- **R10** — Alternativas del RFC (footer fijo, sticky, scroll horizontal, rejilla, sin encabezados,
  override en el call site, renombrar "Respuestas", badges, `manual`) siguen descartadas.

## Phase 1 — Design & Contracts (salida)

- [data-model.md](./data-model.md): entidades de vista (pestaña, item, mapa de secciones, estado),
  ciclo de vida de la pestaña, máquina de estados de cada panel, estructura del detalle y reglas de
  validación por FR.
- [contracts/inspector-section-tabs-contract.md](./contracts/inspector-section-tabs-contract.md):
  contrato nuevo (§1 estructura y orden, §2 ARIA y teclado, §3 contrato interno, §4 estado, §5 estados
  de panel, §6 primitivo compartido con foco/contraste/wrap, §7 superficie congelada y limpieza
  documental, §8 contrato de regresión). Sustituye los documentos superseded de `specs/004`/`specs/010`.
- [quickstart.md](./quickstart.md): escenarios ejecutables (specs del hook/componente, estados de las
  cuatro secciones, primitivo y regresión de `Detalle | Chat`, orden del resumen, batería completa y
  la verificación en navegador —`forced-colors`, 280/720 px, revisión visual del tablist externo— que
  queda como deuda explícita porque jsdom no la puede cubrir).

**Gate post-diseño**: PASS (ver tabla de la Constitución y research R1–R10).

## Phase 2 — Tasks

Fuera de este comando (`/speckit.tasks`). El reparto esperado por historia:
US1/US2 → hook + `InspectorSectionTabs` + `InspectorPanel`; US3 → retirada de `AdvancedSection` y
`Record` de secciones; US4/US5/US7 → primitivo `ui/tabs.tsx` + `tabs.a11y.spec.tsx`; US6 → estados en
las cuatro secciones; FR-010 → los dos documentos superseded y los comentarios del código tocado.
