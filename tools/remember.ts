/**
 * chat_remember tool implementation.
 * Append a memory to AGENTS.md for long-term persistence.
 * Since AGENTS.md is re-read on every turn, memories take effect immediately.
 */
import * as fs from "fs/promises"
import * as path from "path"
import { tool } from "@opencode-ai/plugin"

export function createChatRemember(baseDir: string) {
  const agentsPath = path.join(baseDir, "AGENTS.md")

  const run = async (args: { memory: string }) => {
    const memory = args.memory.trim()
    if (!memory) {
      throw new Error("Memory cannot be empty")
    }

    // Check if file exists
    let content = ""
    try {
      content = await fs.readFile(agentsPath, "utf-8")
    } catch {
      // File doesn't exist, create with header
      content = "# User Preferences & Memories\n\n"
    }

    // Ensure content ends with newline
    if (!content.endsWith("\n")) {
      content += "\n"
    }

    // Check for memories section, add if missing
    if (!content.includes("## Memories")) {
      content += "\n## Memories\n\n"
    }

    // Append the new memory with timestamp
    const timestamp = new Date().toISOString().split("T")[0] // YYYY-MM-DD
    const memoryLine = `- ${memory} (${timestamp})\n`
    content += memoryLine

    await fs.writeFile(agentsPath, content, "utf-8")

    return `Remembered: "${memory}"`
  }

  return {
    id: "chat_remember",
    run,
    tool: tool({
      description: `Save something to long-term memory. Use this to remember:
- User preferences (e.g., "User prefers concise responses")
- Important facts (e.g., "User's project uses React 19")
- Style preferences (e.g., "User likes bullet points over paragraphs")

Memories persist across conversations. Keep each memory to ONE short sentence.`,
      args: {
        memory: tool.schema.string().describe("A single short sentence to remember. Be specific and concise."),
      },
      async execute(args) {
        return await run(args)
      },
    }),
  }
}
