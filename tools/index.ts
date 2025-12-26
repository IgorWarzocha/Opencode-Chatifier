/**
 * Tool registry for the chatifier plugin.
 * Builds chat_* tools along with stub placeholders.
 * Exposes runners used by chat_batch execution.
 */
import { createChatBash } from "./bash"
import { createChatRead } from "./read"
// import { createChatWrite } from "./write"  // Commented out - using chat_patch instead
// import { createChatEdit } from "./edit"    // Commented out - using chat_patch instead
import { createChatPatch } from "./patch"
import { createChatGlob } from "./glob"
import { createChatGrep } from "./grep"
import { createChatTodo } from "./todo"
import { createChatBatch } from "./batch"
import { createChatSkill } from "./skill"
import { createChatRemember } from "./remember"
import { createChatSemanticSearch } from "./semantic-search"
import type { ToolDefinition } from "@opencode-ai/plugin"
import { TodoItem } from "../util/types"

export type ChatTools = {
  tools: Record<string, ToolDefinition>
  runners: Record<string, (params: Record<string, unknown>) => Promise<string>>
  toolIds: string[]
}

export function createChatTools(baseDir: string, repoRoot: string, todoPath: string) {
  const chatRead = createChatRead(baseDir)
  const chatPatch = createChatPatch(baseDir)
  const chatGlob = createChatGlob(baseDir)
  const chatGrep = createChatGrep(baseDir)
  const chatBash = createChatBash(baseDir)
  const chatTodo = createChatTodo(todoPath)
  const chatSkill = createChatSkill(baseDir)
  const chatRemember = createChatRemember(baseDir)
  const chatSemanticSearch = createChatSemanticSearch(repoRoot)

  const runners: Record<string, (params: Record<string, unknown>) => Promise<string>> = {
    [chatRead.id]: (params) => chatRead.run(params as { filePath: string; offset?: number; limit?: number }),
    [chatPatch.id]: (params) => chatPatch.run(params as { patchText: string }),
    [chatGlob.id]: (params) => chatGlob.run(params as { pattern: string; path?: string }),
    [chatGrep.id]: (params) => chatGrep.run(params as { pattern: string; path?: string; include?: string }),
    [chatBash.id]: (params) => chatBash.run(params as { command: string; timeout?: number; description: string }),
    [chatTodo.write.id]: (params) => chatTodo.write.run(params as { todos: TodoItem[] }),
    [chatSkill.id]: (params) => chatSkill.run(params as { name: string }),
    [chatRemember.id]: (params) => chatRemember.run(params as { memory: string }),
    [chatSemanticSearch.id]: (params) => chatSemanticSearch.run(params as { query: string; limit?: number }),
  }

  const batch = createChatBatch(runners, chatTodo.read.run)

  const tools = {
    [chatRead.id]: chatRead.tool,
    [chatPatch.id]: chatPatch.tool,
    [chatGlob.id]: chatGlob.tool,
    [chatGrep.id]: chatGrep.tool,
    [chatBash.id]: chatBash.tool,
    [chatTodo.write.id]: chatTodo.write.tool,
    [chatTodo.read.id]: chatTodo.read.tool,
    [chatSkill.id]: chatSkill.tool,
    [chatRemember.id]: chatRemember.tool,
    [chatSemanticSearch.id]: chatSemanticSearch.tool,
    [batch.id]: batch.tool,
  }

  const toolIds = Object.keys(tools)

  return {
    tools,
    runners,
    toolIds,
  }
}
