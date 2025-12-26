/**
 * Text chunking strategies for semantic indexing.
 * Splits files into embeddable chunks respecting content boundaries.
 */
import * as path from "path"

const MAX_CHUNK_CHARS = 6000

export type Chunk = {
  path: string
  startLine: number
  endLine: number
  content: string
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
      chunks.push({ path: filePath, startLine: 1, endLine: end + 1, content: linesToText(lines.slice(0, end + 1)) })
      index = end + 1
    }
  }

  let sectionStart = index
  let sectionLines: string[] = []

  const flushSection = (startLine: number, linesToFlush: string[]) => {
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
    for (const chunk of splitByParagraphs(linesToFlush, startLine + 1, MAX_CHUNK_CHARS)) {
      chunks.push({ path: filePath, startLine: chunk.start, endLine: chunk.end, content: linesToText(chunk.lines) })
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

export function chunkFile(filePath: string, text: string): Chunk[] {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === ".md" || ext === ".mdx") return chunkMarkdown(filePath, text)
  return chunkText(filePath, text)
}
