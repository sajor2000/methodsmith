import { afterEach, describe, expect, test } from "bun:test"
import { createHash, randomUUID } from "crypto"
import { mkdir, mkdtemp, readFile, rm, stat, symlink, utimes, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { dump } from "js-yaml"
import type { EvaluationCase } from "../scripts/evals/lib"

const repoRoot = path.resolve(import.meta.dir, "..")
const prepareScript = path.join(repoRoot, "scripts/evals/prepare.ts")
const runRoot = "/tmp/methodsmith/behavioral-evals"
const tempRoots: string[] = []
const fixtureContents = "Synthetic fixture.\n"
const targetContents = "# Sample skill\nFollow the supplied prompt.\n"
const referenceContents = "Use only synthetic inputs.\n"
const promptContents = "Read workspace/input.txt and write a complete response.\n"
const digest = (contents: string) => createHash("sha256").update(contents).digest("hex")

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function makeScenario() {
  const root = await mkdtemp(path.join(os.tmpdir(), "method-eval-prepare-"))
  tempRoots.push(root)
  const caseDir = path.join(root, "evals/methodsmith/cases/sample")
  const skillDir = path.join(root, "plugins/methodsmith/skills/sample")
  await mkdir(caseDir, { recursive: true })
  await mkdir(path.join(skillDir, "references"), { recursive: true })
  await writeFile(path.join(skillDir, "SKILL.md"), targetContents)
  await writeFile(path.join(skillDir, "references/guide.md"), referenceContents)
  await writeFile(path.join(caseDir, "prompt.md"), promptContents)
  await writeFile(path.join(caseDir, "fixture.txt"), fixtureContents)
  const definition: EvaluationCase = {
    schema_version: "1.0",
    id: "sample-case",
    target: {
      kind: "skill",
      name: "sample",
      source: "plugins/methodsmith/skills/sample/SKILL.md",
    },
    mode: "offline",
    prompt_path: "evals/methodsmith/cases/sample/prompt.md",
    fixtures: [{
      path: "evals/methodsmith/cases/sample/fixture.txt",
      destination: "workspace/input.txt",
      sha256: digest(fixtureContents),
    }],
    required_behaviors: ["complete"],
    prohibited_behaviors: ["no-fabrication"],
    criteria: [
      { id: "complete", description: "Response is complete", type: "text_contains",
        path: "response.md", value: "complete", weight: 1, hard_gate: true },
      { id: "no-fabrication", description: "No invented result", type: "text_not_contains",
        path: "response.md", value: "fabricated", weight: 1, hard_gate: true },
    ],
    threshold: 1,
    limitations: ["Synthetic test only."],
  }
  const caseContents = dump(definition)
  await writeFile(path.join(caseDir, "case.yaml"), caseContents)
  const runDir = path.join(runRoot, `prepare-test-${randomUUID()}`)
  tempRoots.push(runDir)
  return { root, runDir, caseContents, definition, caseDir, skillDir }
}

async function invoke(root: string, args: string[]) {
  const proc = Bun.spawn([process.execPath, prepareScript, ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

function prepareArgs(runDir: string) {
  return ["--case", "sample-case", "--run-dir", runDir,
    "--runner", "skill-creator", "--model", "test-model"]
}

describe("eval:prepare command", () => {
  test("prepares frozen inputs and a dispatch prompt without running a model", async () => {
    const { root, runDir, caseContents } = await makeScenario()
    const result = await invoke(root, prepareArgs(runDir))

    expect(result.stderr).toBe("")
    expect(result.exitCode).toBe(0)
    const metadata = await Bun.file(path.join(runDir, "run.json")).json()
    expect(metadata).toEqual({
      schema_version: "1.0",
      case_id: "sample-case",
      case_sha256: digest(caseContents),
      prompt_sha256: digest(promptContents),
      target_sha256: digest(
        `SKILL.md\t${digest(targetContents)}\nreferences/guide.md\t${digest(referenceContents)}`,
      ),
      runner: "skill-creator",
      model: "test-model",
      started_at: expect.any(String),
      completed_at: null,
      output_path: "response.md",
    })
    expect(Number.isNaN(Date.parse(metadata.started_at))).toBe(false)
    expect(await readFile(path.join(runDir, "workspace/input.txt"), "utf8")).toBe(fixtureContents)
    const dispatch = await readFile(path.join(runDir, "dispatch.md"), "utf8")
    expect(dispatch).toContain(targetContents)
    expect(dispatch).toContain(promptContents)
    expect(dispatch).toContain(path.join(runDir, "response.md"))
    expect(dispatch).toContain(path.join(root, "plugins/methodsmith/skills/sample"))
    expect(dispatch).toContain("Do not access the network")
    expect(dispatch).not.toContain("No invented result")
    expect(await Bun.file(path.join(runDir, "response.md")).exists()).toBe(false)
    expect(JSON.parse(result.stdout).dispatch).toBe(path.join(runDir, "dispatch.md"))
  })

  test("records completion from the response modification time and produces a scoreable run", async () => {
    const { root, runDir } = await makeScenario()
    expect((await invoke(root, prepareArgs(runDir))).exitCode).toBe(0)
    const metadataPath = path.join(runDir, "run.json")
    const before = await Bun.file(metadataPath).json()
    const responsePath = path.join(runDir, "response.md")
    await writeFile(responsePath, "The response is complete.\n")
    const responseTime = new Date(Date.parse(before.started_at) + 60_000)
    await utimes(responsePath, responseTime, responseTime)
    const expectedCompletion = (await stat(responsePath)).mtime.toISOString()

    const result = await invoke(root, ["--run-dir", runDir, "--complete"])

    expect(result.stderr).toBe("")
    expect(result.exitCode).toBe(0)
    expect(await Bun.file(metadataPath).json()).toEqual({
      ...before, completed_at: expectedCompletion,
    })
    expect(JSON.parse(result.stdout).completed_at).toBe(expectedCompletion)
    const score = Bun.spawn([
      process.execPath, path.join(repoRoot, "scripts/evals/score.ts"),
      "--case", "sample-case", "--run-dir", runDir,
    ], { cwd: root, stdout: "pipe", stderr: "pipe" })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(score.stdout).text(), new Response(score.stderr).text(), score.exited,
    ])
    expect(stderr).toBe("")
    expect(exitCode).toBe(0)
    expect(JSON.parse(stdout).pass).toBe(true)
    const aggregate = Bun.spawn([
      process.execPath, path.join(repoRoot, "scripts/evals/report.ts"),
      "--run-dir", runDir, "--k", "1",
    ], { cwd: root, stdout: "pipe", stderr: "pipe" })
    const [aggregateOutput, aggregateError, aggregateExit] = await Promise.all([
      new Response(aggregate.stdout).text(), new Response(aggregate.stderr).text(), aggregate.exited,
    ])
    expect(aggregateError).toBe("")
    expect(aggregateExit).toBe(0)
    expect(JSON.parse(aggregateOutput).groups[0]).toMatchObject({
      runs: 1, passed: 1, pass_k: 1, mean_score: 2, max_score: 2,
    })
  })

  test("refuses to overwrite an existing run or its dispatch prompt", async () => {
    const { root, runDir } = await makeScenario()
    expect((await invoke(root, prepareArgs(runDir))).exitCode).toBe(0)
    const metadata = await readFile(path.join(runDir, "run.json"), "utf8")
    await writeFile(path.join(runDir, "dispatch.md"), "User-owned dispatch.\n")

    const result = await invoke(root, prepareArgs(runDir))

    expect(result.exitCode).toBe(2)
    expect(await readFile(path.join(runDir, "run.json"), "utf8")).toBe(metadata)
    expect(await readFile(path.join(runDir, "dispatch.md"), "utf8")).toBe("User-owned dispatch.\n")
  })

  test("rejects outside destinations and symlinked parents before creating a run", async () => {
    const { root, runDir } = await makeScenario()
    await mkdir(runDir, { recursive: true })
    await symlink(root, path.join(runDir, "escape"))
    for (const destination of [path.join(root, "outside-run"), runRoot,
      path.join(runDir, "escape", "outside-run")]) {
      const result = await invoke(root, prepareArgs(destination))
      expect(result.exitCode).toBe(2)
      expect(result.stderr).toContain("Run directory must be a new directory under")
    }
    expect(await Bun.file(path.join(root, "outside-run/run.json")).exists()).toBe(false)
  })

  test("does not finalize a missing, empty, or stale response", async () => {
    const { root, runDir } = await makeScenario()
    expect((await invoke(root, prepareArgs(runDir))).exitCode).toBe(0)
    const metadataPath = path.join(runDir, "run.json")
    const original = await readFile(metadataPath, "utf8")
    const args = ["--run-dir", runDir, "--complete"]
    expect((await invoke(root, args)).exitCode).toBe(2)
    await writeFile(path.join(runDir, "response.md"), "")
    expect((await invoke(root, args)).stderr).toContain("must not be empty")
    await writeFile(path.join(runDir, "response.md"), "complete\n")
    const staleTime = new Date("2020-01-01T00:00:00.000Z")
    await utimes(path.join(runDir, "response.md"), staleTime, staleTime)
    expect((await invoke(root, args)).stderr).toContain("must not precede started_at")
    expect(await readFile(metadataPath, "utf8")).toBe(original)
  })

  test("does not follow response symlinks or metadata paths outside the run", async () => {
    const { root, runDir } = await makeScenario()
    expect((await invoke(root, prepareArgs(runDir))).exitCode).toBe(0)
    const metadataPath = path.join(runDir, "run.json")
    const original = await readFile(metadataPath, "utf8")
    const outside = path.join(root, "outside.md")
    await writeFile(outside, "complete\n")
    await symlink(outside, path.join(runDir, "response.md"))
    expect((await invoke(root, ["--run-dir", runDir, "--complete"])).exitCode).toBe(2)
    expect(await readFile(metadataPath, "utf8")).toBe(original)
    for (const outputPath of [outside, "../outside.md"]) {
      await writeFile(metadataPath, JSON.stringify({
        ...JSON.parse(original), output_path: outputPath,
      }))
      const before = await readFile(metadataPath, "utf8")
      const result = await invoke(root, ["--run-dir", runDir, "--complete"])
      expect(result.exitCode).toBe(2)
      expect(result.stderr).toContain("escapes its allowed root")
      expect(await readFile(metadataPath, "utf8")).toBe(before)
    }
    expect(await readFile(outside, "utf8")).toBe("complete\n")
  })

  test("completion preserves frozen digests and is idempotent", async () => {
    const { root, runDir, skillDir } = await makeScenario()
    expect((await invoke(root, prepareArgs(runDir))).exitCode).toBe(0)
    const metadataPath = path.join(runDir, "run.json")
    const before = await Bun.file(metadataPath).json()
    await writeFile(path.join(runDir, "response.md"), "complete\n")
    await writeFile(path.join(skillDir, "references/guide.md"), "Changed after dispatch.\n")
    expect((await invoke(root, ["--run-dir", runDir, "--complete"])).exitCode).toBe(0)
    const completed = await readFile(metadataPath, "utf8")
    expect(JSON.parse(completed).target_sha256).toBe(before.target_sha256)
    expect((await invoke(root, ["--run-dir", runDir, "--complete"])).exitCode).toBe(0)
    expect(await readFile(metadataPath, "utf8")).toBe(completed)
    const score = Bun.spawn([
      process.execPath, path.join(repoRoot, "scripts/evals/score.ts"),
      "--case", "sample-case", "--run-dir", runDir,
    ], { cwd: root, stdout: "ignore", stderr: "pipe" })
    const [stderr, exitCode] = await Promise.all([
      new Response(score.stderr).text(), score.exited,
    ])
    expect(exitCode).not.toBe(0)
    expect(stderr).toContain("target_sha256")
    expect(stderr).toContain("does not match current")
  })

  test("supports agent targets and fixture-free forward cases", async () => {
    const { root, runDir, caseDir, definition } = await makeScenario()
    await mkdir(path.join(root, "plugins/methodsmith/agents"), { recursive: true })
    await writeFile(path.join(root, "plugins/methodsmith/agents/sample.md"), "# Sample agent\n")
    await writeFile(path.join(caseDir, "case.yaml"), dump({
      ...definition,
      target: { kind: "agent", name: "sample", source: "plugins/methodsmith/agents/sample.md" },
      mode: "forward",
      fixtures: [],
    }))

    const result = await invoke(root, prepareArgs(runDir))

    expect(result.exitCode).toBe(0)
    expect((await Bun.file(path.join(runDir, "run.json")).json()).target_sha256)
      .toBe(digest("# Sample agent\n"))
    const dispatch = await readFile(path.join(runDir, "dispatch.md"), "utf8")
    expect(dispatch).toContain("# Sample agent")
    expect(dispatch).toContain("No fixtures declared")
    expect(dispatch).not.toContain("Do not access the network")
  })

  test("requires actual runner and model identifiers and rejects unsupported flags", async () => {
    const { root, runDir } = await makeScenario()
    const args = prepareArgs(runDir)
    for (const invalid of [[], args.slice(0, -2), [...args, "--unknown"],
      ["--run-dir", runDir, "--complete", "--model", "test-model"]]) {
      expect((await invoke(root, invalid)).exitCode).toBe(2)
    }
    expect(await Bun.file(path.join(runDir, "run.json")).exists()).toBe(false)
    const help = await invoke(root, ["--help"])
    expect(help.exitCode).toBe(0)
    expect(help.stdout).toContain("--complete")
  })
})
