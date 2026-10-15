# Verification speed-up (`verify.sh` and Vitest)

This document records **what** was changed to speed up the `verify` phase, **why**, **with what evidence**, **what was ruled out** and **how to reproduce** the measurements. It is the reference for the decisions; day-to-day use is covered in [Phases](02-phases.md) and [Context optimization §6.4](11-context-optimization.md#64-verifysh).

> **Status:** the changes are applied and **measured** on a MacBook Pro M1 (4 performance + 4 efficiency cores, 16 GB). Every figure comes from **a single run**; run-to-run noise is about ±5 s. Figures marked *estimate* were not measured.

## 1. Result

| | Before | After |
|---|---|---|
| Full `verify.sh` (`lint` + `tsc` + `test` + `build`) | **200–280 s** | **41 s** |
| `pnpm test` (2126 tests) | 56 s (unlimited workers) | **39.5 s** (4 workers) |
| `pnpm lint` (warm cache) | 19 s | **1.3 s** |
| `pnpm tsc` (warm cache) | 5.5 s | **1.9 s** |

> The 200–280 s baseline was measured **before** starting, with the serial run. It was not re-measured, because the script had already changed.

Final run, unattended:

```text
PASS lint (7s)
PASS tsc (4s)
PASS test (41s) — Tests  2126 passed | 1 skipped (2127)
PASS build (2s)
total 40.8 s
```

All 2126 tests pass as before: none was removed or skipped.

## 2. What changed

| # | Change | Where | Commit |
|---|---|---|---|
| 1 | `lint`, `tsc` and `build` in parallel (`run_cmd` helper); `build` runs only `vite build` when `tsc` is already in the list (`tsc` used to run twice) | `.opencode/scripts/bash/verify.sh` | `13cb4a0` |
| 2 | Vitest worker cap | `verify.sh` | `32d4f43` (replaced by #6) |
| 3 | `.spec.ts` files run in the `node` environment (not `jsdom`); `setup.ts` loads the DOM pieces only when there is a DOM; 4 specs that do need the DOM declare `// @vitest-environment jsdom` | `vitest.config.ts`, `src/test/setup.ts`, 4 specs | `823dbd3` |
| 4 | ESLint cache (`--cache`) and incremental `tsc` | `package.json`, `tsconfig.json` | `d273ee1` |
| 5 | All four commands in parallel, `test` included; `--changed` option; `threads` pool | `verify.sh`, `.opencode/agents/sddorch.md` | `7e9a464` |
| 6 | 4-worker cap in the config, for `pnpm test`, `test:watch` and `verify.sh` | `vitest.config.ts` | `ed876db` |

### 2.1 Parallel `verify.sh`

The four commands start together and each writes its exit code and duration to temp files (`<log-dir>/<cmd>.rc` and `.dur`). When all finish, the script reads and deletes them and prints the summary **always in the order** `lint`, `tsc`, `test`, `build`. The error format did not change: first 20 matching lines, the count of the rest, and the last 10 log lines when nothing matches.

Running them together is safe because `tsc` uses `noEmit` and `vite build` does not touch `src/`. The `tsc` cache (`node_modules/.cache/tsc/app.tsbuildinfo`) is written by a single process.

### 2.2 `.spec.ts` files in the `node` environment

The suite has 214 files: 85 `.spec.ts` (pure logic: reducers, `buildGraph`, services) and 129 `.spec.tsx`. No file declared an environment, so **all 214 booted `jsdom`**.

`environmentMatchGlobs: [['src/**/*.spec.ts', 'node']]` now moves them to `node`. Four of them do use the DOM and declare `// @vitest-environment jsdom` on their first line:

| Spec | Why it needs the DOM |
|---|---|
| `Graph/lib/specs/anomalyThreshold.spec.ts` | `localStorage` |
| `Infrastructure/lib/specs/isFocusWithinChat.spec.ts` | `document` |
| `Infrastructure/specs/harness.helpers.spec.ts` | Testing Library `render` |
| `Application/Helpers/specs/prefersReducedMotion.spec.ts` | `window.matchMedia` |

The last one was found because it **failed** (2 tests) on the first run with the new environment, not through prior analysis. `windowStats.spec.ts` mentions `window`, but only as a variable name.

`src/test/setup.ts` now looks like this: the common part (`vi.restoreAllMocks`, `vi.clearAllMocks`) always runs, and the DOM part (`jest-dom`, `cleanup`, Radix polyfills, `localStorage` cleanup) is loaded with a dynamic `import()` only when `document` exists. `jest-dom` uses `@testing-library/jest-dom/vitest`; the root entry has no module typings and broke `pnpm tsc`.

### 2.3 Caches

- **ESLint:** `eslint . --cache --cache-location node_modules/.cache/eslint/`.
- **`tsc`:** `incremental: true` and `tsBuildInfoFile: ./node_modules/.cache/tsc/app.tsbuildinfo` in `tsconfig.json`.

Both live in `node_modules/.cache`, which git ignores. The **first** run after deleting them is as slow as before (lint ≈ 19 s, tsc ≈ 5.5 s); the benefit shows up when few files change.

### 2.4 `--changed`

```bash
.opencode/scripts/bash/verify.sh --changed tsc test
```

`test` runs only the specs affected by uncommitted changes (`vitest --changed`) and does not fail when there are none. `sddorch` uses it **after each wave**; the `verify` phase still runs everything, without the flag.

Two measured caveats:

- Touching a widely imported file (`formatDuration.ts`) ran **865 tests in 30 s**: Vitest follows the import graph.
- Changing `vitest.config.ts` or `setup.ts` runs the **whole** suite (2126 tests, 40 s). That is the correct behavior.

## 3. Evidence

### 3.1 Progression

| Step | `verify.sh` | `test` | Note |
|---|---|---|---|
| Baseline (serial) | 200–280 s | — | Measured before starting |
| `lint`/`tsc`/`build` in parallel, `test` after | 78 s | 56 s | `lint` 23 s, `tsc` 9 s, `build` 2 s |
| + 2-worker cap (`forks`) | 100 s | 81 s | Slower on purpose: limiting load was requested |
| + `.spec.ts` in `node` | — | 66 s | Same 2-worker cap |
| + `threads` pool | — | 60 s | Same 2-worker cap |
| + 4 workers and everything in parallel | **41 s** | 41 s | Final run |

### 3.2 Effect of the `node` environment (2 `forks` workers, same 2126 tests)

Vitest times are **sums across workers**, not wall-clock time.

| Phase | Before | After |
|---|---|---|
| `environment` | 50.2 s | 30.9 s |
| `setup` | 24.0 s | 14.9 s |
| `collect` | 23.7 s | 24.5 s |
| `tests` | 31.0 s | 30.7 s |
| `prepare` | 7.9 s | 7.9 s |
| **Total duration** | **80.4 s** | **66.2 s** |

Only `environment` and `setup` drop: the cost of booting `jsdom` in files that do not need it. The tests themselves do not change.

### 3.3 Worker sweep (`threads` pool)

| Workers | `test` time |
|---|---|
| 2 | 60 s |
| 3 | 46 s |
| 4 | 39 s |
| 6 | 35 s |

Diminishing returns: going from 4 to 6 gains ~10 %, at the cost of also using the efficiency cores. **4 workers** matches the M1's 4 performance cores and leaves headroom to keep working.

### 3.4 `forks` vs `threads` (2 workers)

`forks`: 66 s. `threads`: 60 s. `threads` starts cheaper; `forks` isolates better. The suite passes completely with both.

### 3.5 Where the time goes

With 4 workers, the 214 files add up to 39 s of their own time (≈ 10 s wall-clock); the rest is fixed per-file cost plus ~8 s of Vite startup. No file dominates:

| File | Time |
|---|---|
| `Chat/Components/specs/ChatPanel.spec.tsx` | 1.8 s |
| `Chat/Components/specs/ChatHistoryDialog.spec.tsx` | 1.3 s |
| `Graph/Hooks/specs/useGraphStructure.spec.tsx` | 1.2 s |
| `Inspector/Components/specs/InspectorPanel.spec.tsx` | 1.2 s |

The 10 slowest account for 27 % of the total and 173 of 214 files take under 400 ms. **Optimizing individual files is not worth it.**

## 4. How Vitest workers work

> Description based on the design of Vitest 2 and `tinypool`. It was not verified by watching the processes.

- The main `vitest run` process distributes the test files in a queue and creates workers as needed, up to `maxThreads` (here, 4).
- With `isolate: true` (the default) each file runs in a **fresh** worker: it is created, runs one file and is discarded. Hence the fixed per-file cost (`environment` and `setup`).
- When the run ends, the main process closes the pool and exits; **no workers are left alive**. In `watch` mode they do stay between changes, and idle ones shut down after a while.
- `forks` uses separate processes (more isolation); `threads` uses threads within the same process (cheaper startup).

## 5. Resulting configuration

`vitest.config.ts` (excerpt):

```ts
environment: 'jsdom',
environmentMatchGlobs: [['src/**/*.spec.ts', 'node']],
pool: 'threads',
poolOptions: { threads: { minThreads: 1, maxThreads: 4 } },
```

`verify.sh` environment variable and options:

| Option | Effect |
|---|---|
| `VERIFY_TEST_WORKERS=N` | Overrides the config's 4 workers (`verify.sh` only) |
| `--changed` | `test` runs only the affected specs |
| `--log-dir <dir>` | Log folder (default `.opencode/runs/_verify`) |

## 6. Problems found and how they were solved

| Problem | Cause | Fix |
|---|---|---|
| `pnpm test --poolOptions…` fails with "Unknown options" | pnpm treats those flags as its own | `verify.sh` calls `pnpm exec vitest run …` |
| `minThreads and maxThreads must not conflict` | With only `maxThreads=2`, the default minimum exceeds it | Always set `minThreads: 1` next to `maxThreads` |
| `pnpm tsc`: `jest-dom/types/index.d.ts is not a module` | A dynamic `import('@testing-library/jest-dom')` has no module typings | Use `@testing-library/jest-dom/vitest` |
| `prefersReducedMotion.spec.ts` fails in `node` | It reads `window.matchMedia` | `// @vitest-environment jsdom` |
| `sed -i` with single quotes fails on macOS | BSD `sed` syntax | Use the edit tool |

## 7. What was NOT done and why

| Ruled out | Estimated gain | Reason |
|---|---|---|
| `happy-dom` instead of `jsdom` | ~4–6 s | Medium risk: Radix, `userEvent` and the pointer polyfills may behave differently across 129 `.tsx` specs |
| `isolate: false` (only on `node` specs) | ~2–4 s | Medium risk: module state would be shared between files; the suite uses `vi.stubGlobal` and mocks |
| 6 or 8 workers | ~4 s | Also saturates the efficiency cores; the machine feels slow while working |

The gains are **estimates**, not measurements.

## 8. Convention for spec authors

- A `.spec.ts` runs in `node`. If it uses `document`, `window` or `localStorage`, it must start with `// @vitest-environment jsdom`; otherwise it fails with an unclear error (`window is not defined`).
- A `.spec.tsx` keeps running in `jsdom`.
- New specs with Radix: see `src/test/radix.ts` and `AGENTS.md`.

## 9. How to reproduce

```bash
# Full verification and total time
time .opencode/scripts/bash/verify.sh

# Tests with N workers (change N)
pnpm exec vitest run --pool=threads \
  --poolOptions.threads.maxThreads=N --poolOptions.threads.minThreads=1

# Slowest files
pnpm exec vitest run --reporter=json --outputFile=/tmp/vt-report.json

# Cold caches
rm -rf node_modules/.cache/eslint node_modules/.cache/tsc
```

## 10. File map

| File | Change |
|---|---|
| `.opencode/scripts/bash/verify.sh` | Parallel, `--changed`, `VERIFY_TEST_WORKERS`, `build` without duplicate `tsc` |
| `.opencode/agents/sddorch.md` | After each wave: `verify.sh --changed tsc test` |
| `vitest.config.ts` | `node` environment for `.spec.ts`, `threads` pool, 4 workers |
| `src/test/setup.ts` | DOM loaded only with jsdom |
| `package.json` | `lint` with `--cache` |
| `tsconfig.json` | `incremental` and `tsBuildInfoFile` |
| 4 specs | `// @vitest-environment jsdom` |
