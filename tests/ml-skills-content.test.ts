import { describe, expect, test } from "bun:test"
import { promises as fs } from "fs"
import path from "path"

const repoRoot = process.cwd()

async function read(relative: string): Promise<string> {
  return fs.readFile(path.join(repoRoot, relative), "utf8")
}

describe("ML skills content contracts", () => {
  test("the model card renders risk distributions and reports missing imbalance facts as gaps", async () => {
    const template = await read(
      "plugins/methodsmith/skills/method-model-card/references/model-card-template.md",
    )
    const skill = await read("plugins/methodsmith/skills/method-model-card/SKILL.md")

    // Risk distributions are an essential measure: the template must render a
    // surface for them, not only name them in prose.
    expect(template).toContain("risk_distribution_fig")
    // A missing imbalance correction is a reported gap, never a silent "none".
    expect(template).not.toContain('default("none")')
    const optionalStart = skill.indexOf("Optional keys")
    expect(optionalStart).toBeGreaterThanOrEqual(0)
    expect(skill.slice(optionalStart, optionalStart + 600)).not.toContain("imbalance_correction")
    expect(skill).toMatch(/imbalance_correction[\s\S]{0,300}report the gap in section 9/i)
  })
  test("instability is a development metric and the run-log schema is authoritative", async () => {
    const schema = await read("plugins/methodsmith/skills/method-ml-track/references/run-log-schema.yaml")
    const skill = await read("plugins/methodsmith/skills/method-ml-track/SKILL.md")

    // instability_mape is a development metric: it belongs before the
    // test-metrics section, not among the locked-model test fields.
    const testCommentIdx = schema.indexOf("  # Test metrics below: held-out design and final locked model only, logged once;")
    expect(testCommentIdx).toBeGreaterThanOrEqual(0)
    expect(schema.indexOf("instability_mape")).toBeLessThan(testCommentIdx)
    // The field lists live in the schema; the SKILL defers to it as authoritative.
    const step3 = skill.slice(skill.indexOf("### Step 3"), skill.indexOf("### Step 4"))
    expect(step3).toContain("references/run-log-schema.yaml")
    expect(step3.toLowerCase()).toContain("authoritative")
    expect(step3).not.toContain("auc_validation_scheme")
    expect(schema).toContain("auc_validation_scheme")
  })
  test("temperature scaling is a one-parameter Platt variant, not an absolute no-intercept claim", async () => {
    const protocol = await read("plugins/methodsmith/skills/method-model-choice/references/ml-training-protocol.md")
    expect(protocol).not.toMatch(/cannot fix calibration-in-the-large/i)
    expect(protocol).toMatch(/one-parameter Platt variant/i)
    expect(protocol).toMatch(/independently correct calibration-in-the-large/i)
    expect(protocol).toMatch(/1706\.04599/)
  })

  test("README routes the ML training protocol and the new model-card essentials", async () => {
    const readme = await read("plugins/methodsmith/README.md")
    const lines = readme.split("\n")
    const longRowFor = (id: string): string => {
      const name = "/" + id
      const row = lines.find((l) => l.includes(name) && l.startsWith("|") && l.length > 120)
      expect(row).toBeDefined()
      return row as string
    }
    const choiceRow = longRowFor("method-model-choice")
    expect(choiceRow).toMatch(/training\/validation protocol/)
    const trackRow = longRowFor("method-ml-track")
    expect(trackRow).toMatch(/instability|log[- ]loss|net benefit/i)
    const cardRow = longRowFor("method-model-card")
    expect(cardRow).toMatch(/risk distribution/i)
  })
})
