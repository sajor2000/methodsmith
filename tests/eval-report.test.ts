import { afterEach, describe, expect, test } from "bun:test"
import { createHash, randomUUID } from "crypto"
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import type { EvaluationManifest, EvaluationReport, EvaluationRunMetadata } from "../scripts/evals/lib"

const repoRoot = path.resolve(import.meta.dir, "..")
const reportScript = path.join(repoRoot, "scripts/evals/report.ts")
const runRoot = "/tmp/methodsmith/behavioral-evals"
const tempRoots: string[] = []
const digest = (value: string) => createHash("sha256").update(value).digest("hex")
let sequence = 0

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function makeRun(options: {
  passed?: boolean
  model?: string
  runner?: string
  caseDigest?: string
  promptDigest?: string
  targetDigest?: string
} = {}) {
  const dir = path.join(runRoot, `report-test-${randomUUID()}`)
  tempRoots.push(dir)
  await mkdir(dir, { recursive: true })
  sequence += 1
  const metadata: EvaluationRunMetadata = {
    schema_version: "1.0",
    case_id: "sample-case",
    case_sha256: options.caseDigest ?? digest("case v1"),
    prompt_sha256: options.promptDigest ?? digest("prompt v1"),
    target_sha256: options.targetDigest ?? digest("target v1"),
    runner: options.runner ?? "skill-creator",
    model: options.model ?? "test-model",
    started_at: new Date(Date.UTC(2026, 0, 1, 0, 0, sequence * 2)).toISOString(),
    completed_at: new Date(Date.UTC(2026, 0, 1, 0, 0, sequence * 2 + 1)).toISOString(),
    output_path: "response.md",
  }
  const runContents = `${JSON.stringify(metadata, null, 2)}\n`
  const output = "Synthetic response; no real observations.\n"
  const passed = options.passed ?? true
  const report: EvaluationReport = {
    schema_version: "1.0",
    case_id: metadata.case_id,
    target: { kind: "skill", name: "sample", source: "plugins/methodsmith/skills/sample/SKILL.md" },
    source_commit: null,
    worktree_dirty: null,
    target_sha256: metadata.target_sha256,
    runner: metadata.runner,
    model: metadata.model,
    started_at: metadata.started_at,
    completed_at: metadata.completed_at,
    output_path: metadata.output_path,
    run_sha256: digest(runContents),
    output_sha256: digest(output),
    credential_scan_passed: true,
    score: passed ? 2 : 1,
    max_score: 2,
    score_ratio: passed ? 1 : 0.5,
    threshold: 0.85,
    hard_gates_passed: passed,
    pass: passed,
    criteria: [
      { id: "required-output", description: "Required output is present", type: "text_contains",
        weight: 1, hard_gate: true, passed, evidence: "Evidence must not be copied into the report." },
      { id: "format", description: "Format is valid", type: "text_contains",
        weight: 1, hard_gate: false, passed: true, evidence: "Synthetic evidence." },
    ],
    limitations: ["Synthetic test only."],
  }
  const evaluationContents = `${JSON.stringify(report, null, 2)}\n`
  const manifest: EvaluationManifest = {
    schema_version: "1.0",
    case_id: metadata.case_id,
    pass: passed,
    source_commit: null,
    case_sha256: metadata.case_sha256,
    prompt_sha256: metadata.prompt_sha256,
    target_sha256: metadata.target_sha256,
    run_sha256: report.run_sha256,
    output_sha256: report.output_sha256,
    evaluation_sha256: digest(evaluationContents),
    fixture_sha256: {},
    scored_artifact_sha256: { "response.md": digest(output) },
    scored_artifact_state: { "response.md": { exists: true, type: "file", sha256: digest(output) } },
  }
  await Promise.all([
    writeFile(path.join(dir, "run.json"), runContents),
    writeFile(path.join(dir, "response.md"), output),
    writeFile(path.join(dir, "evaluation.json"), evaluationContents),
    writeFile(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
  ])
  return { dir, report, manifest, metadata }
}

async function invoke(dirs: string[], extra: string[] = []) {
  const proc = Bun.spawn([
    process.execPath, reportScript, ...dirs.flatMap((dir) => ["--run-dir", dir]), ...extra,
  ], { cwd: repoRoot, stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

async function publishReport(run: Awaited<ReturnType<typeof makeRun>>, report: unknown) {
  const contents = JSON.stringify(report)
  await writeFile(path.join(run.dir, "evaluation.json"), contents)
  await writeFile(path.join(run.dir, "manifest.json"), JSON.stringify({
    ...run.manifest,
    pass: typeof report === "object" && report !== null && "pass" in report ? report.pass : true,
    evaluation_sha256: digest(contents),
  }))
}

describe("eval:report command", () => {
  test("reports pass^k, mean scores, and per-gate reliability across repeated runs", async () => {
    const runs = await Promise.all([
      makeRun(), makeRun(), makeRun(), makeRun({ passed: false }),
    ])

    const result = await invoke(runs.map((run) => run.dir))

    expect(result.stderr).toBe("")
    expect(result.exitCode).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.k).toBe(3)
    expect(summary.run_count).toBe(4)
    expect(summary.groups).toHaveLength(1)
    expect(summary.groups[0]).toMatchObject({
      case_id: "sample-case",
      runner: "skill-creator",
      model: "test-model",
      runs: 4,
      passed: 3,
      pass_rate: 0.75,
      pass_k: 0.25,
      hard_gates_passed: 3,
      hard_gate_pass_rate: 0.75,
      hard_gate_pass_k: 0.25,
      mean_score: 1.75,
      max_score: 2,
      mean_score_ratio: 0.875,
      gates: [
        { id: "format", hard_gate: false, passed: 4, failed: 0, pass_rate: 1, pass_k: 1 },
        { id: "required-output", hard_gate: true, passed: 3, failed: 1, pass_rate: 0.75, pass_k: 0.25 },
      ],
    })
    expect(result.stdout).not.toContain("Evidence must not be copied")
    expect(result.stdout).not.toContain("Synthetic response")
    expect(summary.limitations.join(" ")).toContain("independence")
  })

  test("fails closed on a tampered published report rather than dropping the bad run", async () => {
    const good = await makeRun()
    const bad = await makeRun({ passed: false })
    await writeFile(path.join(bad.dir, "evaluation.json"), JSON.stringify({ ...bad.report, pass: true }))

    const result = await invoke([good.dir, bad.dir])

    expect(result.exitCode).toBe(2)
    expect(result.stdout).toBe("")
    expect(result.stderr).toContain("evaluation_sha256")
    expect(result.stderr).toContain(bad.dir)
  })

  test("checks manifest bindings against run metadata and primary response bytes", async () => {
    for (const variant of ["run", "response", "manifest", "model"]) {
      const run = await makeRun()
      if (variant === "run") {
        await writeFile(path.join(run.dir, "run.json"), JSON.stringify({ ...run.metadata, model: "changed" }))
      } else if (variant === "response") {
        await writeFile(path.join(run.dir, "response.md"), "Changed after scoring.\n")
      } else if (variant === "manifest") {
        await writeFile(path.join(run.dir, "manifest.json"),
          JSON.stringify({ ...run.manifest, target_sha256: digest("wrong target") }))
      } else {
        const changed = { ...run.report, model: "different-model" }
        const contents = JSON.stringify(changed)
        await writeFile(path.join(run.dir, "evaluation.json"), contents)
        await writeFile(path.join(run.dir, "manifest.json"),
          JSON.stringify({ ...run.manifest, evaluation_sha256: digest(contents) }))
      }

      const result = await invoke([run.dir])

      expect(result.exitCode).toBe(2)
      expect(result.stdout).toBe("")
      expect(result.stderr).toContain(variant === "model" ? "model" :
        variant === "run" ? "run_sha256" : variant === "response" ? "output_sha256" : "target_sha256")
    }
  })

  test("rejects repeated paths, symlink aliases, and copied runs instead of inflating reliability", async () => {
    const run = await makeRun()
    const alias = `${run.dir}-alias`
    const copy = `${run.dir}-copy`
    tempRoots.push(alias, copy)
    await symlink(run.dir, alias)
    await cp(run.dir, copy, { recursive: true })
    for (const dirs of [[run.dir, run.dir], [run.dir, alias], [run.dir, copy]]) {
      const result = await invoke(dirs)
      expect(result.exitCode).toBe(2)
      expect(result.stdout).toBe("")
      expect(result.stderr).toContain("Duplicate run")
    }
  })

  test("rejects scores and pass flags that disagree with their gate outcomes", async () => {
    const changes: Partial<EvaluationReport>[] = [
      { score: 1 },
      { max_score: 3 },
      { score_ratio: 0.5 },
      { hard_gates_passed: false },
      { credential_scan_passed: false },
      { pass: false },
      { threshold: 0.5 },
    ]
    for (const change of changes) {
      const run = await makeRun()
      await publishReport(run, { ...run.report, ...change })

      const result = await invoke([run.dir])

      expect(result.exitCode).toBe(2)
      expect(result.stdout).toBe("")
    }
  })

  test("rejects conflicting gate contracts or thresholds within the same frozen group", async () => {
    for (const variant of ["threshold", "criterion"]) {
      const first = await makeRun()
      const second = await makeRun()
      await publishReport(second, variant === "threshold"
        ? { ...second.report, threshold: 0.9 }
        : { ...second.report, criteria: second.report.criteria.map((gate) => ({
          ...gate, id: gate.id === "format" ? "different-format" : gate.id,
        })) })

      const result = await invoke([first.dir, second.dir])

      expect(result.exitCode).toBe(2)
      expect(result.stdout).toBe("")
      expect(result.stderr).toContain("Conflicting scoring contract")
    }
  })

  test("returns null for insufficient repeats and handles k=1 and impossible all-pass samples", async () => {
    const passed = await makeRun()
    const failed = await makeRun({ passed: false })
    const short = JSON.parse((await invoke([passed.dir, failed.dir])).stdout).groups[0]
    expect(short.pass_rate).toBe(0.5)
    expect(short.pass_k).toBeNull()
    expect(short.hard_gate_pass_k).toBeNull()
    expect(short.gates.every((gate: { pass_k: number | null }) => gate.pass_k === null)).toBe(true)
    const one = JSON.parse((await invoke([passed.dir, failed.dir], ["--k", "1"])).stdout).groups[0]
    expect(one.pass_k).toBe(0.5)
    const two = JSON.parse((await invoke([passed.dir, failed.dir], ["--k", "2"])).stdout).groups[0]
    expect(two.pass_k).toBe(0)
    const allFail = JSON.parse((await invoke([failed.dir], ["--k", "1"])).stdout).groups[0]
    expect(allFail.pass_k).toBe(0)
  })

  test("separates cases, prompts, targets, models, and runners instead of pooling incompatible runs", async () => {
    const runs = await Promise.all([
      makeRun(), makeRun(),
      makeRun({ model: "another-model" }),
      makeRun({ runner: "another-runner" }),
      makeRun({ caseDigest: digest("case v2") }),
      makeRun({ promptDigest: digest("prompt v2") }),
      makeRun({ targetDigest: digest("target v2") }),
    ])
    const dirs = runs.map((run) => run.dir)
    const result = await invoke(dirs, ["--k", "2"])

    expect(result.exitCode).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary.run_count).toBe(7)
    expect(summary.groups).toHaveLength(6)
    expect(summary.groups.filter((group: { runs: number }) => group.runs === 2)).toHaveLength(1)
    expect(summary.groups.find((group: { runs: number }) => group.runs === 2).pass_k).toBe(1)
    expect(JSON.parse((await invoke(dirs.reverse(), ["--k", "2"])).stdout)).toEqual(summary)
  })

  test("keeps credential failures distinct from hard-gate reliability", async () => {
    const run = await makeRun()
    await publishReport(run, { ...run.report, credential_scan_passed: false, pass: false })

    const result = await invoke([run.dir], ["--k", "1"])

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout).groups[0]).toMatchObject({
      passed: 0, pass_k: 0, hard_gates_passed: 1, hard_gate_pass_k: 1, credential_scan_passed: 0,
    })
  })

  test("rejects absent inputs, unsupported flags, and invalid repeat counts", async () => {
    const run = await makeRun()
    for (const k of ["0", "-1", "1.5", "NaN", "1e3", "9007199254740992"]) {
      const result = await invoke([run.dir], ["--k", k])
      expect(result.exitCode).toBe(2)
      expect(result.stdout).toBe("")
    }
    expect((await invoke([])).exitCode).toBe(2)
    expect((await invoke([run.dir], ["--unknown"])).exitCode).toBe(2)
    const help = await invoke([], ["--help"])
    expect(help.exitCode).toBe(0)
    expect(help.stdout).toContain("--run-dir")
  })

  test("accepts valid fractional weights without changing the scorer's summation order", async () => {
    const run = await makeRun()
    await publishReport(run, {
      ...run.report,
      score: 0.6, max_score: 0.6,
      criteria: [
        { ...run.report.criteria[0], id: "z-first", weight: 0.3 },
        { ...run.report.criteria[0], id: "m-second", weight: 0.2 },
        { ...run.report.criteria[0], id: "a-third", weight: 0.1 },
      ],
    })

    const result = await invoke([run.dir], ["--k", "1"])

    expect(result.stderr).toBe("")
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout).groups[0].mean_score).toBe(0.6)
    expect(JSON.parse(result.stdout).groups[0].gates.map((gate: { id: string }) => gate.id))
      .toEqual(["a-third", "m-second", "z-first"])
  })

  test("rejects duplicate gate IDs and zero-weight criteria even when score totals agree", async () => {
    for (const variant of ["duplicate", "zero-weight"]) {
      const run = await makeRun()
      const criteria = run.report.criteria.map((gate, index) => ({
        ...gate,
        id: variant === "duplicate" ? "same-id" : gate.id,
        weight: variant === "zero-weight" && index === 0 ? 0 : gate.weight,
      }))
      await publishReport(run, {
        ...run.report, criteria,
        score: variant === "zero-weight" ? 1 : 2,
        max_score: variant === "zero-weight" ? 1 : 2,
      })

      const result = await invoke([run.dir])

      expect(result.exitCode).toBe(2)
      expect(result.stdout).toBe("")
      expect(result.stderr).toContain("criterion")
    }
  })

  test("reports malformed JSON without echoing private input bytes", async () => {
    for (const filename of ["evaluation.json", "manifest.json"]) {
      const run = await makeRun()
      await writeFile(path.join(run.dir, filename), "SENSITIVE_INPUT_SENTINEL is not JSON")

      const result = await invoke([run.dir])

      expect(result.exitCode).toBe(2)
      expect(result.stdout).toBe("")
      expect(result.stderr).toContain(filename)
      expect(result.stderr).not.toContain("SENSITIVE_INPUT_SENTINEL")
    }
  })

  test("rejects run and artifact symlinks that escape the allowed roots", async () => {
    const run = await makeRun()
    const outside = await mkdtemp(path.join(os.tmpdir(), "method-eval-report-outside-"))
    tempRoots.push(outside)
    const outsideFile = path.join(outside, "private.json")
    await writeFile(outsideFile, "PRIVATE_ARTIFACT_SENTINEL")
    await rm(path.join(run.dir, "evaluation.json"))
    await symlink(outsideFile, path.join(run.dir, "evaluation.json"))

    const artifact = await invoke([run.dir])
    const directory = await invoke([outside])

    expect(artifact.exitCode).toBe(2)
    expect(artifact.stderr).toContain("escapes its allowed root")
    expect(artifact.stderr).not.toContain("PRIVATE_ARTIFACT_SENTINEL")
    expect(directory.exitCode).toBe(2)
    expect(directory.stderr).toContain("Run directory must be under")
    expect(await readFile(outsideFile, "utf8")).toBe("PRIVATE_ARTIFACT_SENTINEL")
  })

  test("does not mutate stored evidence while aggregating it", async () => {
    const run = await makeRun()
    const files = ["evaluation.json", "manifest.json", "run.json", "response.md"]
    const before = await Promise.all(files.map((file) => readFile(path.join(run.dir, file), "utf8")))

    expect((await invoke([run.dir], ["--k", "1"])).exitCode).toBe(0)

    expect(await Promise.all(files.map((file) => readFile(path.join(run.dir, file), "utf8")))).toEqual(before)
  })
})
