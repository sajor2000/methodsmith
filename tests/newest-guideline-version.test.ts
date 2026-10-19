import { describe, expect, test } from "bun:test"
import { execFileSync } from "child_process"
import { promises as fs } from "fs"
import path from "path"
import { load } from "js-yaml"

// Policy: always use the newest version of a guideline. A superseded version is never
// loaded, routed, recommended, or cited as current; its old names resolve to the successor.
const referencesRoot = path.join(process.cwd(), "plugins", "methodsmith", "skills", "method-review", "references")

type Registry = {
  evidence: Record<string, { status: string; superseded_by?: string; supersedes?: string }>
  guidelines: Record<string, { file: string; aliases?: string[] }>
}

// Old version name -> registry entry it must resolve to.
const OLD_VERSION_ALIASES: Record<string, string> = {
  tripod: "TRIPOD+AI",
  "tripod-2015": "TRIPOD+AI",
  "quadas-2": "QUADAS-3",
  "spirit-2013": "SPIRIT",
  "consort-2010": "CONSORT",
  "prisma-2009": "PRISMA",
  "cheers-2013": "CHEERS",
  "arrive-1.0": "ARRIVE",
  "squire-1.0": "SQUIRE",
  "stard-2003": "STARD",
  probast: "PROBAST+AI",
  "probast-2019": "PROBAST+AI",
  amstar: "AMSTAR-2",
  "amstar-1": "AMSTAR-2",
  "rob-1": "ROB2",
  "cochrane-rob-1": "ROB2",
  robins: "ROBINS-I",
}

// Wording that names a superseded version. Allowed only on lines that state the supersession.
const SUPERSEDED_VERSION =
  /TRIPOD[ -]2015|QUADAS-2\b|SPIRIT[ -]2013|CONSORT[ -]2010|PRISMA[ -]2009|CHEERS[ -]2013|ARRIVE[ -]1\.0|SQUIRE[ -]1\.0|STARD[ -]200[38]|PROBAST-2019|AMSTAR 1\b|tripod-checklist\.md|quadas-2-checklist\.md/i
const SUPERSESSION_CONTEXT = /\b(replaces|replaced|supersedes|superseded by|formerly)\b/i

function findSupersededWording(files: Record<string, string>): string[] {
  const hits: string[] = []
  for (const [file, content] of Object.entries(files)) {
    content.split("\n").forEach((line, index) => {
      if (SUPERSEDED_VERSION.test(line) && !SUPERSESSION_CONTEXT.test(line)) hits.push(`${file}:${index + 1}: ${line.trim()}`)
    })
  }
  return hits
}

async function loadRegistry(): Promise<Registry> {
  return load(await fs.readFile(path.join(referencesRoot, "guideline-registry.yaml"), "utf8")) as Registry
}

describe("newest guideline version only", () => {
  test("no registry entry is superseded", async () => {
    const registry = await loadRegistry()
    for (const [name, evidence] of Object.entries(registry.evidence)) {
      expect(evidence.status, name).not.toMatch(/superseded/)
      expect(evidence.superseded_by, name).toBeUndefined()
    }
  })

  test("every old-version alias resolves to its newest successor", async () => {
    const registry = await loadRegistry()
    const owner = new Map<string, string>()
    for (const [name, entry] of Object.entries(registry.guidelines)) {
      for (const alias of entry.aliases ?? []) {
        expect(owner.has(alias), `duplicate alias ${alias}`).toBe(false)
        owner.set(alias, name)
      }
    }
    for (const [alias, successor] of Object.entries(OLD_VERSION_ALIASES)) {
      expect(owner.get(alias), alias).toBe(successor)
      expect(registry.evidence[successor].superseded_by, successor).toBeUndefined()
      expect(registry.evidence[successor].status, successor).toBe("verified")
    }
    expect(registry.guidelines.TRIPOD).toBeUndefined()
    expect(registry.guidelines["QUADAS-2"]).toBeUndefined()
    expect(registry.guidelines.PROBAST).toBeUndefined()
    expect(registry.evidence["TRIPOD+AI"].supersedes).toMatch(/TRIPOD 2015.*PMID 25560714/)
    expect(registry.evidence["QUADAS-3"].supersedes).toMatch(/QUADAS-2.*PMID 22007046/)
    expect(registry.evidence["PROBAST+AI"].supersedes).toMatch(/PROBAST-2019.*PMID 30596875/)
    expect(registry.evidence["AMSTAR-2"].supersedes).toMatch(/AMSTAR 1.*PMID 17302989/)
    expect(registry.evidence.ROB2.supersedes).toMatch(/version 1.*PMID 22008217/)
  })

  test("scan flags superseded wording outside a supersession context", () => {
    expect(
      findSupersededWording({
        a: "Use TRIPOD 2015 for regression models.\nApply QUADAS-2.\nSee references/tripod-checklist.md",
        b: "TRIPOD+AI supersedes TRIPOD 2015.\nQUADAS-3 replaced QUADAS-2 in 2026.\nCONSORT 2025 (formerly CONSORT 2010)",
      }),
    ).toHaveLength(3)
  })

  test("plugins/ never presents a superseded version as current", async () => {
    // CHANGELOG.md is release history, not guidance.
    const tracked = execFileSync("git", ["ls-files", "-z", "--", "plugins"], { encoding: "utf8" })
      .split("\0")
      .filter((file) => /\.(md|ya?ml|json|py|R|sh|txt)$/.test(file) && !file.endsWith("CHANGELOG.md"))
    const files: Record<string, string> = {}
    for (const file of tracked) files[file] = await fs.readFile(file, "utf8").catch(() => "")
    expect(findSupersededWording(files)).toEqual([])
  })
})
