# How it works

## High-level view

```text
┌──────────┐     /oc (Vite proxy)     ┌────────────────────────┐
│ Browser  │ ───────────────────────► │ OpenCode               │
│ (React)  │ ◄─────────────────────── │ background service     │
└──────────┘       SSE /event         └────────────────────────┘
      ▲                                          │
      │                                          ▼
      │                                  ┌───────────────┐
      │                                  │ SQLite (sessions,│
      │                                  │ messages, etc.) │
      └──────────────────────────────────┴───────────────┘
```

The viewer is **read-only** and connects to OpenCode's **background service**:
the same process the TUI connects to, **not** a separate `opencode serve`. Both
share the SQLite database, but only the process running your sessions emits its
SSE events live.

> If events only arrive on refresh, it is almost always because you are pointing
> at a different `opencode serve` than the one running the sessions: make sure
> `OPENCODE_URL` is the background service's.

## Connection

`pnpm start` runs `scripts/start.sh`, which:

1. discovers the URL with `opencode service status`;
2. takes the password from `~/.config/opencode/service.json`;
3. exports them as `OPENCODE_URL` / `OPENCODE_PASSWORD` and starts Vite.

The Vite `/oc` proxy forwards to the service and injects the
`Authorization: Basic` header (user `opencode`), so the **browser never handles
credentials**.

| Variable | Source | Description |
|---|---|---|
| `OPENCODE_URL` | `opencode service status` | Background service URL (standalone fallback: `http://127.0.0.1:4096`) |
| `OPENCODE_PASSWORD` | `~/.config/opencode/service.json` | Server password (HTTP Basic); if missing, `/oc` responds 401 |

## Layers

| Layer | Responsibility |
|---|---|
| **Infrastructure** | SDK client, `EventStreamProvider`, global routes |
| **Application** | Shared components (shadcn/ui + wrappers), hooks, helpers |
| **Domains** | Functional modules: Connection, Sessions, Graph, Inspector |

Architecture by **functional domains**: each domain has its entity, its service
(queries), its routes, components, hooks, and pages. SDK access happens **only**
from `*.service.ts`; components consume hooks.

## Data flow

1. **Init:** TanStack Query loads sessions, session statuses, and agents.
2. **Real time:** a single SSE subscription (`EventStreamProvider`) dispatches
   events to the `queryClient` with `setQueryData`. Events are batched (~100 ms)
   to avoid excessive re-renders.
3. **Graph:** a **pure function** derives nodes and edges from query state
   (`buildGraph(...)`). The layout (dagre, top→bottom) is recomputed only when
   the topology changes; state changes do not trigger a relayout.
4. **UI:** components consume hooks; hooks consume the `queryClient`.

Processed events: session lifecycle, session status, meaningful message parts
(tools, permissions…). Text and reasoning are **ignored** in streaming: the UI
uses consolidated text.

## Read-only by design

The viewer **never** sends prompts, aborts sessions, or replies to
permissions/questions. There are no write endpoints or mutations toward
OpenCode. It is a structural guarantee, not a convention.

## Screen states

Every screen with data explicitly renders, in order:
**error → loading → empty → data**, and the connection state is always visible.

## Stack

React 19 · Vite 8 · TypeScript strict · TanStack Query 5 · React Router 7 ·
Tailwind 4 · shadcn/ui (Radix) · lucide-react · sonner · React Flow
(`@xyflow/react`) + dagre · `@opencode/client` 2.0.22 · Vitest.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server (Vite) |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm tsc` | Type check |
| `pnpm test` | Vitest |
| `pnpm test:watch` | Watch mode |
| `pnpm test:coverage` | Coverage |
| `pnpm test:live` | Integration test against the background service |
| `pnpm fixture` | Captures a real event fixture |
