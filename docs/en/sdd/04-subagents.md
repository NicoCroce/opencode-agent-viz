# Subagents and response contract

SddOrch does not do the work alone: it **delegates**. Each subagent has a
bounded role, minimal permissions, and the obligation to always answer in the
same format.

## Catalog

| Subagent | Mode | Role | Key permissions | Budget |
|---|---|---|---|---|
| `sddorch` | primary | Orchestrator: discovers, plans, delegates, verifies, writes memory | Everything except generic `subagent` and Spec-Kit edits | — |
| `sddorch-researcher-code` | subagent | Investigates a technical role with repo access | Read-only + role skills + Engram (its key) + limited web | 25 steps |
| `sddorch-researcher-market` | subagent | Investigates product/marketing/legal with web and no code | Project docs + `pm-*` skills + Engram (its key) + open web | 25 steps |
| `sddorch-writer` | subagent | Writes PRD and RFC from the reports in Engram | Templates + constitution + Engram (`prd`/`rfc`) | 20 steps |
| `general` | subagent | Runs `plan`, `tasks`, `analyze`, `converge` commands | General | — |
| `sddorch-implementer` | subagent | Runs `implement` tasks or a fast-route unit | Edits only its `writes`; git denied | 40 steps |
| `sddorch-reviewer` | subagent | Constitution gates | Read-only + `code-reviewer` skill | 25 steps |
| `sddorch-tester` | subagent | Tests after `implement` | Edits only `specs/` and `__fixtures__/` | 40 steps |
| `sddorch-release` | subagent | Commits, `pr-detail`, and PR | Only one with `git add/commit`; push denied except PR script | 25 steps |

## Permissions: least privilege

The permission design is a security layer, not a detail:

- **`sddorch-researcher-code`** cannot write files. Only `read`, `glob`, `grep`,
  query `git`, and **only its role's skills**. `*.env*` is denied. Web access is
  limited to technical domains (web.dev, owasp.org, MDN, W3C, React, Chrome).
- **`sddorch-researcher-market`** does not see the code: `read` only over
  `docs/`, `specs/`, `AGENTS.md`, `README.md`, the constitution, and
  `.opencode/roles/`. It has open web (search + fetch) and only `pm-*` skills.
- **`sddorch-writer`** does not investigate: it reads the discovery templates and
  the constitution, and writes Engram. It has no repo `read` or web.
- **`sddorch-reviewer`** does not write either: it reads and applies the
  checklist.
- **`sddorch-implementer`** has git denied (`add`, `commit`, `push`, `stash`,
  `checkout`, `reset`, `rebase`) and cannot touch `tasks.md`.
- **`sddorch-tester`** can edit **only** under `src/*/specs/*` and
  `src/*/__fixtures__/*`.
- **`sddorch-release`** is the **only** one that runs `git add` and `git commit`.
  `git push` is denied; the push is done only by the PR script.

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
