# Línea base de no regresión — `015-session-efficiency-panel`

**Feature**: `015-session-efficiency-panel` | **Fecha**: 2026-10-23 | **Plan**: [plan.md](./plan.md)

Fija el verde de partida antes de tocar el cableado del panel. Cubre la línea base de **pruebas**
del alcance, la de **compuertas** estáticas, la **superficie congelada** (R10: `queryKeys`,
`buildHistory`, `summarizeSession`, `TGraphNodeData`/`Graph.entity.ts` y spec 014) y la
**ausencia de dependencias nuevas**.

- **Commit de partida**: `d6bba8ce1982829300afd1aae36ba3ae50958771` (`git rev-parse HEAD`).
- **Entorno**: macOS (darwin), Node v22.12.0, pnpm 9.7.1; runner `vitest run` (`vitest.config.ts`).
- Todos los comandos se ejecutan desde la raíz del repo.

---

## T001 — Línea base de pruebas y compuertas

### Pruebas del alcance

`pnpm test -- src/Infrastructure/Components/specs/GraphPane.spec.tsx src/Infrastructure/Components/specs/WorkspaceView.spec.tsx src/Infrastructure/Components/specs/WorkspaceLayout.spec.tsx src/Infrastructure/specs/WorkspacePage.spec.tsx src/Infrastructure/Hooks/specs/useWorkspaceEscape.spec.tsx`

| fichero | nº tests | duración | estado |
|---|---|---|---|
| `src/Infrastructure/Components/specs/GraphPane.spec.tsx` | 14 | 203 ms | verde |
| `src/Infrastructure/Components/specs/WorkspaceView.spec.tsx` | 10 | 167 ms | verde |
| `src/Infrastructure/Components/specs/WorkspaceLayout.spec.tsx` | 7 | 141 ms | verde |
| `src/Infrastructure/specs/WorkspacePage.spec.tsx` | 26 | 654 ms | verde |
| `src/Infrastructure/Hooks/specs/useWorkspaceEscape.spec.tsx` | 9 | 28 ms | verde |

- **Total**: **5 ficheros, 66 tests (66 passed), 0 fallos** · `Duration 3.43 s`
  (`transform 1.16 s, setup 1.35 s, collect 3.92 s, tests 1.19 s, environment 1.98 s, prepare 267 ms`).

### Compuertas estáticas

| compuerta | comando | resultado | estado |
|---|---|---|---|
| TypeScript (app) | `pnpm tsc` | exit `0`, sin diagnósticos | verde |
| TypeScript (config Node) | `pnpm tsc:node` | exit `0`, sin diagnósticos | verde |
| ESLint | `pnpm lint` | exit `0`, sin errores ni warnings | verde |

### Dependencias

- `@radix-ui/react-dialog` instalado: **1.1.23** (`node_modules/@radix-ui/react-dialog/package.json`),
  ya presente en `package.json`; el plan solo lo consume (R1/R11).
- **Sin dependencias nuevas**: `git diff --exit-code -- package.json pnpm-lock.yaml` termina en
  `exit 0` sin salida; `git status --short` no lista ninguno de los dos.

### Superficie congelada (R10)

`git diff --exit-code -- src/Domains/queryKeys.ts src/Domains/History/lib/buildHistory.ts src/Domains/Graph/lib/metrics/summarizeSession.ts src/Domains/Graph/Graph.entity.ts specs/014-inspector-detail-tabs/`

```text
$ git diff --exit-code -- <rutas>
# sin salida
$ echo $?
0
```

Sin cambios en `queryKeys`, `buildHistory`, `summarizeSession`, `Graph.entity.ts` ni en el spec 014
contra el commit de partida.

**Checkpoint T001**: línea base verde y superficie congelada firmada; el resto de la feature parte de
este estado.

---

## Firma

- `git rev-parse HEAD` de partida: `d6bba8ce1982829300afd1aae36ba3ae50958771`.
- Pruebas del alcance: **5 ficheros / 66 tests (66 passed) / 0 fallos**.
- Compuertas: `pnpm tsc`, `pnpm tsc:node` y `pnpm lint` en **exit 0**.
- Dependencias nuevas: **ninguna** (`@radix-ui/react-dialog` 1.1.23 ya instalado).
