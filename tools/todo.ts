/**
 * chat_todowrite and chat_todoread tool implementations.
 * Stores todos in a repo-level todo.md file with embedded JSON.
 * Deletes the file when all tasks are completed.
 */
import { tool } from "@opencode-ai/plugin"
import { TodoItem } from "../util/types"
import { readTodoFile, writeTodoFile } from "../util/todo"

export const todoSchema = tool.schema.object({
  content: tool.schema.string().describe("Brief description of the task"),
  status: tool.schema
    .enum(["pending", "in_progress", "completed", "cancelled"])
    .describe("Current status of the task: pending, in_progress, completed, cancelled"),
  priority: tool.schema.enum(["high", "medium", "low"]).describe("Priority level of the task: high, medium, low"),
  id: tool.schema.string().describe("Unique identifier for the todo item"),
})

export function createChatTodo(todoPath: string) {
  const write = async (args: { todos: TodoItem[] }) => {
    const message = await writeTodoFile(todoPath, args.todos)
    return message + "\n" + JSON.stringify(args.todos, null, 2)
  }

  const read = async () => {
    const todos = await readTodoFile(todoPath)
    return JSON.stringify(todos, null, 2)
  }

  return {
    write: {
      id: "chat_todowrite",
      run: write,
      tool: tool({
        description: `Manage task list.

Usage:
- Use for multi-step tasks (3+ steps)
- Only one task in_progress at a time
- Mark tasks complete immediately after finishing
- Skip for simple, single-step requests`,
        args: {
          todos: tool.schema.array(todoSchema).describe("The updated todo list"),
        },
        async execute(args) {
          return await write(args)
        },
      }),
    },
    read: {
      id: "chat_todoread",
      run: read,
      tool: tool({
        description: `Read task list.

Usage:
- Check at start of conversations
- Use before starting new tasks
- Review after completing work`,
        args: {},
        async execute() {
          return await read()
        },
      }),
    },
  }
}
