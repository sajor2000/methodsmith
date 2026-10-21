#!/usr/bin/env bun
// Generates THIRD-PARTY-NOTICES.md from the reporting-guideline registry and the
// source-and-licence headers of each bundled checklist. MedSci-audit gap #10.
// Usage: bun run docs:third-party-notices [--check]
import { promises as fs, readFileSync } from "fs"
import path from "path"
import { JSON_SCHEMA, load } from "js-yaml"

type Evidence = {
  title: string
  primary_citation: string
  doi: string
  verification_date: string
  status: string
  note?: string
}

type Registry = {
  verification: { verified_on: string }
  evidence: Record<string, Evidence>
  guidelines: Record<string, { file: string; aliases?: string[] }>
}

const REPO_BLOB = "https://github.com/sajor2000/methodsmith/blob/main"
const REGISTRY_PATH = "plugins/methodsmith/skills/method-review/references/guideline-registry.yaml"
const REFERENCES_PATH = path.posix.dirname(REGISTRY_PATH)
const DOC_RELATIVE = "THIRD-PARTY-NOTICES.md"

// The bolded source-and-licence header every checklist file must carry (repo rule in AGENTS.md).
const LICENCE_HEADER = /^\*\*(?:Source and licen[cs]e|Licen[cs]e)(?: and wording)?\s*:?\*\*\s*/i

// Paraphrase markers win only when no strong verbatim phrase applies; "adapted" is the
// fail-closed bucket — generation refuses a checklist whose header states neither.
const PARAPHRASE = /\bparaphras|\bnot a verbatim\b|\bnot verbatim\b|\bshortened\b|\bcondens/i
const STRONG_VERBATIM = /\b(?:quoted|reproduced|taken|copied|transcribed)\b[^.;()]*\bverbatim\b/i
const WEAK_VERBATIM = /\bverbatim\b|\breproduced\b|\bquoted\b|\btranscribed\b|\bcopied\b/i

function classifyUse(statement: string, file: string): "verbatim" | "paraphrase" {
  if (STRONG_VERBATIM.test(statement)) return "verbatim"
  if (PARAPHRASE.test(statement)) return "paraphrase"
  if (WEAK_VERBATIM.test(statement)) return "verbatim"
  throw new Error(`Checklist ${file} states neither verbatim wording nor a faithful paraphrase; make the header explicit`)
}

type LicenceSummary = "CC0 / public domain" | "CC BY-NC-ND (non-commercial, no derivatives)" | "CC BY-NC (non-commercial)" | "CC BY 4.0" | "CC BY" | "All rights reserved / no open licence" | "Non-commercial reuse only" | "See checklist header"

function licenceSummaries(statement: string): LicenceSummary[] {
  const found: LicenceSummary[] = []
  const add = (summary: LicenceSummary) => {
    if (!found.includes(summary)) found.push(summary)
  }
  if (/\bpublic domain\b|\bCC0\b/i.test(statement)) add("CC0 / public domain")
  if (/CC\s*BY[-\s]?NC[-\s]?ND/i.test(statement)) add("CC BY-NC-ND (non-commercial, no derivatives)")
  else if (/CC\s*BY[-\s]?NC/i.test(statement)) add("CC BY-NC (non-commercial)")
  if (/CC[-\s]BY[-\s ]?4\.0/i.test(statement)) add("CC BY 4.0")
  else if (/CC[-\s]BY(?![-\s]?NC)(?![-\s]?ND)/i.test(statement)) add("CC BY")
  if (/all rights reserved|not openly licen[cs]ed|no open licen[cs]e|not under an open licen[cs]e|exclusive rights|copyright/i.test(statement)) add("All rights reserved / no open licence")
  if (/non-commercial/i.test(statement)) add("Non-commercial reuse only")
  return found.length ? found : ["See checklist header"]
}

function isRestricted(summaries: LicenceSummary[]): boolean {
  return summaries.some((summary) =>
    summary === "CC BY-NC (non-commercial)" ||
    summary === "CC BY-NC-ND (non-commercial, no derivatives)" ||
    summary === "All rights reserved / no open licence" ||
    summary === "Non-commercial reuse only" ||
    summary === "See checklist header",
  )
}

export type ChecklistEntry = {
  key: string
  file: string
  title: string
  citation: string
  doi: string
  statement: string
  summaries: LicenceSummary[]
  verbatim: boolean
  restricted: boolean
}

export function collectChecklistEntries(registryText: string, readChecklist: (file: string) => string): ChecklistEntry[] {
  const registry = load(registryText, { schema: JSON_SCHEMA }) as Registry
  const entries: ChecklistEntry[] = []
  for (const key of Object.keys(registry.guidelines).sort()) {
    const evidence = registry.evidence[key]
    if (!evidence) throw new Error(`Guidelines entry ${key} has no evidence record`)
    const { file } = registry.guidelines[key]
    const text = readChecklist(file)
    const headerLine = text.split("\n").find((line) => LICENCE_HEADER.test(line))
    if (!headerLine) throw new Error(`Checklist ${file} carries no source-and-licence header (repo rule: every checklist states source and licence)`)
    const statement = headerLine.replace(LICENCE_HEADER, "").trim()
    const summaries = licenceSummaries(statement)
    entries.push({
      key,
      file,
      title: evidence.title,
      citation: evidence.primary_citation,
      doi: evidence.doi,
      statement,
      summaries,
      verbatim: classifyUse(statement, file) === "verbatim",
      restricted: isRestricted(summaries),
    })
  }
  return entries
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim()

export function renderThirdPartyNotices(registryText: string, readChecklist: (file: string) => string): string {
  const registry = load(registryText, { schema: JSON_SCHEMA }) as Registry
  const entries = collectChecklistEntries(registryText, readChecklist)
  const verbatimCount = entries.filter((entry) => entry.verbatim).length
  const paraphraseCount = entries.length - verbatimCount
  const restricted = entries.filter((entry) => entry.restricted)
  const open = entries.filter((entry) => !entry.restricted)

  const lines = [
    "# Third-Party Notices",
    "",
    `<!-- Generated by scripts/docs/third-party-notices.ts from guideline-registry.yaml and the checklist licence headers. Do not edit by hand; run \`bun run docs:third-party-notices\`. -->`,
    "",
    `Methodsmith is MIT-licensed. The reporting-guideline checklists bundled under \`plugins/methodsmith/skills/method-review/references/\` adapt third-party guideline material, each under its own terms. This file records the licence status and how each checklist's text is used, derived from the [guideline registry](${REPO_BLOB}/${REGISTRY_PATH}) and each checklist's source-and-licence header; registry verification date ${registry.verification.verified_on}.`,
    "",
    "No guideline source documents (PDFs, Word files, supplements) are redistributed. Where the effective licence of quoted text is open (CC BY, CC0, public domain), item text is quoted verbatim with attribution; where a source is restricted or unlicensed, item text is a faithful paraphrase. A mixed case (open-licence checklist inside a restricted article) follows its checklist header, quoted in full below. The \"What to look for\" review cues in each checklist are methodsmith's own and are not guideline content. For verbatim wording of any restricted source, consult the official publication cited in each checklist and in `docs/guideline-sources.md`.",
    "",
    `Coverage: ${entries.length} bundled checklists — ${verbatimCount} quote item text verbatim under open terms, ${paraphraseCount} are faithful paraphrases or adaptations.`,
    "",
    "## Summary",
    "",
    "| Guideline | Checklist | Source (DOI) | Licence | Item text |",
    "|---|---|---|---|---|",
  ]
  for (const entry of entries) {
    lines.push(`| **${entry.key}** | [${entry.file}](${REPO_BLOB}/${REFERENCES_PATH}/${entry.file}) | [${entry.doi}](https://doi.org/${entry.doi}) | ${entry.summaries.join(" + ")} | ${entry.verbatim ? "Quoted verbatim with attribution" : "Faithful paraphrase or adaptation"} |`)
  }

  lines.push(
    "",
    "## Restricted or mixed-licence sources",
    "",
    "Item text from these sources is paraphrased unless the entry's own statement says the quoted checklist carries an open licence (mixed case).",
  )
  if (restricted.length) {
    for (const entry of restricted) {
      lines.push(`- **${entry.key}** (${entry.title}; doi:${entry.doi}) — ${entry.summaries.join(" + ")}.`, `  > ${cell(entry.statement)}`)
    }
  } else {
    lines.push("None.")
  }

  lines.push(
    "",
    "## Open-licence sources quoted verbatim",
    "",
  )
  if (open.length) {
    for (const entry of open) {
      lines.push(`- **${entry.key}** (${entry.title}; doi:${entry.doi}) — ${entry.summaries.join(" + ")}.`)
    }
  } else {
    lines.push("None.")
  }

  return `${lines.join("\n")}\n`
}

if (import.meta.main) {
  const repoRoot = path.resolve(import.meta.dir, "..", "..")
  const referencesDir = path.join(repoRoot, REFERENCES_PATH)
  const docPath = path.join(repoRoot, DOC_RELATIVE)
  const registryText = await fs.readFile(path.join(repoRoot, REGISTRY_PATH), "utf8")
  const readChecklist = (file: string): string => readFileSync(path.join(referencesDir, file), "utf8")
  const rendered = renderThirdPartyNotices(registryText, readChecklist)
  if (process.argv.includes("--check")) {
    const current = await fs.readFile(docPath, "utf8").catch(() => "")
    if (current !== rendered) {
      console.error(`${DOC_RELATIVE} is out of date. Run: bun run docs:third-party-notices`)
      process.exit(1)
    }
    console.log(`${DOC_RELATIVE} is up to date.`)
  } else {
    await fs.writeFile(docPath, rendered)
    console.log(`Wrote ${DOC_RELATIVE}`)
  }
}
