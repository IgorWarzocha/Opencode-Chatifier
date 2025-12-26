/**
 * Patch parsing and application utilities.
 * Handles the *** Begin/End Patch format for file operations.
 */
import * as path from "path"
import * as fs from "fs/promises"
import * as fsSync from "fs"

export type AddHunk = { type: "add"; path: string; contents: string }
export type DeleteHunk = { type: "delete"; path: string }
export type UpdateHunk = { type: "update"; path: string; move_path?: string; chunks: UpdateChunk[] }
export type Hunk = AddHunk | DeleteHunk | UpdateHunk

export type UpdateChunk = {
  old_lines: string[]
  new_lines: string[]
  change_context?: string
  is_end_of_file?: boolean
}

export type AffectedPaths = {
  added: string[]
  modified: string[]
  deleted: string[]
}

function parsePatchHeader(lines: string[], idx: number) {
  const line = lines[idx]

  if (line.startsWith("*** Add File:")) {
    const filePath = line.split(":", 2)[1]?.trim()
    return filePath ? { filePath, nextIdx: idx + 1 } : null
  }

  if (line.startsWith("*** Delete File:")) {
    const filePath = line.split(":", 2)[1]?.trim()
    return filePath ? { filePath, nextIdx: idx + 1 } : null
  }

  if (line.startsWith("*** Update File:")) {
    const filePath = line.split(":", 2)[1]?.trim()
    let movePath: string | undefined
    let nextIdx = idx + 1

    if (nextIdx < lines.length && lines[nextIdx].startsWith("*** Move to:")) {
      movePath = lines[nextIdx].split(":", 2)[1]?.trim()
      nextIdx++
    }

    return filePath ? { filePath, movePath, nextIdx } : null
  }

  return null
}

function parseUpdateChunks(lines: string[], startIdx: number) {
  const chunks: UpdateChunk[] = []
  let i = startIdx

  while (i < lines.length && !lines[i].startsWith("***")) {
    if (lines[i].startsWith("@@")) {
      const contextLine = lines[i].substring(2).trim()
      i++

      const oldLines: string[] = []
      const newLines: string[] = []
      let isEndOfFile = false

      while (i < lines.length && !lines[i].startsWith("@@") && !lines[i].startsWith("***")) {
        const changeLine = lines[i]

        if (changeLine === "*** End of File") {
          isEndOfFile = true
          i++
          break
        }

        if (changeLine.startsWith(" ")) {
          const content = changeLine.substring(1)
          oldLines.push(content)
          newLines.push(content)
        } else if (changeLine.startsWith("-")) {
          oldLines.push(changeLine.substring(1))
        } else if (changeLine.startsWith("+")) {
          newLines.push(changeLine.substring(1))
        }

        i++
      }

      chunks.push({
        old_lines: oldLines,
        new_lines: newLines,
        change_context: contextLine || undefined,
        is_end_of_file: isEndOfFile || undefined,
      })
    } else {
      i++
    }
  }

  return { chunks, nextIdx: i }
}

function parseAddContent(lines: string[], startIdx: number) {
  let content = ""
  let i = startIdx

  while (i < lines.length && !lines[i].startsWith("***")) {
    if (lines[i].startsWith("+")) {
      content += lines[i].substring(1) + "\n"
    }
    i++
  }

  if (content.endsWith("\n")) content = content.slice(0, -1)
  return { content, nextIdx: i }
}

export function parsePatch(patchText: string) {
  const lines = patchText.split("\n")
  const hunks: Hunk[] = []

  const beginIdx = lines.findIndex((line) => line.trim() === "*** Begin Patch")
  const endIdx = lines.findIndex((line) => line.trim() === "*** End Patch")

  if (beginIdx === -1 || endIdx === -1 || beginIdx >= endIdx) {
    throw new Error("Invalid patch format: missing Begin/End markers")
  }

  let i = beginIdx + 1

  while (i < endIdx) {
    const header = parsePatchHeader(lines, i)
    if (!header) {
      i++
      continue
    }

    if (lines[i].startsWith("*** Add File:")) {
      const { content, nextIdx } = parseAddContent(lines, header.nextIdx)
      hunks.push({ type: "add", path: header.filePath, contents: content })
      i = nextIdx
    } else if (lines[i].startsWith("*** Delete File:")) {
      hunks.push({ type: "delete", path: header.filePath })
      i = header.nextIdx
    } else if (lines[i].startsWith("*** Update File:")) {
      const { chunks, nextIdx } = parseUpdateChunks(lines, header.nextIdx)
      hunks.push({ type: "update", path: header.filePath, move_path: header.movePath, chunks })
      i = nextIdx
    } else {
      i++
    }
  }

  return { hunks }
}

function seekSequence(lines: string[], pattern: string[], startIndex: number) {
  if (pattern.length === 0) return -1

  for (let i = startIndex; i <= lines.length - pattern.length; i++) {
    let matches = true
    for (let j = 0; j < pattern.length; j++) {
      if (lines[i + j] !== pattern[j]) {
        matches = false
        break
      }
    }
    if (matches) return i
  }

  return -1
}

function computeReplacements(originalLines: string[], filePath: string, chunks: UpdateChunk[]) {
  const replacements: Array<[number, number, string[]]> = []
  let lineIndex = 0

  for (const chunk of chunks) {
    let contextIdx = -1
    if (chunk.change_context) {
      contextIdx = seekSequence(originalLines, [chunk.change_context], lineIndex)
      if (contextIdx === -1) {
        throw new Error(`Failed to find context '${chunk.change_context}' in ${filePath}`)
      }
      lineIndex = contextIdx
    }

    if (chunk.old_lines.length === 0) {
      if (chunk.change_context && contextIdx !== -1) {
        replacements.push([contextIdx, 1, chunk.new_lines])
      } else {
        replacements.push([originalLines.length, 0, chunk.new_lines])
      }
      continue
    }

    let pattern = chunk.old_lines
    let newSlice = chunk.new_lines
    let found = seekSequence(originalLines, pattern, lineIndex)

    if (found === -1 && pattern.length > 0 && pattern[pattern.length - 1] === "") {
      pattern = pattern.slice(0, -1)
      if (newSlice.length > 0 && newSlice[newSlice.length - 1] === "") {
        newSlice = newSlice.slice(0, -1)
      }
      found = seekSequence(originalLines, pattern, lineIndex)
    }

    if (found !== -1) {
      replacements.push([found, pattern.length, newSlice])
      lineIndex = found + pattern.length
    } else {
      throw new Error(`Failed to find expected lines in ${filePath}:\n${chunk.old_lines.join("\n")}`)
    }
  }

  replacements.sort((a, b) => a[0] - b[0])
  return replacements
}

function applyReplacements(lines: string[], replacements: Array<[number, number, string[]]>) {
  const result = [...lines]

  for (let i = replacements.length - 1; i >= 0; i--) {
    const [startIdx, oldLen, newSegment] = replacements[i]
    result.splice(startIdx, oldLen)
    for (let j = 0; j < newSegment.length; j++) {
      result.splice(startIdx + j, 0, newSegment[j])
    }
  }

  return result
}

function deriveNewContents(filePath: string, chunks: UpdateChunk[]) {
  const originalContent = fsSync.readFileSync(filePath, "utf-8")
  let originalLines = originalContent.split("\n")

  if (originalLines.length > 0 && originalLines[originalLines.length - 1] === "") {
    originalLines.pop()
  }

  const replacements = computeReplacements(originalLines, filePath, chunks)
  const newLines = applyReplacements(originalLines, replacements)

  if (newLines.length === 0 || newLines[newLines.length - 1] !== "") {
    newLines.push("")
  }

  return newLines.join("\n")
}

export async function applyHunksToFiles(hunks: Hunk[]): Promise<AffectedPaths> {
  if (hunks.length === 0) throw new Error("No files were modified.")

  const added: string[] = []
  const modified: string[] = []
  const deleted: string[] = []

  for (const hunk of hunks) {
    if (hunk.type === "add") {
      const dir = path.dirname(hunk.path)
      if (dir !== "." && dir !== "/") {
        await fs.mkdir(dir, { recursive: true })
      }
      await fs.writeFile(hunk.path, hunk.contents, "utf-8")
      added.push(hunk.path)
    } else if (hunk.type === "delete") {
      await fs.unlink(hunk.path)
      deleted.push(hunk.path)
    } else if (hunk.type === "update") {
      const content = deriveNewContents(hunk.path, hunk.chunks)

      if (hunk.move_path) {
        const dir = path.dirname(hunk.move_path)
        if (dir !== "." && dir !== "/") {
          await fs.mkdir(dir, { recursive: true })
        }
        await fs.writeFile(hunk.move_path, content, "utf-8")
        await fs.unlink(hunk.path)
        modified.push(hunk.move_path)
      } else {
        await fs.writeFile(hunk.path, content, "utf-8")
        modified.push(hunk.path)
      }
    }
  }

  return { added, modified, deleted }
}
