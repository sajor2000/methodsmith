import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

// Runs pool_effects.R on synthetic rows when Rscript and the meta package are
// available locally; CI has no R, so r-script-guards.test.ts pins the same fixes.
const script = path.join(process.cwd(), "plugins", "methodsmith", "skills", "method-meta-analysis", "scripts", "pool_effects.R")
const hasR =
  spawnSync("Rscript", ["-e", "quit(status = !(requireNamespace('meta', quietly = TRUE) && requireNamespace('ggplot2', quietly = TRUE)))"]).status === 0

const header = "pmid,year,first_author,sample_size,metric,effect,effect_lo,effect_hi,study_type"

const contract = {
  population: "adult ICU patients", comparator: "standard care", estimand: "marginal mortality HR", outcome: "mortality", time_horizon: "90 days",
  adjustment_specification: "none", adjusted: "false", analysis_scale: "ratio", unit: "dimensionless",
  study_design: "randomized", independent_unit_id: "",
  ci_method: "wald_normal", ci_level: "0.95", ci_rounding_tolerance: "0.01", uncertainty_source: "synthetic source table",
}

describe.skipIf(spawnSync("Rscript", ["--version"]).status !== 0)("effect uncertainty extraction with base R", () => {
  test("uses declared confidence level and t df, preserves reported SEs, and rejects unresolved intervals", () => {
    const helper = path.join(path.dirname(script), "effect_uncertainty.R")
    const code = `
source(${JSON.stringify(helper)})
row <- function(method="wald_normal", level=.95, df=NA) data.frame(
  effect=2, effect_lo=2-qnorm(.975), effect_hi=2+qnorm(.975),
  ci_method=method, ci_level=level, ci_df=df, ci_rounding_tolerance=1e-10,
  uncertainty_source="synthetic source table")
normal <- row(); stopifnot(abs(effect_uncertainty(normal, FALSE)$se_te - 1) < 1e-10)
ninety <- row(level=.90); ninety$effect_lo <- 2-qnorm(.95); ninety$effect_hi <- 2+qnorm(.95)
stopifnot(abs(effect_uncertainty(ninety, FALSE)$se_te - 1) < 1e-10)
small <- row("wald_t", .95, 9); small$effect_lo <- 2-qt(.975,9); small$effect_hi <- 2+qt(.975,9)
stopifnot(abs(effect_uncertainty(small, FALSE)$se_te - 1) < 1e-10)
ratio <- normal; ratio$effect <- exp(2); ratio$effect_lo <- exp(normal$effect_lo); ratio$effect_hi <- exp(normal$effect_hi)
stopifnot(abs(effect_uncertainty(ratio, TRUE)$se_te - 1) < 1e-10)
reported <- data.frame(effect=.8, standard_error=.12, standard_error_scale="log", uncertainty_source="source SE")
stopifnot(effect_uncertainty(reported, TRUE)$se_te == .12)
bad <- list(row("profile"), row("unknown"), row(level=NA), row("wald_t",.95,NA))
asym <- row(); asym$effect_hi <- asym$effect_hi+1; bad[[length(bad)+1]] <- asym
missing <- row(); missing$uncertainty_source <- ""; bad[[length(bad)+1]] <- missing
wrong <- reported; wrong$standard_error_scale <- "ratio"; bad[[length(bad)+1]] <- wrong
for (i in seq_along(bad)) {
  rejected <- tryCatch({effect_uncertainty(bad[[i]], i==length(bad)); FALSE}, error=function(e) TRUE)
  stopifnot(rejected)
}
cat("validated normal95, normal90, t9, log scale, reported SE and 7 rejection cases\\n")
`
    const proc = spawnSync("Rscript", ["-e", code], { encoding: "utf8" })
    expect(proc.status, proc.stderr).toBe(0)
    expect(proc.stdout).toContain("7 rejection cases")
  })
})

function run(rows: string[], overrides: Record<string, string[]> = {}, extraArgs: string[] = []) {
  const dir = mkdtempSync(path.join(tmpdir(), "pool-effects-"))
  const input = path.join(dir, "in.csv")
  const out = path.join(dir, "out.md")
  const keys = Object.keys(contract)
  const inputRows = rows.map((row, i) => row + "," + keys.map((key) =>
    overrides[key]?.[i] ?? (key === "independent_unit_id" ? `trial-${i}` : contract[key as keyof typeof contract])
  ).join(","))
  writeFileSync(input, [header + "," + keys.join(","), ...inputRows].join("\n") + "\n")
  const proc = spawnSync("Rscript", [script, "--in", input, "--metric", "HR", "--out", out, ...extraArgs], { encoding: "utf8" })
  return { stdout: proc.stdout, stderr: proc.stderr, code: proc.status, md: existsSync(out) ? readFileSync(out, "utf8") : null, out }
}

describe.skipIf(!hasR)("pool_effects.R on synthetic rows", () => {
  const comparable = [
    "1001,2020,A,300,HR,0.80,0.65,0.98,RCT",
    "1002,2021,B,400,HR,0.75,0.60,0.94,RCT",
    "1003,2022,C,500,HR,0.85,0.70,1.03,RCT",
  ]

  test("rejects mixed estimands, adjustment sets, units, horizons and dependent contributions before output", () => {
    for (const [key, values] of Object.entries({
      population: ["adult ICU patients", "pediatric ICU patients", "adult ICU patients"],
      comparator: ["standard care", "active drug", "standard care"],
      estimand: ["marginal mortality HR", "conditional mortality HR", "marginal mortality HR"],
      adjusted: ["false", "true", "false"],
      adjustment_specification: ["none", "age-sex", "none"],
      unit: ["dimensionless", "percent", "dimensionless"],
      time_horizon: ["90 days", "28 days", "90 days"],
      study_design: ["randomized", "nonrandomized", "randomized"],
      independent_unit_id: ["same-trial", "same-trial", "third-trial"],
      analysis_scale: ["ratio", "log-ratio", "ratio"],
    })) {
      const r = run(comparable, { [key]: values })
      expect(r.code).not.toBe(0)
      expect(r.stderr).toContain("compatibility")
      expect(r.stdout).not.toContain("__CE_EFFECT_SIZE__")
      expect(r.md).toBeNull()
    }
  }, 30_000)

  test("rejects missing scientific declarations and unknown options", () => {
    const missing = run(comparable, { estimand: ["", "", ""] })
    expect(missing.code).not.toBe(0)
    expect(missing.md).toBeNull()
    const unknown = run(comparable, {}, ["--adjusted", "false"])
    expect(unknown.code).not.toBe(0)
    expect(unknown.stderr).toContain("unknown option")
    expect(unknown.md).toBeNull()
  })

  test("rejects ratio metrics with non-dimensionless units", () => {
    const r = run(comparable, { unit: ["percent", "percent", "percent"] })
    expect(r.code).not.toBe(0)
    expect(r.stderr).toContain("unit=dimensionless")
    expect(r.md).toBeNull()
  })

  test("emits the selected scientific contract with the power handoff", () => {
    const r = run(comparable)
    expect(r.code).toBe(0)
    expect(r.stdout).toContain("contract=")
    expect(readFileSync(r.out.replace(/\.md$/, "-contract.csv"), "utf8")).toContain("marginal mortality HR")
  })

  test("keeps studies with a missing sample size when no size filter is set", () => {
    const { stdout } = run([
      "1001,2020,A,,HR,0.80,0.65,0.98,RCT",
      "1002,2021,B,400,HR,0.75,0.60,0.94,RCT",
      "1003,2022,C,500,HR,0.85,0.70,1.03,RCT",
    ])
    expect(stdout).toContain("3 studies enter pooling")
  })

  test("does not anchor on a non-randomized study as if it were an RCT", () => {
    const { md } = run([
      "2001,2023,A,5000,HR,0.70,0.60,0.82,non-randomized cohort",
      "2002,2019,B,300,HR,0.85,0.70,1.03,randomized controlled trial",
    ])
    expect(md).toContain("Anchor study: PMID 2002")
  })
})
