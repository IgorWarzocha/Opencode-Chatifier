/**
 * Shared type definitions for chatifier tools.
 * Keeps tool signatures consistent across modules and batch execution.
 * Extend cautiously to avoid widening interfaces unnecessarily.
 */
export type TodoItem = {
  content: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
  priority: "high" | "medium" | "low"
  id: string
}

export type ToolCall = {
  tool: string
  parameters: Record<string, unknown>
}

export type Match = {
  path: string
  modTime: number
  lineNum: number
  lineText: string
}
