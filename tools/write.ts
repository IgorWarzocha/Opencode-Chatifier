/**
 * chat_write tool implementation.
 * Writes or overwrites files within the working directory.
 * Creates parent directories when needed.
 */
import * as fs from "fs/promises"
import path from "path"
import { tool } from "@opencode-ai/plugin"
import { resolvePath } from "../util/paths"

export function createChatWrite(baseDir: string, repoRoot: string) {
  const run = async (args: { content: string; filePath: string }) => {
    const filePath = resolvePath(baseDir, args.filePath)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, args.content, "utf-8")
    const title = path.relative(repoRoot, filePath)
    return `Wrote ${title}`
  }

  return {
    id: "chat_write",
    run,
    tool: tool({
      description: `Write file contents.

Usage:
- Overwrites existing files completely
- Creates parent directories if needed
- Use Edit tool for partial modifications`,
      args: {
        content: tool.schema.string().describe("The content to write to the file"),
        filePath: tool.schema.string().describe("The absolute path to the file to write"),
      },
      async execute(args) {
        return await run(args)
      },
    }),
  }
}
