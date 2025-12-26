/**
 * Semantic indexing and search for repo content.
 */
import * as path from "path"
import * as fs from "fs/promises"
import { Database } from "bun:sqlite"
import { EmbeddingModel, ExecutionProvider, FlagEmbedding } from "fastembed"

const DB_FILENAME = "semantic.sqlite"
const MODEL_DIRNAME = "models"
const MAX_FILE_BYTES = 1024 * 1024
const MAX_CHUNK_CHARS = 6000
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

type Chunk = {
  path: string
  startLine: number
  endLine: number
  content: string
}

type IndexMode = "changed" | "full"

type IndexProgress = {
  total: number
  processed: number
  indexed: number
  skipped: number
  chunks: number
  currentPath?: string
}

type IndexOptions = {
  mode?: IndexMode
  onProgress?: (progress: IndexProgress) => void
  maxTargets?: number
  maxBytes?: number
}

let embedder: FlagEmbedding | null = null

function getDb(dbPath: string) {
  const db = new Database(dbPath)
  db.exec("PRAGMA journal_mode = WAL;")
  db.exec("PRAGMA synchronous = NORMAL;")
  db.exec("CREATE TABLE IF NOT EXISTS files (path TEXT PRIMARY KEY, mtime INTEGER);")
  db.exec(
    "CREATE TABLE IF NOT EXISTS chunks (id INTEGER PRIMARY KEY, path TEXT, start_line INTEGER, end_line INTEGER, content TEXT, embedding BLOB);",
  )
  return db
}

async function getEmbedder(cacheDir: string) {
  if (embedder) return embedder
  embedder = await FlagEmbedding.init({
    model: EmbeddingModel.AllMiniLML6V2,
    executionProviders: [ExecutionProvider.CPU],
    cacheDir,
    showDownloadProgress: true,
  })
  return embedder
}

export async function ensureModel(worktree: string) {
  const cacheDir = path.join(worktree, ".opencode", "chat", MODEL_DIRNAME)
  const modelPath = path.join(cacheDir, "fast-all-MiniLM-L6-v2", "model.onnx")
  const exists = await fs
    .stat(modelPath)
    .then(() => true)
    .catch(() => false)
  if (exists) return
  await fs.mkdir(cacheDir, { recursive: true })
  await getEmbedder(cacheDir)
}

function isSkippedPath(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/")
  return SKIP_DIRS.some((dir) => normalized.includes(`/${dir}/`))
}

function isTextFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext) return TEXT_EXTENSIONS.has(ext)
  return true
}

function hasNullBytes(text: string) {
  return text.includes("\u0000")
}

function linesToText(lines: string[]) {
  return lines.join("\n")
}

function splitByParagraphs(lines: string[], startLine: number, maxChars: number) {
  const paragraphs: Array<{ start: number; end: number; lines: string[] }> = []
  let current: string[] = []
  let currentStart = startLine

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (current.length === 0) currentStart = startLine + i
    current.push(line)

    if (line.trim() === "") {
      paragraphs.push({ start: currentStart, end: startLine + i, lines: current })
      current = []
    }
  }

  if (current.length > 0) {
    paragraphs.push({ start: currentStart, end: startLine + lines.length - 1, lines: current })
  }

  const chunks: Array<{ start: number; end: number; lines: string[] }> = []
  let acc: string[] = []
  let accStart = startLine
  let accLen = 0

  for (const para of paragraphs) {
    const text = linesToText(para.lines)
    const nextLen = accLen + text.length

    if (accLen > 0 && nextLen > maxChars) {
      chunks.push({ start: accStart, end: accStart + acc.length - 1, lines: acc })
      acc = []
      accLen = 0
    }

    if (text.length > maxChars) {
      if (acc.length > 0) {
        chunks.push({ start: accStart, end: accStart + acc.length - 1, lines: acc })
        acc = []
        accLen = 0
      }

      let slice: string[] = []
      let sliceStart = para.start
      let sliceLen = 0

      for (let i = 0; i < para.lines.length; i++) {
        const line = para.lines[i]
        const lineLen = line.length + 1
        if (sliceLen > 0 && sliceLen + lineLen > maxChars) {
          chunks.push({ start: sliceStart, end: sliceStart + slice.length - 1, lines: slice })
          slice = []
          sliceLen = 0
          sliceStart = para.start + i
        }
        slice.push(line)
        sliceLen += lineLen
      }

      if (slice.length > 0) {
        chunks.push({ start: sliceStart, end: sliceStart + slice.length - 1, lines: slice })
      }
      continue
    }

    if (acc.length === 0) accStart = para.start
    acc.push(...para.lines)
    accLen += text.length
  }

  if (acc.length > 0) {
    chunks.push({ start: accStart, end: accStart + acc.length - 1, lines: acc })
  }

  return chunks
}

function chunkMarkdown(filePath: string, text: string): Chunk[] {
  const lines = text.split("\n")
  const chunks: Chunk[] = []
  let index = 0

  if (lines[0] === "---") {
    let end = -1
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === "---") {
        end = i
        break
      }
    }

    if (end > 0) {
      chunks.push({
        path: filePath,
        startLine: 1,
        endLine: end + 1,
        content: linesToText(lines.slice(0, end + 1)),
      })
      index = end + 1
    }
  }

  let sectionStart = index
  let sectionLines: string[] = []

  function flushSection(startLine: number, linesToFlush: string[]) {
    if (linesToFlush.length === 0) return
    const textContent = linesToText(linesToFlush)
    if (textContent.length <= MAX_CHUNK_CHARS) {
      chunks.push({
        path: filePath,
        startLine: startLine + 1,
        endLine: startLine + linesToFlush.length,
        content: textContent,
      })
      return
    }

    const paragraphs = splitByParagraphs(linesToFlush, startLine + 1, MAX_CHUNK_CHARS)
    for (const chunk of paragraphs) {
      chunks.push({
        path: filePath,
        startLine: chunk.start,
        endLine: chunk.end,
        content: linesToText(chunk.lines),
      })
    }
  }

  for (let i = index; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith("#")) {
      flushSection(sectionStart, sectionLines)
      sectionStart = i
      sectionLines = [line]
      continue
    }
    sectionLines.push(line)
  }

  flushSection(sectionStart, sectionLines)

  return chunks
}

function chunkText(filePath: string, text: string): Chunk[] {
  const lines = text.split("\n")
  const chunks: Chunk[] = []
  let current: string[] = []
  let currentStart = 1
  let currentLen = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nextLen = currentLen + line.length + 1

    if (currentLen > 0 && nextLen > MAX_CHUNK_CHARS) {
      chunks.push({
        path: filePath,
        startLine: currentStart,
        endLine: currentStart + current.length - 1,
        content: linesToText(current),
      })
      current = []
      currentLen = 0
    }

    if (current.length === 0) currentStart = i + 1
    current.push(line)
    currentLen += line.length + 1
  }

  if (current.length > 0) {
    chunks.push({
      path: filePath,
      startLine: currentStart,
      endLine: currentStart + current.length - 1,
      content: linesToText(current),
    })
  }

  return chunks
}

function chunkFile(filePath: string, text: string): Chunk[] {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === ".md" || ext === ".mdx") {
    return chunkMarkdown(filePath, text)
  }
  return chunkText(filePath, text)
}

function encodeEmbedding(vec: number[]) {
  return Buffer.from(new Float32Array(vec).buffer)
}

function decodeEmbedding(blob: Uint8Array) {
  return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4)
}

function cosineSimilarity(a: Float32Array, b: Float32Array) {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const av = a[i]
    const bv = b[i]
    dot += av * bv
    normA += av * av
    normB += bv * bv
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function collectIndexTargets(worktree: string, mode: IndexMode, filesQuery: ReturnType<Database["prepare"]>) {
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
  const dbPath = path.join(dbDir, DB_FILENAME)
  const db = getDb(dbPath)

  const mode = options.mode ?? "changed"
  const onProgress = options.onProgress
  const maxTargets = options.maxTargets
  const maxBytes = options.maxBytes

  const filesQuery = db.prepare("SELECT mtime FROM files WHERE path = ?")
  const upsertFile = db.prepare("INSERT OR REPLACE INTO files (path, mtime) VALUES (?, ?)")
  const deleteChunks = db.prepare("DELETE FROM chunks WHERE path = ?")
  const insertChunk = db.prepare(
    "INSERT INTO chunks (path, start_line, end_line, content, embedding) VALUES (?, ?, ?, ?, ?)",
  )

  if (mode === "full") {
    db.exec("DELETE FROM chunks")
    db.exec("DELETE FROM files")
  }

  const { targets, skipped, totalBytes } = await collectIndexTargets(worktree, mode, filesQuery)

  let processed = 0
  let indexed = 0
  let chunksTotal = 0

  const report = (currentPath?: string) => {
    onProgress?.({
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
    return {
      total: 0,
      processed: 0,
      indexed: 0,
      skipped: skipped.length,
      chunks: 0,
      mode,
    }
  }

  if (typeof maxTargets === "number" && targets.length > maxTargets) {
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

  if (typeof maxBytes === "number" && totalBytes > maxBytes) {
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

  const cacheDir = path.join(dbDir, MODEL_DIRNAME)
  const model = await getEmbedder(cacheDir)

  report()

  for (const target of targets) {
    report(target.absPath)
    const file = Bun.file(target.absPath)
    const text = await file.text()
    processed += 1

    if (!text.trim() || hasNullBytes(text)) {
      report(target.absPath)
      continue
    }

    const chunks = chunkFile(target.absPath, text)
    if (chunks.length === 0) {
      report(target.absPath)
      continue
    }

    if (chunks.length > MAX_CHUNKS_PER_FILE) {
      report(target.absPath)
      continue
    }

    deleteChunks.run(target.absPath)

    const texts = chunks.map((chunk) => chunk.content)
    const embeddings: number[][] = []

    for await (const batch of model.passageEmbed(texts, EMBED_BATCH_SIZE)) {
      embeddings.push(...batch)
    }

    db.exec("BEGIN")
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = embeddings[i]
      insertChunk.run(chunk.path, chunk.startLine, chunk.endLine, chunk.content, encodeEmbedding(embedding))
    }
    upsertFile.run(target.absPath, Math.floor(target.stat.mtimeMs))
    db.exec("COMMIT")

    indexed += 1
    chunksTotal += chunks.length
    report(target.absPath)
  }

  return {
    total: targets.length,
    processed,
    indexed,
    skipped: skipped.length,
    chunks: chunksTotal,
    mode,
  }
}

export async function semanticSearch(worktree: string, query: string, limit: number) {
  const dbPath = path.join(worktree, ".opencode", "chat", DB_FILENAME)
  const db = getDb(dbPath)
  const cacheDir = path.join(worktree, ".opencode", "chat", MODEL_DIRNAME)
  const model = await getEmbedder(cacheDir)

  const queryEmbedding = await model.queryEmbed(query)
  const queryVec = new Float32Array(queryEmbedding)

  const rows = db.query("SELECT path, start_line, end_line, content, embedding FROM chunks").all() as Array<{
    path: string
    start_line: number
    end_line: number
    content: string
    embedding: Uint8Array
  }>

  const scored = rows.map((row) => {
    const vec = decodeEmbedding(row.embedding)
    const score = cosineSimilarity(queryVec, vec)
    return { ...row, score }
  })

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, limit)
}
