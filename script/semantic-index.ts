/**
 * Manual semantic indexer.
 * Usage: bun script/semantic-index.ts --mode changed|full
 * Automatically finds repo root by walking up to .opencode/
 */
import * as path from "path"
import * as fs from "fs/promises"
import { ensureSemanticIndex } from "../semantic"

async function findRepoRoot(start: string): Promise<string> {
  let dir = start
  while (dir !== "/") {
    const opencodePath = path.join(dir, ".opencode")
    const exists = await fs
      .stat(opencodePath)
      .then((s) => s.isDirectory())
      .catch(() => false)
    if (exists) return dir
    dir = path.dirname(dir)
  }
  return start
}

function parseMode(argv: string[]) {
  const idx = argv.indexOf("--mode")
  if (idx === -1) return "changed" as const
  const value = argv[idx + 1]
  if (value === "full") return "full" as const
  return "changed" as const
}

function formatProgress(progress: {
  total: number
  processed: number
  indexed: number
  skipped: number
  chunks: number
  currentPath?: string
}) {
  if (progress.total === 0) return "[semantic] no files to index"
  const percent = Math.floor((progress.processed / progress.total) * 100)
  const width = 24
  const filled = Math.round((percent / 100) * width)
  const bar = "=".repeat(filled) + "-".repeat(width - filled)
  const current = progress.currentPath ? `\n  ${progress.currentPath}` : ""
  return `[semantic] [${bar}] ${percent}% ${progress.processed}/${progress.total} files, chunks: ${progress.chunks}${current}`
}

async function main() {
  const mode = parseMode(process.argv)
  const worktree = await findRepoRoot(path.resolve(process.cwd()))
  console.log(`[semantic] worktree: ${worktree}`)
  let lastShown = ""

  const result = await ensureSemanticIndex(worktree, {
    mode,
    onProgress: (progress) => {
      const line = formatProgress(progress)
      if (line === lastShown) return
      lastShown = line
      console.log(line)
    },
  })

  console.log("Semantic index complete.")
  console.log(`mode: ${result.mode}`)
  console.log(`files indexed: ${result.indexed}`)
  console.log(`files skipped: ${result.skipped}`)
  console.log(`chunks: ${result.chunks}`)
}

await main()
