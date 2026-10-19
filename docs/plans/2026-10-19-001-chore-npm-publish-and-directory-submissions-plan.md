---
title: npm publishing and directory submissions
status: in-progress
date: 2026-10-19
base: chore/npm-publish-readiness
---

# npm publishing and directory submissions

Follow-up to the public-release readiness plan
([`2026-10-18-001`](2026-10-18-001-fix-public-release-readiness-plan.md)). The
GitHub release is done; this plan covers the two distribution channels that are
not: publishing the CLI to npm, and submitting the plugin to the vendor
directories.

## Release verification (methodsmith v5.1.0)

- Tag `methodsmith-v5.1.0` and `cli-v5.1.0` both point at `3023a3db`, which is
  `main`'s tip: nothing is unreleased.
- Version surfaces agree: `package.json` and the three plugin manifests are
  `5.1.0`; the Claude and Cursor marketplace catalogs are `1.0.0` (separate
  release components); `.github/.release-please-manifest.json` matches.
- `bun test` (1720 tests, 0 fail), `bun run typecheck`, `bun run
  release:validate` (55 agents, 67 skills, 0 MCP servers), `bun run
  eval:validate`, and `bun run plugin:validate` all pass on `main`.
- `gh release list` shows `methodsmith: v5.1.0` as Latest, not a draft or
  prerelease.

## npm publishing

The release workflow already has a `publish-cli` job, gated on the repository
variable `NPM_PUBLISH == 'true'`, that runs `npm publish --provenance --access
public` with `permissions: id-token: write` on `ubuntu-latest`. The package name
`methodsmith` is unclaimed (the registry returns 404).

### Fixed in the repository

1. **`files` allowlist.** npm defaults `files` to `["*"]`, so the tarball
   shipped 1146 files (8.3 MB) including `evals/`, `tests/`, `docs/`, and
   `website/`. The allowlist is now `src`, `plugins`, `README.md`, `LICENSE`
   (586 files, 1.6 MB). `plugins` is required, not optional: `install.ts` and
   `cleanup.ts` resolve bundled plugins as `new URL("../../plugins/",
   import.meta.url)`, so an installed CLI finds no plugins without it.
   `tests/npm-publish-readiness.test.ts` derives that requirement from the
   source and fails if the allowlist drops a directory the CLI resolves.
2. **Package metadata.** `license` (MIT), `keywords`, `engines.bun`, and `bugs`
   were missing. `repository` stays the plain URL string because
   `tests/methodsmith-identity.test.ts` pins it; npm normalizes it to
   `git+https://…` for provenance validation.
3. **npm version floor.** Trusted publishing needs npm 11.5.1 or newer for the
   OIDC exchange. The publish job now pins `npm@11.5.1` after `setup-node`;
   Node 24's bundled npm is not guaranteed to meet the floor.

### Human steps (cannot be automated)

The package has to exist before a trusted publisher can be attached to it, and
the npm account and the npmjs.com settings page are user-owned.

1. Claim the name with a first publish from a local checkout:
   `npm login` (2FA), then `npm publish --access public`.
2. On npmjs.com, open `methodsmith` → Settings → Trusted Publisher → GitHub
   Actions, and enter owner `sajor2000`, repository `methodsmith`, workflow
   filename `release-pr.yml` (exact, case-sensitive). Optionally set an
   environment name; if one is set, add the matching `environment:` key to the
   `publish-cli` job.
3. Set the repository variable: `gh variable set NPM_PUBLISH --body true`.
   Do this **after** step 2: the variable only gates the job, and with the
   trusted publisher unconfigured the next release would fail at publish time.
4. After the first OIDC publish succeeds, enable "Require two-factor
   authentication and disallow tokens" on the package and revoke any tokens.

Note the runtime requirement: `bin` points at `src/index.ts` with a
`#!/usr/bin/env bun` shebang, so the published CLI needs Bun. `engines.bun`
documents this; npm only warns on `engines`. Shipping a compiled
`#!/usr/bin/env node` entry point is a separate decision, not part of this
plan.

## Directory submissions

Submission is a human action in every case; the repository side is already in
place. Shared copy for the forms:

- **Name:** Methodsmith
- **One-line description:** Rigorous research-methods workflows for your coding
  agent — pre-specified analysis plans, statistical and reporting-checklist
  review, and reproducible R and Python analysis.
- **Long description:** Methodsmith turns an AI coding agent into a careful
  research-methods partner for statistics, machine learning, and meta-analysis.
  Frame the question, pre-specify the analysis plan, build cohorts and Table 1,
  fit and check models, run reporting-checklist and methods review, and draft
  the paper. Works with R and Python, Quarto, Jupyter, and marimo, and covers 49
  reporting checklists with item-level review.
- **Links:** repository <https://github.com/sajor2000/methodsmith>, site
  <https://sajor2000.github.io/methodsmith/>, install
  `bunx github:sajor2000/methodsmith install methodsmith --to <target>`
- **Licence:** MIT. **Category:** Data Science / Research.

| Target | Directory exists | Repository side | Human next action |
|---|---|---|---|
| Claude Code (Anthropic) | Yes, curated `claude-plugins-official` marketplace | `.claude-plugin/marketplace.json` + `plugins/methodsmith/.claude-plugin/plugin.json`; run `bun run plugin:validate` | Submit the repository URL through the plugin directory submission form linked from the Claude Code plugin docs. External pull requests to the official marketplace repo are closed automatically. |
| Cursor | Yes, `cursor.com/marketplace` | `.cursor-plugin/marketplace.json` + `plugins/methodsmith/.cursor-plugin/plugin.json`, kept in parity by `release:validate` | Link the Git repository at the Cursor marketplace publish page; the Cursor team reviews manually. |
| OpenAI Codex | A curated in-product directory exists, but self-serve publishing is not open yet | `.agents/plugins/marketplace.json`; each plugin has `.codex-plugin/plugin.json` with the required `name`, `version`, and `description` | Keep the repo marketplace (`codex plugin marketplace add sajor2000/methodsmith`) and submit when self-serve publishing opens. The ChatGPT Apps track is a different product and needs a public MCP server, which Methodsmith does not ship. |
| Pi | A gallery at `pi.dev/packages` lists npm packages carrying the `pi-package` keyword; no review step | Pi output is currently produced by the CLI converter (`--to pi`) | Not applicable yet. Listing in the gallery needs a Pi-native `package.json` (`pi` key plus the `pi-package` keyword) and an npm publish, which is a separate decision from the converter path. |

## Open decisions

- Whether to compile the CLI to JavaScript so it runs without Bun.
- Whether to ship a Pi-native package alongside the converter output.
- Whether to add a GitHub Environment (for example `npm`) to the publish job
  with required reviewers.

## Progress

- **v5.1.0 verified as final** (see above); no version hand-bumped.
- **npm publish readiness implemented** on `chore/npm-publish-readiness`:
  `files` allowlist, package metadata, npm version floor, and
  `tests/npm-publish-readiness.test.ts`. First publish, trusted-publisher
  configuration, and `NPM_PUBLISH` remain human steps.
- **Directory submissions prepared**: metadata and next actions recorded above;
  no submission has been made.
