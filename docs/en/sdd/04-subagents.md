# Subagents and response contract

SddOrch does not do the work alone: it **delegates**. Each subagent has a
bounded role, minimal permissions, and the obligation to always answer in the
same format.

## Catalog

| Subagent | Mode | Role | Key permissions | Budget |
|---|---|---|---|---|
| `sddorch` | primary | Orchestrator: discovers, plans, delegates, verifies, writes memory | Everything except generic `subagent` and Spec-Kit edits | — |
| `sddorch-researcher-<role>` (`-ux`, `-security`, `-performance`, `-quality`, `-accessibility`) | subagent | Investigates a technical role with repo access | Read-only + **only its role's skills** + Engram (its key) + limited web + read-only store (`sqlite3 -readonly`) | 60 steps |
| `sddorch-researcher-market` | subagent | Investigates product/marketing/legal with web and no code | Project docs + `pm-*` skills + Engram (its key) + open web | 40 steps |
| `sddorch-writer` | subagent | Writes PRD and RFC from the reports in Engram | Templates + constitution + Engram (`prd`/`rfc`) | 30 steps |
| `general` | subagent | Runs `plan`, `tasks`, `analyze`, `converge` commands | General | — |
| `explore` | subagent | Cheap read-only code exploration (locate files and symbols) | Read-only (`read`, `glob`, `grep`) | — |
| `sddorch-implementer` | subagent | Runs `implement` tasks or a fast-route unit | Edits only its `writes`; git denied | 80 steps |
| `sddorch-reviewer` | subagent | Constitution gates | Read-only + `code-reviewer` skill + Engram + `pnpm tsc/lint/test` to verify | 40 steps |
| `sddorch-tester` | subagent | Tests after `implement` | Edits only `src/*/specs/*` and `src/*/__fixtures__/*` | 60 steps |
| `sddorch-release` | subagent | Commits, `pr-detail`, and PR | Only one with `git add/commit`; creates or switches branches (`git switch`); Engram; push denied except PR script | 50 steps |

> **Budget (`steps`).** It is the step ceiling each subagent can use before
> being cut off. It is calibrated with evidence: if a role exhausts it before
> finishing, it reports it as an `agent` signal and the value is raised or the
> work is split into smaller units (see
> [`06-auto-learning.md`](06-auto-learning.md#tuning-the-step-budget)).

## Permissions: least privilege

The permission design is a security layer, not a detail:

- **`sddorch-researcher-<role>`** and **`-code`** cannot write files. Only `read`, `glob`, `grep`,
  query `git`, and **only its role's skills** (`-code` has none). `*.env*` is denied. Web access is
  limited to technical domains (web.dev, owasp.org, MDN, W3C, React, Chrome). It
  can read the OpenCode store (`~/.local/share/opencode`) in **read-only** mode
  and query it with `sqlite3 -readonly` (also `pnpm test`, `npx vitest` and
  `node`); if the measurement exceeds its budget, the orchestrator runs it with a
  `general` and hands it over as a file. A researcher covers a single artifact or
  role.
- **`sddorch-researcher-market`** does not see the code: `read` only over
  `docs/`, `specs/`, `AGENTS.md`, `README.md`, the constitution, and
  `.opencode/roles/`. It has open web (search + fetch) and only `pm-*` skills.
- **`sddorch-writer`** does not investigate: it reads the discovery templates and
  the constitution, and writes Engram. It has no repo `read` or web.
- **`sddorch-reviewer`** does not write either: it reads, applies the checklist,
  can query Engram (north and decisions) and run `pnpm tsc`/`lint`/`test` to
  verify a specific claim.
- **`sddorch-implementer`** has git denied (`add`, `commit`, `push`, `stash`,
  `checkout`, `reset`, `rebase`) and cannot touch `tasks.md`. It only sees the skills
  `front-ddd-generator`, `vercel-react-best-practices`, `test-driven-development` and `a11y-*`.
- **`sddorch-tester`** can edit **only** under `src/*/specs/*` and
  `src/*/__fixtures__/*` (the *test specs*, not the Spec-Kit `specs/` folder). It only sees
  `test-generator` and `test-driven-development`.
- **`sddorch-release`** is the **only** one that runs `git add` and `git commit`;
  it can create or switch branches (`git switch`) and query Engram. `git push` is
  denied; the push is done only by the PR script.

## Response contract

Every subagent answers with these sections, briefly:

```markdown
## Result
status: DONE | BLOCKED | FAILED
summary: <1-3 lines>

## Artifacts
- `<path>` — created | modified | read

## Decisions
- <relevant decision and reason; "none" if there are none>

## Blockers
- <what prevents progress and what is needed; "none" if there are none>

## Verification
- `<command>` → <result>

## harness_signals
- type: skill | instruction | agent | script | command-hook
  trigger: <situation that caused it>
  workaround: <what you did to get around it>
  evidence: <concrete file, error, or command>
  reuse: <where or how often it would happen again>
```

Some subagents use their own sections:

- `sddorch-researcher-code` / `-market` → `## Result` with the report **key**,
  `## preguntas_abiertas` (question, options, recommended, impact), and
  `harness_signals`. Max 10 lines.
- `sddorch-writer` → `## Result`, `## conflicts`, and `preguntas_abiertas`.
  Max 12 lines.
- `sddorch-reviewer` → `## Review` with `APPROVED | REJECTED`.

### Debugging a Vitest hang

When a spec does not fail but simply **never returns** (100 % CPU), there is no
supported way to break with a debugger: `--cpu-prof` is rejected inside
`NODE_OPTIONS` and `--inspect` only exposes the `tinypool` fork. This recipe
works, always on a tightly scoped spec:

```bash
pnpm vitest run <spec> --pool=forks --poolOptions.forks.singleFork --inspect
```

Then connect over CDP to the inspector port:

1. `Debugger.pause` to break the spin and read the real stack.
2. `Debugger.setBreakpointByUrl` on `scheduleUpdateOnFiber` (React) to see what
   triggers the render, or on `QueryCache.notify` to see which notification
   closes the cycle.
3. Temporary instrumentation with `process.stderr.write('MARK-…')` to pin down
   the last point reached; **remove it before finishing** (a spec with `MARK-*`
   is not acceptable).

In a render loop the stack usually ends in a TanStack Query cache subscription
(`useCachedQueryData`/`useQuery`) that also wakes up on
`observerOptionsUpdated`, not just on data changes.

> **Note:** `vitest.config.ts` sets `pool: 'threads'` with 4 workers. The recipe
> (`--pool=forks --poolOptions.forks.singleFork`) passes its flags on the CLI,
> which take precedence over the config; it was run against the new config on a
> scoped spec and works. A `.spec.ts` runs in
> `node`; if the hang depends on the DOM, check that it declares
> `// @vitest-environment jsdom` ([details](12-verification-speedup.md#8-convention-for-spec-authors)).

## Scope rules (apply to every subagent)

1. It does **only** what the prompt asks.
2. It writes **only** to the indicated `writes`. If it needs another file, it
   reports a blocker; it does not touch it.
3. It does not run `git add/commit/stash/checkout/reset/push/rebase` (except
   `sddorch-release`).
4. It does not mark tasks in `tasks.md`; the orchestrator does.
5. **In Engram only the researchers and the writer write**, each in **its own
   key**. No other subagent touches Engram.
6. **It never asks the user.** Anything blocking comes back as
   `preguntas_abiertas` and the orchestrator centralizes it into one question.
7. It does not run global verifications (`tsc`, `lint`, `test` over the whole
   repo) while other subagents write in parallel. Global ones are run by the
   orchestrator.
8. It does not modify Spec-Kit files.
9. If it is running out of step budget, it **closes clean**: it persists what it
   has and returns `BLOCKED` with the contract, instead of running out of steps.
   The **last message is always the contract block**, even if the work is not
   finished: an empty final response or one without the block leaves the result
   as `UNVERIFIED` and the orchestrator verifies it by hand (`scope-check.sh
   check` + the unit's scoped specs) before deciding whether to relaunch it once.

## Why the contract matters

- **Trivial synthesis:** the orchestrator consumes fixed sections, not free
  text.
- **Light context:** long reports go to Engram; the orchestrator gets the key and
  a summary (**pointers, not content**).
- **Auditability:** every response says what was touched, what was decided, and
  what was verified.
- **Clear boundary:** risk is concentrated at a few controlled points (Engram
  only in research/writer; git only in release).
- **Friction detection:** `harness_signals` travels in the same contract (see
  [`06-auto-learning.md`](06-auto-learning.md)).
