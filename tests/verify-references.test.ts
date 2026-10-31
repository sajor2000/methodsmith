import { afterAll, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import os from "os"
import path from "path"

// Synthetic references only. Seams: the verify_references.py CLI subcommands
// (extract, classify, audit). Lookups are injected as a cache or a lookups
// file, so no test reaches the network.

const script = path.join(
  process.cwd(),
  "plugins",
  "methodsmith",
  "skills",
  "method-citations",
  "scripts",
  "verify_references.py",
)
const roots: string[] = []

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function workspace(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "refgate-"))
  roots.push(root)
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, content)
  }
  return root
}

function run(cwd: string, args: string[]) {
  const proc = Bun.spawnSync(["python3", script, ...args], { cwd })
  return { code: proc.exitCode, out: proc.stdout.toString(), err: proc.stderr.toString() }
}

type Entry = {
  index: number
  identifier: string | null
  title: string
  doi: string
  pmid: string | null
  fields_trustworthy: boolean
}
type Summary = {
  verdict: string
  n_total: number
  n_ok: number
  n_mismatch: number
  n_unverified: number
  n_fabricated: number
}
type AuditRecord = { index: number; identifier: string | null; verdict: string; reasons: string[]; identity_status?: string }
type Report = { summary: Summary; records: AuditRecord[] }

function extract(cwd: string, file: string): Entry[] {
  const result = run(cwd, ["extract", file])
  expect(result.code).toBe(0)
  return JSON.parse(result.out) as Entry[]
}

function classify(cwd: string, entries: string, lookups: string): Report {
  const result = run(cwd, ["classify", "--entries", entries, "--lookups", lookups])
  expect(result.code).toBe(0)
  return JSON.parse(result.out) as Report
}

// A DOI containing parentheses and a bracketed numbering scheme: both were
// parsed wrongly before the fix.
const NUMBERED = `[1] Smith J. A cohort study of sepsis mortality. Lancet. 2019. doi:10.1016/S0140-6736(19)30001-1
[2] Jones B. A paper registered nowhere at all. NEJM. 2021. doi:10.1056/NEJMx99999999
`

const STRUCTURED = `@article{smith2019,
  title = {A cohort study of sepsis mortality},
  author = {Smith, John},
  journal = {Lancet},
  year = {2019},
  doi = {10.1016/S0140-6736(19)30001-1}
}
@article{ghost2021,
  title = {A paper registered nowhere at all},
  author = {Jones, B},
  journal = {NEJM},
  year = {2021},
  doi = {10.1056/NEJMx99999999}
}
`

describe("reference integrity gate", () => {
  test("extract keeps a DOI intact through parentheses and trailing punctuation", () => {
    const root = workspace({ "refs.txt": NUMBERED })
    const entries = extract(root, "refs.txt")
    // The parenthesis is part of the DOI; the sentence period after it is not.
    expect(entries[0]!.doi).toBe("10.1016/s0140-6736(19)30001-1")
    expect(entries[1]!.doi).toBe("10.1056/nejmx99999999")
  })

  test("extract splits a bracketed numbered bibliography into separate entries", () => {
    const root = workspace({ "refs.txt": NUMBERED })
    const entries = extract(root, "refs.txt")
    expect(entries).toHaveLength(2)
    expect(entries[0]!.title).toBe("A cohort study of sepsis mortality")
    expect(entries[1]!.title).toBe("A paper registered nowhere at all")
  })

  test("free-text entries are marked untrusted so guessed fields are not compared", () => {
    const root = workspace({ "refs.txt": NUMBERED })
    expect(extract(root, "refs.txt").every((entry) => entry.fields_trustworthy === false)).toBe(true)
    const bib = workspace({ "refs.bib": STRUCTURED })
    expect(extract(bib, "refs.bib").every((entry) => entry.fields_trustworthy === true)).toBe(true)
  })

  test("a DOI registered nowhere is FABRICATED, a resolved DOI is OK", () => {
    const root = workspace({
      "refs.bib": STRUCTURED,
      "lookups.json": JSON.stringify({
        "doi:10.1016/s0140-6736(19)30001-1": {
          found: true,
          title: "A cohort study of sepsis mortality",
          year: "2019",
          author: "Smith",
          source: "CrossRef",
        },
        "doi:10.1056/nejmx99999999": { found: false, source: "CrossRef and OpenAlex" },
      }),
    })
    writeFileSync(path.join(root, "entries.json"), JSON.stringify(extract(root, "refs.bib")))
    const report = classify(root, "entries.json", "lookups.json")
    expect(report.records[0]!.verdict).toBe("OK")
    expect(report.records[1]!.verdict).toBe("FABRICATED")
    expect(report.summary.verdict).toBe("FABRICATED")
  })

  test("a resolved identifier with a different title, year or author is MISMATCH", () => {
    const root = workspace({
      "refs.bib": `@article{wrong,
  title = {A completely different paper about something else},
  author = {Nguyen, Bao},
  journal = {JAMA},
  year = {1998},
  doi = {10.1016/S0140-6736(19)30001-1}
}
`,
      "lookups.json": JSON.stringify({
        "doi:10.1016/s0140-6736(19)30001-1": {
          found: true,
          title: "A cohort study of sepsis mortality",
          year: "2019",
          author: "Smith",
          source: "CrossRef",
        },
      }),
    })
    writeFileSync(path.join(root, "entries.json"), JSON.stringify(extract(root, "refs.bib")))
    const report = classify(root, "entries.json", "lookups.json")
    const record = report.records[0]!
    expect(record.verdict).toBe("MISMATCH")
    // Zero title overlap must be reported, not skipped as a falsy value.
    expect(record.reasons.join(" ")).toContain("title overlap 0.00")
    expect(record.reasons.join(" ")).toContain("entry says 1998")
    expect(record.reasons.join(" ")).toContain("Nguyen")
  })

  test("an entry with no identifier and no lookup is UNVERIFIED, never OK", () => {
    const root = workspace({ "refs.txt": "An entry with no identifier at all.\n" })
    writeFileSync(path.join(root, "entries.json"), JSON.stringify(extract(root, "refs.txt")))
    writeFileSync(path.join(root, "lookups.json"), "{}")
    const report = classify(root, "entries.json", "lookups.json")
    expect(report.records[0]!.verdict).toBe("UNVERIFIED")
    expect(report.summary.verdict).toBe("INCOMPLETE")
  })

  test("audit --offline classifies from the cache without network access", () => {
    const root = workspace({
      "refs.bib": STRUCTURED,
      "cache.json": JSON.stringify({
        "doi:10.1016/s0140-6736(19)30001-1": {
          found: true,
          title: "A cohort study of sepsis mortality",
          year: "2019",
          author: "Smith",
          source: "CrossRef",
        },
        "doi:10.1056/nejmx99999999": { found: false, source: "CrossRef and OpenAlex" },
      }),
    })
    const result = run(root, ["audit", "refs.bib", "--offline", "--lookup-cache", "cache.json", "--out", "qc/audit.json"])
    // A fabricated reference fails the gate even without --strict.
    expect(result.code).toBe(2)
    const report = JSON.parse(readFileSync(path.join(root, "qc", "audit.json"), "utf8")) as Report
    expect(report.summary.n_fabricated).toBe(1)
    expect(report.summary.n_ok).toBe(1)
  })

  test("audit exits 0 when every entry resolves, and 1 on an unreadable input", () => {
    const root = workspace({
      "refs.bib": STRUCTURED.replace(/@article\{ghost2021[\s\S]*?\n\}\n/, ""),
      "cache.json": JSON.stringify({
        "doi:10.1016/s0140-6736(19)30001-1": {
          found: true,
          title: "A cohort study of sepsis mortality",
          year: "2019",
          author: "Smith",
          source: "CrossRef",
        },
      }),
    })
    const clean = run(root, ["audit", "refs.bib", "--offline", "--lookup-cache", "cache.json", "--out", "qc/a.json"])
    expect(clean.code).toBe(0)
    const missing = run(root, ["audit", "absent.bib"])
    expect(missing.code).toBe(1)
    expect(missing.err).toContain("no such file")
  })

  test("the audit report records the resolved title for a human to compare", () => {
    const root = workspace({
      "refs.bib": STRUCTURED,
      "cache.json": JSON.stringify({
        "doi:10.1016/s0140-6736(19)30001-1": {
          found: true,
          title: "A cohort study of sepsis mortality",
          year: "2019",
          author: "Smith",
          source: "CrossRef",
        },
        "doi:10.1056/nejmx99999999": { found: false, source: "CrossRef and OpenAlex" },
      }),
    })
    run(root, ["audit", "refs.bib", "--offline", "--lookup-cache", "cache.json", "--out", "qc/a.json"])
    const report = JSON.parse(readFileSync(path.join(root, "qc", "a.json"), "utf8")) as {
      records: Array<{ resolved_title?: string; lookup_source?: string }>
    }
    expect(report.records[0]!.resolved_title).toBe("A cohort study of sepsis mortality")
    expect(report.records[0]!.lookup_source).toBe("CrossRef")
  })
})

test("reference identity is separate from claim support, including legacy not-found verdicts", () => {
  const cwd = workspace({
    "entries.json": JSON.stringify([{ index: 1, identifier: "doi:10.0000/synthetic", title: "Synthetic", fields_trustworthy: true }]),
    "lookups.json": JSON.stringify({ "doi:10.0000/synthetic": { found: false, source: "fixture" } }),
  })
  const result = run(cwd, ["classify", "--entries", "entries.json", "--lookups", "lookups.json"])
  const record = JSON.parse(result.out).records[0]
  expect(record.identity_status).toBe("not-found")
  expect(record.claim_support).toBe("unverified")
  expect(record.verdict).toBe("FABRICATED") // compatibility only; not proof of fabrication
})

test("a free-text OK verdict keeps identity unverified until a human compares the record", () => {
  const root = workspace({
    "entries.json": JSON.stringify([{ index: 1, identifier: "doi:10.0000/synthetic", title: "Guessed From Prose", fields_trustworthy: false }]),
    "lookups.json": JSON.stringify({
      "doi:10.0000/synthetic": { found: true, title: "A Different Registered Paper", year: "2001", author: "Doe", source: "fixture" },
    }),
  })
  const report = classify(root, "entries.json", "lookups.json")
  expect(report.records[0]!.verdict).toBe("OK") // legacy wire label stays for pipeline compatibility
  expect(report.records[0]!.identity_status).toBe("unverified")
})

test("audit keeps free-text identity unverified even when the identifier resolves", () => {
  const root = workspace({
    "refs.txt": "[1] Smith J. A cohort study of sepsis mortality. Lancet. 2019. doi:10.1016/S0140-6736(19)30001-1\n",
    "cache.json": JSON.stringify({
      "doi:10.1016/s0140-6736(19)30001-1": { found: true, title: "An entirely different registered paper", year: "1971", author: "Nobody", source: "CrossRef" },
    }),
  })
  const result = run(root, ["audit", "refs.txt", "--offline", "--lookup-cache", "cache.json", "--out", "qc/a.json"])
  expect(result.code).toBe(0)
  const report = JSON.parse(readFileSync(path.join(root, "qc", "a.json"), "utf8")) as { records: Array<{ verdict: string; identity_status: string }> }
  expect(report.records[0]!.verdict).toBe("OK")
  expect(report.records[0]!.identity_status).toBe("unverified")
})
