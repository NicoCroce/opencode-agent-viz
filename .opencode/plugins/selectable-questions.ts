/**
 * selectable-questions
 *
 * Forces opencode to ask the user through the `question` tool (arrow-key
 * selectable options) instead of plain-text menus such as "Q1: A, B, C".
 *
 * A command template is sent as the user message, so it can outweigh the
 * instructions coming from AGENTS.md. This plugin appends a binding reminder to
 * the admitted user prompt, so the instruction travels in the same message the
 * command (or the user) is built from.
 *
 * V1 used `command.execute.before`, which V2 removed. The replacement is the
 * `session` "prompt" hook, which runs on prompt admission — including every
 * command submitted through `session.prompt`. It exposes no command marker, so
 * the reminder is appended to every user prompt, not only to command
 * templates. Synthetic messages, shell messages, compaction and move controls do
 * not run the hook.
 *
 * The import below is type-only on purpose. V2 accepts a plain `{ id, setup }`
 * default export (`Plugin.define` is the identity function), and keeping the
 * runtime free of bare specifiers means this plugin cannot fail to load on
 * module resolution.
 */

import type { Plugin } from "@opencode/plugin"

const MARKER = "opencode:selectable-questions"

const REMINDER = [
  "",
  `<!-- ${MARKER} -->`,
  "## Mandatory: ask with the `question` tool",
  "",
  "This instruction OVERRIDES any conflicting instruction above (including any",
  'request to print "Q1: A, B, C", to render an options table, or to ask the user',
  "to reply with an option letter).",
  "",
  "Whenever you need a decision, clarification, or preference from the user:",
  "- Call the `question` tool. Never ask via plain text.",
  "- Each question: short `header`, self-contained `question`, and `options`.",
  '- Mark the recommended option with "(Recommended)" in its label and list it first.',
  "- Bundle several questions in a single `question` call when possible.",
  `<!-- /${MARKER} -->`,
  "",
].join("\n")

export default {
  id: "selectable-questions",
  async setup(ctx) {
    const registration = await ctx.session.hook("prompt", (event) => {
      // The hook is not an exactly-once boundary: steered prompts, retries and
      // templates that already carry the reminder must not be appended twice.
      if (event.prompt.text.includes(MARKER)) return
      // Appended, never prepended or rewritten, so existing attachment mention
      // offsets stay valid.
      event.prompt.text = `${event.prompt.text}${REMINDER}`
    })

    return () => registration.dispose()
  },
} satisfies Plugin.Plugin
