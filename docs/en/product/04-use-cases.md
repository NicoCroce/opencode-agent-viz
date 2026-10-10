# Use cases

Real scenarios where the viewer changes the conversation.

## 1. Debugging a subagent that fails

A subagent runs a task and ends in `failed`. You select the node in the graph,
open the inspector, and see model, tools, todos, and the error. From the full
history you navigate to the parent to understand what it asked for.

**Before:** searching for the error in terminal text.
**After:** the red node takes you straight to the cause.

## 2. Understanding why a session stalled

The execution is not moving. The graph highlights the node in
`waiting-permission` or `waiting-input`; the waiting section shows the
permission reason or the pending question with its options.

**Before:** not knowing whether it is thinking or waiting for you.
**After:** you see exactly where it needs you.

## 3. Auditing the cost of a long session

You open the session summary: status counters, accumulated cost and tokens
(input/output/reasoning/cache), and elapsed time. You compare agents to see
where the budget went.

**Before:** discovering the cost at the end.
**After:** seeing it while it happens.

## 4. Watching SddOrch (or any orchestrator) in action

You launch an SDD flow and observe the phases, the parallel implementation
waves, and how each subagent appears and resolves in the graph.

**Before:** trusting the orchestrator did the right thing.
**After:** verifying it with your own eyes.

## 5. Detecting loops and retries

An agent retries the provider over and over. The loops view flags the pattern
with evidence (invocation counts and retries), so you cut it in time.

**Before:** noticing it once it already over-consumed.
**After:** catching it as it forms.

## 6. Reviewing repository impact before committing

The impact section lists changed files with status and added/removed lines, plus
the per-file patch.

**Before:** `git diff` by hand, without context of which agent did it.
**After:** the impact next to the execution that produced it.

## 7. Teaching or demoing multi-agent executions

You project the live graph while a flow runs: delegation, parallelism, and state
changes are visible.

**Before:** describing the behavior with slides.
**After:** showing it live.
