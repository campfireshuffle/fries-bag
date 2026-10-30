import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

// /fries-bag <prompt>: after every run settles, send <prompt> again so the agent never stops.
// Stop with `/fries-bag` (no prompt), `/fries-bag stop`, or Esc.

export default function (pi: ExtensionAPI) {
  let prompt: string | undefined
  let failed = false

  pi.registerCommand("fries-bag", {
    description: "Re-send a prompt every time the agent stops (`/fries-bag stop` to end)",
    handler: async (args, ctx) => {
      const text = args.trim()
      if (text === "" || text === "stop") {
        prompt = undefined
        ctx.ui.notify("fries-bag stopped.", "info")
        return
      }
      prompt = text
      if (ctx.isIdle()) pi.sendUserMessage(text)
      else pi.sendUserMessage(text, { deliverAs: "followUp" })
    },
  })

  pi.on("agent_end", (event) => {
    const last = event.messages.findLast((message) => message.role === "assistant")
    failed = last?.role === "assistant" && last.stopReason === "error"
  })

  pi.on("agent_settled", (event, ctx) => {
    if (!prompt) return
    if (event.aborted) {
      prompt = undefined
      ctx.ui.notify("fries-bag stopped.", "info")
      return
    }
    if (ctx.hasPendingMessages()) return
    const next = prompt
    // Back off so a persistent error (auth, quota) doesn't hot-loop.
    if (failed) setTimeout(() => prompt === next && pi.sendUserMessage(next), 10_000)
    else pi.sendUserMessage(next)
  })
}
