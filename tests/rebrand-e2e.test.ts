/**
 * End-to-end checks that the Methodsmith rename works as installed software,
 * not just as text. Every install runs against throwaway HOME, CODEX_HOME,
 * XDG_CONFIG_HOME, and CLAUDE_CONFIG_DIR folders; nothing touches real user
 * folders. Checks that need an optional CLI (claude, codex) or a built
 * website skip with a reason when it is missing. CI installs the Claude CLI
 * and builds the website before running tests.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { spawnSync } from "child_process"
import { existsSync, readFileSync, readdirSync } from "fs"
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import rebrandMap from "../scripts/rebrand/mapping.json"

const repoRoot = path.join(import.meta.dir, "..")
const pluginDir = path.join(repoRoot, "plugins", "methodsmith")
const cli = path.join(repoRoot, "src", "index.ts")
const OLD_RELEASE_TAG = "ce-datascience-v4.1.0" // rebrand:keep
const OLD_PLUGIN = rebrandMap.plugin.old
const SLOW = 180_000

const has = (command: string) => spawnSync("sh", ["-c", `command -v ${command}`]).status === 0
const shippedSkills = readdirSync(path.join(pluginDir, "skills")).sort()
const shippedAgents = readdirSync(path.join(pluginDir, "agents"))
  .filter((name) => name.endsWith(".md"))
  .map((name) => name.slice(0, -3))
  .sort()
const oldNames = new Set([...Object.keys(rebrandMap.skills), ...Object.keys(rebrandMap.agents)])

const scratch: string[] = []
afterAll(async () => {
  await Promise.all(scratch.map((dir) => rm(dir, { recursive: true, force: true })))
})

/** A throwaway HOME plus the env that keeps every harness inside it. */
async function sandbox(label: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), `methodsmith-e2e-${label}-`))
  scratch.push(root)
  const home = path.join(root, "home")
  await mkdir(home, { recursive: true })
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !/^(OPENCODE_CONFIG_DIR|CODEX_HOME|CLAUDE_CONFIG_DIR|AGENTS_HOME|XDG_CONFIG_HOME)$/.test(key)) env[key] = value
  }
  Object.assign(env, {
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, ".config"),
    CODEX_HOME: path.join(home, ".codex"),
    CLAUDE_CONFIG_DIR: path.join(home, ".claude"),
    AGENTS_HOME: path.join(home, ".agents"),
  })
  const run = (args: string[], cwd = repoRoot) => {
    const result = spawnSync(args[0], args.slice(1), { cwd, env, encoding: "utf8", timeout: SLOW })
    return { status: result.status, out: `${result.stdout ?? ""}${result.stderr ?? ""}` }
  }
  return { root, home, env, run }
}

/** Every file and directory name under dir, as POSIX paths relative to dir. */
function walk(dir: string, skip: (relative: string) => boolean = () => false): string[] {
  const found: string[] = []
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      const relative = path.relative(dir, full).split(path.sep).join("/")
      if (skip(relative)) continue
      found.push(relative)
      if (entry.isDirectory()) visit(full)
    }
  }
  if (existsSync(dir)) visit(dir)
  return found
}

const isBackup = (relative: string) => /(^|\/)(backups|legacy-backup)(\/|$)/.test(relative)
const OLD_PREFIX = /^ce-/ // rebrand:keep
const ceNamed = (relative: string) => relative.split("/").some((segment) => OLD_PREFIX.test(segment) || segment === OLD_PLUGIN)

describe("1. plugin validation", () => {
  test.skipIf(!has("claude"))("claude plugin validate passes for the plugin folder and the marketplace", async () => {
    const { run } = await sandbox("validate")
    for (const target of [pluginDir, path.join(repoRoot, ".claude-plugin", "marketplace.json")]) {
      const result = run(["claude", "plugin", "validate", target])
      expect(result.out).toContain("Validation passed")
      expect(result.status).toBe(0)
    }
  }, SLOW)
})

describe("2. fresh Claude Code install from a local marketplace", () => {
  test.skipIf(!has("claude"))("lists methodsmith with every method-* skill and agent", async () => {
    const { run } = await sandbox("claude")
    expect(run(["claude", "plugin", "marketplace", "add", repoRoot]).status).toBe(0)
    expect(run(["claude", "plugin", "install", "methodsmith@methodsmith"]).status).toBe(0)
    const details = run(["claude", "plugin", "details", "methodsmith@methodsmith"]).out
    const listed = (label: string) =>
      (details.match(new RegExp(`${label} \\(\\d+\\)\\s+(.+)`))?.[1] ?? "").split(", ").map((name) => name.trim()).sort()
    expect(listed("Skills")).toEqual(shippedSkills)
    expect(listed("Agents")).toEqual(shippedAgents)
    expect(details).not.toMatch(/\bce-[a-z]/)
  }, SLOW)
})

describe("3. fresh Codex install through the repo installer", () => {
  test.skipIf(!has("codex"))("registers the methodsmith marketplace and writes method-* agents into a new CODEX_HOME", async () => {
    const { home, run } = await sandbox("codex")
    const codexHome = path.join(home, ".codex") // deliberately not created first
    const result = run(["bash", "install.sh", "codex", "--source", repoRoot, "--codex-home", codexHome, "--agents-home", path.join(home, ".agents")])
    expect(result.out).not.toContain("does not exist")
    expect(result.status).toBe(0)
    expect(run(["codex", "plugin", "marketplace", "list"]).out).toMatch(/^methodsmith\s/m)
    const agents = readdirSync(path.join(codexHome, "agents", "methodsmith")).map((file) => file.replace(/\.toml$/, "")).sort()
    expect(agents).toEqual(shippedAgents)
    expect(walk(codexHome, isBackup).filter(ceNamed)).toEqual([])
  }, SLOW)
})

describe("4. converter installs", () => {
  const targets: Array<{ name: string; args: (home: string) => string[]; root: (home: string) => string }> = [
    { name: "opencode", args: () => [], root: (home) => path.join(home, ".config", "opencode") },
    { name: "pi", args: (home) => ["--pi-home", path.join(home, ".pi", "agent")], root: (home) => path.join(home, ".pi", "agent") },
    { name: "gemini", args: (home) => ["--output", home], root: (home) => path.join(home, ".gemini") },
  ]
  for (const target of targets) {
    test(`${target.name}: installs method-* names and no ce- names`, async () => {
      const { home, run } = await sandbox(target.name)
      const result = run(["bun", "run", cli, "install", pluginDir, "--to", target.name, ...target.args(home)])
      expect(result.status).toBe(0)
      const names = walk(target.root(home), isBackup)
      expect(names.filter(ceNamed)).toEqual([])
      const skills = readdirSync(path.join(target.root(home), "skills")).filter((name) => name.startsWith("method-"))
      expect(skills.length).toBeGreaterThanOrEqual(shippedSkills.length - 5)
    }, SLOW)
  }
})

describe("5. old names are no longer aliased", () => {
  test("the Claude alias installer writes only method-* aliases", async () => {
    const { root, run } = await sandbox("aliases")
    const commandsDir = path.join(root, "commands")
    expect(run(["bash", "scripts/install/install-claude-aliases.sh", "--plugin-dir", pluginDir, "--commands-dir", commandsDir]).status).toBe(0)
    const written = readdirSync(commandsDir)
    expect(written.filter((name) => !name.startsWith("method-"))).toEqual([])
    expect(written.length).toBe(shippedSkills.length)
  }, SLOW)
})

describe(`6. migration from a ${OLD_PLUGIN} 4.1.0 install`, () => {
  let oldRoot = ""
  beforeAll(async () => {
    const hasTag = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${OLD_RELEASE_TAG}^{commit}`], { cwd: repoRoot }).status === 0
    if (!hasTag) return
    oldRoot = await mkdtemp(path.join(os.tmpdir(), "methodsmith-e2e-old-release-"))
    scratch.push(oldRoot)
    const archive = spawnSync("sh", ["-c", `git archive ${OLD_RELEASE_TAG} | tar -x -C "${oldRoot}"`], { cwd: repoRoot })
    if (archive.status !== 0) throw new Error(`could not extract ${OLD_RELEASE_TAG}`)
    spawnSync("ln", ["-s", path.join(repoRoot, "node_modules"), path.join(oldRoot, "node_modules")])
  }, SLOW)

  const userSkill = (name: string, description: string) => `---\nname: ${name}\ndescription: ${description}\n---\n\nThe user's own skill.\n`

  const targets: Array<{ name: string; args: (home: string) => string[]; root: (home: string) => string; skills: boolean }> = [
    { name: "opencode", args: () => [], root: (home) => path.join(home, ".config", "opencode"), skills: true },
    { name: "pi", args: (home) => ["--pi-home", path.join(home, ".pi", "agent")], root: (home) => path.join(home, ".pi", "agent"), skills: true },
    { name: "codex", args: (home) => ["--codex-home", path.join(home, ".codex")], root: (home) => path.join(home, ".codex"), skills: false },
  ]

  for (const target of targets) {
    test(`${target.name}: upgrades to methodsmith, keeps the user's skills, and backs up every old plugin file`, async () => {
      if (!oldRoot) {
        console.warn(`skipped: tag ${OLD_RELEASE_TAG} is not available (fetch tags to run this check)`)
        return
      }
      const { home, run } = await sandbox(`migrate-${target.name}`)
      await mkdir(path.join(home, ".codex"), { recursive: true })
      const root = target.root(home)

      // A real 4.1.0 install, made by the 4.1.0 CLI.
      const oldInstall = run(["bun", "run", "src/index.ts", "install", `./plugins/${OLD_PLUGIN}`, "--to", target.name, ...target.args(home)], oldRoot)
      expect(oldInstall.status).toBe(0)
      const before = walk(root, isBackup).filter(ceNamed)
      expect(before.length).toBeGreaterThan(0)

      // The user's own skills, one of them named like a retired plugin skill.
      const userSkills = {
        "ce-review": userSkill("ce-review", "My own checklist for reviewing lab notebooks."), // rebrand:keep
        "lab-notes": userSkill("lab-notes", "Keeps my lab notes."),
      }
      for (const [name, content] of Object.entries(userSkills)) {
        await mkdir(path.join(root, "skills", name), { recursive: true })
        await writeFile(path.join(root, "skills", name, "SKILL.md"), content)
      }

      const upgrade = run(["bun", "run", cli, "install", pluginDir, "--to", target.name, ...target.args(home)])
      expect(upgrade.status).toBe(0)

      for (const [name, content] of Object.entries(userSkills)) {
        expect(readFileSync(path.join(root, "skills", name, "SKILL.md"), "utf8")).toBe(content)
      }
      const leftovers = walk(root, isBackup)
        .filter(ceNamed)
        .filter((relative) => !relative.startsWith("skills/ce-review")) // rebrand:keep
      expect(leftovers).toEqual([])
      const backedUp = walk(root).filter(isBackup).map((relative) => path.basename(relative))
      expect(backedUp.some((name) => oldNames.has(name.replace(/\.(md|toml)$/, "")))).toBe(true)
      if (target.skills) {
        const skills = readdirSync(path.join(root, "skills")).filter((name) => name.startsWith("method-"))
        expect(skills.length).toBeGreaterThanOrEqual(shippedSkills.length - 5)
      }
    }, SLOW)
  }

  test("method-update reports the old install and prints the migration steps", async () => {
    if (!oldRoot) return
    const { home, run } = await sandbox("migrate-detect")
    await mkdir(path.join(home, ".codex"), { recursive: true })
    expect(run(["bun", "run", "src/index.ts", "install", `./plugins/${OLD_PLUGIN}`, "--to", "opencode"], oldRoot).status).toBe(0)
    const detector = path.join(pluginDir, "skills", "method-update", "scripts", "detect-pre-rename-install.sh")
    const report = run(["bash", detector])
    expect(report.status).toBe(0)
    expect(report.out).toContain("Found a ce-datascience install") // rebrand:keep
    expect(report.out).toContain("bunx github:sajor2000/methodsmith install methodsmith --to opencode")
    expect(report.out).toContain("/method-plan")

    expect(run(["bun", "run", cli, "install", pluginDir, "--to", "opencode"]).status).toBe(0)
    const after = run(["bash", detector])
    expect(after.out).toContain("No ce-datascience install found") // rebrand:keep
  }, SLOW)
})

describe("7. the rename is complete and stable", () => {
  test("a second run of the rename script changes nothing and finds no residue", () => {
    const result = spawnSync("bun", ["run", "scripts/rebrand/rename.ts", "--check"], { cwd: repoRoot, encoding: "utf8" })
    expect(`${result.stdout}${result.stderr}`).toContain("Would move 0 file(s); would rewrite 0 file(s).")
    expect(result.stdout).not.toContain("residue")
    expect(result.status).toBe(0)
  }, SLOW)
})

describe("8. documentation website", () => {
  const buildDir = path.join(repoRoot, "website", "build")
  test.skipIf(!existsSync(buildDir))("serves from /methodsmith/ and every internal link resolves", async () => {
    const config = readFileSync(path.join(repoRoot, "website", "docusaurus.config.js"), "utf8")
    expect(config).toContain("baseUrl: '/methodsmith/'")
    const pages = walk(buildDir).filter((relative) => relative.endsWith(".html"))
    expect(pages.length).toBeGreaterThan(0)
    const broken: string[] = []
    for (const page of pages) {
      const html = readFileSync(path.join(buildDir, page), "utf8")
      for (const [, href] of html.matchAll(/(?:href|src)="(\/methodsmith\/[^"#?]*)/g)) {
        const relative = decodeURIComponent(href.slice("/methodsmith/".length))
        const candidates = [relative, path.join(relative, "index.html"), `${relative}.html`]
        if (!candidates.some((candidate) => existsSync(path.join(buildDir, candidate)))) broken.push(`${page} -> ${href}`)
      }
      for (const [, href] of html.matchAll(/(?:href|src)="(\/(?!methodsmith\/)[^"/][^"]*)"/g)) broken.push(`${page} -> ${href} (outside /methodsmith/)`)
    }
    expect([...new Set(broken)]).toEqual([])
  }, SLOW)
})
