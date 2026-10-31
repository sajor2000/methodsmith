import { describe, expect, test } from "bun:test"
import { promises as fs } from "fs"
import path from "path"
import { load } from "js-yaml"

const skillsRoot = path.join(process.cwd(), "plugins", "methodsmith", "skills")
const MAX_DESCRIPTION_CHARS = 720

async function skillFiles(): Promise<string[]> {
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillFile = path.join(skillsRoot, entry.name, "SKILL.md")
    try {
      await fs.access(skillFile)
      files.push(skillFile)
    } catch {
      // Not a skill directory.
    }
  }
  return files.sort()
}

function parseFrontmatter(raw: string): Record<string, unknown> {
  const lines = raw.split(/\r?\n/)
  if (lines[0]?.trim() !== "---") return {}
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---")
  if (end === -1) return {}
  return (load(lines.slice(1, end).join("\n")) as Record<string, unknown> | null) ?? {}
}

describe("methodsmith skill value contract", () => {
  test("all skills declare value, output, Q/A boundary, and non-goal", async () => {
    const missing: string[] = []

    for (const file of await skillFiles()) {
      const rel = path.relative(skillsRoot, file)
      const content = await fs.readFile(file, "utf8")
      const requiredSnippets = [
        "## Skill Value",
        "**Problem it solves:**",
        "**Use when:**",
        "**Output:**",
        "**Ask only if:**",
        "**Do not do:**",
      ]

      for (const snippet of requiredSnippets) {
        if (!content.includes(snippet)) missing.push(`${rel} missing ${snippet}`)
      }
    }

    expect(missing).toEqual([])
  })

  test("skill value blocks are distinct across skills", async () => {
    const seen = new Map<string, string>()
    const duplicates: string[] = []
    const fields = [
      "**Problem it solves:**",
      "**Use when:**",
      "**Output:**",
      "**Do not do:**",
    ]

    for (const file of await skillFiles()) {
      const rel = path.relative(skillsRoot, file)
      const content = await fs.readFile(file, "utf8")
      for (const field of fields) {
        const line = content.split(/\r?\n/).find((value) => value.includes(field))
        const normalized = line?.replace(/^-\s*/, "").trim().toLowerCase()
        if (!normalized) continue
        const key = `${field} ${normalized}`
        const previous = seen.get(key)
        if (previous) duplicates.push(`${rel} duplicates ${field} from ${previous}`)
        else seen.set(key, rel)
      }
    }

    expect(duplicates).toEqual([])
  })

  test("skill descriptions stay concise enough for discovery", async () => {
    const offenders: string[] = []

    for (const file of await skillFiles()) {
      const rel = path.relative(skillsRoot, file)
      const frontmatter = parseFrontmatter(await fs.readFile(file, "utf8"))
      const description = typeof frontmatter.description === "string" ? frontmatter.description : ""
      if ([...description].length > MAX_DESCRIPTION_CHARS) {
        offenders.push(`${rel}: ${[...description].length} chars`)
      }
    }

    expect(offenders).toEqual([])
  })

  test("interactive skills do not duplicate platform-specific question-tool boilerplate", async () => {
    const offenders: string[] = []
    // These skills must carry the cross-platform interaction contract at runtime.
    const explicitInteractionSkills = new Set([
      "method-fabric/SKILL.md",
      "method-study/SKILL.md",
      "method-model-choice/SKILL.md",
      "method-notebook-standards/SKILL.md",
      "method-trial-design/SKILL.md",
    ])
    const forbidden = [
      "AskUserQuestion",
      "ToolSearch",
      "request_user_input",
      "ask_user",
      "pi-ask-user",
    ]

    for (const file of await skillFiles()) {
      const rel = path.relative(skillsRoot, file)
      if (explicitInteractionSkills.has(rel)) continue
      const content = await fs.readFile(file, "utf8")
      for (const phrase of forbidden) {
        if (content.includes(phrase)) offenders.push(`${rel}: ${phrase}`)
      }
    }

    expect(offenders).toEqual([])
  })

  test("trial design keeps blocking questions portable", async () => {
    const skill = await fs.readFile(path.join(skillsRoot, "method-trial-design", "SKILL.md"), "utf8")

    for (const required of [
      "AskUserQuestion",
      "request_user_input",
      "AskUser",
      "question",
      "ask_user",
      "pi-ask-user",
      "ToolSearch",
      "select:AskUserQuestion",
    ]) {
      expect(skill).toContain(required)
    }
    expect(skill).toContain("present numbered options in chat and wait")
  })

  test("skills do not runtime-link to maintainer-only interaction docs", async () => {
    const offenders: string[] = []

    for (const file of await skillFiles()) {
      const rel = path.relative(skillsRoot, file)
      const content = await fs.readFile(file, "utf8")
      if (content.includes("docs/solutions/skill-design/portable-interaction-contract.md")) {
        offenders.push(rel)
      }
    }

    expect(offenders).toEqual([])
  })

  test("skills do not reference sibling skill resources at runtime", async () => {
    const offenders: string[] = []
    const siblingResourcePattern = /\bce-[a-z0-9-]+\/(?:references|scripts|assets)\//g

    for (const file of await skillFiles()) {
      const rel = path.relative(skillsRoot, file)
      const content = await fs.readFile(file, "utf8")
      const matches = [...content.matchAll(siblingResourcePattern)]
      for (const match of matches) offenders.push(`${rel}: ${match[0]}`)
    }

    expect(offenders).toEqual([])
  })
})
