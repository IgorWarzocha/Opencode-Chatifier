/**
 * chat_batch tool implementation.
 * Executes multiple chat_* tools with simple coordination.
 * Limits tool calls to keep execution predictable.
 */
import { tool } from "@opencode-ai/plugin"
import { ToolCall } from "../util/types"

type Runner = (params: Record<string, unknown>) => Promise<string>

export function createChatBatch(runners: Record<string, Runner>, todoRead: () => Promise<string>) {
  const allRunners: Record<string, Runner> = {
    ...runners,
    chat_todoread: async () => todoRead(),
  }

  const run = async (args: { tool_calls: ToolCall[] }) => {
    const calls = args.tool_calls.slice(0, 10)
    const results = await Promise.all(
      calls.map((call) => {
        const runner = allRunners[call.tool]
        if (!runner) return Promise.resolve(`Unsupported tool: ${call.tool}`)
        return runner(call.parameters)
      }),
    )
    return results.join("\n\n")
  }

  return {
    id: "chat_batch",
    run: async (args: { tool_calls: ToolCall[] }) => run(args),
    tool: tool({
      description: `Run multiple tools at once.

Usage:
- 1-10 tool calls per batch
- All calls run in parallel
- Use for independent operations only
- Don't use when results depend on each other`,
      args: {
        tool_calls: tool.schema
          .array(
            tool.schema.object({
              tool: tool.schema.string().describe("Name of the tool to call"),
              parameters: tool.schema
                .record(tool.schema.string(), tool.schema.unknown())
                .describe("Parameters for the tool"),
            }),
          )
          .min(1)
          .describe("Array of tool calls to execute"),
      },
      async execute(args) {
        return await run({ tool_calls: args.tool_calls })
      },
    }),
  }
}
