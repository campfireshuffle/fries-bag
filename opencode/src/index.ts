import { Plugin } from "@opencode/plugin"

// /fries-bag <prompt>: after every turn ends, send <prompt> again so the agent never stops.
// Stop with `/fries-bag` (no prompt), `/fries-bag stop`, or by interrupting the session (Esc).

type Prompt = Omit<Parameters<Plugin.Context["session"]["prompt"]>[0], "sessionID" | "delivery">

const FAILURE_DELAY_MS = 10_000

export default Plugin.define({
  id: "fries-bag",
  async setup(ctx) {
    const loops = new Map<string, Prompt>()

    const resend = async (sessionID: string) => {
      const prompt = loops.get(sessionID)
      if (!prompt) return
      try {
        await ctx.session.prompt({ ...prompt, sessionID, delivery: "queue" })
      } catch (error) {
        console.error(`[fries-bag] failed to resend prompt to ${sessionID}`, error)
      }
    }

    await ctx.command.transform((editor) => {
      editor.add({
        name: "fries-bag",
        description: "Keep re-sending a prompt every time the agent stops (no args or 'stop' to end)",
        execute: async ({ sessionID, prompt, delivery }) => {
          const text = prompt.text.trim()
          if (text === "" || text === "stop") {
            loops.delete(sessionID)
            await ctx.session.synthetic({ sessionID, text: "fries-bag stopped.", resume: false })
            return
          }
          loops.set(sessionID, prompt)
          await ctx.session.prompt({ ...prompt, sessionID, delivery })
        },
      })
    })

    const controller = new AbortController()
    void (async () => {
      const events = ctx.event.subscribe({
        types: ["session.execution.succeeded", "session.execution.failed", "session.execution.interrupted"],
        signal: controller.signal,
      })
      for await (const event of events) {
        const sessionID = event.data.sessionID
        if (!loops.has(sessionID)) continue
        switch (event.type) {
          case "session.execution.succeeded":
            await resend(sessionID)
            break
          case "session.execution.failed":
            // Back off so a persistent error (auth, quota) doesn't hot-loop.
            setTimeout(() => void resend(sessionID), FAILURE_DELAY_MS)
            break
          case "session.execution.interrupted":
            // Esc is the escape hatch; other reasons (superseded, inactivity) keep the bag full.
            if (event.data.reason === "user" || event.data.reason === "shutdown") loops.delete(sessionID)
            else await resend(sessionID)
            break
        }
      }
    })().catch((error) => {
      if (!controller.signal.aborted) console.error("[fries-bag] event stream ended", error)
    })

    return () => controller.abort()
  },
})
