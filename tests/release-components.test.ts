import { describe, expect, test } from "bun:test"
import {
  applyOverride,
  bumpVersion,
  detectComponentsFromFiles,
  inferBumpFromIntent,
  parseReleaseIntent,
  resolveComponentWarnings,
} from "../src/release/components"

describe("release component detection", () => {
  test("maps plugin-only changes to the matching plugin component", () => {
    const components = detectComponentsFromFiles([
      "plugins/methodsmith/skills/method-plan/SKILL.md",
    ])

    expect(components.get("methodsmith")).toEqual([
      "plugins/methodsmith/skills/method-plan/SKILL.md",
    ])
    expect(components.get("cli")).toEqual([])
    expect(components.get("marketplace")).toEqual([])
  })

  test("detects coding-tutor changes alongside cli changes", () => {
    // coding-tutor is release-managed: it has release-please config and manifest
    // entries, so a change under plugins/coding-tutor/ must map to its own
    // component rather than silently receiving no version bump.
    const components = detectComponentsFromFiles([
      "src/commands/install.ts",
      "plugins/coding-tutor/.claude-plugin/plugin.json",
    ])

    expect(components.get("cli")).toEqual(["src/commands/install.ts"])
    expect(components.get("coding-tutor")).toEqual([
      "plugins/coding-tutor/.claude-plugin/plugin.json",
    ])
  })

  test("maps claude marketplace metadata without bumping plugin components", () => {
    const components = detectComponentsFromFiles([".claude-plugin/marketplace.json"])
    expect(components.get("marketplace")).toEqual([".claude-plugin/marketplace.json"])
    expect(components.get("cursor-marketplace")).toEqual([])
    expect(components.get("methodsmith")).toEqual([])
  })

  test("maps cursor marketplace metadata to cursor-marketplace component", () => {
    const components = detectComponentsFromFiles([".cursor-plugin/marketplace.json"])
    expect(components.get("cursor-marketplace")).toEqual([".cursor-plugin/marketplace.json"])
    expect(components.get("marketplace")).toEqual([])
    expect(components.get("methodsmith")).toEqual([])
  })

})

describe("release intent parsing", () => {
  test("parses conventional titles with optional scope and breaking marker", () => {
    const parsed = parseReleaseIntent("feat(cli)!: add install reset flow")
    expect(parsed.type).toBe("feat")
    expect(parsed.scope).toBe("cli")
    expect(parsed.breaking).toBe(true)
    expect(parsed.description).toBe("add install reset flow")
  })

  test("supports conventional titles without scope", () => {
    const parsed = parseReleaseIntent("fix: adjust method-plan wording")
    expect(parsed.type).toBe("fix")
    expect(parsed.scope).toBeNull()
    expect(parsed.breaking).toBe(false)
  })

  test("infers bump levels from parsed intent", () => {
    expect(inferBumpFromIntent(parseReleaseIntent("feat: add release preview"))).toBe("minor")
    expect(inferBumpFromIntent(parseReleaseIntent("fix: correct preview output"))).toBe("patch")
    expect(inferBumpFromIntent(parseReleaseIntent("docs: update requirements"))).toBeNull()
    expect(inferBumpFromIntent(parseReleaseIntent("refactor!: break compatibility"))).toBe("major")
  })
})

describe("override handling", () => {
  test("keeps inferred bump when override is auto", () => {
    expect(applyOverride("patch", "auto")).toBe("patch")
  })

  test("promotes inferred bump when override is explicit", () => {
    expect(applyOverride("patch", "minor")).toBe("minor")
    expect(applyOverride(null, "major")).toBe("major")
  })

  test("increments semver versions", () => {
    expect(bumpVersion("2.42.0", "patch")).toBe("2.42.1")
    expect(bumpVersion("2.42.0", "minor")).toBe("2.43.0")
    expect(bumpVersion("2.42.0", "major")).toBe("3.0.0")
  })
})

describe("scope mismatch warnings", () => {
  test("does not require scope when omitted", () => {
    const warnings = resolveComponentWarnings(
      parseReleaseIntent("fix: update ce plan copy"),
      ["methodsmith"],
    )
    expect(warnings).toEqual([])
  })

  test("warns when explicit scope contradicts detected files", () => {
    const warnings = resolveComponentWarnings(
      parseReleaseIntent("fix(cli): update plugin text"),
      ["methodsmith"],
    )
    expect(warnings[0]).toContain('Optional scope "cli" does not match')
  })
})
