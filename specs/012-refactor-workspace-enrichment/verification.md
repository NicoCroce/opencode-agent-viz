# Verificación de no regresión — 012-refactor-workspace-enrichment

Comparación contra [baseline.md](./baseline.md) (HEAD `c629e17`).

## T031 · Suites protegidas (SC-001)

| Suite | baseline (tests / duración) | actual (tests / duración) |
|---|---|---|
| `WorkspacePage.spec` | 26 / 2.31s | 26 passed / 2.24s |
| `WorkspacePage.perf.spec` | 6 / 1.73s | 6 passed / 1.74s |
| `useGraphEnrichment.spec` | 2 / 0.927s | 2 passed / 927ms |
| `useGraphEnrichment.freshness.spec` | 5 / 1.08s | 5 passed / 1.04s |

### Specs protegidos sin modificar
```
git diff --name-only -- src/Infrastructure/specs/WorkspacePage.spec.tsx src/Infrastructure/specs/WorkspacePage.perf.spec.tsx src/Domains/Graph/Hooks/specs/useGraphEnrichment.spec.tsx src/Domains/Graph/Hooks/specs/useGraphEnrichment.freshness.spec.tsx:
(vacío = sin cambios)

sha256 actual:
6850ad09e78eeaae62af35135d4e6bd172b0c0377964fcd5c36e3fbc02f99246  src/Infrastructure/specs/WorkspacePage.spec.tsx
6260f19d5c48c814447c25da2e3ae91dcb8ba455750537beb91e0d06e4d5cde6  src/Infrastructure/specs/WorkspacePage.perf.spec.tsx
f858fc0e35566a22a7791172edacb7b3232cb73101ed71892a9add28b3d3df66  src/Domains/Graph/Hooks/specs/useGraphEnrichment.spec.tsx
a9dacd6eb1f9c558bc0089e51687fd972ee7cb0fb1d330436de291ab71e5d296  src/Domains/Graph/Hooks/specs/useGraphEnrichment.freshness.spec.tsx
```

## T032 · Compuertas completas (FR-022 / SC-004)

Ejecutadas en el HEAD de trabajo, mismas condiciones que `baseline.md`:

| Compuerta | Baseline | Actual |
|---|---|---|
| `pnpm tsc` | exit 0 | exit 0 |
| `pnpm tsc:node` | exit 0 | exit 0 |
| `pnpm lint` | exit 0 | exit 0 |
| `pnpm test` | 174 files / 1855 passed + 1 skipped / 38.9s | 197 files / 1976 passed + 1 skipped / 41.4s |

Deltas: +23 archivos de test, +121 tests, todas verdes; 0 warnings nuevos de lint; ninguna compuerta cambia de estado.

## T033 · Auditoría de alcance (SC-005)

Ficheros tocados (tracked + untracked, excluido `.opencode/runs/` que es área de trabajo ignorada):
```
 M .specify/feature.json
 M src/Domains/Graph/Hooks/useGraphEnrichment.ts
 M src/Infrastructure/WorkspacePage.tsx
?? specs/012-refactor-workspace-enrichment/
?? src/Domains/Graph/lib/agentLatencyMedians.ts
?? src/Domains/Graph/lib/mergeEnrichedNodes.ts
?? src/Domains/Graph/lib/readyNodeIds.ts
?? src/Domains/Graph/lib/specs/agentLatencyMedians.spec.ts
?? src/Domains/Graph/lib/specs/mergeEnrichedNodes.spec.ts
?? src/Domains/Graph/lib/specs/readyNodeIds.spec.ts
?? src/Infrastructure/Components/WorkspaceView.tsx
?? src/Infrastructure/Components/specs/WorkspaceView.spec.tsx
?? src/Infrastructure/Hooks/specs/useAttentionByRoot.spec.tsx
?? src/Infrastructure/Hooks/specs/useAttentionNodeIds.spec.tsx
?? src/Infrastructure/Hooks/specs/useChatPending.spec.tsx
?? src/Infrastructure/Hooks/specs/useChatSelectionSeed.spec.tsx
?? src/Infrastructure/Hooks/specs/useHistoryData.spec.tsx
?? src/Infrastructure/Hooks/specs/useWorkspaceEscape.spec.tsx
?? src/Infrastructure/Hooks/useAttentionByRoot.ts
?? src/Infrastructure/Hooks/useAttentionNodeIds.ts
?? src/Infrastructure/Hooks/useChatPending.ts
?? src/Infrastructure/Hooks/useChatSelectionSeed.ts
?? src/Infrastructure/Hooks/useHistoryData.ts
?? src/Infrastructure/Hooks/useWorkspaceEscape.ts
?? src/Infrastructure/lib/countAttentionByRoot.ts
?? src/Infrastructure/lib/isFocusWithinChat.ts
?? src/Infrastructure/lib/specs/
?? src/Infrastructure/lib/toPendingQuestionEntry.ts
?? src/Infrastructure/specs/integration/
```

## T035 · Tamaño y no duplicación (FR-023 / SC-006)

```
    3149 total
     275 src/Infrastructure/WorkspacePage.tsx
     216 src/Domains/Graph/Hooks/useGraphEnrichment.ts
     206 src/Domains/Graph/lib/parallelism.ts
     159 src/Domains/Graph/lib/invocations.ts
     154 src/Domains/Graph/lib/enrichNodeData.ts
     124 src/Infrastructure/Hooks/useChatPending.ts
     100 src/Domains/Graph/lib/cardHeight.ts
      99 src/Domains/Graph/lib/eventReducer.ts
      96 src/Domains/Graph/lib/buildGraph.ts
      91 src/Domains/Graph/lib/nodeResize.ts
      88 src/Domains/Graph/lib/summaryCounters.ts
      79 src/Infrastructure/Components/WorkspaceView.tsx
      71 src/Domains/Graph/lib/chainGraph.ts
      68 src/Infrastructure/Hooks/useHistoryData.ts
      65 src/Domains/Graph/lib/lineage.ts
      62 src/Domains/Graph/lib/deriveExecutionSignals.ts
      61 src/Domains/Graph/lib/buildStructuralModel.ts
      58 src/Domains/Graph/lib/nodeStatus.ts
      55 src/Domains/Graph/lib/executionSignal.ts
      53 src/Infrastructure/lib/eventBatcher.ts
      53 src/Domains/Graph/lib/loadNodeContent.ts
      52 src/Infrastructure/lib/applyActiveSeed.ts
      49 src/Infrastructure/Hooks/useAttentionByRoot.ts
      49 src/Domains/Graph/lib/buildViewNodes.ts
```

Ninguna **pieza nueva** supera las 150 líneas (la mayor es `useChatPending.ts`, 124).

**Desviación respecto a `plan.md`** (documentada, no bloqueante): los dos ficheros refactorizados quedan por encima del objetivo de tamaño — `WorkspacePage.tsx` 275 (objetivo ~110) y `useGraphEnrichment.ts` 216 (objetivo ~130). El suelo real de la página son los cinco slots con sus 13–18 props (~64 líneas de JSX) más ~16 hooks de cableado; bajar más exigiría mover la construcción de slots a `WorkspaceView`, fuera del alcance de T014/T016. El criterio verificable de la spec («la página es solo composición, sin derivaciones propias») sí se cumple, y ningún SC mide líneas.

No se reimplementa `deriveLatency`/`median`/`enrichNodeData`/`mergeExecutionSignals` (las piezas puras nuevas los importan) ni se crean componentes genéricos dentro de un dominio.

## T034 · Superficie congelada (FR-001 / FR-002 / SC-002)

Checklist por inspección de los ficheros nuevos y del diff:

| Punto | Comprobación | Veredicto |
|---|---|---|
| §1 Exports y firmas | `WorkspacePage` (único export, sin cambios), `useGraphEnrichment`, `useInvocationBatches` conservan nombre y firma | ✔ |
| §2 Formas de props | `SessionsRail`/`GraphPane`/`InspectorPane`/`HistoryOverlay`/`ChatPanel`/`WorkspaceLayout` **no aparecen** en `git status` (ficheros no tocados) | ✔ |
| §3 `data-testid` | El conjunto de atributos `data-testid` de la página es idéntico al de HEAD; el único delta del diff es el literal de un comentario del selector `CHAT_PANEL_SELECTOR`, que ahora vive en `src/Infrastructure/lib/isFocusWithinChat.ts` sin cambiar de valor | ✔ |
| §4 Rutas y `queryKeys` | `git diff --name-only -- src/Domains/queryKeys.ts src/Infrastructure/Routes.tsx src/Domains/Graph/Graph.routes.ts` → vacío: sin claves nuevas ni renombradas | ✔ |
| Comportamiento | Sin cambios de copy, navegación ni interacción observable | ✔ |

## T036 · Quickstart §0–§6 · Veredicto (SC-001…SC-006)

| Sección | Ejecutado | Resultado |
|---|---|---|
| §0 Línea base | Antes de tocar código → [`baseline.md`](./baseline.md) | 174 files / 1855 passed / 38.9s |
| §1 Compuertas | `pnpm tsc` · `pnpm tsc:node` · `pnpm lint` · `pnpm test` | 4/4 exit 0 · 197 files / 1976 passed |
| §2 No regresión | Suites protegidas + `git diff` de specs (vacío) + `sha256` idéntico al baseline | ✔ |
| §3 Piezas puras nuevas | `countAttentionByRoot`, `toPendingQuestionEntry`, `isFocusWithinChat`, `readyNodeIds`, `agentLatencyMedians`, `mergeEnrichedNodes` | ✔ |
| §4 Hooks y componente | `useChatPending`, `useAttentionNodeIds`, `useAttentionByRoot`, `useChatSelectionSeed`, `useWorkspaceEscape`, `useHistoryData`, `WorkspaceView` | ✔ (14 files / 101 tests) |
| §5 Alcance | `git status --short` solo con los prefijos permitidos (ver T033) | ✔ SC-005 |
| §6 Cierre | §1–§4 verdes, §2 vacío, §5 limpio | ✔ |

**Veredicto: la feature cumple SC-001…SC-006.** Única salvedad documentada: los dos ficheros refactorizados quedan por encima del tamaño objetivo de `plan.md` (ver T035) y el hallazgo F2 queda fuera de alcance (ver `cambios_de_contrato.md` §2).
