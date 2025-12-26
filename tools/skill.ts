/**
 * chat_skill tool implementation.
 * Load skills from the repo's .opencode/skill directory only.
 */
import * as path from "path"
import * as fs from "fs/promises"
import { tool } from "@opencode-ai/plugin"

interface SkillInfo {
  name: string
  description: string
  location: string
}

// Simple YAML frontmatter parser
function parseFrontmatter(content: string): { data: Record<string, string>; content: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { data: {}, content }

  const frontmatter = match[1]
  const body = match[2]
  const data: Record<string, string> = {}

  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":")
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim()
      data[key] = value
    }
  }

  return { data, content: body }
}

export function createChatSkill(baseDir: string) {
  const skillDir = path.join(baseDir, ".opencode", "skill")

  // Scan for skills in the repo's .opencode/skill directory
  async function scanSkills(): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = []

    try {
      const entries = await fs.readdir(skillDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const skillPath = path.join(skillDir, entry.name, "SKILL.md")
        try {
          const content = await fs.readFile(skillPath, "utf-8")
          const { data } = parseFrontmatter(content)

          if (data.name && data.description) {
            skills.push({
              name: data.name,
              description: data.description,
              location: skillPath,
            })
          }
        } catch {
          // Skip if SKILL.md doesn't exist or can't be read
        }
      }
    } catch {
      // Skill directory doesn't exist
    }

    return skills
  }

  // Get a specific skill by name
  async function getSkill(name: string): Promise<SkillInfo | undefined> {
    const skills = await scanSkills()
    return skills.find((s) => s.name === name)
  }

  const run = async (args: { name: string }) => {
    const skill = await getSkill(args.name)

    if (!skill) {
      const skills = await scanSkills()
      const available = skills.map((s) => s.name).join(", ")
      throw new Error(`Skill "${args.name}" not found. Available skills: ${available || "none"}`)
    }

    const content = await fs.readFile(skill.location, "utf-8")
    const parsed = parseFrontmatter(content)
    const dir = path.dirname(skill.location)

    return [`## Skill: ${skill.name}`, "", `**Base directory**: ${dir}`, "", parsed.content.trim()].join("\n")
  }

  // Build description with available skills
  const buildDescription = async () => {
    const skills = await scanSkills()
    const skillList = skills.flatMap((skill) => [
      `  <skill>`,
      `    <name>${skill.name}</name>`,
      `    <description>${skill.description}</description>`,
      `  </skill>`,
    ])

    return [
      "Load a skill to get detailed instructions for a specific task.",
      "Skills provide specialized knowledge and step-by-step guidance.",
      "<available_skills>",
      ...skillList,
      "</available_skills>",
    ].join("\n")
  }

  return {
    id: "chat_skill",
    run,
    buildDescription,
    tool: tool({
      description: "Load a skill for step-by-step guidance. Call without args to see available skills.",
      args: {
        name: tool.schema.string().describe("The skill name to load"),
      },
      async execute(args) {
        return await run(args)
      },
    }),
  }
}
