/**
 * chat_glob tool implementation.
 * Finds files by glob pattern with modification-time ordering.
 * Mirrors core behavior with truncation hints for large result sets.
 */
import { tool } from "@opencode-ai/plugin"
import { resolvePath } from "../util/paths"

export function createChatGlob(baseDir: string) {
  const run = async (args: { pattern: string; path?: string }) => {
    const searchRoot = resolvePath(baseDir, args.path ?? baseDir)
    const glob = new Bun.Glob(args.pattern)
    const files: Array<{ path: string; mtime: number }> = []
    let truncated = false
    for await (const file of glob.scan({ cwd: searchRoot, absolute: true, onlyFiles: true })) {
      if (files.length >= 100) {
        truncated = true
        break
      }
      const mtime = await Bun.file(file)
        .stat()
        .then((stat) => stat.mtime.getTime())
        .catch(() => 0)
      files.push({ path: file, mtime })
    }
    files.sort((a, b) => b.mtime - a.mtime)
    if (files.length === 0) return "No files found"
    const output = files.map((file) => file.path)
    if (truncated) {
      output.push("")
      output.push("(Results are truncated. Consider using a more specific path or pattern.)")
    }
    return output.join("\n")
  }

  return {
    id: "chat_glob",
    run,
    tool: tool({
      description: `Find files by pattern.

Usage:
- Supports glob patterns like "**/*.txt" or "docs/**/*.md"
- Returns files sorted by modification time
- Results truncated at 100 files`,
      args: {
        pattern: tool.schema.string().describe("The glob pattern to match files against"),
        path: tool.schema.string().optional().describe("The directory to search in"),
      },
      async execute(args) {
        return await run(args)
      },
    }),
  }
}
