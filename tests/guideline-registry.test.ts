import { describe, expect, test } from "bun:test"
import { promises as fs } from "fs"
import path from "path"
import { load } from "js-yaml"

const repoRoot = path.join(import.meta.dir, "..")
const checklistRoot = path.join(repoRoot, "plugins", "methodsmith", "skills", "method-review", "references")
const registryPath = path.join(checklistRoot, "guideline-registry.yaml")

type GuidelineRegistry = {
  guidelines: Record<string, {
    file: string
    aliases?: string[]
    primary_for?: string[]
    extension_for?: string[]
    role?: string
    ai_extension?: boolean
  }>
}

describe("reporting guideline registry", () => {
  test("tracks every shipped reporting checklist file", async () => {
    const registry = load(await fs.readFile(registryPath, "utf8")) as GuidelineRegistry
    const entries = registry.guidelines
    const registeredFiles = Object.values(entries).map((entry) => entry.file).sort()
    const checklistFiles = (await fs.readdir(checklistRoot))
      .filter((file) => file.endsWith("-checklist.md"))
      .sort()

    expect(Object.keys(entries)).toHaveLength(47)
    expect(registeredFiles).toEqual(checklistFiles)

    for (const [name, entry] of Object.entries(entries)) {
      expect(name).toMatch(/^[A-Z0-9+-]+$/)
      expect(entry.file).toMatch(/-checklist\.md$/)
      expect(typeof entry.ai_extension).toBe("boolean")
      expect(await fs.stat(path.join(checklistRoot, entry.file))).toBeDefined()
    }
  })

  test("public docs and reviewer descriptions agree on the registry count", async () => {
    const rootReadme = await fs.readFile(path.join(repoRoot, "README.md"), "utf8")
    const pluginReadme = await fs.readFile(path.join(repoRoot, "plugins", "methodsmith", "README.md"), "utf8")
    const reviewer = await fs.readFile(path.join(repoRoot, "plugins", "methodsmith", "agents", "method-reporting-checklist-reviewer.md"), "utf8")
    const routingMap = await fs.readFile(path.join(checklistRoot, "guideline-routing.md"), "utf8")

    const count = Object.keys((load(await fs.readFile(registryPath, "utf8")) as GuidelineRegistry).guidelines).length
    const reviewerBody = reviewer.replace(/^---[\s\S]*?\n---\n/, "")

    expect(rootReadme).toContain(`${count} reporting checklists`)
    expect(pluginReadme).toContain(`${count} standards`)
    expect(pluginReadme).toContain(`${count} guidelines`)
    // The reviewer description names the registry, not a count that goes stale.
    expect(reviewer).toMatch(/^description:.*guideline registry/m)
    expect(reviewer).not.toMatch(/^description:.*\d+ guidelines/m)
    // The reviewer body must not hard-code a stale count either.
    for (const match of reviewerBody.matchAll(/(\d+) guidelines/g)) expect(Number(match[1])).toBe(count)
    expect(routingMap).toContain("guideline-registry.yaml")
    expect(routingMap).not.toMatch(/\b35 supported\b/)
  })
})
