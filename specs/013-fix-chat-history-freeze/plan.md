# Implementation Plan: Histórico de sesiones en espera de respuesta sin congelar la interfaz

**Branch**: `013-fix-chat-history-freeze` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-fix-chat-history-freeze/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Abrir el histórico de una sesión en estado `waiting-input` bloquea la interfaz: el
histórico queda inutilizable justo en el caso en el que más se usa. La causa
verificada está en el índice reactivo `useCachedForms` de
`src/Domains/Chat/Hooks/useSessionAttention.ts`: su suscripción a la `QueryCache`
(a) casa por **prefijo** la clave `sessions.questions(id)` (= `[...forms(id), 'questions']`)
y (b) `read()` devuelve **siempre un objeto nuevo**, de modo que cada notificación
—incluidas las `observerOptionsUpdated`, que no son cambios de dato— provoca
`setForms` → render → `observer.setOptions` → notificación → ∞ (React:
"Maximum update depth exceeded").

El arreglo es local, de comportamiento nulo fuera del defecto, y consta de tres
piezas mínimas en el propio hook: **filtro por clave exacta** (no por prefijo),
**estabilidad referencial del índice** (`setForms` se salta si el dato no cambió,
Principio VII) y **solo eventos portadores de dato** (ignorar los eventos
estructurales de observador). El contenido observable del histórico —incluidas
las preguntas de sesiones hijas que alimentan los badges de atención— no cambia:
los `FormInfo` siguen leyéndose de `sessions.forms(id)` y enriqueciéndose igual.

Se añade la regresión que hoy cuelga (US4/FR-006): una prueba de integración que
abre el histórico de un nodo `waiting-input` y una prueba unitaria acotada que
reproduce la tormenta de notificaciones sin bloquear la suite.

## Technical Context

**Language/Version**: TypeScript 5 (strict) sobre React 19

**Primary Dependencies**: React 19, TanStack Query 5 (`QueryCache`/`QueryObserver`), Vite 8, Vitest + Testing Library + jsdom

**Storage**: N/A — toda la caché es en memoria (`QueryClient`); no hay persistencia

**Testing**: Vitest (`vitest.config.ts`, `include: src/**/*.{test,spec}.{ts,tsx}`), Testing Library, jsdom. No hay `testTimeout` global (por defecto 5 s), por eso la regresión acota su propio timeout (ver research R4)

**Target Platform**: Aplicación web (Vite) que se ejecuta en el navegador; sin backend propio

**Project Type**: Web application (frontend SPA por dominios, `src/Domains/[Domain]/`)

**Performance Goals**: Abrir el histórico de una sesión `waiting-input` termina sin bloqueo observable del hilo principal ni consumo sostenido de CPU (SC-001/SC-002); el número de renders por notificación de caché deja de crecer sin progreso

**Constraints**: Sin cambios de UI, copy ni superficie pública (FR-007); sin cambios en `queryKeys.ts`, `Inspector.service.ts`, barrels ni `data-testid`; las 4 suites protegidas de `012-refactor-workspace-enrichment` y `src/Domains/Chat/Hooks/specs/**` no deben regresar (FR-009)

**Scale/Scope**: Un fichero de producto (`src/Domains/Chat/Hooks/useSessionAttention.ts`) + sus specs del dominio Chat. Alcance de producto: `src/Domains/Chat/`. Sin red adicional ni nuevas claves de caché

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Verificación | Veredicto |
|---|---|---|
| I. Observador con modo interactivo | No se toca el modo de escritura ni el acceso al dev server; la corrección es de lectura/render | PASS |
| II. Arquitectura por dominios | El cambio vive en `src/Domains/Chat/Hooks/`; no se cruzan dominios ni responsabilidades | PASS |
| III. Datos del servidor solo vía TanStack Query | Se conserva `getQueryData`/`QueryCache.subscribe`; no se añade acceso al SDK ni a estado propio fuera de Query | PASS |
| IV. Tipos derivados del SDK | Se mantiene `FormInfo` de `@opencode/client`; no se redefinen tipos del SDK | PASS |
| V. Lógica pura y testeable | La regresión unitaria y de integración reproducen el defecto con funciones reales; el filtro por clave es determinista y testeable | PASS |
| VI. Estados de pantalla obligatorios | No se alteran los estados del histórico ni del Chat | PASS |
| VII. Rendimiento en tiempo real | Núcleo del arreglo: eliminar el reciclado de render por notificación y garantizar identidad estable del índice (`setForms` se salta si el dato no cambió) | PASS |
| VIII. Convenciones de repositorio | Specs en `specs/` junto al código, incluida la de caso negativo (notificación sin cambio de dato); Conventional Commits | PASS |

**Gate pre-Phase 0**: PASS — sin violaciones que justificar (Complexity Tracking vacío).

## Project Structure

### Documentation (this feature)

```text
specs/013-fix-chat-history-freeze/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── attention-forms-subscription.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── Domains/
│   ├── Chat/
│   │   ├── Hooks/
│   │   │   ├── useSessionAttention.ts          # ÚNICO fichero de producto a tocar (fix)
│   │   │   └── specs/
│   │   │       ├── useSessionAttention.spec.tsx     # spec existente: se AÑADE la regresión unitaria
│   │   │       ├── useChatController.spec.tsx       # protegida: no regresar
│   │   │       ├── useChatAutoScroll.spec.tsx       # protegida: no regresar
│   │   │       ├── useChatDraft.spec.tsx            # protegida: no regresar
│   │   │       └── useAttentionNotifications.spec.tsx # protegida: no regresar
│   │   └── Chat.service.ts                     # sin cambios
│   ├── queryKeys.ts                            # sin cambios (clave anidada documentada)
│   └── Inspector/Inspector.service.ts          # sin cambios (useSessionForms / sessions.questions)
└── Infrastructure/
    └── specs/integration/
        ├── harness.tsx                              # reutilizado, sin cambios
        ├── enrichmentSeeding.integration.spec.tsx   # frontera del hallazgo F2 (cita el bucle)
        ├── workspaceHistoryData.integration.spec.tsx # cubre el cableado del overlay (T022)
        └── workspaceHistoryWaitingInput.integration.spec.tsx # NUEVO: regresión que hoy cuelga (US4)
```

**Structure Decision**: Single project (SPA por dominios, opción única del repo).
El cambio de producto se limita a `src/Domains/Chat/Hooks/useSessionAttention.ts`.
La regresión de producto se apoya en el arnés de integración existente
(`src/Infrastructure/specs/integration/harness.tsx`), que conserva **reales**
`useSessionAttention` (barrel Chat) y `useSessionForms` (barrel Inspector) y solo
sustituye los componentes pesados por marcadores; así el clic "Abrir histórico"
reproduce el bucle exacto sin reimplementar nada.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Sin violaciones. No se añaden proyectos, capas ni dependencias.

## Phase 0 — Outline & Research (salida)

Resumen; detalle en `research.md`:

- **R1 — Filtro de suscripción**: clave **exacta** `['sessions','forms',id]` (no prefijo). `sessions.questions(id)` se anida bajo `forms(id)` a propósito para que la invalidación por prefijo de los eventos `form.*` la alcance; la suscripción no debe heredar ese prefijo. Alternativas (mover la clave de preguntas, filtrar por longitud) rechazadas.
- **R2 — Identidad del índice**: `read()` devuelve la referencia previa cuando las listas por sesión son las mismas (comparación por referencia de cada `FormInfo[]`), de modo que `setForms` no provoca render si el dato no cambió (Principio VII).
- **R3 — Eventos**: reaccionar solo a eventos portadores de dato (`updated`), e ignorar `observerOptionsUpdated`/`observerResultsUpdated`/`observer*`. Son los que hoy cierran el bucle incluso sobre la clave exacta.
- **R4 — Prueba de regresión acotada**: unitaria en `useSessionAttention.spec.tsx` (monta el hook + un observador real sobre `sessions.questions(id)`) con `timeout` corto, y de integración que abre el histórico de un nodo `waiting-input`; ambas deben fallar hoy y pasar tras el fix, sin el cuelgue de >3 min (no hay `testTimeout` global).
- **R5 — Superficie congelada**: sin cambios en `queryKeys.ts`, `Inspector.service.ts`, barrels ni UI/copy.

## Phase 1 — Design & Contracts (salida)

- `data-model.md`: entidades `FormInfo`, índice `Record<string, FormInfo[]>`, clave anidada de caché, evento de suscripción y `TAttentionItem`; transiciones e invariantes de identidad.
- `contracts/attention-forms-subscription.md`: contrato interno del enriquecimiento (invariantes de clave exacta, identidad estable, solo-evento-de-dato y superficie congelada).
- `quickstart.md`: escenarios de validación runnable (unitario, integración, batería completa) con comandos y resultados esperados.

## Constitution Check (re-evaluación post-diseño)

*GATE: re-check después de Phase 1.*

| Principio | Verificación post-diseño | Veredicto |
|---|---|---|
| III. Datos solo vía TanStack Query | El diseño lee/escribe la caché con `getQueryData`/`QueryCache.subscribe`; cero SDK nuevo | PASS |
| V. Lógica pura y testeable | Filtro por clave determinista y regresión reproducible | PASS |
| VII. Rendimiento en tiempo real | Identidad estable + solo-evento-de-dato eliminan el reciclado de render | PASS |
| VIII. Specs junto al código + caso negativo | La regresión incluye el caso negativo "notificación que no cambia el dato → sin nuevo estado" | PASS |

**Gate post-diseño**: PASS — sin violaciones; Complexity Tracking sigue vacío.
