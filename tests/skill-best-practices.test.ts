import { describe, expect, test } from "bun:test"
import { promises as fs } from "fs"
import path from "path"
import { load } from "js-yaml"

// Checkable rules from Anthropic's skill authoring best practices:
// https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

const skillsRoot = path.join(process.cwd(), "plugins", "methodsmith", "skills")
const MAX_NAME_CHARS = 64
const MAX_DESCRIPTION_CHARS = 1024
const MAX_LISTED_DESCRIPTION_CHARS = 300
const MAX_TOTAL_DESCRIPTION_CHARS = 11_700
const MAX_BODY_LINES = 500
// Every SKILL.md token loads on each invocation; long lines hide size from a line cap.
// ~16 KB is about 4,000 tokens. Move conditional or late-sequence detail to references/.
const MAX_SKILL_BYTES = 16_000
// References load on demand, but each loaded file stays in context for the rest of the run.
// ~24 KB is about 6,000 tokens; split larger files along their headings.
const MAX_REFERENCE_BYTES = 24_000
const TOC_REQUIRED_OVER_LINES = 100
const TOC_SEARCH_LINES = 40

type Skill = { name: string; dir: string; frontmatter: Record<string, unknown>; body: string }

async function loadSkills(): Promise<Skill[]> {
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true })
  const skills: Skill[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = path.join(skillsRoot, entry.name)
    const raw = await fs.readFile(path.join(dir, "SKILL.md"), "utf8").catch(() => null)
    if (raw === null) continue
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
    if (!match) throw new Error(`${entry.name}: SKILL.md has no frontmatter`)
    skills.push({
      name: entry.name,
      dir,
      frontmatter: (load(match[1]) as Record<string, unknown> | null) ?? {},
      body: match[2],
    })
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name))
}

async function markdownFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await markdownFiles(full)))
    else if (entry.name.endsWith(".md") && entry.name !== "SKILL.md") out.push(full)
  }
  return out
}

const skills = await loadSkills()

describe("skill frontmatter follows Anthropic naming and description rules", () => {
  test("name is lowercase-hyphenated, at most 64 chars, matches its directory, and avoids reserved words", () => {
    const problems: string[] = []
    for (const skill of skills) {
      const name = String(skill.frontmatter.name ?? "")
      if (name !== skill.name) problems.push(`${skill.name}: name "${name}" does not match directory`)
      if (name.length > MAX_NAME_CHARS) problems.push(`${skill.name}: name longer than ${MAX_NAME_CHARS}`)
      if (!/^[a-z0-9-]+$/.test(name)) problems.push(`${skill.name}: name must use lowercase letters, numbers, hyphens`)
      if (/anthropic|claude/.test(name)) problems.push(`${skill.name}: name contains a reserved word`)
    }
    expect(problems).toEqual([])
  })

  test("description is non-empty, bounded, XML-free, third person, and says when to use the skill", () => {
    const problems: string[] = []
    for (const skill of skills) {
      const description = String(skill.frontmatter.description ?? "").trim()
      if (!description) problems.push(`${skill.name}: empty description`)
      if (description.length > MAX_DESCRIPTION_CHARS) problems.push(`${skill.name}: description over ${MAX_DESCRIPTION_CHARS} chars`)
      if (/<[a-zA-Z/][^>]*>/.test(description)) problems.push(`${skill.name}: description contains XML-like tags`)
      if (/^(I|I'm|You|Use this (skill )?to)\b/.test(description)) problems.push(`${skill.name}: description is not third person`)
      if (!/\bUse when\b/.test(description)) problems.push(`${skill.name}: description lacks a "Use when ..." trigger`)
    }
    expect(problems).toEqual([])
  })

  // Claude Code fits the skill listing into a small share of context and drops the
  // descriptions of rarely used skills first when it overflows, so keep each one short
  // and front-loaded with a third-person verb ("Runs ...", not "Run ...").
  test(`descriptions open with a third-person verb, stay under ${MAX_LISTED_DESCRIPTION_CHARS} chars, and fit the listing budget`, () => {
    const problems: string[] = []
    let total = 0
    for (const skill of skills) {
      const description = String(skill.frontmatter.description ?? "").trim()
      total += description.length
      if (description.length > MAX_LISTED_DESCRIPTION_CHARS) {
        problems.push(`${skill.name}: description is ${description.length} chars`)
      }
      if (!/^[A-Z][a-z]+s\b/.test(description)) problems.push(`${skill.name}: description should open with a third-person verb`)
    }
    if (total > MAX_TOTAL_DESCRIPTION_CHARS) problems.push(`all skill descriptions total ${total} chars`)
    expect(problems).toEqual([])
  })
})

describe("skill bodies follow Anthropic progressive-disclosure rules", () => {
  test(`SKILL.md body stays under ${MAX_BODY_LINES} lines`, () => {
    const tooLong = skills
      .map((skill) => ({ name: skill.name, lines: skill.body.split("\n").length }))
      .filter((s) => s.lines >= MAX_BODY_LINES)
      .map((s) => `${s.name}: ${s.lines} lines`)
    expect(tooLong).toEqual([])
  })

  test(`SKILL.md stays under ${MAX_SKILL_BYTES} bytes`, async () => {
    const tooLarge: string[] = []
    for (const skill of skills) {
      const bytes = (await fs.stat(path.join(skill.dir, "SKILL.md"))).size
      if (bytes > MAX_SKILL_BYTES) tooLarge.push(`${skill.name}: ${bytes} bytes`)
    }
    expect(tooLarge).toEqual([])
  })

  test(`reference files stay under ${MAX_REFERENCE_BYTES} bytes`, async () => {
    const tooLarge: string[] = []
    for (const skill of skills) {
      for (const file of await markdownFiles(skill.dir)) {
        const bytes = (await fs.stat(file)).size
        if (bytes > MAX_REFERENCE_BYTES) tooLarge.push(`${path.relative(skillsRoot, file)}: ${bytes} bytes`)
      }
    }
    expect(tooLarge).toEqual([])
  })

  test(`reference files over ${TOC_REQUIRED_OVER_LINES} lines open with a table of contents`, async () => {
    const missing: string[] = []
    for (const skill of skills) {
      for (const file of await markdownFiles(skill.dir)) {
        const lines = (await fs.readFile(file, "utf8")).split("\n")
        if (lines.length <= TOC_REQUIRED_OVER_LINES + 1) continue
        const head = lines.slice(0, TOC_SEARCH_LINES)
        if (!head.some((line) => /^#+\s*(Contents|Table of contents)\b/i.test(line))) {
          missing.push(path.relative(skillsRoot, file))
        }
      }
    }
    expect(missing).toEqual([])
  })

  test("skill markdown uses forward-slash paths", async () => {
    const offenders: string[] = []
    for (const skill of skills) {
      for (const file of [path.join(skill.dir, "SKILL.md"), ...(await markdownFiles(skill.dir))]) {
        const content = await fs.readFile(file, "utf8")
        if (/\b(?:scripts|references|assets)\\[A-Za-z0-9_.-]/.test(content)) offenders.push(path.relative(skillsRoot, file))
      }
    }
    expect(offenders).toEqual([])
  })

  test("SKILL.md avoids time-sensitive phrasing that will go stale", () => {
    const pattern =
      /\b(?:as of|before|after|until) (?:(?:January|February|March|April|May|June|July|August|September|October|November|December) )?20\d\d\b/
    const offenders = skills.filter((skill) => pattern.test(skill.body)).map((skill) => skill.name)
    expect(offenders).toEqual([])
  })
})

describe("skill cross-references resolve", () => {
  const pluginRoot = path.join(skillsRoot, "..")
  // Optional external skills (guarded with "when installed"), the plugin's own name, and a name skills say never to dispatch.
  const EXTERNAL_NAMES = new Set(["ce-proof", "ce-demo-reel", "methodsmith", "methodsmith", "method-clif-reviewer"])

  test("backtick references/, assets/, and scripts/ paths exist inside the skill", async () => {
    const missing: string[] = []
    for (const skill of skills) {
      for (const file of [path.join(skill.dir, "SKILL.md"), ...(await markdownFiles(skill.dir))]) {
        const content = await fs.readFile(file, "utf8")
        for (const [, rel] of content.matchAll(/`((?:references|assets|scripts)\/[A-Za-z0-9_./-]+)`/g)) {
          if (/[<*]/.test(rel) || rel.endsWith("/")) continue
          const exists = await fs.stat(path.join(skill.dir, rel)).then(() => true, () => false)
          if (!exists) missing.push(`${path.relative(skillsRoot, file)}: ${rel}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  test("backtick method-* names refer to a shipped skill or agent", async () => {
    const skillNames = new Set(skills.map((s) => s.name))
    const agentNames = new Set(
      (await fs.readdir(path.join(pluginRoot, "agents"))).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)),
    )
    const unknown: string[] = []
    for (const skill of skills) {
      for (const file of [path.join(skill.dir, "SKILL.md"), ...(await markdownFiles(skill.dir))]) {
        const content = await fs.readFile(file, "utf8")
        for (const [, name] of content.matchAll(/`(method-[a-z0-9-]*[a-z0-9])`/g)) {
          if (!skillNames.has(name) && !agentNames.has(name) && !EXTERNAL_NAMES.has(name)) {
            unknown.push(`${path.relative(skillsRoot, file)}: ${name}`)
          }
        }
      }
    }
    expect([...new Set(unknown)]).toEqual([])
  })
})
