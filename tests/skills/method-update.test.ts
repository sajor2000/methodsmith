import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "fs"
import { execFileSync } from "child_process"
import { tmpdir } from "os"
import path from "path"
import { describe, expect, test } from "bun:test"

const SKILL_PATH = path.join(
  process.cwd(),
  "plugins/methodsmith/skills/method-update/SKILL.md",
)
const SKILL_BODY = readFileSync(SKILL_PATH, "utf8")

describe("method-update SKILL.md", () => {
  // Regression guard for https://github.com/EveryInc/compound-engineering-plugin/issues/556.
  //
  // `CLAUDE_PLUGIN_ROOT` points at the currently-loaded plugin version directory
  // (e.g. `~/.claude/plugins/cache/<marketplace>/methodsmith/<version>`),
  // NOT the plugins cache root. Appending `/cache/<anything>/methodsmith/`
  // produces a path that never exists, which caused the cache-probe to fail and
  // emit `__CE_UPDATE_CACHE_FAILED__` on every healthy install. Has regressed twice.
  test("does not append a /cache/<marketplace>/ suffix onto CLAUDE_PLUGIN_ROOT", () => {
    const antiPattern = /\$\{CLAUDE_PLUGIN_ROOT\}\/cache\//
    expect(
      antiPattern.test(SKILL_BODY),
      "method-update/SKILL.md reintroduced the ${CLAUDE_PLUGIN_ROOT}/cache/... antipattern — derive the cache dir from dirname \"${CLAUDE_PLUGIN_ROOT}\" instead.",
    ).toBe(false)
  })
})

// Regression guard for https://github.com/EveryInc/compound-engineering-plugin/issues/659.
//
// The marketplace installs plugin contents from `main` HEAD, so the cache
// folder basename reflects `plugin.json` at install time — not any release tag.
// Comparing the installed folder against the latest GitHub release tag caused
// a persistent false-positive "Out of date" whenever `main` was ahead of the
// last tag (the normal state between releases), and the prescribed fix
// (`claude plugin update ...`) reinstalled the same version, looping forever.
//
// Rather than grep-testing the literal shell string, this suite extracts the
// "Latest upstream version" pre-resolution command and executes it against a
// mocked `gh` that returns distinguishable values for `gh api` vs
// `gh release list`. The command must report the version from `plugin.json`,
// not from release tags.
describe("method-update 'Latest upstream version' pre-resolution command", () => {
  test("declares a 'Latest upstream version' pre-resolution section", () => {
    // Fails loudly if the SKILL structure regresses (renamed section, removed
    // pre-resolution block) so behavioral tests below can rely on it.
    expect(SKILL_BODY).toMatch(/\*\*Latest upstream version:\*\*\s*\n!`[^`\n]+`/)
  })

  test("returns the version from main's plugin.json, not any release tag", () => {
    // Chosen so a tag-based fallback would produce a clearly different value
    // than the plugin.json-based read. Either 1.0.0 or an empty/sentinel
    // output indicates the command is reading the wrong source.
    const pluginJsonVersion = "99.0.0"
    const releaseTagVersion = "1.0.0"

    const stdout = runUpstreamCommand(extractUpstreamVersionCommand(SKILL_BODY), {
      pluginJsonVersion,
      releaseTagVersion,
    })

    expect(stdout).toBe(pluginJsonVersion)
  })

  test("emits __CE_UPDATE_VERSION_FAILED__ when upstream plugin.json cannot be read", () => {
    // Simulates gh failing entirely (missing auth, offline, rate-limited).
    // The fallback must produce the sentinel so the skill's decision logic
    // can stop rather than silently compare against an empty string — a
    // pipeline-style `|| echo` only catches last-stage failures, and jq on
    // empty input exits 0 with no output.
    const stdout = runUpstreamCommand(extractUpstreamVersionCommand(SKILL_BODY), {
      ghExitCode: 1,
    })
    expect(stdout).toContain("__CE_UPDATE_VERSION_FAILED__")
  })
})

/**
 * Extract the shell command between `**Latest upstream version:**` and the
 * next blank line in SKILL.md. The command sits on the next line wrapped in
 * backticks with a leading `!` (Claude Code's pre-resolution syntax).
 */
function extractUpstreamVersionCommand(body: string): string {
  const match = body.match(/\*\*Latest upstream version:\*\*\s*\n!`([^`\n]+)`/)
  if (!match) {
    throw new Error(
      `Could not extract 'Latest upstream version' pre-resolution command from ${SKILL_PATH}`,
    )
  }
  return match[1]
}

type MockOptions = {
  pluginJsonVersion?: string
  releaseTagVersion?: string
  ghExitCode?: number
}

/**
 * Run the skill's upstream-version command with a mocked `gh` on PATH.
 * The mock emits distinct payloads for `gh api` vs `gh release list` so the
 * test can prove which source the command actually reads from.
 */
function runUpstreamCommand(command: string, options: MockOptions): string {
  const { pluginJsonVersion, releaseTagVersion, ghExitCode } = options
  const mockDir = mkdtempSync(path.join(tmpdir(), "method-update-gh-"))
  try {
    const pluginJsonB64 = pluginJsonVersion
      ? Buffer.from(
          JSON.stringify({ name: "methodsmith", version: pluginJsonVersion }),
        ).toString("base64")
      : ""
    const releaseJson = releaseTagVersion
      ? JSON.stringify([{ tagName: `compound-engineering-v${releaseTagVersion}` }])
      : "[]"

    // Emulate gh's behaviour without requiring host `jq`: real `gh --jq` uses
    // gojq embedded in the binary, so neither the skill nor this mock needs
    // an external jq on PATH. When the skill asks a `--jq` filter that
    // extracts `.version`, we emit the pre-computed plugin.json version; when
    // it asks for `.tagName`, we emit the pre-computed release tag. Any other
    // filter is unexpected and the mock fails loudly so the test doesn't pass
    // by accident.
    const ghScript = `#!/bin/bash
${ghExitCode !== undefined ? `exit ${ghExitCode}` : `
subcommand="$1"; shift
jq_filter=""
while [ $# -gt 0 ]; do
  case "$1" in
    --jq) jq_filter="$2"; shift 2 ;;
    *) shift ;;
  esac
done
case "$subcommand" in
  api)
    case "$jq_filter" in
      *'.version'*) printf '%s\\n' '${pluginJsonVersion ?? ""}' ;;
      '') printf '%s\\n' '{"content":"${pluginJsonB64}"}' ;;
      *) echo "unexpected --jq filter for gh api: $jq_filter" >&2; exit 2 ;;
    esac
    ;;
  release)
    # If the skill ever falls back to release-tag lookup, this is what it gets.
    case "$jq_filter" in
      *'tagName'*) printf '%s\\n' '${releaseTagVersion ?? ""}' ;;
      '') printf '%s\\n' '${releaseJson}' ;;
      *) echo "unexpected --jq filter for gh release: $jq_filter" >&2; exit 2 ;;
    esac
    ;;
  *) exit 1 ;;
esac
`}`
    const ghPath = path.join(mockDir, "gh")
    writeFileSync(ghPath, ghScript)
    chmodSync(ghPath, 0o755)

    return execFileSync("bash", ["-c", command], {
      env: { ...process.env, PATH: `${mockDir}:${process.env.PATH ?? ""}` },
      encoding: "utf8",
    }).trim()
  } finally {
    rmSync(mockDir, { recursive: true, force: true })
  }
}

describe("method-update covers every supported harness", () => {
  const frontmatter = SKILL_BODY.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ""

  test("ships to every target, not only Claude Code", () => {
    expect(frontmatter).not.toMatch(/ce_platforms/)
  })

  test("gives the exact update command for each harness", () => {
    for (const command of [
      "claude plugin update methodsmith@{marketplace-name}",
      "codex plugin marketplace upgrade methodsmith",
      "bunx github:sajor2000/methodsmith install methodsmith --to codex",
      "bunx github:sajor2000/methodsmith install methodsmith --to opencode",
      "bunx github:sajor2000/methodsmith install methodsmith --to pi",
      "bunx github:sajor2000/methodsmith install methodsmith --to gemini",
      "bunx github:sajor2000/methodsmith install methodsmith --to kiro",
      "qwen extensions update methodsmith",
    ]) {
      expect(SKILL_BODY).toContain(command)
    }
  })

  test("checks for a non-marketplace load before the fetch-failure branch, which falls back to /plugin", () => {
    const logic = SKILL_BODY.slice(SKILL_BODY.indexOf("### Claude Code decision logic"))
    const notMarketplace = logic.indexOf("If **Currently loaded version** contains `__CE_UPDATE_NOT_MARKETPLACE__`")
    const fetchFailed = logic.indexOf("If **Latest upstream version** contains `__CE_UPDATE_VERSION_FAILED__`")
    expect(notMarketplace).toBeGreaterThan(-1)
    expect(fetchFailed).toBeGreaterThan(notMarketplace)
    expect(logic.slice(fetchFailed, fetchFailed + 600)).toContain("**Marketplaces**")
  })

  test("says updates keep the user's own skills", () => {
    expect(SKILL_BODY).toMatch(/your own skills/i)
  })
})

// Methodsmith was ce-datascience before 5.0. method-update finds an old // rebrand:keep
// install and prints the exact switch commands; it never changes anything.
describe("method-update migration from the pre-5.0 name", () => {
  const skillDir = path.join(process.cwd(), "plugins/methodsmith/skills/method-update")
  const detector = path.join(skillDir, "scripts/detect-pre-rename-install.sh")

  test("runs the bundled detector through the SKILL_DIR anchor", () => {
    expect(SKILL_BODY).toContain('bash "$SKILL_DIR/scripts/detect-pre-rename-install.sh"')
    expect(SKILL_BODY).toContain("references/renamed-commands.md")
    expect(SKILL_BODY).toMatch(/do not run (the|these) commands/i)
  })

  test("its command table matches the rename mapping", async () => {
    const { renamedCommandsTable } = await import("../../scripts/rebrand/rename")
    const table = readFileSync(path.join(skillDir, "references/renamed-commands.md"), "utf8")
    expect(table).toContain(renamedCommandsTable())
  })

  test("prints the Claude Code switch for an old marketplace install", () => {
    const home = mkdtempSync(path.join(tmpdir(), "method-update-detect-"))
    try {
      const pluginsDir = path.join(home, ".claude", "plugins")
      execFileSync("mkdir", ["-p", pluginsDir])
      writeFileSync(
        path.join(pluginsDir, "installed_plugins.json"),
        JSON.stringify({ version: 2, plugins: { "ce-datascience@ce-datascience-plugin": [{ scope: "user" }] } }), // rebrand:keep
      )
      const out = execFileSync("bash", [detector], {
        encoding: "utf8",
        cwd: home,
        env: { PATH: process.env.PATH ?? "", HOME: home, CLAUDE_CONFIG_DIR: path.join(home, ".claude") },
      })
      expect(out).toContain("claude plugin uninstall ce-datascience@ce-datascience-plugin") // rebrand:keep
      expect(out).toContain("claude plugin marketplace remove ce-datascience-plugin") // rebrand:keep
      expect(out).toContain("claude plugin marketplace add sajor2000/methodsmith")
      expect(out).toContain("claude plugin install methodsmith@methodsmith")
      expect(out).toContain("| `/ce-statistical-analysis-plan` | `/method-sap` |") // rebrand:keep
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  test("prints the move for an unmoved project state folder, even with no old install", () => {
    const home = realpathSync(mkdtempSync(path.join(tmpdir(), "method-update-state-")))
    try {
      execFileSync("mkdir", ["-p", path.join(home, ".ce-datascience")]) // rebrand:keep
      const run = () =>
        execFileSync("bash", [detector], { encoding: "utf8", cwd: home, env: { PATH: process.env.PATH ?? "", HOME: home } })
      const out = run()
      expect(out).toContain("## Project state folder")
      expect(out).toContain(`mv "${home}/.ce-datascience" "${home}/.methodsmith"`) // rebrand:keep
      expect(out).not.toContain("Nothing to migrate")
      execFileSync("mkdir", ["-p", path.join(home, ".methodsmith")])
      expect(run()).toContain("Only .methodsmith/ is read")
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  test("reports nothing to migrate on a clean machine", () => {
    const home = mkdtempSync(path.join(tmpdir(), "method-update-clean-"))
    try {
      const out = execFileSync("bash", [detector], {
        encoding: "utf8",
        cwd: home,
        env: { PATH: process.env.PATH ?? "", HOME: home },
      })
      expect(out).toMatch(/^No \S+ install found\. Nothing to migrate\.$/m)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
