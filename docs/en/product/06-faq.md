# FAQ — product

### Does the viewer write to my repository or my sessions?

No. It is **read-only**: it never sends prompts, aborts sessions, or replies to
permissions or questions. It does not touch your repo.

### Do I need to start a separate OpenCode server?

No. It connects to OpenCode's **background service**, the same process the TUI
uses. Starting a different `opencode serve` is precisely what makes events stop
arriving live.

### Which OpenCode version do I need?

**2.0.22 or higher.** The viewer consumes the V2 API through
`@opencode/client` 2.0.22; a 1.x server does not expose those endpoints.

### Why do events only appear on refresh?

Almost always because you are pointing at a different `opencode serve` than the
one running the sessions. Check that `OPENCODE_URL` is the background service's
(`opencode service status`).

### What do I need to install it?

Node 22+, pnpm 9+, and OpenCode 2.0.22+. `pnpm install` and `pnpm start`.

### Does the browser handle credentials?

No. The Vite `/oc` proxy injects the auth header; the browser never sees the
password.

### Does it work on mobile?

Yes. The design is mobile-first: a single source of logic (`useDevice`) and two
presentations depending on the device.

### Do I need to record fixtures to use it?

No, not to use it. For tests there is a script (`pnpm fixture`) that captures
real events, but it is a development tool.

### Does it show streaming text?

It does not process text/reasoning deltas live: it uses **consolidated text**.
It is a performance and UI-stability decision.

### How many sessions or tools does it support?

The design prioritizes real-time performance: batched events, no relayout for
state changes, and a stable layout. The success target is a fluid UI with many
sessions and ~1000 tools.

### Is it multi-project or remote?

Today it observes the local project it connects to. Multi-project and remote
deployment are out of scope for v1.

### Can it be used to watch the SDD method / SddOrch?

Yes, it is a natural use case: the graph shows the phases and the parallel
subagent waves. See the SDD track.
