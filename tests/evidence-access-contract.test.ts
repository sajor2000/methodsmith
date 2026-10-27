import { describe, expect, test } from "bun:test"
import { promises as fs } from "fs"
import path from "path"

// Scientific skills ground claims in literature through the connected PubMed and
// Paperclip MCP servers. Every such skill carries the same evidence-access block
// (skills cannot share files), names the connector's real tools, and uses one
// evidence-label vocabulary. Byte identity of that block is enforced by the prefix test
// in tests/duplicated-skill-files.test.ts; the checks here pin the content it must carry.

const skillsRoot = path.join(process.cwd(), "plugins", "methodsmith", "skills")

const EVIDENCE_SKILLS = [
  "method-pubmed",
  "method-lit-search",
  "method-evidence-map",
  "method-extract",
  "method-meta-analysis",
  "method-citations",
  "method-question",
  "method-grill",
  "method-ideate",
  "method-brainstorm",
  "method-prereg",
  "method-trial-design",
  "method-power",
  "method-checklist",
  "method-model-choice",
  "method-sap",
  "method-plan",
  "method-cohort",
  "method-phenotype",
  "method-omics-qc",
  "method-model-card",
  "method-review",
  "method-write",
  "method-presubmit",
]

// Two PubMed MCP servers are common: the documented default
// @cyanheads/pubmed-mcp-server (pubmed_* tools) and other connectors
// (search_articles, get_article_metadata, ...). Skills call by purpose and name both.

async function skillText(name: string): Promise<string> {
  const dir = path.join(skillsRoot, name)
  const parts: string[] = []
  async function walk(d: string) {
    for (const entry of await fs.readdir(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (/\.(md|yaml|yml|json)$/.test(entry.name)) parts.push(await fs.readFile(full, "utf8"))
    }
  }
  await walk(dir)
  return parts.join("\n")
}

describe("scientific skills share one evidence-access contract", () => {
  test("every evidence skill names the PubMed and Paperclip MCP tools, the fallbacks, and the rules", async () => {
    const problems: string[] = []
    for (const name of EVIDENCE_SKILLS) {
      const text = await skillText(name)
      const checks: Array<[string, RegExp]> = [
        ["Evidence access section", /##+\s*Evidence access/i],
        ["PubMed search tool (cyanheads)", /`pubmed_search_articles`/],
        ["PubMed search tool (connector)", /`search_articles`/],
        ["PubMed metadata tool (cyanheads)", /`pubmed_fetch_articles`/],
        ["PubMed metadata tool (connector)", /`get_article_metadata`/],
        ["full-text tool (cyanheads)", /`pubmed_fetch_fulltext`/],
        ["full-text tool (connector)", /`get_full_text_article`/],
        ["Paperclip MCP", /Paperclip MCP/],
        ["Paperclip search with source", /`search` with an explicit `source`/],
        ["method-pubmed fallback", /`method-pubmed`/],
        ["no-PHI rule", /no PHI, patient-level values, or small-cell counts in any query/],
        ["read-before-cite rule", /search hit is not evidence until the source is read/],
        ["label set", /`abstract`, `full_text`, `figure`, `trial`, `regulatory`, `documentation`/],
        ["Look up here line", /\*\*Look up here:\*\*/],
      ]
      for (const [label, pattern] of checks) {
        if (!pattern.test(text)) problems.push(`${name}: missing ${label}`)
      }
    }
    expect(problems).toEqual([])
  })

  test("skills that keep the generic block in references/evidence-access.md point to it and use fully qualified MCP names", async () => {
    const problems: string[] = []
    for (const name of ["method-sap", "method-prereg", "method-question", "method-cohort"]) {
      const skill = await fs.readFile(path.join(skillsRoot, name, "SKILL.md"), "utf8")
      const ref = await fs.readFile(path.join(skillsRoot, name, "references", "evidence-access.md"), "utf8")
      if (!skill.includes("`references/evidence-access.md`")) problems.push(`${name}: SKILL.md does not point to references/evidence-access.md`)
      if (/- \*\*PubMed MCP\*\*/.test(skill)) problems.push(`${name}: SKILL.md still inlines the generic PubMed bullet`)
      if (!ref.includes("`mcp__pubmed-mcp-server__pubmed_search_articles`")) problems.push(`${name}: reference lacks a fully qualified PubMed tool name`)
      if (!ref.includes("`mcp__paperclip__search`")) problems.push(`${name}: reference lacks the fully qualified Paperclip tool names`)
    }
    expect(problems).toEqual([])
  })

  test("skills do not carry dated verification stamps for citations", async () => {
    const offenders: string[] = []
    const stamp = /\bverified on (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 20\d\d\b/i
    for (const entry of await fs.readdir(skillsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const text = await skillText(entry.name)
      if (stamp.test(text)) offenders.push(entry.name)
    }
    expect(offenders).toEqual([])
  })
  // Skills whose generic block now lives in a skill-local references/evidence-access.md.
  // Add a skill here when its block is moved and its MCP names are fully qualified.
  const MOVED_SKILLS = [
    "method-model-choice", "method-model-card", "method-phenotype", "method-checklist",
    "method-presubmit", "method-extract", "method-omics-qc", "method-evidence-map",
    "method-write",
  ]

  test("moved evidence blocks stay skill-local with fully qualified MCP names", async () => {
    const problems: string[] = []
    for (const name of MOVED_SKILLS) {
      const entry = { name }
      const skillMd = await fs.readFile(path.join(skillsRoot, name, "SKILL.md"), "utf8")
      if (!skillMd.includes("`references/evidence-access.md`")) problems.push(`${name}: SKILL.md lacks the pointer`)
      const ref = await fs
        .readFile(path.join(skillsRoot, entry.name, "references", "evidence-access.md"), "utf8")
        .catch(() => "")
      if (!ref) problems.push(`${entry.name}: points to references/evidence-access.md but the file is missing`)
      else {
        if (!ref.includes("mcp__pubmed-mcp-server__pubmed_search_articles"))
          problems.push(`${entry.name}: evidence-access.md lacks the fully qualified PubMed tool name`)
        if (/mcp__PubMed__/.test(ref)) problems.push(`${entry.name}: evidence-access.md uses the wrong mcp__PubMed__ prefix`)
        if (/`method-pubmed` skill's bundled/.test(ref)) problems.push(`${entry.name}: reaches into method-pubmed's bundled script`)
      }
      if (!/\*\*Look up here:\*\*/.test(skillMd)) problems.push(`${entry.name}: SKILL.md lost its Look up here line`)
    }
    expect(problems).toEqual([])
  })
})
