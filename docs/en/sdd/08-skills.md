# Skills catalog

**Skills** are reusable instructions an agent loads on demand. SddOrch uses them
in two layers: the project's own and third-party ones (tied to the discovery
roles). The index in [`.opencode/skills/README.md`](../../../.opencode/skills/README.md)
is the source of truth for versions and licenses.

## The project's own skills

| Skill | Purpose |
|---|---|
| `front-ddd-generator` | Generate the skeleton of a new domain in `src/Domains/` (entity, service, query keys, routes, router, hooks, page, barrel). |
| `test-generator` | Write real-rule tests (not stubs) with the repo's canon: pure logic, services, hooks, and components. |
| `code-reviewer` | Review checklist aligned with the constitution (I–VIII), `AGENTS.md`, and `app.instructions.md`. |
| `commit-conventions` | Commit format and validation (Conventional Commits). |
| `pr-detail` | Generate the PR title and body by comparing the base branch with the current one. |
| `progress-tracker` | Show compact progress of phase flows and subagent chains. |

## Third-party skills (by role)

Copied from public repositories after reviewing their `SKILL.md` (no network
scripts or hidden instructions). Each one's license is in
`.opencode/skills/licenses/`.

| Skill | Role | Purpose | Origin | License |
|---|---|---|---|---|
| `vercel-react-best-practices` | performance | React performance patterns: re-render, bundle, client data. | vercel-labs/agent-skills | MIT |
| `owasp-security-check` | security | Web/API security audit based on the OWASP Top 10. | sergiodxa/agent-skills | MIT |
| `test-driven-development` | quality | Red-green-refactor loop for test-driven development. | addyosmani/agent-skills | MIT |
| `a11y-ACCESSIBILITY-general` | accessibility | Accessibility governance: when to load the other a11y skills. | mgifford/accessibility-skills | AGPL-3.0 |
| `a11y-charts-graphs` | accessibility | Textual/tabular alternatives for charts and visualizations. | mgifford/accessibility-skills | AGPL-3.0 |
| `a11y-svg` | accessibility | `<title>`/`<desc>` and ARIA roles in SVG; sanitizing untrusted SVG. | mgifford/accessibility-skills | AGPL-3.0 |
| `a11y-keyboard` | accessibility | Full keyboard operation, visible focus, no traps. | mgifford/accessibility-skills | AGPL-3.0 |
| `a11y-color-contrast` | accessibility | 4.5:1 / 3:1 contrast and testing in dark and high-contrast mode. | mgifford/accessibility-skills | AGPL-3.0 |
| `pm-prd-development` | product | Structured PRD connecting problem, users, solution, and success. | deanpeters/Product-Manager-Skills | CC BY-NC-SA 4.0 |
| `pm-problem-statement` | product | User-centered problem statement. | deanpeters/Product-Manager-Skills | CC BY-NC-SA 4.0 |
| `pm-user-story` | product | User stories (Cohn format) with Gherkin acceptance criteria. | deanpeters/Product-Manager-Skills | CC BY-NC-SA 4.0 |
| `pm-jobs-to-be-done` | product | Jobs, pains, and gains in JTBD format. | deanpeters/Product-Manager-Skills | CC BY-NC-SA 4.0 |

In addition, the UX role uses `interface-design` and `frontend-design` (in
`.agents/skills/`).

## How they are used

- Each **role** declares in its profile (`.opencode/roles/<role>.md`) exactly
  which skills to load; the researcher loads **only** those.
- The researchers' permissions restrict skill loading: `-code` is allowed its
  discipline's skills; `-market` only the `pm-*` ones.
- Skills are **guides**, not orders that override the user's request: an
  imperative description ("always", "under no circumstances") is read as a
  criterion, not as an order that overrides scope.

## Licenses and security

- **Conditional licenses:** `a11y-*` is **AGPL-3.0** and `pm-*` is
  **CC BY-NC-SA 4.0** (non-commercial, share-alike). While the repo is private
  and for internal use the impact is low; review them before publishing the repo
  or using it commercially. `vercel-react-best-practices` declares MIT but the
  origin repo has no license file.
- **Skills are third-party code.** They are instructions an agent loads: review
  any update before copying it. Do not create skills without the user's approval
  (see [`06-auto-learning.md`](06-auto-learning.md)).
