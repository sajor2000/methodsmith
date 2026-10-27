---
name: method-setup
description: "Configures the project-local methodsmith profile: infers the stack, confirms defaults, offers a survey. Use when the user asks to set up or reconfigure the plugin."
argument-hint: "[--locked-down|--no-install]"
disable-model-invocation: true
---

# Data Science Environment Setup

> **Script paths are anchored to this skill's directory.** Run each command below from the user's project (the agent's working directory) with `SKILL_DIR` set to the directory containing this `SKILL.md`; do not change into the skill directory, because the script inspects the current repository.

## Skill Value

- **Problem it solves:** A project needs a usable profile without a long, irrelevant R/Python questionnaire.
- **Use when:** Starting a project, changing its tools, or checking a corporate/locked-down environment.
- **Output:** Project-local stack profile, detected-profile summary, health notes, and next workflow.
- **Ask only if:** Evidence is ambiguous or a choice changes configuration, routing, or scientific scope.
- **Do not do:** Do not silently select a language, fabricate project evidence, or run package-manager installs in locked-down mode.
- **Interaction:** Inspect evidence first. Ask one decision-changing question at a time with the platform blocking-question UI; otherwise present numbered choices and wait.

Read user arguments from `$ARGUMENTS`. `--locked-down` and `--no-install` mean corporate/no-package-manager mode: do not offer or run Homebrew, pip, npm, GitHub CLI, or Quarto install commands.

## Phase 0: Read existing profile and project evidence

**Resolve config root:** !`git rev-parse --show-toplevel 2>/dev/null || true`

Use the resolved root, or resolve it at runtime. Read
`.methodsmith/config.local.yaml` with the native file-read tool. In a linked
worktree, fall back to the main checkout when the machine-local file is absent.
An existing profile is confirmed evidence; retain it unless it conflicts with an
explicit current request.

### Phase 0a: Sensitive-data boundary (before any data inspection)

**Sensitive-data boundary.** Resolve `phi_environment.mode` in `.methodsmith/config.local.yaml` (worktree, then main checkout; legacy `compliant: true` = `approved`, `compliant: false` = `schema-only`, `sensitive_data: false` = `no-sensitive-data`; any schema-only signal wins; unreadable = `schema-only`). `approved` or `no-sensitive-data`: proceed silently and never mention the boundary again. `schema-only`: headings, types, counts, and aggregates only; never open, print, or paste data values; run data-reading scripts as `method-safe-run -- <command>` (path in the guard's deny message); save results as aggregate tables (counts under 11 suppressed) in `output/` or a `phi_environment.aggregate_dirs` entry. Unset, interactive: ask once with the blocking question tool (else a numbered list) offering `Approved endpoint: full access`, `Not approved or unsure: schema-only`, and `No sensitive data: public or synthetic`; save the answer as `phi_environment.mode` there once `git check-ignore -q .methodsmith/config.local.yaml` passes (else first add `.methodsmith/*.local.yaml` to `.gitignore`) so the guard hook sees it. Unset, headless: schema-only.

When the mode is unset in an interactive run, or the user asks to change the boundary or says the model endpoint changed, read `references/sensitive-data-boundary.md` and follow it; it adds the schema-only explainer. In schema-only mode, never read data-file contents during the evidence scan below: use file names, and run the schema helper named in that reference for column headings. Completion evidence: `phi_environment.mode` is saved, or a headless run is proceeding schema-only.

Run the `method-language-detect` skill or apply its rules and retain its handoff:

```text
__CE_LANG__ primary=<python|r|both|unknown> secondary=<python|r|null> source=<auto|cached|manual>
```

If no language signal or existing profile exists, retain `primary=unknown`.
Never default an unknown repository to `both`.

Detect the following with native file search/read tools, ignoring generated and
vendor paths. Follow the exact confidence rules in the reference below.

@./references/profile-inference.md

### Data domain and connection signals

Set `data_domain` from direct evidence in this order: CLIF, OMOP, claims,
bioinformatics, generic EHR, generic data. Do not claim a clinical data source
from filenames alone. Use `generic-data` when no reliable domain evidence
exists.

Recognize a verified connection handoff from recent context:

```text
__CE_CONNECTION__ name=<connection-name> type=<postgres|sqlite|duckdb|other> database=<db-name> auth=<auth-mode> status=verified
```

When present, report it as high-confidence database evidence. Do not write the connection into `data_root`.

Recognize CLIF only from strong evidence (`CLIF_CLAUDE.md`, CLIF remote,
explicit CLIF/mCIDE request) or two weak signals. Weak CLIF signals require two or more matches: `mCIDE/`, `clif_*.parquet`, CLIF table names, `WORKFLOW.md`, or a CLIF-shaped `config/config.json`. Store `clif_profile_active=true` and:

```yaml
stack_profile:
  profile: clif
  clif:
    data_dictionary_version: "<confirmed 2.1.0 or 3.0.0>"
    mcide_version: "<matching confirmed 2.1.0 or 3.0.0>"
```

## Phase 1: Confirm an adaptive profile

Build a profile with language, IDE, environment, libraries, reporting, storage,
data domain, verified connection, and any existing choices. Include only values
backed by evidence; an unset optional field is preferable to a guessed value.

Show exactly one concise review card before any detailed questions:

```text
Detected profile
  Language: Python (high: pyproject.toml, analysis/model.py)
  IDE: Jupyter (high: analysis.ipynb)
  Environment: uv (high: uv.lock)
  Storage: Parquet (medium: cohort.parquet)
  Data domain: generic EHR (medium: cohort + encounter fields)

What would you like to do?
1. Continue with detected profile
2. Adjust a field
3. Full survey
```

For a complete existing profile, label the card `Current profile` and use the
same three choices. Do not start fresh merely because an optional field is
missing.

### Continue with detected profile

Accept high-confidence values without further questions. For each missing or
low-confidence field that is needed now, ask one focused question; do not ask
unneeded setup preferences.

- Ask language only when it is unknown or the evidence materially conflicts.
  Options are R, Python, and intentional mixed R + Python. Never treat
  `language_detect.primary=both` as a final user preference without confirming
  that both languages are active.
- Ask storage only when neither a connection, data files, nor project markers
  establish it. If a connection is verified, recommend its SQL database.
- Do not request data libraries, statistical packages, an environment manager,
  reporting format, data root, blinding state, R project type, or reporting
  checklist merely to complete setup. Infer them when direct evidence exists;
  otherwise leave them unset until an analysis needs them.

If CLIF is active, use the detected profile as CLIF-aware guidance: CLIF Parquet files (recommended), clifpy (recommended official CLIF client), polars (recommended for large CLIF tables), duckdb, pyarrow, pandera (schema validation; used in CLIF-MIMIC), sf-hamilton (pipeline DAGs; used in CLIF-MIMIC), tableone (Table 1; used in CLIF project repos), gtsummary (Table 1 and summaries; CLIF template), cmprsk (competing risks; used in CLIF mobilization analyses), uv (recommended for current CLIF Python repos and reproducible uv.lock files), and Marimo (recommended for current CLIF Python examples). Present these only when the user adjusts the relevant field or opens the full survey.

Before saving a CLIF profile, inspect the existing local config, repository data
dictionary, and source manifest for a matching CLIF/mCIDE pair. Reuse an
explicit pair without asking. If absent, incomplete, or conflicting, ask one
focused blocking question: `Which CLIF and mCIDE version family should this
project use?` Offer `CLIF 2.1 + mCIDE 2.1` and `CLIF 3.0 + mCIDE 3.0`; use the
platform question tool specified above, with numbered chat fallback. Do not
default an unknown CLIF project to 2.1, infer 3.0 from `mCIDE/` alone, or save
an undeclared mixed pair. Route the selected pair through `__CE_CLIF__`.

### Adjust a field

Ask which field to change, then ask only that replacement value. Recalculate
dependent defaults without reopening unrelated questions. For a mixed-language
repository, a Jupyter/Marimo selection refines the active profile to Python;
RStudio refines it to R; VS Code or Quarto keeps an intentional mixed profile.
Do not ask R data-library, R statistical-package, R environment-manager, or R
project-type questions after a Python-only IDE choice such as Marimo or Jupyter.
Do not ask Python package questions after an RStudio-only choice.

### Full survey

Read the following reference only after the user selects **Full survey**.

`references/full-survey.md`

For the full set of writable profile fields and their expected shapes, see `references/stack-profile-template.yaml`.

## Phase 1.5: Save only confirmed values

Write `.methodsmith/config.local.yaml` under the repository root. Preserve
the current compatible `stack_profile` structure and include only confirmed,
non-null values. The optional `stack_profile.inference` record is additive and
does not require a schema migration:

```yaml
stack_profile:
  language: python
  ide: jupyter
  data_layer: parquet
  inference:
    language:
      value: python
      confidence: high
      evidence: [pyproject.toml, analysis/model.py]
    data_domain:
      value: generic-ehr
      confidence: medium
      evidence: [cohort fields, encounter fields]
```

If a verified connection was accepted, save it under
`stack_profile.data_connection`. For database-first projects, set
`stack_profile.data_root: null` unless the user explicitly needs an extract or
cache folder; register concrete tables, extracts, or query outputs with
an entry in `analysis/data-waves.md` that records the location, source, received
date, row count when known, and a content hash when available.

If `data_root` is needed, ask for it then. Recommend an off-repo path for real
subject data; allow `data/` only for synthetic or fully de-identified public
data. Once `data_root` is set, in any mode, build or refresh the identifier index as described in
`references/sensitive-data-boundary.md`. Ask blinding state and reporting checklist only when an active study
workflow requires them.

For an active study without `.methodsmith/study-metadata.yaml`, offer to
copy `references/study-metadata-template.yaml` to that path (recommended for
any study that will have a SAP; required once its `ai_involvement` is not
`none`); planning, review, and SAP tracking read it. Uncomment only fields backed by evidence. This shared provenance file
is committed, unlike the machine-local config.

If the local config is not ignored, offer the entry:

```text
.methodsmith/*.local.yaml
```

Display a short summary containing values, confidence, and the next safe skill,
then emit the canonical `__CE_LANG__` handoff.

## Phase 2: Environment health check

Run the co-located `scripts/check-health` script:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
bash "$SKILL_DIR/scripts/check-health"
```

For `--locked-down` or `--no-install`:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
bash "$SKILL_DIR/scripts/check-health" --locked-down
```

Treat optional tools as yellow: optional tools are reported as yellow but do
not require Phase 3 unless the chosen workflow needs them. Quarto is optional
unless the confirmed reporting output requires it.

If the report names a legacy Compound Codex tool map, offer its removal. Read
`references/legacy-codex-tool-map.md` first; this is an optional global
instruction cleanup, not a project-profile change, and requires approval.

## Phase 3: Missing dependencies

In locked-down/no-install mode, report missing tools and approved workarounds,
but do not offer package-manager commands. Otherwise, offer only tools that are
both missing and required by the confirmed workflow. Show one command at a time,
ask approval, run it only after approval, and verify it before reporting
success.

Finish with the detected-profile summary and a recommendation to load
`method-workflow` in the current project. Refer to it by skill name — invocation
syntax varies by harness.
