/**
 * Shared constants for the chatifier plugin.
 * Centralizes limits and defaults so tool modules stay consistent.
 * Keep these values in sync with tool behavior as it evolves.
 */
export const DEFAULT_READ_LIMIT = 2000
export const MAX_LINE_LENGTH = 2000
export const LIST_LIMIT = 100
export const MAX_GREP_MATCHES = 100
export const MAX_OUTPUT_LENGTH = 30_000
export const MAX_RESPONSE_SIZE = 5 * 1024 * 1024
export const DEFAULT_WEBFETCH_TIMEOUT_MS = 30_000
export const MAX_WEBFETCH_TIMEOUT_MS = 120_000
export const TODO_FILENAME = "todo.md"

export const IGNORE_DIRS = new Set([
  "node_modules",
  "__pycache__",
  ".git",
  "dist",
  "build",
  "target",
  "vendor",
  "bin",
  "obj",
  ".idea",
  ".vscode",
  ".zig-cache",
  "zig-out",
  ".coverage",
  "coverage",
  "tmp",
  "temp",
  ".cache",
  "cache",
  "logs",
  ".venv",
  "venv",
  "env",
])
