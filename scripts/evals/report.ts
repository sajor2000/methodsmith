#!/usr/bin/env bun
import { createHash } from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { parseArgs } from "util"
import { EVALUATION_SCHEMA_VERSION, resolveEvaluationRunDir } from "./lib"

interface Gate {
  id: string
  description: string
  type: string
  weight: number
  hard_gate: boolean
  passed: boolean
}

interface ScoredRun {
  dir: string
  run_sha256: string
  case_id: string
  case_sha256: string
  prompt_sha256: string
  target_sha256: string
  target: { kind: "skill" | "agent"; name: string; source: string }
  runner: string
  model: string
  score: number
  max_score: number
  score_ratio: number
  threshold: number
  hard_gates_passed: boolean
  credential_scan_passed: boolean
  pass: boolean
  criteria: Gate[]
}

const usage = "Usage: bun run eval:report --run-dir <path> [--run-dir <path> ...] [--k <positive integer>]"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value
}

function parseRecord(contents: Buffer, label: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(contents.toString("utf8"))
  } catch {
    throw new Error(`${label} must contain valid JSON`)
  }
  return record(parsed, label)
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`)
  return value
}

function numeric(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number`)
  }
  return value
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be boolean`)
  return value
}

function hash(value: unknown, label: string): string {
  const result = text(value, label)
  if (!/^[a-f0-9]{64}$/.test(result)) throw new Error(`${label} must be a lowercase SHA-256 digest`)
  return result
}

function digest(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

async function readRunFile(dir: string, relativePath: string): Promise<Buffer> {
  const filePath = path.resolve(dir, relativePath)
  const relative = path.relative(dir, filePath)
  if (path.isAbsolute(relativePath) || !relative || relative === ".." ||
      relative.startsWith(`..${path.sep}`)) {
    throw new Error(`Run artifact escapes its allowed root: ${relativePath}`)
  }
  const canonical = await fs.realpath(filePath)
  const physicalRelative = path.relative(dir, canonical)
  if (!physicalRelative || physicalRelative === ".." || physicalRelative.startsWith(`..${path.sep}`)) {
    throw new Error(`Run artifact escapes its allowed root: ${relativePath}`)
  }
  if (!(await fs.stat(canonical)).isFile()) {
    throw new Error(`Run artifact must be a regular file: ${relativePath}`)
  }
  return fs.readFile(canonical)
}

async function readRun(dirArg: string): Promise<ScoredRun> {
  const dir = await resolveEvaluationRunDir(dirArg)
  const reportContents = await readRunFile(dir, "evaluation.json")
  const report = parseRecord(reportContents, "evaluation.json")
  const manifest = parseRecord(await readRunFile(dir, "manifest.json"), "manifest.json")
  if (report.schema_version !== EVALUATION_SCHEMA_VERSION ||
      manifest.schema_version !== EVALUATION_SCHEMA_VERSION) {
    throw new Error("Unsupported evaluation schema_version")
  }
  if (hash(manifest.evaluation_sha256, "evaluation_sha256") !== digest(reportContents)) {
    throw new Error("evaluation_sha256 does not match the published report")
  }
  for (const field of ["case_id", "target_sha256", "run_sha256", "output_sha256", "pass", "source_commit"]) {
    if (report[field] !== manifest[field]) {
      throw new Error(`manifest ${field} does not match evaluation.json`)
    }
  }
  const runContents = await readRunFile(dir, "run.json")
  if (hash(report.run_sha256, "run_sha256") !== digest(runContents)) {
    throw new Error("run_sha256 does not match run.json")
  }
  const metadata = parseRecord(runContents, "run.json")
  if (metadata.schema_version !== EVALUATION_SCHEMA_VERSION) {
    throw new Error("Unsupported run schema_version")
  }
  for (const field of ["case_id", "target_sha256", "runner", "model", "started_at", "completed_at", "output_path"]) {
    if (report[field] !== metadata[field]) {
      throw new Error(`run ${field} does not match evaluation.json`)
    }
  }
  for (const field of ["case_sha256", "prompt_sha256"]) {
    if (hash(manifest[field], field) !== metadata[field]) {
      throw new Error(`manifest ${field} does not match run.json`)
    }
  }
  const startedAt = Date.parse(text(metadata.started_at, "started_at"))
  const completedAt = Date.parse(text(metadata.completed_at, "completed_at"))
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt < startedAt) {
    throw new Error("Run completion timestamps are invalid")
  }
  const output = await readRunFile(dir, text(metadata.output_path, "output_path"))
  if (hash(report.output_sha256, "output_sha256") !== digest(output)) {
    throw new Error("output_sha256 does not match the primary response")
  }
  const target = record(report.target, "target")
  const kind = target.kind
  if (kind !== "skill" && kind !== "agent") throw new Error("target.kind must be skill or agent")
  if (!Array.isArray(report.criteria) || report.criteria.length === 0) {
    throw new Error("criteria must be a non-empty array")
  }
  const criteria = report.criteria.map((value): Gate => {
    const gate = record(value, "criterion")
    return {
      id: text(gate.id, "criterion.id"),
      description: text(gate.description, "criterion.description"),
      type: text(gate.type, "criterion.type"),
      weight: numeric(gate.weight, "criterion.weight"),
      hard_gate: boolean(gate.hard_gate, "criterion.hard_gate"),
      passed: boolean(gate.passed, "criterion.passed"),
    }
  })
  const criterionIds = new Set<string>()
  for (const gate of criteria) {
    if (criterionIds.has(gate.id)) throw new Error("Duplicate criterion ID")
    if (gate.weight <= 0) throw new Error("criterion.weight must be greater than zero")
    criterionIds.add(gate.id)
  }
  const run: ScoredRun = {
    dir,
    run_sha256: digest(runContents),
    case_id: text(report.case_id, "case_id"),
    case_sha256: hash(manifest.case_sha256, "case_sha256"),
    prompt_sha256: hash(manifest.prompt_sha256, "prompt_sha256"),
    target_sha256: hash(report.target_sha256, "target_sha256"),
    target: { kind, name: text(target.name, "target.name"), source: text(target.source, "target.source") },
    runner: text(report.runner, "runner"),
    model: text(report.model, "model"),
    score: numeric(report.score, "score"),
    max_score: numeric(report.max_score, "max_score"),
    score_ratio: numeric(report.score_ratio, "score_ratio"),
    threshold: numeric(report.threshold, "threshold"),
    hard_gates_passed: boolean(report.hard_gates_passed, "hard_gates_passed"),
    credential_scan_passed: boolean(report.credential_scan_passed, "credential_scan_passed"),
    pass: boolean(report.pass, "pass"),
    criteria,
  }
  const expectedScore = criteria.reduce((sum, gate) => sum + (gate.passed ? gate.weight : 0), 0)
  const expectedMax = criteria.reduce((sum, gate) => sum + gate.weight, 0)
  const expectedHardGates = criteria.filter((gate) => gate.hard_gate).every((gate) => gate.passed)
  if (run.threshold < 0.85 || run.threshold > 1) {
    throw new Error("threshold must be between 0.85 and 1")
  }
  if (run.score !== expectedScore || run.max_score !== expectedMax ||
      run.score_ratio !== expectedScore / expectedMax ||
      run.hard_gates_passed !== expectedHardGates ||
      run.pass !== (run.credential_scan_passed && expectedHardGates && run.score_ratio >= run.threshold)) {
    throw new Error("Inconsistent scoring summary: score or pass flags disagree with criterion outcomes")
  }
  return run
}

function passK(successes: number, runs: number, k: number): number | null {
  if (runs < k) return null
  if (successes < k) return 0
  let estimate = 1
  for (let i = 0; i < k; i += 1) estimate *= (successes - i) / (runs - i)
  return estimate
}

function scoringContract(run: ScoredRun): string {
  return JSON.stringify({
    target: run.target,
    threshold: run.threshold,
    criteria: run.criteria.map((gate) => ({
      id: gate.id, description: gate.description, type: gate.type,
      weight: gate.weight, hard_gate: gate.hard_gate,
    })),
  })
}

function summarize(runs: ScoredRun[], k: number) {
  const groups = new Map<string, ScoredRun[]>()
  for (const run of runs) {
    const key = JSON.stringify([
      run.case_id, run.case_sha256, run.prompt_sha256, run.target_sha256, run.runner, run.model,
    ])
    const group = groups.get(key) ?? []
    const existing = group[0]
    if (existing && scoringContract(existing) !== scoringContract(run)) {
      throw new Error(`Conflicting scoring contract for ${run.case_id}: ${existing.dir} and ${run.dir}`)
    }
    group.push(run)
    groups.set(key, group)
  }
  return {
    schema_version: EVALUATION_SCHEMA_VERSION,
    k,
    run_count: runs.length,
    groups: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => {
      group.sort((a, b) => a.dir.localeCompare(b.dir))
      const first = group[0]!
      const passed = group.filter((run) => run.pass).length
      const hardGatesPassed = group.filter((run) => run.hard_gates_passed).length
      return {
        case_id: first.case_id,
        case_sha256: first.case_sha256,
        prompt_sha256: first.prompt_sha256,
        target_sha256: first.target_sha256,
        target: first.target,
        runner: first.runner,
        model: first.model,
        runs: group.length,
        passed,
        pass_rate: passed / group.length,
        pass_k: passK(passed, group.length, k),
        hard_gates_passed: hardGatesPassed,
        hard_gate_pass_rate: hardGatesPassed / group.length,
        hard_gate_pass_k: passK(hardGatesPassed, group.length, k),
        credential_scan_passed: group.filter((run) => run.credential_scan_passed).length,
        mean_score: group.reduce((sum, run) => sum + run.score, 0) / group.length,
        max_score: first.max_score,
        mean_score_ratio: group.reduce((sum, run) => sum + run.score_ratio, 0) / group.length,
        threshold: first.threshold,
        gates: [...first.criteria].sort((a, b) => a.id.localeCompare(b.id)).map((gate) => {
          const successes = group.filter((run) => run.criteria.find((item) => item.id === gate.id)?.passed).length
          return {
            id: gate.id,
            hard_gate: gate.hard_gate,
            passed: successes,
            failed: group.length - successes,
            pass_rate: successes / group.length,
            pass_k: passK(successes, group.length, k),
          }
        }),
        run_dirs: group.map((run) => run.dir).sort(),
      }
    }),
    limitations: [
      "pass_k uses C(successes,k)/C(runs,k); it is null when fewer than k runs are available.",
      "The estimator assumes independence of repeat runs; hashes cannot establish independence.",
      "Small samples do not establish perfect reliability, even when every observed run passes.",
      "Only explicitly supplied scored runs are included; this is not a product-wide acceptance verdict.",
    ],
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "run-dir": { type: "string", multiple: true },
      k: { type: "string", default: "3" },
      help: { type: "boolean" },
    },
    strict: true,
    allowPositionals: false,
  })
  if (values.help) {
    console.log(usage)
    return
  }
  const dirs = values["run-dir"]
  const k = Number(values.k)
  if (!dirs?.length || dirs.some((dir) => !dir.trim()) ||
      !/^[1-9]\d*$/.test(values.k ?? "") || !Number.isSafeInteger(k)) {
    throw new Error(usage)
  }
  const runs: ScoredRun[] = []
  const seenPaths = new Set<string>()
  const seenRuns = new Set<string>()
  for (const dir of dirs) {
    try {
      const run = await readRun(dir)
      if (seenPaths.has(run.dir) || seenRuns.has(run.run_sha256)) {
        throw new Error("Duplicate run: repeated path, alias, or identical frozen run metadata")
      }
      seenPaths.add(run.dir)
      seenRuns.add(run.run_sha256)
      runs.push(run)
    } catch (error) {
      throw new Error(`${dir}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  console.log(JSON.stringify(summarize(runs, k), null, 2))
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(2)
}
