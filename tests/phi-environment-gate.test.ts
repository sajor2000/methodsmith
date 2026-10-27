import { describe, expect, test } from "bun:test"
import { readdir, readFile } from "fs/promises"
import path from "path"

const pluginRoot = path.join(process.cwd(), "plugins", "methodsmith")
const skills = path.join(pluginRoot, "skills")
const read = (rel: string) => readFile(path.join(skills, rel), "utf8")
const readAgent = (name: string) => readFile(path.join(pluginRoot, "agents", name), "utf8")
const OPTIONS = ["`Approved endpoint: full access`", "`Not approved or unsure: schema-only`", "`No sensitive data: public or synthetic`"]

// The one gating clause. Every gating skill and agent carries it word for word.
export const GATE_CLAUSE =
  "**Sensitive-data boundary.** Resolve `phi_environment.mode` in `.methodsmith/config.local.yaml` (worktree, then main checkout; legacy `compliant: " +
  "true` = `approved`, `compliant: false` = `schema-only`, `sensitive_data: false` = `no-sensitive-data`; any schema-only signal wins; unreadable = " +
  "`schema-only`). `approved` or `no-sensitive-data`: proceed silently and never mention the boundary again. `schema-only`: headings, types, counts, and " +
  "aggregates only; never open, print, or paste data values; run data-reading scripts as `method-safe-run -- <command>` (path in the guard's deny " +
  "message); save results as aggregate tables (counts under 11 suppressed) in `output/` or a `phi_environment.aggregate_dirs` entry. Unset, interactive: " +
  "ask once with the blocking question tool (else a numbered list) offering `Approved endpoint: full access`, `Not approved or unsure: schema-only`, and " +
  "`No sensitive data: public or synthetic`; save the answer as `phi_environment.mode` there once `git check-ignore -q .methodsmith/config.local.yaml` " +
  "passes (else first add `.methodsmith/*.local.yaml` to `.gitignore`) so the guard hook sees it. Unset, headless: schema-only."

// The one MCP egress sentence. Every literature skill carries it word for word.
export const MCP_EGRESS =
  "**MCP egress (every mode):** send PubMed, Paperclip, and other MCP or web tools only search terms, MeSH terms, PMIDs, DOIs, and titles, " +
  "never data values, identifiers, row text, or data files; an endpoint approval does not cover third-party services."

const GATED = [
  "method-work/references/phi-environment.md", "method-setup/SKILL.md", "method-clif/references/clif-rules.md", "method-grill/SKILL.md",
  "method-write/SKILL.md", "method-data-qa/SKILL.md", "method-verify/SKILL.md", "method-table1/SKILL.md",
  "method-cohort/SKILL.md", "method-review/SKILL.md", "method-sas-stata/SKILL.md", "method-phenotype/SKILL.md",
]
const LITERATURE = [
  "method-pubmed/SKILL.md", "method-evidence-map/SKILL.md", "method-lit-search/SKILL.md",
  "method-citations/SKILL.md", "method-extract/SKILL.md",
]

const askAndSave = (text: string) => {
  const match = text.match(/<!-- ask-and-save:start -->([\s\S]*?)<!-- ask-and-save:end -->/)
  if (!match) throw new Error("ask-and-save block not found")
  return match[1]
}

async function allPluginMarkdown() {
  const out: Array<[string, string]> = []
  for (const dir of [skills, path.join(pluginRoot, "agents")]) {
    for (const entry of await readdir(dir, { recursive: true })) {
      if (!String(entry).endsWith(".md")) continue
      out.push([String(entry), await readFile(path.join(dir, String(entry)), "utf8")])
    }
  }
  return out
}

describe("sensitive-data boundary: one clause, asked once, then silent", () => {
  test("every gating skill and agent carries the canonical clause word for word", async () => {
    for (const rel of GATED) {
      const content = await read(rel)
      expect({ rel, hasClause: content.includes(GATE_CLAUSE) }).toEqual({ rel, hasClause: true })
    }
    expect((await readAgent("method-phi-leak-reviewer.md")).includes(GATE_CLAUSE)).toBe(true)
  })

  test("method-setup and method-work share an identical ask-and-save block that writes the new key", async () => {
    const [setupRef, workRef] = await Promise.all([
      read("method-setup/references/sensitive-data-boundary.md"), read("method-work/references/phi-environment.md"),
    ])
    const block = askAndSave(setupRef)
    expect(askAndSave(workRef)).toBe(block)
    for (const option of OPTIONS) expect(block).toContain(option)
    for (const value of ["`mode: approved`", "`mode: schema-only`", "`mode: no-sensitive-data`"]) expect(block).toContain(value)
    expect(block).toContain("git check-ignore -q .methodsmith/config.local.yaml")
    expect(block).toContain("Confirming that approval (BAA or institutional sign-off) is your responsibility.")
    for (const phrase of ["The agent CAN see", "The agent CANNOT", "look at example rows", "join mismatches", "free text", "counts under 11 suppressed"]) {
      expect(block).toContain(phrase)
    }
    expect(block).toContain("In headless or non-interactive runs, do not ask or save.")
  })

  test("method-work applies its gate reference before opening data", async () => {
    const work = await read("method-work/SKILL.md")
    expect(work).toContain("before opening data files or patient-level outputs, read `references/phi-environment.md` and apply its gate")
  })

  test("method-setup asks before any data inspection", async () => {
    const setup = await read("method-setup/SKILL.md")
    const gate = setup.indexOf("### Phase 0a: Sensitive-data boundary (before any data inspection)")
    expect(gate).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(setup.indexOf("Run the `method-language-detect` skill"))
    expect(gate).toBeLessThan(setup.indexOf("### Data domain and connection signals"))
    expect(setup).toContain("`references/sensitive-data-boundary.md`")
  })

  test("no post-approval restrictions, reminders, divergent unset branches, or no-op prose remain", async () => {
    const banned = [
      "Regardless of authorization, never reproduce identifiers",
      "Do not reproduce PHI in responses",
      "unless the project explicitly permits access and PHI handling is clear",
      "into the report, the chat, or error messages",
      "Are both this data environment and the active model endpoint compliant",
      "This is a repository rule, not an endpoint rule",
      "A committed answer would let another machine inherit",
      "no saved answer (schema-only)",
      "phi_environment.compliant: true`",
      "State it in one line the first time it changes what the agent does",
    ]
    for (const [rel, content] of await allPluginMarkdown()) {
      for (const phrase of banned) expect({ rel, phrase, found: content.includes(phrase) }).toEqual({ rel, phrase, found: false })
    }
  })

  test("the schema helper is invoked with a python probe and a manual fallback", async () => {
    for (const rel of ["method-setup/references/sensitive-data-boundary.md", "method-work/references/phi-environment.md"]) {
      const content = await read(rel)
      expect(content).toContain('"$SKILL_DIR/scripts/schema-peek.py"')
      expect(content).toContain("`python3`, then `python`, then `py`")
    }
  })

  test("the config template documents the three-valued key and the legacy keys", async () => {
    const template = await read("method-setup/references/config-template.yaml")
    expect(template).toContain("#   mode: approved | schema-only | no-sensitive-data")
    expect(template).toContain("compliant: true -> approved")
    expect(template).toContain("compliant: false -> schema-only")
    expect(template).toContain("sensitive_data: false -> no-sensitive-data")
  })
})

describe("MCP egress: literature tools never receive sensitive data", () => {
  test("every literature skill carries the canonical MCP egress sentence", async () => {
    for (const rel of LITERATURE) {
      const content = await read(rel)
      expect({ rel, hasSentence: content.includes(MCP_EGRESS) }).toEqual({ rel, hasSentence: true })
    }
  })

  test("manuscript-citations searches with paper-level claim terms, never manuscript text", async () => {
    const content = await read("method-citations/SKILL.md")
    expect(content).not.toContain("`search` the explicit `pmc` source for the claim or source set")
    expect(content).toContain("paper-level claim terms")
  })
})

describe("closed limits: safe runner, identifier index, and aggregate reads in skills and docs", () => {
  const scripts = path.join(pluginRoot, "scripts")
  test("method-setup and method-data-qa run a skill-local method-identifier-index copy identical to the plugin's", async () => {
    const canonical = await readFile(path.join(scripts, "method-identifier-index"), "utf8")
    for (const skill of ["method-setup", "method-data-qa"]) {
      expect(await read(`${skill}/scripts/method-identifier-index`)).toBe(canonical)
    }
    const setup = await read("method-setup/references/sensitive-data-boundary.md")
    expect(setup).toContain('"$SKILL_DIR/scripts/method-identifier-index"')
    expect(setup).toContain("whenever `data_root` is set, in every mode")
    expect(await read("method-setup/SKILL.md")).toContain("build or refresh the identifier index")
    const qa = await read("method-data-qa/SKILL.md")
    expect(qa).toContain('"$SKILL_DIR/scripts/method-identifier-index"')
    expect(qa).toContain("refresh the identifier index")
  })

  test("method-work, method-verify, and method-r route data-touching scripts through method-safe-run in schema-only mode", async () => {
    for (const rel of ["method-work/references/phi-environment.md", "method-verify/SKILL.md", "method-r/SKILL.md"]) {
      const content = await read(rel)
      expect({ rel, safeRun: content.includes("method-safe-run -- ") }).toEqual({ rel, safeRun: true })
    }
    const work = await read("method-work/references/phi-environment.md")
    expect(work).not.toContain("the guard treats `.csv` outputs as data files")
    expect(work).toContain("aggregate check")
  })

  const section = async (file: string) => {
    const text = await readFile(path.join(process.cwd(), file), "utf8")
    const start = text.search(/^#+ Sensitive-data boundary$/m)
    const end = text.indexOf("**Changing the answer.**", start)
    if (start < 0 || end < 0) throw new Error(`no boundary section in ${file}`)
    return text.slice(start, end).replace(/^#+ /gm, "")
  }
  test("the three setup docs carry the same boundary section describing the closed limits", async () => {
    const [root, plugin, setup] = await Promise.all(["README.md", "plugins/methodsmith/README.md", "docs/setup.md"].map(section))
    expect(plugin).toBe(root)
    expect(setup).toBe(root)
    const prose = root.replace(/\s+/g, " ")
    for (const phrase of ["method-safe-run", "identifier index", "salted hashes", "gitignored", "phi_environment.aggregate_dirs",
      "small-cell rule", "eutils.ncbi.nlm.nih.gov", "[masked header]", "free-text notes", "heuristic", "Claude Code only"]) {
      expect({ phrase, present: prose.includes(phrase) }).toEqual({ phrase, present: true })
    }
    for (const stale of ["a bare name is not detected", "Aggregate tables saved as `.csv` count as data files",
      "shell calls to NCBI that are not uploads are not scanned", "column names that are themselves sensitive"]) {
      expect({ stale, present: prose.includes(stale) }).toEqual({ stale, present: false })
    }
  })
})
