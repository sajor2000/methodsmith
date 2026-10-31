import { describe, expect, test } from "bun:test"
import { readFile } from "fs/promises"
import { promises as fs } from "fs"
import os from "os"
import path from "path"
import { convertClaudeToOpenCode } from "../src/converters/claude-to-opencode"
import { loadClaudePlugin } from "../src/parsers/claude"
import { writeOpenCodeBundle } from "../src/targets/opencode"

const skillsRoot = path.join(process.cwd(), "plugins", "methodsmith", "skills")

async function readSkill(name: string): Promise<string> {
  return readFile(path.join(skillsRoot, name, "SKILL.md"), "utf8")
}

async function readReference(skill: string, reference: string): Promise<string> {
  return readFile(path.join(skillsRoot, skill, "references", `${reference}.md`), "utf8")
}

const FABRIC_ROUTES = ["coding", "pipelines", "semantic-models", "ml", "kql"]
const R_ROUTES = ["review", "tidyverse", "event-studies", "package-development", "package-testing", "cran", "performance", "targets"]

describe("Fabric and Marimo workflow skills", () => {
  test("ships a complete Fabric routing family", async () => {
    const router = await readSkill("method-fabric")
    const skills = [router, ...(await Promise.all(FABRIC_ROUTES.map((route) => readReference("method-fabric", route))))]

    expect(skills[0]).toContain("Microsoft Fabric Router")
    expect(skills[0]).toContain("read its reference file")
    for (const route of FABRIC_ROUTES) expect(skills[0]).toContain(`\`references/${route}.md\``)
    expect(skills[0]).toContain("`AskUserQuestion` in Claude Code")
    expect(skills[0]).toContain("`request_user_input` in Codex")
    expect(skills[0]).toContain("`AskUser` in Droid")
    expect(skills[0]).toContain("`question` in OpenCode")
    expect(skills[0]).toContain("`ask_user` in Gemini and Pi via `pi-ask-user`")
    expect(skills[0]).toContain("`ToolSearch` with `select:AskUserQuestion`")
    expect(skills[0]).toContain("a pending schema load is not a fallback reason")
    expect(skills[0]).toContain("Only when no blocking tool exists or the call errors")
    expect(skills[0]).toContain("free-form input")
    expect(skills.join("\n")).toContain("data_layer: fabric")
    expect(skills.join("\n")).toContain("fail-loud")
    expect(skills.join("\n")).toContain("SQL analytics endpoint")
  })

  test("keeps Marimo notebooks text-native and validation-first", async () => {
    const marimo = await readSkill("method-marimo")

    expect(marimo).toContain("import marimo as mo")
    expect(marimo).toContain("@app.cell")
    expect(marimo).toContain("marimo check <notebook.py>")
    expect(marimo).toContain("`method-data-qa`")
    expect(marimo).toContain("Do not silently convert a Jupyter notebook")
    expect(marimo).toContain("Do not wrap ordinary reactive dependencies in broad")
  })

  test("routes notebook-capable workflows through shared notebook standards", async () => {
    const names = [
      "method-marimo",
      "method-notebook-edit",
      "method-r",
      "method-work",
      "method-plan",
      "method-data-qa",
      "method-table1",
      "method-figure",
      "method-submission-package",
      "method-fabric",
    ]
    const skills = [
      ...(await Promise.all(names.map(readSkill))),
      await readReference("method-fabric", "coding"),
      await readReference("method-fabric", "ml"),
    ]
    names.push("method-fabric/references/coding.md", "method-fabric/references/ml.md")

    for (const [index, content] of skills.entries()) {
      expect(content, names[index]).toContain("`method-notebook-standards` skill")
    }
  })

  test("ships enforceable notebook topology, narrative, and cell-size standards", async () => {
    const standards = await readSkill("method-notebook-standards")

    expect(standards).toMatch(/ask whether to use one master notebook or a multi-file workflow/i)
    expect(standards).toContain("`AskUserQuestion` in Claude Code")
    expect(standards).toContain("`request_user_input` in Codex")
    expect(standards).toContain("`AskUser` in Droid")
    expect(standards).toContain("`question` in OpenCode")
    expect(standards).toContain("`ToolSearch` with `select:AskUserQuestion`")
    expect(standards).toContain("Only when no blocking tool exists or the call errors")
    expect(standards).toMatch(/Markdown cell or narrative block immediately before every code cell/i)
    expect(standards).toMatch(/fewer than 30 executable lines/i)
    expect(standards).toMatch(/preceding Markdown says why splitting or extraction/i)
    expect(standards).toMatch(/idempotent cells, few globals, no cross-cell mutation/i)
    expect(standards).toMatch(/Preserve metadata and execution order/i)
    expect(standards).toMatch(/named, scoped chunks with nearby narrative/i)
  })

  test("keeps Fabric handoffs usable after OpenCode conversion", async () => {
    const pluginRoot = path.join(process.cwd(), "plugins", "methodsmith")
    const plugin = await loadClaudePlugin(pluginRoot)
    const bundle = convertClaudeToOpenCode(plugin, {
      agentMode: "subagent",
      inferTemperature: false,
      permissions: "none",
    })
    const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "method-fabric-opencode-"))

    try {
      await writeOpenCodeBundle(outputRoot, bundle)

      const converted = await fs.readFile(
        path.join(outputRoot, ".opencode", "skills", "method-fabric", "SKILL.md"),
        "utf8",
      )
      expect(converted).toContain("read its reference file")
      expect(converted).toContain("`references/coding.md`")
      const convertedReference = await fs.readFile(
        path.join(outputRoot, ".opencode", "skills", "method-fabric", "references", "coding.md"),
        "utf8",
      )
      expect(convertedReference).toContain("SQL analytics endpoint")
      expect(converted).toContain("`request_user_input` in Codex")
      expect(converted).toContain("`ToolSearch` with `select:AskUserQuestion`")
      expect(converted).not.toMatch(/`\/method-[a-z0-9-]+`/)
    } finally {
      await fs.rm(outputRoot, { recursive: true, force: true })
    }
  })

  test("keeps notebook topology questions usable after OpenCode conversion", async () => {
    const pluginRoot = path.join(process.cwd(), "plugins", "methodsmith")
    const plugin = await loadClaudePlugin(pluginRoot)
    const bundle = convertClaudeToOpenCode(plugin, {
      agentMode: "subagent",
      inferTemperature: false,
      permissions: "none",
    })
    const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "method-notebook-standards-opencode-"))

    try {
      await writeOpenCodeBundle(outputRoot, bundle)

      const converted = await fs.readFile(
        path.join(outputRoot, ".opencode", "skills", "method-notebook-standards", "SKILL.md"),
        "utf8",
      )
      expect(converted).toMatch(/one master notebook or a multi-file workflow/i)
      expect(converted).toContain("`request_user_input` in Codex")
      expect(converted).toContain("`ToolSearch` with `select:AskUserQuestion`")
      expect(converted).toContain("Only when no blocking tool exists or the call errors")
    } finally {
      await fs.rm(outputRoot, { recursive: true, force: true })
    }
  })

  test("ships the curated R-statistics workflows as router references", async () => {
    const skills = [await readSkill("method-r"), ...(await Promise.all(R_ROUTES.map((route) => readReference("method-r", route))))]
    const combined = skills.join("\n")

    expect(skills[0]).toContain("R Statistics Router")
    for (const route of R_ROUTES) expect(skills[0]).toContain(`\`references/${route}.md\``)
    expect(combined).toContain("staggered adoption")
    expect(combined).toContain("R CMD check")
    expect(combined).toContain("testthat")
    expect(combined).toContain("_targets.R")
    expect(combined).toContain("fail-loud")
  })

  test("keeps R guidance version-aware and evidence-first", async () => {
    const skills = [await readSkill("method-r"), ...(await Promise.all(R_ROUTES.map((route) => readReference("method-r", route))))]
    const combined = skills.join("\n")

    expect(skills[0]).toContain("Ref MCP")
    expect(skills[0]).toContain("Tavily MCP")
    expect(skills[0]).toContain("verification gap")
    expect(await readReference("method-r", "tidyverse")).toContain("relationship")
    expect(await readReference("method-r", "tidyverse")).toContain("unmatched")
    expect(await readReference("method-r", "targets")).toContain("tar_outdated()")
    expect(await readReference("method-r", "cran")).toContain("time-sensitive")
    expect(combined).toContain("pinned")
  })
})
