// Shared harness for the data-boundary guard tests: synthetic projects, hook runners, verdict helpers.
import { afterAll, expect } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "fs"
import os from "os"
import path from "path"

export const pluginRoot = path.join(process.cwd(), "plugins", "methodsmith")
export const guard = path.join(pluginRoot, "hooks", "data-boundary-guard.py")
export const helper = path.join(pluginRoot, "scripts", "schema-peek.py")
export const fixture = path.join(process.cwd(), "tests", "fixtures", "data-boundary", "synthetic-cohort.csv")
export const tempRoots: string[] = []

afterAll(() => {
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true })
})

export const SYNTH_ROWS = "record_id,patient_name,dob\nFAKE0001,Zed Testperson,1970-01-01\nFAKE0002,Yan Testperson,1971-02-02\n"
export const NOTEBOOK_WITH_OUTPUT = JSON.stringify({
  cells: [{ cell_type: "code", source: ["df.head()"], outputs: [{ output_type: "execute_result", data: { "text/plain": ["FAKE0001 Zed Testperson"] } }] }],
  metadata: {}, nbformat: 4, nbformat_minor: 5,
})
export const NOTEBOOK_CLEAN = JSON.stringify({
  cells: [{ cell_type: "code", source: ["df.head()"], outputs: [], execution_count: null }],
  metadata: {}, nbformat: 4, nbformat_minor: 5,
})

export function tempDir(prefix = "method-boundary-") {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix))
  tempRoots.push(dir)
  return dir
}

// A synthetic methodsmith project: data under ./data, code under ./src.
export function project(config?: string, opts: { ceDir?: boolean; git?: "dir" | "real" } = {}) {
  const root = tempDir()
  if (opts.git === "real") git(root, "init", "-q")
  else mkdirSync(path.join(root, ".git"))
  if (opts.ceDir !== false) mkdirSync(path.join(root, ".methodsmith"))
  if (config !== undefined) writeFileSync(path.join(root, ".methodsmith", "config.local.yaml"), config)
  mkdirSync(path.join(root, "data"))
  mkdirSync(path.join(root, "src"))
  mkdirSync(path.join(root, "notebooks"))
  writeFileSync(path.join(root, "data", "cohort.csv"), SYNTH_ROWS)
  writeFileSync(path.join(root, "data", "extract.dat"), SYNTH_ROWS)
  writeFileSync(path.join(root, "data", "notes.txt"), "FAKE0001 synthetic note\n")
  writeFileSync(path.join(root, "src", "load.py"), "import pandas as pd\ndf = pd.read_csv('data/cohort.csv')\n")
  writeFileSync(path.join(root, "notebooks", "with_out.ipynb"), NOTEBOOK_WITH_OUTPUT)
  writeFileSync(path.join(root, "notebooks", "clean.ipynb"), NOTEBOOK_CLEAN)
  return root
}

export function git(cwd: string, ...args: string[]) {
  const proc = Bun.spawnSync(["git", "-c", "user.email=t@example.invalid", "-c", "user.name=t", ...args], { cwd })
  if (proc.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${proc.stderr.toString()}`)
  return proc.stdout.toString().trim()
}

// End-to-end: run the hook as Claude Code does, one payload on stdin.
export function runGuard(cwd: string, tool: string, toolInput: unknown) {
  const proc = Bun.spawnSync(["python3", guard], {
    stdin: Buffer.from(JSON.stringify({ cwd, tool_name: tool, tool_input: toolInput })),
  })
  const stdout = proc.stdout.toString()
  const parsed = stdout ? JSON.parse(stdout).hookSpecificOutput : undefined
  return {
    exitCode: proc.exitCode,
    stdout,
    stderr: proc.stderr.toString(),
    decision: parsed?.permissionDecision ?? "allow",
    reason: (parsed?.permissionDecisionReason ?? "") as string,
  }
}

// In-process unit tests of resolve_mode(context) and classify(call, mode), batched in one interpreter.
export const DRIVER = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("guard", sys.argv[1])
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
out = []
for case in json.load(sys.stdin):
    mode = g.resolve_mode(case["call"])
    if case["fn"] == "resolve":
        out.append({"mode": mode["mode"], "why": mode.get("why")})
    else:
        out.append(g.classify(case["call"], mode))
print(json.dumps(out))
`

export type Call = { cwd: string; tool_name: string; tool_input: Record<string, unknown> }
export function py(cases: Array<{ fn: "resolve" | "classify"; call: Call }>) {
  const proc = Bun.spawnSync(["python3", "-c", DRIVER, guard], { stdin: Buffer.from(JSON.stringify(cases)) })
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString())
  return JSON.parse(proc.stdout.toString()) as Array<any>
}
export const call = (cwd: string, tool: string, input: Record<string, unknown>): Call => ({ cwd, tool_name: tool, tool_input: input })
export const resolve = (cwd: string, tool = "Bash", input: Record<string, unknown> = { command: "true" }) =>
  py([{ fn: "resolve", call: call(cwd, tool, input) }])[0]
export function verdicts(cwd: string, calls: Array<[string, Record<string, unknown>]>) {
  const results = py(calls.map(([tool, input]) => ({ fn: "classify" as const, call: call(cwd, tool, input) })))
  return calls.map(([tool, input], i) => ({ tool, input, decision: results[i] ? "deny" : "allow", kind: results[i]?.kind }))
}
export function expectAll(cwd: string, decision: "allow" | "deny", calls: Array<[string, Record<string, unknown>]>) {
  for (const v of verdicts(cwd, calls)) expect({ ...v, kind: undefined }).toEqual({ tool: v.tool, input: v.input, decision, kind: undefined })
}

export const SCHEMA_ONLY = "phi_environment:\n  mode: schema-only\n  confirmed_on: 2026-10-15\nstack_profile:\n  data_root: ./data/\n"
export const APPROVED = "phi_environment:\n  mode: approved\n  confirmed_on: 2026-10-15\nstack_profile:\n  data_root: data\n"
export const bash = (command: string) => ({ command })
