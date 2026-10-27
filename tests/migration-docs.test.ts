import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import path from "path"
import { renamedCommandsTable } from "../scripts/rebrand/rename"

const repoRoot = path.join(import.meta.dir, "..")
const read = (relativePath: string) => readFileSync(path.join(repoRoot, relativePath), "utf8")
const docs = ["README.md", "plugins/methodsmith/README.md", "docs/setup.md"]
const TAGLINE =
  "Rigorous methods for statistics, machine learning, and meta-analysis, from question to paper. Every study compounds."

describe("Methodsmith docs", () => {
  test("the README hero names Methodsmith and carries the tagline", () => {
    const readme = read("README.md")
    expect(readme.split("\n")[0]).toBe("# Methodsmith")
    expect(readme).toContain(TAGLINE)
    expect(read("plugins/methodsmith/README.md").split("\n")[0]).toBe("# Methodsmith")
  })

  for (const doc of docs) {
    test(`${doc} has the migration guide with a per-harness switch and the full command table`, () => {
      const text = read(doc)
      expect(text).toMatch(/^#{2,3} Moving from ce-datascience$/m) // rebrand:keep
      expect(text).toContain("claude plugin marketplace add sajor2000/methodsmith")
      expect(text).toContain("claude plugin install methodsmith@methodsmith")
      expect(text).toContain("bunx github:sajor2000/methodsmith install methodsmith --to opencode")
      expect(text).toContain("codex plugin marketplace add sajor2000/methodsmith")
      expect(text).toContain(renamedCommandsTable())
      expect(text).toContain("mv .ce-datascience .methodsmith") // rebrand:keep
    })

    test(`${doc} credits Every's Compound Engineering`, () => {
      expect(read(doc)).toMatch(/Compound Engineering[\s\S]{0,200}Every|Every[\s\S]{0,200}Compound Engineering/)
    })
  }
})
