#!/usr/bin/env bun
import { randomUUID } from "crypto"
import { constants, promises as fs } from "fs"
import path from "path"
import { parseArgs } from "util"
import {
  EVALUATION_SCHEMA_VERSION,
  findCaseById,
  resolveEvaluationRunDir,
  sha256File,
  sha256Target,
  type EvaluationCase,
} from "./lib"

const runRoot = "/tmp/methodsmith/behavioral-evals"
const usage = [
  "Usage: bun run eval:prepare --case <id> --run-dir <path> --runner <runner> --model <model>",
  "       bun run eval:prepare --run-dir <path> --complete",
].join("\n")

function isInside(root: string, candidate: string, allowRoot = false): boolean {
  const relative = path.relative(root, candidate)
  return (allowRoot || relative !== "") &&
    relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function createRunDir(runDir: string): Promise<void> {
  await fs.mkdir(runRoot, { recursive: true })
  const canonicalRoot = await fs.realpath(runRoot)
  let ancestor = path.dirname(runDir)
  let canonicalAncestor: string
  while (true) {
    try {
      canonicalAncestor = await fs.realpath(ancestor)
      break
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error
      ancestor = path.dirname(ancestor)
    }
  }
  const canonicalRun = path.resolve(canonicalAncestor, path.relative(ancestor, runDir))
  if (!isInside(canonicalRoot, canonicalRun)) {
    throw new Error(`Run directory must be a new directory under ${runRoot}`)
  }
  await fs.mkdir(path.dirname(runDir), { recursive: true })
  // Exclusive creation protects existing runs, including dangling symlinks.
  await fs.mkdir(runDir)
}

async function openRunFile(runDir: string, relativePath: string) {
  const filePath = path.resolve(runDir, relativePath)
  if (path.isAbsolute(relativePath) || !isInside(runDir, filePath)) {
    throw new Error(`Run file escapes its allowed root: ${relativePath}`)
  }
  const parent = await fs.realpath(path.dirname(filePath))
  if (!isInside(runDir, parent, true)) {
    throw new Error(`Run file escapes its allowed root: ${relativePath}`)
  }
  const file = await fs.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW)
  if (!(await file.stat()).isFile()) {
    await file.close()
    throw new Error(`Run file must be a regular file: ${relativePath}`)
  }
  return file
}

async function completeRun(runDirArg: string): Promise<void> {
  const runDir = await resolveEvaluationRunDir(runDirArg)
  if (runDir === await fs.realpath(runRoot)) {
    throw new Error("Run directory must be a child of the behavioral-evals root")
  }
  const runFile = await openRunFile(runDir, "run.json")
  let parsed: unknown
  try {
    parsed = JSON.parse(await runFile.readFile("utf8"))
  } finally {
    await runFile.close()
  }
  if (!isRecord(parsed)) {
    throw new Error("invalid run.json: expected an object")
  }
  const metadata: Record<string, unknown> = parsed
  for (const field of ["case_id", "case_sha256", "prompt_sha256", "target_sha256", "runner", "model"]) {
    const value = metadata[field]
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`invalid run.json: ${field} is required`)
    }
    if (field.endsWith("_sha256") && !/^[a-f0-9]{64}$/.test(value)) {
      throw new Error(`invalid run.json: ${field} must be a lowercase SHA-256 digest`)
    }
  }
  const startedAt = metadata.started_at
  const outputPath = metadata.output_path
  if (metadata.schema_version !== EVALUATION_SCHEMA_VERSION ||
      typeof startedAt !== "string" || Number.isNaN(Date.parse(startedAt)) ||
      typeof outputPath !== "string" || !outputPath.trim()) {
    throw new Error("invalid run.json: schema_version, started_at, or output_path")
  }
  const response = await openRunFile(runDir, outputPath)
  let completedAt: string
  try {
    const responseStat = await response.stat()
    if (responseStat.size === 0) throw new Error("Response file must not be empty")
    completedAt = responseStat.mtime.toISOString()
  } finally {
    await response.close()
  }
  if (Date.parse(completedAt) < Date.parse(startedAt)) {
    throw new Error("Response modification time must not precede started_at")
  }
  if (metadata.completed_at !== null) {
    if (typeof metadata.completed_at !== "string" ||
        Number.isNaN(Date.parse(metadata.completed_at)) ||
        Date.parse(metadata.completed_at) < Date.parse(startedAt)) {
      throw new Error("invalid run.json: completed_at must be null or a valid completion timestamp")
    }
    completedAt = metadata.completed_at
  } else {
    const temporaryPath = path.join(runDir, `.run-${randomUUID()}.tmp`)
    try {
      await fs.writeFile(temporaryPath,
        `${JSON.stringify({ ...metadata, completed_at: completedAt }, null, 2)}\n`, { flag: "wx" })
      await fs.rename(temporaryPath, path.join(runDir, "run.json"))
    } finally {
      await fs.rm(temporaryPath, { force: true })
    }
  }
  console.log(JSON.stringify({
    case_id: metadata.case_id,
    run_dir: runDir,
    completed_at: completedAt,
  }, null, 2))
}

function dispatchPrompt(
  repoRoot: string,
  runDir: string,
  definition: EvaluationCase,
  target: string,
  prompt: string,
): string {
  const targetDir = path.dirname(path.resolve(repoRoot, definition.target.source))
  const restrictions = definition.mode === "offline"
    ? "Do not access the network, install packages, or fabricate results. Use the supplied frozen inputs."
    : "Follow the case prompt's evidence-access rules. Do not fabricate results."
  return `# Fresh-context behavioral evaluation

Execute the ${definition.target.kind} \`${definition.target.name}\` using the instructions below.
Work only inside \`${runDir}\`. All relative paths in the case prompt are relative to this run directory.
This is a synthetic or seeded evaluation, not a request to access patient-level data.

## Injected target instructions

${target}

## Frozen case prompt

${prompt}

## Runner context

- Read the fixtures at their declared destinations:
${definition.fixtures.map((fixture) => `  - \`${path.join(runDir, fixture.destination)}\``).join("\n") || "  - No fixtures declared."}
- Target reference files are under \`${targetDir}\`. Resolve references in the injected instructions from that directory. Do not read unrelated repository files or evaluation criteria.
- Write requested artifacts at the paths in the case prompt, under the run directory.
- ${restrictions}
- Write the complete user-facing response, including any required terminal handoff, to \`${path.join(runDir, "response.md")}\`.
- Do not edit \`run.json\` or the frozen fixtures. The runner records completion separately.
`
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      case: { type: "string" },
      "run-dir": { type: "string" },
      runner: { type: "string" },
      model: { type: "string" },
      complete: { type: "boolean" },
      help: { type: "boolean" },
    },
    strict: true,
    allowPositionals: false,
  })
  if (values.help) {
    console.log(usage)
    return
  }
  const caseId = values.case?.trim()
  const runDirArg = values["run-dir"]?.trim()
  const runner = values.runner?.trim()
  const model = values.model?.trim()
  if (values.complete) {
    if (!runDirArg || values.case !== undefined || values.runner !== undefined || values.model !== undefined) {
      throw new Error(usage)
    }
    await completeRun(runDirArg)
    return
  }
  if (!caseId || !runDirArg || !runner || !model) throw new Error(usage)

  const repoRoot = path.resolve(process.cwd())
  const { casePath, definition } = await findCaseById(repoRoot, caseId)
  const targetPath = path.resolve(repoRoot, definition.target.source)
  const promptPath = path.resolve(repoRoot, definition.prompt_path)
  const [target, prompt, caseDigest, promptDigest, targetDigest] = await Promise.all([
    fs.readFile(targetPath, "utf8"),
    fs.readFile(promptPath, "utf8"),
    sha256File(casePath),
    sha256File(promptPath),
    sha256Target(targetPath),
  ])
  const runDir = path.resolve(runDirArg)
  await createRunDir(runDir)
  await fs.mkdir(path.join(runDir, "workspace"))
  for (const fixture of definition.fixtures) {
    const destination = path.join(runDir, fixture.destination)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.writeFile(destination, await fs.readFile(path.resolve(repoRoot, fixture.path)), {
      flag: "wx",
    })
    if (await sha256File(destination) !== fixture.sha256) {
      throw new Error(`fixture changed during preparation: ${fixture.path}`)
    }
  }
  const metadata = {
    schema_version: EVALUATION_SCHEMA_VERSION,
    case_id: definition.id,
    case_sha256: caseDigest,
    prompt_sha256: promptDigest,
    target_sha256: targetDigest,
    runner,
    model,
    started_at: new Date().toISOString(),
    completed_at: null,
    output_path: "response.md",
  }
  await fs.writeFile(path.join(runDir, "dispatch.md"),
    dispatchPrompt(repoRoot, runDir, definition, target, prompt), { flag: "wx" })
  await fs.writeFile(path.join(runDir, "run.json"), `${JSON.stringify(metadata, null, 2)}\n`, {
    flag: "wx",
  })
  console.log(JSON.stringify({
    case_id: definition.id,
    run_dir: runDir,
    dispatch: path.join(runDir, "dispatch.md"),
    run: path.join(runDir, "run.json"),
  }, null, 2))
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(2)
}
