/**
 * Configuration helpers for the chatifier plugin.
 * Disables chat_* tools globally via config.tools, then enables them for chatified agents.
 *
 * Agents:
 *   - Just Chat: Minimal tools for conversation and web research
 *   - Tool Chat: Full toolkit for files, code, and web
 */
import { CHATIFIER_PROMPT } from "./system"

type AgentConfig = { tools?: Record<string, boolean>; prompt?: string; [key: string]: unknown }
type ConfigWithTools = {
  tools?: Record<string, boolean>
  agent?: Record<string, AgentConfig>
  default_agent?: string
}

const NATIVE_TOOLS = [
  "bash",
  "read",
  "write",
  "edit",
  "glob",
  "grep",
  "webfetch",
  "websearch",
  "codesearch",
  "task",
  "todowrite",
  "todoread",
  "patch",
  "multiedit",
  "lsp",
  "lsp_hover",
  "lsp_diagnostics",
  "batch",
  "skill",
]

// Tools for Just Chat: web research and conversation
// Uses native tools directly (no chat_* wrappers needed)
const JUST_CHAT_NATIVE = ["webfetch", "websearch"]
const JUST_CHAT_TOOLS = ["chat_remember", "chat_todowrite", "chat_todoread"]

// Native tools to enable for Tool Chat (in addition to chat_* tools)
const TOOL_CHAT_NATIVE = ["websearch", "webfetch"]

export function configureChatAgents(config: ConfigWithTools, toolIds: string[]) {
  // Disable chat_* tools globally - this affects all built-in agents
  config.tools = config.tools ?? {}
  for (const id of toolIds) {
    config.tools[id] = false
  }

  config.agent = config.agent ?? {}

  // Just Chat: minimal tools for conversation and web research
  config.agent["Just Chat"] = {
    description: "Conversational agent with web access",
    mode: "primary",
    prompt: CHATIFIER_PROMPT,
    tools: {
      ...Object.fromEntries(NATIVE_TOOLS.map((id) => [id, false])),
      ...Object.fromEntries(JUST_CHAT_NATIVE.map((id) => [id, true])),
      ...Object.fromEntries(JUST_CHAT_TOOLS.map((id) => [id, true])),
    },
  }

  // Tool Chat: full toolkit for files, code, and web
  config.agent["Tool Chat"] = {
    description: "Full toolkit agent for files and code",
    prompt: CHATIFIER_PROMPT,
    tools: {
      ...Object.fromEntries(NATIVE_TOOLS.map((id) => [id, false])),
      ...Object.fromEntries(TOOL_CHAT_NATIVE.map((id) => [id, true])),
      ...Object.fromEntries(toolIds.map((id) => [id, true])),
    },
  }
}
