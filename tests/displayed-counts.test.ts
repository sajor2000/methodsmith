import { describe, expect, test } from "bun:test"
import { promises as fs } from "fs"
import path from "path"
import { load } from "js-yaml"
import { getMethodsmithCounts } from "../src/release/metadata"

// Every place the README, docs site, brand assets or diagram sources state how
// many skills, agents or reporting checklists Methodsmith ships. The actual
// numbers come from the same source as `bun run release:validate` (agents and
// skills) and from the guideline registry (checklists), so a new skill or a
// retired checklist fails here until every displayed count is updated.
//
// Rendered images (PNG, MP4) cannot be read, so their sources are scanned
// instead: the diagram and video scenes in website/animations, and the brand
// generator, whose outlined SVGs carry their counts in <desc> metadata.

const repoRoot = path.join(import.meta.dir, "..")
const registryPath = path.join(
  repoRoot, "plugins", "methodsmith", "skills", "method-review", "references", "guideline-registry.yaml",
)

const SURFACES = [
  "README.md",
  "plugins/methodsmith/README.md",
  "docs/setup.md",
  "docs/guideline-sources.md",
  "docs/brand/brand.md",
  "website/src/pages/index.js",
  "website/animations/method_visuals.py",
  "website/animations/readme_diagrams.py",
  "website/animations/methodsmith_overview.py",
  "website/static/brand/social-preview.svg",
  "website/static/brand/hero-light.svg",
  "website/static/brand/hero-dark.svg",
  "website/static/brand/demo.svg",
  "plugins/methodsmith/.claude-plugin/plugin.json",
  "plugins/methodsmith/.codex-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
]

type Kind = "skills" | "agents" | "checklists"

// Phrases that state the plugin's own inventory. Counts of something else
// ("30 key skills" in the skill map, a competitor's "49 stated (guidelines and
// risk-of-bias tools)") do not match because the number must sit directly
// before these words.
const PATTERNS: Array<{ kind: Kind; pattern: RegExp }> = [
  { kind: "skills", pattern: /^\|\s*Skills\s*\|\s*(\d+)\s*\|/gi },
  { kind: "agents", pattern: /^\|\s*Agents\s*\|\s*(\d+)\s*\|/gi },
  { kind: "skills", pattern: /\b(\d+) (?:slash )?skills\b/gi },
  { kind: "agents", pattern: /\b(\d+) (?:specialist )?(?:agents|reviewers|review agents|reviewer agents)\b/gi },
  { kind: "checklists", pattern: /\b(\d+) (?:EQUATOR )?(?:reporting )?checklists\b/gi },
  { kind: "checklists", pattern: /\b(\d+) reporting standards\b/gi },
  { kind: "checklists", pattern: /\b(\d+) reporting guidelines\b/gi },
  { kind: "checklists", pattern: /\bacross (\d+) guidelines\b/gi },
]

describe("displayed inventory counts", () => {
  test("every displayed skill, agent and checklist count matches the shipped plugin", async () => {
    const counts = await getMethodsmithCounts(repoRoot)
    const registry = load(await fs.readFile(registryPath, "utf8")) as { guidelines: Record<string, unknown> }
    const actual: Record<Kind, number> = {
      skills: counts.skills,
      agents: counts.agents,
      checklists: Object.keys(registry.guidelines).length,
    }

    const mismatches: string[] = []
    let seen = 0
    for (const surface of SURFACES) {
      const text = await fs.readFile(path.join(repoRoot, surface), "utf8")
      const lines = text.split("\n")
      lines.forEach((line, i) => {
        for (const { kind, pattern } of PATTERNS) {
          for (const match of line.matchAll(pattern)) {
            seen += 1
            const shown = Number(match[1])
            if (shown !== actual[kind]) {
              mismatches.push(`${surface}:${i + 1} shows "${match[0]}" but the plugin ships ${actual[kind]} ${kind}`)
            }
          }
        }
      })
    }

    expect(mismatches).toEqual([])
    // Guard against the scan silently matching nothing after a rewrite.
    expect(seen).toBeGreaterThan(10)
  })
})
