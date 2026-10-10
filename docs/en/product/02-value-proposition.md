# Value proposition

## The problem

Multi-agent executions are **black boxes**.

When an OpenCode flow spawns an agent that in turn delegates to several
subagents, questions appear that the terminal does not answer well:

- Which agent is running now, and which is blocked?
- Why did the execution stop? Is it waiting for a permission or an answer?
- How much did each branch of the execution cost, in time and tokens?
- Which files did it actually touch?
- Is there a loop or an endless retry?

OpenCode's TUI shows text and some states, but not the **structure** of the
orchestration or its **cost** in a comparable way. Logs and the database require
internal knowledge and are not live.

## The solution

Agent Viz turns OpenCode's event stream into a **live picture of the
execution**:

- a **hierarchical graph** agent → subagent with live status;
- a per-node **inspector** with model, effort, tools, and errors;
- a **complete execution detail** with answers, reasoning, full history, and
  repository impact;
- **metrics** for duration, tokens, and cost;
- **diagnostics** for waits (permissions, questions), loops, and retries.

All **in real time** and **read-only**.

## Why now?

The use of agents and subagents has grown faster than their observability tools.
Teams already entrust real work to multi-agent orchestrations, and they need to
see them as clearly as they see a build or a deploy. Agent Viz fills that gap:
native observability for OpenCode's execution model.

## Differentiators

| Approach | What it gives you | What it lacks |
|---|---|---|
| OpenCode TUI | Text and basic states | Does not show the graph structure or compared cost |
| Reading logs / the DB | Raw data | Not live, requires internal knowledge |
| **Agent Viz** | Live graph + inspector + metrics + detail | — |

And a deeper difference: **Agent Viz is read-only by design**. It cannot alter an
execution, so you can use it on real sessions without fear.

## Audiences and what each gains

| Audience | What they get |
|---|---|
| OpenCode developer | See and debug the orchestration instead of guessing it |
| Team / tech lead | Audit cost, tokens, and times per session |
| Agent / SDD author | Fix the orchestrator's design with evidence |
| Teacher / demo | Show how a multi-agent system behaves |

## Non-goals (v1)

- **It does not control executions.** It does not send prompts, abort sessions,
  or reply to permissions or questions.
- **It is not an OpenCode server.** It consumes the existing background service.
- **It does not persist its own history.** The source of truth is OpenCode.
- **It is not multi-project or remote.** Today it observes the connected local
  project.

These limits are part of the proposition: an observer that cannot intervene is
an observer you can trust.
