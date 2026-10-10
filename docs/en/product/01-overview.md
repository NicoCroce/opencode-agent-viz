# OpenCode Agent Viz — Overview

> **Real-time observability for OpenCode multi-agent executions.**

## What it is

OpenCode Agent Viz is a **read-only web viewer** that shows, live, everything
that happens during one or more agent and subagent executions in OpenCode.

When a flow spawns agents that in turn launch subagents, the execution becomes a
black box: the terminal spits out text and you want to understand **structure,
state, and cost**. Agent Viz solves this with a live hierarchical graph, a
per-node inspector, and a complete execution detail, fed by OpenCode's server
event stream (SSE).

It controls nothing: it **observes**. It never sends prompts, aborts sessions, or
replies to permissions. That makes it safe by design and fit to watch executions
without altering them.

## Who it is for

- **OpenCode developers** who want to see what their agents do.
- **Teams** that need to audit execution cost, tokens, and times.
- **Agent and SDD methodology authors** (such as SddOrch) who need to debug
  multi-agent orchestrations.
- **Anyone teaching or demoing** how an agent system behaves.

## Five key benefits

1. **Understand structure, not just text.** A hierarchical agent → subagent
   graph with live status, instead of infinite scroll.
2. **Diagnose instantly.** The inspector shows agent, model, effort, tools,
   todos, and errors for each node.
3. **See cost clearly.** Duration, tokens
   (input/output/reasoning/cache), and cost per agent and per session, with an
   explicit "not available" state.
4. **Follow execution without getting lost.** A follow mode that centers the
   active node and highlights those waiting for user permissions.
5. **Zero risk.** It is read-only: it does not touch your repo or your sessions.

## Quick start

Requirements: **Node 22+**, **pnpm 9+**, and **OpenCode 2.0.22+**.

```bash
pnpm install
opencode service status   # make sure the background service is running
pnpm start                # discovers URL + password and starts the viewer
```

Open the viewer and you are done. The connection is reflected in the status
indicator (**connected / reconnecting / disconnected**).

## Where to go next

| I want to… | Document |
|---|---|
| Understand the value and differentiators | [Value proposition](02-value-proposition.md) |
| See the benefits in detail | [Benefits](03-benefits.md) |
| See concrete use cases | [Use cases](04-use-cases.md) |
| Understand how it works inside | [How it works](05-how-it-works.md) |
| Clear up doubts and objections | [FAQ](06-faq.md) |
