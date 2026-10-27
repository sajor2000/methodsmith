import { afterAll, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs"
import os from "os"
import path from "path"

// Synthetic statistics only. The seam is the verify_stats.py CLI: the model
// extracts printed statistics into a claims file, the script recomputes P
// values from t/F/chi2/z and runs GRIM checks, deterministically and offline.

const script = path.join(
  process.cwd(),
  "plugins",
  "methodsmith",
  "skills",
  "method-verify",
  "scripts",
  "verify_stats.py",
)
const roots: string[] = []

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function workspace(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "statgate-"))
  roots.push(root)
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, content)
  }
  return root
}

function run(cwd: string, args: string[]) {
  const proc = Bun.spawnSync(["python3", script, ...args], { cwd })
  return { code: proc.exitCode, out: proc.stdout.toString(), err: proc.stderr.toString() }
}

type Item = {
  id?: string
  verdict: string
  reasons: string[]
  recomputed_p?: number
  envelope?: [number, number]
  reported_interval?: [number, number]
}
type Report = {
  alpha: number
  summary: { n_total: number; n_pass: number; n_warn: number; n_fail: number; verdict: string }
  items: Item[]
}

function check(cwd: string, claims: string, out = "qc/stat_check.json"): { code: number; report: Report; out: string } {
  const result = run(cwd, ["check", claims, "--out", out])
  return {
    code: result.code,
    out: result.out,
    report: JSON.parse(readFileSync(path.join(cwd, out), "utf8")) as Report,
  }
}

const claims = (items: unknown[]) => JSON.stringify({ alpha: 0.05, items })

describe("statistic recomputation gate", () => {
  test("integral JSON statistic floats match printed strings without widening signed envelopes", () => {
    // Interpolate raw JSON tokens: JSON.stringify would turn 2.0 into 2.
    const items = ["2.0", "-2.0", "2", "-2"].flatMap((value) => [
      `{"statistic":"z","value":${value},"reported_p":"0.100"}`,
      `{"statistic":"z","value":"${value}","reported_p":"0.100"}`,
    ])
    const root = workspace({ "claims.json": `{"items":[${items.join(",")}]}` })
    const { code, report } = check(root, "claims.json")
    expect(code).toBe(0)
    expect(report.items.map((item) => item.verdict)).toEqual([
      "WARN", "WARN", "WARN", "WARN", "PASS", "PASS", "PASS", "PASS",
    ])
    for (let i = 0; i < report.items.length; i += 2) {
      expect(report.items[i]!.envelope).toEqual(report.items[i + 1]!.envelope)
    }
    expect(report.items[0]!.envelope).toEqual(report.items[2]!.envelope)
  })

  test("integral JSON reported P floats match printed strings without false PASS", () => {
    const cases = [
      ["0.50", "1.0", "WARN"], ["-0.50", "1.0", "WARN"],
      ["1.00", "0.0", "WARN"], ["-1.00", "0.0", "WARN"],
      ["0.00", "1.0", "PASS"], ["10.00", "0.0", "PASS"],
      ["0.50", "1", "PASS"], ["1.00", "0", "PASS"],
    ] as const
    const items = cases.flatMap(([value, reported]) => [
      `{"statistic":"z","value":"${value}","reported_p":${reported}}`,
      `{"statistic":"z","value":"${value}","reported_p":"${reported}"}`,
    ])
    const root = workspace({ "claims.json": `{"items":[${items.join(",")}]}` })
    const { code, report } = check(root, "claims.json")
    expect(code).toBe(0)
    expect(report.items.map((item) => item.verdict)).toEqual(cases.flatMap(([, , verdict]) => [verdict, verdict]))
    for (let i = 0; i < report.items.length; i += 2) {
      expect(report.items[i]!.reported_interval).toEqual(report.items[i + 1]!.reported_interval)
    }
  })

  test("scientific notation preserves the place value of the last printed digit", () => {
    const root = workspace({ "claims.json": claims(["2.00", "2.00e0", "20", "2.0e1", "20.0", "2.00e1"]
      .map((value) => ({ statistic: "z", value }))) })
    const { report } = check(root, "claims.json")
    for (const [a, b] of [[0, 1], [2, 3], [4, 5]]) {
      expect(report.items[a!]!.envelope).toEqual(report.items[b!]!.envelope)
    }
  })

  test("extreme lower and upper tails retain small nonzero probabilities", () => {
    const root = workspace({ "claims.json": claims([
      { statistic: "z", value: "10.00", alternative: "greater" },
      { statistic: "z", value: "-10.00", alternative: "less" },
      { statistic: "t", value: "10.00", df: 100, alternative: "greater" },
      { statistic: "t", value: "-10.00", df: 100, alternative: "less" },
    ]) })
    const { report } = check(root, "claims.json")
    // Base R pnorm(-10) and pt(-10, df=100), independently recomputed.
    const expected = [7.619853024160526e-24, 7.619853024160526e-24,
      4.95084449229707e-17, 4.95084449229707e-17]
    report.items.forEach((item, i) => expect(item.recomputed_p! / expected[i]!).toBeCloseTo(1, 8))
  })

  test("one-sided t/z results use the declared direction, including non-inferiority alpha", () => {
    const root = workspace({ "claims.json": claims([
      { statistic: "z", value: "2.05", alternative: "greater", reported_p: "0.0202" },
      { statistic: "z", value: "-2.05", alternative: "less", reported_p: "0.0202" },
      { statistic: "z", value: "-2.05", alternative: "greater", reported_p: "0.9798" },
      { statistic: "t", value: "2.31", df: 78, alternative: "greater", reported_p: "0.01177" },
      { statistic: "t", value: "-2.31", df: 78, alternative: "less", reported_p: "0.01177" },
    ]) })
    const result = run(root, ["check", "claims.json", "--alpha", "0.025", "--out", "qc/one-sided.json"])
    const report = JSON.parse(readFileSync(path.join(root, "qc/one-sided.json"), "utf8")) as Report
    expect(result.code).toBe(0)
    expect(report.items.map((item) => item.verdict)).toEqual(Array(5).fill("PASS"))
    expect(report.items[0]!.recomputed_p).toBeCloseTo(0.02018222, 7)
  })

  test("unsupported P constructions and unknown sidedness remain explicitly unchecked", () => {
    const root = workspace({ "claims.json": claims([
      ...["adjusted", "exact", "permutation", "sequential"].map((p_method) => ({
        statistic: "z", value: "2.05", reported_p: "0.0100", p_method,
      })),
      { statistic: "z", value: "2.05", alternative: "unknown", reported_p: "0.0202" },
    ]) })
    const { report } = check(root, "claims.json")
    for (const item of report.items) {
      expect(item.verdict).toBe("WARN")
      expect(item.recomputed_p).toBeUndefined()
      expect(item.reasons.join(" ")).toContain("not checked")
    }
  })

  test("invalid alternatives and non-finite inputs fail without a false PASS", () => {
    const root = workspace({ "claims.json": claims([
      { statistic: "z", value: "2.05", alternative: "greate" },
      { statistic: "F", value: "4.12", df: [2, 96], alternative: "less" },
      { statistic: "z", value: "NaN" },
      { statistic: "z", value: "Infinity" },
      { statistic: "z", value: "2.05", reported_p: "1.5" },
    ]) })
    const { code, report } = check(root, "claims.json")
    expect(code).toBe(2)
    expect(report.items.map((item) => item.verdict)).toEqual(Array(5).fill("FAIL"))
  })

  test("signed t/z rounding envelopes reject incorrect P values and contain the central P", () => {
    const root = workspace({ "claims.json": claims([
      { statistic: "z", value: "-2.00", reported_p: "0.500" },
      { statistic: "z", value: "2.00", reported_p: "0.500" },
      { statistic: "t", value: "-3.00", df: 30, reported_p: "0.500" },
      { statistic: "z", value: "0.0", reported_p: "1.000" },
    ]) })
    const { code, report } = check(root, "claims.json")
    expect(code).toBe(2)
    expect(report.items.map((item) => item.verdict)).toEqual(["FAIL", "FAIL", "FAIL", "PASS"])
    expect(report.items[0]!.envelope).toEqual(report.items[1]!.envelope)
    for (const item of report.items) {
      expect(item.envelope![0]).toBeLessThanOrEqual(item.recomputed_p!)
      expect(item.envelope![1]).toBeGreaterThanOrEqual(item.recomputed_p!)
    }
  })

  test("statistic rounding retains the original printed decimal precision", () => {
    const root = workspace({ "claims.json": claims(
      ["2", "2.0", "2.00"].map((value) => ({ statistic: "z", value })),
    ) })
    const { report } = check(root, "claims.json")
    const widths = report.items.map((item) => item.envelope![1] - item.envelope![0])
    expect(widths[0]!).toBeGreaterThan(widths[1]! * 9)
    expect(widths[1]!).toBeGreaterThan(widths[2]! * 9)
    expect(report.items[2]!.envelope![0]).toBeCloseTo(0.0449631, 6)
    expect(report.items[2]!.envelope![1]).toBeCloseTo(0.0460429, 6)
  })

  test("recomputes two-sided P from t, F, chi2 and z to scipy precision", () => {
    const root = workspace({
      "claims.json": claims([
        { id: "t1", statistic: "t", value: "2.31", df: 78 },
        { id: "f1", statistic: "F", value: "4.12", df: [2, 96] },
        { id: "c1", statistic: "chi2", value: "3.84", df: 1 },
        { id: "z1", statistic: "z", value: "1.96" },
        { id: "t2", statistic: "t", value: "12.706", df: 1 },
      ]),
    })
    const { code, report } = check(root, "claims.json")
    expect(code).toBe(0)
    // Ground truth from scipy.stats, pinned so CI never needs scipy.
    const p = (id: string) => report.items.find((item) => item.id === id)!.recomputed_p!
    expect(p("t1")).toBeCloseTo(0.02353339, 6)
    expect(p("f1")).toBeCloseTo(0.01920295, 6)
    expect(p("c1")).toBeCloseTo(0.05004352, 6)
    expect(p("z1")).toBeCloseTo(0.04999579, 6)
    expect(p("t2")).toBeCloseTo(0.0500008, 6)
    // No reported P to compare: these are PASS with the recomputed value attached.
    expect(report.items.every((item) => item.verdict === "PASS")).toBe(true)
  })

  test("a reported P inside the rounding envelope of the recomputed P is PASS", () => {
    const root = workspace({
      "claims.json": claims([
        { id: "t1", statistic: "t", value: "2.31", df: 78, reported_p: "0.024" },
        { id: "f1", statistic: "F", value: "4.12", df: [2, 96], reported_p: "0.019" },
        { id: "c1", statistic: "chi2", value: "3.84", df: 1, reported_p: "0.050" },
        { id: "z1", statistic: "z", value: "1.96", reported_p: "0.05" },
      ]),
    })
    const { code, report } = check(root, "claims.json")
    expect(code).toBe(0)
    expect(report.summary.n_pass).toBe(4)
    expect(report.summary.verdict).toBe("PASS")
  })

  test("a reported P that crosses alpha against the recomputation is FAIL and exits 2", () => {
    const root = workspace({
      // chi2=5.20, df=1 recomputes to p=0.0226 (below alpha); reported 0.064
      // claims non-significance: a decision error, not a rounding artifact.
      "claims.json": claims([{ id: "c1", statistic: "chi2", value: "5.20", df: 1, reported_p: "0.064" }]),
    })
    const { code, report } = check(root, "claims.json")
    expect(code).toBe(2)
    expect(report.items[0]!.verdict).toBe("FAIL")
    expect(report.summary.verdict).toBe("FAIL")
  })

  test("an inconsistent P that stays on the same side of alpha is WARN and exits 0", () => {
    const root = workspace({
      // t=2.31, df=78 recomputes to 0.0236; reported 0.040 is inconsistent but
      // both remain below alpha, so it does not block.
      "claims.json": claims([{ id: "t1", statistic: "t", value: "2.31", df: 78, reported_p: "0.040" }]),
    })
    const { code, report } = check(root, "claims.json")
    expect(code).toBe(0)
    expect(report.items[0]!.verdict).toBe("WARN")
    expect(report.summary.verdict).toBe("WARN")
  })

  test("the decision boundary follows the declared alpha, not a fixed 0.05", () => {
    const root = workspace({
      "claims.json": claims([{ id: "c1", statistic: "chi2", value: "5.20", df: 1, reported_p: "0.064" }]),
    })
    const { code, report } = check(root, "claims.json", "qc/a.json")
    expect(code).toBe(2)
    // Against alpha=0.01, recomputed [0.0225, 0.0227] and reported [0.0635,
    // 0.0645] are both non-significant: inconsistent but not a decision error.
    const relaxed = run(root, ["check", "claims.json", "--alpha", "0.01", "--out", "qc/b.json"])
    expect(relaxed.code).toBe(0)
    const relaxedReport = JSON.parse(readFileSync(path.join(root, "qc", "b.json"), "utf8")) as Report
    expect(relaxedReport.items[0]!.verdict).toBe("WARN")
    expect(report.alpha).toBe(0.05)
    expect(relaxedReport.alpha).toBe(0.01)
  })

  test("GRIM fails a mean no integer sum can produce, passes one rounding can explain", () => {
    const root = workspace({
      "claims.json": claims([
        // 3.4 x 3 = 10.2: no integer sum rounds to 3.4 (10/3=3.33, 11/3=3.67).
        { id: "m1", check: "grim", kind: "mean", value: "3.4", n: 3, granularity: 1, granularity_source: "declared" },
        // 51.3 x 15 = 769.5: not an integer, but 769/15=51.267 prints as 51.3,
        // so a naive GRIM check would flag what rounding fully explains.
        { id: "m2", check: "grim", kind: "mean", value: "51.3", n: 15, granularity: 1, granularity_source: "declared" },
      ]),
    })
    const { code, report } = check(root, "claims.json")
    expect(code).toBe(2)
    expect(report.items[0]!.verdict).toBe("FAIL")
    expect(report.items[1]!.verdict).toBe("PASS")
  })

  test("GRIM checks percentages against an integer numerator", () => {
    const root = workspace({
      "claims.json": claims([
        // 25.0% of 6 needs 1.5 people: impossible.
        { id: "p1", check: "grim", kind: "percent", value: "25.0", n: 6 },
        // 57.1% of 7 is 4/7 = 57.143: consistent at one decimal.
        { id: "p2", check: "grim", kind: "percent", value: "57.1", n: 7 },
      ]),
    })
    const { code, report } = check(root, "claims.json")
    expect(code).toBe(2)
    expect(report.items[0]!.verdict).toBe("FAIL")
    expect(report.items[1]!.verdict).toBe("PASS")
  })

  test("an impossible mean under an inferred granularity is WARN, not FAIL", () => {
    const root = workspace({
      // 3.4 of n=3 is impossible only if the variable is integer-granular;
      // the granularity was inferred (age in whole years), not declared.
      "claims.json": claims([{ id: "m1", check: "grim", kind: "mean", value: "3.4", n: 3, granularity: 1 }]),
    })
    const { code, report } = check(root, "claims.json")
    expect(code).toBe(0)
    expect(report.items[0]!.verdict).toBe("WARN")
  })

  test("malformed and unknown-statistic items fail closed rather than being skipped", () => {
    const root = workspace({
      "claims.json": claims([
        { id: "x1", statistic: "wilcoxon", value: "3.2", df: 1, reported_p: "0.05" },
        { id: "x2", statistic: "t", value: "2.3", reported_p: "0.03" },
        { id: "x3", statistic: "F", value: "2.1", df: 2, reported_p: "0.13" },
        { id: "x4", check: "grim", kind: "mean", value: "3.4", n: 0 },
      ]),
    })
    const { code, report } = check(root, "claims.json")
    expect(code).toBe(2)
    expect(report.items.map((item) => item.verdict)).toEqual(["FAIL", "FAIL", "FAIL", "FAIL"])
    expect(report.items[0]!.reasons.join(" ")).toContain("unknown statistic")
    expect(report.items[1]!.reasons.join(" ")).toContain("df")
    expect(report.items[2]!.reasons.join(" ")).toContain("df1 and df2")
    expect(report.items[3]!.reasons.join(" ")).toContain("n")
  })

  test("an unreadable claims file exits 1 with an error, and the report lands in --out", () => {
    const root = workspace({ "claims.json": claims([]) })
    const missing = run(root, ["check", "absent.json"])
    expect(missing.code).toBe(1)
    expect(missing.err).toContain("no such file")
    const bad = workspace({ "claims.json": "{not json" })
    const parse = run(bad, ["check", "claims.json"])
    expect(parse.code).toBe(1)
    expect(parse.err).toContain("could not parse")
    const empty = check(root, "claims.json")
    expect(empty.code).toBe(0)
    expect(empty.report.summary.n_total).toBe(0)
    expect(empty.report.summary.verdict).toBe("PASS")
  })
})
