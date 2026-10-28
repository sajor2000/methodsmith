import { describe, expect, test } from "bun:test"
import { readFile } from "fs/promises"
import path from "path"

const skillDir = path.join(process.cwd(), "plugins", "methodsmith", "skills", "method-grill")

async function read(rel: string): Promise<string> {
  return readFile(path.join(skillDir, rel), "utf8")
}

describe("method-grill research-project interview", () => {
  test("routes research planning through the scoped interview and preserves headless gaps", async () => {
    const planDir = path.join(process.cwd(), "plugins", "methodsmith", "skills", "method-plan")
    const plan = await readFile(path.join(planDir, "SKILL.md"), "utf8")
    const foundations = await readFile(path.join(planDir, "references", "planning-foundations.md"), "utf8")
    const grill = await read("SKILL.md")
    expect(plan).toContain("even without SAP keywords or code")
    expect(plan).toContain("references/planning-foundations.md")
    expect(foundations).toContain("load `method-grill` in its planning-integration mode")
    expect(foundations).toContain("do not interview or fabricate answers")
    expect(grill).toContain("### Planning integration")
  })
  test("asks one question at a time with a recommended answer first", async () => {
    const content = await read("SKILL.md")

    expect(content).toMatch(/one question at a time/i)
    expect(content).toMatch(/One question per turn, always with a recommended answer/)
    expect(content).toMatch(/recommended answer first and labeled "\(Recommended\)"/)
    expect(content).toMatch(/up to 4 options/)
    expect(content).toMatch(/blocking question UI/)
  })

  test("covers all seven branches in the skill and the question bank", async () => {
    const content = await read("SKILL.md")
    const bank = await read("references/question-bank.md")

    for (const branch of ["Goal", "Task and deliverable", "Hypothesis", "Data", "Proposed analysis", "Target journal", "Audience"]) {
      expect(content).toContain(`| ${branch} |`)
      expect(bank).toContain(`## ${branch}`)
    }
    expect(bank).toMatch(/Immortal time bias/)
    expect(bank).toMatch(/mediators or colliders/)
  })

  test("looks up facts instead of asking and respects the PHI boundary", async () => {
    const content = await read("SKILL.md")

    expect(content).toMatch(/Never ask the user for something you can find/)
    expect(content).toContain("phi_environment.mode")
    expect(content).toMatch(/In `schema-only`, ask about data by schema, counts, and definitions, never for pasted rows/)
  })

  test("confirms shared understanding, saves the record, and never writes the SAP", async () => {
    const content = await read("SKILL.md")
    const template = await read("references/grill-record-template.md")

    expect(content).toMatch(/confirm the shared understanding before saving/)
    expect(content).toContain("docs/brainstorms/<YYYY-MM-DD>-<slug>-grill.md")
    expect(content).toMatch(/Do not write the SAP/)
    expect(content).toContain("`references/question-bank.md`")
    expect(content).toContain("`references/grill-record-template.md`")
    expect(template).toContain("type: grill-record")
    expect(template).toContain("| # | Branch | Question | Recommended | Chosen | Why it matters |")
    expect(template).toContain("## Reviewer attack list")
  })
})
