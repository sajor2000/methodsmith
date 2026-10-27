import { describe, expect, test } from "bun:test"
import { existsSync, readdirSync } from "fs"
import path from "path"
import { loadRenameMap, shippedPluginDir } from "../scripts/rebrand/mapping"

const repoRoot = path.join(import.meta.dir, "..")
const map = loadRenameMap()

function shippedNames() {
  const pluginDir = shippedPluginDir(repoRoot)
  const skills = readdirSync(path.join(pluginDir, "skills"))
  const agents = readdirSync(path.join(pluginDir, "agents"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.slice(0, -".md".length))
  return { skills, agents }
}

describe("rebrand mapping", () => {
  test("covers every shipped skill and agent, before or after the rename", () => {
    const { skills, agents } = shippedNames()
    const known = (table: Record<string, string>, name: string) =>
      name in table || Object.values(table).includes(name)
    expect(skills.filter((name) => !known(map.skills, name))).toEqual([])
    expect(agents.filter((name) => !known(map.agents, name))).toEqual([])
  })

  test("maps nothing that is neither shipped nor pending", () => {
    const { skills, agents } = shippedNames()
    const shipped = new Set([...skills, ...agents])
    const pending = new Set(map.pending)
    const stale = [...Object.entries(map.skills), ...Object.entries(map.agents)]
      .filter(([oldName, newName]) => !shipped.has(oldName) && !shipped.has(newName) && !pending.has(oldName))
      .map(([oldName]) => oldName)
    expect(stale).toEqual([])
  })

  test("is injective across skills, agents, and scripts", () => {
    const targets = map.allNewNames()
    expect(targets.length).toBe(new Set(targets).size)
  })

  test("every old name is ce-* and every new name is method-*", () => {
    for (const [oldName, newName] of map.allPairs()) {
      expect(oldName).toMatch(/^ce-[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(newName).toMatch(/^method-[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  test("new names never collide with old names or upstream Compound Engineering names", () => {
    const newNames = new Set(map.allNewNames())
    const oldNames = map.allPairs().map(([oldName]) => oldName)
    const upstream = [...map.upstream.skills, ...map.upstream.agents]
    expect(oldNames.filter((name) => newNames.has(name))).toEqual([])
    expect(upstream.filter((name) => newNames.has(name))).toEqual([])
  })

  test("applies the agreed shortenings", () => {
    expect(map.skills["ce-research-question"]).toBe("method-question")
    expect(map.skills["ce-effect-size"]).toBe("method-meta-analysis")
    expect(map.skills["ce-statistical-analysis-plan"]).toBe("method-sap")
    expect(map.skills["ce-code-review"]).toBe("method-review")
    expect(map.skills["ce-commit-push-pr"]).toBe("method-pr")
    expect(map.skills["ce-method-extract"]).toBe("method-extract")
    expect(map.skills["ce-plan"]).toBe("method-plan")
    expect(map.agents["ce-methods-reviewer"]).toBe("method-methods-reviewer")
  })
})

describe("rewriteText", () => {
  const { rewriteText } = require("../scripts/rebrand/rename") as typeof import("../scripts/rebrand/rename")

  test("renames commands, namespaced commands, and agent references", () => {
    expect(rewriteText("Run /ce-plan, then /ce-datascience:ce-code-review.")).toBe(
      "Run /method-plan, then /methodsmith:method-review.",
    )
    expect(rewriteText("Dispatch ce-learnings-researcher and $ce-statistical-analysis-plan")).toBe(
      "Dispatch method-learnings-researcher and $method-sap",
    )
  })

  test("renames plugin paths, display names, and env-style identifiers", () => {
    expect(rewriteText("plugins/ce-datascience/skills/ce-rstats/SKILL.md")).toBe(
      "plugins/methodsmith/skills/method-r/SKILL.md",
    )
    expect(rewriteText("CE DataScience plugin; marketplace ce-datascience-plugin; CE_DATASCIENCE_DESCRIPTION")).toBe(
      "Methodsmith plugin; marketplace methodsmith; METHODSMITH_DESCRIPTION",
    )
    expect(rewriteText("getCeDatascienceCounts() in /tmp/ce-datascience/evals")).toBe(
      "getMethodsmithCounts() in /tmp/methodsmith/evals",
    )
  })

  test("renames ids derived from a mapped name, but not upstream or legacy names", () => {
    expect(rewriteText("cases/ce-model-strategy-r-longitudinal/case.yaml")).toBe(
      "cases/method-model-choice-r-longitudinal/case.yaml",
    )
    expect(rewriteText("ce-plan-beta and ce-work-beta are upstream; ce-proof too")).toBe(
      "ce-plan-beta and ce-work-beta are upstream; ce-proof too",
    )
    expect(rewriteText("scripts/ce_numbers.py")).toBe("scripts/method_numbers.py")
  })

  test("moves the renamed GitHub repo slug and Pages URL to methodsmith", () => {
    expect(rewriteText("https://github.com/sajor2000/ce-datascience/tree/main/plugins/ce-datascience")).toBe(
      "https://github.com/sajor2000/methodsmith/tree/main/plugins/methodsmith",
    )
    expect(rewriteText("git clone https://github.com/sajor2000/ce-datascience.git")).toBe(
      "git clone https://github.com/sajor2000/methodsmith.git",
    )
    expect(rewriteText("claude plugin marketplace add sajor2000/ce-datascience")).toBe(
      "claude plugin marketplace add sajor2000/methodsmith",
    )
    expect(rewriteText("https://sajor2000.github.io/ce-datascience/docs/setup")).toBe(
      "https://sajor2000.github.io/methodsmith/docs/setup",
    )
  })

  test("keeps old release tags and renames the project state folder", () => {
    expect(rewriteText("tag ce-datascience-v4.1.0")).toBe("tag ce-datascience-v4.1.0")
    expect(rewriteText("read .ce-datascience/config.local.yaml")).toBe("read .methodsmith/config.local.yaml")
  })

  test("leaves lines and regions marked rebrand:keep untouched", () => {
    const text = [
      "/ce-plan",
      "legacy /ce-plan // rebrand:keep",
      "// rebrand:keep-start",
      "\"ce-work\",",
      "// rebrand:keep-end",
      "/ce-work",
    ].join("\n")
    expect(rewriteText(text).split("\n")).toEqual([
      "/method-plan",
      "legacy /ce-plan // rebrand:keep",
      "// rebrand:keep-start",
      "\"ce-work\",",
      "// rebrand:keep-end",
      "/method-work",
    ])
  })

  test("rewrites the generic prefix in prose, globs, and code", () => {
    expect(rewriteText("use the bare `ce-<agent-name>` form; the `ce-` prefix; skills/ce-*/SKILL.md")).toBe(
      "use the bare `method-<agent-name>` form; the `method-` prefix; skills/method-*/SKILL.md",
    )
    expect(rewriteText('name.startsWith("ce-") ? `ce-${rest}` : /^ce-/')).toBe(
      'name.startsWith("method-") ? `method-${rest}` : /^method-/',
    )
    expect(rewriteText("/(ce-[a-z][a-z0-9-]*-reviewer)/")).toBe("/(method-[a-z][a-z0-9-]*-reviewer)/")
  })

  test("renames listed extra ids and leaves listed upstream names", () => {
    expect(rewriteText("cases/ce-pre-submission-section-boundaries")).toBe("cases/method-presubmit-section-boundaries")
    expect(rewriteText("artifact_contract: ce-unified-plan/v1")).toBe("artifact_contract: ce-unified-plan/v1")
  })

  test("history files keep their content but their names follow the rename, so links stay valid", () => {
    const { rewritePath, isExcluded } = require("../scripts/rebrand/rename") as typeof import("../scripts/rebrand/rename")
    const dated = "docs/plans/2026-04-27-001-feat-ce-datascience-fork-plan.md"
    expect(isExcluded(dated)).toBe(true)
    expect(rewritePath(dated)).toBe("docs/plans/2026-04-27-001-feat-methodsmith-fork-plan.md")
    expect(rewriteText(`see ${dated}`)).toBe("see docs/plans/2026-04-27-001-feat-methodsmith-fork-plan.md")
  })

  test("is a no-op on already rebranded text", () => {
    const once = rewriteText("Run /ce-datascience:ce-plan from plugins/ce-datascience (CE DataScience).")
    expect(rewriteText(once)).toBe(once)
  })
})

describe("generated command tables", () => {
  const { fillGeneratedBlocks } = require("../scripts/rebrand/rename") as typeof import("../scripts/rebrand/rename")

  test("fills a renamed-commands block with every old -> new skill pair from the mapping", () => {
    const text = [
      "# Migration",
      "<!-- rebrand:keep-start renamed-commands -->",
      "stale",
      "<!-- rebrand:keep-end -->",
      "after",
    ].join("\n")
    const filled = fillGeneratedBlocks(text)
    expect(filled).toContain("| `/ce-statistical-analysis-plan` | `/method-sap` |")
    expect(filled).toContain("| `/ce-plan` | `/method-plan` |")
    expect(filled).not.toContain("stale")
    expect(filled.split("\n").at(-1)).toBe("after")
    const rows = filled.split("\n").filter((line) => line.startsWith("| `/ce-"))
    expect(rows.length).toBe(Object.keys(map.skills).length)
    expect(fillGeneratedBlocks(filled)).toBe(filled)
  })
})

describe("applyRename on a copy of this checkout", () => {
  const { applyRename, residueReport, rewritePath } = require("../scripts/rebrand/rename") as typeof import("../scripts/rebrand/rename")
  const { cpSync, mkdtempSync, rmSync, mkdirSync } = require("fs") as typeof import("fs")
  const { execFileSync } = require("child_process") as typeof import("child_process")
  const os = require("os") as typeof import("os")

  const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: repoRoot, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
  const copy = mkdtempSync(path.join(os.tmpdir(), "methodsmith-rebrand-"))
  for (const file of files) {
    try {
      mkdirSync(path.dirname(path.join(copy, file)), { recursive: true })
      cpSync(path.join(repoRoot, file), path.join(copy, file))
    } catch {
      // deleted-but-tracked files have nothing to copy
    }
  }
  const first = applyRename(copy, files)
  const renamedFiles = files.map((file) => first.moved.find(([from]) => from === file)?.[1] ?? file)

  test("leaves no unaccounted ce- reference outside the allowlist", () => {
    expect(residueReport(copy, renamedFiles)).toEqual({})
  }, 60000)

  test("keeps a copy at each old path listed in keepOldCopies", () => {
    for (const oldPath of map.keepOldCopies) {
      expect(existsSync(path.join(copy, oldPath))).toBe(true)
      expect(existsSync(path.join(copy, rewritePath(oldPath)))).toBe(true)
    }
  })

  test("eval fixture hashes still match the rewritten fixtures", async () => {
    const { validateAllCases } = await import("../scripts/evals/lib")
    const result = await validateAllCases(copy)
    expect(result.errors.filter((error: string) => error.includes("hash mismatch"))).toEqual([])
  }, 60000)

  test("a second run changes nothing", () => {
    const second = applyRename(copy, renamedFiles)
    rmSync(copy, { recursive: true, force: true })
    expect(second).toEqual({ moved: [], rewritten: [] })
  }, 60000)
})
