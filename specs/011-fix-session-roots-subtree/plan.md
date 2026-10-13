# Implementation Plan: Raíces de sesión siempre listables, subárbol completo y paralelismo por invocación

**Branch**: `011-fix-session-roots-subtree` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-fix-session-roots-subtree/spec.md`
Diseño de entrada: [discovery/rfc.md](./discovery/rfc.md) · Alcance original: [discovery/pedido.md](./discovery/pedido.md)

## Summary

El visor pide la lista de sesiones con `limit= 200` y **sin** filtrar por padre
(`session.service.ts:59-66`), así que las 448 hijas del proyecto desplazan a la
mayoría de las 38 raíces fuera de la ventana (medición 2026-10-12: `limit=200` →
15-16 raíces; `parentID=null` → 38 raíces). Las raíces desaparecidas quedan
inaccesibles: el `directory` se resuelve solo desde `items` (`WorkspacePage.tsx:137-142`),
`useGraphStructure` fuerza `isLoading` con `directory` nulo (`:151`) y la pantalla
queda en un skeleton terminal. El grafo hace BFS sobre esa misma lista truncada y
el paralelismo agrupa por solape de **sesiones**, de modo que una hija reutilizada
en varios pasos fusiona pasos secuenciales.

El plan separa la **lista de raíces** de la **estructura del grafo** (claves y
servicios distintos, D1), resuelve el `directory` con `session.get` como respaldo
(D4), carga el **subárbol bajo demanda** desde la raíz (E2), convierte la unidad de
paralelismo en la **invocación** alimentando filas y badge (E4) y completa la
sección de skills del Inspector (E5). Toda la lógica nueva es pura y testeable
(Principio V); los datos siguen fluyendo por TanStack Query y el SDK solo se toca en
`*.service.ts` (Principio III).

## Technical Context

**Language/Version**: TypeScript (strict) · React 19 · Vite 8

**Primary Dependencies**: `@tanstack/react-query` 5, `@opencode/client` (SDK), React Router 7, React Hook Form + Zod, Tailwind 4 + shadcn/ui (Radix), React Flow (`@xyflow/react`) + dagre, sonner. **Sin dependencias nuevas.**

**Storage**: N/A — la app es de solo lectura sobre el servidor de OpenCode (proxy Vite `/oc`); no hay backend propio ni persistencia local.

**Testing**: Vitest + Testing Library + jsdom (specs en `specs/` junto al código, Principio VIII).

**Target Platform**: navegador (web app responsive, mobile-first, `useDevice`).

**Project Type**: aplicación web frontend (sin backend).

**Performance Goals**: el listado baja de 200 a las 38 raíces del proyecto (payload −81 %); el subárbol del bosque medido es **1 request por raíz**; el refresco por evento no se encarece respecto del actual (FR-015); techo de fluidez ~200 agentes de la spec `006`; sin re-layout por tick ni por eventos no estructurales (Principio VII).

**Constraints**: sin dependencias nuevas; no tocar `.specify/` ni la constitución; SDK solo en `*.service.ts`; tipos derivados del SDK (Principio IV); estados de pantalla explícitos y sin skeleton terminal (Principio VI); paginación por cursor con tope acotado; presupuesto **global** de nodos/requests por carga de subárbol; árbol medido **plano** (sin nietos) — se soporta profundidad pero se valida con el bosque medido.

**Scale/Scope**: 4 dominios (`Sessions`, `Graph`, `Inspector`, `History`) + `Infrastructure`; store medido 486 sesiones / 38 raíces / 448 hijas, raíz mayor 109 hijos, 0 nietos, 0 casos `background`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Nota |
|---|---|---|
| I. Observador con modo interactivo | ✅ | Solo lectura; no se envía ninguna acción nueva al server. |
| II. Arquitectura por dominios | ✅ | Cada cambio vive en su dominio; el data-fetching cross-domain queda en `Infrastructure/WorkspacePage.tsx`. `SUBAGENT_TOOLS` se **duplica** en `Graph/lib/invocations.ts` en lugar de deep-importar de `Inspector/lib` (RFC). |
| III. Datos SOLO vía TanStack Query | ✅ | El SDK se toca únicamente en `Services/*.service.ts` (`listRootSessions`, `listChildSessions`, `getSession`); hooks y componentes consumen queries por `queryKeys`. |
| IV. Tipos derivados del SDK | ✅ | `TSubtreeLoadResult`/`TInvocation`/`TSkillUsage` son tipos de **vista** (prefijo `T`); las entidades crudas siguen siendo `SessionInfo`/`SessionMessageInfo` del SDK, sin redefinir. |
| V. Lógica pura y testeable | ✅ | `sessionPagination`, `subtree.ts`, `deriveInvocations`, `deriveInvocationBatches`, `deriveSkills`, `filterSubtree` son funciones puras con specs; los hooks solo componen. |
| VI. Estados de pantalla obligatorios | ✅ | `isLoading`/`isError` combinan directorio+estructura; se añade "no encontrada" con salida; nunca skeleton terminal (US2/US3, FR-004/005). |
| VII. Rendimiento en tiempo real | ✅ | Sin consultas de contenido nuevas; el subárbol se memoiza por id y por firma de lotes en `deriveExecutionKey`; eventos no estructurales no relayoutan. |
| VIII. Convenciones de repositorio | ✅ | Specs en `specs/` junto al código; commits Conventional Commits; TS/ESLint strict. |

**Gates**: sin violaciones. `Complexity Tracking` no aplica.

## Project Structure

### Documentation (this feature)

```text
specs/011-fix-session-roots-subtree/
├── plan.md                 # Este archivo
├── research.md             # Phase 0 (decisiones R1–R12)
├── data-model.md           # Phase 1 (entidades de vista)
├── quickstart.md           # Phase 1 (escenarios de validación)
├── contracts/              # Phase 1 (contratos de interfaz de la feature)
│   ├── README.md
│   ├── session-roots-contract.md
│   ├── subtree-structure-contract.md
│   ├── invocation-lanes-contract.md
│   └── inspector-skills-contract.md
├── checklists/
└── discovery/              # rfc.md, pedido.md, prd.md (insumos)
```

### Source Code (repository root)

```text
src/
├── Infrastructure/
│   ├── Services/
│   │   ├── session.service.ts             # + listRootSessions, listChildSessions, getSession
│   │   └── lib/sessionPagination.ts       # NUEVO (cursor, patrón messagePagination)
│   ├── WorkspacePage.tsx                  # directory: items → session.get → null
│   ├── Components/GraphPane.tsx           # orden de estados + GraphTruncationBanner
│   └── Hooks/useSessionOpenPerf.ts        # reapuntar a la key nueva del subárbol
├── Application/Components/Molecules/
│   ├── GraphTruncationBanner.tsx          # NUEVO (Alert warning, role="status")
│   └── ResourceRow.tsx                    # items: { label, note? }[]
└── Domains/
    ├── queryKeys.ts                       # + sessions.roots(directory), sessions.children(parentID)
    ├── Sessions/Hooks/useRootSessions.ts  # consume listRootSessions; memo items/groups
    ├── History/History.service.ts         # − useSessionInfo (código muerto)
    ├── Sessions/Hooks/useSelectSession.ts # − (borrado) + su spec
    ├── Graph/
    │   ├── Hooks/useGraphStructure.ts     # origen = subárbol; estados honestos
    │   ├── Hooks/useGraphModel.ts         # notFound aditivo
    │   ├── lib/loadPlan/subtree.ts        # NUEVO cargador (reutiliza ancestorChain)
    │   ├── lib/invocations.ts             # NUEVO deriveInvocations/deriveInvocationBatches
    │   ├── lib/execution/executionKey.ts  # + firma de lotes
    │   ├── lib/execution/deriveExecutionLevels.ts   # NUEVO niveles/tandas (desvío U37)
    │   ├── lib/execution/deriveExecutionLayout.ts   # NUEVO layout final (desvío U37)
    │   ├── lib/parallelism.ts             # deriveSiblingBatches como respaldo
    │   └── lib/parallelByNode.ts          # fusión invocación (gana) / sesión (respaldo)
    └── Inspector/
        ├── lib/deriveSkills.ts            # NUEVO
        ├── lib/deriveResources.ts         # skills: TSkillUsage[]
        ├── InspectorResources.entity.ts   # TResourceUsage.skills extendido
        └── Components/ResourceList.tsx    # nombre · ~N tokens; "Sin skills cargadas"
```

**Nota (desvío U37)**: `lib/execution/deriveExecutionLevels.ts` (plan de niveles/tandas) y `lib/execution/deriveExecutionLayout.ts` (layout final: posiciones, grupos paralelos y badge) no figuraban en el schedule inicial y se implementaron igualmente al extraer las lanes por invocación; quedan documentados aquí para que el mapa de código refleje lo entregado. Son módulos del dominio `Graph`, así que no alteran la Structure Decision.

**Structure Decision**: se conserva la estructura por dominios vigente (`src/Domains/[Domain]/` con `entity/service/routes/router/Components/Hooks/Pages`); los cambios son aditivos dentro de los dominios existentes y de `Infrastructure`. No se crean dominios nuevos ni se mueve responsabilidad cross-domain: el data-fetching que cruza dominios ya vive en `WorkspacePage.tsx`.

## Entregables de actualización de contrato

Son parte del alcance del plan (FR-013/FR-014), no extras:

- **`specs/006-graph-render-performance/`** — 4 archivos:
  1. `contracts/graph-loading-contract.md` §1.1: "Entradas de red: ninguna nueva" deja de ser cierto; se distingue **consultas estructurales de sesiones** (subárbol) de **consultas de contenido**.
  2. `data-model.md`: línea 16 (fuente `sessions.list`) y línea 135 (queryKeys "sin cambios").
  3. `plan.md`: línea 41 (scope reutilizado) y línea 102 (queryKeys sin cambios).
  4. `research.md`: líneas 28 y 132 ("no cambiar la forma de `queryKeys`"). *Anotar* `tasks.md:152,277` (histórico).
- **`specs/007-fix-parallel-lanes-live/`** — 4 archivos:
  1. `spec.md`: FR-001 (l.82), FR-005 (l.86), FR-010 (l.91) y Edge Cases l.113 — la unidad pasa de sesión a **invocación**.
  2. `contracts/execution-lanes-contract.md` §2/§6: agrupación por invocación + paridad fila↔badge.
  3. `data-model.md`: l.29 (`TParallelGroup`), l.104, l.108.
  4. `research.md`: l.23-33 ("una sola lógica de intervalos"). *Anotar* `plan.md:19-21` y `quickstart.md:43`.

Se documenta explícitamente que **la paridad exigida es fila ↔ badge, no barra ↔ fila**: la barra temporal del nodo mantiene el intervalo de sesión.

## Complexity Tracking

> Sin violaciones a la constitución; tabla no aplica.

## Project Structure — Fases de ejecución

| Etapa | Alcance | Cubre |
|---|---|---|
| E1 | Lista de raíces paginada por cursor (`listRootSessions`) + key nueva + `directory` con respaldo | US1, US2, FR-001/002/003/015 |
| E2 | Subárbol bajo demanda (`subtree.ts`) + estados honestos + banner de truncamiento | US2, US3, US4, FR-004/005/006/013 |
| E3 | Tests de invariantes (paginación, roots, subárbol, paridad) y actualización de specs en riesgo | SC-008 |
| E4 | Paralelismo por invocación (filas + badge) + firma de lotes en la clave | US5, FR-007/008/011/012/014/016 |
| E5 | Skills cargadas en el Inspector | US6, FR-009/010 |

E1+E2 se implementan en el **mismo cambio** para no dejar dos refrescos por evento (riesgo de staging del RFC). E4 y E5 son independientes; E4 conviene después de E2.
