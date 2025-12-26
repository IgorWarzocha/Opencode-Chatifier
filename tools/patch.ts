/**
 * chat_patch tool implementation.
 * Apply patches to create, update, delete, or move files.
 */
import { tool } from "@opencode-ai/plugin"
import * as path from "path"
import { parsePatch, applyHunksToFiles, type Hunk } from "../util/patch"

export function createChatPatch(baseDir: string) {
  const run = async (args: { patchText: string }) => {
    const { hunks } = parsePatch(args.patchText)

    const resolved: Hunk[] = hunks.map((hunk) => {
      if (hunk.type === "update" && hunk.move_path) {
        return { ...hunk, path: path.resolve(baseDir, hunk.path), move_path: path.resolve(baseDir, hunk.move_path) }
      }
      return { ...hunk, path: path.resolve(baseDir, hunk.path) }
    })

    const result = await applyHunksToFiles(resolved)

    const summary: string[] = []
    if (result.added.length) summary.push(`Added: ${result.added.join(", ")}`)
    if (result.modified.length) summary.push(`Modified: ${result.modified.join(", ")}`)
    if (result.deleted.length) summary.push(`Deleted: ${result.deleted.join(", ")}`)

    return summary.length ? summary.join("\n") : "No changes applied"
  }

  return {
    id: "chat_patch",
    run,
    tool: tool({
      description: `Apply a patch to create, update, or delete files.

FORMAT RULES:
- Start with: *** Begin Patch
- End with: *** End Patch
- Lines starting with "-" are REMOVED from the file
- Lines starting with "+" are ADDED to the file  
- Lines starting with " " (space) are kept unchanged (context)
- @@ marks a context line to LOCATE where changes happen

CREATE A NEW FILE:
*** Begin Patch
*** Add File: path/to/new.txt
+first line of new file
+second line of new file
*** End Patch

REPLACE A LINE (must include both - and +):
*** Begin Patch
*** Update File: path/to/file.txt
@@ function hello() {
-  return "old"
+  return "new"
*** End Patch

DELETE A LINE (use - with no +):
*** Begin Patch
*** Update File: path/to/file.txt
@@ const config = {
-  debug: true,
*** End Patch

INSERT A NEW LINE (use space prefix for context, then +):
*** Begin Patch
*** Update File: path/to/file.txt
@@ import React from "react"
 import React from "react"
+import { useState } from "react"
*** End Patch

DELETE A FILE:
*** Begin Patch
*** Delete File: path/to/remove.txt
*** End Patch

IMPORTANT: To replace a line, you MUST use "-oldline" then "+newline". The @@ line only locates WHERE to make changes.`,
      args: {
        patchText: tool.schema
          .string()
          .describe(
            "The patch text in the format shown above. Must include *** Begin Patch and *** End Patch markers.",
          ),
      },
      async execute(args) {
        return await run(args)
      },
    }),
  }
}
