/**
 * chat_read tool implementation.
 * Reads text files with line numbers and paging hints.
 * Blocks .env access and binary or image reads for safety.
 */
import * as fs from "fs/promises"
import { tool } from "@opencode-ai/plugin"
import { DEFAULT_READ_LIMIT } from "../util/constants"
import { resolvePath, isBlockedEnvPath, isImageExtension, isBinaryFile } from "../util/paths"
import { trimLine } from "../util/text"

export function createChatRead(baseDir: string) {
  const run = async (args: { filePath: string; offset?: number; limit?: number }) => {
    const filePath = resolvePath(baseDir, args.filePath)
    if (isBlockedEnvPath(filePath)) {
      throw new Error(`The user has blocked you from reading ${filePath}`)
    }
    if (isImageExtension(filePath)) {
      throw new Error(`Image reading is not supported: ${filePath}`)
    }
    if (await isBinaryFile(filePath)) {
      throw new Error(`Cannot read binary file: ${filePath}`)
    }
    const stats = await fs.stat(filePath).catch(() => undefined)
    if (!stats) {
      throw new Error(`File not found: ${filePath}`)
    }
    if (stats.isDirectory()) {
      throw new Error(`Path is a directory, not a file: ${filePath}`)
    }
    const offset = args.offset ?? 0
    const limit = args.limit ?? DEFAULT_READ_LIMIT
    const lines = await fs.readFile(filePath, "utf-8").then((content) => content.split("\n"))
    const raw = lines.slice(offset, offset + limit).map(trimLine)
    const content = raw.map((line, index) => `${(index + offset + 1).toString().padStart(5, "0")}| ${line}`)

    let output = "<file>\n"
    output += content.join("\n")
    const totalLines = lines.length
    const lastReadLine = offset + content.length
    const hasMoreLines = totalLines > lastReadLine
    if (hasMoreLines) {
      output += `\n\n(File has more lines. Use 'offset' parameter to read beyond line ${lastReadLine})`
    }
    if (!hasMoreLines) {
      output += `\n\n(End of file - total ${totalLines} lines)`
    }
    output += "\n</file>"

    return output
  }

  return {
    id: "chat_read",
    run,
    tool: tool({
      description: `Read file contents.

Usage:
- Returns line-numbered output
- Default limit is 2000 lines
- Use offset and limit for large files
- Long lines (>2000 chars) are truncated`,
      args: {
        filePath: tool.schema.string().describe("The path to the file to read"),
        offset: tool.schema.number().optional().describe("The line number to start reading from (0-based)"),
        limit: tool.schema.number().optional().describe("The number of lines to read (defaults to 2000)"),
      },
      async execute(args) {
        return await run(args)
      },
    }),
  }
}
