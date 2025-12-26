/**
 * Todo file helpers for chat_todowrite and chat_todoread.
 * Stores task lists in a repo-level todo.md with embedded JSON payload.
 * Removes the file when all tasks are completed.
 */
import * as fs from "fs/promises"
import { TodoItem } from "./types"

export function formatTodoMarkdown(todos: TodoItem[]) {
  const lines = ["# Todo", ""]
  for (const todo of todos) {
    const box = todo.status === "completed" ? "x" : " "
    lines.push(`- [${box}] ${todo.content} (priority: ${todo.priority}, id: ${todo.id}, status: ${todo.status})`)
  }
  lines.push("", "<!-- opencode-todo")
  lines.push(JSON.stringify(todos, null, 2))
  lines.push("-->")
  return lines.join("\n")
}

export async function readTodoFile(todoPath: string): Promise<TodoItem[]> {
  const exists = await fs
    .stat(todoPath)
    .then(() => true)
    .catch(() => false)
  if (!exists) return []
  const content = await fs.readFile(todoPath, "utf-8")
  const match = content.match(/<!-- opencode-todo\n([\s\S]*?)\n-->/)
  if (!match) return []
  try {
    const parsed = JSON.parse(match[1])
    if (Array.isArray(parsed)) return parsed as TodoItem[]
  } catch (_error) {
    return []
  }
  return []
}

export async function writeTodoFile(todoPath: string, todos: TodoItem[]) {
  const remaining = todos.filter((todo) => todo.status !== "completed")
  if (remaining.length === 0) {
    await fs.unlink(todoPath).catch(() => {})
    return "All todos completed. Removed todo.md."
  }
  const content = formatTodoMarkdown(todos)
  await fs.writeFile(todoPath, content, "utf-8")
  return `${remaining.length} todos remaining. Updated todo.md.`
}
