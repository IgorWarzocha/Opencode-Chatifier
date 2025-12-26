/**
 * chat_semantic_search tool implementation.
 * Searches repo content using local embeddings stored in SQLite.
 */
import * as path from "path"
import { tool } from "@opencode-ai/plugin"
import { semanticSearch } from "../semantic"

const DEFAULT_LIMIT = 5

export function createChatSemanticSearch(worktree: string) {
  const run = async (args: { query: string; limit?: number }) => {
    const query = args.query.trim()
    if (!query) throw new Error("Query cannot be empty")

    const dbPath = path.join(worktree, ".opencode", "chat", "semantic.sqlite")
    const exists = await Bun.file(dbPath).exists()
    if (!exists) {
      return "Semantic index not found. Run chat_semantic_index first."
    }

    const limit = Math.max(1, Math.min(args.limit ?? DEFAULT_LIMIT, 20))
    const results = await semanticSearch(worktree, query, limit)

    if (results.length === 0) return "No semantic matches found."

    return results
      .map((item, index) => {
        const relPath = path.relative(worktree, item.path)
        const snippet = item.content.trim().slice(0, 400)
        return [
          `${index + 1}. ${relPath}:${item.start_line}-${item.end_line}`,
          `score: ${item.score.toFixed(3)}`,
          snippet,
        ].join("\n")
      })
      .join("\n\n")
  }

  return {
    id: "chat_semantic_search",
    run,
    tool: tool({
      description: `Semantic search over repo files using local embeddings.

Usage:
- Best for natural language queries ("where is auth handled")
- Returns file + line ranges + snippet
- Indexing is incremental based on file mtime`,
      args: {
        query: tool.schema.string().describe("Natural language search query"),
        limit: tool.schema.number().optional().describe("Number of results (default 5, max 20)"),
      },
      async execute(args) {
        return await run(args)
      },
    }),
  }
}
