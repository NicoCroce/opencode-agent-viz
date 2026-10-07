# OpenCode Agent Viz

Real-time visualization of multi-agent executions in OpenCode.

## Setup

### Prerequisites

- Node 22+, pnpm 9+
- OpenCode 1.18.34+. La visualización debe conectarse al **background service**
  (el mismo servidor que usa el TUI), no a un `opencode serve` aparte: ambos
  comparten la base de datos, pero sólo el proceso que ejecuta tus sesiones
  emite sus eventos SSE en vivo.

### Installation

```bash
pnpm install
pnpm start
```

`pnpm start` resuelve la URL del service con `opencode service status` y toma la
password de `~/.config/opencode/service.json`, exportándolas como
`OPENCODE_URL` / `OPENCODE_PASSWORD`. El proxy de Vite reenvía `/oc` a ese
servidor e inyecta la autenticación.

Si preferís correr Vite solo (`pnpm dev`), exportá esas variables y apuntá al
background service; el default es `http://127.0.0.1:4096`:

```bash
OPENCODE_URL=http://127.0.0.1:49374 \
OPENCODE_PASSWORD=... pnpm dev
```

### Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start dev server (Vite) |
| `pnpm build` | Build for production |
| `pnpm lint` | Run ESLint |
| `pnpm tsc` | TypeScript type check |
| `pnpm test` | Run Vitest |
| `pnpm test:watch` | Watch mode |
| `pnpm test:coverage` | Coverage report |
| `pnpm test:live` | Integration test against the OpenCode background service |

## Architecture

See [AGENTS.md](./AGENTS.md) for conventions and [docs/agent-viz-plan.md](./docs/agent-viz-plan.md) for technical plan.

### Key Layers

- **Infrastructure:** SDK client, event stream provider, global routes
- **Application:** Shared components (shadcn), hooks, helpers
- **Domains:** Functional modules (Connection, Sessions, Graph, Inspector)

### Data Flow

1. **Init:** TanStack Query loads sessions, statuses, agents
2. **Real-time:** SSE EventStreamProvider → queryClient.setQueryData
3. **Graph:** Pure function derives nodes/edges from query state
4. **UI:** Components consume hooks; hooks consume queryClient

## Features

- **Connection**: live status (connected / reconnecting / disconnected).
- **Sessions**: root sessions with agent, title, status and time; most recent is active by default.
- **Graph**: hierarchical agent/subagent graph (React Flow + dagre) with live status; stable layout on state-only changes.
- **Inspector**: per-node agent, model, tools history, todos and errors.
- **Execution detail** (`specs/003-execution-detail-views/`):
  - **Answers & reasoning**: sanitized rich text (markdown/GFM) with an independent reasoning toggle, in chronological order and interleaved with tool calls.
  - **Full history overlay**: the complete conversation of any agent/subagent with progressive (unbounded) loading, identity/metrics header, parent↔child lineage navigation and close-back-to-graph.
  - **Execution state**: 9 statuses (`created`, `running`, `retrying`, `compacting`, `waiting-permission`, `waiting-input`, `succeeded`, `failed`, `interrupted`) consistent between node and detail, with retry and interrupt reason.
  - **Session summary bar**: status counters, accumulated cost/tokens and elapsed time, updated live without relayout.
  - **Repository impact**: changed files with status and added/removed lines plus the per-file patch.
  - **Waiting & diagnostics**: permission reason, user questions with options/state, queued turns, compaction context and median tool duration.
- **Metrics**: duration, cost and token usage (input/output/reasoning/cache) per agent and per session, with an explicit "not available" state.
- **Loops**: invocation counts and provider-retry-based loop flag with evidence.
- **Resources**: available skills, instruction files, MCP servers and tools (labelled "available", never "used").
- **Follow mode** and **permission-waiting** highlights.
- **Dark Mode / Flat Design** UI.

Read-only by design: the viewer never sends prompts, aborts sessions, or replies to permissions/questions, and never processes streaming text deltas (consolidated text only).

## Development with Spec-kit

Specs live in [`specs/`](specs/):

- [`001-agent-viz-observability/`](specs/001-agent-viz-observability/) — base observability feature (`spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`).
- [`003-execution-detail-views/`](specs/003-execution-detail-views/) — execution detail views: answers/reasoning, full history overlay, enriched execution state, session summary, repository impact and waiting diagnostics. Read-only endpoints: `session.message.list` (cursor pagination), `session.diff`, `session.form.list`/`session.form.get`, `session.inbox.list`, `session.context`, `session.log` (`follow: false`), `session.export`; rendering adds `react-markdown` + `remark-gfm` + `rehype-sanitize`.

See [.specify/memory/constitution.md](.specify/memory/constitution.md) for principles.

## Next Steps

1. Run a live OpenCode session and validate `quickstart.md` scenarios V1–V8.
2. Capture a real event fixture with `pnpm fixture` and extend the reducer tests.

---

Built with React 19, Vite 8, TanStack Query 5, React Flow, Tailwind 4.
