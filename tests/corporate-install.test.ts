import { describe, expect, test } from "bun:test"
import { promises as fs } from "fs"
import os from "os"
import path from "path"
import rebrandMap from "../scripts/rebrand/mapping.json"

// These tests spawn the CLI and clone or install a full plugin tree; under
// full-suite load they can exceed bun's 5 s default.
const SLOW_TEST_TIMEOUT_MS = 60_000

const repoRoot = path.join(import.meta.dir, "..")
const pluginRoot = path.join(repoRoot, "plugins", "methodsmith")

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true })
    return entries.filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name))
  } catch {
    return []
  }
}

async function run(command: string[], cwd = repoRoot): Promise<{ stdout: string; stderr: string }> {
  const proc = Bun.spawn(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })
  const exitCode = await proc.exited
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  if (exitCode !== 0) {
    throw new Error(`${command.join(" ")} failed with ${exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`)
  }
  return { stdout, stderr }
}

async function collectFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) return collectFiles(fullPath)
    return [fullPath]
  }))
  return nested.flat()
}

async function publicSkillNames(): Promise<string[]> {
  const entries = await fs.readdir(path.join(pluginRoot, "skills"), { withFileTypes: true })
  return (await Promise.all(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("method-"))
    .map(async (entry) => (await exists(path.join(pluginRoot, "skills", entry.name, "SKILL.md"))) ? entry.name : null)))
    .filter((name): name is string => name !== null)
    .sort()
}

describe("corporate install artifacts", () => {
  test("easy installer exposes Compound Engineering-style setup paths", async () => {
    const installer = path.join(repoRoot, "install.sh")
    const codexHome = path.join(os.tmpdir(), "method-easy-install-codex")
    const agentsHome = path.join(os.tmpdir(), "method-easy-install-agents")

    const claude = await run(["bash", installer, "claude", "--aliases", "--dry-run"])
    expect(claude.stdout).toContain("claude plugin marketplace add")
    expect(claude.stdout).toContain("claude plugin install methodsmith@methodsmith")
    expect(claude.stdout).toContain("install-claude-aliases.sh")
    expect(claude.stdout).toContain("/method-setup")

    const doctor = await run(["bash", installer, "doctor"])
    expect(doctor.stdout).toContain("Methodsmith install check")
    expect(doctor.stdout).toContain("Standard laptop:")
    expect(doctor.stdout).toContain("Locked-down or corporate laptop:")
    expect(doctor.stdout).toContain("Codex always requires the final host step")

    const codex = await run([
      "bash",
      installer,
      "codex",
      "--codex-home",
      codexHome,
      "--agents-home",
      agentsHome,
      "--dry-run",
    ])
    expect(codex.stdout).toContain("codex plugin marketplace add")
    expect(codex.stdout).toContain("bun run src/index.ts install ./plugins/methodsmith --to codex")
    expect(codex.stdout).toContain(codexHome)
    expect(codex.stdout).toContain("Restart Codex, open /plugins, install Methodsmith")

    const windowsCodex = await run([
      "bash",
      installer,
      "codex",
      "--codex-home",
      "C:/Users/JCR/.codex",
      "--agents-home",
      "C:/Users/JCR/.agents",
      "--dry-run",
    ])
    expect(windowsCodex.stdout).toContain('--codex-home "C:/Users/JCR/.codex"')
    expect(windowsCodex.stdout).not.toContain(`${repoRoot}/C:/Users/JCR/.codex`)

    const windowsOfflineCodex = await run([
      "bash",
      path.join(repoRoot, "scripts", "install", "install-codex-offline.sh"),
      "--source",
      pluginRoot,
      "--codex-home",
      "C:/Users/JCR/.codex",
      "--agents-home",
      "C:/Users/JCR/.agents",
      "--dry-run",
    ])
    expect(windowsOfflineCodex.stdout).toContain("Marketplace: C:/Users/JCR/.agents/plugins/marketplace.json")
    expect(windowsOfflineCodex.stdout).toContain("Plugin:      C:/Users/JCR/.codex/plugins/methodsmith")
    expect(windowsOfflineCodex.stdout).not.toContain(`${repoRoot}/C:/Users/JCR/.codex`)
    expect(windowsOfflineCodex.stdout).not.toContain(`${repoRoot}/C:/Users/JCR/.agents`)

    const powershellInstaller = await fs.readFile(path.join(repoRoot, "install.ps1"), "utf8")
    expect(powershellInstaller).toContain("param(")
    expect(powershellInstaller).toContain("Install-ClaudeAliases")
    expect(powershellInstaller).toContain("Install-CodexOffline")
    expect(powershellInstaller).toContain("ConvertTo-Json")
    expect(powershellInstaller).toContain("METHODSMITH_ALIAS_MANAGED")
    expect(powershellInstaller).not.toContain("ce-mcp-server")
    expect(powershellInstaller).toContain('"doctor" { Show-Doctor }')

    const readme = await fs.readFile(path.join(repoRoot, "README.md"), "utf8")
    const setupDocs = await fs.readFile(path.join(repoRoot, "docs", "setup.md"), "utf8")
    const pluginReadme = await fs.readFile(path.join(pluginRoot, "README.md"), "utf8")

    for (const doc of [readme, setupDocs, pluginReadme]) {
      expect(doc).toContain("bash install.sh claude --aliases")
      expect(doc).toContain("bash install.sh codex")
      expect(doc).toContain(".\\install.ps1 claude -Aliases")
      expect(doc).toContain(".\\install.ps1 codex")
      expect(doc).toContain("install.sh doctor")
    }
    expect(setupDocs).toContain("Windows PowerShell")
    expect(setupDocs).toContain("Git Bash")
  }, SLOW_TEST_TIMEOUT_MS)

  test("Claude local aliases are managed, idempotent, and preserve user-owned commands", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "method-claude-aliases-"))
    const commandsDir = path.join(tempRoot, "commands")
    const installer = path.join(repoRoot, "scripts", "install", "install-claude-aliases.sh")

    await run(["bash", installer, "--plugin-dir", pluginRoot, "--commands-dir", commandsDir])

    const skills = await publicSkillNames()
    const aliases = (await fs.readdir(commandsDir)).filter((file) => file.startsWith("method-") && file.endsWith(".md"))
    expect(aliases.sort()).toEqual(skills.map((skill) => `${skill}.md`).sort())

    const setupAlias = await fs.readFile(path.join(commandsDir, "method-setup.md"), "utf8")
    expect(setupAlias).toContain("METHODSMITH_ALIAS_MANAGED")
    expect(setupAlias).toContain("/methodsmith:method-setup $ARGUMENTS")
    expect(setupAlias).toContain("$ARGUMENTS")

    // Deprecated ce-* aliases ended with 5.x: none are written. // rebrand:keep
    expect((await fs.readdir(commandsDir)).filter((file) => file.startsWith("ce-"))).toEqual([]) // rebrand:keep

    // Managed ce-* aliases from older installs (the pre-rebrand marker, and the 5.x // rebrand:keep
    // deprecated aliases with the current marker) are removed as stale.
    await fs.writeFile(
      path.join(commandsDir, "ce-old.md"),
      "<!-- CE_DATASCIENCE_ALIAS_MANAGED v1 plugin=ce-datascience skill=ce-old -->\nstale\n", // rebrand:keep
    )
    await fs.writeFile(
      path.join(commandsDir, "ce-statistical-analysis-plan.md"), // rebrand:keep
      "<!-- METHODSMITH_ALIAS_MANAGED v1 plugin=methodsmith skill=method-sap legacy=ce-statistical-analysis-plan -->\nold\n", // rebrand:keep
    )
    await fs.writeFile(path.join(commandsDir, "ce-work.md"), "user-owned legacy command\n") // rebrand:keep
    await fs.writeFile(path.join(commandsDir, "method-plan.md"), "user-owned command\n")

    await run(["bash", installer, "--plugin-dir", pluginRoot, "--commands-dir", commandsDir])

    expect(await exists(path.join(commandsDir, "ce-old.md"))).toBe(false)
    expect(await exists(path.join(commandsDir, "ce-statistical-analysis-plan.md"))).toBe(false) // rebrand:keep
    expect(await fs.readFile(path.join(commandsDir, "ce-work.md"), "utf8")).toBe("user-owned legacy command\n") // rebrand:keep
    expect(await fs.readFile(path.join(commandsDir, "method-plan.md"), "utf8")).toBe("user-owned command\n")

    await run(["bash", installer, "--commands-dir", commandsDir, "--uninstall"])

    expect(await exists(path.join(commandsDir, "method-setup.md"))).toBe(false)
    expect(await fs.readFile(path.join(commandsDir, "ce-work.md"), "utf8")).toBe("user-owned legacy command\n") // rebrand:keep
    expect(await fs.readFile(path.join(commandsDir, "method-plan.md"), "utf8")).toBe("user-owned command\n")
  }, SLOW_TEST_TIMEOUT_MS)

  test("Claude alias installer rejects a prebuilt package without method-* commands before cleanup", async () => {
    // The installer reads a prebuilt package from commands/ beside the script, so
    // stage a copy away from the repo checkout to make it fall back to that package.
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "method-claude-aliases-old-"))
    const packageDir = path.join(tempRoot, "a", "b", "aliases")
    const commandsDir = path.join(tempRoot, "commands")
    await fs.mkdir(path.join(packageDir, "commands"), { recursive: true })
    await fs.mkdir(commandsDir, { recursive: true })
    await fs.copyFile(
      path.join(repoRoot, "scripts", "install", "install-claude-aliases.sh"),
      path.join(packageDir, "install-claude-aliases.sh"),
    )
    // A pre-5.0 package holds only ce-* commands. // rebrand:keep
    await fs.writeFile(
      path.join(packageDir, "commands", "ce-plan.md"), // rebrand:keep
      "<!-- METHODSMITH_ALIAS_MANAGED v1 plugin=methodsmith skill=ce-plan -->\nold\n", // rebrand:keep
    )
    const existingAlias = "<!-- METHODSMITH_ALIAS_MANAGED v1 plugin=methodsmith skill=method-plan -->\nkeep\n"
    await fs.writeFile(path.join(commandsDir, "method-plan.md"), existingAlias)

    const proc = Bun.spawn(
      ["bash", path.join(packageDir, "install-claude-aliases.sh"), "--commands-dir", commandsDir],
      { cwd: tempRoot, stdout: "pipe", stderr: "pipe" },
    )
    const exitCode = await proc.exited
    const stderr = await new Response(proc.stderr).text()

    expect(exitCode).not.toBe(0)
    expect(stderr).toContain("method-")
    expect(await fs.readFile(path.join(commandsDir, "method-plan.md"), "utf8")).toBe(existingAlias)
  }, SLOW_TEST_TIMEOUT_MS)

  test("packaging stages offline Claude, alias, and Codex artifacts without dev/cache files", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "method-corporate-package-"))
    const stagingDir = path.join(tempRoot, "stage")
    const outputDir = path.join(tempRoot, "out")

    await run([
      "bash",
      path.join(repoRoot, "scripts", "package", "corporate-artifacts.sh"),
      "--staging-dir",
      stagingDir,
      "--output-dir",
      outputDir,
      "--skip-zip",
    ])

    const claudePlugin = path.join(stagingDir, "methodsmith", "methodsmith")
    expect(await exists(path.join(claudePlugin, ".claude-plugin", "plugin.json"))).toBe(true)
    expect(await exists(path.join(claudePlugin, "skills", "method-setup", "SKILL.md"))).toBe(true)

    const pluginFiles = await collectFiles(claudePlugin)
    expect(pluginFiles.filter((file) => /(__pycache__|\.pyc$|\.pyo$|node_modules|\.git)/.test(file))).toEqual([])

    const aliasDir = path.join(stagingDir, "methodsmith-claude-aliases")
    expect(await exists(path.join(aliasDir, "install-claude-aliases.sh"))).toBe(true)
    expect(await exists(path.join(aliasDir, "install.ps1"))).toBe(true)
    const setupAlias = await fs.readFile(path.join(aliasDir, "commands", "method-setup.md"), "utf8")
    expect(setupAlias).toContain("/methodsmith:method-setup $ARGUMENTS")

    const codexPackage = path.join(stagingDir, "methodsmith-codex-local")
    expect(await exists(path.join(codexPackage, ".agents", "plugins", "marketplace.json"))).toBe(true)
    expect(await exists(path.join(codexPackage, "plugins", "methodsmith", ".codex-plugin", "plugin.json"))).toBe(true)
    expect(await exists(path.join(codexPackage, "install-codex-offline.sh"))).toBe(true)
    expect(await exists(path.join(codexPackage, "install.ps1"))).toBe(true)
    expect(await exists(path.join(codexPackage, "codex-agent-bridge", "config.toml.template"))).toBe(false)
    expect(await exists(path.join(codexPackage, "codex-agent-bridge", "agents", "methodsmith", "method-security-reviewer.toml"))).toBe(true)
  }, SLOW_TEST_TIMEOUT_MS)

  test("Codex offline installer writes local marketplace and bridge agents", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "method-codex-offline-"))
    const stagingDir = path.join(tempRoot, "stage")
    const outputDir = path.join(tempRoot, "out")
    await run([
      "bash",
      path.join(repoRoot, "scripts", "package", "corporate-artifacts.sh"),
      "--staging-dir",
      stagingDir,
      "--output-dir",
      outputDir,
      "--skip-zip",
    ])

    const codexPackage = path.join(stagingDir, "methodsmith-codex-local")
    const codexHome = path.join(tempRoot, "profiles", "research", ".codex")
    const agentsHome = path.join(tempRoot, "profiles", "research", ".agents")

    await run([
      "bash",
      path.join(codexPackage, "install-codex-offline.sh"),
      "--source",
      codexPackage,
      "--codex-home",
      codexHome,
      "--agents-home",
      agentsHome,
    ])

    const marketplaceRoot = path.dirname(agentsHome)
    const installedPlugin = path.join(marketplaceRoot, ".codex", "plugins", "methodsmith")
    expect(await exists(path.join(installedPlugin, ".codex-plugin", "plugin.json"))).toBe(true)
    expect(await exists(path.join(agentsHome, "plugins", "methodsmith"))).toBe(false)
    expect(await exists(path.join(codexHome, "agents", "methodsmith", "method-security-reviewer.toml"))).toBe(true)

    const marketplace = JSON.parse(await fs.readFile(path.join(agentsHome, "plugins", "marketplace.json"), "utf8")) as {
      plugins: Array<{ name: string; source: { path: string } }>
    }
    const entry = marketplace.plugins.find((plugin) => plugin.name === "methodsmith")
    expect(entry?.source.path).toBe("./.codex/plugins/methodsmith")
    const marketplaceResolvedPlugin = path.resolve(marketplaceRoot, entry?.source.path ?? "")
    expect(marketplaceResolvedPlugin).toBe(installedPlugin)
    expect(await exists(path.join(marketplaceResolvedPlugin, ".codex-plugin", "plugin.json"))).toBe(true)

    expect(await exists(path.join(installedPlugin, ".mcp.json"))).toBe(false)

    const configPath = path.join(codexHome, "config.toml")
    await fs.mkdir(codexHome, { recursive: true })
    await fs.writeFile(
      configPath,
      [
        "[features]",
        "user_owned = true",
        "# BEGIN Methodsmith plugin MCP -- do not edit this block",
        "[mcp_servers.methodsmith]",
        'command = "python3"',
        'args = ["/old/ce-mcp-server/run.py"]',
        "# END Methodsmith plugin MCP",
        "",
      ].join("\n"),
    )
    await run([
      "bash",
      path.join(codexPackage, "install-codex-offline.sh"),
      "--source",
      codexPackage,
      "--codex-home",
      codexHome,
      "--agents-home",
      agentsHome,
    ])
    const cleanedConfig = await fs.readFile(configPath, "utf8")
    expect(cleanedConfig).toContain("user_owned = true")
    expect(cleanedConfig).not.toContain("BEGIN Methodsmith plugin MCP")

    const malformedConfig = [
      "[features]",
      "user_owned = true",
      "# BEGIN Methodsmith plugin MCP -- do not edit this block",
      "[mcp_servers.methodsmith]",
      'command = "python3"',
      "[mcp_servers.user-owned]",
      'command = "keep-me"',
      "",
    ].join("\n")
    await fs.writeFile(configPath, malformedConfig)
    const malformedRun = Bun.spawn([
      "bash",
      path.join(codexPackage, "install-codex-offline.sh"),
      "--source",
      codexPackage,
      "--codex-home",
      codexHome,
      "--agents-home",
      agentsHome,
    ], { cwd: repoRoot, stdout: "pipe", stderr: "pipe" })
    const malformedExit = await malformedRun.exited
    const malformedStderr = await new Response(malformedRun.stderr).text()
    expect(malformedExit).not.toBe(0)
    expect(malformedStderr).toContain("leaving config unchanged")
    expect(await fs.readFile(configPath, "utf8")).toBe(malformedConfig)
  }, SLOW_TEST_TIMEOUT_MS)

  test("setup intake supports corporate no-install mode and keeps Quarto optional", async () => {
    const setupSkill = await fs.readFile(path.join(pluginRoot, "skills", "method-setup", "SKILL.md"), "utf8")
    const normalizedSetupSkill = setupSkill.replace(/\s+/g, " ")
    const healthScript = await fs.readFile(path.join(pluginRoot, "skills", "method-setup", "scripts", "check-health"), "utf8")

    expect(setupSkill).toContain("--locked-down")
    expect(setupSkill).toContain("--no-install")
    expect(setupSkill).toContain("do not offer or run Homebrew, pip, npm, GitHub CLI, or Quarto install commands")
    expect(healthScript).toContain("--locked-down|--no-install")
    expect(healthScript).toContain("quarto|quarto --version|optional")
    expect(healthScript).toContain("git|command -v git|optional")
    expect(healthScript).toContain("locked-down mode: no install command offered")
    expect(normalizedSetupSkill).toContain("optional tools are reported as yellow but do not require Phase 3")
  })

  test("setup health check detects only a complete legacy Codex tool map", async () => {
    const setupSkill = await fs.readFile(path.join(pluginRoot, "skills", "method-setup", "SKILL.md"), "utf8")
    expect(setupSkill).toContain("references/legacy-codex-tool-map.md")
    expect(setupSkill).toMatch(/optional global\s+instruction cleanup/i)
    expect(setupSkill).toMatch(/requires approval/i)
    const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "method-setup-codex-home-"))
    const agentsPath = path.join(codexHome, "AGENTS.md")
    const healthScript = path.join(pluginRoot, "skills", "method-setup", "scripts", "check-health")

    await fs.writeFile(agentsPath, "<!-- BEGIN COMPOUND CODEX TOOL MAP -->\nlegacy\n<!-- END COMPOUND CODEX TOOL MAP -->\n")
    const detected = Bun.spawn(["bash", healthScript], {
      cwd: repoRoot,
      env: { ...process.env, CODEX_HOME: codexHome },
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(await detected.exited).toBe(0)
    expect(await new Response(detected.stdout).text()).toContain("Legacy Compound Codex tool map")

    await fs.writeFile(agentsPath, "<!-- BEGIN COMPOUND CODEX TOOL MAP -->\nlegacy\n")
    const incomplete = Bun.spawn(["bash", healthScript], {
      cwd: repoRoot,
      env: { ...process.env, CODEX_HOME: codexHome },
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(await incomplete.exited).toBe(0)
    expect(await new Response(incomplete.stdout).text()).not.toContain("Legacy Compound Codex tool map")
  }, SLOW_TEST_TIMEOUT_MS)

  test("setup uses a concise evidence-first profile before optional detail", async () => {
    const setupSkill = await fs.readFile(path.join(pluginRoot, "skills", "method-setup", "SKILL.md"), "utf8")
    const normalizedSetupSkill = setupSkill.replace(/\s+/g, " ")
    const inference = await fs.readFile(
      path.join(pluginRoot, "skills", "method-setup", "references", "profile-inference.md"),
      "utf8",
    )
    const survey = await fs.readFile(
      path.join(pluginRoot, "skills", "method-setup", "references", "full-survey.md"),
      "utf8",
    )

    expect(normalizedSetupSkill).toContain("Detected profile")
    expect(normalizedSetupSkill).toContain("Continue with detected profile")
    expect(normalizedSetupSkill).toContain("Adjust a field")
    expect(normalizedSetupSkill).toContain("Full survey")
    expect(normalizedSetupSkill).toContain("Never default an unknown repository to `both`")
    expect(normalizedSetupSkill).toContain("ask one focused question")
    expect(normalizedSetupSkill).toContain("Do not request data libraries, statistical packages")
    expect(normalizedSetupSkill).toContain("stack_profile.inference")
    expect(normalizedSetupSkill).toContain("Do not ask R data-library, R statistical-package, R environment-manager, or R project-type questions after a Python-only IDE choice such as Marimo or Jupyter")
    expect(normalizedSetupSkill).toContain("Do not ask Python package questions after an RStudio-only choice")
    expect(inference).toContain("value`, `confidence`, and short `evidence`")
    expect(inference).toContain("generic EHR")
    expect(inference).toContain("generic data")
    expect(survey).toContain("only after the user explicitly selects **Full survey**")
    expect(survey).toContain("Treat `both` as a deliberate user choice")
  })

  test("setup consumes verified connection handoffs without requiring data_root", async () => {
    const setupSkill = await fs.readFile(path.join(pluginRoot, "skills", "method-setup", "SKILL.md"), "utf8")
    const normalizedSetupSkill = setupSkill.replace(/\s+/g, " ")
    const configTemplate = await fs.readFile(path.join(pluginRoot, "skills", "method-setup", "references", "config-template.yaml"), "utf8")
    const stackTemplate = await fs.readFile(path.join(pluginRoot, "skills", "method-setup", "references", "stack-profile-template.yaml"), "utf8")
    const setupDocs = await fs.readFile(path.join(repoRoot, "docs", "setup.md"), "utf8")

    const connectionSignal = "__CE_CONNECTION__ name=<connection-name> type=<postgres|sqlite|duckdb|other> database=<db-name> auth=<auth-mode> status=verified"
    expect(setupSkill).toContain(connectionSignal)
    expect(normalizedSetupSkill).toContain("report it as high-confidence database evidence")
    expect(normalizedSetupSkill).toContain("Do not write the connection into `data_root`")
    expect(normalizedSetupSkill).toContain("stack_profile.data_root: null")
    expect(setupSkill).toContain("analysis/data-waves.md")

    expect(configTemplate).toContain("data_connection:")
    expect(configTemplate).toContain("name: healthmap-connection")
    expect(stackTemplate).toContain("data_connection:")
    expect(stackTemplate).toContain("status: verified")
    expect(stackTemplate).toContain("For database-first projects, this may stay null")
    expect(setupDocs).toContain("__CE_CONNECTION__ name=healthmap-connection type=postgres database=healthmap_dev auth=entra status=verified")
  })

  test("public documentation exposes installation and first use", async () => {
    const rootReadme = await fs.readFile(path.join(repoRoot, "README.md"), "utf8")
    const setupDocs = await fs.readFile(path.join(repoRoot, "docs", "setup.md"), "utf8")
    const pluginReadme = await fs.readFile(path.join(pluginRoot, "README.md"), "utf8")
    const docsHome = await fs.readFile(path.join(repoRoot, "website", "src", "pages", "index.js"), "utf8")
    const docsConfig = await fs.readFile(path.join(repoRoot, "website", "docusaurus.config.js"), "utf8")
    const markdownContracts = [
      {
        install: rootReadme.match(/## Get started[\s\S]*?(?=\n### Use the plugin after installation)/)?.[0],
        firstUse: rootReadme.match(/### Use the plugin after installation[\s\S]*?(?=\n### Locked-down or demo laptop)/)?.[0],
      },
      {
        install: setupDocs.match(/## 1\. Easiest Install Path[\s\S]*?(?=\n## 2\.)/)?.[0],
        firstUse: setupDocs.match(/## 7\. First Run In A Project[\s\S]*?(?=\n## 8\.)/)?.[0],
      },
      {
        install: pluginReadme.match(/## Getting Started[\s\S]*?(?=\n### Use the plugin after installation)/)?.[0],
        firstUse: pluginReadme.match(/### Use the plugin after installation[\s\S]*?(?=\nLocked-down laptops)/)?.[0],
      },
    ]

    for (const contract of markdownContracts) {
      expect(contract.install).toBeDefined()
      expect(contract.firstUse).toBeDefined()
      const install = contract.install ?? ""
      const firstUse = contract.firstUse ?? ""
      const firstUseSetup = firstUse.indexOf("/methodsmith:method-setup")
      const firstUseWorkflow = firstUse.indexOf("/methodsmith:method-workflow")

      expect(install).toContain("bash install.sh claude --aliases")
      expect(install).toContain("bash install.sh codex")
      expect(install).toContain("pi install npm:pi-subagents")
      expect(install).toContain("--to pi --pi-home")
      expect(install).toContain("`/plugins`")
      expect(install.indexOf("bash install.sh codex")).toBeLessThan(install.indexOf("`/plugins`"))
      expect(install).toMatch(/restart/i)
      expect(firstUse).toMatch(/project (?:or study )?(?:directory|repo)/i)
      expect(firstUseSetup).toBeGreaterThanOrEqual(0)
      expect(firstUseSetup).toBeLessThan(firstUseWorkflow)
    }

    expect(docsHome).toContain('to="/docs/setup"')
    expect(docsConfig).toContain("include: ['setup.md', 'guideline-sources.md']")
    expect(docsConfig).toContain("routeBasePath: 'docs'")
    expect(rootReadme).toContain("https://sajor2000.github.io/methodsmith/")
  })

  test("public documentation ships and references both workflow images", async () => {
    const rootReadme = await fs.readFile(path.join(repoRoot, "README.md"), "utf8")
    const setupDocs = await fs.readFile(path.join(repoRoot, "docs", "setup.md"), "utf8")
    const pluginReadme = await fs.readFile(path.join(pluginRoot, "README.md"), "utf8")
    const docsHome = await fs.readFile(path.join(repoRoot, "website", "src", "pages", "index.js"), "utf8")
    const imageNames = [
      "methodsmith-package-workflow.png",
      "methodsmith-skill-commands.png",
    ]

    for (const imageName of imageNames) {
      const image = await fs.stat(path.join(repoRoot, "docs", imageName))
      expect(image.isFile()).toBe(true)
      expect(image.size).toBeGreaterThan(100_000)
      expect(rootReadme).toContain(`docs/${imageName}`)
      expect(setupDocs).toContain(`](${imageName})`)
      expect(pluginReadme).toContain(`../../docs/${imageName}`)
    }

    expect(docsHome).toContain("../../../docs/methodsmith-package-workflow.png")
  })

  test("user-facing docs recommend optional scientific research add-ons safely", async () => {
    const rootReadme = await fs.readFile(path.join(repoRoot, "README.md"), "utf8")
    const setupDocs = await fs.readFile(path.join(repoRoot, "docs", "setup.md"), "utf8")
    const pluginReadme = await fs.readFile(path.join(pluginRoot, "README.md"), "utf8")
    const sections = [
      rootReadme.match(/### Recommended research add-ons[\s\S]*?(?=\n### )/)?.[0],
      setupDocs.match(/## 8\. Optional Research Add-ons[\s\S]*?(?=\n## 9\.)/)?.[0],
      pluginReadme.match(/### Recommended research add-ons[\s\S]*?(?=\n## Components)/)?.[0],
    ]

    for (const section of sections) {
      expect(section).toBeDefined()
      expect(section).toContain("cyanheads/pubmed-mcp-server")
      expect(section).toContain("paperclip.gxl.ai/docs")
      expect(section).toContain("/method-pubmed")
      expect(section).toMatch(/PubMed MCP/i)
      expect(section).toMatch(/Paperclip[\s\S]*full-text|full-text[\s\S]*Paperclip/i)
      expect(section).toMatch(/privacy/i)
      expect(section).toMatch(/Neither (?:add-on )?is\s+required or installed automatically|must not install/i)
    }

    expect(setupDocs).toContain("@cyanheads/pubmed-mcp-server@latest")
    expect(setupDocs).toContain("paperclip config")
    expect(setupDocs).toContain("paperclip install")
    expect(setupDocs).toContain("paperclip skill")
    expect(setupDocs).toContain("does not vendor, fork, or maintain it")
    expect(setupDocs).toContain("currently auto-detect only the Paperclip CLI")
    expect(setupDocs).toContain("does not automatically translate their results")
    expect(setupDocs).toMatch(/Never send protected\s+health information/)
    expect(setupDocs).toMatch(/must not install or authenticate\s+either add-on automatically/)
    expect(setupDocs).toMatch(/running `\/method-evidence-map` authorizes\s+its documented optional deepening/)
  })

  test("public docs describe the current method and CLIF safeguards", async () => {
    const rootReadme = await fs.readFile(path.join(repoRoot, "README.md"), "utf8")
    const setupDocs = await fs.readFile(path.join(repoRoot, "docs", "setup.md"), "utf8")
    const pluginReadme = await fs.readFile(path.join(pluginRoot, "README.md"), "utf8")

    for (const doc of [rootReadme, setupDocs, pluginReadme]) {
      expect(doc).toContain("--version 2.1.0")
      expect(doc).toContain("--version 3.0.0")
      expect(doc).toMatch(/time-dependent AUC/i)
    }

    for (const doc of [rootReadme, setupDocs, pluginReadme]) {
      expect(doc).toMatch(/estimand/i)
      expect(doc).toMatch(/missing-data/i)
      expect(doc).toMatch(/synthetic\/fallback|fallback data|fabricating fallbacks/i)
    }

    expect(pluginReadme).toContain("GO/WARN/NO-GO")
    expect(setupDocs).toContain("pi-ask-user")
  })
})

describe("Codex offline installer keeps user files on update", () => {
  test("re-running backs up edited or added files instead of deleting them", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "method-codex-offline-update-"))
    const stagingDir = path.join(tempRoot, "stage")
    await run([
      "bash",
      path.join(repoRoot, "scripts", "package", "corporate-artifacts.sh"),
      "--staging-dir",
      stagingDir,
      "--output-dir",
      path.join(tempRoot, "out"),
      "--skip-zip",
    ])
    const codexPackage = path.join(stagingDir, "methodsmith-codex-local")
    const codexHome = path.join(tempRoot, "home", ".codex")
    const agentsHome = path.join(tempRoot, "home", ".agents")
    const install = () => run([
      "bash",
      path.join(codexPackage, "install-codex-offline.sh"),
      "--source",
      codexPackage,
      "--codex-home",
      codexHome,
      "--agents-home",
      agentsHome,
    ])
    await install()

    const installedPlugin = path.join(path.dirname(agentsHome), ".codex", "plugins", "methodsmith")
    const userNote = path.join(installedPlugin, "skills", "method-plan", "my-notes.md")
    await fs.writeFile(userNote, "my notes")
    const bridgeAgent = path.join(codexHome, "agents", "methodsmith", "method-security-reviewer.toml")
    const shippedAgent = await fs.readFile(bridgeAgent, "utf8")
    await fs.writeFile(bridgeAgent, "my edited agent")

    await install()

    expect(await fs.readFile(bridgeAgent, "utf8")).toBe(shippedAgent)
    const backups = await listFiles(path.join(codexHome, "methodsmith", "backups"))
    const savedNote = backups.find((file) => file.endsWith(path.join("method-plan", "my-notes.md")))
    const savedAgent = backups.find((file) => file.endsWith("method-security-reviewer.toml"))
    expect(savedNote && (await fs.readFile(savedNote, "utf8"))).toBe("my notes")
    expect(savedAgent && (await fs.readFile(savedAgent, "utf8"))).toBe("my edited agent")
  }, 120000)

  test("install.ps1 compares before replacing and moves changed copies to backups", async () => {
    // PowerShell is not available in CI; guard the Windows twin statically.
    const ps1 = await fs.readFile(path.join(repoRoot, "install.ps1"), "utf8")
    const replace = ps1.slice(ps1.indexOf("function Copy-DirectoryReplace"), ps1.indexOf("function Merge-CodexMarketplace"))
    expect(replace).toContain("Test-DirectoriesMatch $SourceDir $DestDir")
    expect(replace).toContain("Move-Item -LiteralPath $DestDir -Destination $backupDir")
    // Without -Force, Get-ChildItem skips hidden files, so a hidden user file
    // would compare as "matching" and be deleted without a backup.
    const match = ps1.slice(ps1.indexOf("function Test-DirectoriesMatch"), ps1.indexOf("function Copy-DirectoryReplace"))
    const listings = match.match(/Get-ChildItem[^|]*/g) ?? []
    expect(listings).toHaveLength(2)
    for (const listing of listings) expect(listing).toContain("-Force")
  })
})
