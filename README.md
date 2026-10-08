# OpenCode Agent Viz

Real-time visualization of multi-agent executions in OpenCode.

## Setup

### Prerequisites

- Node 22+, pnpm 9+
- **OpenCode 2.0.22+** (V2 line). The viewer consumes the V2 API through
  `@opencode/client` 2.0.22; a 1.x server does not expose those endpoints
  (`session.active`, flat messages, `limit` of 200 per page, etc.).

### Installation

```bash
pnpm install
pnpm start
```

### Connecting to OpenCode

The viewer is **read-only** and connects to the OpenCode **background service**:
the same process the TUI connects to, **not** a separate `opencode serve`. Both
share the SQLite database, but only the process running your sessions emits its
SSE events live; against a separate server the events only arrive on refresh
(which is a read of the DB).

Steps:

```bash
# 1. Check that the version is >= 2.0.22
opencode --version

# 2. Make sure the background service is running
opencode service status
opencode service start    # only if it is not running

# 3. Start the viewer (resolves URL + password and starts Vite)
pnpm start
```

`pnpm start` (`scripts/start.sh`) discovers the URL with `opencode service status`,
takes the password from `~/.config/opencode/service.json` and exports them as
`OPENCODE_URL` / `OPENCODE_PASSWORD`. The Vite `/oc` proxy forwards to the
service and injects the `Authorization: Basic` header (user `opencode`), so the
browser never handles credentials.

If events do not arrive live (they only show up on refresh), it is almost always
because you are pointing at a different `opencode serve` than the one running
your sessions: make sure `OPENCODE_URL` is the background service's.

#### Connection variables

| Variable | Source | Description |
|----------|--------|-------------|
| `OPENCODE_URL` | `opencode service status` | URL of the background service (e.g. `http://127.0.0.1:49374`). Fallback when starting Vite standalone: `http://127.0.0.1:4096`. |
| `OPENCODE_PASSWORD` | `~/.config/opencode/service.json` | Password of the V2 server (HTTP Basic). If missing, `/oc` responds **401**. |

To run Vite standalone (`pnpm dev`) against the background service, export both
variables (if the password is missing, calls to `/oc` will fail with 401):

```bash
OPENCODE_URL=http://127.0.0.1:49374 \
OPENCODE_PASSWORD=... pnpm dev
```

The status indicator in the UI (`ConnectionBadge`) reflects the SSE connection:
**connected / reconnecting / disconnected**.

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
