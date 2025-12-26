/**
 * Tool registry for the chatifier plugin.
 * Builds chat_* tools and exposes runners for batch execution.
 */
import { createChatBash } from "./bash"
import { createChatRead } from "./read"
import { createChatPatch } from "./patch"
import { createChatGlob } from "./glob"
import { createChatGrep } from "./grep"
import { createChatTodo } from "./todo"
import { createChatBatch } from "./batch"
import { createChatSkill } from "./skill"
import { createChatRemember } from "./remember"
import { createChatSemanticSearch } from "./semantic-search"
import type { ToolDefinition } from "@opencode-ai/plugin"

export function createChatTools(baseDir: string, repoRoot: string, todoPath: string) {
  const read = createChatRead(baseDir)
  const patch = createChatPatch(baseDir)
  const glob = createChatGlob(baseDir)
  const grep = createChatGrep(baseDir)
  const bash = createChatBash(baseDir)
  const todo = createChatTodo(todoPath)
  const skill = createChatSkill(baseDir)
  const remember = createChatRemember(baseDir)
  const semantic = createChatSemanticSearch(repoRoot)

  const runners: Record<string, (p: Record<string, unknown>) => Promise<string>> = {
    [read.id]: (p) => read.run(p as Parameters<typeof read.run>[0]),
    [patch.id]: (p) => patch.run(p as Parameters<typeof patch.run>[0]),
    [glob.id]: (p) => glob.run(p as Parameters<typeof glob.run>[0]),
    [grep.id]: (p) => grep.run(p as Parameters<typeof grep.run>[0]),
    [bash.id]: (p) => bash.run(p as Parameters<typeof bash.run>[0]),
    [todo.write.id]: (p) => todo.write.run(p as Parameters<typeof todo.write.run>[0]),
    [skill.id]: (p) => skill.run(p as Parameters<typeof skill.run>[0]),
    [remember.id]: (p) => remember.run(p as Parameters<typeof remember.run>[0]),
    [semantic.id]: (p) => semantic.run(p as Parameters<typeof semantic.run>[0]),
  }

  const batch = createChatBatch(runners, todo.read.run)

  const tools: Record<string, ToolDefinition> = {
    [read.id]: read.tool,
    [patch.id]: patch.tool,
    [glob.id]: glob.tool,
    [grep.id]: grep.tool,
    [bash.id]: bash.tool,
    [todo.write.id]: todo.write.tool,
    [todo.read.id]: todo.read.tool,
    [skill.id]: skill.tool,
    [remember.id]: remember.tool,
    [semantic.id]: semantic.tool,
    [batch.id]: batch.tool,
  }

  return { tools, runners, toolIds: Object.keys(tools) }
}
