import { promises as fs } from "fs"
import path from "path"
import { describe, expect, test } from "bun:test"
import { load } from "js-yaml"

const referencesRoot = path.join(
  process.cwd(),
  "plugins",
  "methodsmith",
  "skills",
  "method-review",
  "references",
)

type Registry = {
  version: number
  verification: {
    verified_on: string
    evidence_statuses: string[]
    evidence_sources: string[]
  }
  evidence: Record<string, {
    title: string
    scope: string
    status: string
    role: string
    primary_citation: string | null
    doi: string | null
    pmid: number | null
    pmcid: string | null
    authoritative_url: string | null
    verification_date: string
    sources: string[]
    current_reference?: string
  }>
  guidelines: Record<string, { file: string; role: string }>
}

async function readReference(name: string): Promise<string> {
  return fs.readFile(path.join(referencesRoot, name), "utf8")
}

describe("reporting guideline registry", () => {
  test("keeps the 43-entry registry and checklist files in parity", async () => {
    const raw = await readReference("guideline-registry.yaml")
    const registry = load(raw) as Registry
    const files = (await fs.readdir(referencesRoot))
      .filter((file) => file.endsWith("-checklist.md"))
      .sort()

    expect(Object.keys(registry.guidelines)).toHaveLength(43)
    expect(Object.keys(registry.evidence).sort()).toEqual(Object.keys(registry.guidelines).sort())
    expect(Object.values(registry.guidelines).map((entry) => entry.file).sort()).toEqual(files)
  })

  test("requires evidence metadata for every entry", async () => {
    const registry = load(await readReference("guideline-registry.yaml")) as Registry
    const allowedStatuses = new Set(registry.verification.evidence_statuses)
    const allowedSources = new Set(registry.verification.evidence_sources)

    for (const [name, evidence] of Object.entries(registry.evidence)) {
      const guideline = registry.guidelines[name]
      expect(allowedStatuses.has(evidence.status), name).toBe(true)
      expect(evidence.title.length, `${name}:title`).toBeGreaterThan(0)
      expect(evidence.scope.length, `${name}:scope`).toBeGreaterThan(0)
      expect(evidence.role.length, name).toBeGreaterThan(0)
      expect(guideline.role, `${name}:role parity`).toBe(evidence.role)
      expect(new Date(evidence.verification_date).toISOString().slice(0, 10), `${name}:verification_date`).toBe(
        new Date(registry.verification.verified_on).toISOString().slice(0, 10),
      )
      expect(evidence.sources.length, name).toBeGreaterThan(0)
      for (const source of evidence.sources) expect(allowedSources.has(source), `${name}:${source}`).toBe(true)

      const hasIdentity = Boolean(evidence.doi || evidence.pmid || evidence.pmcid || evidence.authoritative_url)
      if (evidence.status === "verified") {
        expect(hasIdentity, `${name}:identity`).toBe(true)
        expect(evidence.primary_citation, `${name}:primary_citation`).not.toBeNull()
        expect(evidence.authoritative_url, `${name}:authoritative_url`).not.toBeNull()
      }
      if (evidence.status === "unverified") {
        expect(evidence.primary_citation, `${name}:unverified citation`).toBeNull()
        expect(evidence.authoritative_url, `${name}:unverified URL`).toBeNull()
      }
    }
  })

  test("requires a source or explicit uncertainty marker in every checklist file", async () => {
    const registry = load(await readReference("guideline-registry.yaml")) as Registry

    for (const [name, entry] of Object.entries(registry.guidelines)) {
      const content = await readReference(entry.file)
      const evidence = registry.evidence[name]
      const hasSource = /\*\*(?:Current |Legacy |Related |Background |Primary |Development protocol|Evidence status)/.test(content)
      expect(hasSource, name).toBe(true)
      if (evidence.status === "verified") {
        expect(content, name).toMatch(/PMID:|doi:|Evidence status:/i)
      }
    }
  })

  test("does not present known unresolved sources as authoritative", async () => {
    const registry = load(await readReference("guideline-registry.yaml")) as Registry
    const deal = await readReference(registry.guidelines.DEAL.file)
    const pdsqi = await readReference(registry.guidelines["PDSQI-9"].file)

    expect(registry.evidence.DEAL.status).toBe("verified")
    expect(registry.evidence.DEAL.doi).toBe("10.1056/AIp2401106")
    expect(registry.evidence["PDSQI-9"].status).toBe("verified")
    expect(deal).toContain("doi:10.1056/AIp2401106")
    expect(deal).toContain("Supplementary Table 2")
    expect(deal).not.toContain("UNVERIFIED")
    expect(pdsqi).toContain("PMID: 40323321")

    // Pin the official DEAL item IDs (Supplementary Table 2) so no item can be invented or dropped.
    const ids = (part: string) =>
      [...part.matchAll(/^\| (\d+\.\d+)\\?\*? \|/gm)].map((match) => match[1])
    const [partA, partB] = deal.split("## DEAL-B items").map((part) => part.split("## How to review")[0])
    const sections = (counts: number[]) => counts.flatMap((n, s) => Array.from({ length: n }, (_, i) => `${s + 1}.${i + 1}`))
    expect(ids(partA.split("## DEAL-A items")[1])).toEqual(sections([9, 5, 5, 5, 2, 5, 4, 4]))
    expect(ids(partB)).toEqual(sections([10, 4, 3, 3, 2]))
  })

  test("records current replacements and final publications", async () => {
    const registry = load(await readReference("guideline-registry.yaml")) as Registry
    const consort = await readReference(registry.guidelines.CONSORT.file)
    const prisma = await readReference(registry.guidelines.PRISMA.file)
    const stardAi = await readReference(registry.guidelines["STARD-AI"].file)
    const target = await readReference(registry.guidelines.TARGET.file)

    expect(registry.evidence.CONSORT.current_reference).toBe("CONSORT-2025")
    expect(registry.evidence.PRISMA.current_reference).toBe("PRISMA-2020")
    expect(consort).toContain("PMID: 40228833")
    expect(prisma).toContain("PMID: 33782057")
    expect(stardAi).toContain("PMID: 40954311")
    expect(target).toContain("PMID: 40903028")
  })

  test("follows the published TARGET, TRIPOD+AI, and SPIRIT 2025 statements", async () => {
    const registry = load(await readReference("guideline-registry.yaml")) as Registry & {
      guidelines: Record<string, { extension_for: string[]; primary_for: string[] }>
    }
    const target = await readReference("target-checklist.md")
    const tripodAi = await readReference("tripod-ai-checklist.md")
    const spiritAi = await readReference("spirit-ai-checklist.md")
    const routing = await readReference("guideline-routing.md")

    // TARGET: 21 items in six sections, standalone (Cashin et al. 2025, Table 2).
    const targetItems = [...target.matchAll(/^### TARGET (\d+)/gm)].map((match) => Number(match[1]))
    expect(targetItems).toEqual(Array.from({ length: 21 }, (_, i) => i + 1))
    expect(target).toContain("Transparent")
    expect(target).toContain("standalone")
    expect(target).not.toMatch(/Use alongside STROBE/)
    expect(routing).not.toMatch(/STROBE is always applied/)

    // TRIPOD+AI supersedes TRIPOD 2015 for every prediction model, regression or ML.
    // The TRIPOD 2015 checklist is not shipped; its names resolve to TRIPOD+AI (see newest-guideline-version.test.ts).
    expect(registry.guidelines.TRIPOD).toBeUndefined()
    expect(registry.guidelines["TRIPOD+AI"].primary_for).toEqual(["prediction-model"])
    expect(tripodAi).toContain("pmsampsize")

    // Protocol-stage and AI guidelines added from verified primary sources.
    for (const [name, pmid] of [["SPIRIT", 40294953], ["TRIPOD-LLM", 39779929], ["DECIDE-AI", 35585198], ["MI-CLAIM", 32908275], ["PRISMA-P", 25554246]] as const) {
      expect(registry.evidence[name].pmid, name).toBe(pmid)
      expect(await readReference(registry.guidelines[name].file), name).toContain(`PMID: ${pmid}`)
    }
    expect(spiritAi).toContain("SPIRIT 2025")
    expect(spiritAi).not.toMatch(/supplements SPIRIT 2013/)
  })

  test("routing is evidence-aware and attribute-specific", async () => {
    const routing = await fs.readFile(
      path.join(
        process.cwd(),
        "plugins",
        "methodsmith",
        "skills",
        "method-checklist",
        "references",
        "routing-map.md",
      ),
      "utf8",
    )

    expect(routing).toContain("primary = CONSORT")
    expect(routing).toContain("primary = TRIPOD+AI  # supersedes TRIPOD 2015")
    expect(routing).not.toContain("else TRIPOD")
    expect(routing).toContain("primary = CHART")
    expect(routing).toContain("do not add PDSQI-9 automatically")
    expect(routing).toContain("require explicit request before DEAL")
    expect(routing).not.toContain("primary = CHART\n    extension += PDSQI-9")

    const hints = await fs.readFile(
      path.join(
        process.cwd(),
        "plugins",
        "methodsmith",
        "skills",
        "method-question",
        "references",
        "checklist-routing-hints.md",
      ),
      "utf8",
    )
    expect(hints).toContain("Ask whether the study is chatbot health advice")
    expect(hints).not.toContain("CHART or DEAL")
  })
})
