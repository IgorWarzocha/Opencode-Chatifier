/**
 * Text helpers used by multiple tools.
 * Keeps formatting and replacement behavior consistent across modules.
 * Focuses on predictable output instead of clever heuristics.
 */
import { MAX_LINE_LENGTH } from "./constants"

export function trimLine(line: string) {
  if (line.length <= MAX_LINE_LENGTH) return line
  return line.slice(0, MAX_LINE_LENGTH) + "..."
}

export function replaceOnce(content: string, oldString: string, newString: string, replaceAll?: boolean) {
  if (oldString === newString) {
    throw new Error("oldString and newString must be different")
  }
  if (oldString === "") {
    return newString
  }
  const first = content.indexOf(oldString)
  if (first === -1) {
    throw new Error("oldString not found in content")
  }
  if (replaceAll) {
    return content.split(oldString).join(newString)
  }
  const last = content.lastIndexOf(oldString)
  if (first !== last) {
    throw new Error(
      "Found multiple matches for oldString. Provide more surrounding lines in oldString to identify the correct match.",
    )
  }
  return content.slice(0, first) + newString + content.slice(first + oldString.length)
}

export function stripHtml(html: string) {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "")
  const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, "")
  const withoutTags = withoutStyles.replace(/<[^>]+>/g, " ")
  return withoutTags.replace(/\s+/g, " ").trim()
}
