# Benefits

Each benefit in **what it is → why it helps you → what it avoids** format, so
the value is clear and not just the feature.

## Live connection

- **What it is:** an indicator with three states — connected / reconnecting /
  disconnected — reflecting the SSE stream.
- **Why it helps you:** you know whether what you see is up to date or whether
  the connection dropped.
- **What it avoids:** believing an execution is idle when the stream was
  actually lost.

## Sessions

- **What it is:** a list of root sessions with agent, title, status, and time;
  the most recent is active by default.
- **Why it helps you:** you jump straight to what matters, without searching.
- **What it avoids:** getting lost among executions and not knowing which one to
  watch.

## Live hierarchical graph

- **What it is:** an agent → subagent graph (React Flow + dagre) with live
  status and a stable layout for changes that do not alter the topology.
- **Why it helps you:** you see the orchestration structure at a glance and how
  each node progresses.
- **What it avoids:** mentally reconstructing the agent tree from text.

## Per-node inspector

- **What it is:** a detail panel with agent, model, effort, tool history, todos,
  and errors.
- **Why it helps you:** you diagnose a single node without leaving context.
- **What it avoids:** jumping between logs and screens to understand one agent.

## Execution detail

- **What it is:** the full conversation of any agent/subagent.
  - **Answers and reasoning** in sanitized rich text (markdown/GFM), with an
    independent reasoning toggle, in chronological order and interleaved with
    tool calls.
  - **Full history** with progressive (unbounded) loading, an
    identity/metrics header, and parent ↔ child navigation.
  - **Execution state** with 9 consistent states
    (`created`, `running`, `retrying`, `compacting`, `waiting-permission`,
    `waiting-input`, `succeeded`, `failed`, `interrupted`) and retry or
    interrupt reason.
  - **Session summary bar:** status counters, accumulated cost/tokens, and
    elapsed time, updated live without relayout.
  - **Repository impact:** changed files with status and added/removed lines,
    plus the per-file patch.
  - **Waiting and diagnostics:** permission reason, user questions with
    options/state, queued turns, compaction context, and median tool duration.
- **Why it helps you:** you go from "I don't know what happened" to the exact
  sequence of events.
- **What it avoids:** guessing why an agent did what it did.

## Metrics

- **What it is:** duration, cost, and token usage (input/output/reasoning/cache)
  per agent and per session, with an explicit "not available" state.
- **Why it helps you:** you compare and prioritize where the budget goes.
- **What it avoids:** paying for sessions without understanding their cost.

## Loops and retries

- **What it is:** invocation counts and loop detection based on provider
  retries, with evidence.
- **Why it helps you:** you catch an agent that keeps trying in vain.
- **What it avoids:** letting something spin in the air and burn resources.

## Available resources

- **What it is:** skills, instruction files, MCP servers, and available tools,
  labeled **"available"** (never "used").
- **Why it helps you:** you understand what the agent had at hand when it ran.
- **What it avoids:** confusing "it had it available" with "it used it".

## Follow mode and permission waiting

- **What it is:** auto-centering on the active node, toggleable, and special
  highlighting for nodes waiting on user permissions.
- **Why it helps you:** you follow a long execution without searching, and you
  see instantly where you are needed.
- **What it avoids:** a session hanging because you did not notice it was asking
  for permission.

## Read-only by design

- **What it is:** the viewer never sends prompts, aborts sessions, or replies to
  permissions/questions, and does not process streaming text deltas
  (consolidated text only).
- **Why it helps you:** you can watch real executions without intervening.
- **What it avoids:** an observability tool introducing side effects.

## Real-time performance

- **What it is:** events processed in batches, text/reasoning ignored, and no
  full graph relayout on state changes.
- **Why it helps you:** the UI stays fluid with many sessions and thousands of
  tools.
- **What it avoids:** observability itself degrading what it observes.

## Dark, flat, responsive UI

- **What it is:** a dark theme, flat design, and mobile-first presentation (one
  source of logic, two presentations via `useDevice`).
- **Why it helps you:** it works equally well on desktop and mobile.
- **What it avoids:** broken layouts on the phone.
