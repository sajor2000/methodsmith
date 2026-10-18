import { describe, expect, test } from "bun:test"
import { promises as fs } from "fs"
import path from "path"

// Every shipped skill carries an eval set in Anthropic skill-creator's format
// (https://github.com/anthropics/skills/tree/main/skills/skill-creator):
// evals.json holds realistic task prompts with verifiable expectations, and
// trigger-evals.json holds should/should-not trigger queries for description
// optimization (skill-creator's run_loop.py). They live outside the skill
// directories so they are not shipped with the plugin.

const repoRoot = process.cwd()
const skillsRoot = path.join(repoRoot, "plugins", "methodsmith", "skills")
const evalsRoot = path.join(repoRoot, "evals", "methodsmith", "skill-creator")
const EVALS_PER_SKILL = 3
const TRIGGER_QUERIES_PER_SKILL = 20
const MIN_EXPECTATIONS = 3

type SkillEval = { id: number; prompt: string; expected_output: string; files: string[]; expectations: string[] }
type TriggerEval = { query: string; should_trigger: boolean }

const skills = (await fs.readdir(skillsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(file, "utf8")) as T
}

describe("skill-creator eval sets", () => {
  test("every skill has evals.json and trigger-evals.json, and no eval set is orphaned", async () => {
    const missing: string[] = []
    for (const skill of skills) {
      for (const file of ["evals.json", "trigger-evals.json"]) {
        await fs.access(path.join(evalsRoot, skill, file)).catch(() => missing.push(`${skill}/${file}`))
      }
    }
    const orphaned = (await fs.readdir(evalsRoot)).filter((dir) => !skills.includes(dir))
    expect(missing).toEqual([])
    expect(orphaned).toEqual([])
  })

  test("evals.json follows the skill-creator schema with verifiable expectations", async () => {
    const problems: string[] = []
    for (const skill of skills) {
      const data = await readJson<{ skill_name: string; evals: SkillEval[] }>(path.join(evalsRoot, skill, "evals.json"))
      if (data.skill_name !== skill) problems.push(`${skill}: skill_name is "${data.skill_name}"`)
      if (!Array.isArray(data.evals) || data.evals.length !== EVALS_PER_SKILL) {
        problems.push(`${skill}: expected ${EVALS_PER_SKILL} evals`)
        continue
      }
      data.evals.forEach((item, index) => {
        if (item.id !== index + 1) problems.push(`${skill}: eval ids must run 1..${EVALS_PER_SKILL}`)
        if (!item.prompt?.trim() || !item.expected_output?.trim()) problems.push(`${skill}#${item.id}: empty prompt or expected_output`)
        if (!Array.isArray(item.files)) problems.push(`${skill}#${item.id}: files must be an array`)
        if (!Array.isArray(item.expectations) || item.expectations.length < MIN_EXPECTATIONS) {
          problems.push(`${skill}#${item.id}: needs at least ${MIN_EXPECTATIONS} expectations`)
        }
      })
    }
    expect(problems).toEqual([])
  })

  test("trigger-evals.json is a balanced set of distinct should/should-not trigger queries", async () => {
    const problems: string[] = []
    for (const skill of skills) {
      const data = await readJson<TriggerEval[]>(path.join(evalsRoot, skill, "trigger-evals.json"))
      if (!Array.isArray(data) || data.length !== TRIGGER_QUERIES_PER_SKILL) {
        problems.push(`${skill}: expected ${TRIGGER_QUERIES_PER_SKILL} trigger queries`)
        continue
      }
      const positives = data.filter((item) => item.should_trigger === true).length
      const negatives = data.filter((item) => item.should_trigger === false).length
      if (positives !== TRIGGER_QUERIES_PER_SKILL / 2 || negatives !== TRIGGER_QUERIES_PER_SKILL / 2) {
        problems.push(`${skill}: needs ${TRIGGER_QUERIES_PER_SKILL / 2} positive and negative queries (got ${positives}/${negatives})`)
      }
      const queries = data.map((item) => item.query?.trim().toLowerCase())
      if (queries.some((query) => !query)) problems.push(`${skill}: empty trigger query`)
      if (new Set(queries).size !== queries.length) problems.push(`${skill}: duplicate trigger queries`)
    }
    expect(problems).toEqual([])
  })

  test("eval prompts stay synthetic: no identifiers that look like real patient data or secrets", async () => {
    const suspicious = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN-shaped
      /\bMRN[:#\s]*\d{5,}\b/i,
      /\b(?:sk|ghp|xox[bp])-?[A-Za-z0-9]{20,}\b/, // API-token-shaped
    ]
    const offenders: string[] = []
    for (const skill of skills) {
      for (const file of ["evals.json", "trigger-evals.json"]) {
        const raw = await fs.readFile(path.join(evalsRoot, skill, file), "utf8")
        if (suspicious.some((pattern) => pattern.test(raw))) offenders.push(`${skill}/${file}`)
      }
    }
    expect(offenders).toEqual([])
  })

  test("method-model-choice keeps the MMRM covariance-identifiability advice eval", async () => {
    const data = await readJson<{ skill_name: string; evals: SkillEval[] }>(
      path.join(evalsRoot, "method-model-choice", "evals.json"),
    )
    const mmrm = data.evals.find((item) => /MMRM/i.test(item.prompt))
    expect(mmrm).toBeDefined()
    expect(mmrm!.expectations.join(" ").toLowerCase()).toContain("non-identifiability")
  })

  test("method-model-choice trigger evals include a prediction-model training-protocol query", async () => {
    const data = await readJson<TriggerEval[]>(
      path.join(evalsRoot, "method-model-choice", "trigger-evals.json"),
    )
    const matches = data.filter(
      (item) =>
        item.should_trigger &&
        /training (?:and )?validation protocol|prediction model/i.test(item.query),
    )
    expect(matches.length).toBeGreaterThan(0)
  })

  test("method-ml-track evals cover the protocol run-log metric fields", async () => {
    const raw = await fs.readFile(path.join(evalsRoot, "method-ml-track", "evals.json"), "utf8")
    for (const field of [
      "log_loss_validation",
      "auprc_validation",
      "net_benefit_test",
      "instability_mape",
    ]) {
      expect(raw.includes(field)).toBe(true)
    }
  })

  test("method-ml-track trigger evals include a proper-score and instability logging query", async () => {
    const data = await readJson<TriggerEval[]>(
      path.join(evalsRoot, "method-ml-track", "trigger-evals.json"),
    )
    const matches = data.filter(
      (item) => item.should_trigger && /log.?loss|instability/i.test(item.query),
    )
    expect(matches.length).toBeGreaterThan(0)
  })

  test("method-model-card trigger evals include an essential-measures documentation query", async () => {
    const data = await readJson<TriggerEval[]>(
      path.join(evalsRoot, "method-model-card", "trigger-evals.json"),
    )
    const matches = data.filter(
      (item) => item.should_trigger && /risk distribution|net benefit/i.test(item.query),
    )
    expect(matches.length).toBeGreaterThan(0)
  })
})
