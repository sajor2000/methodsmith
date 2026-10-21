# Agent Instructions

This repository houses the `methodsmith` plugin — rigorous methods for statistics, machine learning, and meta-analysis, built on Every's Compound Engineering — and the Claude Code marketplace/catalog metadata used to distribute it.

It also contains:
- the Bun/TypeScript CLI that converts Claude Code plugins into other agent platform formats
- shared release and metadata infrastructure for the CLI, the three marketplaces (Claude, Cursor, Codex), and the plugin
- behavioral eval cases and skill-creator eval sets under `evals/`
- the marketing site, brand assets, and animation sources under `website/`

`AGENTS.md` is the canonical repo instruction file. Root `CLAUDE.md` is a compatibility shim that only imports it — edit `AGENTS.md`, never the shim.

## Quick Start

```bash
bun install
bun test                  # full test suite
bun run release:validate  # check plugin/marketplace consistency
```

For user-facing install and first-run instructions, keep
`docs/setup.md`, root `README.md`, and `plugins/methodsmith/README.md`
in sync. `docs/setup.md` is the canonical detailed setup guide.

## Working Agreement

- **Branching:** Create a feature branch for any non-trivial change. If already on the correct branch for the task, keep using it; do not create additional branches or worktrees unless explicitly requested.
- **Merge policy:** All changes to `main` go through pull requests. Direct pushes and direct merges are not allowed; branch protection on `main` enforces this by requiring the `test` status check to pass. The direct path bypasses `release:validate`, the test suite, and PR title validation — past direct merges have caused version drift requiring multi-PR recovery (see `docs/solutions/workflow/release-please-version-drift-recovery.md`).
- **Safety:** Do not delete or overwrite user data. Avoid destructive commands.
- **Testing:** Run `bun test` after changes that affect parsing, conversion, or output.
- **Release versioning:** Releases are prepared by release automation, not normal feature PRs. The repo has release components (`cli`, `methodsmith`, `marketplace`). GitHub release PRs and GitHub Releases are the canonical release-notes surface for new releases; root `CHANGELOG.md` is only a pointer to that history. Use conventional titles such as `feat:` and `fix:` so release automation can classify change intent, but do not hand-bump release-owned versions or hand-author release notes in routine PRs.
- **Linked versions (cli + methodsmith):** The `linked-versions` release-please plugin keeps `cli` and `methodsmith` at the same version. This is intentional -- it simplifies version tracking across the CLI and the plugin it ships. A consequence is that a release with only plugin changes will still bump the CLI version (and vice versa). The CLI changelog may also include commits that `exclude-paths` would normally filter, because `linked-versions` overrides exclusion logic when forcing a synced bump. This is a known upstream release-please limitation, not a misconfiguration. Do not flag linked-version bumps as unnecessary.
- **Output Paths:** Keep OpenCode output at `opencode.json` and `.opencode/{agents,skills,plugins}`. For OpenCode, command go to `~/.config/opencode/commands/<name>.md`; `opencode.json` is deep-merged (never overwritten wholesale).
- **Scratch Space:** Default to OS temp. Use `.context/` only when explicitly justified by the rules below.
  - **Default: OS temp** — covers most scratch, including per-run throwaway AND cross-invocation reusable, regardless of whether a repo is present or whether other skills may read the files. A stable OS-temp prefix handles cross-skill and cross-invocation coordination equally well as an in-repo path; repo-adjacency is rarely the relevant property.
    - **Per-run throwaway**: `mktemp -d -t <prefix>-XXXXXX` (OS handles cleanup). Use for files consumed once and discarded — captured screenshots, stitched GIFs, intermediate build outputs, recordings, delegation prompts/results, single-run checkpoints. The resulting path is opaque (on macOS it resolves under `$TMPDIR`/`/var/folders/...`) — that is appropriate for throwaway files users are not meant to access.
    - **Cross-invocation reusable**: stable path `/tmp/methodsmith/<skill-name>/<run-id>/` — **not** `mktemp -d` — so later invocations of the same skill can discover sibling run-ids. Use `/tmp` directly rather than `$TMPDIR` so paths stay accessible: `$TMPDIR` on macOS resolves to `/var/folders/64/.../T/`, which is hostile for users who want to inspect checkpoints, grep them, or copy them out. The per-user isolation `$TMPDIR` provides is not valuable for cross-invocation reusable scratch where users are the intended audience. Use for caches keyed by session, checkpoints meant to survive context compaction within a loose session, or any state where later runs of the same skill need to locate prior outputs.
  - **Exception: `.context/`** — use only when the artifact is genuinely bound to the CWD repo AND meets at least one of:
    - (a) **User-curated**: the user is expected to inspect, manipulate, or manually curate the artifact outside the skill (e.g., a per-repo TODO database, a per-spec optimization log that survives across sessions on the same checkout).
    - (b) **Repo+branch-inseparable**: the artifact's meaning is inseparable from this specific repo or branch (e.g., branch-specific resume state that a user expects to pick up again in the same checkout).
    - (c) **Path is core UX**: surfacing the artifact path back to the user is a core part of the skill's output and that path is easier to communicate as a repo-relative location than an OS-temp one.
    Namespace under `.context/methodsmith/<workflow-or-skill-name>/`, add a per-run subdirectory when concurrent runs are plausible, and decide cleanup behavior per the artifact's lifecycle (per-run scratch clears on success; user-curated state persists). "Shared between skills" is not by itself sufficient — OS temp handles that equally well.
  - **Durable outputs** (plans, specs, learnings, docs, final deliverables) belong in `docs/` or another repo-tracked location, not in either scratch tier.
  - **Cross-platform note:** `/tmp` is writable on macOS (symlink to `/private/tmp`), Linux, and WSL. `mktemp -d -t <prefix>-XXXXXX` also works on all three. Skills authored here assume Unix-like shells; native Windows is not a current target.
- **Character encoding:**
  - **Identifiers** (file names, agent names, command names): ASCII only -- converters and regex patterns depend on it.
  - **Markdown tables:** Use pipe-delimited (`| col | col |`), never box-drawing characters.
  - **Prose and skill content:** Unicode is fine (emoji, punctuation, etc.). Prefer ASCII arrows (`->`, `<-`) over Unicode arrows in code blocks and terminal examples.

## Directory Layout

```
src/              CLI entry point, parsers, converters, target writers
plugins/          Plugin workspaces (methodsmith)
.claude-plugin/   Claude marketplace catalog; .cursor-plugin/ and .agents/ mirror it for Cursor and Codex
scripts/          Release, eval, docs, and maintenance tooling
tests/            Converter, writer, and CLI tests + fixtures
docs/             Brainstorms, plans, solutions, audits, brand assets, setup guide
evals/            Behavioral eval cases and skill-creator eval sets
website/          Marketing site, brand assets, animation scene sources
```

## Repo Surfaces

Changes in this repo may affect one or more of these surfaces:

- `methodsmith` under `plugins/methodsmith/`
- the marketplace catalogs: `.claude-plugin/` (Claude), `.cursor-plugin/` (Cursor), `.agents/` (Codex), kept in parity by `bun run release:validate`
- the converter/install CLI in `src/` and `package.json`
- behavioral evals under `evals/` — a material skill or agent behavior change must update its cases
- the website and brand assets under `website/` and `docs/brand/` — displayed inventory counts are enforced by `tests/displayed-counts.test.ts`

Do not assume a repo change is "just CLI" or "just plugin" without checking which surface owns the affected files.

## Plugin Maintenance

When changing `plugins/methodsmith/` content:

- For maintainable, portable skill prose, follow [`docs/solutions/skill-design/predictable-skill-authoring.md`](docs/solutions/skill-design/predictable-skill-authoring.md). It is maintainer guidance only; runtime skills must remain self-contained.
- Update substantive docs like `plugins/methodsmith/README.md` when the plugin behavior, inventory, or usage changes.
- Do not hand-bump release-owned versions in plugin or marketplace manifests.
- Do not hand-add release entries to `CHANGELOG.md` or treat it as the canonical source for new releases.
- Run `bun run release:validate` if agents, commands, skills, MCP servers, or release-owned descriptions/counts may have changed.
- **Guideline source documents stay local.** Reporting-guideline source documents (PDFs, Word files, supplements, articles) are never committed (enforced by `tests/source-document-guard.test.ts` and `.gitignore`). Encode them as checklist rules in `plugins/methodsmith/skills/method-review/references/<name>-checklist.md` with the official item IDs and a source and licence header. Copy text verbatim only from CC BY or CC0 sources; otherwise paraphrase faithfully. Record the verification (source, date, status) in `guideline-registry.yaml`.
- **Newest guideline version only.** When a new version of a reporting guideline is published, replace the old checklist in the same PR: delete the old `<name>-checklist.md` and its registry entry, add the old name as an alias of the successor in `guideline-registry.yaml`, and record the supersession (old citation and date) in the successor's `supersedes` note. Never keep two versions loadable; a superseded version is never routed, recommended, or cited as current. Enforced by `tests/newest-guideline-version.test.ts`.
- After changing any skill or agent `description:`, run `bun run legacy:fingerprints` and commit `src/data/shipped-description-fingerprints.json`. Upgrades use it to recognize files an older release wrote; a user's own same-named file never matches, so it is left alone. Enforced by `tests/description-fingerprints.test.ts`.
- When removing a skill, agent, or command, add its name to both cleanup registries so stale flat-install artifacts are swept on upgrade:
  - `STALE_SKILL_DIRS` / `STALE_AGENT_NAMES` / `STALE_PROMPT_FILES` in `src/utils/legacy-cleanup.ts`
  - `EXTRA_LEGACY_ARTIFACTS_BY_PLUGIN["methodsmith"]` in `src/data/plugin-legacy-artifacts.ts`

Useful validation commands:

```bash
bun run release:validate
bun run plugin:validate   # claude plugin validate; needs the claude CLI
cat .claude-plugin/marketplace.json | jq .
cat plugins/methodsmith/.claude-plugin/plugin.json | jq .
```

## Validating Agent and Skill Changes

Behavioral changes to a plugin agent or skill (anything under `plugins/*/agents/` or `plugins/*/skills/`) need a different validation path than mechanical code changes, because of how Claude Code loads plugins.

- **Use the `skill-creator` skill to test changes.** Skill-creator is purpose-built for this: it spawns a generic subagent and injects the agent or skill content into the subagent's prompt at dispatch time, so each run reads the current source from disk. Invoke `/skill-creator` and use its eval workflow rather than reaching for ad-hoc workarounds.

- **Plugin agent and skill definitions both cache at session start.** Once a Claude Code session is open, dispatching a typed agent (e.g., `Agent({subagent_type: "methodsmith:method-session-historian"})`) runs the in-memory copy that was loaded when the session began. The same applies to skills: invoking `Skill method-session-inventory` goes through the cached skill loader, so edits to skill scripts are also not tested via that path. File edits to either layer after session start do not propagate within the same session. Any iteration loop built around typed-agent dispatch or Skill-tool invocation in the same session is testing pre-edit content, not your changes.

- **Do NOT edit `~/.claude/plugins/cache/` or `~/.claude/plugins/marketplaces/` to try to force a reload.** Those paths are user machine state, not repo-managed. Modifying them does not reliably bypass the in-session cache (it didn't, in observed behavior), risks being silently overwritten by plugin updates, and is the wrong layer to test from. The skill-creator pattern is the proper approach; if you genuinely need fresh-loaded behavior of the typed-agent dispatch path, restart the Claude Code session — but skill-creator is preferred for fast iteration.

- **Mechanical changes do not have this restriction.** Skill scripts (e.g., `extract-metadata.py`), parser logic, conversion code, and anything `bun test` exercises always run the current source. The caching issue only affects LLM-driven agent or skill prose behavior dispatched through the plugin loader.

### Repository-Owned Behavioral Evaluations

For covered behavioral surfaces, use the versioned cases under
`evals/methodsmith/cases/` in addition to the `skill-creator` workflow above.
Run `bun run eval:validate` for deterministic case validation. Save live runs
under `/tmp/methodsmith/behavioral-evals/<run-id>/`, then score them with
`bun run eval:score --case <id> --run-dir <path>`.
Before dispatch, record the case, prompt, and target SHA-256 digests in
`run.json`; scoring fails closed if those inputs drift.

- Material behavior changes to a covered skill or agent must update or add cases
  when the expected behavior changes.
- Run each affected case twice in independent fresh contexts through
  `skill-creator`; every hard gate must pass in both runs.
- Keep model calls out of normal CI. CI runs the deterministic contract tests
  and case validation only.
- Never commit live run directories, full model traces, private prompts,
  credentials, PHI, or patient-level fixtures. Commit only synthetic or seeded
  fixtures and sanitized evidence summaries.

Every skill also has an Anthropic skill-creator eval set under
`evals/methodsmith/skill-creator/<skill>/`. `evals.json` holds three realistic
prompts with verifiable expectations; `trigger-evals.json` holds 10
should-trigger and 10 near-miss should-not-trigger queries for skill-creator's
description loop. Update both when a skill's behavior
or scope changes. `tests/skill-creator-evals.test.ts` enforces coverage and shape.

See
[`docs/solutions/skill-design/behavioral-evaluation.md`](docs/solutions/skill-design/behavioral-evaluation.md)
for the contract, run layout, acceptance policy, and interpretation limits.

## Coding Conventions

- Prefer explicit mappings over implicit magic when converting between platforms.
- Keep target-specific behavior in dedicated converters/writers instead of scattering conditionals across unrelated files.
- Preserve stable output paths and merge semantics for installed targets; do not casually change generated file locations.
- When adding or changing a target, update fixtures/tests alongside implementation rather than treating docs or examples as sufficient proof.

## Agent Style Reference

- Use [`multica-ai/andrej-karpathy-skills`](https://github.com/multica-ai/andrej-karpathy-skills) as an external reference for Karpathy-style agent/skill expectations when auditing or authoring slash-command skills: understand the task before acting, prefer simple and surgical workflows, keep instructions concise, avoid unsupported promises, and verify the real user-facing path. Treat it as guidance, not a dependency or a replacement for this repo's rules.

## Commit Conventions

- **Prefix is based on intent, not file type.** Use conventional prefixes (`feat:`, `fix:`, `docs:`, `refactor:`, etc.) but classify by what the change does, not the file extension. Files under `plugins/*/skills/`, `plugins/*/agents/`, and `.claude-plugin/` are product code even though they are Markdown or JSON. Reserve `docs:` for files whose sole purpose is documentation (`README.md`, `docs/`, `CHANGELOG.md`).
- **Type selection — classify by intent, not diff shape.** Where `fix:` and `feat:` could both seem to fit, default to `fix:`: a change that remedies broken or missing behavior is `fix:` even when implemented by adding code, and net additions do not turn a fix into a `feat:`. Reserve `feat:` for capabilities the user could not previously accomplish where nothing was broken. Other conventional types (`chore:`, `refactor:`, `docs:`, `perf:`, `test:`, `ci:`, `build:`, `style:`) remain primary when they describe the change more precisely than either. Heuristic: if a regression test you could write today would have failed *before* the change, it's `fix:`. The user may override this default for a specific change.
- **Include a component scope.** The scope appears verbatim in the changelog. Pick the narrowest useful label: skill/agent name (`document-review`, `learnings-researcher`), plugin or CLI area (`cli`), or shared area when cross-cutting (`review`, `research`, `converters`). Never use `methodsmith` — it's the entire plugin and tells the reader nothing. Omit scope only when no single label adds clarity.
- **Never use `!` or a `BREAKING CHANGE:` footer without explicit user confirmation.** These markers trigger release-please's automatic major version bump — a decision the user may not want even when a change is technically breaking. If a change appears breaking, surface that to the user and let them decide whether to apply the marker.

## Adding a New Target Provider

Only add a provider when the target format is stable, documented, and has a clear mapping for tools/permissions/hooks. Use this checklist:

1. **Define the target entry**
   - Add a new handler in `src/targets/index.ts` with `implemented: false` until complete.
   - Use a dedicated writer module (e.g., `src/targets/codex.ts`).

2. **Define types and mapping**
   - Add provider-specific types under `src/types/`.
   - Implement conversion logic in `src/converters/` (from Claude → provider).
   - Keep mappings explicit: tools, permissions, hooks/events, model naming.

3. **Wire the CLI**
   - Ensure `convert` and `install` support `--to <provider>` and `--also`.
   - Keep behavior consistent with OpenCode (write to a clean provider root).

4. **Tests (required)**
   - Extend fixtures in `tests/fixtures/sample-plugin`.
   - Add spec coverage for mappings in `tests/converter.test.ts`.
   - Add a writer test for the new provider output tree.
   - Add a CLI test for the provider (similar to `tests/cli.test.ts`).

5. **Docs**
   - Update README with the new `--to` option and output locations.

## Agent References in Skills

When referencing agents from within skill SKILL.md files (e.g., via the `Agent` or `Task` tool), use the bare `method-<agent-name>` form. The `method-` prefix identifies the agent as a methodsmith component and is sufficient for uniqueness across plugins.

Example:
- `method-learnings-researcher` (correct)
- `learnings-researcher` (wrong — the `method-` prefix is required; it's what prevents collisions with agents from other plugins that might share a short name)

## File References in Skills

Each skill directory is a self-contained unit. A SKILL.md file must only reference files within its own directory tree (e.g., `references/`, `assets/`, `scripts/`) using relative paths from the skill root. Never reference files outside the skill directory — whether by relative traversal or absolute path.

Broken patterns:

- `../other-skill/references/schema.yaml` — relative traversal into a sibling skill
- `/home/user/plugins/methodsmith/skills/other-skill/file.md` — absolute path to another skill
- `~/.claude/plugins/cache/marketplace/methodsmith/0.1.0/skills/other-skill/file.md` — absolute path to an installed plugin location

Why this matters:

- **Runtime resolution:** Skills execute from the user's working directory, not the skill directory. Cross-directory paths and absolute paths will not resolve as expected.
- **Unpredictable install paths:** Plugins installed from the marketplace are cached at versioned paths. Absolute paths that worked in the source repo will not match the installed layout, and the version segment changes on every release.
- **Converter portability:** The CLI copies each skill directory as an isolated unit when converting to other agent platforms. Cross-directory references break because sibling directories are not included in the copy.

If two skills need the same supporting file, duplicate it into each skill's directory. Prefer small, self-contained reference files over shared dependencies.

> **Note (March 2026):** This constraint reflects current Claude Code skill resolution behavior and known path-resolution bugs ([#11011](https://github.com/anthropics/claude-code/issues/11011), [#17741](https://github.com/anthropics/claude-code/issues/17741), [#12541](https://github.com/anthropics/claude-code/issues/12541)). If Anthropic introduces a shared-files mechanism or cross-skill imports in the future, this guidance should be revisited with supporting documentation.

## Platform-Specific Variables in Skills

This plugin is authored once and converted for multiple agent platforms (Claude Code, Codex, Gemini CLI, etc.). Do not use platform-specific environment variables or string substitutions (e.g., `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_SESSION_ID}`, `CODEX_SANDBOX`, `CODEX_SESSION_ID`) in skill content without a graceful fallback that works when the variable is unavailable or unresolved.

**Preferred approach — relative paths for reads, `SKILL_DIR` for executed scripts:** Files Claude *reads* (`references/x.md`, `assets/template.yaml`) stay relative to the skill root; the agent resolves them. Bundled scripts that are *executed* through a shell tool must be anchored. The shell starts in the user's project root, not the skill directory, on Claude Code, Codex, and Cursor, so a bare `bash scripts/x.sh` copied into a Bash call misses the file. Use the model-filled anchor with a trailing `;`, check that the file exists, and give a fallback:

```
SKILL_DIR="<absolute path of the directory containing the SKILL.md you just read>";
bash "$SKILL_DIR/scripts/my-script.sh" ARG
```

Python helpers may call `python3`, since skills target Unix-like shells. When a safety check must not be silently skipped (for example a validator), probe `python3`, `python`, `py` in that order and fall back to a documented manual check when none is available. `tests/plugin-content-portability.test.ts` rejects unanchored `bash|sh|python3 scripts/...` invocations.

**Load-time `!` pre-resolution:** Avoid it for anything that can exit non-zero. On Claude Code a failing `!` command aborts the skill load; for example, `git diff HEAD` fails in an unborn repo and `git status` fails outside one. Gather context at runtime instead, one argv-style command per shell call, and state what a non-zero exit means. The only acceptable `!` lines always exit 0 (for example `git rev-parse --show-toplevel 2>/dev/null || true`).

**When a platform variable is unavoidable:** Use the pre-resolution pattern (`!` backtick syntax) and include explicit fallback instructions in the skill content, so the agent knows what to do if the value is empty, literal, or an error:

```
**Plugin version (pre-resolved):** !`jq -r .version "${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json"`

If the line above resolved to a semantic version (e.g., `2.42.0`), use it.
Otherwise (empty, a literal command string, or an error), use the versionless fallback.
Do not attempt to resolve the version at runtime.
```

This applies equally to any platform's variables — a skill converted from Codex, Gemini, or any other platform will have the same problem if it assumes platform-only variables exist without a fallback.

## Repository Docs Convention

- **Requirements and ideation** live in `docs/brainstorms/` and `docs/ideation/`.
- **Plans** live in `docs/plans/` — implementation plans and progress tracking.
- **Solutions** live in `docs/solutions/` — documented decisions and patterns.
- **Audits** live in `docs/audits/` — recorded review passes.
- **Brand assets** live in `docs/brand/`; the site builds from `website/`.
- `docs/setup.md` is the canonical setup guide; `docs/guideline-sources.md` is generated from the guideline registry (`bun run docs:guideline-sources`) — never edit it by hand. `THIRD-PARTY-NOTICES.md` is generated from the guideline registry and the checklist licence headers (`bun run docs:third-party-notices`) — never edit it by hand either; update the registry or the checklist header instead and regenerate.

### Solution categories (`docs/solutions/`)

This repo builds a plugin *for* developers. Categorize solutions from the perspective of the end user (a developer using the plugin), not a contributor to this repo.

- **`developer-experience/`** — Issues with contributing to *this repo*: local dev setup, shell aliases, test ergonomics, CI friction. If the fix only matters to someone with a checkout of this repo, it belongs here.
- **`integrations/`** — Issues where plugin output doesn't work correctly on a target platform or OS. Cross-platform bugs, target writer output problems, and converter compatibility issues go here.
- **`workflow/`**, **`skill-design/`** — Plugin skill and agent design patterns, workflow improvements.

When in doubt: if the bug affects someone running `bun install methodsmith` or `bun convert`, it's an integration or product issue, not developer-experience.
