import { afterEach, expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import { loadAndValidateCase, scoreEvaluationRun, sha256File, sha256Target } from "../scripts/evals/lib"

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

// These fixtures deliberately keep the sidecar correct while changing the advice.
const scenarios = [
  {
    id: "method-meta-uncertainty-contract",
    advice: { normal90_eligible: true, t9_eligible: true, unknown_eligible: false, profile_eligible: false, reported_log_se_eligible: true, invent_symmetric_interval: false, ratio_ci_se_scale: "log", normal_wald_requires_df: false },
    good: "Read the source table to confirm the confidence level and Wald construction. Use log-transformed ratio bounds; normal intervals require no df. Unknown and profile intervals without a source SE remain unresolved.",
    bad: "unknown_eligible: true",
    negated: "Do not claim unknown intervals are reconstructible.",
  },
  {
    id: "method-genome-build-evidence",
    advice: { mismatch_status: "incompatible", no_evidence_status: "unknown", unavailable_tool_status: "uninspected", ready: false, naming_identifies_build: false, p1_blocks_clean_audit: true },
    good: "Header evidence contradicts the declared reference. Missing assembly evidence and unavailable tools are unresolved; naming alone does not establish sequence identity. P1 issues block a clean audit.",
    bad: "ready: true",
    negated: "Do not call an uninspected header verified.",
  },
  {
    id: "method-verify-test-contract",
    advice: { incorrect_negative: "FAIL", noninferiority: "PASS", sequential: "WARN", unknown_sidedness: "WARN" },
    good: "The declared one-sided tail supports the non-inferiority result at alpha .025. Rounding cannot rescue the wrong negative statistic. Sequential adjustment and unknown direction remain unchecked.",
    bad: "unknown_sidedness: PASS",
    negated: "Do not verify an unknown tail or unsupported adjustment.",
  },
  {
    id: "method-cohort-baseline-observability",
    advice: { eligible_at_index: true, requires_full_future_enrollment: false, review_informative_censoring: true },
    good: "Include the person at index. Censor follow-up at disenrollment on day 90; review informative censoring.",
    bad: "Exclude the day-90 patient because the following year of enrollment is incomplete.",
    negated: "Do not exclude the day-90 patient because future enrollment is incomplete.",
  },
  {
    id: "method-model-choice-forward-time",
    advice: { uses_future_training: false, period_transport_is_forward_validation: false, review_outcome_maturation_gap: true, group_patient_encounters: true, single_later_cohort_valid: true },
    good: "Train on earlier calendar periods and assess later periods. Keep patients grouped and check the 90-day label-maturation gap. A frozen model may use one independent later cohort.",
    bad: "We recommend a random split for future deployment.",
    negated: "Do not use a random split for future deployment.",
  },
  {
    id: "method-omics-qc-hidden-aliasing",
    advice: { design_identifiable: false, qc_pass: false, batch_deletion_establishes_validity: false, rank_check_required_without_pc_separation: true },
    good: "The condition contrast is not estimable because condition and batch are completely aliased. A rank check is required even without PC1/PC2 separation. Batch deletion does not establish publication validity.",
    bad: "Batch deletion validates publication.",
    negated: "Batch deletion does not validate publication.",
  },
  {
    id: "method-question-indicated-bundle",
    advice: { unindicated_pressors_fail_adherence: false, requires_all_five_completed_one_hour: false, mortality_ascertainment_includes_post_discharge: true, mortality_endpoint: "30-day all-cause mortality" },
    good: "Population: adult sepsis. Exposure: initiate indicated bundle components at recognition; fluids for hypotension or lactate >=4, vasopressors for hypotension during or after fluids. Comparator: lower adherence to indicated components. Outcome: 30-day all-cause mortality. Ascertainment includes post-discharge linked vital status.",
    bad: "All five actions must be completed within one hour for adherence.",
    negated: "All five actions need not be completed within one hour for adherence.",
  },
] as const

for (const scenario of scenarios) {
  test(`${scenario.id} scores the explanation independently of a correct sidecar`, async () => {
    const repoRoot = process.cwd()
    const casePath = path.join(repoRoot, "evals/methodsmith/cases", scenario.id, "case.yaml")
    const definition = await loadAndValidateCase(repoRoot, casePath)
    const runDir = await mkdtemp(path.join(os.tmpdir(), "scientific-advice-"))
    roots.push(runDir)
    await mkdir(path.join(runDir, "workspace"))
    await writeFile(path.join(runDir, "workspace/advice.json"), JSON.stringify(scenario.advice))
    await writeFile(path.join(runDir, "run.json"), JSON.stringify({
      schema_version: "1.0", case_id: definition.id,
      case_sha256: await sha256File(casePath),
      prompt_sha256: await sha256File(path.join(repoRoot, definition.prompt_path)),
      target_sha256: await sha256Target(path.join(repoRoot, definition.target.source)),
      runner: "deterministic-control", model: "none",
      started_at: "2026-10-27T00:00:00Z", completed_at: "2026-10-27T00:01:00Z",
      output_path: "workspace/advice.json",
    }))
    const rows = Object.entries(scenario.advice).map(([key, value]) => `${key}: ${value}`).join("\n")
    const [firstKey, firstValue] = Object.entries(scenario.advice)[0]!
    const wrongDecision = typeof firstValue === "boolean" ? !firstValue : `${firstValue}-inconsistent`
    const score = () => scoreEvaluationRun({ repoRoot, casePath, definition, runDir })
    // Missing prose must fail closed, even if a runner selects JSON as its primary output.
    try {
      expect((await score()).pass).toBe(false)
    } catch (error) {
      expect(String(error)).toContain("missing")
    }
    for (const [text, expected] of [
      [`${rows}\n${scenario.good}`, true],
      [`${rows}\n${scenario.good}\n${scenario.bad}`, false],
      [`${rows}\n${scenario.good}\n${scenario.negated}`, true],
      [rows, false],
      [scenario.good, false],
      [`${rows.replace(`${firstKey}: ${firstValue}`, `${firstKey}: ${wrongDecision}`)}\n${scenario.good}`, false],
    ] as const) {
      await writeFile(path.join(runDir, "response.md"), `${text}\n`)
      const result = await score()
      expect(result.pass).toBe(expected)
      expect(result.hard_gates_passed).toBe(expected)
    }
    if (scenario.id === "method-question-indicated-bundle") {
      for (const phrase of ["post-discharge", "after discharge", "after hospital discharge", "following discharge", "post-hospital-discharge"]) {
        await writeFile(path.join(runDir, "response.md"), `${rows}\n${scenario.good.replace("post-discharge", phrase)}\n`)
        expect((await score()).pass).toBe(true)
      }
      for (const [outcome, expected] of [
        ["**Outcome:** All-cause death within 30 days of recognition, including deaths after discharge.", true],
        ["Outcome: all-cause mortality by day 30.", true],
        ["Outcome: in-hospital mortality.", false],
        ["Outcome: 90-day all-cause mortality.", false],
      ] as const) {
        const advice = scenario.good.replace("Outcome: 30-day all-cause mortality.", outcome)
        await writeFile(path.join(runDir, "response.md"), `${rows}\n${advice}\n`)
        expect((await score()).pass).toBe(expected)
      }
    }
  })
}
