# Memory and resumption

An SDD flow can last a long time and go through discovery, several phases, and
dozens of subagents. The model's context is finite and fragile: if it is cut, we
do not want to start from scratch. That is why SddOrch saves the **state** and
the **documents** in persistent memory.

## Principle: pointers, not content

Long reports live in memory (**Engram**); the orchestrator and the other agents
pass the **key** and a **short summary**. That keeps the orchestrator's context
small even when discovery is large.

There is no `memory/` folder in the repo (do not create it). The only folder with
that name is `.specify/memory/` (Spec-Kit's constitution) and it is untouched.

## Run identifier (`<run>`)

`<run>` = `<YYYYMMDD>-<request-slug>`. The feature folder (`feature_directory`
from `.specify/feature.json`) **does not exist until `specify`**, so everything
prior hangs off `<run>`. When it is created, it is saved in `state`.

## Who writes, and where

| Agent | May write |
|---|---|
| `sddorch` (orchestrator) | `north`, `state`, `decision/<slug>`, `units`, `run`, `harness-signal/*` |
| `sddorch-researcher-code` / `-market` | only its `findings/<role>` |
| `sddorch-writer` | only `prd`, `rfc`, and `recon-discarded` |
| Other subagents | nothing |

This restriction is not enforced by permissions (the Engram permission is per
tool, not per key): it is honored **by instruction**. Every write goes to **its
own key**, never a shared one, so two agents in parallel do not step on each
other.

## Keys (`topic_key`)

All observations use `project: opencode-agent-viz`.

| Key | Type | Content |
|---|---|---|
| `sddorch/<run>/north` | `decision` | north star: problem, objective, non-goals, constraints (5–8 lines) |
| `sddorch/<run>/state` | `decision` | mode, route, phase, done phases, wave, tasks/units, branch, `feature_directory` |
| `sddorch/<run>/units` | `decision` | fast route: units of change (description, `writes`, criterion, dependencies, state) |
| `sddorch/<run>/findings/<role>` | `discovery` | a researcher's full report |
| `sddorch/<run>/decision/<slug>` | `decision` | one decision: what, why, alternatives |
| `sddorch/<run>/prd` | `decision` | PRD (input to `specify`) |
| `sddorch/<run>/rfc` | `decision` | RFC (input to `plan`) |
| `sddorch/<run>/recon-discarded` | `discovery` | what was discarded in discovery and why |
| `sddorch/<run>/run` | `discovery` | duration per phase, retries, failed tasks |
| `sddorch/harness-signal/<slug>` | `discovery` | type, trigger, workaround, evidence, repetition count |

## Contents of `state`

Short and structured:

```
mode: plan | auto
route: fast | sdd-1 | sdd-2
phase: <current phase>
done: [<completed phases>]
wave: <i>/<n>
tasks: done [T001..] · failed [T0xx] · blocked [T0yy]
branch: <branch>
feature_directory: <path or "does not exist yet">
updated: <ISO date>
```

Saved at the **end of each phase** and when each wave closes. Diffs and terminal
output are not saved.

## What is NOT saved

- Contents of `spec.md`, `plan.md`, or `tasks.md` (they already live in the
  feature).
- Code, diffs, or terminal output.
- Personal data or secrets.

## Resumption and compaction

- At startup, the orchestrator looks for `sddorch/*/state`. If a phase is
  unfinished, it **asks**: resume or start from scratch.
- It always checks against the real repo (`tasks.md`, `git status`).

  > **Memory tells you where you were; the files are the truth.**

- After a conversation **compaction**, it re-reads `north`, `state`, and the
  `decision/*` keys before continuing. As long as the state is in Engram,
  compaction loses nothing important.
- It saves each decision **when it is taken**.

## Advantages

- **Long flows, tolerant of interruptions.** A cut does not force repeating
  discovery, spec, plan, and tasks.
- **Light context.** The orchestrator works with pointers and summaries, not all
  the reports.
- **Traceability.** There is a record of decisions, alternatives, times, retries,
  and friction.
- **Cumulative learning.** Harness signals live in the same memory, so the system
  improves between runs (see [`06-auto-learning.md`](06-auto-learning.md)).
