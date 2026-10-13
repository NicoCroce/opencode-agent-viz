# Línea base de no regresión — `014-inspector-detail-tabs`

**Feature**: `014-inspector-detail-tabs` | **Fecha**: 2026-10-13 | **Plan**: [plan.md](./plan.md)

Fija el verde de partida (**SC-004 «cero regresiones»**) y acota la superficie del primitivo compartido
antes de tocarlo. Sin esta fase no hay contra qué comparar (T001/T002). Cubre la línea base **de
pruebas**, la de **compuertas** y el **alcance del primitivo**.

- **Commit de partida**: `19ceb5073d759ba641003734bcd77bf1f06c68b5` (`git rev-parse HEAD`, rama `main`).
- **Entorno**: macOS (darwin), Node v22.12.0, pnpm; runner `vitest run` sobre `jsdom` (`vitest.config.ts`).
- Todos los comandos se ejecutan desde la raíz del repo.

---

## T001 — Línea base de pruebas

### Suite completa

`pnpm test` → `vitest run` (sin filtro de fichero).

| suite | fichero / alcance | nº tests | duración | estado |
|---|---|---|---|---|
| `pnpm test` | suite completa · 200 ficheros | 1991 passed + 1 skipped (1992) | 82.88 s | verde |

- **Total**: **200 ficheros, 1992 tests (1991 passed, 1 skipped), 0 fallos**.
- `Start at 16:13:05` · desglose `transform 7.56 s, setup 107.13 s, collect 100.76 s, tests 92.96 s, environment 190.82 s, prepare 27.79 s`.

### Subconjuntos del alcance de la feature

| suite | fichero / alcance | nº tests | duración | estado |
|---|---|---|---|---|
| `pnpm test -- src/Domains/Inspector` | 27 ficheros del dominio | 196 | 11.27 s | verde |
| `pnpm test -- tabs.a11y` | `src/Application/Components/ui/specs/tabs.a11y.spec.tsx` | 5 | 1.35 s | verde |
| `pnpm test -- InspectorPane.spec` | `src/Infrastructure/Components/specs/InspectorPane.spec.tsx` | 24 | 3.52 s | verde |
| `pnpm test -- WorkspaceLayout.spec` | `src/Infrastructure/Components/specs/WorkspaceLayout.spec.tsx` | 7 | 2.61 s | verde |
| `pnpm test -- WorkspaceMobileTabs.spec` | `src/Infrastructure/Components/specs/WorkspaceMobileTabs.spec.tsx` | 13 | 4.80 s | verde |

### Detalle por fichero — `src/Domains/Inspector` (27 ficheros, 196 tests, 11.27 s)

| fichero | nº tests | duración | estado |
|---|---|---|---|
| `lib/specs/parseDiff.spec.ts` | 12 | 6 ms | verde |
| `Hooks/specs/useInspectorData.spec.tsx` | 15 | 732 ms | verde |
| `specs/Inspector.service.spec.tsx` | 4 | 259 ms | verde |
| `Components/specs/AnswersSection.spec.tsx` | 9 | 491 ms | verde |
| `Components/specs/ContextSection.spec.tsx` | 15 | 503 ms | verde |
| `Components/specs/QuestionsSection.spec.tsx` | 13 | 634 ms | verde |
| `Components/specs/FileChanges.spec.tsx` | 13 | 709 ms | verde |
| `Hooks/specs/useToolHistory.spec.tsx` | 9 | 39 ms | verde |
| `Components/specs/InspectorPanel.spec.tsx` | 16 | 1265 ms | verde |
| `lib/specs/deriveSkills.spec.ts` | 6 | 15 ms | verde |
| `Components/specs/LatencySection.spec.tsx` | 10 | 405 ms | verde |
| `Hooks/specs/useContextMetrics.spec.tsx` | 3 | 47 ms | verde |
| `Components/specs/ResourceList.spec.tsx` | 6 | 221 ms | verde |
| `lib/specs/medianToolDurations.spec.ts` | 8 | 4 ms | verde |
| `Components/specs/SubagentsSection.spec.tsx` | 5 | 282 ms | verde |
| `Components/specs/FileDiff.spec.tsx` | 6 | 538 ms | verde |
| `Components/specs/AdvancedSection.spec.tsx` | 5 | 503 ms | verde |
| `Components/specs/ContextGrowth.spec.tsx` | 5 | 228 ms | verde |
| `lib/specs/deriveResources.spec.ts` | 5 | 8 ms | verde |
| `Components/specs/ParallelismSection.spec.tsx` | 5 | 172 ms | verde |
| `Components/specs/ParentImpactRow.spec.tsx` | 5 | 310 ms | verde |
| `Components/specs/MetricsSection.spec.tsx` | 3 | 121 ms | verde |
| `Components/specs/ToolHistory.spec.tsx` | 4 | 380 ms | verde |
| `Components/specs/ModelSection.spec.tsx` | 4 | 85 ms | verde |
| `Components/specs/ToolStats.spec.tsx` | 4 | 47 ms | verde |
| `Components/specs/ContextCompositionBar.spec.tsx` | 3 | 81 ms | verde |
| `Components/specs/ErrorsSection.spec.tsx` | 3 | 30 ms | verde |

**Checkpoint T001**: línea base de pruebas verde y firmada.

---

## T002 — Línea base de compuertas y acotación del primitivo

### Compuertas estáticas

| compuerta | comando | resultado | estado |
|---|---|---|---|
| TypeScript (app) | `pnpm tsc` | exit `0`, sin diagnósticos | verde |
| TypeScript (config Node) | `pnpm tsc:node` | exit `0`, sin diagnósticos | verde |
| ESLint | `pnpm lint` | exit `0`, **0 errores, 0 warnings** | verde |

- `pnpm lint`: la única salida es el aviso de configuración preexistente
  `Warning: React version not specified in eslint-plugin-react settings.` — no es un hallazgo sobre
  ficheros; no cuenta como warning de lint.

### Superficie del primitivo compartido (estado *antes*)

Consumidores de `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` (`rg "TabsList" src`):

| consumidor | uso |
|---|---|
| `src/Application/Components/ui/tabs.tsx` | definición del primitivo |
| `src/Infrastructure/Components/InspectorPane.tsx` | tablist externo `Detalle \| Chat` (importa los 4 desde el barrel `@app/Application/Components`; uso en `:198-260`) |
| `src/Application/Components/ui/specs/tabs.a11y.spec.tsx` | spec a11y del primitivo |

No hay ningún otro consumidor de `Tabs*` en `src`: el único import directo del fichero del primitivo
fuera del propio módulo es su spec. Cualquier cambio en `ui/tabs.tsx` solo puede regresar
`InspectorPane` (`Detalle | Chat`) y `tabs.a11y.spec.tsx`.

**Recordatorio (`research.md` R3)** — `min-h-control` **se genera** con el `@theme` de `src/index.css`
(`--height-control: 2.6rem`, `:35`). Verificado compilando `src/index.css` con `@tailwindcss/postcss`:
sale `.min-h-control { min-height: var(--height-control); }`. Por eso la corrección upstream
(`h-control` → `min-h-control flex-wrap` en `TabsList`) es válida y no necesita override en el call site.

### Snapshot de clases base del primitivo (para el diff de regresión)

- `TabsList`: `inline-flex h-control items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground`
- `TabsTrigger`: `inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow`
- `TabsContent`: `mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer`

Estado actual respecto a lo que la feature exige: `TabsList` usa `h-control` (sin `flex-wrap`);
`TabsTrigger` no tiene `border`/`data-[state=active]:border-foreground`; foco por `ring` (no `outline`);
`TabsContent` usa `cursor-pointer`, sin utilidades de `display` (la guardia de contrato se respeta hoy).

### Specs

- Spec del primitivo hoy: `src/Application/Components/ui/specs/tabs.a11y.spec.tsx` (5 tests, verde).
- Specs nuevos de la feature que **aún no existen** (rojo esperado en la fase siguiente; quickstart
  escenario 0): `src/Domains/Inspector/Hooks/specs/useInspectorSectionTabs.spec.tsx` y
  `src/Domains/Inspector/Components/specs/InspectorSectionTabs.spec.tsx`.

**Checkpoint T002**: compuertas verdes y primitivo acotado; recién ahora se puede tocar código.

---

## Firma

- `git rev-parse HEAD` de partida: `19ceb5073d759ba641003734bcd77bf1f06c68b5`.
- Suite completa: **200 ficheros / 1992 tests (1991 passed, 1 skipped) / 0 fallos**.
- Compuertas: `pnpm tsc`, `pnpm tsc:node` y `pnpm lint` en **exit 0** (lint: 0 errores, 0 warnings).
