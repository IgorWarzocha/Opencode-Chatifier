/**
 * chat_bash tool implementation.
 * Runs shell commands with basic timeout and output truncation.
 * Keeps output size bounded for predictable responses.
 */
import { tool } from "@opencode-ai/plugin"
import { MAX_OUTPUT_LENGTH } from "../util/constants"

export function createChatBash(baseDir: string) {
  const run = async (args: { command: string; timeout?: number; description: string }) => {
    if (!args.command) {
      throw new Error("command is required")
    }
    const timeoutMs = args.timeout ?? 2 * 60 * 1000
    if (timeoutMs < 0) {
      throw new Error(`Invalid timeout value: ${timeoutMs}. Timeout must be a positive number.`)
    }

    const cmd = process.platform === "win32" ? ["cmd", "/c", args.command] : ["bash", "-lc", args.command]
    const proc = Bun.spawn(cmd, {
      cwd: baseDir,
      stdout: "pipe",
      stderr: "pipe",
    })

    const outputPromise = Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]).then(
      ([out, err]) => out + err,
    )
    const timeoutPromise = new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        proc.kill()
        clearTimeout(timer)
        resolve(`\n\n<bash_metadata>\nCommand timed out after ${timeoutMs} ms\n</bash_metadata>`)
      }, timeoutMs)
    })

    const output = await Promise.race([outputPromise, timeoutPromise])
    if (output.length <= MAX_OUTPUT_LENGTH) return output
    return output.slice(0, MAX_OUTPUT_LENGTH) + "\n\n<bash_metadata>\nOutput truncated\n</bash_metadata>"
  }

  return {
    id: "chat_bash",
    run,
    tool: tool({
      description: `Run shell commands.

Usage:
- Study unfamiliar commands with -h or --help first
- Verify directories exist before creating files
- Quote paths with spaces: "path with spaces/file.txt"
- Output limited to 30,000 characters
- Use && to chain dependent commands, ; for independent ones
- Prefer absolute paths over cd when possible`,
      args: {
        command: tool.schema.string().describe("The command to execute"),
        timeout: tool.schema.number().optional().describe("Optional timeout in milliseconds"),
        description: tool.schema.string().describe("Brief description of command purpose (5-10 words)"),
      },
      async execute(args) {
        return await run(args)
      },
    }),
  }
}
