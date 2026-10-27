import { describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import path from "path"
import { SCHEMA_ONLY, bash, expectAll, git, pluginRoot, project } from "./data-boundary-harness"

// Schema-only mode: the analysis reads data, so it runs through method-safe-run and the
// registry it writes counts as data. The gate is the agent's view of the registry.
const safeRun = path.join(pluginRoot, "scripts", "method-safe-run")
const scripts = path.join(pluginRoot, "skills", "method-numbers", "scripts")
const cli = path.join(scripts, "method_numbers.py")

function withFile(root: string, rel: string, content: string) {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  writeFileSync(path.join(root, rel), content)
}

describe("number registry in schema-only mode", () => {
  test("an analysis run through method-safe-run writes the registry and the gate still runs", () => {
    const root = project(SCHEMA_ONLY, { git: "real" })
    withFile(root, "analysis/sap-tables/02-outputs.csv", "Output File\nF1\n")
    withFile(root, "analysis/cohort.py", [
      "import csv, sys",
      `sys.path.insert(0, ${JSON.stringify(scripts)})`,
      "from method_numbers import register_number",
      "rows = list(csv.DictReader(open('data/cohort.csv')))",
      "register_number('cohort.n', 410 + len(rows), kind='n', sources=['data/cohort.csv'], sap_output='F1')",
      "",
    ].join("\n"))
    withFile(root, "manuscript/results.md", "We included {{num:cohort.n}} patients.\n")
    git(root, "add", "-A")
    git(root, "commit", "-qm", "synthetic")

    expectAll(root, "deny", [["Bash", bash("python3 analysis/cohort.py")]])
    expectAll(root, "allow", [["Bash", bash(`${safeRun} -- python3 analysis/cohort.py`)]])
    const run = Bun.spawnSync([safeRun, "--", "python3", "analysis/cohort.py"], { cwd: root })
    expect(run.exitCode).toBe(0)
    expect(existsSync(path.join(root, "analysis", "numbers", "registry.json"))).toBe(true)
    expect(readFileSync(path.join(root, ".methodsmith", "runs", "outputs.txt"), "utf8")).toContain("analysis/numbers/registry.json")

    expectAll(root, "deny", [["Bash", bash("cat analysis/numbers/registry.json")]])
    expectAll(root, "allow", [
      ["Bash", bash(`python3 ${cli} check manuscript/results.md`)],
      ["Bash", bash(`python3 ${cli} check --registry analysis/numbers/registry.json manuscript/results.md`)],
      ["Bash", bash(`python3 ${cli} render manuscript/results.md --out manuscript/_rendered/results.md`)],
    ])
    const gate = Bun.spawnSync(["python3", cli, "check", "manuscript/results.md"], { cwd: root })
    expect(gate.stdout.toString()).toContain("PASS")
    expect(gate.exitCode).toBe(0)
  })
})

describe("the gate is not a way around the boundary", () => {
  function registered() {
    const root = project(SCHEMA_ONLY, { git: "real" })
    withFile(root, "analysis/sap-tables/02-outputs.csv", "Output File\nF1\n")
    withFile(root, "analysis/cohort.py", [
      "import sys",
      `sys.path.insert(0, ${JSON.stringify(scripts)})`,
      "from method_numbers import register_number",
      "register_number('cohort.n', 412, kind='n', sources=['data/cohort.csv'], sap_output='F1')",
      "",
    ].join("\n"))
    git(root, "add", "-A")
    git(root, "commit", "-qm", "synthetic")
    expect(Bun.spawnSync(["python3", "analysis/cohort.py"], { cwd: root }).exitCode).toBe(0)
    return root
  }
  const gate = (root: string, ...args: string[]) => {
    const proc = Bun.spawnSync(["python3", cli, ...args], { cwd: root })
    return { code: proc.exitCode, out: proc.stdout.toString() + proc.stderr.toString() }
  }

  test("check refuses data paths and never prints their values", () => {
    const root = registered()
    withFile(root, "data/labs.md", "| id | value |\n|---|---|\n| FAKE0001 | 7.31 |\n")
    for (const target of ["data", "data/cohort.csv", "data/labs.md", "."]) {
      const result = gate(root, "check", target)
      expect({ target, code: result.code }).toEqual({ target, code: 1 })
      expect(result.out).not.toContain("1970")
      expect(result.out).not.toContain("7.31")
    }
    expect(gate(root, "check", "data/cohort.csv").out).toContain("data/cohort.csv: refused: data path")
  })

  test("table and run-output tokens are located, not printed", () => {
    const root = registered()
    withFile(root, "analysis/publication/tables/table1.csv", "Characteristic,Overall\nAge,64.2 (11.8)\n")
    const result = gate(root, "check", "analysis/publication/tables/table1.csv")
    expect(result.out).toContain("analysis/publication/tables/table1.csv:2: untraced number: column 2")
    expect(result.out).not.toContain("64.2")

    withFile(root, "output/summary.md", "Mean lactate was 3.87 in the run output.\n")
    withFile(root, ".methodsmith/runs/outputs.txt", "output/summary.md\n")
    const written = gate(root, "check", "output/summary.md")
    expect(written.out).toContain("output/summary.md:1: untraced number: value hidden (run output)")
    expect(written.out).not.toContain("3.87")
  })

  test("render refuses data paths and files without placeholders, writing nothing", () => {
    const root = registered()
    withFile(root, "manuscript/plain.md", "No placeholders here.\n")
    for (const [source, reason] of [["data/cohort.csv", "refused: data path"], ["manuscript/plain.md", "nothing to render"]]) {
      const result = gate(root, "render", source, "--out", "out/copy.txt")
      expect(result.code).toBe(1)
      expect(result.out).toContain(reason)
      expect(existsSync(path.join(root, "out", "copy.txt"))).toBe(false)
      expect(result.out).not.toContain("FAKE0001")
    }
  })
})
