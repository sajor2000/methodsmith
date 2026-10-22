# Methodsmith

<!-- brand:hero:start (presentation block; install, migration and command tables live below) -->
<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="website/static/brand/hero-dark.svg">
  <img src="website/static/brand/hero-light.svg" width="100%" alt="The Methodsmith hallmark. Rigorous methods for statistics, machine learning, and meta-analysis, from question to paper. Every study compounds. A plugin for Claude Code and Codex. The loop: /method-plan, /method-work, /method-review, /method-compound, with learnings feeding the next plan.">
</picture>

[![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsajor2000%2Fmethodsmith%2Fmain%2Fplugins%2Fmethodsmith%2F.claude-plugin%2Fplugin.json&query=%24.version&label=version&color=1B1F27)](https://github.com/sajor2000/methodsmith/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-1B1F27)](LICENSE)
[![CI](https://github.com/sajor2000/methodsmith/actions/workflows/ci.yml/badge.svg)](https://github.com/sajor2000/methodsmith/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-sajor2000.github.io%2Fmethodsmith-A63F1C?logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDY0IDY0Ij48dGl0bGU%2BTWV0aG9kc21pdGg8L3RpdGxlPjxyZWN0IHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgcng9IjAiIGZpbGw9IiMxQjFGMjciLz48cGF0aCBkPSJNMTAuMzAgNTAuODMgTDEwLjMwIDE1LjE4IEwxOS45MSAxNS4xOCBMMzIuMDAgMjcuNzggTDQ0LjA5IDE1LjE4IEw1My43MCAxNS4xOCBMNTMuNzAgNTAuODMgTDQ0LjA5IDUwLjgzIEw0NC4wOSAyOC44MCBMMzIuMDAgNDAuNzUgTDE5LjkxIDI4LjgwIEwxOS45MSA1MC44MyBaIiBmaWxsPSIjRjdGNUYwIi8%2BPC9zdmc%2BCg%3D%3D)](https://sajor2000.github.io/methodsmith/)

</div>

**Methodsmith** is a plugin for Claude Code and Codex that brings <!-- rebrand:keep -->
the habits of a careful methods team to your coding agent. It plans the analysis
before it runs, reviews it before anyone reads the results, and records what each
study taught you, so the next one starts ahead. Clinical statistics, Python and ML
papers, and meta-analysis; R or Python.

**It enhances the scientist; it does not replace one.** You frame the question,
approve the plan and judge the findings. Methodsmith does the drafting, running
and checking that make the work reproducible and grounded: pre-specified SAPs,
reviewed code, reporting checklists and numbers traced to the analysis.
**68 skills, 55 specialist agents, and 49 reporting standards.**

```bash
# Install in Claude Code (2.1.292 or later), then set up a project
claude plugin install methodsmith --marketplace sajor2000/methodsmith
```

Then open your study folder and run `/methodsmith:method-setup`. Other agents and
offline installs: [see every install route](#install) or the
[setup guide](https://sajor2000.github.io/methodsmith/docs/setup).

> **Research use only; not a medical device for clinical care.** Methodsmith
> supports research workflows and is not intended to diagnose, treat, cure,
> mitigate, or prevent disease or to guide patient-specific care. It is not
> validated for clinical use and does not replace qualified clinical,
> statistical, ethics, or institutional review.

### Start here

| If you want to | Go to |
|---|---|
| See what it does in 90 seconds | [See it work](#see-it-work) |
| Understand the plan -> work -> review -> compound loop | [You decide. Methodsmith does the legwork.](#you-decide-methodsmith-does-the-legwork) |
| Find the skills for your study type | [Built for three kinds of study](#built-for-three-kinds-of-study) |
| Install it | [Install](#install) |
| See worked examples, command by command | [Worked examples](#worked-examples) |
| Know how your data is protected | [Sensitive-data boundary](#sensitive-data-boundary) |
| Check a specific claim or limitation | [FAQ](#faq) and [Troubleshooting](#troubleshooting) |
| Update it safely, without losing your own skills | [Keep Methodsmith updated](#keep-methodsmith-updated) |
| Install on a locked-down or offline laptop | [Locked-down or demo laptop](#locked-down-or-demo-laptop) |

## What Methodsmith can do

| Stage | What it helps you do |
|---|---|
| **Frame and plan** | Turn a research question into a study design, estimands, an analysis plan, power or sample-size calculations, and preregistration packages. |
| **Build analyses** | Check data and cohorts, then build reproducible R/Python analyses for clinical studies, machine learning, meta-analysis, CLIF, and omics. |
| **Review the work** | Review methods, statistics, and code for leakage, calibration, fairness, and reproducibility issues before results are reported. |
| **Prepare results** | Create tables, figures, model cards, manuscript drafts, and submission packages; trace registered numbers to SAP outputs, code commits, and source-file hashes. |
| **Carry learning forward** | Record reviewed decisions and validated methods so the next study can start from them. |

You choose the research question, approve the analysis plan, resolve review
findings, and sign off the conclusions. Methodsmith drafts, runs, and checks
the work; it does not make the scientific decisions for you. See the
[worked examples](#worked-examples) and the
[sensitive-data boundary and its limits](#sensitive-data-boundary).

## Install

| Your situation | Do this |
|---|---|
| **Claude Code**, 2.1.292 or later | `claude plugin install methodsmith --marketplace sajor2000/methodsmith` |
| **Claude Code**, inside a running session (2.1.275+) | `/plugin install methodsmith --marketplace sajor2000/methodsmith` |
| **Codex** | `git clone https://github.com/sajor2000/methodsmith.git ~/methodsmith` then `bash ~/methodsmith/install.sh codex` |
| **Pi** | [Pi, generated install](#pi-generated-install) |
| **Gemini CLI, OpenCode, Kiro, Qwen Code** | [Also works with Codex, Pi, Gemini, and more](#also-works-with-codex-pi-gemini-and-more) |
| **Locked-down or offline laptop** | [Locked-down or demo laptop](#locked-down-or-demo-laptop) |
| **Source checkout**, with bare `/method-*` aliases | [Claude Code, easiest path](#claude-code-easiest-path) |
| **Windows PowerShell** | [Claude Code, easiest path](#claude-code-easiest-path) |

Installation makes Methodsmith available to your agent; then open your study
folder and run `/methodsmith:method-setup` (in Codex, ask it to use the
Methodsmith `method-setup` skill). Full platform details are in the
[setup guide](https://sajor2000.github.io/methodsmith/docs/setup) and
[Get started](#get-started) below.

## See it work

<a href="https://sajor2000.github.io/methodsmith/#tour"><img src="website/static/media/methodsmith-tour-poster.jpg" width="100%" alt="Opening frame of the 90-second Methodsmith tour: From question to paper, with a methods team at your side. You stay the scientist. Select to watch the video on the Methodsmith site."></a>

<sub><a href="https://sajor2000.github.io/methodsmith/#tour">Watch the 90-second tour</a> on the Methodsmith site, or <a href="website/static/media/methodsmith-tour.mp4">play the MP4 here on GitHub</a>: guideline routing, literature search, question framing, the analysis plan, data checks in R or Python, figures, and a first Results draft. Silent, scripted illustration on synthetic data; screens are mock-ups of the formats the skills define, not a recording of a live run.</sub>

<img src="website/static/brand/demo.svg" width="100%" alt="Terminal replay on synthetic data. /method-workflow detects an observational study and recommends method-sap. /method-sap links claim C1 to an ICH E9(R1) estimand and lists two decisions that block finalization. /method-review reports two P1, one P2 and one P3 finding, applies small-cell suppression, and returns Not ready.">

<sub>Scripted replay on synthetic data, abridged from the output formats the skills define; it is not a recording of a live run. Source: <a href="docs/brand/scripts/demo_transcript.py">docs/brand/scripts/demo_transcript.py</a>.</sub>

## You decide. Methodsmith does the legwork.

Every study runs the same loop: plan, work, review, compound. The plugin drafts,
runs and checks; every scientific choice passes through you. Nothing is analysed
until you approve the plan, and nothing is reported until you have judged the
review. The loop comes from Every's
[Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin);
Methodsmith adapts each step for research methods.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="website/static/brand/human-loop-dark.svg">
  <img src="website/static/brand/human-loop-light.svg" width="100%" alt="Swimlane. You, the scientist, frame the question, approve the plan, judge the findings and sign off the result. Methodsmith drafts the SAP with /method-plan, runs the approved analysis with /method-work, reviews every step with /method-review, and records the lessons with /method-compound, which feed the next study's plan.">
</picture>

Not sure where you are? `/method-workflow` reads the project and recommends the
next safe step.

## Built for three kinds of study

| Clinical statistics | Python and ML papers | Meta-analysis |
|---|---|---|
| `/method-question` PICO, FINER, hypothesis | `/method-model-choice` justify the model after the estimand | `/method-lit-search` PubMed, full text or authoritative sources |
| `/method-power` sample size and power, with a script | `/method-ml-track` data hashes, splits and metrics | `/method-evidence-map` a source-backed evidence map |
| `/method-sap` claims linked to estimands and decision evidence | `/method-verify` leakage, effect direction and PHI gate | `/method-prereg` PROSPERO, OSF or ClinicalTrials.gov |
| `/method-cohort` reproducible cohort and waterfall counts | `/method-model-card` calibration, fairness and limits | `/method-meta-analysis` random effects, REML with Hartung-Knapp |
| `/method-table1` traceable Table 1 | `/method-marimo` reactive, reproducible notebooks | `/method-checklist` PRISMA 2020 and its extensions |
| `/method-numbers` every reported number traced to the analysis | `/method-figure` calibration, ROC and forest plots | `/method-write` evidence-bound manuscript drafts |

## Why you can check its work

- **49 reporting standards**, covering reporting guidelines, appraisal tools,
  and templates, encoded with their official item IDs
  (CONSORT, STROBE, PRISMA, TRIPOD+AI, TARGET and more). Only the newest version
  of each guideline can load, and a test enforces it. Sources are listed in
  [Guideline sources](https://sajor2000.github.io/methodsmith/docs/guideline-sources).
- **A PHI guard.** A pre-tool hook keeps data values out of the model in
  schema-only projects and checks identifiers in supported web, MCP, and shell
  egress calls in every mode. Outputs are aggregate, with small cells
  suppressed. Details in [Sensitive-data boundary](#sensitive-data-boundary).
- **55 specialist reviewers**: methods, causal inference, multiplicity, leakage,
  calibration, fairness, reproducibility, PHI and more, run in parallel and
  deduplicated before you see them.
- **Numbers locked to raw data.** `/method-numbers` has manuscripts, tables,
  captions and abstracts cite numbers from a registry written by the analysis
  code, and a fail-closed gate traces each one to its SAP output, script commit
  and source hash.

## How it compares

From each project's public documentation, checked 2026-10-19.

| | Methodsmith | [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin) | [Superpowers](https://github.com/obra/superpowers) | [Scientific Agent Skills](https://github.com/K-Dense-AI/scientific-agent-skills) | [MedSci Skills](https://github.com/Aperivue/medsci-skills) |
|---|---|---|---|---|---|
| Built for | Biostatistics, clinical and ML research | Software engineers | Software engineers | Scientists across fields | Physician-researchers |
| Plan -> review -> compound loop | Yes | Yes | Plans and TDD | No | Router plus defined chains; no compound step |
| SAP with estimands | Yes | No | No | Power only | Analysis plan, no estimands |
| Reporting checklists | 49, item IDs, newest version only | No | No | Writing aids | 49 stated (guidelines and risk-of-bias tools) |
| PHI guard hook | Yes | No | No | No | De-identification skill |
| Hosts | Claude Code, Codex, Pi, more | 14 hosts | 16 hosts | Many | Claude Code, Codex, Cursor, Copilot |

The reporting-checklist row is not a count race: MedSci Skills states a similar
number, and the difference is how each is encoded and maintained. See the
[competitive audit](docs/audits/2026-10-19-medsci-skills-competitive-audit.md)
for the verified comparison and the gaps we have not closed.

## Try it

```text
Use Methodsmith to set up this project, then help me plan a study of
30-day mortality among ICU patients with sepsis. Show me the decisions I need
to make before we analyze any data.
```

![Skill map: 30 key skills across six phases (Frame, Design, Data, Plan, Execute, Review), with guardrails for ICH E9(R1) estimands, 49 reporting checklists, 55 specialist reviewers, and PHI-safe outputs](docs/workflow-diagram.png)

## How the package works

![Methodsmith package workflow: install, set up a project, run skills, and create research artifacts](docs/methodsmith-package-workflow.png)
<!-- brand:hero:end -->

---

<!-- rebrand:keep-start migration-guide -->
## Moving from ce-datascience

Methodsmith is the same plugin as ce-datascience, renamed in 5.0. Every
command and agent now starts with `method-` instead of `ce-`. A few names are
also shorter, for example `/ce-statistical-analysis-plan` is now `/method-sap`.

<details>
<summary><strong>Switch an existing ce-datascience install</strong> — what stays the same, and the per-harness commands</summary>

**What stays the same:** your own skills, your project's `.ce-datascience/`
folder (including the PHI-boundary settings in `config.local.yaml`), and the
plan -> work -> review -> compound loop.

**What the switch does:** the first Methodsmith install moves the old plugin's
files to a `backups/` folder next to the new install. Nothing is deleted, and
files you created are not touched.

To see what is installed on your machine, run `/method-update` after
installing Methodsmith, or run the same read-only checker from a checkout. It
prints exactly the commands below for each harness it finds:

```bash
bash plugins/methodsmith/skills/method-update/scripts/detect-pre-rename-install.sh
```

| Harness | Switch to Methodsmith |
|---|---|
| Claude Code | `claude plugin uninstall ce-datascience@ce-datascience-plugin`, then `claude plugin marketplace remove ce-datascience-plugin`, `claude plugin marketplace add sajor2000/methodsmith`, `claude plugin install methodsmith@methodsmith`. If you used `--aliases`, re-run `bash install.sh claude --aliases`. |
| Codex | `codex plugin marketplace remove ce-datascience-plugin`, then `codex plugin marketplace add sajor2000/methodsmith` and `bunx github:sajor2000/methodsmith install methodsmith --to codex`. Open `/plugins` and install Methodsmith. |
| OpenCode | `bunx github:sajor2000/methodsmith install methodsmith --to opencode` |
| Pi | `bunx github:sajor2000/methodsmith install methodsmith --to pi --pi-home ~/.pi/agent` |
| Gemini CLI, Kiro | `bunx github:sajor2000/methodsmith install methodsmith --to gemini --output .` (or `--to kiro`) in each workspace |
| Qwen Code | `qwen extensions uninstall ce-datascience`, then `qwen extensions install sajor2000/methodsmith:methodsmith` |

On Claude Code with `--aliases`, the old `/ce-*` commands keep working for one
release as deprecated aliases that point at the new skills. Elsewhere, use the
new names.

<details>
<summary>Every renamed command</summary>

<!-- rebrand:keep-end -->
<!-- rebrand:keep-start renamed-commands -->
| Before 5.0 | Methodsmith |
|---|---|
| `/ce-adversarial-review` | `/method-adversarial-review` |
| `/ce-bioinfo-qc` | `/method-omics-qc` |
| `/ce-brainstorm` | `/method-brainstorm` |
| `/ce-checklist-match` | `/method-checklist` |
| `/ce-clean-gone-branches` | `/method-clean-branches` |
| `/ce-clif` | `/method-clif` |
| `/ce-clif-meta-analysis` | `/method-clif-meta-analysis` |
| `/ce-clif-project-template` | `/method-clif-template` |
| `/ce-clinical-research-voice` | `/method-voice` |
| `/ce-code-review` | `/method-review` |
| `/ce-cohort-build` | `/method-cohort` |
| `/ce-commit` | `/method-commit` |
| `/ce-commit-push-pr` | `/method-pr` |
| `/ce-compound` | `/method-compound` |
| `/ce-compound-refresh` | `/method-compound-refresh` |
| `/ce-data-qa` | `/method-data-qa` |
| `/ce-debug` | `/method-debug` |
| `/ce-doc-review` | `/method-doc-review` |
| `/ce-effect-size` | `/method-meta-analysis` |
| `/ce-evidence-map` | `/method-evidence-map` |
| `/ce-fabric` | `/method-fabric` |
| `/ce-figure` | `/method-figure` |
| `/ce-genome-build` | `/method-genome-build` |
| `/ce-grill` | `/method-grill` |
| `/ce-handoff` | `/method-handoff` |
| `/ce-ideate` | `/method-ideate` |
| `/ce-journal-select` | `/method-journal-select` |
| `/ce-language-detect` | `/method-language-detect` |
| `/ce-literature-search` | `/method-lit-search` |
| `/ce-manuscript-citations` | `/method-citations` |
| `/ce-manuscript-package` | `/method-submission-package` |
| `/ce-manuscript-section-discipline` | `/method-section-check` |
| `/ce-marimo` | `/method-marimo` |
| `/ce-method-extract` | `/method-extract` |
| `/ce-ml-experiment-track` | `/method-ml-track` |
| `/ce-model-card` | `/method-model-card` |
| `/ce-model-strategy` | `/method-model-choice` |
| `/ce-notebook-edit` | `/method-notebook-edit` |
| `/ce-notebook-standards` | `/method-notebook-standards` |
| `/ce-numbers` | `/method-numbers` |
| `/ce-optimize` | `/method-optimize` |
| `/ce-phenotype-validate` | `/method-phenotype` |
| `/ce-plan` | `/method-plan` |
| `/ce-power` | `/method-power` |
| `/ce-pre-submission-audit` | `/method-presubmit` |
| `/ce-prereg` | `/method-prereg` |
| `/ce-pubmed` | `/method-pubmed` |
| `/ce-release-notes` | `/method-release-notes` |
| `/ce-report-bug` | `/method-report-bug` |
| `/ce-research-question` | `/method-question` |
| `/ce-resolve-pr-feedback` | `/method-resolve-feedback` |
| `/ce-review-pack` | `/method-signoff` |
| `/ce-rstats` | `/method-r` |
| `/ce-sap-tabular` | `/method-sap-workbook` |
| `/ce-sas-stata-assess` | `/method-sas-stata` |
| `/ce-scientific-anti-slop` | `/method-anti-slop` |
| `/ce-scientific-writing` | `/method-write` |
| `/ce-sessions` | `/method-sessions` |
| `/ce-setup` | `/method-setup` |
| `/ce-sprint` | `/method-sprint` |
| `/ce-statistical-analysis-plan` | `/method-sap` |
| `/ce-table1` | `/method-table1` |
| `/ce-trial-design` | `/method-trial-design` |
| `/ce-update` | `/method-update` |
| `/ce-verify` | `/method-verify` |
| `/ce-work` | `/method-work` |
| `/ce-workflow` | `/method-workflow` |
| `/ce-worktree` | `/method-worktree` |
<!-- rebrand:keep-end -->

Agents keep the rest of their name: `ce-methods-reviewer` is now `method-methods-reviewer`. <!-- rebrand:keep -->

</details>

</details>

## Get started

The normal path is intentionally short: install the plugin, start your agent,
then run setup. For complete platform details, see the
[public setup guide](https://sajor2000.github.io/methodsmith/docs/setup).

### Choose your install route

From a source checkout, run `bash install.sh doctor` to see which local tools
are available and the exact standard or locked-down route. Use the standard
route on a personal or managed laptop that can run Git and the agent CLI. On a
corporate or locked-down laptop, ask IT for the approved offline artifact and
use the artifact-specific path below; Bun, Git, GitHub CLI, and Quarto are not
required for basic use.

### Claude Code, easiest path

No checkout needed (terminal command, Claude Code 2.1.292 or later):

```bash
claude plugin install methodsmith --marketplace sajor2000/methodsmith
claude
```

Or, inside a running Claude Code session (2.1.275 or later):

```text
/plugin install methodsmith --marketplace sajor2000/methodsmith
```

No terminal at all: the in-session install works on any Claude Code surface
(desktop app or terminal). Paste the `/plugin install ...` line above in the
prompt, run `/methodsmith:method-setup`, and enable auto-update under
`/plugin` -> Marketplaces. Details: [docs/setup.md](docs/setup.md).

From a source checkout, with the optional bare `/method-*` aliases, on macOS,
Linux, WSL, or Git Bash:

```bash
git clone https://github.com/sajor2000/methodsmith.git ~/methodsmith
cd ~/methodsmith
bash install.sh claude --aliases
claude
```

Windows PowerShell:

```powershell
git clone https://github.com/sajor2000/methodsmith.git "$HOME\methodsmith"
cd "$HOME\methodsmith"
.\install.ps1 claude -Aliases
claude
```

Then open the target project and run the native command:

```text
/methodsmith:method-setup
```

The `--aliases` flag is optional; it installs safe local aliases so the
demo-friendly bare `/method-*` commands work. The namespaced command above is the
reliable default for every native Claude plugin install.

### Claude Code via GitHub CLI (skills only)

GitHub CLI 2.90+ (verified with 2.100.0) can install the skills without the
plugin machinery. Install every skill, pinned to the latest release tag, or one
skill by name (add `--pin methodsmith-v5.1.1` to hold a fixed version):

```bash
gh skill install sajor2000/methodsmith --all --agent claude-code --scope user
gh skill install sajor2000/methodsmith method-citations --agent claude-code --scope user
```

This route copies skills only — no reviewer agents, no commands, no hooks, and
no auto-update (update by re-running the command after a new release) — writes
them flat into your skills folder, and `--all` also picks up the sample skills
from the repository's `tests/fixtures/`; prefer the single-skill form, or delete
the extras afterwards. See the [setup guide](docs/setup.md) for details.

### Codex, easiest path

macOS, Linux, WSL, or Git Bash:

```bash
git clone https://github.com/sajor2000/methodsmith.git ~/methodsmith
cd ~/methodsmith
bash install.sh codex
codex
```

Windows PowerShell:

```powershell
git clone https://github.com/sajor2000/methodsmith.git "$HOME\methodsmith"
cd "$HOME\methodsmith"
.\install.ps1 codex
codex
```

Inside Codex, open `/plugins`, install **Methodsmith**, restart Codex, then
start a new thread and ask Codex to use Methodsmith for setup. The helper
also installs the generated agent bridge when Bun is available.

### Pi, generated install

Install Pi's two workflow extensions once, then generate the Methodsmith files into the
Pi agent root:

```bash
pi install npm:pi-subagents
pi install npm:pi-ask-user
cd ~/methodsmith
bun run src/index.ts install ./plugins/methodsmith --to pi --pi-home "$HOME/.pi/agent"
```

Restart Pi, open the project, then invoke `method-setup` with Pi's normal skill
interface. `pi-subagents` is required for Methodsmith review/workflow delegation;
`pi-ask-user` enables the short setup confirmation UI.

### Use the plugin after installation

Installation makes Methodsmith available to the agent; setup configures it
for each individual code or research project. After installing:

1. Restart Claude Code, Codex, or Pi so it loads the new plugin files.
2. Open the project or study directory you want Methodsmith to work on.
3. Configure that project with the setup skill.
4. Run the workflow skill to see the ordered research or engineering lifecycle
   and the next recommended skill.

In Claude Code, native plugin commands are namespaced:

```text
/methodsmith:method-setup
/methodsmith:method-workflow
```

When `--aliases` or `-Aliases` was used, the shorter `/method-setup` and
`/method-workflow` forms work too. In Codex, start a new task and say:

```text
Use the Methodsmith method-setup skill for this project.
Then use the Methodsmith method-workflow skill and recommend the next step.
```

After that, request a specific skill in plain language or use its displayed
name, for example `method-question`, `method-data-qa`, `method-plan`, or
`method-review`. The plugin works in the currently open project; repeat setup
when moving to a different project with a different stack or data layer.

Setup starts with one detected-profile summary instead of a full questionnaire.
It shows inferred language, environment, reporting format, storage, and data
domain with evidence, then offers **Continue**, **Adjust**, or **Full survey**.
It asks only for values that are ambiguous or needed by the current workflow.

![Steps for using Methodsmith setup, workflow, and task-specific slash commands](docs/methodsmith-skill-commands.png)

### Locked-down or demo laptop

Use the offline release artifacts when package managers, GitHub CLI, Git, Bun,
or Quarto are blocked by IT policy. Basic Claude Code and Codex use does not
require Bun, GitHub CLI, or Quarto.

Claude Code can load the approved plugin folder or ZIP directly:

```bash
claude --plugin-dir /approved/path/methodsmith
claude --plugin-dir /approved/path/methodsmith.zip
```

Native Claude plugin skills are namespaced:

```text
/methodsmith:method-setup --locked-down
/methodsmith:method-workflow
```

Bare `/method-*` commands are an optional local alias layer, not a native plugin
guarantee. Install them only when you want demo-friendly command names:

```bash
bash scripts/install/install-claude-aliases.sh --plugin-dir /approved/path/methodsmith --scope user
```

For Codex without Bun, unpack `methodsmith-codex-local.zip` and run:

```bash
bash install-codex-offline.sh --source /approved/path/methodsmith-codex-local --codex-home "${CODEX_HOME:-$HOME/.codex}"
```

On Windows PowerShell, use the package's native installer:

```powershell
.\install.ps1 codex -Source C:\approved\methodsmith-codex-local -CodexHome "$HOME\.codex"
```

Restart Codex, open `/plugins`, install Methodsmith from the local
marketplace, then restart again. The installer writes the personal marketplace
file under `.agents/plugins/marketplace.json` and points it at
`./.codex/plugins/methodsmith` relative to that marketplace root.

### Recommended research add-ons

Methodsmith's bundled `/method-pubmed` workflow works on its own. For agent-native
PubMed, Europe PMC, MeSH, citation, and related-article tools, optionally add
[cyanheads/pubmed-mcp-server](https://github.com/cyanheads/pubmed-mcp-server).
For full-text synthesis, claim verification, figures, trials, regulatory
documents, preprints, and biological databases, optionally add the
[Paperclip CLI and its official Paperclip skill, or its MCP server](https://paperclip.gxl.ai/docs).

Start with PubMed MCP for lightweight biomedical discovery; add Paperclip when
research planning needs deeper full-text or cross-source evidence. Neither is
required or installed automatically. Review institutional privacy and network
policy before connecting a hosted research service. See the
[optional research add-ons setup](docs/setup.md#8-optional-research-add-ons).
The Paperclip skill is fetched and maintained by Paperclip, not bundled with
Methodsmith. Methodsmith workflows currently auto-detect the Paperclip CLI only; external
MCP or provider-skill results are direct agent capabilities, not automatic Methodsmith
artifact handoffs.

### Source checkout for contributors

Bun and Git are contributor/release tooling. Install them only when you need to
build, validate, or convert the plugin from source:

```bash
curl -fsSL https://bun.sh/install | bash
export CE_DS_REPO="$HOME/methodsmith"
git clone https://github.com/sajor2000/methodsmith.git "$CE_DS_REPO"
cd "$CE_DS_REPO"
bun install
```

Launch Claude Code from the checkout:

```bash
claude --plugin-dir "$CE_DS_REPO/plugins/methodsmith"
```

**Pro tip** — save yourself typing forever:

```bash
printf "\nalias claude-ds='claude --plugin-dir %s/plugins/methodsmith'\n" "$CE_DS_REPO" >> ~/.zshrc
source ~/.zshrc
```

Now just type `claude-ds` in any project.

### Configure your stack

```text
/methodsmith:method-setup
```

Picks up your language (R or Python), IDE, libraries, and data layer automatically.
It checks project evidence first and only asks questions that change generated
config or workflow routing.
If you installed optional aliases, `/method-setup` works too.

### Sensitive-data boundary

Before setup looks at any data, `method-setup` asks one question and saves the
answer as `phi_environment.mode` in the gitignored, machine-local
`.ce-datascience/config.local.yaml`:

| Answer | Saved as | What happens |
|---|---|---|
| **Approved endpoint: full access** (HIPAA-compliant with a BAA, or institution-approved) | `mode: approved` | No restrictions on the model for the rest of the session. The agent never raises the boundary again. You are responsible for that approval. |
| **Not approved or unsure: schema-only** (also used when no answer is saved, or the saved value cannot be read) | `mode: schema-only` | The agent sees column headings, types, row counts, and % missing, never data values such as names, MRNs, or claim numbers. It writes scripts that print only aggregates, with counts under 11 suppressed. It cannot inspect example rows, debug value-level parsing or join mismatches by example, read free text, or spot individual entry errors. |
| **No sensitive data: public or synthetic** | `mode: no-sensitive-data` | No restrictions, never raised again. |

Older configs keep working: `compliant: true` reads as `approved`,
`compliant: false` as `schema-only`, and `sensitive_data: false` as
`no-sensitive-data`. If the keys disagree, any schema-only signal wins.

**What enforces it.** In Claude Code, a plugin `PreToolUse` hook
(`hooks/data-boundary-guard.py`) runs only inside projects that have a
`.ce-datascience/` directory, in the working tree or the main checkout of a
linked worktree. It is silent unless it blocks a call. In schema-only mode it
denies:

- `Read`, `NotebookRead`, and content-mode `Grep` on data files. Data files are
  `.csv`, `.tsv`, `.parquet`, `.xlsx`, `.sas7bdat`, `.dta`, `.rds`, `.sqlite`,
  `.jsonl`, and similar, including compressed or backup copies (`.csv.gz`,
  `.csv.bak`), plus anything under the configured `data_root` and the safe
  runner's logs. A notebook with saved outputs also counts; clear its outputs
  first.
- Any shell command (`Bash`, `Monitor`, `PowerShell`) whose text names a data
  path, an extension glob, or `data_root`, whatever the program, unless it only
  lists metadata (`ls`, `wc`, `du`, `find`, `git status`/`log`) or runs the
  schema helper. Inline code (`python -c`, `Rscript -e`, heredocs) that opens
  data or globs a data directory, writing a script and running it in the same
  command, copying a data file to a non-data name, and recursive `grep`/`rg`
  without an `--include`/`-g`/`-t` limited to code are denied too.
- Running a script file (`python`, `Rscript`, `bash`/`sh`, `quarto render`,
  `jupyter nbconvert --execute`) whose code names a data path or `data_root`,
  or calls a reader (`read_csv`, `read_parquet`, `read_excel`, `read_sas`,
  `read_stata`, `fread`, `readRDS`, `arrow::`, DuckDB, SQLite) on a path held
  in a variable, unless the command runs through the safe runner. The hook
  reads the script itself, up to 1 MB. Scripts that do not touch data, or that
  only read aggregate tables that pass the check below, run as before.

**Safe runner.** `scripts/method-safe-run -- <command>` runs the command and writes
its full stdout and stderr to `.ce-datascience/runs/<UTC-timestamp>-<pid>.log`
(gitignored). It prints only the exit code, the duration, the files created or
modified under the project (path, size, and row count for tabular files), and
the last 30 lines of stderr with quoted literals, digit runs of 4 or more,
emails, phone numbers, SSNs, and identifier-index values masked. Traceback file
and line frames stay readable. It never prints stdout: open the log yourself.
The hook's deny message gives the runner's full path. It accepts only the
plugin's own runner (or a byte-identical copy) and still checks uploads inside
it.

**Aggregate reads.** `Read`, `cat`, `head`, and `tail` of `.csv`, `.tsv`, and
`.md` files under the aggregate directories are allowed in schema-only mode
when the table passes the aggregate check: no identifier-like column headings,
no cell in the identifier index or shaped like an identifier, no integer count
from 1 to 10 (the small-cell rule; 0 is fine), and at most 500 rows. Otherwise
the deny reason names the rule that failed, never the value. The directories
default to `output`, `results`, `analysis/publication`, and
`analysis/sap-tables`; set `phi_environment.aggregate_dirs` to change them.
`data_root` always wins: nothing under it is readable.

**Locale packs.** Projects outside the US add national identifier shapes with
`locale: uk` (or another pack) under `phi_environment` in
`config.local.yaml`. A pack is data — `hooks/locales/<locale>.json` holds
identifier regexes, optional named checksum validators (a match counts as an
identifier only when its checksum validates, so checksum-invalid synthetic
test values pass), and column-name patterns — so new countries need no
guard-code changes. An absent key changes nothing; a malformed or unknown
pack fails closed. The schema helper masks locale-flagged headings the
same way and refuses to print on a malformed or unknown pack.

The schema helper `scripts/schema-peek.py` prints headings, types, counts, and
% missing, never a cell value. It prints `col_1..col_n` when a file has no
header row, and `col_<k> [masked header]` for a heading that is itself an
identifier (an identifier shape, or a value in the identifier index).

#### What external tools receive

PubMed, Paperclip, and every other MCP tool receive search terms, MeSH terms,
PMIDs, DOIs, and paper titles. They never receive data values, identifiers,
row text, or data files. This holds in **every mode, including after you
approve the endpoint**: approving the model endpoint does not cover
third-party services such as NCBI or Paperclip.

Claude Code `WebSearch` queries, `WebFetch` URLs and prompts, MCP tool
arguments, and detected shell uploads are checked for common identifier
patterns and values in the project identifier index. Research search terms,
MeSH terms, PMIDs, DOIs, and paper titles pass when they do not match an
identifier.

The same hook enforces this for every `mcp__*` call, for shell uploads, and for
shell calls to NCBI E-utilities (`curl` or `wget` to
`eutils.ncbi.nlm.nih.gov`, and the `method-pubmed` search script). It denies
arguments that contain an SSN, an email address, a US phone number, a
keyword-anchored record number (MRN, medical record, patient ID, member ID,
claim number), a keyword-anchored date of birth, or a value in the identifier
index. It also denies Paperclip upload, import, or share calls that name a
local data file, and `curl`, `wget`, `scp`, or `rsync` uploads of data files.
PMIDs, DOIs, PMCIDs, author surnames, and ordinary research queries pass
silently. The skills carry the same rule.

**Identifier index.** Whenever `data_root` is set, in every mode, `method-setup`
builds and `method-data-qa` refreshes the identifier index with
`scripts/method-identifier-index`. It reads identifier-like columns under
`data_root` (names; MRN, patient, member, subscriber, and record IDs; claim
numbers; SSN; date of birth; address; phone; email) and stores only salted
hashes in `.ce-datascience/identifier-index.local.json`: local, gitignored,
with a random per-project salt and no plaintext. It prints counts only. Each
full value is stored, plus first+last name pairs, plus single tokens that
contain a digit for ID columns only, so a lone surname or common word never
matches. The hook hashes every one- to three-word run of each argument, denies
on a match without echoing it, and is silent when no index exists. With a
200,000-entry index the lookup adds a few milliseconds.

**Limits.** The hook is defense in depth, not a sandbox. Enforcement is Claude
Code only: Codex and OpenCode installs carry the hook entry but it exits
immediately there, and Gemini, Kiro, Copilot, and Pi skip hooks, so those
harnesses rely on the skill instructions alone. The hook requires `python3`.
If it is missing, the launcher prints a warning and exits successfully, so the
guard is inactive and calls are not blocked. The script check is heuristic
static analysis: a script that builds a data path at run time, or reads data
through a function the hook does not recognize, can still print values, and
programs it cannot parse (deliberate obfuscation) are out of scope. Values
that are not in identifier columns, such as free-text notes, are not indexed,
and the identifier patterns catch common shapes, not every one. A patient who
shares a full name with an author you search for blocks that name. A config
problem resolves to schema-only. An unexpected internal error blocks only
calls that mention a data file or an upload; anything else is allowed with a
one-line warning, so a hook bug never blocks unrelated work.

**Changing the answer.** Re-run `method-setup`, or edit or delete the
`phi_environment` block in `.ce-datascience/config.local.yaml`.

### See your workflow

```text
/methodsmith:method-workflow
```

Shows every step for your project type and tells you what to do next.
Each slash skill now starts with a `Skill Value` block that states the problem,
expected output, question boundary, and non-goal so new users can pick the right
command without guessing.

---

## Worked examples

The examples below use bare `/method-*` commands for readability. In native Claude
plugin installs, use `/methodsmith:method-*` unless local aliases are installed.

<details>
<summary><strong>Show the worked examples</strong> — one per study type, in the order you would run them</summary>

### Run an observational study

```
/method-grill "sepsis bundles and 30-day mortality in ICU, target Critical Care Medicine"
/method-question "sepsis bundles and 30-day mortality in ICU"
/method-pubmed
/method-evidence-map
/method-extract
/method-checklist
/method-meta-analysis
/method-power
/method-cohort
/method-data-qa
/method-model-choice
/method-plan
/method-sap-workbook
/method-sprint
/method-work
/method-verify
/method-review
/method-compound
```

### Keep analysis decisions explicit

The lifecycle now makes the most consequential analytical assumptions visible
before code is written or trusted:

- `/method-data-qa` reconciles row counts and joins, checks keys and type stability,
  records missing-data handling, and returns GO, WARN, or NO-GO rather than
  silently substituting fallback data.
- `/method-model-choice` resolves nontrivial model, estimand, dependence, and
  diagnostic choices after QA and before SAP finalization.
- `/method-plan` owns the canonical versioned SAP. Add
  `/method-sap` only when a complex clinical or observational
  design needs a claim-to-dataset schema, explicit estimands, and decision evidence; use
  `/method-sap-workbook` for the workbook rather than creating a competing plan.
- `/method-work` fails loudly at missing or corrupt inputs. `/method-review`
  checks integrity and causal timing, and requires censoring-aware,
  decision-aligned time-dependent AUC for dynamic survival models.

For an administrative claims study, use the claims-oriented SAP workflow when
the canonical SAP needs linked claims, datasets, variables, analyses,
diagnostics, outputs, and decision evidence:

```text
/method-sap
```

### Statistical correctness

The statistical methods behind the skills and reviewers were audited against
primary sources. What that means in practice:

- **Estimands first.** SAPs from `/method-plan` and `/method-sap`
  state ICH E9(R1) estimands (population, treatment, endpoint, intercurrent
  events, summary measure), and `method-sap-drift-detector` flags estimand,
  missing-data, and inference drift in code.
- **Sample size and pooling.** `/method-power` covers two-proportion,
  non-inferiority (one-sided 0.025), survival, cluster, and Riley-criteria
  `pmsampsize` designs. `/method-meta-analysis` pools with REML, a Hartung-Knapp CI,
  and a k-1 df prediction interval. `/method-trial-design` computes type I error
  under non-binding futility without the futility bound.
- **Tables and registration.** `/method-table1 --design rct|observational|descriptive`
  adds an SMD column for observational comparisons and never shows baseline
  p-values for randomized trials. `/method-prereg` blocks a draft SAP, unblinded
  data, and late PROSPERO registration.
- **Reporting routes.** All prediction models route to TRIPOD+AI (it supersedes
  TRIPOD 2015), target trial emulation to the standalone 21-item TARGET
  checklist, and protocols to SPIRIT 2025 or PRISMA-P.
- **Reviewers.** Calibration, causal-inference, multiplicity, fairness,
  data-leakage, and methods reviewers follow current guidance (for example,
  the calibration hierarchy, M-bias, co-primary endpoints needing no alpha
  correction, and random splits not being leakage by themselves).
- **Data and validation.** `/method-phenotype` reweights sensitivity and
  specificity for verification bias under algorithm-stratified chart review;
  `/method-data-qa` drops mean imputation and LOCF advice; `/method-pubmed` keeps
  unindexed and non-English records by default.

### Prepare a manuscript for handoff

```text
/method-journal-select
/method-submission-package
/method-citations
/method-write
/method-presubmit
/method-signoff
```

Pick the target journal with `/method-journal-select` before packaging: its
per-journal next-step list (article type, word limits, required checklist)
sets what the package must satisfy.

Use `/method-voice`, `/method-section-check`, or
`/method-anti-slop` directly only for a focused prose pass. The combined
pre-submission audit is the final editing gate; required Methods rationale is
preserved, while retrospective interpretation remains in Discussion.

### Scientific input and disclosure contracts

Power-effect pooling requires a selected compatible estimand, outcome/horizon,
adjustment set, scale/unit and independent contributions. Its `contract=` artifact
travels with the pooled signal; legacy tables/signals need reconciliation before
automatic power use. Formal study/performance synthesis uses
`method-clif-meta-analysis`, not the power-anchor parser. Verification separates
inferential MI from prediction validation/deployment and event targets from
recruitment N. Equivalence alpha follows the study framework rather than a
universal NI convention. Phenotype validation rejects duplicate patient keys.
Tracking preserves the chosen validation design and keeps full sensitive logs
restricted; only reviewed, disclosure-safe aggregate summaries enter Git.

### Numbers locked to raw data

Clinical journals, reviewers, and data-sharing audits ask where each number in a
paper came from. `/method-numbers` makes that answer checkable: a rigor signal, not a
style rule. Analysis code registers aggregates in
`analysis/numbers/registry.json` (R or Python; counts from 1 to 10 are stored
suppressed). The manuscript cites them as `{{num:<id>}}`. A gate fails the
submission when a number can't be traced. Each number follows one chain:
SAP output -> script@commit -> source file hash -> registry entry -> sentence.

Worked example (synthetic):

```r
# analysis/primary_cox.R, committed before it runs
source("analysis/numbers/method_numbers.R")
register_number("primary.hr", 0.781, kind = "estimate", ci = c(0.664, 0.918),
                sources = "data/analytic.parquet", sap_output = "A3_cox_primary.csv")
```

```text
manuscript/results.qmd:  The hazard ratio was {{num:primary.hr}}.
rendered:                The hazard ratio was 0.78 (95% CI, 0.66-0.92).
gate on a typed number:  manuscript/abstract.md:7: untraced number: 0.81
gate after a data pull:  registry:primary.hr: stale: source data/analytic.parquet changed
```

The gate also fails on unknown ids, unsuppressed small cells, entries without a
SAP output or committed script, and when it found nothing to check. It allows
years, citation markers, figure, table, and item numbers, dates, quoted
guideline text, and the doses or units you declare. Table 1, figure captions,
model cards, and scientific writing cite the registry; `method-verify`,
`method-presubmit`, and `method-submission-package` run the gate and fail
closed. Word manuscripts keep each number as a registry-owned field
(`ADDIN CE_NUM <id>`, beside Zotero's citation fields);
the gate fails a field whose text was hand-edited, and a number typed into a
Word table. Rendered text copies keep an adjacent `.numbers.json` provenance map; typed matching numbers and quoted results fail the gate. Word headers, footers and notes are checked alongside the body.

Numeric-prefix compounds such as `7-patient` and `2.4-fold` require registry provenance. Fixed design phrases such as `28-day` need an explicit declaration; hyphenation is not an exemption. It does not read numbers inside images.

### Build a prediction model

```
/method-question
/method-checklist
/method-cohort
/method-plan
/method-ml-track
/method-optimize
/method-work
/method-model-card
/method-review
```

### Work with CLIF consortium data

```
# Anchored to clif-icu.com; setup can infer a declared matching family.
# Use an explicit call when choosing the family for this task:
/method-clif --version 2.1.0  # CLIF 2.1 + mCIDE 2.1
# or
/method-clif --version 3.0.0  # CLIF 3.0 + mCIDE 3.0
/method-clif-meta-analysis  # Site-to-lead or literature synthesis in R/Python
/method-workflow
/method-work
```

If a direct call conflicts with an explicitly declared project pair, Methodsmith asks
which source is intended before it validates categories or generates filters.

### Analyze omics data

```
/method-omics-qc
/method-genome-build
/method-plan
/method-work
/method-review
```

### Ship a software fix

```
/method-brainstorm
/method-plan
/method-work
/method-review
```

### Maintain the plugin professionally

```
/method-sessions
/method-resolve-feedback
/method-release-notes
/method-report-bug
```

These workflow utilities are adapted from the original compound-engineering plugin so the public plugin can support release questions, bug reports, cross-session debugging, and statistical-methodology PR feedback without pulling in unrelated Rails, frontend, Xcode, Slack, product-pulse, dogfood, LFG, or agent-native workflows.

Repository maintenance is reported weekly through [Weekly Branch Maintenance](.github/workflows/branch-maintenance.yml). It identifies remote candidates only; inspect local worktrees and confirm any deletion with `/method-clean-branches`.

</details>

---

## Works with your stack

| Stack | IDE | Output | Libraries |
|---|---|---|---|
| **Python + Jupyter** | JupyterLab, VS Code | `.ipynb` | pandas, polars, scipy, statsmodels, scikit-learn |
| **Python + Marimo** | Marimo, VS Code | reactive `.py` | pandas, polars, scipy, statsmodels, scikit-learn |
| **R** | RStudio, VS Code | Quarto `.qmd`, `.Rmd` | tidyverse, data.table, survival, lme4, gt, tidymodels |

## Knows your data layer

| Data layer | How it activates | What it does |
|---|---|---|
| **OMOP CDM** | SQL with `cdm_source`, `concept`, `person` | OMOP SQL + concept sets, vocabulary pinning |
| **CLIF** | `CLIF_CLAUDE.md`, `clif-icu` remote, or CLIF handoff | Anchors to clif-icu.com; explicit CLIF/mCIDE 2.1 or 3.0 family, Parquet-only, version-correct mCIDE vocab, POC sign-off |
| **Admin claims** | Medicare/Medicaid/MarketScan in code | Enrollment gaps, NDC-to-RxNorm, claims reviewer |
| **Custom EHR** | Default | PHI scanning, generic cohort building |
| **Bioinformatics** | `.fastq`, `.bam`, `Snakefile` | FastQC/MultiQC, genome build, batch-effect screen |

<details>
<summary><strong>Upstream Compound Engineering features included in this fork</strong> — what was ported, area by area</summary>

This fork tracks useful infrastructure and workflow improvements from the original [compound-engineering](https://github.com/EveryInc/compound-engineering-plugin) plugin while keeping the product scoped to health data science.

| Area | What changed for data scientists |
|---|---|
| Planning and brainstorming | `/method-plan` keeps SAP/implementation dual mode and now starts summaries with an implementation-independent objective, supports upstream output modes, preserves format on resume, and strengthens synthesis and research routing. `/method-brainstorm` keeps study-design framing while adding grouped requirements, output-mode handling, and visual communication behavior. |
| Safe execution and optimization | `/method-work` verifies that parallel workers can start from a complete tracked snapshot and keeps uncommitted dependencies inline. `/method-optimize` gives parallel Codex experiments separate directories and requires measurable baselines and outcomes. |
| Debugging | `/method-debug` covers correctness and performance investigations, records a baseline before tuning, redacts secrets from captured evidence, and repeats the original measurement after a fix. |
| PR and review workflow | `/method-resolve-feedback` carries upstream GraphQL pagination and split-reference handling, then restores statistical methodology and SAP-aware response language. `/method-review` applies path-scoped `CODING_STANDARDS.md` criteria without replacing binding repo instructions. `/method-commit` and `/method-pr` use a temporary Git index so named-file commits do not absorb unrelated staged or later working-tree changes. |
| Setup health | `/method-setup` detects obsolete Codex tool-map blocks and offers bounded cleanup guidance instead of silently rewriting user configuration. |
| Session history | `/method-sessions` uses upstream cross-platform discovery improvements for Claude Code, Codex, and Cursor sessions, with repo-root pre-resolution and structured extraction scripts. |
| Distribution and installation | The converter supports current `method-*.md` agent source files while still parsing legacy `*.agent.md`, respects `CODEX_HOME`, writes Codex roots correctly, and manages `.codex/hooks.json` without clobbering manual hooks. |
| Public support | `/method-release-notes` and `/method-report-bug` are included as curated support skills for a professional public plugin surface. |

Core-only Compound Engineering skills such as Proof review, demo-reel capture,
frontend/Rails/iOS helpers, LFG, simplify-code, strategy, promote, and polish
remain external. When the core Compound Engineering plugin is also installed,
methodsmith handoffs can use those skills with a visible fallback; they are
not packaged as methodsmith slash skills.

</details>

## Reviews against 49 reporting checklists

The checklist registry records publication evidence, current versus legacy versions, and methodological roles. Reporting guidelines, appraisal tools, planning templates, and unresolved candidates are not treated as interchangeable routes; unresolved entries remain explicitly labeled rather than being presented as authoritative.

[Guideline sources](docs/guideline-sources.md) lists each checklist's primary citation, PMID, DOI, verification status, and superseded versions. It is generated from the registry.

| Study type | Primary | Extensions |
|---|---|---|
| Observational cohort | STROBE (STROBE-MR stand-alone for Mendelian randomization) | RECORD, RECORD-PE, STREGA |
| Randomized trial | CONSORT (SPIRIT 2025 for protocols) | CONSORT-AI, SPIRIT-AI, Cluster, Adaptive, N-of-1, Outcomes 2022 (report and protocol) |
| Prediction model | TRIPOD+AI (supersedes TRIPOD 2015) | TRIPOD-LLM, MI-CLAIM |
| Diagnostic accuracy | STARD (STARD-AI stand-alone for AI index tests) | CLAIM |
| Systematic review | PRISMA (PRISMA-P for protocols; stand-alone DTA, NMA, IPD, ScR by review type) | QUADAS-3 (DTA appraisal; supersedes QUADAS-2), CHARMS (prediction-model reviews) |
| Target trial emulation | TARGET (standalone) | |
| Early live clinical evaluation of AI | DECIDE-AI | |
| Other | SQUIRE, GRAMMS, STaRT-RWE, ARRIVE, CARE, CHART, CHEERS, COREQ, DEAL (LLM), PDSQI-9 (LLM summaries), REFORMS | |

---

## Also works with Codex, Pi, Gemini, and more

Run generated installs from the repo root (`cd "$CE_DS_REPO"`). Use
`./plugins/methodsmith` with the leading `./` for local installs.

| Platform | Easiest command |
|---|---|
| Claude Code, no checkout | `claude plugin install methodsmith --marketplace sajor2000/methodsmith` then `/methodsmith:method-setup` |
| Claude Code via GitHub CLI 2.90+ | `gh skill install sajor2000/methodsmith --all --agent claude-code --scope user` (skills only; caveats in the setup guide) |
| Claude Code, one-command setup | `bash install.sh claude --aliases` then `/method-setup` |
| Claude Code, Windows PowerShell | `.\install.ps1 claude -Aliases` then `/method-setup` |
| Claude Code | `claude --plugin-dir "$CE_DS_REPO/plugins/methodsmith"` then `/methodsmith:method-setup` |
| Claude Code, offline | `claude --plugin-dir /approved/path/methodsmith.zip` |
| Claude bare aliases | `bash scripts/install/install-claude-aliases.sh --plugin-dir "$CE_DS_REPO/plugins/methodsmith" --scope user` |
| Codex, one-command setup | `bash install.sh codex` then install Methodsmith from `/plugins` |
| Codex, Windows PowerShell | `.\install.ps1 codex` then install Methodsmith from `/plugins` |
| Codex native + agent bridge | `bun run src/index.ts install ./plugins/methodsmith --to codex --codex-home "$CODEX_HOME"` |
| Codex offline local marketplace | `bash install-codex-offline.sh --source /approved/path/methodsmith-codex-local --codex-home "$CODEX_HOME"` |
| Codex standalone | `bun run src/index.ts install ./plugins/methodsmith --to codex --codex-home "$CODEX_HOME" --include-skills` |
| Pi | `bun run src/index.ts install ./plugins/methodsmith --to pi --pi-home "$HOME/.pi/agent"` |
| Gemini CLI | `bun run src/index.ts install ./plugins/methodsmith --to gemini --output /path/to/gemini-workspace` |
| OpenCode | `bun run src/index.ts install ./plugins/methodsmith --to opencode --output /path/to/workspace` |
| Kiro | `bun run src/index.ts install ./plugins/methodsmith --to kiro --output /path/to/kiro-workspace` |
| Qwen Code | `qwen extensions install sajor2000/methodsmith:methodsmith` |
| All generated targets | `bun run src/index.ts install ./plugins/methodsmith --to all` |

Pi also needs `pi install npm:pi-subagents` first.
Qwen Code uses its native extension installer; it is not a generated `--to qwen` converter target. Cursor, Copilot, and Droid are also native plugin ecosystems, not `--to` targets. `--to all` only writes generated targets detected on the machine and skips native-only plugin ecosystems.

For a non-default Codex profile, point both Codex and the installer at the same root:

```bash
export CODEX_HOME="$HOME/.codex/profiles/research"
codex plugin marketplace add "$CE_DS_REPO"
cd "$CE_DS_REPO"
bun run src/index.ts install ./plugins/methodsmith --to codex --codex-home "$CODEX_HOME"
CODEX_HOME="$CODEX_HOME" codex
```

Inside Codex, run `/plugins`, select this local marketplace, install `methodsmith`, then restart. Codex's native plugin install provides the skills; the Bun command above adds generated agents until Codex supports plugin-defined agents natively.

Codex installs have two supported modes:

- **Native plugin + agent bridge (recommended):** install the plugin inside Codex with `/plugins`, then run `install --to codex --codex-home "$CODEX_HOME"` to add generated agents to the same profile.
- **Standalone generated install:** run `bun run src/index.ts install ./plugins/methodsmith --to codex --codex-home "$CODEX_HOME" --include-skills` when native plugin install is unavailable. This writes generated skills and agents. Managed `.codex/hooks.json` entries and MCP configuration are written only for plugins that actually declare hooks or servers; Methodsmith currently declares neither.

Managed Codex hooks are tagged with plugin metadata so upgrades can replace this plugin's hook entries without deleting manual hooks or hooks owned by another plugin. If an existing `hooks.json` is malformed, the installer backs it up before writing a managed replacement.

See [Codex profile and hook installation](docs/solutions/integrations/codex-profile-and-hook-installation.md) for the profile, standalone, and recovery details.
See [the setup guide](docs/setup.md) for exact Claude, Codex, OpenCode, Gemini, Kiro, Pi, and Qwen walkthroughs.

---

## Keep Methodsmith updated

How a new version reaches you depends on the agent.

| Agent | Automatic? | Update by hand |
|---|---|---|
| Claude Code | Yes, once auto-update is on for the `methodsmith` marketplace. `bash install.sh claude` and `.\install.ps1 claude` turn it on (add `--no-auto-update` or `-NoAutoUpdate` to skip). After a one-line `claude plugin install ... --marketplace sajor2000/methodsmith`, turn it on yourself: run `/plugin`, open **Marketplaces**, select `methodsmith`, and choose **Enable auto-update**. | `claude plugin update methodsmith@methodsmith`, then `/reload-plugins` |
| GitHub CLI skills-only install | No. | Re-run your `gh skill install` command after a new release. |
| Codex | No. Codex has no documented automatic plugin update. | `codex plugin marketplace upgrade methodsmith`, then restart Codex. Refresh the generated agents with `bunx github:sajor2000/methodsmith install methodsmith --to codex` |
| OpenCode, Pi, Gemini CLI, Kiro | No. These use generated files. | `bunx github:sajor2000/methodsmith install methodsmith --to opencode` (or `--to pi`, `--to gemini`, `--to kiro`; add `--output <workspace>` for a project install) |
| Qwen Code | No. | `qwen extensions update methodsmith` |
| Local checkout or offline package | No. | `git pull` in the checkout (or unpack the new package), then re-run the installer |

With auto-update on, Claude Code checks in the background a few minutes after
your first message and shows `Plugin updated ... Run /reload-plugins to apply`.
Your current session keeps the version it started with. A marketplace added
from a local folder never auto-updates, because Claude Code loads that folder
in place; that is why the installers now add the GitHub marketplace unless you
pass `--source`. Setting `DISABLE_AUTOUPDATER=1`, `DISABLE_UPDATES=1`, or
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` turns the background update off
unless you also set `FORCE_AUTOUPDATE_PLUGINS=1`.

Not sure which command applies? Run the `method-update` skill (`/method-update` in
Claude Code). It prints the exact command for the agent you are in.

## Your own skills are safe

Updates never delete or overwrite skills, agents, prompts, or commands you
created.

<details>
<summary><strong>How ownership tracking protects your files</strong> — generated installs, pre-tracking files, edited files, where to keep your own skills</summary>

- Generated installs (Codex agents, OpenCode, Pi, Gemini CLI, Kiro) record
  every file they write, with a content hash, in
  `<agent folder>/methodsmith/owned-files.json`. An update deletes only
  unchanged files on that list.
- Files from an install made before ownership tracking are not on the list.
  The installer treats one as the plugin's only when its install record or its
  exact description shows methodsmith wrote it, and then moves it to
  `<agent folder>/methodsmith/backups/` or `legacy-backup/` instead of
  deleting it. This includes Codex's retired `~/.codex/methodsmith/skills`
  folder.
- If you edited a file the plugin installed, the update copies your version to
  `<agent folder>/methodsmith/backups/<time>/` before replacing it.
- A file the plugin did not write is left alone, even when it has the name of
  an old methodsmith skill such as `setup` or `skill-creator`. The installer
  prints one line saying it kept the file.
- Claude Code keeps the plugin in its own plugin cache under `~/.claude/plugins/`,
  replaces that copy on every update, and deletes old versions later, so never
  keep your own files there.

Keep your own skills here:

| Agent | For you, in every project | For one project |
|---|---|---|
| Claude Code | `~/.claude/skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` |
| Codex | `~/.agents/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` |
| OpenCode | `~/.config/opencode/skills/<name>/SKILL.md` | `.opencode/skills/<name>/SKILL.md` |
| Pi | `~/.pi/agent/skills/<name>/SKILL.md` | `.pi/skills/<name>/SKILL.md` |
| Gemini CLI | `~/.gemini/skills/<name>/SKILL.md` | `.gemini/skills/<name>/SKILL.md` |
| Kiro | Not covered here | `.kiro/skills/<name>/SKILL.md` |
| Qwen Code | `~/.qwen/skills/<name>/SKILL.md` | `.qwen/skills/<name>/SKILL.md` |

Do not start your own skill names with `method-`. That prefix belongs to the
plugin; if a name is already taken by your own skill, the installer skips the
plugin's version and tells you.

</details>

### Update a source checkout

```bash
cd ~/methodsmith && git pull && bun install
```

Then restart your coding agent.

To build corporate/offline ZIPs from a source checkout:

```bash
bun run package:corporate
```

---

## Troubleshooting

**"Unknown command" on `/method-setup`:** Native Claude plugin commands are namespaced. Use `/methodsmith:method-setup`, or install the optional local aliases into `.claude/commands`.

**`bun install` fails:** Run `bun --version`. If missing: `curl -fsSL https://bun.sh/install | bash`

**Corporate laptop blocks Bun, GitHub CLI, Git, or Quarto:** Use the offline Claude folder/ZIP or Codex local marketplace package. Bun and Git are for source builds; GitHub CLI is only for GitHub helpers; Quarto is only required for Quarto render/manuscript workflows.

**Plugin seems outdated:** `cd ~/methodsmith && git pull && bun install`, then restart.

**Codex installed into the wrong profile:** Set `CODEX_HOME` on both the `codex` command and the Bun installer. The installer defaults to `$CODEX_HOME` when set, otherwise `~/.codex`.

**Codex hooks stopped loading after a broken edit:** Re-run the standalone install with `--include-skills`. The installer backs up malformed `.codex/hooks.json` before writing managed hook entries.

**CLIF activating on a non-CLIF project:** `/method-clif --off` disables it for the session.

---

## Full inventory

| | Count |
|---|---|
| Skills | 67 |
| Agents | 55 |
| Reporting checklists | 49 |

[See every skill and agent](plugins/methodsmith/README.md)

---

<!-- brand:faq:start -->
## FAQ

**Is this an AI statistician?** No. It is a set of workflows and reviewers that
make an analysis explicit and checkable. The researcher chooses the methods,
reads the review, and is accountable for every result, as ICMJE and the ASA
expect.

**Does my data leave my machine?** Methodsmith has no server of its own; it runs
inside your coding agent. Literature skills query public services such as
PubMed when you ask them to, and your agent's model provider sees what the agent
reads. That is why the PHI guard keeps data values out of the model in
schema-only projects and keeps identifiers out of MCP tools. See [Sensitive-data boundary](#sensitive-data-boundary)
and [What external tools receive](#what-external-tools-receive).

**R or Python?** Either. Setup detects the language, notebook format and data
layer from the project and only asks about what it cannot infer.

**Which agents does it run on?** Claude Code and Codex natively, Pi through a
generated install, and others through the converter CLI. See
[Also works with Codex, Pi, Gemini, and more](#also-works-with-codex-pi-gemini-and-more).

**How is it related to Compound Engineering?** It is an MIT-licensed fork. The
loop, the review architecture and much of the engineering workflow come from
Every's plugin; Methodsmith adds the research-methods skills, reviewers,
checklists and guards.
<!-- brand:faq:end -->

## Built on

Methodsmith started as a fork of [Every](https://every.to)'s
[Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin)
plugin by [Kieran Klaassen](https://github.com/kieranklaassen). The
plan -> work -> review -> compound loop, the review personas, and the
cross-platform converter come from that work. Also influenced by [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) and [Superpowers](https://github.com/obra/superpowers). Brand assets and their sources are in [docs/brand](docs/brand/brand.md).

## License

[MIT](LICENSE) — Copyright (c) 2026 Juan Carlos Rojas. Original compound-engineering Copyright (c) 2025 Every.
