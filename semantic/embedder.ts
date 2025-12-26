/**
 * Embedding model management and vector operations.
 * Handles model initialization and similarity scoring.
 */
import { EmbeddingModel, ExecutionProvider, FlagEmbedding } from "fastembed"
import * as path from "path"
import * as fs from "fs/promises"

const MODEL_DIRNAME = "models"
let embedder: FlagEmbedding | null = null

export async function getEmbedder(cacheDir: string) {
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

export function encodeEmbedding(vec: number[]) {
  return Buffer.from(new Float32Array(vec).buffer)
}

export function decodeEmbedding(blob: Uint8Array) {
  return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4)
}

export function cosineSimilarity(a: Float32Array, b: Float32Array) {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function getModelDir(dbDir: string) {
  return path.join(dbDir, MODEL_DIRNAME)
}
