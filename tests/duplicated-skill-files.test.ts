import { describe, expect, test } from "bun:test"
import { createHash } from "crypto"
import { readdirSync, readFileSync, statSync } from "fs"
import path from "path"

// Skills cannot share files (AGENTS.md), so shared helpers are copied into each skill.
// A copy that drifts silently changes behavior in one skill only. Scripts with the same
// name anywhere in the plugin must be byte-identical; references are often legitimately
// different under the same name, so only the families declared below are pinned.

const pluginRoot = path.join(process.cwd(), "plugins", "methodsmith")
const skillsRoot = path.join(pluginRoot, "skills")

/** Reference files copied verbatim between skills. Add a family when you copy a reference. */
const SHARED_REFERENCES: Record<string, string[]> = {
  "html-rendering.md": ["method-brainstorm", "method-plan"],
  "html-visuals.md": ["method-brainstorm", "method-plan"],
  "markdown-rendering.md": ["method-brainstorm", "method-plan"],
}

function files(dir: string): string[] {
  let out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (name === "__pycache__" || name === ".DS_Store") continue
    const full = path.join(dir, name)
    out = statSync(full).isDirectory() ? out.concat(files(full)) : out.concat(full)
  }
  return out
}

const digest = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex")
const rel = (file: string) => path.relative(process.cwd(), file)

describe("duplicated skill files stay identical", () => {
  test("every script that exists in more than one place is byte-identical", () => {
    const scripts = [
      ...files(path.join(pluginRoot, "scripts")),
      ...readdirSync(skillsRoot).flatMap((skill) => files(path.join(skillsRoot, skill, "scripts"))),
    ]
    const byName = new Map<string, string[]>()
    for (const file of scripts) byName.set(path.basename(file), [...(byName.get(path.basename(file)) ?? []), file])
    const drifted: string[] = []
    for (const [name, copies] of byName) {
      if (copies.length < 2) continue
      if (new Set(copies.map(digest)).size > 1) drifted.push(`${name}: ${copies.map(rel).join(", ")}`)
    }
    expect(drifted, "copy the canonical script over the drifted copies").toEqual([])
  })

  for (const [name, skills] of Object.entries(SHARED_REFERENCES)) {
    test(`${name} is identical across ${skills.join(", ")}`, () => {
      const copies = skills.map((skill) => path.join(skillsRoot, skill, "references", name))
      expect(new Set(copies.map(digest)).size).toBe(1)
    })
  }
})
