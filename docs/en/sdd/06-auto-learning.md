# Self-learning: harness signals

> The differentiator of the model. SddOrch does not just run: it **learns from
> its own friction** and proposes permanent improvements.

## The concept

A **harness** is the set of pieces that give an agent its capabilities:
skills, instructions, subagents, scripts, and hooks. During a run, a subagent
may find that something that *should* exist **does not**, and has to work
around it. That is a signal.

Instead of losing that information, every subagent can report a
`harness_signal`: a concrete friction that deserves to become a permanent
piece.

Examples:

- You repeated a procedure that deserves a **skill**.
- An **instruction** was missing and you had to infer it.
- A task would have gone better with a specialized **agent**.
- You automated something with ad-hoc commands that deserves a **script**.
- A command needed an adjustment that would fit as a **hook**.
- While researching on the web, a page tried to give you instructions (it is
  ignored and reported as a signal).

## Signal format

It travels inside every subagent's response contract:

```yaml
harness_signals:
  - type: skill | instruction | agent | script | command-hook
    trigger: <situation that caused it>
    workaround: <what you did to get around it>
    evidence: <concrete file, error, or command>
    reuse: <where or how often it would happen again>
```

Rules:

- Only **harness gaps** are reported, not style preferences or product-code
  issues.
- The subagent **does not create** the skill, instruction, or script: it only
  reports it.

## The loop

```text
1. Subagent works around something and reports the signal
        │
        ▼
2. The orchestrator accumulates it in persistent memory
   (same key → updates a counter, no duplication)
        │
        ▼
3. During the flow it does NOT act on the signals
        │
        ▼
4. At the end: it groups, deduplicates, and PROPOSES
   only those repeated ≥2 times or that caused a failure/retry
        │
        ▼
5. The user approves or rejects the creation
```

**The same loop as a diagram (Mermaid):**

```mermaid
flowchart TD
    A["Subagent works around something"] --> B["Reports a harness_signal"]
    B --> C["Orchestrator accumulates in Engram<br/>harness-signal/slug + counter"]
    C --> D{"End of flow?"}
    D -- No --> E["No action during the flow"]
    D -- Yes --> F["Groups and deduplicates"]
    F --> G{"Repeated ≥2 or caused a failure?"}
    G -- No --> H["Not proposed"]
    G -- Yes --> I["Proposes skill / instruction / agent / script / hook"]
    I --> J{"User approves?"}
    J -- Yes --> K["The permanent piece is created"]
    J -- No --> H
```

Fine points:

- **During the flow, the harness is not fixed.** Doing so mid-run would
  introduce uncontrolled variables. First the work is finished; then the tool
  is improved.
- **It only proposes; it never creates without approval.** Self-learning is
  assisted, not blindly autonomous.
- **Repetition filter.** A one-off annoyance does not justify a new piece; a
  pattern that repeats or that broke something does.

## Why it matters

- **Turns friction into infrastructure.** What is a *workaround* today becomes a
  skill that all future flows inherit.
- **The harness sharpens with use.** The more the method is used, the less
  residual friction remains: it is a continuous-improvement loop, not a static
  setup.
- **Evidence, not opinion.** Every proposal arrives with trigger, evidence, and
  frequency, so the decision to create it is informed.
- **Low noise.** Because signals are filtered by repetition and impact, the
  user does not receive an endless list of suggestions.

## Signal → artifact examples

| Observed signal | Proposed artifact |
|---|---|
| The same test pattern repeats in every feature | `test-generator` skill |
| The commit format is always inferred | `commit-conventions` skill |
| A command needed the same post-step | Hook in `.specify/extensions.yml` |
| An analysis is always done the same way before implementing | `sddorch-researcher-code` subagent |
| A discipline profile for discovery was missing | `.opencode/roles/<role>.md` file |
| The PR format has to be remembered | `pr-detail` skill |

> In practice, many of the skills and subagents in this project were born from
> this very loop: they are the result of detecting friction and turning it into
> a permanent piece.
