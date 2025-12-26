/**
 * Chatifier plugin entrypoint.
 * Wires chat_* tools, config mutations, and system prompt updates.
 * Keeps orchestration minimal and delegates logic to modules.
 */
import type { Plugin } from "@opencode-ai/plugin"
import path from "path"
import { TODO_FILENAME } from "./util/constants"
import { configureChatAgents } from "./config"
import { replaceSystemPrompt } from "./system"
import { createChatTools } from "./tools"
import { ensureSemanticIndex, ensureModel } from "./semantic"

export const ChatifierPlugin: Plugin = async ({ directory, worktree }) => {
  const todoPath = path.join(worktree, TODO_FILENAME)

  await ensureModel(worktree)

  const result = await ensureSemanticIndex(worktree, {
    mode: "changed",
    maxTargets: 100,
    onProgress: (progress) => {
      if (progress.total === 0) return
      const percent = Math.floor((progress.processed / progress.total) * 100)
      const filled = Math.round((percent / 100) * 20)
      const bar = "=".repeat(filled) + "-".repeat(20 - filled)
      const current = progress.currentPath ? `\n  ${progress.currentPath}` : ""
      console.log(
        `[semantic] [${bar}] ${percent}% ${progress.processed}/${progress.total} files, chunks: ${progress.chunks}${current}`,
      )
    },
  })

  if (result.skippedReason) {
    console.log(`\n[semantic] ⚠️  indexing skipped: ${result.skippedReason} (${result.total} files)`)
    console.log(`[semantic]    Run \`bun run semantic-index\` to index all files.\n`)
    await Bun.sleep(10000)
  } else if (result.indexed > 0) {
    console.log(`[semantic] indexed ${result.indexed} files (${result.chunks} chunks)`)
  } else if (result.total === 0 && result.skipped > 0) {
    console.log(`[semantic] index up to date (${result.skipped} files unchanged)`)
  }

  const chatTools = createChatTools(directory, worktree, todoPath)

  return {
    config: async (config) => {
      configureChatAgents(config as Parameters<typeof configureChatAgents>[0], chatTools.toolIds)
    },
    "experimental.chat.system.transform": async (_input, output) => {
      replaceSystemPrompt(output.system)
    },
    tool: chatTools.tools,
  }
}
