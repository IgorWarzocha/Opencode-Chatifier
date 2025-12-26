/**
 * Download embedding model for semantic search.
 * Usage: bun script/download-model.ts
 * Automatically finds repo root by walking up to .opencode/
 */
import * as path from "path"
import * as fs from "fs/promises"
import { EmbeddingModel, ExecutionProvider, FlagEmbedding } from "fastembed"

const MODEL_DIRNAME = "models"

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

async function main() {
  const worktree = await findRepoRoot(path.resolve(process.cwd()))
  const cacheDir = path.join(worktree, ".opencode", "chat", MODEL_DIRNAME)

  console.log(`[model] worktree: ${worktree}`)
  console.log(`[model] cache dir: ${cacheDir}`)
  console.log(`[model] downloading AllMiniLML6V2...`)

  await fs.mkdir(cacheDir, { recursive: true })

  await FlagEmbedding.init({
    model: EmbeddingModel.AllMiniLML6V2,
    executionProviders: [ExecutionProvider.CPU],
    cacheDir,
    showDownloadProgress: true,
  })

  console.log(`[model] download complete!`)
}

await main()
