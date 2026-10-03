import assert from "node:assert/strict"
import mod from "../plugins/selectable-questions.ts"

// Shape the V2 plugin loader requires: object with id + setup function.
assert.equal(typeof mod, "object", "default export must be an object, not a function")
assert.equal(typeof mod.id, "string")
assert.equal(mod.id, "selectable-questions")
assert.equal(typeof mod.setup, "function")

let handler
const registration = { disposed: false, async dispose() { this.disposed = true } }
const ctx = {
  session: {
    hook: async (name, cb) => {
      assert.equal(name, "prompt")
      handler = cb
      return registration
    },
  },
}

const cleanup = await mod.setup(ctx)
assert.equal(typeof handler, "function", "setup must register the prompt hook")

// 1. A plain user prompt gets the reminder appended.
const plain = { prompt: { text: "refactor the graph domain" }, delivery: "steer" }
handler(plain)
assert.ok(plain.prompt.text.startsWith("refactor the graph domain"))
assert.ok(plain.prompt.text.includes("opencode:selectable-questions"))
assert.ok(plain.prompt.text.includes("Call the `question` tool"))

// 2. A command template (high-salience user message) also gets it.
const command = { prompt: { text: "# /develop\n\nImplement the feature." }, delivery: "queue" }
handler(command)
assert.ok(command.prompt.text.startsWith("# /develop"))
assert.ok(command.prompt.text.includes("Call the `question` tool"))

// 3. Idempotent: a re-run over the same text does not double-append.
const once = plain.prompt.text
handler(plain)
assert.equal(plain.prompt.text, once, "reminder must not be appended twice")

// 4. Empty prompt (argument-less command) still gets the reminder.
const bare = { prompt: { text: "" }, delivery: "steer" }
handler(bare)
assert.ok(bare.prompt.text.includes("Call the `question` tool"))

// 5. Mention offsets stay valid: the original prefix is untouched.
const mentioned = {
  prompt: { text: "look at src/App.tsx", files: [{ uri: "file:///src/App.tsx", mention: { start: 8, end: 19, text: "src/App.tsx" } }] },
  delivery: "steer",
}
handler(mentioned)
const { mention } = mentioned.prompt.files[0]
assert.equal(mentioned.prompt.text.slice(mention.start, mention.end), mention.text, "mention range must still resolve")

// 6. Cleanup disposes the registration.
await cleanup()
assert.equal(registration.disposed, true, "cleanup must dispose the hook registration")

console.log("OK: 6 assertions passed")
