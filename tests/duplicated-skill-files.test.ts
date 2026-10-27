import { describe, expect, test } from "bun:test"
import { createHash } from "crypto"
import { readdirSync, readFileSync, statSync } from "fs"
import path from "path"

// Skills cannot share files (AGENTS.md), so shared helpers are copied into each skill.
// A copy that drifts silently changes behavior in one skill only. Scripts with the same
// name anywhere in the plugin must be byte-identical; references are often legitimately
// different under the same name, so only the families declared below are pinned.

const pluginRoot = path.join(process.cwd(), "plugins", "methodsmith")
const skillsRoot = path.join(pluginRoot, "skills")

/** Reference files copied verbatim between skills. Add a family when you copy a reference. */
const SHARED_REFERENCES: Record<string, string[]> = {
  "html-rendering.md": ["method-brainstorm", "method-plan"],
  "html-visuals.md": ["method-brainstorm", "method-plan"],
  "markdown-rendering.md": ["method-brainstorm", "method-plan"],
}

function files(dir: string): string[] {
  let out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (name === "__pycache__" || name === ".DS_Store") continue
    const full = path.join(dir, name)
    out = statSync(full).isDirectory() ? out.concat(files(full)) : out.concat(full)
  }
  return out
}

/**
 * Skills that carry references/evidence-access.md (same list as EVIDENCE_SKILLS in
 * tests/evidence-access-contract.test.ts). Each copy starts with the method-checklist block
 * byte for byte; skill-local sections may follow it.
 */
const EVIDENCE_SKILLS = [
  "method-pubmed", "method-lit-search", "method-evidence-map", "method-extract",
  "method-meta-analysis", "method-citations", "method-question", "method-grill",
  "method-ideate", "method-brainstorm", "method-prereg", "method-trial-design",
  "method-power", "method-checklist", "method-model-choice", "method-sap",
  "method-plan", "method-cohort", "method-phenotype", "method-omics-qc",
  "method-model-card", "method-review", "method-write", "method-presubmit",
]
/** method-pubmed owns the E-utilities fallback, so only its fallback line may differ. */
const OWN_FALLBACK = new Set(["method-pubmed"])
const FALLBACK_LINE = "- **Fallbacks:**"

const digest = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex")
const rel = (file: string) => path.relative(process.cwd(), file)

describe("duplicated skill files stay identical", () => {
  test("every script that exists in more than one place is byte-identical", () => {
    const scripts = [
      ...files(path.join(pluginRoot, "scripts")),
      ...readdirSync(skillsRoot).flatMap((skill) => files(path.join(skillsRoot, skill, "scripts"))),
    ]
    const byName = new Map<string, string[]>()
    for (const file of scripts) byName.set(path.basename(file), [...(byName.get(path.basename(file)) ?? []), file])
    const drifted: string[] = []
    for (const [name, copies] of byName) {
      if (copies.length < 2) continue
      if (new Set(copies.map(digest)).size > 1) drifted.push(`${name}: ${copies.map(rel).join(", ")}`)
    }
    expect(drifted, "copy the canonical script over the drifted copies").toEqual([])
  })

  test("every evidence-access.md starts with the canonical method-checklist block", () => {
    const evidenceFile = (skill: string) => path.join(skillsRoot, skill, "references", "evidence-access.md")
    const canonical = readFileSync(evidenceFile("method-checklist"), "utf8").split("\n")
    const drifted: string[] = []
    for (const skill of EVIDENCE_SKILLS) {
      const lines = readFileSync(evidenceFile(skill), "utf8").split("\n")
      // The canonical block ends with a newline, so its last split element is "" and must
      // match the start of the next line (empty when nothing follows, any text otherwise).
      const head = canonical.slice(0, -1)
      const bad = head.findIndex((line, i) =>
        OWN_FALLBACK.has(skill) && line.startsWith(FALLBACK_LINE)
          ? !lines[i]?.startsWith(FALLBACK_LINE)
          : lines[i] !== line,
      )
      if (bad !== -1) drifted.push(`${skill}: line ${bad + 1} differs from the canonical block`)
      else if (lines.length > head.length && lines[head.length] !== "")
        drifted.push(`${skill}: no blank line between the canonical block and local sections`)
    }
    expect(drifted, "copy the method-checklist block to the top of the drifted copies").toEqual([])
  })

  for (const [name, skills] of Object.entries(SHARED_REFERENCES)) {
    test(`${name} is identical across ${skills.join(", ")}`, () => {
      const copies = skills.map((skill) => path.join(skillsRoot, skill, "references", name))
      expect(new Set(copies.map(digest)).size).toBe(1)
    })
  }
})
