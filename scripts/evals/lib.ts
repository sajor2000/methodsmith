import { createHash, randomUUID } from "crypto"
import { promises as fs } from "fs"
import type { FileHandle } from "fs/promises"
import { isDeepStrictEqual } from "util"
import path from "path"
import { load } from "js-yaml"
import { sha256File, sha256Target } from "./digest"
import { evaluateCodeQuery, validateCodeQuery } from "./code-query"

// Re-export so existing consumers (scorer, contract tests) keep importing the
// digest helpers from lib. The implementations live in ./digest.
export { sha256File, sha256Target } from "./digest"

export const EVALUATION_SCHEMA_VERSION = "1.0"

export type CriterionType =
  | "text_contains"
  | "text_not_contains"
  | "regex"
  | "regex_not"
  | "claim_absent"
  | "numeric"
  | "code_query"
  | "json_equals"
  | "json_one_of"
  | "json_text_equals"
  | "json_set_equals"
  | "file_exists"
  | "file_unchanged"

export interface EvaluationFixture {
  path: string
  destination: string
  sha256: string
}

export interface EvaluationCriterion {
  id: string
  description: string
  type: CriterionType
  path: string
  weight: number
  hard_gate: boolean
  value?: string
  pattern?: string
  expected?: unknown
  tolerance?: number
  json_path?: string
  text_path?: string
  fixture_path?: string
  case_sensitive?: boolean
  subjects?: string[]
  claims?: string[]
  negation_pattern?: string
  language?: "python" | "r"
  query?: string
}

export interface EvaluationCase {
  schema_version: string
  id: string
  target: {
    kind: "skill" | "agent"
    name: string
    source: string
  }
  mode: "offline" | "forward"
  prompt_path: string
  fixtures: EvaluationFixture[]
  required_behaviors: string[]
  prohibited_behaviors: string[]
  criteria: EvaluationCriterion[]
  threshold: number
  limitations: string[]
}

export interface EvaluationRunMetadata {
  schema_version: string
  case_id: string
  case_sha256: string
  prompt_sha256: string
  target_sha256: string
  runner: string
  model: string
  started_at: string
  completed_at: string
  output_path: string
}

export interface CriterionResult {
  id: string
  description: string
  type: CriterionType
  weight: number
  hard_gate: boolean
  passed: boolean
  evidence: string
}

export interface EvaluationReport {
  schema_version: string
  case_id: string
  target: EvaluationCase["target"]
  source_commit: string | null
  worktree_dirty: boolean | null
  target_sha256: string
  runner: string
  model: string
  started_at: string
  completed_at: string
  output_path: string
  run_sha256: string
  output_sha256: string
  credential_scan_passed: boolean
  score: number
  max_score: number
  score_ratio: number
  threshold: number
  hard_gates_passed: boolean
  pass: boolean
  criteria: CriterionResult[]
  limitations: string[]
}

export interface EvaluationManifest {
  schema_version: string
  case_id: string
  pass: boolean
  source_commit: string | null
  case_sha256: string
  prompt_sha256: string
  target_sha256: string
  run_sha256: string
  output_sha256: string
  evaluation_sha256: string
  fixture_sha256: Record<string, string>
  scored_artifact_sha256: Record<string, string>
  scored_artifact_state: Record<
    string,
    { exists: boolean; type: "file" | "directory" | "other" | "missing"; sha256?: string }
  >
}

interface EvaluationSnapshot {
  caseContents: Buffer
  promptContents: Buffer
  targetContents: Buffer
  runContents: Buffer
  outputContents: Buffer
  fixtureContents: Map<string, Buffer>
  scoredArtifactContents: Map<string, Buffer>
  scoredArtifactState: EvaluationManifest["scored_artifact_state"]
}

const reportSnapshots = new WeakMap<EvaluationReport, EvaluationSnapshot>()

export async function writeEvaluationArtifacts(options: {
  runDir: string
  evaluationContents: string
  manifestContents: string | (() => string | Promise<string>)
}): Promise<void> {
  const runDir = await realRoot(options.runDir, "run directory")
  const evaluationPath = path.join(runDir, "evaluation.json")
  const manifestPath = path.join(runDir, "manifest.json")
  const evaluationTemporary = path.join(
    runDir,
    `.evaluation.json.${process.pid}.${randomUUID()}.tmp`,
  )
  const manifestTemporary = path.join(
    runDir,
    `.manifest.json.${process.pid}.${randomUUID()}.tmp`,
  )
  let evaluationHandle: FileHandle | undefined
  let manifestHandle: FileHandle | undefined
  try {
    evaluationHandle = await fs.open(evaluationTemporary, "wx", 0o600)
    manifestHandle = await fs.open(manifestTemporary, "wx", 0o600)

    await evaluationHandle.writeFile(options.evaluationContents)
    await evaluationHandle.sync()
    const manifestContents =
      typeof options.manifestContents === "function"
        ? await options.manifestContents()
        : options.manifestContents
    await manifestHandle.writeFile(manifestContents)
    await manifestHandle.sync()

    await evaluationHandle.close()
    evaluationHandle = undefined
    await manifestHandle.close()
    manifestHandle = undefined

    await fs.rename(evaluationTemporary, evaluationPath)
    await fs.rename(manifestTemporary, manifestPath)
  } catch (error) {
    await Promise.allSettled([
      evaluationHandle?.close() ?? Promise.resolve(),
      manifestHandle?.close() ?? Promise.resolve(),
    ])
    await Promise.allSettled([
      fs.rm(evaluationTemporary, { force: true }),
      fs.rm(manifestTemporary, { force: true }),
    ])
    throw error
  }
}

const ALLOWED_CRITERION_TYPES = new Set<CriterionType>([
  "code_query",
  "text_contains",
  "text_not_contains",
  "regex",
  "regex_not",
  "claim_absent",
  "numeric",
  "json_equals",
  "json_one_of",
  "json_text_equals",
  "json_set_equals",
  "file_exists",
  "file_unchanged",
])

const CREDENTIAL_PATTERNS = [
  /\bsk-ant-[A-Za-z0-9_-]{12,}\b/,
  /\bsk-proj-[A-Za-z0-9_-]{12,}\b/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPathInside(base: string, candidate: string): boolean {
  const resolvedBase = path.resolve(base)
  const resolvedCandidate = path.resolve(candidate)
  if (resolvedBase === path.parse(resolvedBase).root) {
    return resolvedCandidate.startsWith(resolvedBase)
  }
  return (
    resolvedCandidate === resolvedBase ||
    resolvedCandidate.startsWith(`${resolvedBase}${path.sep}`)
  )
}

function resolveInside(base: string, relativePath: string, label: string): string {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be a non-empty relative path`)
  }
  const normalized = path.normalize(relativePath)
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    throw new Error(`${label} escapes its allowed root: ${relativePath}`)
  }
  const resolved = path.resolve(base, relativePath)
  if (!isPathInside(base, resolved)) {
    throw new Error(`${label} escapes its allowed root: ${relativePath}`)
  }
  return resolved
}

export async function resolveEvaluationRunDir(runDirArg: string): Promise<string> {
  const requiredRoot = await fs.realpath("/tmp/methodsmith/behavioral-evals")
  const runDir = await fs.realpath(path.resolve(runDirArg))
  if (!isPathInside(requiredRoot, runDir)) {
    throw new Error(`Run directory must be under ${requiredRoot}`)
  }
  return runDir
}

function sha256Contents(contents: string | Buffer): string {
  return createHash("sha256").update(contents).digest("hex")
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw error
  }
}

async function realRoot(root: string, label: string): Promise<string> {
  try {
    return await fs.realpath(path.resolve(root))
  } catch (error) {
    throw new Error(`${label} could not be canonicalized: ${(error as Error).message}`)
  }
}

async function canonicalExistingInside(
  root: string,
  candidate: string,
  label: string,
): Promise<string> {
  const canonicalRoot = await realRoot(root, `${label} root`)
  let canonicalCandidate: string
  try {
    canonicalCandidate = await fs.realpath(candidate)
  } catch (error) {
    throw new Error(`${label} could not be canonicalized: ${(error as Error).message}`)
  }
  if (!isPathInside(canonicalRoot, canonicalCandidate)) {
    throw new Error(`${label} escapes its allowed root: ${candidate}`)
  }
  return canonicalCandidate
}

async function nearestExistingAncestor(candidate: string): Promise<string> {
  let current = candidate
  while (true) {
    try {
      return await fs.realpath(current)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      const parent = path.dirname(current)
      if (parent === current) throw error
      current = parent
    }
  }
}

async function resolveRunArtifact(
  runDir: string,
  relativePath: string,
  label: string,
): Promise<{ path: string; exists: boolean }> {
  const lexicalPath = resolveInside(runDir, relativePath, label)
  const canonicalRoot = await realRoot(runDir, `${label} root`)
  if (await fileExists(lexicalPath)) {
    const canonicalPath = await fs.realpath(lexicalPath)
    if (!isPathInside(canonicalRoot, canonicalPath)) {
      throw new Error(`${label} escapes its allowed root: ${relativePath}`)
    }
    return { path: canonicalPath, exists: true }
  }
  const ancestor = await nearestExistingAncestor(path.dirname(lexicalPath))
  if (!isPathInside(canonicalRoot, ancestor)) {
    throw new Error(`${label} escapes its allowed root: ${relativePath}`)
  }
  return { path: lexicalPath, exists: false }
}

function validateCriterionShape(criterion: EvaluationCriterion, index: number): string[] {
  const errors: string[] = []
  const label = `criteria[${index}]`
  if (!criterion.id || !/^[a-z0-9][a-z0-9-]*$/.test(criterion.id)) {
    errors.push(`${label}.id must be lowercase kebab-case`)
  }
  if (!criterion.description?.trim()) errors.push(`${label}.description is required`)
  if (!ALLOWED_CRITERION_TYPES.has(criterion.type)) {
    errors.push(`${label}.type is unsupported: ${String(criterion.type)}`)
  }
  if (!criterion.path?.trim() || path.isAbsolute(criterion.path)) {
    errors.push(`${label}.path must be a relative run path`)
  } else {
    try {
      resolveInside("/", criterion.path, `${label}.path`)
    } catch (error) {
      errors.push((error as Error).message)
    }
  }
  if (!Number.isFinite(criterion.weight) || criterion.weight <= 0) {
    errors.push(`${label}.weight must be greater than zero`)
  }
  if (typeof criterion.hard_gate !== "boolean") {
    errors.push(`${label}.hard_gate must be boolean`)
  }

  if (
    ["text_contains", "text_not_contains"].includes(criterion.type) &&
    typeof criterion.value !== "string"
  ) {
    errors.push(`${label}.value is required for ${criterion.type}`)
  }
  if (
    ["regex", "regex_not", "numeric", "json_text_equals"].includes(criterion.type) &&
    typeof criterion.pattern !== "string"
  ) {
    errors.push(`${label}.pattern is required for ${criterion.type}`)
  } else if (["regex", "regex_not", "numeric", "json_text_equals"].includes(criterion.type)) {
    try {
      new RegExp(criterion.pattern!)
    } catch (error) {
      errors.push(`${label}.pattern is invalid: ${(error as Error).message}`)
    }
  }
  if (criterion.type === "numeric") {
    if (typeof criterion.expected !== "number" || !Number.isFinite(criterion.expected)) {
      errors.push(`${label}.expected must be numeric`)
    }
    if (
      criterion.tolerance !== undefined &&
      (!Number.isFinite(criterion.tolerance) || criterion.tolerance < 0)
    ) {
      errors.push(`${label}.tolerance must be zero or greater`)
    }
  }
  if (criterion.type === "claim_absent") {
    for (const field of ["subjects", "claims"] as const) {
      const terms = criterion[field]
      if (!Array.isArray(terms) || terms.length === 0) {
        errors.push(`${label}.${field} must be a non-empty array for claim_absent`)
      } else if (terms.some((term) => typeof term !== "string" || !term.trim())) {
        errors.push(`${label}.${field} entries must be non-empty strings`)
      }
    }
    if (typeof criterion.negation_pattern !== "string" || !criterion.negation_pattern.trim()) {
      errors.push(`${label}.negation_pattern is required for claim_absent`)
    } else {
      try {
        new RegExp(criterion.negation_pattern)
      } catch (error) {
        errors.push(`${label}.negation_pattern is invalid: ${(error as Error).message}`)
      }
    }
  }
  if (["json_equals", "json_one_of", "json_text_equals", "json_set_equals"].includes(criterion.type) &&
      (typeof criterion.json_path !== "string" ||
        criterion.json_path.split(".").some((segment) => !segment.trim()))) {
    errors.push(`${label}.json_path must be a non-empty dotted path for ${criterion.type}`)
  }
  if (
    criterion.type === "json_equals" &&
    !Object.prototype.hasOwnProperty.call(criterion, "expected")
  ) {
    errors.push(`${label}.expected is required for json_equals`)
  }
  if (criterion.type === "json_set_equals" && !Array.isArray(criterion.expected)) {
    errors.push(`${label}.expected must be an array for json_set_equals`)
  }
  if (criterion.type === "json_one_of" &&
      (!Array.isArray(criterion.expected) || criterion.expected.length === 0)) {
    errors.push(`${label}.expected must be a non-empty array for json_one_of`)
  }
  if (criterion.type === "json_text_equals") {
    try {
      resolveInside("/", criterion.text_path ?? "", `${label}.text_path`)
    } catch (error) {
      errors.push((error as Error).message)
    }
  }
  if (criterion.type === "file_unchanged" && !criterion.fixture_path) {
    errors.push(`${label}.fixture_path is required for file_unchanged`)
  }
  if (criterion.type === "file_exists" && typeof criterion.expected !== "boolean") {
    errors.push(`${label}.expected must be boolean for file_exists`)
  }
  return errors
}

export async function loadAndValidateCase(
  repoRoot: string,
  casePath: string,
): Promise<EvaluationCase> {
  const errors: string[] = []
  const resolvedRepo = path.resolve(repoRoot)
  const resolvedCase = path.resolve(casePath)
  if (!isPathInside(resolvedRepo, resolvedCase)) {
    throw new Error(`case path is outside the repository: ${casePath}`)
  }
  await canonicalExistingInside(resolvedRepo, resolvedCase, "case path")

  let parsed: unknown
  try {
    parsed = load(await fs.readFile(resolvedCase, "utf8"))
  } catch (error) {
    throw new Error(`failed to read case ${casePath}: ${(error as Error).message}`)
  }
  if (!isRecord(parsed)) throw new Error(`case must contain a YAML object: ${casePath}`)
  const definition = parsed as unknown as EvaluationCase
  const caseDir = path.dirname(resolvedCase)

  if (definition.schema_version !== EVALUATION_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${EVALUATION_SCHEMA_VERSION}`)
  }
  if (!definition.id || !/^[a-z0-9][a-z0-9-]*$/.test(definition.id)) {
    errors.push("id must be lowercase kebab-case")
  }
  if (!isRecord(definition.target)) {
    errors.push("target is required")
  } else {
    if (!["skill", "agent"].includes(definition.target.kind)) {
      errors.push("target.kind must be skill or agent")
    }
    if (!definition.target.name?.trim()) errors.push("target.name is required")
    try {
      const targetPath = resolveInside(resolvedRepo, definition.target.source, "target.source")
      if (!(await fileExists(targetPath))) {
        errors.push(`target.source does not exist: ${definition.target.source}`)
      } else {
        await canonicalExistingInside(resolvedRepo, targetPath, "target.source")
      }
    } catch (error) {
      errors.push((error as Error).message)
    }
  }
  if (!["offline", "forward"].includes(definition.mode)) {
    errors.push("mode must be offline or forward")
  }
  try {
    const promptPath = resolveInside(resolvedRepo, definition.prompt_path, "prompt_path")
    if (!isPathInside(caseDir, promptPath)) {
      errors.push(`prompt_path must stay inside its case directory: ${definition.prompt_path}`)
    } else if (!(await fileExists(promptPath))) {
      errors.push(`prompt_path does not exist: ${definition.prompt_path}`)
    } else {
      await canonicalExistingInside(caseDir, promptPath, "prompt_path")
    }
  } catch (error) {
    errors.push((error as Error).message)
  }

  if (!Array.isArray(definition.fixtures)) {
    errors.push("fixtures must be an array")
  } else {
    for (const [index, fixtureValue] of definition.fixtures.entries()) {
      const label = `fixtures[${index}]`
      if (!isRecord(fixtureValue)) {
        errors.push(`${label} must be an object`)
        continue
      }
      const fixture = fixtureValue as unknown as EvaluationFixture
      try {
        const fixturePath = resolveInside(resolvedRepo, fixture.path, `${label}.path`)
        if (!(await fileExists(fixturePath))) {
          errors.push(`${label}.path does not exist: ${fixture.path}`)
        } else {
          const canonicalFixturePath = await canonicalExistingInside(
            resolvedRepo,
            fixturePath,
            `${label}.path`,
          )
          const actualHash = await sha256File(canonicalFixturePath)
          if (actualHash !== fixture.sha256) {
            errors.push(
              `fixture hash mismatch for ${fixture.path}: expected ${fixture.sha256}, got ${actualHash}`,
            )
          }
        }
      } catch (error) {
        errors.push((error as Error).message)
      }
      try {
        const destination = resolveInside("/", fixture.destination, `${label}.destination`)
        if (!destination.startsWith(`${path.sep}workspace${path.sep}`)) {
          errors.push(`${label}.destination must be under workspace/`)
        }
      } catch (error) {
        errors.push((error as Error).message)
      }
      if (!/^[a-f0-9]{64}$/.test(fixture.sha256)) {
        errors.push(`${label}.sha256 must be a lowercase SHA-256 digest`)
      }
    }
  }

  if (!Array.isArray(definition.criteria) || definition.criteria.length === 0) {
    errors.push("criteria must be a non-empty array")
  } else {
    const seen = new Set<string>()
    const declaredFixturePaths = new Set(
      Array.isArray(definition.fixtures)
        ? definition.fixtures.filter(isRecord).map((fixture) => String(fixture.path))
        : [],
    )
    for (const [index, criterionValue] of definition.criteria.entries()) {
      if (!isRecord(criterionValue)) {
        errors.push(`criteria[${index}] must be an object`)
        continue
      }
      const criterion = criterionValue as unknown as EvaluationCriterion
      errors.push(...validateCriterionShape(criterion, index))
      if (criterion.type === "code_query") {
        try {
          await validateCodeQuery(criterion.language, criterion.query)
        } catch (error) {
          errors.push(`criteria[${index}]: ${(error as Error).message}`)
        }
      }
      if (seen.has(criterion.id)) errors.push(`duplicate criterion id: ${criterion.id}`)
      seen.add(criterion.id)
      if (
        criterion.type === "file_unchanged" &&
        criterion.fixture_path &&
        !declaredFixturePaths.has(criterion.fixture_path)
      ) {
        errors.push(
          `criteria[${index}].fixture_path must reference a declared fixture: ${criterion.fixture_path}`,
        )
      }
    }
    for (const field of ["required_behaviors", "prohibited_behaviors"] as const) {
      const references = definition[field]
      if (!Array.isArray(references) || references.length === 0) {
        errors.push(`${field} must be a non-empty array`)
        continue
      }
      for (const criterionId of references) {
        if (!seen.has(criterionId)) errors.push(`${field} references unknown criterion: ${criterionId}`)
      }
    }
  }
  if (
    !Number.isFinite(definition.threshold) ||
    definition.threshold < 0.85 ||
    definition.threshold > 1
  ) {
    errors.push("threshold must be between 0.85 and 1")
  }
  if (!Array.isArray(definition.limitations) || definition.limitations.length === 0) {
    errors.push("limitations must be a non-empty array")
  }

  if (errors.length > 0) {
    throw new Error(`invalid evaluation case ${definition.id ?? casePath}:\n- ${errors.join("\n- ")}`)
  }
  return definition
}

async function findCaseFiles(root: string): Promise<string[]> {
  if (!(await fileExists(root))) return []
  const files: string[] = []
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...(await findCaseFiles(fullPath)))
    else if (entry.isFile() && entry.name === "case.yaml") files.push(fullPath)
  }
  return files.sort()
}

export async function validateAllCases(repoRoot: string): Promise<{
  cases: Array<{ casePath: string; definition: EvaluationCase }>
  errors: string[]
}> {
  const caseRoot = path.join(repoRoot, "evals", "methodsmith", "cases")
  const caseFiles = await findCaseFiles(caseRoot)
  const cases: Array<{ casePath: string; definition: EvaluationCase }> = []
  const errors: string[] = []
  const seen = new Map<string, string>()

  for (const casePath of caseFiles) {
    try {
      const definition = await loadAndValidateCase(repoRoot, casePath)
      const prior = seen.get(definition.id)
      if (prior) {
        errors.push(`duplicate case id ${definition.id}: ${prior} and ${casePath}`)
      } else {
        seen.set(definition.id, casePath)
        cases.push({ casePath, definition })
      }
    } catch (error) {
      errors.push((error as Error).message)
    }
  }
  if (caseFiles.length === 0) errors.push(`no evaluation cases found under ${caseRoot}`)
  return { cases, errors }
}

function getJsonPath(value: unknown, jsonPath: string): unknown {
  let current = value
  for (const segment of jsonPath.split(".").filter(Boolean)) {
    if (!isRecord(current) && !Array.isArray(current)) return undefined
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index)) return undefined
      current = current[index]
    } else {
      current = current[segment]
    }
  }
  return current
}

function normalizeText(value: string, caseSensitive: boolean | undefined): string {
  return caseSensitive ? value : value.toLowerCase()
}

function normalizeProseLineWraps(value: string): string {
  const blockBoundary = /^(?:[-*+]\s+|\d+[.)]\s+|#{1,6}\s+|>\s*|\| |```|__CE_)/
  let normalized = ""

  for (const rawLine of value.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim()
    if (!line) {
      if (normalized && !/[;.!?]\s*$/.test(normalized)) normalized += "."
      continue
    }

    if (normalized) {
      if (blockBoundary.test(line) && !/[;.!?]\s*$/.test(normalized)) normalized += "."
      normalized += " "
    }
    normalized += line
  }

  return normalized
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function termAlternation(terms: string[]): string {
  return [...terms]
    .sort((left, right) => right.length - left.length)
    .map((term) => escapeRegex(term.trim()).replace(/\s+/g, "\\s+"))
    .join("|")
}

function boundedTermPattern(terms: string[]): string {
  return `(?:^|[^A-Za-z0-9_])(?:${termAlternation(terms)})(?=$|[^A-Za-z0-9_])`
}

const CLAIM_PREDICATE_HEAD_SOURCE =
  "(?:is|are|was|were|has|have|had|can|could|will|would|shall|should|may|might|must|requires?|needs?)(?:n['\\u2019]t)?"

interface ClaimClause {
  scope: string
  inheritedSubject?: string
}

function parseClaimClauses(
  value: string,
  subjectPattern: string,
  claims: string[],
  caseSensitive: boolean | undefined,
): ClaimClause[] {
  const clauses: ClaimClause[] = []
  const subjectFlags = caseSensitive ? "g" : "gi"
  const predicateStart = new RegExp(`^${CLAIM_PREDICATE_HEAD_SOURCE}\\b`, "i")
  const ellipticalClaimStart = new RegExp(
    `^(?:also\\s+)?(?:${termAlternation(claims)})(?=$|[^A-Za-z0-9_])`,
    caseSensitive ? "" : "i",
  )
  const boundaryPattern = new RegExp(
    `(?:[,;:]\\s*)?\\b(?:but|however|yet)\\b(?:\\s*[,;:]\\s*|\\s+)|` +
      `\\band\\s+(?=${CLAIM_PREDICATE_HEAD_SOURCE}\\b)|[.!?](?:\\s+|$)|[;,\\u2013\\u2014]\\s*|:\\s*`,
    "gi",
  )
  const normalized = normalizeProseLineWraps(value)
  let cursor = 0
  let inheritedSubject: string | undefined

  for (const boundary of [...normalized.matchAll(boundaryPattern), undefined]) {
    const boundaryIndex = boundary?.index ?? normalized.length
    const scope = normalized.slice(cursor, boundaryIndex).trim()
    const subjects = scope
      ? [...scope.matchAll(new RegExp(subjectPattern, subjectFlags))]
      : []
    const lastSubject = subjects.at(-1)
    const explicitSubject = lastSubject?.[0].trim()
    const ownedSubject = explicitSubject ?? inheritedSubject
    if (scope) clauses.push({ scope, inheritedSubject })

    if (!boundary) break

    const delimiter = boundary[0]
    const remainder = normalized.slice(boundaryIndex + delimiter.length).trimStart()
    const colonAfterSubjectLabel =
      delimiter.trim() === ":" &&
      explicitSubject !== undefined &&
      scope.slice(0, lastSubject?.index).trim() === "" &&
      scope.slice((lastSubject?.index ?? 0) + (lastSubject?.[0].length ?? 0)).trim() === ""
    const coordinatedPredicate =
      !delimiter.includes(";") &&
      /\b(?:but|however|yet|and)\b/i.test(delimiter) &&
      (predicateStart.test(remainder) ||
        (/\b(?:but|however|yet)\b/i.test(delimiter) && ellipticalClaimStart.test(remainder)))

    inheritedSubject =
      ownedSubject && (colonAfterSubjectLabel || coordinatedPredicate) ? ownedSubject : undefined
    cursor = boundaryIndex + delimiter.length
  }

  return clauses
}

function hasOrdinaryNegation(
  value: string,
  pattern: string,
  caseSensitive: boolean | undefined,
): boolean {
  const flags = caseSensitive ? "g" : "gi"
  for (const match of value.matchAll(new RegExp(pattern, flags))) {
    const matchEnd = (match.index ?? 0) + match[0].length
    const contrastiveSuffix = value.slice(matchEnd)
    if (match[0].toLowerCase() === "not" && /^\s+(?:only|merely|just)\b/i.test(contrastiveSuffix)) {
      continue
    }
    return true
  }
  return false
}

function findAffirmativeClaim(
  value: string,
  criterion: EvaluationCriterion,
): { scope: string; subject: string; claim: string } | undefined {
  const flags = criterion.case_sensitive ? "g" : "gi"
  const subjectPattern = boundedTermPattern(criterion.subjects!)
  const claimPattern = boundedTermPattern(criterion.claims!)
  const negationFlags = criterion.case_sensitive ? "" : "i"
  const predicateHead = new RegExp(`\\b${CLAIM_PREDICATE_HEAD_SOURCE}\\b`, "i")
  const qualifiedClaimFrame =
    /(?:\b(?:would|will)\s+need\s+to\s+be|\bneeds?\s+to\s+be|\b(?:has|have|had)\s+to\s+be|\b(?:must|should)\s+(?:(?:first|still|also|independently|formally|externally|clinically|statistically|regulatorily)\s+){0,2}be|\brequir(?:e|es|ed|ing)\s+(?:an?\s+)?)\s*$/i
  const temporalOrConditionalFrame = /^(?:before|until|unless|if)\b/i
  const negatedReportingFrame = new RegExp(
    `${criterion.negation_pattern!}\\s+(?:(?:[A-Za-z]+['\u2019]?[A-Za-z]*)\\s+){0,2}` +
      "(?:claim(?:s|ed|ing)?|stat(?:e|es|ed|ing)|assert(?:s|ed|ing)?|" +
      "say|says|said|saying|conclud(?:e|es|ed|ing)|represent(?:s|ed|ing)?|" +
      "describ(?:e|es|ed|ing)|consider(?:s|ed|ing)?|call(?:s|ed|ing)?|" +
      "believ(?:e|es|ed|ing)|find|finds|found|finding|deem(?:s|ed|ing)?|" +
      "treat(?:s|ed|ing)?)\\b(?:\\s+that)?\\s*$",
    negationFlags,
  )

  for (const { scope, inheritedSubject } of parseClaimClauses(
    value,
    subjectPattern,
    criterion.claims!,
    criterion.case_sensitive,
  )) {
    const subjects = [...scope.matchAll(new RegExp(subjectPattern, flags))]
    const claims = [...scope.matchAll(new RegExp(claimPattern, flags))]
    for (const claim of claims) {
      const claimIndex = claim.index ?? 0
      const explicitSubject = subjects
        .filter((candidate) => {
          const candidateIndex = candidate.index ?? 0
          if (candidateIndex >= claimIndex) return false
          if (candidate[0].trim().toLowerCase() !== "that") return true
          const afterSubject = scope.slice(candidateIndex + candidate[0].length, claimIndex)
          return predicateHead.test(afterSubject)
        })
        .at(-1)
      const subject = explicitSubject?.[0].trim() ?? inheritedSubject
      if (!subject) continue
      const subjectIndex = explicitSubject?.index ?? 0
      const predicateStart = explicitSubject ? subjectIndex + explicitSubject[0].length : 0
      const spanThroughClaim = scope.slice(predicateStart, claimIndex + claim[0].length)
      const predicateHeadIndex = spanThroughClaim.search(predicateHead)
      const predicateThroughClaim =
        predicateHeadIndex >= 0 ? spanThroughClaim.slice(predicateHeadIndex) : spanThroughClaim
      const predicateBeforeClaim = predicateThroughClaim.slice(
        0,
        predicateThroughClaim.length - claim[0].trim().length,
      )
      const prefixBeforeSubject = explicitSubject ? scope.slice(0, subjectIndex) : ""
      if (
        hasOrdinaryNegation(
          predicateThroughClaim,
          criterion.negation_pattern!,
          criterion.case_sensitive,
        ) ||
        qualifiedClaimFrame.test(predicateBeforeClaim) ||
        temporalOrConditionalFrame.test(prefixBeforeSubject.trimStart()) ||
        negatedReportingFrame.test(prefixBeforeSubject)
      ) {
        continue
      }
      return { scope, subject, claim: claim[0].trim() }
    }
  }
  return undefined
}

async function evaluateCriterion(
  criterion: EvaluationCriterion,
  artifact: Buffer | undefined,
  fixture: Buffer | undefined,
  artifactExists: boolean,
  textArtifact?: Buffer,
): Promise<CriterionResult> {
  let passed = false
  let evidence = ""

  if (criterion.type === "file_exists") {
    passed = artifactExists === criterion.expected
    evidence = `exists=${artifactExists}; expected=${String(criterion.expected)}`
  } else if (criterion.type === "file_unchanged") {
    if (artifact === undefined) {
      evidence = `missing file: ${criterion.path}`
    } else {
      if (fixture === undefined) {
        throw new Error(`criterion ${criterion.id} requires missing fixture snapshot`)
      }
      const actualHash = sha256Contents(artifact)
      const expectedHash = sha256Contents(fixture)
      passed = actualHash === expectedHash
      evidence = `actual=${actualHash}; expected=${expectedHash}`
    }
  } else {
    if (artifact === undefined) {
      throw new Error(`criterion ${criterion.id} requires missing artifact: ${criterion.path}`)
    }
    const raw = artifact.toString("utf8")
    if (criterion.type === "text_contains" || criterion.type === "text_not_contains") {
      const haystack = normalizeText(raw, criterion.case_sensitive)
      const needle = normalizeText(criterion.value!, criterion.case_sensitive)
      const contains = haystack.includes(needle)
      passed = criterion.type === "text_contains" ? contains : !contains
      evidence = `${criterion.type} ${JSON.stringify(criterion.value)} => ${passed}`
    } else if (criterion.type === "regex" || criterion.type === "regex_not") {
      const flags = criterion.case_sensitive ? "m" : "im"
      // Prohibited-behavior prose must not change meaning merely because Markdown
      // wraps one sentence across lines. Positive regex criteria retain raw line
      // structure because some contracts intentionally anchor exact handoffs.
      const regexInput = criterion.type === "regex_not" ? normalizeProseLineWraps(raw) : raw
      const matched = new RegExp(criterion.pattern!, flags).test(regexInput)
      passed = criterion.type === "regex" ? matched : !matched
      evidence =
        `${criterion.type} /${criterion.pattern}/${flags}` +
        `${criterion.type === "regex_not" ? " normalized-whitespace" : ""}` +
        ` matched=${matched} => ${passed}`
    } else if (criterion.type === "claim_absent") {
      const match = findAffirmativeClaim(raw, criterion)
      passed = match === undefined
      evidence = match
        ? `affirmative claim found: subject=${JSON.stringify(match.subject)}; claim=${JSON.stringify(match.claim)}; scope=${JSON.stringify(match.scope)}`
        : "no affirmative subject/claim sentence found"
    } else if (criterion.type === "code_query") {
      const result = await evaluateCodeQuery(raw, criterion.language, criterion.query)
      passed = result.passed
      evidence = result.evidence
    } else if (criterion.type === "numeric") {
      const flags = criterion.case_sensitive ? "m" : "im"
      const match = raw.match(new RegExp(criterion.pattern!, flags))
      const actual = match?.[1] === undefined ? Number.NaN : Number(match[1])
      const expected = criterion.expected as number
      const tolerance = criterion.tolerance ?? 0
      passed = Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance
      evidence = `actual=${actual}; expected=${expected}; tolerance=${tolerance}`
    } else {
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        throw new Error(`criterion ${criterion.id} could not parse JSON in ${criterion.path}`)
      }
      const actual = getJsonPath(parsed, criterion.json_path!)
      if (criterion.type === "json_equals") {
        passed = isDeepStrictEqual(actual, criterion.expected)
      } else if (criterion.type === "json_one_of") {
        passed = Array.isArray(criterion.expected) &&
          criterion.expected.some((expected) => isDeepStrictEqual(actual, expected))
      } else if (criterion.type === "json_text_equals") {
        const scalar = ["string", "number", "boolean"].includes(typeof actual)
          ? String(actual) : undefined
        const matches = textArtifact === undefined ? [] : [
          ...textArtifact.toString("utf8").matchAll(
            new RegExp(criterion.pattern!, criterion.case_sensitive ? "gm" : "gim"),
          ),
        ]
        passed = scalar !== undefined && matches.length === 1 && matches[0]?.[1] !== undefined &&
          normalizeText(matches[0][1].trim(), criterion.case_sensitive) ===
          normalizeText(scalar, criterion.case_sensitive)
      } else {
        const actualSet = Array.isArray(actual)
          ? [...new Set(actual.map((item) => JSON.stringify(item)))].sort()
          : []
        const expectedSet = [...new Set((criterion.expected as unknown[]).map((item) => JSON.stringify(item)))].sort()
        passed = isDeepStrictEqual(actualSet, expectedSet)
      }
      evidence = `json_path=${criterion.json_path}; passed=${passed}`
    }
  }

  return {
    id: criterion.id,
    description: criterion.description,
    type: criterion.type,
    weight: criterion.weight,
    hard_gate: criterion.hard_gate,
    passed,
    evidence,
  }
}

function readRunMetadata(runContents: Buffer, runDir: string): EvaluationRunMetadata {
  let parsed: unknown
  try {
    parsed = JSON.parse(runContents.toString("utf8"))
  } catch (error) {
    throw new Error(`invalid run.json: ${(error as Error).message}`)
  }
  if (!isRecord(parsed)) throw new Error("run.json must contain an object")
  const metadata = parsed as unknown as EvaluationRunMetadata
  const errors: string[] = []
  if (metadata.schema_version !== EVALUATION_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${EVALUATION_SCHEMA_VERSION}`)
  }
  for (const field of [
    "case_id",
    "case_sha256",
    "prompt_sha256",
    "target_sha256",
    "runner",
    "model",
    "started_at",
    "completed_at",
    "output_path",
  ] as const) {
    if (!metadata[field]?.trim()) errors.push(`${field} is required`)
  }
  for (const field of ["case_sha256", "prompt_sha256", "target_sha256"] as const) {
    if (metadata[field] && !/^[a-f0-9]{64}$/.test(metadata[field])) {
      errors.push(`${field} must be a lowercase SHA-256 digest`)
    }
  }
  if (Number.isNaN(Date.parse(metadata.started_at))) errors.push("started_at must be ISO-8601")
  if (Number.isNaN(Date.parse(metadata.completed_at))) errors.push("completed_at must be ISO-8601")
  if (
    !Number.isNaN(Date.parse(metadata.started_at)) &&
    !Number.isNaN(Date.parse(metadata.completed_at)) &&
    Date.parse(metadata.completed_at) < Date.parse(metadata.started_at)
  ) {
    errors.push("completed_at must not precede started_at")
  }
  try {
    resolveInside(runDir, metadata.output_path, "output_path")
  } catch (error) {
    errors.push((error as Error).message)
  }
  if (errors.length > 0) throw new Error(`invalid run.json:\n- ${errors.join("\n- ")}`)
  return metadata
}

async function gitMetadata(repoRoot: string): Promise<{
  sourceCommit: string | null
  worktreeDirty: boolean | null
}> {
  try {
    const commitProc = Bun.spawn(["git", "rev-parse", "HEAD"], {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "ignore",
    })
    const commit = (await new Response(commitProc.stdout).text()).trim()
    if ((await commitProc.exited) !== 0) return { sourceCommit: null, worktreeDirty: null }

    const statusProc = Bun.spawn(["git", "status", "--porcelain"], {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "ignore",
    })
    const status = await new Response(statusProc.stdout).text()
    if ((await statusProc.exited) !== 0) return { sourceCommit: commit, worktreeDirty: null }
    return { sourceCommit: commit, worktreeDirty: status.trim().length > 0 }
  } catch {
    return { sourceCommit: null, worktreeDirty: null }
  }
}

export async function scoreEvaluationRun(options: {
  repoRoot: string
  casePath: string
  definition: EvaluationCase
  runDir: string
}): Promise<EvaluationReport> {
  const { repoRoot, definition } = options
  const runDir = await realRoot(options.runDir, "run directory")
  const canonicalRepo = await realRoot(repoRoot, "repository")
  const casePath = await canonicalExistingInside(canonicalRepo, options.casePath, "case path")
  const promptPath = await canonicalExistingInside(
    canonicalRepo,
    resolveInside(canonicalRepo, definition.prompt_path, "prompt_path"),
    "prompt_path",
  )
  const targetPath = await canonicalExistingInside(
    canonicalRepo,
    resolveInside(canonicalRepo, definition.target.source, "target.source"),
    "target.source",
  )
  const runArtifact = await resolveRunArtifact(runDir, "run.json", "run metadata")
  if (!runArtifact.exists) throw new Error("invalid run.json: file does not exist")


  const fileCache = new Map<string, Buffer>()
  const readOnce = async (filePath: string): Promise<Buffer> => {
    const cached = fileCache.get(filePath)
    if (cached !== undefined) return cached
    const contents = await fs.readFile(filePath)
    fileCache.set(filePath, contents)
    return contents
  }

  const caseContents = await readOnce(casePath)
  const promptContents = await readOnce(promptPath)
  // Canonical per-file listing for the target; its digest is sha256Target().
  const targetDigest = await sha256Target(targetPath)
  const targetContents = Buffer.from(targetDigest, "utf8")
  const runContents = await readOnce(runArtifact.path)
  const metadata = readRunMetadata(runContents, runDir)
  if (metadata.case_id !== definition.id) {
    throw new Error(`run case_id ${metadata.case_id} does not match ${definition.id}`)
  }
  const currentDigests = {
    case_sha256: sha256Contents(caseContents),
    prompt_sha256: sha256Contents(promptContents),
    target_sha256: targetDigest,
  }
  for (const field of ["case_sha256", "prompt_sha256", "target_sha256"] as const) {
    if (metadata[field] !== currentDigests[field]) {
      throw new Error(
        `run ${field} ${metadata[field]} does not match current ${currentDigests[field]}`,
      )
    }
  }
  const snapshottedDefinition = load(caseContents.toString("utf8"))
  if (!isDeepStrictEqual(snapshottedDefinition, definition)) {
    throw new Error("case changed after validation and before scoring")
  }

  const outputArtifact = await resolveRunArtifact(runDir, metadata.output_path, "output_path")
  if (!outputArtifact.exists) {
    throw new Error(`output_path does not exist: ${metadata.output_path}`)
  }
  const outputContents = await readOnce(outputArtifact.path)

  const fixtureContents = new Map<string, Buffer>()
  for (const fixture of definition.fixtures) {
    const fixturePath = await canonicalExistingInside(
      canonicalRepo,
      resolveInside(canonicalRepo, fixture.path, "fixture.path"),
      "fixture.path",
    )
    const contents = await readOnce(fixturePath)
    const actualHash = sha256Contents(contents)
    if (actualHash !== fixture.sha256) {
      throw new Error(
        `fixture hash mismatch during scoring for ${fixture.path}: expected ${fixture.sha256}, got ${actualHash}`,
      )
    }
    fixtureContents.set(fixture.path, contents)
  }

  const scoredArtifactContents = new Map<string, Buffer>()
  const scoredArtifactState: EvaluationManifest["scored_artifact_state"] = {}
  const results: CriterionResult[] = []
  for (const criterion of definition.criteria) {
    const artifactPath = await resolveRunArtifact(
      runDir,
      criterion.path,
      `criterion ${criterion.id} path`,
    )
    let artifact: Buffer | undefined
    let artifactType: "file" | "directory" | "other" | "missing" = "missing"
    if (artifactPath.exists) {
      const stats = await fs.stat(artifactPath.path)
      if (stats.isFile()) {
        artifactType = "file"
        artifact = await readOnce(artifactPath.path)
      } else if (stats.isDirectory()) {
        artifactType = "directory"
      } else if (criterion.type !== "file_exists") {
        throw new Error(`criterion ${criterion.id} requires a file artifact: ${criterion.path}`)
      } else {
        artifactType = "other"
      }
    }
    if (artifact !== undefined) {
      scoredArtifactContents.set(criterion.path, artifact)
      scoredArtifactState[criterion.path] = {
        exists: true,
        type: artifactType,
        sha256: sha256Contents(artifact),
      }
    } else {
      scoredArtifactState[criterion.path] = {
        exists: artifactPath.exists,
        type: artifactType,
      }
    }
    let textArtifact: Buffer | undefined
    if (criterion.type === "json_text_equals") {
      const textPath = criterion.text_path!
      const resolvedText = await resolveRunArtifact(runDir, textPath, `criterion ${criterion.id} text_path`)
      if (resolvedText.exists) {
        if (!(await fs.stat(resolvedText.path)).isFile()) {
          throw new Error(`criterion ${criterion.id} requires a file artifact: ${textPath}`)
        }
        textArtifact = await readOnce(resolvedText.path)
        scoredArtifactContents.set(textPath, textArtifact)
        scoredArtifactState[textPath] = {
          exists: true, type: "file", sha256: sha256Contents(textArtifact),
        }
      } else {
        scoredArtifactState[textPath] = { exists: false, type: "missing" }
      }
    }
    results.push(
      await evaluateCriterion(
        criterion,
        artifact,
        criterion.fixture_path ? fixtureContents.get(criterion.fixture_path) : undefined,
        artifactPath.exists,
        textArtifact,
      ),
    )
  }

  const credentialScanContents = new Set<Buffer>([outputContents, ...scoredArtifactContents.values()])
  let credentialScanPassed = true
  for (const contents of credentialScanContents) {
    if (CREDENTIAL_PATTERNS.some((pattern) => pattern.test(contents.toString("utf8")))) {
      credentialScanPassed = false
      break
    }
  }
  const score = results.reduce((sum, result) => sum + (result.passed ? result.weight : 0), 0)
  const maxScore = results.reduce((sum, result) => sum + result.weight, 0)
  const scoreRatio = maxScore === 0 ? 0 : score / maxScore
  const hardGatesPassed = results.filter((result) => result.hard_gate).every((result) => result.passed)
  const git = await gitMetadata(repoRoot)

  const report: EvaluationReport = {
    schema_version: EVALUATION_SCHEMA_VERSION,
    case_id: definition.id,
    target: definition.target,
    source_commit: git.sourceCommit,
    worktree_dirty: git.worktreeDirty,
    target_sha256: currentDigests.target_sha256,
    runner: metadata.runner,
    model: metadata.model,
    started_at: metadata.started_at,
    completed_at: metadata.completed_at,
    output_path: metadata.output_path,
    run_sha256: sha256Contents(runContents),
    output_sha256: sha256Contents(outputContents),
    credential_scan_passed: credentialScanPassed,
    score,
    max_score: maxScore,
    score_ratio: scoreRatio,
    threshold: definition.threshold,
    hard_gates_passed: hardGatesPassed,
    pass: credentialScanPassed && hardGatesPassed && scoreRatio >= definition.threshold,
    criteria: results,
    limitations: definition.limitations,
  }
  reportSnapshots.set(report, {
    caseContents,
    promptContents,
    targetContents,
    runContents,
    outputContents,
    fixtureContents,
    scoredArtifactContents,
    scoredArtifactState,
  })
  return report
}

export async function buildEvaluationManifest(options: {
  report: EvaluationReport
  evaluationContents: string
}): Promise<EvaluationManifest> {
  const snapshot = reportSnapshots.get(options.report)
  if (!snapshot) {
    throw new Error("manifest requires the immutable snapshot used to produce the evaluation report")
  }
  const fixtureSha256: Record<string, string> = {}
  for (const [fixturePath, contents] of snapshot.fixtureContents) {
    fixtureSha256[fixturePath] = sha256Contents(contents)
  }
  const scoredArtifactSha256: Record<string, string> = {}
  for (const [artifactPath, contents] of snapshot.scoredArtifactContents) {
    scoredArtifactSha256[artifactPath] = sha256Contents(contents)
  }
  return {
    schema_version: EVALUATION_SCHEMA_VERSION,
    case_id: options.report.case_id,
    pass: options.report.pass,
    source_commit: options.report.source_commit,
    case_sha256: sha256Contents(snapshot.caseContents),
    prompt_sha256: sha256Contents(snapshot.promptContents),
    target_sha256: snapshot.targetContents.toString("utf8"),
    run_sha256: sha256Contents(snapshot.runContents),
    output_sha256: sha256Contents(snapshot.outputContents),
    evaluation_sha256: sha256Contents(options.evaluationContents),
    fixture_sha256: fixtureSha256,
    scored_artifact_sha256: scoredArtifactSha256,
    scored_artifact_state: snapshot.scoredArtifactState,
  }
}

export async function findCaseById(
  repoRoot: string,
  caseId: string,
): Promise<{ casePath: string; definition: EvaluationCase }> {
  const caseRoot = path.join(repoRoot, "evals", "methodsmith", "cases")
  const matches: string[] = []
  for (const casePath of await findCaseFiles(caseRoot)) {
    try {
      const parsed = load(await fs.readFile(casePath, "utf8"))
      if (isRecord(parsed) && parsed.id === caseId) matches.push(casePath)
    } catch {
      // Targeted scoring validates the requested case only. Whole-registry errors
      // remain the responsibility of eval:validate.
    }
  }
  if (matches.length === 0) throw new Error(`unknown evaluation case: ${caseId}`)
  if (matches.length > 1) {
    throw new Error(`duplicate case id ${caseId}: ${matches.join(" and ")}`)
  }
  const casePath = matches[0]
  return {
    casePath,
    definition: await loadAndValidateCase(repoRoot, casePath),
  }
}
