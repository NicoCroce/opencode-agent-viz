# OpenCode Agent Viz

Real-time visualization of multi-agent executions in OpenCode.

## Setup

### Prerequisites

- Node 22+, pnpm 9+
- OpenCode 1.18.34+ running on `localhost:4096` (start with `opencode serve --port 4096`)

### Installation

```bash
pnpm install
pnpm dev
```

Vite proxy will forward `/oc` requests to `http://127.0.0.1:4096`.

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
- **Metrics**: duration, cost and token usage (input/output/reasoning/cache) per agent and per session, with an explicit "not available" state.
- **Loops**: invocation counts and provider-retry-based loop flag with evidence.
- **Resources**: available skills, instruction files, MCP servers and tools (labelled "available", never "used").
- **Follow mode** and **permission-waiting** highlights.
- **Dark Mode / Flat Design** UI.

## Development with Spec-kit

Specs live in [`specs/001-agent-viz-observability/`](specs/001-agent-viz-observability/):

- `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`.

See [.specify/memory/constitution.md](.specify/memory/constitution.md) for principles.

## Next Steps

1. Run a live OpenCode session and validate `quickstart.md` scenarios V1–V8.
2. Capture a real event fixture with `pnpm fixture` and extend the reducer tests.

---

Built with React 19, Vite 8, TanStack Query 5, React Flow, Tailwind 4.
