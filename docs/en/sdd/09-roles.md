# Discovery roles

**Roles** are the discipline profiles that guide investigation. Each one lives
in `.opencode/roles/<role>.md` with its objective, questions, deliverable, and
constraints, and declares which **skills** its researcher must load.

| Role | Agent | Skills | Objective |
|---|---|---|---|
| `product` | `sddorch-researcher-market` | `pm-problem-statement`, `pm-jobs-to-be-done` | Clarify what problem the request solves, for whom, and how success will be known |
| `ux` | `sddorch-researcher-code` | `interface-design`, `frontend-design` | How the change should look and behave, reusing what exists |
| `security` | `sddorch-researcher-code` | `owasp-security-check` | Security and privacy risks the change introduces or touches |
| `performance` | `sddorch-researcher-code` | `vercel-react-best-practices` | Impact on real-time performance and on diagnosability |
| `quality` | `sddorch-researcher-code` | `test-generator`, `test-driven-development` | How the change will be verified and where it can break what exists |
| `accessibility` | `sddorch-researcher-code` | `a11y-*` | That the change can be used with keyboard, screen reader, and good contrast |

## What each role answers

### `product`
Problem, users, the *job* they want to complete, objectives and non-goals,
candidate metrics, and market alternatives (with cited sources). It respects
principle I (read-only observer): if an idea contradicts it, it flags a conflict.

### `ux`
Screens, components, and flows affected; reusable components from
`src/Application/Components/`; mandatory states (error/loading/empty/data);
readability in a dense graph; behavior on mobile and desktop (`useDevice()`);
new interactions. It proposes, it does not implement.

### `security`
Possible XSS when rendering session content; what travels through the `/oc`
proxy to `OPENCODE_URL`; secrets or personal data in what is shown or stored;
new dependencies or network surface; and that principle I is respected. It
classifies risks by severity with the recommended control.

### `performance`
What changes in SSE event processing (batches, frequency); risk of relayout or
broad re-renders; scaling with hundreds of nodes and thousands of events; bundle
size; and **how it will be measured** before and after.

### `quality`
What new logic can be pure and testable without React; which existing specs to
extend and which real fixtures are needed; edge and error cases; regression
risk. It proposes concrete cases with data, not "add tests".

### `accessibility`
Keyboard operation with visible focus and no traps; how the graph (React
Flow/SVG/canvas) is exposed to assistive technology and whether there is a
textual or tabular alternative; announcing live states (`aria-live`); contrast
and not relying on color alone.

## How they are activated

- The orchestrator selects the roles relevant to the request (up to
  `MAX_PARALLEL_RESEARCH`).
- **Level 1:** 2–3 roles; one-page PRD and RFC.
- **Level 2:** up to 5 roles; full PRD and RFC. **Marketing or legal** only at
  this level and if the user asks.
- If only one role is relevant, the orchestrator investigates it itself.

## Cross-cutting constraints

- Roles **propose**, they do not implement.
- What cannot be verified is marked `no verificado` (unverified).
- Skills with imperative language are used as a guide, not as an order.
- Doubts requiring the user come back as `preguntas_abiertas` (with options,
  recommended, and impact) and the orchestrator centralizes them.
