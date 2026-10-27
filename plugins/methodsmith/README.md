# Methodsmith

**Rigorous methods, from question to paper. Every study compounds.**

Methodsmith is a research plugin for coding agents. Plan the study, build
reproducible R and Python analyses, review the methods, and trace reported
numbers to their analysis code. Built for clinical statistics, machine learning,
and meta-analysis. Your team keeps scientific judgment and responsibility for
the results.

**68 skills · 55 specialist agents · 49 reporting standards.** Works with Claude
Code, Codex, Pi, Gemini CLI, OpenCode, Kiro, and Qwen Code.

> **Research use only; not a medical device for clinical care.** Methodsmith
> supports research workflows and is not intended to diagnose, treat, cure,
> mitigate, or prevent disease or to guide patient-specific care. It is not
> validated for clinical use and does not replace qualified clinical,
> statistical, ethics, or institutional review.

[Get started](#getting-started) · [Read the full setup guide](../../docs/setup.md) ·
[Upgrade from ce-datascience](#moving-from-ce-datascience) <!-- rebrand:keep -->

From a terminal with Claude Code 2.1.292 or later:

```bash
claude plugin install methodsmith --marketplace sajor2000/methodsmith
```

Open your study folder, start Claude Code, and run
`/methodsmith:method-setup`, then `/methodsmith:method-workflow`.
For Codex, other agents, Windows, or approved offline installs, use the
[setup guide](../../docs/setup.md).

## How It Works

Methodsmith makes a human-led loop explicit: **plan -> work -> review -> compound**.
Your team frames the question, approves the plan, judges findings, and chooses
what to carry forward. The agent drafts, checks, and documents the work; validated
lessons make the next study stronger.

![Methodsmith package workflow: install, set up a project, run skills, and create research artifacts](../../docs/methodsmith-package-workflow.png)

![Steps for using Methodsmith setup, workflow, and task-specific slash commands](../../docs/methodsmith-skill-commands.png)

[See who decides what](https://sajor2000.github.io/methodsmith/#decide)

<!-- rebrand:keep-start migration-guide -->
## Moving from ce-datascience

Methodsmith is the same plugin as ce-datascience, renamed in 5.0. Every
command and agent now starts with `method-` instead of `ce-`. A few names are
also shorter, for example `/ce-statistical-analysis-plan` is now `/method-sap`.

**What stays the same:** your own skills, your project's `.ce-datascience/`
folder (including the PHI-boundary settings in `config.local.yaml`), and the
plan -> work -> review -> compound loop.

**What the switch does:** the first Methodsmith install moves the old plugin's
files to a `backups/` folder next to the new install. Nothing is deleted, and
files you created are not touched.

To see what is installed on your machine, install Methodsmith and run
`/method-update`. Its read-only checker prints exactly the commands below for
each harness it finds.

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

## Getting Started

For complete copy-paste setup across Claude Code, Codex, OpenCode, Gemini CLI,
Kiro, Pi, and Qwen Code, see [`../../docs/setup.md`](../../docs/setup.md).

From a source checkout, run `bash install.sh doctor` (or
`.\install.ps1 doctor` in PowerShell) for a read-only check of the standard and
locked-down routes. It detects the local agent CLIs and optional Bun bridge,
then prints the appropriate next command. Corporate users can use approved
offline artifacts without Git, Bun, GitHub CLI, or Quarto.

Fastest normal Claude Code setup, with no checkout (Claude Code 2.1.275 or
later):

```text
/plugin install methodsmith --marketplace sajor2000/methodsmith
```

Or from a terminal with Claude Code 2.1.292 or later:

```bash
claude plugin install methodsmith --marketplace sajor2000/methodsmith
```

From a source checkout, with optional bare `/method-*` aliases, on macOS, Linux,
WSL, or Git Bash:

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

Then open the target project and run `/methodsmith:method-setup`. The alias flag
is optional and gives you the same bare-command feel as the original Compound
Engineering plugin; the namespaced form is the reliable default.

Fastest normal Codex setup:

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

Inside Codex, open `/plugins`, install **Methodsmith**, restart, then ask
Codex to use Methodsmith for setup.

Pi uses generated files rather than a native marketplace:

```bash
pi install npm:pi-subagents
pi install npm:pi-ask-user
bun run src/index.ts install ./plugins/methodsmith --to pi --pi-home "$HOME/.pi/agent"
```

Restart Pi, open the target project, and invoke `method-setup` using Pi's skill
interface. `pi-subagents` is required for Methodsmith delegation; `pi-ask-user` enables
the compact confirmation interaction.

### Keep Methodsmith updated

How a new version reaches you depends on the agent.

| Agent | Automatic? | Update by hand |
|---|---|---|
| Claude Code | Yes, once auto-update is on for the `methodsmith` marketplace. `bash install.sh claude` and `.\install.ps1 claude` turn it on (add `--no-auto-update` or `-NoAutoUpdate` to skip). After a one-line `claude plugin install ... --marketplace sajor2000/methodsmith`, turn it on yourself: run `/plugin`, open **Marketplaces**, select `methodsmith`, and choose **Enable auto-update**. | `claude plugin update methodsmith@methodsmith`, then `/reload-plugins` |
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

### Your own skills are safe

Updates never delete or overwrite skills, agents, prompts, or commands you
created.

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

### Use the plugin after installation

1. Restart Claude Code or Codex after installing the plugin.
2. Open the project or study directory where the work should happen.
3. Run setup once for that project.
4. Run workflow to see the lifecycle and next recommended skill.

Claude Code's native plugin commands are namespaced:

```text
/methodsmith:method-setup
/methodsmith:method-workflow
```

If the installer was run with `--aliases` or `-Aliases`, `/method-setup` and
`/method-workflow` are equivalent convenience aliases. In Codex, start a new task
and say:

```text
Use the Methodsmith method-setup skill for this project.
Then use the Methodsmith method-workflow skill and recommend the next step.
```

Setup records project-local stack and data-layer choices; it is not a global
one-time configuration for every study. Once workflow recommends a step, ask
the agent to use the named skill, such as `method-question`, `method-data-qa`,
`method-plan`, or `method-review`, and include the scientific or engineering goal.

Locked-down laptops can use approved local artifacts without Bun, Git, GitHub
CLI, or Quarto:

```bash
claude --plugin-dir /approved/path/methodsmith
claude --plugin-dir /approved/path/methodsmith.zip
```

In native Claude plugin installs, commands are namespaced:

```text
/methodsmith:method-setup --locked-down
/methodsmith:method-workflow
```

Bare commands such as `/method-setup` require optional local alias files in
`.claude/commands`; they are not guaranteed by plugin loading itself.

After installing, run `/methodsmith:method-setup` in any project. It configures your stack
profile (language, IDE, libraries, reporting framework) and bootstraps project
config. Then run `/methodsmith:method-workflow` to see the ordered next steps
for the project. If optional aliases are installed, `/method-setup` and
`/method-workflow` work too.

Setup and workflow inspect available project evidence before asking. Each public
skill starts with a `Skill Value` block naming the problem it solves, when to use
it, expected output, question boundary, and non-goal so demos and first projects
route to the right command quickly.

The normal setup path is a one-screen detected profile: continue with evidence,
adjust one field, or choose the full survey. It infers language, environment,
reporting, storage, and data domain from project files and leaves optional
preferences unset instead of forcing a long questionnaire.

### Safety gates in current workflows

Methodsmith keeps method decisions explicit rather than filling gaps with
defaults. `method-data-qa` checks row-count reconciliation, key uniqueness, join
cardinality, type stability, index alignment, and declared missing-data
handling before it emits GO, WARN, or NO-GO. Confirmed corruption or undeclared
synthetic/fallback data is a NO-GO.

For observational or causal work, `method-plan` and
`method-sap` require an estimand, intended grain, keys, time
zero, assumptions, and success criteria before finalization. `method-work` fails
loudly at missing, corrupt, or incompatible inputs. `method-review` separates
demonstrated integrity defects (blocking) from methodological questions that
need analyst resolution, including causal timing and dynamic survival-model
evaluation.

For dynamic survival decisions, the calibration reviewer requires a stated
decision time and horizon, a case/control definition, censoring-aware
time-dependent AUC with confidence intervals, and calibration at the matching
horizon. A generic binary AUC or Harrell C-index does not answer that question.

Statistical methods were audited against primary sources: ICH E9(R1)
estimands in the SAP path, corrected power, non-inferiority, two-proportion,
and `pmsampsize` methods, REML with Hartung-Knapp pooling and a k-1 df
prediction interval, non-binding futility type I error, design-aware Table 1
(SMD column, no RCT baseline p-values), verification-bias reweighting for
phenotype validation, and TRIPOD+AI routing for every prediction model. The
skill and agent tables below describe the current behavior; the root README's
"Statistical correctness" section summarizes it.

Connection skills can hand setup a verified database default by emitting
`__CE_CONNECTION__ name=<name> type=<postgres|sqlite|duckdb|other> database=<db> auth=<auth> status=verified`.
For database-backed projects, `data_root` stays optional and is used only for
local extracts or cache files.

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

Printed-statistic checks preserve rounding and declared t/z sidedness; unsupported
P-value constructions stay unchecked. Power anchors require source-reported SEs
or declared Wald interval methods and confidence levels, with degrees of freedom
required for t intervals only.
Genome audits distinguish compatible header evidence from unknown or uninspected
files. Prediction validation separates forward time from period transport, and
omics identifiability is checked independently of PCA displays. Cohort eligibility
uses baseline observability; later loss is handled in follow-up rather than by
requiring future enrollment.

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

### Recommended research add-ons

The plugin's bundled `/method-pubmed` workflow remains the portable baseline.
Optionally connect the PubMed MCP server,
[cyanheads/pubmed-mcp-server](https://github.com/cyanheads/pubmed-mcp-server)
for agent-native PubMed/Europe PMC, MeSH, citation, and related-article tools.
Add the
[Paperclip CLI and its official Paperclip skill, or its MCP server](https://paperclip.gxl.ai/docs)
when a study needs deeper full-text synthesis, claim verification, figures,
trials, regulatory documents, preprints, or biological databases. The skill is
fetched and maintained by Paperclip; Methodsmith does not bundle or fork it.
Methodsmith workflows currently auto-detect the Paperclip CLI only; external MCP or
provider-skill results are direct agent capabilities, not automatic Methodsmith artifact
handoffs.

Neither add-on is required or installed automatically. Review institutional
privacy and network policy before connecting hosted services. The canonical
configuration examples and selection guidance are in
[`../../docs/setup.md`](../../docs/setup.md#8-optional-research-add-ons).

## Sensitive-data boundary

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

### What external tools receive

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

## Components

| Component | Count |
|-----------|-------|
| Agents | 55 |
| Skills | 68 |

Publication workflows use shared artifact registries and publication profiles so tables, figures, manuscript packages, registry exports, review packs, and signoff ledgers stay consistent. The initial publication profiles are JAMA and generic biomedical.

## Platform Support

The plugin is authored once and distributed across Claude Code, Codex, Pi, Gemini CLI, OpenCode, Kiro, and Qwen Code.

- Claude Code loads the plugin directly from `plugins/methodsmith`.
- Claude Code plugin commands and skills are namespaced as `/methodsmith:method-*`; install optional local aliases for bare `/method-*` demo UX.
- Codex should use native plugin install for skills plus the Bun `--to codex` agent bridge for generated agents. Set `CODEX_HOME` and pass the same value to `--codex-home` when installing into a non-default Codex profile.
- Codex locked-down installs can use `methodsmith-codex-local.zip` plus `install-codex-offline.sh` to copy local marketplace metadata, the native plugin under `.codex/plugins/methodsmith`, and bridge agents without Bun.
- Full standalone Codex installs are supported with `--include-skills`; this mode writes generated skills and agents, plus managed `.codex/hooks.json` entries for plugins that declare hooks (Methodsmith declares only the Claude Code data-boundary guard, which exits immediately under Codex), without deleting manual or other-plugin hooks.
- Pi, Gemini CLI, OpenCode, and Kiro are generated by the shared converter. Use `--output /path/to/workspace` for workspace-based targets, and avoid naming an OpenCode workspace output directory literally `opencode` unless a flat global-style layout is intended.
- Qwen Code uses its native extension installer, which can consume Claude marketplace plugins directly; it is not a generated `--to qwen` converter target.

Common generated install commands, run from the repo root:

```bash
bun run src/index.ts install ./plugins/methodsmith --to codex --codex-home "$CODEX_HOME"
bun run src/index.ts install ./plugins/methodsmith --to codex --codex-home "$CODEX_HOME" --include-skills
bun run src/index.ts install ./plugins/methodsmith --to opencode --output /path/to/workspace
bun run src/index.ts install ./plugins/methodsmith --to gemini --output /path/to/gemini-workspace
bun run src/index.ts install ./plugins/methodsmith --to kiro --output /path/to/kiro-workspace
bun run src/index.ts install ./plugins/methodsmith --to pi --pi-home "$HOME/.pi/agent"
```

## Upstream Compound Engineering Feature Ports

The current plugin selectively ports useful features from the original compound-engineering plugin and adapts them to health data science:

| Upstream area | methodsmith behavior |
|---------------|-------------------------|
| Planning and brainstorming | `/method-plan` keeps SAP mode and implementation-plan mode while starting summaries with an implementation-independent objective, preserving format on resume, and strengthening output handling, research routing, and synthesis. `/method-brainstorm` keeps PICO/PECO and study-design framing while adding grouped requirements, visual communication behavior, and output-mode handling. |
| Work and optimization | `/method-work` verifies tracked snapshots before parallel worktree execution and keeps tasks with uncommitted dependencies inline. `/method-optimize` isolates parallel Codex experiments by directory and requires a recorded baseline and measurable outcome. |
| Debugging | `/method-debug` supports correctness and performance investigations, redacts secrets from evidence, and repeats the original measurement after a fix. |
| PR feedback resolution | `method-resolve-feedback` carries GraphQL pagination and split-reference handling, then frames replies around statistical methodology, SAP drift, reproducibility, reporting checklists, and clinical/health data review threads. |
| Sessions | `/method-sessions` searches Claude Code, Codex, and Cursor histories with repo-root pre-resolution, session discovery, skeleton extraction, metadata extraction, and error extraction helpers. |
| Git and review workflow | `method-review` applies path-scoped `CODING_STANDARDS.md` alongside binding repo instructions. `method-commit` and `method-pr` use an isolated temporary Git index for named-file commits, preserving unrelated staged and working-tree changes while honoring publishing gates. |
| Setup health | `/method-setup` detects obsolete Codex tool-map blocks and offers approved cleanup guidance without silently rewriting user configuration. |
| Public support | `/method-release-notes` and `/method-report-bug` are included so users can answer version-specific questions and file structured bug reports from the public plugin surface. |
| Target compatibility | Agent sources use current `method-*.md` filenames; legacy `*.agent.md` parsing remains supported. Codex installs respect `CODEX_HOME`, support native-plugin agent bridge and standalone modes, and preserve manual/other-plugin hooks during managed hook writes. |

The curated upstream refresh includes portable continuity as `/method-handoff`. PR monitoring (`ce-babysit-pr`) and maintainer corpus retuning (`ce-retune`) were removed as outside the data-science scope. Deferred upstream-only skills remain intentionally out of scope: Rails, frontend, browser/Xcode, Slack command workflows, product-pulse, dogfood, LFG, agent-native architecture/audit, demo-reel, Proof, simplify-code, strategy, promotion, and polish workflows. The upstream multi-provider cross-model runner and `/ce-pov` remain deferred until Methodsmith has a trusted serving-route attestation contract.

### Coexisting with compound-engineering

Methodsmith and the upstream compound-engineering plugin can be enabled
together. Since 5.0 every Methodsmith command starts with `method-`, so no
command name clashes with an upstream `method-*` command. Both plugins still cover
some of the same requests, such as "plan this". Methodsmith descriptions name
their data-science scope (SAPs, analysis code, PHI) to help the model choose.
For a deterministic choice, invoke the command by name (`/method-plan` or
`/methodsmith:method-plan`), or disable the plugin you do not need for the
project with `/plugin`. Claude Code's `skillOverrides` setting does not apply to
plugin skills.

### Commands removed before 5.0

These commands no longer exist. Installs made with the CLI remove the stale copies on upgrade; marketplace installs drop them when the plugin updates.

| Removed | Use instead |
|---|---|
| `/ce-r-review`, `/ce-r-tidyverse`, `/ce-r-targets`, `/ce-r-package-development`, `/ce-r-package-testing`, `/ce-r-cran`, `/ce-r-performance`, `/ce-r-event-studies` | `/method-r` (routes to the same guidance under `references/`) |
| `/ce-fabric-coding`, `/ce-fabric-kql`, `/ce-fabric-ml`, `/ce-fabric-pipelines`, `/ce-fabric-semantic-models` | `/method-fabric` |
| `/ce-retune` | The upstream compound-engineering plugin's retune workflow (maintainer tooling) |
| `/ce-babysit-pr` | Your agent's own PR watching, or the upstream compound-engineering plugin |

Figure manifests that set `style_profile: jama` still validate; the default profile is now `clinical-standard`.

## Skills

### Core Workflow

The compound engineering loop adapted for data science: hypothesize, design study, execute analysis, review methods, document learnings.

| Skill | Description |
|-------|-------------|
| `/method-ideate` | Big-picture ideation: generate and evaluate research ideas, then route into brainstorming |
| `/method-brainstorm` | Interactive study design exploration with PICO/PECO probes, grouped requirements, visual communication, and Markdown/HTML output modes before planning |
| `/method-grill` | Stress-test a research project one question at a time (goal, hypothesis, data, proposed analysis, target journal, audience) with a recommended answer for each, saving decisions and ranked risks to `docs/brainstorms/` |
| `/method-question` | Harden a fuzzy study idea into structured PICO + FINER + PubMed query at `analysis/research-question.yaml` |
| `/method-plan` | Create the canonical versioned SAP or technical implementation plan with an implementation-independent objective, ICH E9(R1) estimands (SAP-1.4) and RCT minimum content in SAP mode, Markdown/HTML output modes, and format-preserving resume |
| `/method-sap` | Deepen complex clinical or observational SAPs with a claim-to-dataset schema, ICH E9(R1) estimands, diagnostics, and decision evidence without creating a competing plan or workbook |
| `/method-model-choice` | Choose, evidence-ground, and scaffold the primary statistical model—including mixed/random effects, causal, prediction, Bayesian, survival, and meta-analysis branches—in the detected R or Python stack. Prediction strategies include the full training/validation protocol and a versioned `.decisions.json` sidecar beside the memo; the status-gated scaffold and terminal handoff are unchanged. |
| `/method-review` | Statistical and methodological review with confidence-calibrated integrity/causal findings, reporting checklist compliance, and blinding-state awareness (auto-detected from stack profile) |
| `/method-adversarial-review` | Independent adversarial code or plan review with quick/auto/deep, a read-only Claude Code/Codex peer pass, bounded evidence-based rebuttal, and explicit local-only or unresolved coverage when a peer cannot validate |
| `/method-work` | Execute analysis tasks with SAP tracking and verified parallel snapshots while failing loudly at missing, corrupt, or uncommitted dependencies |
| `/method-notebook-standards` | Set the master-notebook or multi-file decision and the documented, small-cell contract for Marimo, Jupyter, R Markdown, and Quarto work |
| `/method-notebook-edit` | Safely insert reviewed cells into existing Jupyter notebooks using unique metadata tags, backups, and structural validation |
| `/method-debug` | Find correctness or performance root causes with secret-safe evidence, a recorded baseline, and repeated post-fix measurement |
| `/method-handoff` | Create or resume a portable continuity record with verified state, constraints, and next safe action |
| `/method-compound` | Document validated analytical approaches, statistical decisions, and domain methods (with deterministic dedup fingerprints across studies) |
| `/method-compound-refresh` | Refresh stale learnings and decide whether to keep, update, replace, or archive |
| `/method-sap-workbook` | Generate the biostatistics-style tabular companion to the prose SAP -- Overview, Outputs, Master Variables, and optional long/wide sample sheets that statisticians hand to programmers |
| `/method-data-qa` | Data QA gate for row counts, joins, keys, types, missingness, and stack-specific integrity risks; emits GO/WARN/NO-GO, a missingness catalog, and PI sign-off block. Recommends principled missing-data methods (no mean imputation or LOCF) and does not claim MNAR is detectable from the data. Runs between data extraction and modeling |
| `/method-verify` | Mid-workflow analysis verification gate -- checks sample size, data leakage, effect direction, missing data (judged by assumed mechanism, not a percentage cutoff), PHI, figure quality, reproducibility, and internal consistency of reported statistics (P recomputation from t/F/chi2/z, GRIM on means and percentages) between analysis steps |
| `/method-sprint` | Open or close an auditable sprint with declared scope (subset of SAP sections), planned outputs, and a named human reviewer. Closing dispatches `method-sprint-audit-reviewer` |

The planning scopes are deliberate: start with `/method-plan`; add
`/method-sap` only for complex claim-level clinical methods;
use `/method-model-choice` after data QA for nontrivial model decisions; render
the workbook with `/method-sap-workbook`; and use the manuscript skills for final
prose and citations.

### Biomedical Lifecycle

For the academic paper lifecycle: literature → checklist → cohort → power → SAP → manuscript artifacts.

The registry covers 49 standards across study types and AI extensions.
[Guideline sources](../../docs/guideline-sources.md) lists each
checklist's primary citation, PMID, DOI, verification status, and superseded
versions. It distinguishes reporting guidelines from appraisal tools, planning
templates, data-quality tools, and provisional candidates.

| Skill | Description |
|-------|-------------|
| `/method-pubmed` | PubMed/MEDLINE search via NCBI E-utilities with MeSH expansion and structured result tables; by default keeps not-yet-indexed and non-English records (`--english-only` opts in to a language limit) |
| `/method-evidence-map` | Build a source-backed evidence map from PubMed, with optional Paperclip full-text, grep, map, SQL, and figure deepening when available |
| `/method-extract` | Extract structured statistical methods from a PubMed result set into a comparison table for SAP justification, without treating the most common method or raw published effects as SAP and power defaults |
| `/method-checklist` | Pick the right reporting checklist at PLAN time, before SAP drafting: TRIPOD+AI for every prediction model, standalone TARGET for target trial emulation, SPIRIT 2025 and PRISMA-P for protocols, and DECIDE-AI or TRIPOD-LLM for early clinical AI and LLM studies |
| `/method-power` | Compute sample size with sensitivity sweep across plausible effect sizes (two-sample, two-proportion, non-inferiority at one-sided 0.025, survival, cluster, and Riley-criteria `pmsampsize` for prediction models); produces an R or Python script and a SAP-ready paragraph |
| `/method-trial-design` | Build an auditable feasible/Pareto frontier for two-arm group-sequential designs from version-pinned `rpact` or `gsDesign` results (type I error under non-binding futility computed ignoring the futility bound), with a provenance receipt and SAP handoff |
| `/method-meta-analysis` | Pool effect-size estimates from prior literature (random-effects REML with a Hartung-Knapp CI and a k-1 df prediction interval) into a defensible assumption for `/method-power` |
| `/method-prereg` | Generate a pre-registration form for OSF, ClinicalTrials.gov, PROSPERO, or AsPredicted from the locked SAP; its validator blocks a draft SAP, unblinded data, and a PROSPERO registration at or past data extraction |
| `/method-table1` | Generate a publication-ready Table 1 shell, spec, and validation report from the SAP variables catalog; `--design rct\|observational\|descriptive` sets the comparison columns (SMD column for observational comparisons, no baseline p-values for randomized trials) |
| `/method-figure` | Create publication figures in R (ggplot2) or Python (matplotlib, Jupyter/Marimo) in a journal-neutral clinical figure style (calibration-in-the-large via an offset model, cumulative incidence under competing risks), and validate figure manifests for source data, code, outputs, captions, alt text, and checklist traceability |
| `/method-numbers` | Lock every manuscript, Table 1, caption, and abstract number to a registry of aggregates written by R or Python analysis code (`{{num:<id>}}` placeholders), and run a fail-closed gate that traces each number to its SAP output, script commit, and source hash |
| `/method-journal-select` | Match a finished manuscript or abstract to candidate journals with sourced scope fit, PubMed scope-fit evidence, a legitimacy screen on indexing claims, and a ranked target with backups |
| `/method-submission-package` | Build a manuscript package manifest and Quarto-ready shell from SAP, Table 1, figure, checklist, and registry artifacts |
| `/method-citations` | Resolve PubMed/Paperclip evidence, gate the bibliography for fabricated references, and deliver a Word manuscript with editable Zotero citation fields |
| `/method-write` | Draft, revise, or audit evidence-bound scientific manuscripts without imposing one journal's style |
| `/method-voice` | Apply a precise, clinically detached house style to narrative clinical AI research prose |
| `/method-section-check` | Keep Methods and Results factual while preserving rationale required by reporting guidelines, protocols, regulations, or reproducibility standards |
| `/method-anti-slop` | Detect and remove generic AI-writing tells from scientific and clinical manuscript prose |
| `/method-presubmit` | Run the combined voice, section-discipline, and anti-slop gate before manuscript handoff |
| `/method-signoff` | Create PI-facing review packs and validate named signoff ledgers for manuscript, registry, sprint, and data-lock approvals |
| `/method-model-card` | Generate a Mitchell-style model card for a clinical prediction model, with overall + subgroup performance (CIs, event counts, validation type), equalized odds kept distinct from equal opportunity, and ethical considerations. Renders the essential measures (discrimination, calibration, net benefit, risk distributions) and reports imbalance handling as a gap when unrecorded. |

### EHR & Administrative Data

| Skill | Description |
|-------|-------------|
| `/method-clif` | Activate CLIF-safe profile for ICU consortium repos -- `/method-clif --version 2.1.0` selects CLIF/mCIDE 2.1 and `--version 3.0.0` selects the matching 3.0 family; honors the saved sensitive-data boundary (asks once only if none is saved), keeps patient-level intermediates in the approved restricted data root, and enforces Parquet-only, version-correct mCIDE vocab, and POC sign-off; IPTW examples use stabilized weights with balance checks |
| `/method-clif-template` | Initialize or audit a CLIF project against the official Project Template, with explicit version selection, site-local configuration, and aggregate-only final-output safeguards |
| `/method-clif-meta-analysis` | Plan, code and audit CLIF site-to-lead or literature meta-analysis, with validated aggregate contracts and explicit R/Python methods |
| `/method-cohort` | Define a study cohort using OMOP concept sets / ICD / CPT / LOINC code lists with vocabulary version pinning; outputs SQL, JSON spec, and CONSORT-flow waterfall |
| `/method-phenotype` | Validate an EHR-derived phenotype algorithm against a chart-review gold standard; PPV / NPV / sensitivity / specificity overall and by subgroup, reweighting sensitivity and specificity for verification bias under algorithm-stratified sampling |

### Bioinformatics

| Skill | Description |
|-------|-------------|
| `/method-omics-qc` | Sequencing / omics data QA gate: FastQC / MultiQC / sample swap detection / batch-effect and batch-condition confound screen for FASTQ, BAM, count matrices, methylation arrays |
| `/method-genome-build` | Pin the genome build (GRCh37 / GRCh38 / T2T) and annotation version (GENCODE / Ensembl); audit every output for build consistency |

### ML / AI

| Skill | Description |
|-------|-------------|
| `/method-ml-track` | Wire up ML experiment tracking (mlflow / wandb / dvc / offline-YAML); generate boilerplate, configure backend, define required-log schema, and keep the test set out of model selection. Logs log-loss selection, calibration, refit instability, and net benefit on the locked test set. |
| `/method-optimize` | Run metric-driven optimization with isolated experiment directories, recorded baselines, cross-validation awareness, leakage guards, and a flag on selection-biased CV scores |

### Microsoft Fabric & Marimo

| Skill | Description |
|-------|-------------|
| `/method-fabric` | Microsoft Fabric workflows in one skill: Lakehouse/OneLake and Warehouse code, Data Factory pipelines, Direct Lake semantic models, Fabric ML, and Eventhouse/KQL, each in its own reference file, with Methodsmith data and method gates in place |
| `/method-marimo` | Create and review text-native reactive Marimo notebooks with explicit dependencies, validation, and fail-loud data boundaries |

The Fabric workflows are an original Methodsmith adaptation of the routing areas
documented in [sajor2000/fabric-skills](https://github.com/sajor2000/fabric-skills);
it keeps those platform surfaces inside Methodsmith's research-design, data-QA, and
evidence gates rather than copying upstream prompts.

### R Statistics

| Skill | Description |
|-------|-------------|
| `/method-r` | R workflows in one skill: analysis design, read-only R review, tidyverse, event studies, package development, testthat, CRAN readiness, performance, and `targets` pipelines, each in its own reference file, preserving Methodsmith study-design, QA, and review gates |

The R workflows are evidence-first: they begin with the project's pinned environment, use Ref MCP for exact package documentation when available, and use Tavily MCP only to discover primary current sources. If a research integration is unavailable, the workflow surfaces the verification gap rather than guessing current APIs or CRAN policy.

The R family is an original Methodsmith adaptation of the categories curated
by [awesome-rstats-skills](https://github.com/christopherkenny/awesome-rstats-skills);
it does not copy third-party skill text and preserves Methodsmith's methodological
guardrails.

### Git Workflow

| Skill | Description |
|-------|-------------|
| `method-clean-branches` | Clean up local branches whose remote tracking branch is gone |
| `method-commit` | Create a value-communicating commit while isolating named files from unrelated staged and working-tree changes |
| `method-pr` | Commit through an isolated temporary index, push, and open or update a PR with an adaptive value-first description and optional evidence routing |
| `method-resolve-feedback` | Resolve PR review feedback in parallel -- evaluates validity, fixes issues, handles paginated/split GitHub threads, and replies to statistical methodology feedback |
| `method-worktree` | Manage Git worktrees for parallel development |

### Review & Quality

| Skill | Description |
|-------|-------------|
| `method-doc-review` | Review documents using parallel persona agents for role-specific feedback |
| `/method-sas-stata` | Inventory SAS/Stata analysis files and model procedures for review or bounded migration without claiming first-class scaffolding support; flags cross-software default differences |

### Literature & Evidence

| Skill | Description |
|-------|-------------|
| `/method-lit-search` | Route evidence requests to PubMed metadata, claim-focused lawful full-text mapping, methods extraction, effect-size synthesis, citation delivery, or authoritative web sources |

### IDE & Deployment

| Skill | Description |
|-------|-------------|
| External MCP add-ons | Connect optional PubMed MCP or Paperclip integrations directly in the target agent; Methodsmith does not bundle an MCP server |

### Workflow Utilities

| Skill | Description |
|-------|-------------|
| `/method-language-detect` | Detect Python, R, both, or unknown from repository evidence and emit the canonical language handoff used by setup and workflow routing |
| `/method-sessions` | Ask questions about session history across Claude Code, Codex, and Cursor, with repo-root session discovery and structured metadata/error extraction |
| `/method-release-notes` | Summarize recent methodsmith releases or answer version-specific release questions |
| `/method-report-bug` | Gather structured environment details and open a GitHub issue for methodsmith plugin bugs |
| `/method-setup` | Configure the stack profile, diagnose the environment including obsolete Codex tool maps, and bootstrap project config |
| `/method-update` | Check whether methodsmith is current and get the exact update command for your harness |
| `/method-workflow` | Lifecycle navigator -- shows ordered skill sequence for your project type, data layer, and language; detects progress and recommends next step |

## Scripts

Plain shell utilities for things that don't need a skill:

| Script | Purpose |
|--------|---------|
| `scripts/schema-peek.py <file>` | Print a data file's column headings, inferred types, row count, non-null count, and % missing, never a cell value; small counts are suppressed and headerless files show `col_1..col_n`. Used in schema-only mode. |
| `scripts/freeze-submission.sh <tag>` | Tag the current commit as a submission freeze. Refuses on a dirty tree; writes `submissions/<tag>/manifest.yaml` with commit sha, SAP version, locked-wave hash, and env-lock-file hashes. Does not push the tag and does not copy data. |

## Agents

Agents are specialized subagents invoked by skills.

### Statistical Review

| Agent | Description |
|-------|-------------|
| `method-methods-reviewer` | Statistical test selection and assumption verification, preferring model diagnostics over normality pre-tests |
| `method-multiplicity-reviewer` | Multiple comparisons, p-hacking, and selective reporting; co-primary endpoints that must all succeed need no alpha correction |
| `method-reproducibility-reviewer` | Seeds, package versions, paths, and environment specs |
| `method-reporting-checklist-reviewer` | Reporting guideline compliance across 49 guidelines — auto-routes by study type to the newest version of each guideline (old names such as TRIPOD 2015 and QUADAS-2 resolve to the successor that replaced them), covers protocol-stage guidelines (SPIRIT 2025, PRISMA-P), layers AI extensions, writes append-only compliance report (opt-in) |
| `method-sap-drift-detector` | Structural and semantic drift between SAP and analysis code, including estimand, missing-data, and inference-method drift; also flags blinding-state violations, missing amendment log entries, primary-endpoint changes after data lock, and code drift after amendments |
| `method-data-mapping-reviewer` | Codebook / SAP / extract column-mapping correctness — name drift, unit mismatches, level-set drift, derived-variable formulae, PHI in codebook |
| `method-phi-leak-reviewer` | HIPAA Safe Harbor identifier scan across data files, codebooks, notebooks, manuscripts, figure captions, and rendered output after the saved sensitive-data boundary (or a one-time confirmation) allows it |
| `method-targets-pipeline-reviewer` | targets pipeline correctness — hidden file deps, format hints, branch-count drift, disabled automatic seeding, superseded launchers |
| `method-quarto-render-reviewer` | Quarto / RMarkdown render-time correctness — committed output, cache traps, params drift, bibliography paths, accessibility |
| `method-r-code-reviewer` | R code quality — tidyverse, dplyr, ggplot2, data.table patterns |
| `method-r-pipeline-reviewer` | R analysis pipeline correctness — dplyr logic errors, ggplot2 accessibility, survival analysis, mixed model convergence |
| `method-python-ds-reviewer` | Python DS quality — pandas, vectorization, sklearn, data leakage |
| `method-kieran-python-reviewer` | General Python code review with strict conventions |
| `method-causal-inference-reviewer` | Causal-inference correctness — DAG specification (including M-bias), confounder set, time-zero alignment, positivity, estimand, sensitivity analyses for IPTW / matching / MSM / g-computation / DR / IV / RDD / DiD (staggered-adoption diagnostics) / target-trial emulation |

### ML / AI Review

| Agent | Description |
|-------|-------------|
| `method-data-leakage-reviewer` | Target leakage, train-test contamination, look-ahead bias in time-series, normalization fit on test set, subject-in-both-splits; a random split is not leakage by itself |
| `method-fairness-reviewer` | Subgroup performance auditing (sex / race / age / hospital / payer / language) for clinical prediction models, against TRIPOD+AI and FDA AI/ML guidance; requires a justified fairness criterion |
| `method-calibration-reviewer` | Calibration hierarchy (calibration-in-the-large, slope, flexible calibration curve), Brier, ICI, decision-curve analysis, and censoring-aware time-dependent AUC for dynamic survival decisions -- catches the AUC-only TRIPOD+AI gap |

### EHR & Administrative Data Review

| Agent | Description |
|-------|-------------|
| `method-omop-mapping-reviewer` | OMOP CDM correctness -- vocabulary version pinning, valid_start/valid_end honoring, descendant inclusion, standard vs source concepts, era vs occurrence, observation_period |
| `method-administrative-data-reviewer` | Claims-data idiosyncrasies -- baseline enrollment and look-back, disenrollment as censoring, claims truncation, payer mix, NDC-to-RxNorm, claims-vs-clinical disconnect |
| `method-concept-drift-reviewer` | Vocabulary drift across time -- ICD-9-to-10 transition, CPT yearly updates, SNOMED concept_id deprecation, vocab refresh drift |

### Bioinformatics Review

| Agent | Description |
|-------|-------------|
| `method-bioinfo-pipeline-reviewer` | Snakemake / Nextflow / CWL / Bioconductor pipelines -- env pinning, reference pinning, sample-sheet validation, output checksums, caching traps, version traceability |
| `method-omics-batch-reviewer` | Batch-condition confound detection in differential expression / methylation / proteomics; flags blind ComBat / RUV / SVA application, ComBat without the biological covariates in `mod`, and `removeBatchEffect` output used for inference |

### Workflow

| Agent | Description |
|-------|-------------|
| `method-sprint-audit-reviewer` | Audits a sprint's planned-vs-actual outputs, scope discipline, and reproducibility re-run; dispatched by `/method-sprint close` |

### Code Quality Review

| Agent | Description |
|-------|-------------|
| `method-correctness-reviewer` | Logic errors, edge cases, state bugs |
| `method-maintainability-reviewer` | Coupling, complexity, naming, dead code |
| `method-performance-oracle` | Performance analysis and optimization |
| `method-performance-reviewer` | Runtime performance with confidence calibration |
| `method-testing-reviewer` | Test coverage gaps, weak assertions |
| `method-project-standards-reviewer` | AGENTS.md compliance |
| `method-adversarial-reviewer` | Construct failure scenarios to break implementations |
| `method-code-simplicity-reviewer` | Final pass for simplicity and minimalism |
| `method-reliability-reviewer` | Production reliability and failure modes |
| `method-security-reviewer` | Security vulnerabilities with confidence calibration |
| `method-security-sentinel` | Security audits and vulnerability assessments |
| `method-previous-comments-reviewer` | Check whether prior review feedback has been addressed |

### Document Review

| Agent | Description |
|-------|-------------|
| `method-coherence-reviewer` | Review documents for internal consistency and terminology drift |
| `method-feasibility-reviewer` | Evaluate whether proposed approaches will survive contact with reality |
| `method-product-lens-reviewer` | Challenge problem framing, evaluate scope decisions |
| `method-scope-guardian-reviewer` | Challenge unjustified complexity and scope creep |
| `method-security-lens-reviewer` | Evaluate plans for security gaps (auth, data, APIs) |
| `method-adversarial-document-reviewer` | Challenge premises and stress-test decisions |
| `method-design-lens-reviewer` | Review plans for missing design decisions |

### Research

| Agent | Description |
|-------|-------------|
| `method-best-practices-researcher` | Gather external best practices and examples |
| `method-framework-docs-researcher` | Research framework documentation and best practices |
| `method-git-history-analyzer` | Analyze git history and code evolution |
| `method-issue-intelligence-analyst` | Analyze GitHub issues for recurring themes |
| `method-learnings-researcher` | Search institutional learnings for relevant past solutions |
| `method-repo-research-analyst` | Research repository structure and conventions |
| `method-session-historian` | Search prior sessions for related investigation context |
| `method-slack-researcher` | Search Slack for organizational context |
| `method-web-researcher` | Iterative web research for prior art and best practices |

### Workflow

| Agent | Description |
|-------|-------------|
| `method-architecture-strategist` | Analyze architectural decisions and compliance |
| `method-pattern-recognition-specialist` | Analyze code for patterns and anti-patterns |
| `method-pr-comment-resolver` | Address PR comments and implement fixes |
| `method-spec-flow-analyzer` | Analyze user flows and identify gaps in specifications |

## Built on

Methodsmith started as a fork of [Every](https://every.to)'s
[Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin)
plugin by [Kieran Klaassen](https://github.com/kieranklaassen). The
plan -> work -> review -> compound loop, the review personas, and the
cross-platform converter come from that work.

## License

MIT
