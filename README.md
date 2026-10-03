# OpenCode Agent Viz

Real-time visualization of multi-agent executions in OpenCode.

## Setup

### Prerequisites

- Node 22+, pnpm 9+
- OpenCode 1.18.34+ running on `localhost:4096` (start with `opencode --port 4096`)

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

## Development with Spec-kit

The project skeleton is ready. You can now run Spec-kit phases independently:

```bash
# In this directory, with OpenCode available:
specify init --ai opencode --here
# Then: specify, clarify, plan, tasks, analyze, implement
```

See [.specify/memory/constitution.md](.specify/memory/constitution.md) for principles.

## Next Steps

1. Run Spec-kit to refine the design and define styles
2. Implement domains in order: Connection → Sessions → Graph → Inspector
3. Add tests for pure functions (event reducers, graph builder)
4. Polish UI and performance

---

Built with React 19, Vite 8, TanStack Query 5, React Flow, Tailwind 4.
