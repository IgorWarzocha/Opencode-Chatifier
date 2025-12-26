/**
 * Semantic indexing and search orchestration.
 * Coordinates chunking, embedding, and SQLite storage for vector search.
 */
import * as path from "path"
import * as fs from "fs/promises"
import { Database } from "bun:sqlite"
import { chunkFile } from "./chunker"
import { getEmbedder, encodeEmbedding, decodeEmbedding, cosineSimilarity, getModelDir } from "./embedder"

export { ensureModel } from "./embedder"

const DB_FILENAME = "semantic.sqlite"
const MAX_FILE_BYTES = 1024 * 1024
const MAX_CHUNKS_PER_FILE = 200
const EMBED_BATCH_SIZE = 16

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".txt",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".css",
  ".html",
  ".sh",
  ".bash",
  ".zsh",
])

const SKIP_DIRS = [".git", "node_modules", ".opencode", "dist", "build", "out", ".next", ".turbo", "coverage"]

type IndexProgress = {
  total: number
  processed: number
  indexed: number
  skipped: number
  chunks: number
  currentPath?: string
}

type IndexOptions = {
  mode?: "changed" | "full"
  onProgress?: (progress: IndexProgress) => void
  maxTargets?: number
  maxBytes?: number
}

function getDb(dbPath: string) {
  const db = new Database(dbPath)
  db.run("PRAGMA journal_mode = WAL")
  db.run("PRAGMA synchronous = NORMAL")
  db.run("CREATE TABLE IF NOT EXISTS files (path TEXT PRIMARY KEY, mtime INTEGER)")
  db.run(
    "CREATE TABLE IF NOT EXISTS chunks (id INTEGER PRIMARY KEY, path TEXT, start_line INTEGER, end_line INTEGER, content TEXT, embedding BLOB)",
  )
  return db
}

function isSkippedPath(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/")
  return SKIP_DIRS.some((dir) => normalized.includes(`/${dir}/`))
}

function isTextFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  return ext ? TEXT_EXTENSIONS.has(ext) : true
}

async function collectTargets(worktree: string, mode: "changed" | "full", filesQuery: ReturnType<Database["prepare"]>) {
  const glob = new Bun.Glob("**/*")
  const targets: Array<{ absPath: string; stat: { mtimeMs: number; size: number } }> = []
  const skipped: string[] = []
  let totalBytes = 0

  for await (const relPath of glob.scan({ cwd: worktree, absolute: false, onlyFiles: true, followSymlinks: false })) {
    if (isSkippedPath(`/${relPath}`)) continue
    const absPath = path.join(worktree, relPath)
    if (!isTextFile(absPath)) continue

    const stat = await fs.stat(absPath)
    if (stat.size > MAX_FILE_BYTES) continue

    if (mode === "changed") {
      const existing = filesQuery.get(absPath) as { mtime: number } | undefined
      if (existing && existing.mtime === Math.floor(stat.mtimeMs)) {
        skipped.push(absPath)
        continue
      }
    }

    targets.push({ absPath, stat })
    totalBytes += stat.size
  }

  return { targets, skipped, totalBytes }
}

export async function ensureSemanticIndex(worktree: string, options: IndexOptions = {}) {
  const dbDir = path.join(worktree, ".opencode", "chat")
  await fs.mkdir(dbDir, { recursive: true })
  const db = getDb(path.join(dbDir, DB_FILENAME))

  const mode = options.mode ?? "changed"

  const filesQuery = db.prepare("SELECT mtime FROM files WHERE path = ?")
  const upsertFile = db.prepare("INSERT OR REPLACE INTO files (path, mtime) VALUES (?, ?)")
  const deleteChunks = db.prepare("DELETE FROM chunks WHERE path = ?")
  const insertChunk = db.prepare(
    "INSERT INTO chunks (path, start_line, end_line, content, embedding) VALUES (?, ?, ?, ?, ?)",
  )

  if (mode === "full") {
    db.run("DELETE FROM chunks")
    db.run("DELETE FROM files")
  }

  const { targets, skipped, totalBytes } = await collectTargets(worktree, mode, filesQuery)

  let processed = 0
  let indexed = 0
  let chunksTotal = 0

  const report = (currentPath?: string) => {
    options.onProgress?.({
      total: targets.length,
      processed,
      indexed,
      skipped: skipped.length,
      chunks: chunksTotal,
      currentPath,
    })
  }

  if (targets.length === 0) {
    report()
    return { total: 0, processed: 0, indexed: 0, skipped: skipped.length, chunks: 0, mode }
  }

  if (typeof options.maxTargets === "number" && targets.length > options.maxTargets) {
    report("skip:too-many-files")
    return {
      total: targets.length,
      processed: 0,
      indexed: 0,
      skipped: skipped.length,
      chunks: 0,
      mode,
      skippedReason: "too-many-files",
    }
  }

  if (typeof options.maxBytes === "number" && totalBytes > options.maxBytes) {
    report("skip:too-large")
    return {
      total: targets.length,
      processed: 0,
      indexed: 0,
      skipped: skipped.length,
      chunks: 0,
      mode,
      skippedReason: "too-large",
    }
  }

  const model = await getEmbedder(getModelDir(dbDir))
  report()

  for (const target of targets) {
    report(target.absPath)
    const text = await Bun.file(target.absPath).text()
    processed += 1

    if (!text.trim() || text.includes("\u0000")) continue

    const chunks = chunkFile(target.absPath, text)
    if (chunks.length === 0 || chunks.length > MAX_CHUNKS_PER_FILE) continue

    deleteChunks.run(target.absPath)

    const embeddings: number[][] = []
    for await (const batch of model.passageEmbed(
      chunks.map((c) => c.content),
      EMBED_BATCH_SIZE,
    )) {
      embeddings.push(...batch)
    }

    db.run("BEGIN")
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      insertChunk.run(chunk.path, chunk.startLine, chunk.endLine, chunk.content, encodeEmbedding(embeddings[i]))
    }
    upsertFile.run(target.absPath, Math.floor(target.stat.mtimeMs))
    db.run("COMMIT")

    indexed += 1
    chunksTotal += chunks.length
    report(target.absPath)
  }

  return { total: targets.length, processed, indexed, skipped: skipped.length, chunks: chunksTotal, mode }
}

export async function semanticSearch(worktree: string, query: string, limit: number) {
  const dbDir = path.join(worktree, ".opencode", "chat")
  const db = getDb(path.join(dbDir, DB_FILENAME))
  const model = await getEmbedder(getModelDir(dbDir))

  const queryVec = new Float32Array(await model.queryEmbed(query))

  const rows = db.query("SELECT path, start_line, end_line, content, embedding FROM chunks").all() as Array<{
    path: string
    start_line: number
    end_line: number
    content: string
    embedding: Uint8Array
  }>

  const scored = rows
    .map((row) => ({ ...row, score: cosineSimilarity(queryVec, decodeEmbedding(row.embedding)) }))
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit)
}
