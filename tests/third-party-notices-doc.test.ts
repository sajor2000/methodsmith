import { describe, expect, test } from "bun:test"
import { promises as fs, readFileSync } from "fs"
import path from "path"
import { JSON_SCHEMA, dump, load } from "js-yaml"
import { collectChecklistEntries, renderThirdPartyNotices } from "../scripts/docs/third-party-notices"

// THIRD-PARTY-NOTICES.md is generated from the guideline registry and the checklist
// licence headers. Regenerate with `bun run docs:third-party-notices`; never edit by hand.
const repoRoot = process.cwd()
const registryPath = path.join(
  repoRoot, "plugins", "methodsmith", "skills", "method-review", "references", "guideline-registry.yaml",
)
const referencesDir = path.join(repoRoot, "plugins", "methodsmith", "skills", "method-review", "references")
const docPath = path.join(repoRoot, "THIRD-PARTY-NOTICES.md")

function readerFromRepo(): (file: string) => string {
  return (file) => readFileSync(path.join(referencesDir, file), "utf8")
}

describe("third-party notices page", () => {
  test("THIRD-PARTY-NOTICES.md matches the registry and checklist headers", async () => {
    const registry = await fs.readFile(registryPath, "utf8")
    const doc = await fs.readFile(docPath, "utf8").catch(() => "")
    expect(doc).toBe(renderThirdPartyNotices(registry, readerFromRepo()))
  })

  test("lists every registry guideline exactly once, with its checklist file and DOI", async () => {
    const registry = await fs.readFile(registryPath, "utf8")
    const parsed = load(registry, { schema: JSON_SCHEMA }) as {
      evidence: Record<string, { doi: string }>
      guidelines: Record<string, { file: string }>
    }
    const rows = renderThirdPartyNotices(registry, readerFromRepo()).split("\n").filter((line) => /^\| \*\*/.test(line))
    expect(rows).toHaveLength(Object.keys(parsed.guidelines).length)
    for (const [name, entry] of Object.entries(parsed.guidelines)) {
      const row = rows.find((line) => line.startsWith(`| **${name}** |`))
      expect(row, name).toBeDefined()
      expect(row).toContain(entry.file)
      expect(row).toContain(`doi.org/${parsed.evidence[name].doi}`)
    }
  })

  test("every restricted or mixed-licence source appears in the restricted section", () => {
    const registry = readFileSync(registryPath, "utf8")
    const entries = collectChecklistEntries(registry, readerFromRepo())
    const doc = renderThirdPartyNotices(registry, readerFromRepo())
    const restrictedSection = doc.split("## Restricted or mixed-licence sources")[1]?.split("## Open-licence sources")[0] ?? ""
    for (const entry of entries.filter((candidate) => candidate.restricted)) {
      expect(restrictedSection, entry.key).toContain(`**${entry.key}**`)
    }
  })

  test("a registry change makes the committed page stale", async () => {
    const parsed = load(await fs.readFile(registryPath, "utf8"), { schema: JSON_SCHEMA }) as { verification: { verified_on: string } }
    parsed.verification.verified_on = "2099-01-01"
    expect(renderThirdPartyNotices(dump(parsed), readerFromRepo())).not.toBe(await fs.readFile(docPath, "utf8"))
  })

  test("fails closed on a checklist file that is missing", () => {
    const parsed = load(readFileSync(registryPath, "utf8"), { schema: JSON_SCHEMA }) as { guidelines: Record<string, { file: string }> }
    parsed.guidelines.CARE.file = "does-not-exist-checklist.md"
    expect(() => renderThirdPartyNotices(dump(parsed), readerFromRepo())).toThrow(/does-not-exist-checklist\.md/)
  })

  test("fails closed on a header that states neither verbatim nor paraphrase", () => {
    const registry = dump({
      verification: { verified_on: "2026-10-19" },
      evidence: { ONE: { title: "One", primary_citation: "One et al.", doi: "10.1/one", verification_date: "2026-10-19", status: "verified" } },
      guidelines: { ONE: { file: "one-checklist.md" } },
    })
    const reader = () => "# One\n\n**Source and licence:** The source is a source.\n"
    expect(() => renderThirdPartyNotices(registry, reader)).toThrow(/neither verbatim wording nor a faithful paraphrase/)
  })
})
