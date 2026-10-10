# OpenCode Agent Viz — Documentation

> Real-time observability for OpenCode multi-agent executions, and the
> **SDD · SddOrch** methodology it is built with. This README is the **master
> index** of all the repository's documentation and its **glossary**.

**Español:** [README.md](README.md)

## Quick start

Requirements: **Node 22+**, **pnpm 9+**, **OpenCode 2.0.22+**.

```bash
pnpm install
opencode service status   # the background service must be running
pnpm start                # discovers URL + password and starts the viewer
```

Full guide in [Product → Overview](docs/en/product/01-overview.md) and
[How it works](docs/en/product/05-how-it-works.md).

---

## Documentation map

### 1. Product documentation (the viewer)

| Doc | What you will find |
|---|---|
| [Overview](docs/en/product/01-overview.md) | What it is, who it is for, key benefits, and quick start |
| [Value proposition](docs/en/product/02-value-proposition.md) | Problem, solution, differentiators, and audiences |
| [Benefits](docs/en/product/03-benefits.md) | Each benefit as what it is → why it helps → what it avoids |
| [Use cases](docs/en/product/04-use-cases.md) | Seven real usage scenarios |
| [How it works](docs/en/product/05-how-it-works.md) | Architecture, connection, data flow, stack, and commands |
| [FAQ](docs/en/product/06-faq.md) | Frequent questions and objections |

### 2. SDD · SddOrch methodology

| Doc | What you will find |
|---|---|
| [Overview](docs/en/sdd/01-overview.md) | The model, the three routes, Plan/Auto modes, and advantages |
| [Phases and gates](docs/en/sdd/02-phases.md) | Discovery, each phase, where it runs, and which gate protects it |
| [Discovery: researchers and writer](docs/en/sdd/03-discovery.md) | Roles, researchers, PRD/RFC, and their advantages |
| [Subagents and contract](docs/en/sdd/04-subagents.md) | Catalog, least-privilege permissions, and response contract |
| [Wave scheduling](docs/en/sdd/05-scheduling.md) | Waves, `[P]`, shared files, and scope verification |
| [Self-learning](docs/en/sdd/06-auto-learning.md) | Harness signals: the continuous-improvement loop |
| [Memory and resumption](docs/en/sdd/07-memory.md) | Engram keys, pointers, and how a flow resumes |
| [Skills catalog](docs/en/sdd/08-skills.md) | Project and third-party skills: purpose, origin, and licenses |
| [Discovery roles](docs/en/sdd/09-roles.md) | The six disciplines: purpose, agent, and skills |
| [FAQ](docs/en/sdd/10-faq.md) | Frequent questions about the model |

**Spanish mirror:** [docs/es/](docs/es/) — [product](docs/es/product/01-overview.md) · [sdd](docs/es/sdd/01-overview.md).

### 3. Technical and harness reference

| Resource | What it contains |
|---|---|
| [AGENTS.md](AGENTS.md) | Project conventions and development flow |
| [.opencode/README.md](.opencode/README.md) | Index of the harness configuration (agents, skills, scripts) |
| [app.instructions.md](.opencode/instructions/app.instructions.md) | Frontend-by-domain conventions (applies to `src/Domains/**`) |
| [memory.instructions.md](.opencode/instructions/memory.instructions.md) | SddOrch memory rules in Engram |
| [sddorch-contract.md](.opencode/instructions/sddorch-contract.md) | Subagent response contract |
| Agents: [sddorch](.opencode/agents/sddorch.md) · [researcher-code](.opencode/agents/sddorch-researcher-code.md) · [researcher-market](.opencode/agents/sddorch-researcher-market.md) · [writer](.opencode/agents/sddorch-writer.md) · [implementer](.opencode/agents/sddorch-implementer.md) · [reviewer](.opencode/agents/sddorch-reviewer.md) · [tester](.opencode/agents/sddorch-tester.md) · [release](.opencode/agents/sddorch-release.md) | Definition of each agent and its permissions |
| Roles: [`.opencode/roles/`](.opencode/roles/) | Discipline profiles (product, ux, security, performance, quality, accessibility) |
| Templates: [`.opencode/templates/discovery/`](.opencode/templates/discovery/) | PRD and RFC templates |
| [Skills](.opencode/skills/README.md) | Own: [front-ddd-generator](.opencode/skills/front-ddd-generator/SKILL.md) · [test-generator](.opencode/skills/test-generator/SKILL.md) · [code-reviewer](.opencode/skills/code-reviewer/SKILL.md) · [commit-conventions](.opencode/skills/commit-conventions/SKILL.md) · [pr-detail](.opencode/skills/pr-detail/SKILL.md) · [progress-tracker](.opencode/skills/progress-tracker/SKILL.md). Third-party: `vercel-react-best-practices`, `owasp-security-check`, `test-driven-development`, `a11y-*`, `pm-*` (see index) | Reusable harness guides |
| `.opencode/commands/speckit.*` | Spec-Kit commands (analyze, checklist, clarify, constitution, converge, implement, plan, specify, tasks, taskstoissues) |
| [.specify/memory/constitution.md](.specify/memory/constitution.md) | The project's non-negotiable principles I–VIII |

### 4. Specifications by feature

Spec-Kit artifacts (`spec.md`, `plan.md`, `tasks.md`, `research.md`,
`data-model.md`, `contracts/`) per feature:

| Feature | Title |
|---|---|
| [001-agent-viz-observability](specs/001-agent-viz-observability/spec.md) | Multi-agent observability |
| [002-viz-ux-refinements](specs/002-viz-ux-refinements/spec.md) | Viewer experience refinements |
| [003-execution-detail-views](specs/003-execution-detail-views/spec.md) | Agent execution detail |
| [004-inspector-panel-layout](specs/004-inspector-panel-layout/spec.md) | Reorder and group the detail panel |
| [005-session-filters](specs/005-session-filters/spec.md) | Project and recency filters in sessions |
| [006-graph-render-performance](specs/006-graph-render-performance/spec.md) | Graph viewer performance |
| [007-fix-parallel-lanes-live](specs/007-fix-parallel-lanes-live/spec.md) | Correct parallel lanes in the live graph |
| [008-node-effort-inspector-ux](specs/008-node-effort-inspector-ux/spec.md) | Live node feedback, effort levels, and panel UX |

### 5. Internal / historical documentation

Working notes and analyses that are not part of the public docs:
[docs/internal/](docs/internal/) — the original technical plan, refactor
proposals, and SDK data capture.

---

## Glossary

| Term | Definition | Where to dig deeper |
|---|---|---|
| **SSE** | *Server-Sent Events*: OpenCode's `GET /event` stream that feeds the viewer live. | [How it works](docs/en/product/05-how-it-works.md) |
| **Read-only** | The viewer never writes: it does not send prompts, abort sessions, or reply to permissions. | [Value proposition](docs/en/product/02-value-proposition.md) |
| **Domain** | Functional module under `src/Domains/` (Connection, Sessions, Graph, Inspector) with entity, service, routes, Components, Hooks, and Pages. | [AGENTS.md](AGENTS.md) |
| **`T*` type** | Type derived from the OpenCode SDK (e.g. `TSession`); forbids redefining interfaces the SDK already exports. | [app.instructions.md](.opencode/instructions/app.instructions.md) |
| **Query key** | Centralized TanStack Query key that identifies each data cache. | [AGENTS.md](AGENTS.md) |
| **SDD** | *Spec-Driven Development*: a method where the contract (spec, plan, tasks) is written before the code. | [SDD → Overview](docs/en/sdd/01-overview.md) |
| **Spec-Kit** | Set of commands, templates, and scripts (`speckit.*`, `.specify/`) that SddOrch drives without modifying. | [Phases](docs/en/sdd/02-phases.md) |
| **SddOrch** | The orchestrator agent that chains the phases, delegates to subagents, and saves memory. | [SDD → Overview](docs/en/sdd/01-overview.md) |
| **Phase** | Each step of the pipeline (`specify`, `plan`, `implement`…). | [Phases and gates](docs/en/sdd/02-phases.md) |
| **Gate** | Fixed validation point against the constitution (`plan-check`, `code-review`) that can send back to the previous phase. | [Phases and gates](docs/en/sdd/02-phases.md) |
| **Plan mode** | Execution with user gates after `specify`, `clarify`, and `plan`. | [SDD → Overview](docs/en/sdd/01-overview.md) |
| **Auto mode** | Execution without gates; it only stops on a real blocker. | [SDD → Overview](docs/en/sdd/01-overview.md) |
| **Discovery** | Pre-Spec-Kit stage: researchers by role + writer produce the PRD and RFC. | [Discovery](docs/en/sdd/03-discovery.md) |
| **Role** | Discovery discipline: product, ux, security, performance, quality, accessibility. | [Roles](docs/en/sdd/09-roles.md) |
| **`sddorch-researcher-code`** | Read-only subagent that investigates a technical role with repo access. | [Discovery](docs/en/sdd/03-discovery.md) |
| **`sddorch-researcher-market`** | Subagent that investigates product with web access and no code access. | [Discovery](docs/en/sdd/03-discovery.md) |
| **`sddorch-writer`** | Subagent that writes the PRD and RFC from the reports in Engram. | [Discovery](docs/en/sdd/03-discovery.md) |
| **North star** | 5-8-line document (problem, objective, non-goals, constraints) every agent receives. | [Discovery](docs/en/sdd/03-discovery.md) |
| **Run (`<run>`)** | `<YYYYMMDD>-<slug>` identifier of the run in memory; precedes the feature. | [Memory](docs/en/sdd/07-memory.md) |
| **PRD** | Discovery document (what and why), input to `specify`. | [Discovery](docs/en/sdd/03-discovery.md) |
| **RFC** | Discovery document (how and alternatives), input to `plan`. | [Discovery](docs/en/sdd/03-discovery.md) |
| **Fast route / level 1 / level 2** | The three execution routes by size and risk. | [Overview](docs/en/sdd/01-overview.md) |
| **Wave** | Group of tasks that run in parallel without writing the same files. | [Wave scheduling](docs/en/sdd/05-scheduling.md) |
| **`[P]`** | Parallelizable-task mark in `tasks.md`. | [Wave scheduling](docs/en/sdd/05-scheduling.md) |
| **`SHARED_FILES`** | Conflict files (barrels, `queryKeys.ts`, lockfiles…) that go into an integration wave with a single agent. | [Wave scheduling](docs/en/sdd/05-scheduling.md) |
| **Scope verification** | Checking with `git status` that a subagent wrote only to its `writes`. | [Wave scheduling](docs/en/sdd/05-scheduling.md) |
| **`harness_signal`** | Report of a harness friction (missing skill, instruction, script…) that the orchestrator accumulates. | [Self-learning](docs/en/sdd/06-auto-learning.md) |
| **Harness** | The set of pieces that give the agent capabilities: skills, instructions, subagents, scripts, and hooks. | [Self-learning](docs/en/sdd/06-auto-learning.md) |
| **Engram** | Persistent-memory system where SDD flow state lives. | [Memory](docs/en/sdd/07-memory.md) |
| **`topic_key`** | Stable memory key (`north`, `state`, `findings/<role>`, `decision/<slug>`, `prd`, `rfc`, `run`, `harness-signal`) that updates instead of duplicating. | [Memory](docs/en/sdd/07-memory.md) |
| **Constitution** | The document with the project's non-negotiable principles I–VIII. | [constitution.md](.specify/memory/constitution.md) |
| **`plan-check`** | Gate that validates `plan.md` against the constitution (complex flow). | [Phases and gates](docs/en/sdd/02-phases.md) |
| **`code-review`** | Gate that validates the code after `converge`. | [Phases and gates](docs/en/sdd/02-phases.md) |
| **`verify`** | Phase that runs `VERIFY_COMMANDS` (`lint`, `tsc`, `test`, `build`). | [Phases and gates](docs/en/sdd/02-phases.md) |
| **`release`** | Closing phase: commits, `pr-detail`, and PR opening with confirmation. | [Phases and gates](docs/en/sdd/02-phases.md) |
| **Skill** | Reusable harness guide (for example `test-generator`, `commit-conventions`). | [.opencode/skills/](.opencode/skills/) |

---

## Source of truth

| Topic | The file that rules |
|---|---|
| Conventions and development flow | [AGENTS.md](AGENTS.md) |
| Non-negotiable principles | [.specify/memory/constitution.md](.specify/memory/constitution.md) |
| Frontend conventions | [app.instructions.md](.opencode/instructions/app.instructions.md) |
| Subagent contract | [sddorch-contract.md](.opencode/instructions/sddorch-contract.md) |
| Memory rules | [memory.instructions.md](.opencode/instructions/memory.instructions.md) |
| Definition of each agent | [.opencode/agents/](.opencode/agents/) |

> **Do not edit:** `.opencode/commands/speckit.*`, `.specify/scripts/`,
> `.specify/templates/`, or `.specify/memory/constitution.md`. To change the
> constitution, use `/speckit.constitution`.

---

## Project status

| Feature | Title | Folder |
|---|---|---|
| 001 | Multi-agent observability | [specs/001-agent-viz-observability](specs/001-agent-viz-observability/) |
| 002 | Viewer experience refinements | [specs/002-viz-ux-refinements](specs/002-viz-ux-refinements/) |
| 003 | Agent execution detail | [specs/003-execution-detail-views](specs/003-execution-detail-views/) |
| 004 | Reorder and group the detail panel | [specs/004-inspector-panel-layout](specs/004-inspector-panel-layout/) |
| 005 | Project and recency filters in sessions | [specs/005-session-filters](specs/005-session-filters/) |
| 006 | Graph viewer performance | [specs/006-graph-render-performance](specs/006-graph-render-performance/) |
| 007 | Correct parallel lanes in the live graph | [specs/007-fix-parallel-lanes-live](specs/007-fix-parallel-lanes-live/) |
| 008 | Live node feedback, effort levels, and panel UX | [specs/008-node-effort-inspector-ux](specs/008-node-effort-inspector-ux/) |
