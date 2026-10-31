import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import path from "path"

const repoRoot = path.join(import.meta.dir, "..")
const json = (relativePath: string) => JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8"))

const TAGLINE =
  "Rigorous methods for statistics, machine learning, and meta-analysis, from question to paper. Every study compounds."
const REPO_URL = "https://github.com/sajor2000/methodsmith"

describe("Methodsmith identity in every manifest", () => {
  test("plugin manifests name the plugin methodsmith, show Methodsmith, and point at the renamed repo", () => {
    const claude = json("plugins/methodsmith/.claude-plugin/plugin.json")
    const codex = json("plugins/methodsmith/.codex-plugin/plugin.json")
    const cursor = json("plugins/methodsmith/.cursor-plugin/plugin.json")
    for (const manifest of [claude, codex, cursor]) {
      expect(manifest.name).toBe("methodsmith")
      expect(manifest.description).toBe(TAGLINE)
      expect(manifest.homepage).toBe("https://sajor2000.github.io/methodsmith/")
      expect(manifest.repository).toBe(REPO_URL)
    }
    expect(codex.interface.displayName).toBe("Methodsmith")
    expect(cursor.displayName).toBe("Methodsmith")
  })

  test("marketplaces are named methodsmith and list the methodsmith plugin", () => {
    const claude = json(".claude-plugin/marketplace.json")
    const cursor = json(".cursor-plugin/marketplace.json")
    const codex = json(".agents/plugins/marketplace.json")
    const factory = json(".factory-plugin/marketplace.json")
    for (const marketplace of [claude, cursor, codex, factory]) {
      expect(marketplace.name).toBe("methodsmith")
      expect(marketplace.plugins.map((plugin: { name: string }) => plugin.name)).toEqual(["methodsmith"])
    }
    expect(codex.interface.displayName).toBe("Methodsmith")
    expect(claude.metadata.description).not.toMatch(/computational scientists/)
    expect(factory.plugins[0].source).toBe("./plugins/methodsmith")
  })

  test("Codex card: short description fits 30 characters and starter prompts are domain commands", () => {
    const { interface: card } = json("plugins/methodsmith/.codex-plugin/plugin.json")
    expect(card.shortDescription.length).toBeLessThanOrEqual(30)
    expect(card.longDescription).toContain("Compound Engineering")
    expect(card.defaultPrompt.length).toBeLessThanOrEqual(3)
    for (const prompt of card.defaultPrompt) {
      expect(prompt).toMatch(/^\/method-/)
      expect(prompt.length).toBeLessThanOrEqual(60)
    }
    expect(card.defaultPrompt.join(" ")).toContain("/method-sap")
    expect(card.defaultPrompt.join(" ")).toContain("/method-table1")
  })

  test("the npm package is methodsmith and points at the renamed repo", () => {
    const pkg = json("package.json")
    expect(pkg.name).toBe("methodsmith")
    expect(pkg.bin).toEqual({ methodsmith: "src/index.ts" })
    expect(pkg.homepage).toBe(REPO_URL)
    expect(pkg.repository).toBe(REPO_URL)
  })
})
