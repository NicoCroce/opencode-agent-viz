# FAQ — SDD model / SddOrch

### Does SddOrch modify Spec-Kit?

No. The `speckit.*` commands, the scripts, the templates, and the constitution
are **off-limits**. SddOrch reads and executes them to the letter; its own logic
lives in the orchestrator agent and in its own phases (discovery, `schedule`,
`verify`, `release`).

### What is discovery, and does it replace the former `sddorch-recon`?

Yes. Discovery is a pre-Spec-Kit stage where several **researchers** investigate
the request by **discipline** (product, UX, security, performance, quality,
accessibility) and a **writer** reconciles their reports into a **PRD** and an
**RFC**. It replaces `sddorch-recon` (which analyzed from fixed technical
angles). See [`03-discovery.md`](03-discovery.md).

### What are the three routes (fast, level 1, level 2)?

- **Fast:** several bounded, independent changes; no `spec`/`plan`/`tasks`, just
  a table of units.
- **Level 1:** medium feature; short discovery (2–3 roles) and a one-page
  PRD/RFC.
- **Level 2:** large or risky feature; up to 5 roles, full PRD/RFC, and extra
  gates.

The fast route escalates to full SDD if new contracts, data, or dependencies
appear, or if there are too many units.

### When should I use Plan mode and when Auto?

- **Plan** when the change is complex, ambiguous, or risky: you want to approve
  discovery, the spec, and the plan before implementing.
- **Auto** when the change is simple or bounded (fast route or level 1): it
  chains and only stops on a real blocker.

The user always decides; SddOrch suggests based on the level and risks.

### Will subagents ask me anything?

No. **No subagent asks the user.** Doubts come back as `preguntas_abiertas`
(question, options, recommended, impact) and the orchestrator centralizes them
into **one** `question` call.

### What if a task fails?

The wave is finished, the failed task is retried once with the error as context,
and if it persists, dependent tasks are marked blocked. In Auto mode it stops
and returns to Plan.

### How many agents can work in parallel?

Up to `MAX_PARALLEL_IMPLEMENT` (10 by default) in implementation and
`MAX_PARALLEL_RESEARCH` (5 by default) in discovery. The actual limit per wave is
decided by the planner based on dependencies and shared files.

### How does it avoid two subagents stepping on files?

Three layers: the planner builds waves without shared `writes`; the contract
obliges each subagent to write only to its `writes`; and the orchestrator
**verifies** with `git status` against what was declared at the end of each
wave.

### Who writes to Engram?

The orchestrator (`north`, `state`, `decision/*`, `units`, `run`,
`harness-signal`), the **researchers** (only their `findings/<role>`), and the
**writer** (`prd`, `rfc`, `recon-discarded`). Each in its own key; the other
subagents do not touch Engram. See [`07-memory.md`](07-memory.md).

### Do I need Engram or another memory system?

It is what allows resuming flows, passing **pointers instead of content**, and
accumulating harness signals. Without persistent memory the method works, but it
loses interruption tolerance and the self-learning loop.

### Can I run a single phase?

Yes. If the user asks for a specific phase, SddOrch runs only that one.

### Can I use it in another repository?

Yes. The model is designed to be reusable: it is based on Spec-Kit
(language-agnostic), an orchestrator, subagents with permissions, and roles with
profiles. What changes between repos are `VERIFY_COMMANDS`, `SHARED_FILES`, the
roles, and the domain instructions, not the method.

### What is a "constitution gate"?

A fixed point where a read-only reviewer evaluates the work against the
project's principles and returns `OK`/`RISK`/`VIOLATION` or
`APPROVED`/`REJECTED`. A rejection sends the flow back to the previous phase
with feedback.

### Does SddOrch make commits or push?

Only through the `sddorch-release` subagent, and under strict rules: never
`--no-verify`, never `git add .`, never a direct push. Opening the PR always
requires explicit confirmation.

### What are "harness signals"?

Frictions of the harness itself (a missing skill, instruction, script…) that
subagents report. The orchestrator accumulates them and at the end proposes
creating the pieces that repeated or caused failures. See
[`06-auto-learning.md`](06-auto-learning.md).

### Where do the skills come from?

There are the project's own skills (domain, tests, review, commits, PR, progress)
and third-party ones tied to the discovery roles (React, OWASP, TDD,
accessibility, and product). Origin and licenses in [`08-skills.md`](08-skills.md).

### Can I use the model without this repo's frontend?

Yes. The SDD track describes the method; the viewer is an independent product
that, in fact, was used to observe it. See the product track.
