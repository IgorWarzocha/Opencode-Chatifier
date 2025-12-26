/**
 * Path and file-type helpers for chatified tools.
 * Ensures paths remain within the working directory and flags unsafe targets.
 * File-type checks mimic core tool behavior where possible.
 */
import path from "path"

export function resolvePath(baseDir: string, inputPath: string) {
  const resolved = path.isAbsolute(inputPath) ? inputPath : path.resolve(baseDir, inputPath)
  const rel = path.relative(baseDir, resolved)
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path must stay within ${baseDir}: ${inputPath}`)
  }
  return resolved
}

export function isBlockedEnvPath(filePath: string) {
  if (filePath.endsWith(".env.sample") || filePath.endsWith(".env.example")) return false
  return filePath.includes(".env")
}

export function isBinaryExtension(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  return new Set([
    ".zip",
    ".tar",
    ".gz",
    ".exe",
    ".dll",
    ".so",
    ".class",
    ".jar",
    ".war",
    ".7z",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".odt",
    ".ods",
    ".odp",
    ".bin",
    ".dat",
    ".obj",
    ".o",
    ".a",
    ".lib",
    ".wasm",
    ".pyc",
    ".pyo",
  ]).has(ext)
}

export function isImageExtension(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  return new Set([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"]).has(ext)
}

export async function isBinaryFile(filePath: string) {
  if (isBinaryExtension(filePath)) return true
  const file = Bun.file(filePath)
  const buffer = await file.arrayBuffer().catch(() => undefined)
  if (!buffer) return false
  const bytes = new Uint8Array(buffer.slice(0, Math.min(4096, buffer.byteLength)))
  if (bytes.length === 0) return false
  let nonPrintable = 0
  for (const byte of bytes) {
    if (byte === 0) return true
    if (byte < 9 || (byte > 13 && byte < 32)) {
      nonPrintable += 1
    }
  }
  return nonPrintable / bytes.length > 0.3
}
