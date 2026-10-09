# Implementation Plan: Live Node Feedback, Effort Levels & Detail Panel UX

**Branch**: `008-node-effort-inspector-ux` | **Date**: 2026-10-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-node-effort-inspector-ux/spec.md` (+ [design-direction.md](./design-direction.md))

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Una sola feature con **seis mejoras de UX** sobre el visor de solo lectura, todas en el cliente:

1. **Animación "pensando"** (US2): barrido de brillo **CSS puro** que recorre el `NodeStatusRail` de un nodo activo, en bucle, sobre el color de actividad. No añade filas ni estado por nodo; con `prefers-reduced-motion` queda en color sólido estático.
2. **Follow al nodo activo más reciente** (US3): el seguimiento deja de apuntar al *primer* activo y pasa a enfocar el activo que **empezó más tarde** (mayor `activityStartOf` = hora de inicio de ejecución, con `createdAt` como último recurso). Se deriva un `latestActiveNodeId` puro en `useGraphModel` y `useFollowMode` lo consume sin cambiar su firma; sin nodos activos el viewport no se mueve.
3. **Resize del panel de detalle** (US5): separador vertical de 4 px (zona de agarre 12 px) con arrastre y **teclado** (`role="separator"`), ancho acotado por mínimo/máximo y **persistido** en `localStorage`.
4. **Fullscreen del panel** (US6): botón de expandir/colapsar en el encabezado del panel; ocupa el área de trabajo conservando encabezado y los cuatro estados de pantalla; cierra con el mismo control y con `Escape`; **no se persiste**.
5. **Diff estilo VSCode** (US4): parser **puro** del `patch` unificado → hunks con rango, canal doble de números (viejo/nuevo), fondo por línea (añadido/eliminado) desde tokens, hunks colapsables **expandidos por defecto** y estado del archivo como punto LED.
6. **5 niveles de esfuerzo por nodo** (US1): medidor de 5 muescas en el **encabezado del nodo, en la fila existente del badge de paralelos** (no altera filas ni `cardHeight` salvo el ancho reservado). Nivel **acumulativo** (base 1, +1 por paralelos lanzados, +1 por superar 2× el más rápido de su línea, +2 por forma alta —hijos e invocaciones—; tope 5, con el nivel 5 alcanzable), **provisional** mientras su línea está en curso, de **solo lectura** y con descripción accesible.

La dirección visual ya cerrada en `design-direction.md` se incorpora como sección de diseño: **el color codifica estado; la cantidad codifica esfuerzo**. El medidor de 5 muescas es la *signature*; el acento `--primary` es exclusivo del esfuerzo y los LEDs de estado no se usan para esfuerzo. No se introduce identidad paralela.

El enfoque técnico evita las trampas de recon: el campo nuevo `effort` **se añade al comparador de reconciliación** (`sameNodeData`); el medidor va en una **fila existente** del nodo (con `STATUS_WIDTH` ajustado en `cardHeight`); la derivación de esfuerzo vive en el memo final del grafo y solo reconstruye el objeto de un nodo cuando su duración o nivel cambian (**identidad/memoización por `deriveExecutionKey` intacta**); toda animación es CSS puro con variante estática. No se añaden dependencias ni red.

## Technical Context

**Language/Version**: TypeScript 5.6 (`strict`) + React 19

**Primary Dependencies**: Vite 8, TanStack Query 5, React Router 7, Tailwind 4 + shadcn/ui (Radix), `@xyflow/react` 12 + `@dagrejs/dagre`, `lucide-react`, `@opencode/client` 2.0.22. **No se añaden dependencias.**

**Storage**: `localStorage` para **un solo** valor de UI: el ancho del panel de detalle (persistido entre sesiones, FR-010). El resto es estado de vista en memoria (TanStack Query + estado local); el fullscreen **no** se persiste. Nada se envía al servidor (Principio I).

**Testing**: Vitest 2 + Testing Library + jsdom; specs junto al código en carpetas `specs/` (Principio VIII); fixtures existentes (`lib/specs/fixtures.ts`, `__fixtures__/run.ndjson`); `renderWithProviders` / `QueryClientProvider` para hooks; tests de lógica pura para parser de diff, niveles de esfuerzo, selección del activo más reciente, clamp del ancho y comparador de reconciliación.

**Target Platform**: Navegador moderno de escritorio (Chromium/Firefox/Safari) con presentación responsive en móvil, igual que el resto de la app.

**Project Type**: Aplicación web single-page (solo frontend; el backend es el servidor de OpenCode existente, de solo lectura, Principio I).

**Performance Goals**: SC-006 — con ejecuciones del orden de **150 nodos** el coste de las nuevas marcas y animaciones **no debe ser perceptible**: la animación es CSS puro (sin JS por frame); la derivación de esfuerzo es O(n) por tick y solo reconstruye objetos de nodo cuando cambian (identidad estable); no se re-layouta por tick ni por eventos no estructurales (memo por `deriveExecutionKey`). SC-001/SC-002 — lectura en < 2 s (animación perceptible, medidor legible de un vistazo). SC-004 — diff de hasta 20 archivos legible en < 1 s (parser lineal, sin dependencias).

**Constraints**: solo lectura (Principio I); SDK **solo** desde `*.service.ts` y datos vía hooks (Principio III); lógica de negocio en hooks/funciones puras, **no** en componentes (AGENTS §4); tipos con prefijo `T` (Principio IV); orden de estados de pantalla error→carga→vacío→datos (Principio VI); animaciones CSS puras con variante `prefers-reduced-motion`; **tokens** en vez de hex suelto y `<Container>` en vez de `div` con flex (AGENTS §8, design-direction §5); todo control nuevo operable por teclado y accesible (SC-007); **un campo nuevo del nodo es invisible si no se actualiza `sameNodeData`**; el medidor no añade filas (o se ajusta `cardHeight`).

**Scale/Scope**: subárboles típicos de ~50 agentes, techo objetivo ~150-200. Dominios tocados: `Domains/Graph` (animación, follow, esfuerzo, comparador, `cardHeight`), `Domains/Inspector` (parser y render del diff, encabezado/fullscreen del panel), `Infrastructure` (layout del panel: resize + fullscreen, wiring), `Application` (helper puro de ancho, tokens de animación). Sin cambios de backend, de contrato del SDK ni del stream SSE.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Cumplimiento | Evidencia |
|---|-----------|--------------|-----------|
| I | Observador de solo lectura | ✅ PASS | Las seis mejoras son de presentación/estado de vista local. No se envían prompts, no se abortan sesiones, no se responden permisos. El diff solo **lee** `getSessionDiff` (ya existente). El ancho vive en `localStorage`, nunca en el servidor. |
| II | Arquitectura por dominios funcionales | ✅ PASS | Esfuerzo/follow/animación en `Domains/Graph`; diff y encabezado del panel en `Domains/Inspector`; la disposición del panel (resize/fullscreen) en `Infrastructure/Components`; el helper de clamp puro en `Application/Helpers`. Sin dominios nuevos ni imports cruzados desde componentes (el wiring cross-domain queda en `WorkspacePage`/hooks). |
| III | Datos del servidor SOLO vía TanStack Query | ✅ PASS | No se añade ninguna llamada al SDK. El diff reutiliza `useSessionDiff` (`Inspector.service.ts`), que sigue siendo el único punto que toca `opencodeService`. Los componentes nuevos reciben datos ya derivados por hooks/props puros. |
| IV | Tipos derivados del SDK | ✅ PASS | `TFileChange` sigue aliaseando `FileDiffInfo`; los tipos de parser (`TDiffHunk`, `TDiffLine`) son **tipos de vista** con prefijo `T`, no redefiniciones del SDK. `TNodeEffort` es un tipo de vista puro. |
| V | Lógica pura y testeable | ✅ PASS | Son puras: `deriveEffortByNode`, `latestActiveNodeId`, `parseUnifiedDiff`, `clampPanelWidth`, y el nuevo comparador `sameEffort`. Se testean sin React (SC-008) con specs propias. |
| VI | Estados de pantalla obligatorios | ✅ PASS | El fullscreen conserva el estado correcto error→carga→vacío→datos (se reutiliza el mismo `InspectorPanel`/`FileChanges`, no se duplica render). El panel vacío (`InspectorEmptyPrompt`) se mantiene en ambas presentaciones. |
| VII | Rendimiento en tiempo real | ✅ PASS | Animación 100% CSS (sin JS por frame); esfuerzo O(n) con identidad de nodo estable (solo se reconstruye el objeto cuando cambia duración o nivel); el plan/paralelismo siguen memoizados por `deriveExecutionKey`; el tick no relayouta. El diff se parsea una vez por archivo seleccionado (memo). |
| VIII | Convenciones de repositorio | ✅ PASS | Specs en `specs/` junto al código; Conventional Commits; ESLint/TypeScript strict; sin dependencias nuevas; tokens en vez de hex. |

**Resultado inicial**: 8/8 PASS. Sin violaciones. No se requiere *Complexity Tracking*.

**Re-check post-diseño (Phase 1)**: 8/8 PASS. Los contratos confirman: solo lecturas (I); cada artefacto en su dominio (II); sin SDK nuevo en componentes (III); tipos `T` de vista sobre el alias del SDK (IV); cinco piezas puras cubiertas por specs (V); mismos estados de pantalla (VI); animación CSS + esfuerzo O(n) con identidad estable + diff memoizado (VII); specs junto al código (VIII). El ajuste de `STATUS_WIDTH` en `cardHeight` y la inclusión de `effort` en `sameNodeData` son las dos salvaguardas explícitas del recon.

**Nota fuera de alcance (D1)**: como en 006/007, la Constitución (Principios II/IV) menciona la carpeta `entity/` y el paquete `@opencode-ai/sdk`, mientras el repositorio usa `lib/` y `@opencode/client`. Deriva **preexistente** y ajena a esta feature; no se corrige aquí.

## Project Structure

### Documentation (this feature)

```text
specs/008-node-effort-inspector-ux/
├── plan.md              # This file (/speckit.plan command output)
├── design-direction.md  # Dirección visual (pasada previa del orquestador)
├── research.md          # Phase 0 output (decisiones resueltas)
├── data-model.md        # Phase 1 output (entidades de vista y reglas)
├── quickstart.md        # Phase 1 output (guía de validación)
├── checklists/
│   └── requirements.md  # Calidad de la especificación (ya existe)
├── contracts/           # Phase 1 output
│   ├── README.md
│   ├── active-node-feedback-contract.md
│   ├── effort-contract.md
│   ├── inspector-panel-contract.md
│   └── file-diff-contract.md
├── spec.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── Application/
│   ├── Helpers/
│   │   ├── panelWidth.ts                       # NUEVO (puro) clamp + constantes MIN/MAX/DEFAULT/STEP
│   │   └── specs/
│   │       └── panelWidth.spec.ts              # NUEVO
│   └── Components/Molecules/index.ts           # (extender) export de EffortMeter? (ver nota)
│
├── index.css                                   # (extender) @keyframes rail-scan + .rail-scan
│
├── Domains/
│   ├── Graph/
│   │   ├── Graph.entity.ts                     # (extender) TNodeEffort + campo effort
│   │   ├── lib/
│   │   │   ├── activeNode.ts                   # NUEVO (puro) latestActiveNodeId(model)
│   │   │   ├── effort/
│   │   │   │   ├── deriveEffort.ts             # NUEVO (puro) niveles 1..5 + provisional + razones
│   │   │   │   └── constants.ts                # NUEVO umbrales (forma alta, tope)
│   │   │   ├── cardHeight.ts                   # (ajustar) STATUS_WIDTH reserva el medidor
│   │   │   └── reconcile/comparators.ts        # (extender) sameEffort + sameNodeData
│   │   ├── Components/
│   │   │   ├── EffortMeter.tsx                 # NUEVO medidor de 5 muescas (solo lectura)
│   │   │   ├── NodeStatusRail.tsx              # (extender) clase de barrido si activo
│   │   │   ├── AgentNodeHeader.tsx             # (extender) medidor en la fila existente
│   │   │   ├── AgentNode.tsx                   # (extender) pasa data.effort
│   │   │   └── index.ts                        # (extender) barrel
│   │   ├── Hooks/
│   │   │   ├── useGraphModel.ts                # (extender) latestActiveNodeId + effort en el memo final
│   │   │   └── specs/
│   │   │       ├── useGraphModel.spec.tsx      # (extender) latestActiveNode + identidad
│   │   │       └── useFollowMode.spec.tsx      # (extender) reacciona a cambio de activo
│   │   └── lib/specs/
│   │       ├── effort.spec.ts                  # NUEVO
│   │       ├── activeNode.spec.ts              # NUEVO
│   │       ├── reconcileGraph.spec.ts          # (extender) sameEffort
│   │       └── cardHeight.spec.ts              # (extender) medidor
│   │
│   └── Inspector/
│       ├── Inspector.entity.ts                 # (extender) tipos de vista del diff
│       ├── lib/
│       │   ├── parseDiff.ts                    # NUEVO (puro) patch unificado → hunks
│       │   └── specs/
│       │       └── parseDiff.spec.ts           # NUEVO
│       ├── Components/
│       │   ├── FileDiff.tsx                    # NUEVO render estilo editor
│       │   ├── FileChanges.tsx                 # (extender) usa FileDiff
│       │   ├── InspectorPanel.tsx              # (extender) encabezado + fullscreen
│       │   └── specs/
│       │       ├── FileDiff.spec.tsx           # NUEVO
│       │       ├── FileChanges.spec.tsx        # (extender)
│       │       └── InspectorPanel.spec.tsx     # (extender) fullscreen
│       └── index.ts                            # (extender) barrel
│
└── Infrastructure/
    ├── Hooks/
    │   ├── useInspectorPanel.ts                # NUEVO resize persistido + fullscreen efímero
    │   └── specs/
    │       └── useInspectorPanel.spec.tsx      # NUEVO
    ├── Components/
    │   ├── WorkspaceLayout.tsx                 # (extender) separador + ancho + overlay fullscreen
    │   ├── InspectorPane.tsx                   # (extender) reenvía props de fullscreen
    │   └── specs/                              # (extender) layout/fullscreen
    ├── WorkspacePage.tsx                       # (extender) wiring hook + Escape de fullscreen
    └── specs/WorkspacePage.spec.tsx            # (extender) resize/fullscreen
```

**Structure Decision**: Single project (frontend SPA). Se conserva el scaffolding `entity/lib/Components/Hooks/index` de `AGENTS.md`. La feature se reparte por responsabilidad: (a) **Graph** posee el nodo, su efecto visual, el follow y la derivación de esfuerzo, que depende del plan/paralelismo ya residentes en `lib/execution` y `lib/parallelism`; (b) **Inspector** posee el diff y el contenido del panel, porque es quien ya consume `FileDiffInfo`/`TFileChange`; (c) **Infrastructure** posee la disposición del workspace (columnas, separador, overlay), porque es donde ya vive `WorkspaceLayout`; (d) **Application** aporta el helper puro de ancho y los keyframes globales. No se crean dominios ni se mueve lógica fuera de su dominio. El estado de UI (ancho/fullscreen) se cablea en `WorkspacePage`, no en componentes de presentación.

**Nota sobre el barrel de componentes**: `EffortMeter` es una pieza pura de presentación del nodo. Si se reutiliza desde otro punto se exporta por el barrel de `Graph/Components` (su dominio). No se promueve a `Application/Components/Molecules` salvo que aparezca un segundo consumidor; la ruta `src/Application/Components/Molecules/index.ts` de la tabla es **condicional** y se decide en `tasks`. Se deja anotado para no romper encapsulamiento.

## Design Direction — incorporada (`design-direction.md`)

La dirección visual cerrada por el orquestador se adopta como parte del plan. Resumen operativo:

- **Principio cromático**: **el color codifica estado; la cantidad codifica esfuerzo.** `--primary` (naranja, `24 92% 49%`) es **exclusivo** del medidor de esfuerzo. Los LEDs de estado (`--status-running/-waiting/-done/-error/-idle`) no se usan para esfuerzo, y el naranja no se usa para estado. Así los dos sistemas no compiten.
- **Signature — el medidor de 5 muescas**: cinco marcas discretas; las encendidas en `--primary` indican el nivel. Se lee como regleta de carga, no como pastilla de color. Es el único elemento "con voz" del nodo; el rail, el badge de paralelos y las métricas se mantienen callados.
- **Tipografía**: Inter para UI; **JetBrains Mono con números tabulares** para todo lo numérico (nivel, duración, números de línea y rangos de hunk del diff).
- **Nodo activo**: barrido de brillo sobre el rail en color de actividad; estático con `prefers-reduced-motion`; **sin filas nuevas**.
- **Resize**: separador `--surface-2` en reposo → `--status-running` al arrastrar; foco visible global (`:focus-visible`).
- **Fullscreen**: `--surface-0` de fondo a pantalla completa, conservando encabezado y estados.
- **Diff**: fondo por línea `--status-done`/`--status-error` a ~14 % de alfa + borde izquierdo; canal doble de números en mono tabular `--muted-foreground`; encabezado de hunk en `--surface-2` con rango `@@ -a,b +c,d @@` y chevron; expandido por defecto; estado del archivo como punto LED.
- **Respuestas por defecto evitadas**: insignias de color por nivel, `animate-pulse` como "pensando", y diff de solo verde/rojo. Se sustituyen por muescas en un único acento, barrido direccional sobre el rail y formato real de editor.
- **Contención**: una sola cosa con voz por nodo (el medidor); el resto en la paleta existente y sin decoración.

## Complexity Tracking

> No hay violaciones de la constitución. Sección no aplica.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
