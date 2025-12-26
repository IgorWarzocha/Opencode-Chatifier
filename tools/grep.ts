/**
 * chat_grep tool implementation.
 * Searches file content using regex and formats results by file.
 * Limits output to a manageable number of matches.
 */
import * as fs from "fs/promises"
import { tool } from "@opencode-ai/plugin"
import { MAX_GREP_MATCHES } from "../util/constants"
import { resolvePath, isBinaryFile } from "../util/paths"
import { trimLine } from "../util/text"
import { Match } from "../util/types"

function formatMatches(matches: Match[], truncated: boolean) {
  const outputLines = [`Found ${matches.length} matches`]
  let currentFile = ""
  for (const match of matches) {
    if (currentFile !== match.path) {
      if (currentFile !== "") {
        outputLines.push("")
      }
      currentFile = match.path
      outputLines.push(`${match.path}:`)
    }
    outputLines.push(`  Line ${match.lineNum}: ${trimLine(match.lineText)}`)
  }
  if (truncated) {
    outputLines.push("")
    outputLines.push("(Results are truncated. Consider using a more specific path or pattern.)")
  }
  return outputLines.join("\n")
}

export function createChatGrep(baseDir: string) {
  const run = async (args: { pattern: string; path?: string; include?: string }) => {
    const searchRoot = resolvePath(baseDir, args.path ?? baseDir)
    let matcher: RegExp
    try {
      matcher = new RegExp(args.pattern)
    } catch (_error) {
      throw new Error(`Invalid regex pattern: ${args.pattern}`)
    }
    const globPattern = args.include ?? "**/*"
    const glob = new Bun.Glob(globPattern)
    const matches: Match[] = []

    for await (const file of glob.scan({ cwd: searchRoot, absolute: true, onlyFiles: true })) {
      if (matches.length >= MAX_GREP_MATCHES) break
      if (await isBinaryFile(file)) continue
      const content = await fs.readFile(file, "utf-8").catch(() => "")
      if (!content) continue
      const lines = content.split("\n")
      for (let i = 0; i < lines.length; i++) {
        if (!matcher.test(lines[i])) continue
        const modTime = await Bun.file(file)
          .stat()
          .then((stat) => stat.mtime.getTime())
          .catch(() => 0)
        matches.push({ path: file, modTime, lineNum: i + 1, lineText: lines[i] })
        if (matches.length >= MAX_GREP_MATCHES) break
      }
    }

    if (matches.length === 0) return "No files found"
    matches.sort((a, b) => b.modTime - a.modTime)
    const truncated = matches.length >= MAX_GREP_MATCHES
    const finalMatches = truncated ? matches.slice(0, MAX_GREP_MATCHES) : matches
    return formatMatches(finalMatches, truncated)
  }

  return {
    id: "chat_grep",
    run,
    tool: tool({
      description: `Search file contents using regex.

Usage:
- Supports full regex syntax
- Filter files by pattern with include parameter
- Returns files sorted by modification time
- Results truncated at 100 matches`,
      args: {
        pattern: tool.schema.string().describe("The regex pattern to search for in file contents"),
        path: tool.schema.string().optional().describe("The directory to search in"),
        include: tool.schema.string().optional().describe("File pattern to include in the search"),
      },
      async execute(args) {
        return await run(args)
      },
    }),
  }
}
