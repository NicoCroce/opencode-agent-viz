# Wave scheduling (`schedule`)

## The problem

SddOrch does **not use worktrees**: all subagents share the same working tree.
That is fast and simple, but dangerous: if two subagents edit the same file at
once, the result is unpredictable.

`schedule` is the phase that turns `tasks.md` into **waves** of safe parallel
execution, where no subagent steps on another's work.

## How a wave is computed

From each pending task (`- [ ]`) in `tasks.md`, the planner extracts:

- its write paths,
- its `[P]` mark (parallelizable),
- its dependencies.

A **wave** admits tasks that satisfy **all** of these:

1. they are marked `[P]`,
2. they have no pending dependencies,
3. they **do not share files or write directories** with each other.

When in doubt, tasks go in sequence. Parallelism is an optimization, not a
goal: safety wins.

## Shared files

Certain files are conflict points by nature: barrels (`index.ts`),
`queryKeys.ts`, routes, `Routes.tsx`, `package.json`, lockfiles, etc. SddOrch
declares them as `SHARED_FILES`.

Rule: tasks that touch a `SHARED_FILES` entry **leave** the wave and go into an
**integration wave** at the end of their phase, with a **single** subagent.

If `tasks.md` marks a file as shared across stories, it is treated like a
`SHARED_FILE`: two groups of the same wave never write to it, **even if the
tasks are marked `[P]`**.

## Other `schedule` rules

- Dependency installs, migrations, and generators go **alone** in their own
  wave.
- If there are more tasks than `MAX_PARALLEL_IMPLEMENT` (10 by default), the
  wave is split into several successive waves.
- When passing `writes` to each subagent, it is stated explicitly that it **must
  not touch files outside its list** without authorization.
- The wave plan (how many subagents per wave) is shown to the user and saved to
  the flow's memory.

## Scope verification

At the end of each wave, the orchestrator **does not trust**: it checks
`git status --porcelain` against the declared `writes`.

- If a file appears outside what was declared, the wave is marked failed and
  the flow does not continue without resolving it. In Auto mode, it stops.
- Only the orchestrator marks `[X]` in `tasks.md` and saves state.

This verification is what makes shared-tree parallelism safe: the contract
declares, but `git status` checks.

## Failures and retries

- The current wave is finished before deciding.
- Each failed task is retried once (`MAX_RETRIES_PER_TASK`) with the error as
  context.
- If it persists, tasks that depended on it are marked **blocked**.
- If a task **without** `[P]` fails, the flow stops.
- In Plan mode it asks how to proceed; in Auto it stops and returns to Plan.

## Relevant parameters

| Parameter | Default | Meaning |
|---|---|---|
| `MAX_PARALLEL_IMPLEMENT` | 10 | Simultaneous implementation subagents |
| `MAX_PARALLEL_RESEARCH` | 5 | Simultaneous researchers in discovery |
| `MAX_DISCOVERY_ROUNDS` | 1 | Extra research rounds to cover gaps |
| `FAST_MAX_UNITS` | 15 | Fast-route units; more than this escalates to full SDD |
| `MAX_RETRIES_PER_TASK` | 1 | Retries per failed task |
| `MAX_CONVERGE_CYCLES` | 2 | `implement → converge` cycles |
| `AUTO_MAX_TASKS` | 15 | In Auto mode, more tasks than this returns to Plan |

## The fast route uses the same rules

On the **fast route** there is no `tasks.md`: the planner works with a table of
**units** (`U1..Un`). The rules are identical: in a single **wave**, only units
without dependencies and **without shared files**; units sharing a file are
merged or sequenced; `SHARED_FILES` go into an integration unit at the end.
Scope verification (`git status` against the `writes`) is the same too.

## Advantages

- **Real, safe parallelism** without the overhead of isolating each subagent.
- **Deterministic:** the same `tasks.md` produces the same waves.
- **Verifiable:** `git status` as the source of truth for scope, not the
  subagent's word.
- **Graceful degradation:** when in doubt, sequence; on a conflict, an
  integration wave with a single agent.
