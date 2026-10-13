# Baseline de no regresión — 012-refactor-workspace-enrichment

- HEAD: `c629e178f67117b7114d55bad203fbd8e9a96fdb`
- Fecha: 2026-10-13T10:53:15-03:00

## Suite completa (`pnpm test`)
```
 Test Files  174 passed (174)
      Tests  1855 passed | 1 skipped (1856)
   Duration  38.92s (transform 4.73s, setup 47.61s, collect 55.77s, tests 34.16s, environment 81.30s, prepare 14.52s)
```

## Suites protegidas

| Suite | Test Files | Tests | Duration |
|---|---|---|---|
| `WorkspacePage.spec` | Test Files  1 passed (1) | Tests  26 passed (26) | Duration  2.31s (transform 606ms, setup 125ms, collect 1.04s, tests 584ms, environment 225ms, prepare 55ms) |
| `WorkspacePage.perf.spec` | Test Files  1 passed (1) | Tests  6 passed (6) | Duration  1.73s (transform 537ms, setup 118ms, collect 959ms, tests 107ms, environment 228ms, prepare 63ms) |
| `useGraphEnrichment.spec` | Test Files  1 passed (1) | Tests  2 passed (2) | Duration  927ms (transform 162ms, setup 118ms, collect 242ms, tests 42ms, environment 223ms, prepare 43ms) |
| `useGraphEnrichment.freshness.spec` | Test Files  1 passed (1) | Tests  5 passed (5) | Duration  1.08s (transform 193ms, setup 118ms, collect 280ms, tests 137ms, environment 221ms, prepare 35ms) |

## Compuertas
```
tsc exit=0
tsc:node exit=0
lint exit=0
```

## Alcance
```
git status --short:
 M .specify/feature.json
?? specs/012-refactor-workspace-enrichment/
git diff --name-only -- src/Infrastructure/specs src/Domains/Graph/Hooks/specs:
```

## sha256 de specs protegidos
```
6850ad09e78eeaae62af35135d4e6bd172b0c0377964fcd5c36e3fbc02f99246  src/Infrastructure/specs/WorkspacePage.spec.tsx
6260f19d5c48c814447c25da2e3ae91dcb8ba455750537beb91e0d06e4d5cde6  src/Infrastructure/specs/WorkspacePage.perf.spec.tsx
f858fc0e35566a22a7791172edacb7b3232cb73101ed71892a9add28b3d3df66  src/Domains/Graph/Hooks/specs/useGraphEnrichment.spec.tsx
a9dacd6eb1f9c558bc0089e51687fd972ee7cb0fb1d330436de291ab71e5d296  src/Domains/Graph/Hooks/specs/useGraphEnrichment.freshness.spec.tsx
```
