# Context and parallelism optimization (stages A and B)

This document records **why** SddOrch was changed, **what** changed in each stage, **what was rejected**, and **how to measure** whether it worked. It is the reference for the decisions; day-to-day behavior lives in [Phases](02-phases.md), [Subagents](04-subagents.md), [Wave scheduling](05-scheduling.md) and [Memory](07-memory.md).

> **Status:** the changes are applied but **not yet measured in a real run**. The reduction figures are a **simulation over real data** from feature 009, not a post-change measurement. See [How to measure](#how-to-measure-the-next-run).

## 1. Starting point

Two runs of the `sddorch` orchestrator stored in OpenCode's database were analyzed read-only:

- feature **008** (`ses_ee11c539…`),
- feature **009** plus 4 UX iterations (`ses_ed8a1bdd…`), with about 152 child subagents.

User goals, in priority order: **reduce the orchestrator's context**, avoid hangs, keep and improve parallelism, and streamline the process.

### 1.1 Findings

| Area | Finding | Evidence |
|---|---|---|
| Context | The orchestrator reached 305K (008) and 470K (009) without compacting. The model limit is 1M, so it never compacted. | Sessions 008 and 009 |
| Context | The model's *reasoning* is resent on every step and makes up ~26% of the context. | Session 009 |
| Latency | More context means slower tokens: 13 ms/token below 100K, 52 ms/token above 400K. | Session 009 |
| Where it goes | `specify` + `clarify` + constitution + PRD/RFC add +68K, more than `implement` (+75K). | Phase by phase, 009 |
| Child returns | What subagents return accumulates: 31.5K per feature, 58K per session. | 009 |
| Iterations | Each iteration after `release` adds 40–70K, and only compaction or a new session contains it. | 009 |
| Permissions | 24% of `release` steps were lost to compound commands (`&&`, `;`, `\|`, `echo`) and denied `git fetch`, `merge-base`, `rev-parse`. | Session 009 |
| Hangs | The `question` tool expires after one hour: 3 cases of ~3650 s left the session interrupted. | Session 009 |
| Parallelism | 22 of 37 waves had a single implementer; real speedup ≈ 1.45×. The orchestrator reasoned about waves "by hand", phase by phase. | Session 009 |
| Cut-offs | 8 children were cut by the step limit (6 implementers at 40 steps and 2 researchers). The limit was already raised to 60/40. | Session 009 |
| Rework | After `converge` there were 9 children (43 min, USD 0.38), some similar to the cut-off implementers. `lint` and `tsc` only ran at the end: two fixes after `code-review`. | Session 009 |
| Decisions | The writer's 3 `preguntas_abiertas` in 009 were never asked: they were adopted as assumptions without being saved as `decision/<slug>`. Implementers' "Decisions" were not collected. | Session 009 |
| Duplicate reads | Every implementer read `speckit.implement.md`, the full `tasks.md` and `app.instructions.md`. | Session 009 |

## 2. Stage overview

| Stage | Idea | Applies to |
|---|---|---|
| **A** | Cut what enters the context and remove mechanical losses (permissions, scripts, state, hangs). The flow does not change. | Contract, permissions, scripts, state, compaction, `sddorch.md` |
| **B** | Change **who** does the expensive work: take discovery, wave planning and document reading out of the orchestrator. The flow changes. | `specify`/`clarify`, writer, `schedule`, implementer, precedence |

What each contains:

| # | Change | Stage |
|---|---|---|
| 1 | Length cap on child returns | A |
| 2 | Shell permissions for `release` and `reviewer` + "one command per call" | A |
| 3 | `release` in `cierre` mode and `pr-detail` as a file | A |
| 4 | Compact `state` and not rereading `sddorch.md` | A |
| 5 | Scripts `mark-tasks.sh`, `verify.sh`, `scope-check.sh` | A |
| 6 | `pending_question` in the `state` | A |
| 7 | `compaction.buffer: 800000` | A |
| 8 | Trimming `sddorch.md` | A |
| 9 | `sddorch-release` with `#low` | A |
| 10 | `specify` and `clarify` in a `general` subagent | B |
| 11 | PRD and RFC as files, not text in Engram or in the context | B |
| 12 | `schedule` computed by script (`schedule.mjs`) | B |
| 13 | Implementer reads its `Uxx.md`; limit of 3 tasks / 4 files | B |
| 14 | Role precedence rule + `cambios_de_contrato` | B |
| 15 | One-time implement preflight and `tsc` per wave | B |

## 3. Estimated orchestrator context reduction

Simulation over the real data of feature 009 (today's orchestrator versus the redesigned one). It does **not** include the effect of `#low` on the orchestrator.

### 3.1 Per step

| Phase | Step | Today | A only | B only | A + B |
|---|---|---|---|---|---|
| `plan` | 62 | 127.4K | — | — | 67.6K (−47%) |
| First `implement` wave | 73 | 165.6K | — | — | 80.3K (−52%) |
| Open PR | 146 | 285.5K | 239.5K (−16%) | 218.5K (−23%) | **172.4K (−40%)** |
| End of session | 250 | 470.4K | 396.4K (−16%) | 403.4K (−14%) | **329.4K (−30%)** |

(`—`: the simulation only provides those two steps for A and B separately.)

### 3.2 Accumulated read context

The accumulated **read** context (what is resent step by step) drops **42%** in the first feature and **36%** over the whole session. It is the measure that weighs most on latency and cost.

### 3.3 In child subagents (009)

| Change | Savings per implementer | Of max context (~60K) |
|---|---|---|
| Not reading `tasks.md` or `speckit.implement.md` | ~4K tokens | ~7% |
| Also not reading `app.instructions.md` | ~6K tokens | ~10% |

`app.instructions.md` is already covered by section 11 of `AGENTS.md`, which loads automatically.

### 3.4 Size of `sddorch.md`

| Version | Characters |
|---|---|
| Original | 20.9K |
| After adding the new content | 19.0K |
| After the trimming pass | **16.6K (−20%)** |

The initial goal was −30%; it was not reached because the file must still describe the scripts, `specify`/`clarify` in a subagent, precedence and `pending_question`. See [Pending](#8-known-risks-and-pending-work).

## 4. Decision for each stage

Each change follows the same scheme: **problem → decision → rejected alternatives → effect**.

### Stage A

#### A1. Cap on child returns

- **Problem:** returns accumulated (31.5K per feature, 58K per session) and every token is resent on every step.
- **Decision:** `sddorch-contract.md` sets a cap of **1,200 characters** for `DONE`/`APPROVED` and **2,500** for `BLOCKED`/`FAILED`/`REJECTED`, with no preamble and short sections. The contract itself was shortened, because every child reads it.
- **Rejected:** having each child write full reports to files. It was decided not to: only the "Decisions" that affect other tasks matter and the orchestrator collects them; the rest does not need to persist.
- **Effect:** the main lever of A on context growth.

#### A2. `release` and `reviewer` permissions

- **Problem:** 24% of `release` steps were lost to rejected compound commands and denied read-only git.
- **Decision:** `git rev-parse`, `merge-base`, `ls-files`, `remote get-url` and `fetch` are added to `release`; `rev-parse`, `merge-base`, `ls-files` and `branch` to `reviewer`. Both get the rule **"one simple command per call"** and are told to use `read`/`glob`/`grep` instead of `cat`/`ls`/`sed`.
- **Rejected:** opening permissions with wide wildcards (`git *`). It would break least privilege: `release` is the only one that commits and it does not `push` without confirmation.
- **Effect:** fewer lost steps and retries; the flow does not change.

#### A3. `release` in `cierre` mode

- **Problem:** `commits` and `pr-detail` ran in two executions, and the full PR body entered the orchestrator's context.
- **Decision:** new `cierre` mode (commits + `pr-detail` in one pass). `release` returns only **title, a summary of up to 8 lines and the path to `pr-detail.md`**; the user can open it.
- **Kept:** the mandatory question before opening the PR, even in Auto mode.

#### A4. Compact `state`, no rereading `sddorch.md`

- **Problem:** `state` stored lists of completed tasks and the orchestrator file was reread after compaction.
- **Decision:** `state` ≤ 600 characters, one line per field, without completed tasks (they are already marked in `tasks.md`; units live in `schedule.json`). After compaction, `north`, `state` and `decision/*` are recovered with a low-limit `mem_search`, **not** a full `mem_context` or `sddorch.md`.
- **Rejected:** storing everything in one large record: it does not scale and is resent whole.

#### A5. Mechanical scripts

- **Problem:** marking tasks, verifying and checking scope spent reasoning steps and terminal output in the context.
- **Decision:** three scripts in `.opencode/scripts/bash/`. See [§6](#6-scripts).
- **Effect:** `verify.sh` returns only PASS/FAIL and the first error lines (the full log stays in `.opencode/runs/_verify/`); `scope-check.sh` reports only files outside the `writes`.

#### A6. `pending_question`

- **Problem:** `question` expires after one hour; 3 cases of ~3650 s left the session interrupted without knowing what had been asked.
- **Decision:** before each `question` the orchestrator saves `pending_question` in the `state`. On resume, if present, it repeats the question before anything else.
- **Rejected:** raising the expiry time: it is not controlled by the project.

#### A7. `compaction.buffer: 800000`

- **Problem:** with a 1M limit automatic compaction almost never triggered and the context grew unchecked.
- **Decision:** `compaction.buffer: 800000` in `opencode.json`. The `instructions` field is no longer used (it was not resolved in V2).
- **Risk:** it is not verified that it applies to the installed OpenCode version. It will be checked in the next run.

#### A8. Trimming `sddorch.md`

Duplicates across *Interaction*, *Auto mode*, *Flow* and *How you run a phase* were removed, and *Harness signals* and *Step budget* were merged. See [§3.4](#34-size-of-sddorchmd).

#### A9. `sddorch-release` with `#low`

- **Decision:** `model: opencode-go/deepseek-v4.1-flash#low`. `release` is mechanical and low-risk.
- **Not applied** to implementers, reviewers or the orchestrator: the effect of `#low` on quality is **not measured**. In V2 the variant of a primary agent may not apply from the frontmatter (the session stores its model separately); in subagents it does work.

### Stage B

#### B1. `specify` and `clarify` in a subagent

- **Problem:** they ran in the orchestrator's context and, with constitution, PRD and RFC, added +68K.
- **Decision:** they run in a `general` subagent. Since children do not ask, they return `preguntas_abiertas`; the orchestrator asks with `question` and **resumes** the same child via its `sessionID`.
  - `specify`: up to 3 questions per round.
  - `clarify`: the command requires **one question at a time**, so each round returns one.
- **Feasibility:** `.specify/extensions.yml` has no hooks, so `specify` neither creates a branch nor needs `git`.
- **Spec-Kit was not modified:** only who runs the command changes.
- **Risk:** more back-and-forth with the user in `clarify`. In exchange, the orchestrator does not load the commands' content.

#### B2. PRD and RFC as files

- **Problem:** the writer saved the full PRD and RFC in Engram and the orchestrator read and copied them.
- **Decision:** the writer writes `.opencode/runs/<run>/prd.md` and `rfc.md` (edit permission only on `.opencode/runs/*`). Engram keeps **pointers** (path + 3-line summary). `specify` receives the **path** of the PRD; after `specify`, the orchestrator **moves** (`mv`) the files to `<feature_directory>/discovery/`. It reads the PRD only if the writer reports an unresolved conflict.
- **Why `.opencode/runs/` and not `.specify/`:** nothing is written inside `.specify/` (Spec-Kit's territory). `runs/` is git-ignored.
- **Effect:** resuming works even if memory is wiped, because the file is the source of truth.

#### B3. `schedule` by script

- **Problem:** the orchestrator reasoned about waves by phase; 22 of 37 waves had a single implementer, ≈1.45× speedup.
- **Decision:** `schedule.mjs` computes waves deterministically. See [§6.1](#61-schedulemjs) and [Wave scheduling](05-scheduling.md).
- **Test result** (tasks T001–T070 of 009 set as pending):

| | Real run (009) | `schedule.mjs` |
|---|---|---|
| Tasks | 70 | 70 |
| Waves | 22 | 22 |
| Subagents / units | 47 | 58 |
| Max simultaneous | 6 | 10 |

- **Adjustments during testing:** a first version gave 30 waves because it mixed in the `converge` tasks (T071+) and limited each wave to one unit touching shared files. Two rules were relaxed: a `[P]` task no longer waits for the last non-`[P]` task of its phase, and the one-`SHARED_FILES`-unit-per-wave cap was removed (path conflicts already serialize what really collides).
- **Conservative by design:** when in doubt, it serializes. A non-`[P]` task waits for all earlier tasks of its phase.

#### B4. The implementer works from its `Uxx.md`

- **Problem:** every implementer read `speckit.implement.md`, the full `tasks.md` and `app.instructions.md`, and there were 8 step-limit cut-offs.
- **Decision:** the prompt carries the path of its `Uxx.md` (with `feature_directory`, `## writes` and the text of its tasks). It does not read the full `tasks.md` or `speckit.implement.md`. Limit of **3 tasks or 4 files** per unit; if larger, it closes with `BLOCKED` instead of exhausting its steps.
- **What happens to the rules of `speckit.implement.md`:** what applies to a unit (tests before the code they cover, file coordination, error reporting) is summarized in the agent. The rest (hooks, prerequisites, checklist gate, `ignore` files) is handled **once** by a [preflight](#b6-one-time-preflight-and-tsc-per-wave) before the waves.

#### B5. Role precedence and `cambios_de_contrato`

- **Problem:** the writer reconciles conflicts with the criterion "evidence and constitution", with no order between roles. Implementers could change contracts without anyone knowing.
- **Precedence decision**, from highest to lowest:
  1. the constitution,
  2. user decisions,
  3. what spec and plan already say,
  4. the role's recommendation.

  Security and accessibility **block** against UX or performance unless the user decides otherwise. If the conflict changes the scope, it goes to `question`.
- **`cambios_de_contrato`:** a new section in the return contract with what the implementer added or changed that is **not** in `data-model.md` or `contracts/`. The orchestrator accumulates them in `.opencode/runs/<feature>/cambios_de_contrato.md` and passes them to `converge` and to `code-review`.
- **The writer's `preguntas_abiertas`** are handled like the researchers', and whatever is adopted as an assumption is saved as `decision/<slug>`.

#### B6. One-time preflight and `tsc` per wave

- **Preflight:** a `general` runs the preliminary steps of `speckit.implement.md` (hooks, prerequisites, checklist gate, `ignore` files) **once per phase**, not once per unit. A pending decision arrives as `preguntas_abiertas`.
- **`verify.sh --changed tsc test` after each wave:** `lint` and `tsc` only ran at the end, which caused two fixes after `code-review`. The next wave does not start until `tsc` and the affected specs pass. (It used to be `verify.sh tsc`; see [Verification speed-up](12-verification-speedup.md#24---changed).)

## 5. What was NOT done and why

| Rejected | Reason |
|---|---|
| Moving implementers and reviewers to `#low` | The effect on quality is not measured. |
| Moving the orchestrator to `#low` | Same reason; also, a primary agent's variant may not apply from the frontmatter in V2. |
| Reducing pasted images | They cost 1–2K tokens each: not a real lever. |
| Modifying Spec-Kit | Project constraint: `.opencode/commands/speckit.*`, `.specify/**` and the constitution are **not touched**. |
| Saving full child reports to files | Only decisions that affect other tasks matter. |
| Opening permissions with `git *` | Breaks least privilege. |
| Rewriting `docs/` already modified by the user | Their uncommitted changes were respected. |

## 6. Scripts

All in `.opencode/scripts/bash/`.

### 6.1 `schedule.mjs`

```bash
node .opencode/scripts/bash/schedule.mjs <feature_directory>/tasks.md [--run-dir <dir>] [--max N] [--group-tasks N] [--group-files N]
```

Deterministic and LLM-free. It computes each task's level with these dependencies:

1. Blocking phases (Setup/Foundational) before the stories; Polish/Convergence at the end.
2. Within a phase, a non-`[P]` task waits for all earlier ones; a `[P]` task waits for none (only for file conflicts and explicit dependencies).
3. Explicit dependencies ("depends on T010", "after T009").
4. Story dependencies (`USn` … "after `USm`" in *User Story Dependencies*).
5. File conflict: the later task waits for the earlier one if they share a path or directory.

It then merges short chains of one story into a single unit (max 3 tasks and 4 files), sends installs and tasks without paths to their own waves, and splits waves at the simultaneous maximum (`--max`, default 10).

**Output:** a short table on stdout, `<run-dir>/schedule.json` and one `<run-dir>/units/Uxx.md` per unit. Marks in the table:

| Mark | Meaning |
|---|---|
| `*` | Touches `SHARED_FILES`: never merged; only path conflicts serialize it. |
| `!` | No inferred paths, or install/migration/generator: runs in its own wave. The orchestrator must declare its `writes` before launching it. |

**Known limits**
- The `writes` are **inferred** from backticked paths whose first segment exists at the repo root. A path cited only as a reference counts as a write (more conservative, not less safe).
- `tasks.md` expresses many dependencies in prose; the script covers the mechanical ones and lists the doubtful ones. An indirect dependency (a component importing a hook created in another task with no shared path) is not detected.
- If a task needs to edit a barrel its description does not mention, the implementer will report it as a blocker.

### 6.2 `mark-tasks.sh`

```bash
.opencode/scripts/bash/mark-tasks.sh <tasks.md> T001 T002 …
```

Marks `[X]` by ID and returns "marked / already / not found". Exit 1 if any ID does not exist.

### 6.3 `scope-check.sh`

```bash
.opencode/scripts/bash/scope-check.sh snapshot <baseline.tsv>
.opencode/scripts/bash/scope-check.sh check <baseline.tsv> <Uxx.md …>
.opencode/scripts/bash/scope-check.sh check <baseline.tsv> --paths <path|prefix/|glob> …
```

`snapshot` saves the tree state before the wave; `check` lists only what changed **outside** the `writes`. Exit 1 if there are out-of-scope files.

### 6.4 `verify.sh`

```bash
.opencode/scripts/bash/verify.sh [--log-dir <dir>] [--changed] [lint tsc test build]
```

With no arguments it runs `lint`, `tsc`, `test` and `build` **in parallel**, without stopping at the first failure. It shows PASS/FAIL, duration and, on failure, the first error lines, always in the order `lint`, `tsc`, `test`, `build`.

- **`--changed`:** `test` runs only the specs affected by uncommitted changes. It is for iterating (e.g. after each wave); the `verify` phase runs everything without the flag.
- **`VERIFY_TEST_WORKERS=N`:** overrides the 4-worker Vitest cap defined in `vitest.config.ts`.
- **`build` without duplicate `tsc`:** `pnpm build` already runs `tsc`; when `tsc` is in the list, `build` runs only `vite build`.

With this, the full verification went from **200–280 s to 41 s**. Details, measurements and limits in [Verification speed-up](12-verification-speedup.md).

## 7. File map

### Modified

| File | Change |
|---|---|
| `.opencode/agents/sddorch.md` | Trim (−20%), `specify`/`clarify` in a subagent, scripts, `pending_question`, precedence |
| `.opencode/agents/sddorch-writer.md` | Writes PRD/RFC as files; pointers in Engram; precedence |
| `.opencode/agents/sddorch-implementer.md` | Reads its `Uxx.md`; 3 tasks / 4 files limit; `cambios_de_contrato` |
| `.opencode/agents/sddorch-release.md` | `#low`, git permissions, one command per call, `cierre` mode |
| `.opencode/agents/sddorch-reviewer.md` | Git permissions, one command per call, reviews `cambios_de_contrato` |
| `.opencode/instructions/sddorch-contract.md` | Return cap, `cambios_de_contrato`, shorter contract |
| `.opencode/instructions/memory.instructions.md` | `prd`/`rfc` pointers, compact `state`, `pending_question` |
| `.opencode/.gitignore` | `runs/` |
| `.opencode/README.md` | Scripts and `runs/` |
| `opencode.json` | `compaction.buffer: 800000` |

### New

`.opencode/scripts/bash/schedule.mjs`, `mark-tasks.sh`, `scope-check.sh` and `verify.sh`; and this document.

### Not touched

`.opencode/commands/speckit.*`, `.specify/**` (only `feature.json` is read) and the constitution.

## 8. Known risks and pending work

| Risk / pending | Detail |
|---|---|
| No real measurement | All figures in §3 are simulation. A new run must be measured. |
| `compaction.buffer` | Not verified that it applies in the installed OpenCode version. |
| `clarify` in a subagent | Need to check that `preguntas_abiertas` arrives well-formed and that resuming via `sessionID` works. |
| `!` units | The orchestrator must declare the `writes` before launching them; otherwise their own wave loses parallelism. |
| `sddorch.md` at 16.6K | Below the 14K goal. Option: move detail to a conditionally-read file (saves ~1.5–1.7K, but adds a read). |
| Concurrent sessions | In 009 another session wrote to the same tree at the same time; scope cannot be guaranteed in that case. |
| Iterations after the PR | They still add 40–70K each; only compaction or a new session contains them. |
| Gate quality | Not yet analyzed how many `REJECTED` add value and how many are noise. |
| Fixed cost per agent | Skills, MCP and Code Mode per child: not yet analyzed. |

## How to measure the next run

Launch a small feature with a **new session** of the `sddorch` agent. Avoid pasting large images into the orchestrator and do not open another session that writes to the same tree.

| Metric | 009 reference | Target (simulated) | Measured |
|---|---|---|---|
| Context after `plan` (step ≈62) | 127.4K | 67.6K | |
| Context in the 1st `implement` wave (step ≈73) | 165.6K | 80.3K | |
| Context when opening the PR (step ≈146) | 285.5K | 172.4K | |
| Context at the end | 470.4K | 329.4K | |
| Waves with a single implementer | 22 of 37 | fewer | |
| Max simultaneous | 6 | up to 10 | |
| Children cut by the step limit | 8 | 0 | |
| `release` steps lost to permissions | 24% | ~0% | |
| Fixes after `code-review` from `lint`/`tsc` | 2 | 0 | |
| Times the scripts are used | — | always | |

What to check in the session:

1. `specify` and `clarify` return `preguntas_abiertas` and resume via `sessionID`.
2. `schedule.mjs` runs and `!` units get `writes` before being launched.
3. `release` in `cierre` mode commits and generates `pr-detail.md` in a single pass.
4. Compaction triggers near 800K (if reached).
5. Children respect the return cap.
