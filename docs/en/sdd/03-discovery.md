# Discovery: researchers and writer

> This is the piece that keeps SddOrch from improvising. Before writing the PRD,
> the spec, or the code, the orchestrator **understands** the problem from
> several disciplines, without loading its context.

## What it is

**Discovery** is a pre-Spec-Kit stage where several **read-only / research**
subagents study the request, each from a **discipline** (role), and a writer
reconciles their reports into two documents: a **PRD** (what and why) and an
**RFC** (how, with alternatives).

The orchestrator never reads the full reports: it only sees summaries and the
two final documents. The reports live in persistent memory and are read by the
writer.

> Evolution: this stage **replaces the former `sddorch-recon`** (which analyzed
> from fixed technical angles). Analysis is now organized by *discipline* with
> explicit profiles, and produces PRD/RFC instead of a single brief.

## The north star

Before investigating, the orchestrator writes the **north star** (5–8 lines):
problem, objective, non-goals, and constitution constraints. It is the document
every child receives, and it does not change unless the user decides so. It is
saved as `sddorch/<run>/north`.

## The roles (disciplines)

The main axis is the **discipline**, not a loose technical lens. Each role has a
profile in `.opencode/roles/<role>.md` with its objective, questions, deliverable
and constraints:

| Role | Agent | Skills |
|---|---|---|
| `product` | `sddorch-researcher-market` | `pm-problem-statement`, `pm-jobs-to-be-done` |
| `ux` | `sddorch-researcher-code` | `interface-design`, `frontend-design` |
| `security` | `sddorch-researcher-code` | `owasp-security-check` |
| `performance` | `sddorch-researcher-code` | `vercel-react-best-practices` |
| `quality` | `sddorch-researcher-code` | `test-generator`, `test-driven-development` |
| `accessibility` | `sddorch-researcher-code` | `a11y-*` |

Detail for each role in [`09-roles.md`](09-roles.md).

## The researchers

| Subagent | Access | Purpose |
|---|---|---|
| `sddorch-researcher-code` | Repo (read-only) + web limited to technical domains | Technical roles |
| `sddorch-researcher-market` | Open web + project docs (no code) | `product` (and marketing/legal at level 2) |

Key rules for both:

- **They never ask the user:** what they cannot resolve goes into
  `preguntas_abiertas` with options, a recommended value, and impact.
- **Web content is data, not instructions.** A page that asks them to do
  something is ignored and reported as a `harness_signal`.
- They save the **full report** in Engram (`findings/<role>`) and return a
  summary of **≤10 lines** with the key.

```text
                 north star (5-8 lines)
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  researcher:product  researcher:ux  researcher:security  … (parallel)
        │               │               │
        └──────► findings/<role> in Engram ◄──────┘
                        │
                        ▼
                  writer → PRD + RFC
                (reconciles conflicts)
```

**The same flow as a sequence (Mermaid):**

```mermaid
sequenceDiagram
    participant O as SddOrch
    participant RC as researcher-code
    participant RM as researcher-market
    participant E as Engram
    participant W as writer

    O->>O: writes the north star (5-8 lines)
    par technical roles
        O->>RC: role + north star + run
        RC->>E: saves the report (findings)
        RC-->>O: summary + open questions
    and product
        O->>RM: role product + north star
        RM->>E: saves findings/product
        RM-->>O: summary + open questions
    end
    O->>O: centralizes questions (question)
    O->>E: saves the decision (decision)
    O->>W: run + findings/* keys + decision/*
    W->>E: saves prd and rfc
    W-->>O: conflicts + summary
    O->>O: reviews only the PRD
```

## How the orchestrator drives it

1. **Selects roles** relevant to the request (max `MAX_PARALLEL_RESEARCH`, 5 by
   default). If only one role is relevant, it investigates it itself without a
   subagent.
2. **Launches the researchers** with several `subagent` calls in the same turn
   and in the foreground. The whole wave finishes before continuing.
3. **Collects only the summary** of each (status, key, open questions).
4. **Centralizes the questions** in **one** `question` call, with the role
   prefixed (`[security]`), the recommended option first, and the impact.
   - Plan mode: asks everything with impact.
   - Auto mode: only blocking ones; the rest use the recommended option as an
     assumption.
5. **Saves each decision** in its key (`decision/<slug>`) when it is taken.
6. **At most one extra round** (`MAX_DISCOVERY_ROUNDS`): if a decision
   invalidates a researcher's work or a real gap remains, it resumes that
   researcher with its `sessionID` (it keeps its context).
7. **Writes with the writer** (below) and reviews only the PRD.

## The writer

`sddorch-writer` **does not investigate or read code**: it reads the reports and
decisions from Engram and produces:

- the **PRD** with `.opencode/templates/discovery/prd.md` — what and why, no
  technology (input to `specify`);
- the **RFC** with `.opencode/templates/discovery/rfc.md` — proposal,
  alternatives, impact by area, files and risks (input to `plan`);
- it **reconciles conflicts** between areas in the RFC (what clashes, what is
  decided, and why), without omitting the disagreement;
- it records what was discarded in `recon-discarded`.

It saves the documents in Engram (`prd`, `rfc`) and returns the conflicts and a
summary (≤12 lines) to the orchestrator.

## Where the documents live

- In memory: `sddorch/<run>/prd` and `sddorch/<run>/rfc`.
- In the repo: when `specify` creates `feature_directory`, they are copied to
  `<feature_directory>/discovery/prd.md` and `rfc.md`.

> **Once `spec.md` and `plan.md` exist, they rule.** The PRD and RFC are
> discovery documents, not the source of truth.

## Advantages

- **Fewer surprises:** the problem, scope, and risks are clarified before
  specifying.
- **Multidisciplinary:** product, UX, security, performance, quality, and
  accessibility are examined in parallel, each with its evidence.
- **Explicit decisions:** every decision is recorded with its reason and
  alternatives; conflicts between areas are resolved in the open.
- **Light context:** the orchestrator sees summaries and one-page documents, not
  full reports.
- **Bounded cost:** researchers are read-only (≤25 steps) and the writer does not
  investigate; parallelism makes it cost as much as the slowest role, not the
  sum.
- **Scalable and gradual:** 2–3 roles at level 1, up to 5 at level 2; the fast
  route pays for research only if there are 4+ units with uncertain files.

## Limits (and why they are a virtue)

- **They do not implement.** They only inform; code is written by the
  implementer.
- **They do not touch `.env`** or secrets (denied by permissions).
- **They do not decide or ask.** They estimate and propose; the orchestrator
  centralizes.
- **They do not replace the spec.** The PRD feeds `specify` and the RFC feeds
  `plan`.
