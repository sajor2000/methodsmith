import { describe, expect, test } from "bun:test"
import { readFile } from "fs/promises"
import path from "path"

const clifRoot = path.join(process.cwd(), "plugins", "methodsmith", "skills", "method-clif")
const setupRoot = path.join(process.cwd(), "plugins", "methodsmith", "skills", "method-setup")
const skillsRoot = path.join(process.cwd(), "plugins", "methodsmith", "skills")
const agentsRoot = path.join(process.cwd(), "plugins", "methodsmith", "agents")

async function readClif(relativePath: string): Promise<string> {
  return readFile(path.join(clifRoot, relativePath), "utf8")
}

async function readSetup(relativePath: string): Promise<string> {
  return readFile(path.join(setupRoot, relativePath), "utf8")
}

async function readSkill(relativePath: string): Promise<string> {
  return readFile(path.join(skillsRoot, relativePath), "utf8")
}

function expectContainsAll(text: string, snippets: string[]): void {
  for (const snippet of snippets) {
    expect(text).toContain(snippet)
  }
}

describe("CLIF guidance", () => {
  test("selects an explicit matching CLIF and mCIDE version family", async () => {
    const files = await Promise.all([
      readClif("SKILL.md"),
      readClif("references/clif-rules.md"),
      readClif("references/mcide-vocab.md"),
      readClif("references/version-families.md"),
      readClif("references/r-template-recipes.md"),
    ])
    const combined = files.join("\n")

    expectContainsAll(combined, [
      "CLIF 2.1 + mCIDE 2.1",
      "CLIF 3.0 + mCIDE 3.0",
      "`method-clif --version 2.1.0`  -> CLIF 2.1.0 + mCIDE 2.1.0",
      "`method-clif --version 3.0.0`  -> CLIF 3.0.0 + mCIDE 3.0.0",
      "selection=explicit",
      "mcide_version=",
      "Which CLIF and mCIDE version family should this project use?",
      "Never silently choose a family",
      "Do not validate against the bundled v2.1 cache",
    ])
    expect(combined).toMatch(/Never\s+infer `3\.0\.0` merely from an/)
    expect(combined).toMatch(/lowercase\s+snake_case mCIDE permissible values/)
    expect(combined).not.toContain("last verified 2026-06-02")
    expect(combined).toContain("https://clif-icu.com/")
    expect(combined).toContain("Core source")
    expect(combined).not.toContain("2.1.1")
    expect(combined).not.toContain("2.2.0")
    expect(combined).not.toContain("Default `version=2.1.0`")
  })

  test("points Python users at current clifpy install guidance", async () => {
    const recipes = await readClif("references/clifpy-recipes.md")

    expectContainsAll(recipes, [
      "python3 -m pip install --upgrade clifpy",
      "uv add clifpy",
      "https://clif-icu.com/",
      "Preserve a project's existing lockfile",
      "current `clifpy` user guide",
    ])
    expect(recipes).not.toContain("0.4.9")
    expect(recipes).not.toContain("clifpy==")
    expect(recipes).toContain("Python >=3.10")
  })

  test("asks once for PHI authorization and preserves the official output boundary", async () => {
    const [rules, clifSkill, workSkill, workGate, codeReviewSkill, phiReviewer, verifyCatalog] = await Promise.all([
      readClif("references/clif-rules.md"),
      readClif("SKILL.md"),
      readSkill("method-work/SKILL.md"),
      readSkill("method-work/references/phi-environment.md"),
      readSkill("method-review/SKILL.md"),
      readFile(path.join(agentsRoot, "method-phi-leak-reviewer.md"), "utf8"),
      readSkill("method-verify/references/check-catalog.md"),
    ])
    const combined = [rules, clifSkill, workSkill, codeReviewSkill, phiReviewer].join("\n")

    expectContainsAll(rules, [
      "`approved` or `no-sensitive-data`: proceed silently and never mention the boundary again",
      "ask once",
      "`Approved endpoint: full access`",
      "`PHI authorization: confirmed` marker counts as `approved`",
      "**Never** share, commit, upload",
      "declared approved restricted data root",
      "approved, local, non-synced",
      "output/intermediate_phi/",
      "output/final_no_phi/",
    ])
    expectContainsAll(clifSkill, [
      "sensitive-data boundary in `references/clif-rules.md`",
      "apply\nin every mode",
    ])
    expectContainsAll(workSkill, [
      "Common-Longitudinal-ICU-data-Format",
      "read `references/phi-environment.md` and apply its gate",
    ])
    expectContainsAll(workGate, [
      "Unset, headless: schema-only.",
      "agent, autofix, report-only, or headless mode",
      "PHI authorization: not confirmed",
    ])
    expectContainsAll(codeReviewSkill, [
      "Common-Longitudinal-ICU-data-Format",
      "PHI authorization: confirmed",
      "PHI authorization: not confirmed",
      "PHI-safe scope preflight",
      "inherit the active session model with no model override",
      "preflight-approved paths and PHI-free",
      "With `PHI authorization: confirmed`, no reviewer has content limits",
    ])
    expectContainsAll(phiReviewer, [
      "`PHI authorization: confirmed` counts as `approved` (never downgrade it)",
      "without a marker, treat the run as headless",
      "never commit PHI to Git",
    ])
    expect(combined).not.toContain("Never give an agent PHI or RHI")
    expect(combined).not.toContain("when in doubt, flag at 100")
    expect(codeReviewSkill.indexOf("PHI-safe scope preflight")).toBeLessThan(codeReviewSkill.indexOf("git diff -U10"))
    expect(rules).not.toContain("Mask or hash before printing")
    expect(verifyCatalog).toContain("permit patient-level working data only in gitignored `output/intermediate_phi/`")
  })

  test("uses the official template workflow and distribution gate", async () => {
    const [rules, template, plan, lifecycle] = await Promise.all([
      readClif("references/clif-rules.md"),
      readSkill("method-clif-template/SKILL.md"),
      readSkill("method-plan/references/sap-mode-workflow.md"),
      readSkill("method-workflow/references/lifecycle-paths.md"),
    ])
    const combined = [rules, template, plan, lifecycle].join("\n")

    expectContainsAll(combined, [
      "cohort → quality checks → outlier handling → analysis",
      "output/intermediate_phi/",
      "output/final_no_phi/",
      "clif_demo",
      "BUDDY_TEST_REPORT.md",
      "block for distribution readiness",
    ])
    expect(combined).not.toContain("QC → cohort → analysis")
    expect(combined).not.toContain("three-script architecture (`code/01_qc_*")
  })

  test("keeps CLIF language routing portable across converted targets", async () => {
    const [cohort, dataQa, sapMode, work] = await Promise.all([
      readSkill("method-cohort/SKILL.md"),
      readSkill("method-data-qa/SKILL.md"),
      readSkill("method-plan/references/sap-mode-workflow.md"),
      readSkill("method-work/SKILL.md"),
    ])
    const combined = [cohort, dataQa, sapMode, work].join("\n")

    expect(combined).toContain("load the `method-language-detect` skill")
    expect(combined).not.toContain("/method-language-detect")
  })

  test("keeps recipe calls and vocabulary coverage aligned to current clifpy and mCIDE", async () => {
    const [recipes, vocabulary, versions] = await Promise.all([
      readClif("references/clifpy-recipes.md"),
      readClif("references/mcide-vocab.md"),
      readClif("references/version-families.md"),
    ])

    expectContainsAll(recipes, [
      "run_full_dqa",
      "run_stitch_encounters",
      "convert_dose_units_for_continuous_meds",
      "calculate_mdro_flags",
      "calculate_cci",
      "calculate_elix",
      "apply_outlier_handling",
      "convert_wide_to_hourly",
    ])
    for (const staleCall of [
      "co.run_dqa(",
      "co.stitch_encounters(",
      ".standardize_units(",
      "co.flag_mdro(",
      "co.compute_charlson_comorbidity(",
      "compute_sofa_scores(\n    preferred_units=",
    ]) {
      expect(recipes).not.toContain(staleCall)
    }
    expectContainsAll(vocabulary, [
      "## invasive_hemodynamics",
      "cardiac_output_thermodilution",
      "## key_icu_orders",
      "PT_evaluation",
    ])
    expect(versions).toContain("Several v3 tables remain Alpha")
    expect(versions).toContain("does not certify v3 category validation")
  })

  test("keeps clifpy recipes runnable against the verified clifpy API", async () => {
    const [recipes, clifpySkill, pitfalls] = await Promise.all([
      readClif("references/clifpy-recipes.md"),
      readSkill("method-clifpy/SKILL.md"),
      readSkill("method-clifpy/references/pitfalls.md"),
    ])

    // generate_text_report(validation_data, table_name, output_path): table_name is positional.
    expect(recipes).not.toContain("generate_text_report(results, output_path=")
    expect(recipes).toContain('generate_text_report(results, "labs",')
    // Legacy SOFA needs all four pressors in mcg/kg/min, including dobutamine.
    expect(recipes).toContain("dobutamine")
    expect(recipes).not.toContain("Python >=3.9")
    expectContainsAll(clifpySkill, ["calculate_sofa2", "Python 3.10", "schema is not None", "method-clif-audit"])
    expectContainsAll(pitfalls, ["clif_version: 3.0", "BinderException", "sample IDs"])
  })

  test("routes full CLIF repository audits and uses one small-cell rule", async () => {
    const [clifSkill, rules, template, audit, checklist] = await Promise.all([
      readClif("SKILL.md"),
      readClif("references/clif-rules.md"),
      readSkill("method-clif-template/SKILL.md"),
      readSkill("method-clif-audit/SKILL.md"),
      readSkill("method-clif-audit/references/audit-checklist.md"),
    ])

    expect(clifSkill).toContain("`method-clif-audit`")
    expect(template).toContain("`method-clif-audit`")
    expect(audit).toContain("more than 10 patients per cell")
    expect(checklist).toContain("CA-61 Threshold")
    for (const text of [clifSkill, rules, template]) {
      expect(text).not.toContain("`n >= 10` floor")
      expect(text).not.toContain("(the CLIF project floor)")
    }
    // The CLIF repository removed these directories; they are no longer protected paths.
    expect(rules).not.toContain("- `outlier-handling/**`")
    expect(rules).not.toContain("outlier-thresholds/    #")
  })

  test("setup workflow exposes CLIF-aware package and uv defaults", async () => {
    const setupSkill = await readSetup("SKILL.md")
    const configTemplate = await readSetup("references/config-template.yaml")
    const stackTemplate = await readSetup("references/stack-profile-template.yaml")
    const healthScript = await readSetup("scripts/check-health")

    expectContainsAll(setupSkill.replace(/\s+/g, " "), [
      "clif_profile_active=true",
      "Weak CLIF signals require two or more matches",
      "profile: clif",
      "mcide_version",
      "Which CLIF and mCIDE version family should this project use?",
      "CLIF Parquet files (recommended)",
      "clifpy (recommended official CLIF client)",
      "polars (recommended for large CLIF tables)",
      "duckdb",
      "pyarrow",
      "pandera (schema validation; used in CLIF-MIMIC)",
      "sf-hamilton (pipeline DAGs; used in CLIF-MIMIC)",
      "tableone (Table 1; used in CLIF project repos)",
      "gtsummary (Table 1 and summaries; CLIF template)",
      "cmprsk (competing risks; used in CLIF mobilization analyses)",
      "uv (recommended for current CLIF Python repos and reproducible uv.lock files)",
      "Marimo (recommended for current CLIF Python examples)",
    ])
    expectContainsAll(configTemplate, ["mcide_version", "python: uv", "python: [clifpy, polars]"])
    expectContainsAll(stackTemplate, [
      "CLIF + uv + clifpy/polars + Marimo/Jupyter",
      "mcide_version",
      "python: [uv, venv, conda, poetry, pixi, none]",
    ])
    expect(healthScript).toContain("uv|command -v uv|optional")
  })
})
