---
name: method-clif
description: "Applies CLIF (Common Longitudinal ICU data Format) rules: mCIDE versions, Parquet, UTC datetimes, no-PHI outputs. Use when the repo has CLIF tables, mCIDE, or CLIF_CLAUDE.md."
argument-hint: "[optional: --version 2.1.0|3.0.0, --strict, --off]"
---

# CLIF-Safe Profile

## Skill Value

- **Problem it solves:** CLIF projects have consortium-specific invariants that generic EHR analysis workflows can violate.
- **Use when:** The repo has CLIF_CLAUDE.md, CLIF tables, mCIDE content, CLIF remotes, or the user asks for CLIF-specific analysis.
- **Output:** A CLIF activation signal plus language-specific CLIF workflow and validation guidance.
- **Ask only if:** Only when CLIF signals are weak or ambiguous and activation could be wrong.
- **Do not do:** Do not treat generic OMOP, claims, or EHR projects as CLIF without evidence.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Loads the CLIF (Common Longitudinal ICU data Format) ruleset for CLIF consortium or CLIF-derived projects so the rest of the `method-*` lifecycle respects CLIF schema, vocabularies, project layout, and PHI rules instead of treating CLIF like a generic Parquet dataset.

**Core source:** Treat `https://clif-icu.com/` as the authoritative public CLIF source for the data dictionary, mCIDE context, tools, and consortium status. Use GitHub repositories for implementation details only after anchoring the project to the CLIF site and declared data dictionary version.

## When this skill activates

Auto-activate on **one strong signal** or **two or more weak signals**:

**Strong signals:**
- A file named `CLIF_CLAUDE.md` exists at the repo root or `~/CLIF_CLAUDE.md`
- Git remote URL contains `clif-consortium`, `Common-Longitudinal-ICU-data-Format`, or `clif-icu`
- The user explicitly says "CLIF", "mCIDE", "clif-icu", or "common longitudinal icu data format"
- Manual: `method-clif` (forces activation)

**Weak signals (require 2+):**
- A `mCIDE/` directory exists
- `WORKFLOW.md` exists at the repo root
- Files named `clif_*.parquet` exist (e.g., `clif_vitals.parquet`, `clif_respiratory_support.parquet`)
- Code references CLIF-specific table names: `respiratory_support`, `medication_admin_continuous`, `patient_assessments`, `intake_output`
- `config/config.json` contains a `tables_path` field pointing to parquet files

**NOT activation signals (too generic):**
- `patient.parquet` alone (OMOP has `person`, but custom EHR may use `patient`)
- `hospitalization` alone (generic term)
- `vitals` or `labs` alone (generic terms)
- `renv.lock` alone (any R project)
- `WORKFLOW.md` alone (any project with a workflow doc)
- `adt` alone (ADT feeds exist outside CLIF)

When signals are ambiguous (only weak signals, or the user mentions a CLIF table name in a non-CLIF context), ask one question before activating:

> "Detected possible CLIF signals but this may not be a CLIF project. Is this a CLIF consortium or CLIF-derived project?"

`method-clif --off` forces deactivation for the session.

### Select the CLIF and mCIDE family

Read `references/version-families.md` before selecting a family. Inspect, in
order, an explicit `--version`, `stack_profile.clif.data_dictionary_version` and
`stack_profile.clif.mcide_version` in local config, a project data-dictionary declaration,
and a documented source manifest. Treat `--version` as a full direct call:

```text
`method-clif --version 2.1.0`  -> CLIF 2.1.0 + mCIDE 2.1.0
`method-clif --version 3.0.0`  -> CLIF 3.0.0 + mCIDE 3.0.0
```

An accepted direct call emits `selection=explicit` and needs no extra version
question. If it conflicts with an explicitly declared local or project pair,
show the mismatch and ask which source is intended before category work. Never
infer `3.0.0` merely from an `mCIDE/` directory, a table name, or missing
language evidence.

When no matching pair is declared, signals conflict, or only one version is
known, ask this blocking question before generating category filters or
validating vocabularies. Follow the interaction contract in Skill Value; if the
blocking question UI is unavailable, present the same numbered choices in chat
and wait. Never silently choose a family.

> Which CLIF and mCIDE version family should this project use?
>
> 1. CLIF 2.1 + mCIDE 2.1 — the 2.1 structured-dictionary release family (confirm the current release at https://clif-icu.com/).
> 2. CLIF 3.0 + mCIDE 3.0 — multimodal release family; use only when the project explicitly targets it.

Reject an undeclared mixed pair such as CLIF 3.0 with mCIDE 2.1. Record a
project-specific exception only after the user supplies its source and states
which vocabulary is authoritative.

When selected, print one acknowledgment line and emit the handoff signal:

```
[method-clif] CLIF profile active (data dictionary v<dd-version>, mCIDE v<mcide-version>); protected paths read-only without POC sign-off.
__CE_CLIF__ active=true version=<dd-version> mcide_version=<mcide-version> selection=<explicit|declared|selected> strict=<true|false> rules=references/clif-rules.md
```

When `--off` is passed, emit `__CE_CLIF__ active=false` so downstream skills resume default behavior.

## Prerequisites

None; no stack profile is required. Resolve the repository root before reading optional config:
!`git rev-parse --show-toplevel 2>/dev/null || true`

Use the resolved absolute path or resolve it at runtime, then read `<repo-root>/.ce-datascience/config.local.yaml` with the native file-read tool. In a linked worktree, fall back to the main checkout when the config is absent.

## Core workflow

### Step 1: Detect or confirm

If auto-detection signals are present, activate silently and print the acknowledgment line. If signals are ambiguous (e.g., user mentions CLIF but is in an unrelated repo), ask one question:

> "Detected CLIF references but the working directory is `<dir>`. Activate CLIF profile for this session?"

### Step 2: Load the rule set and language envelope

Load `references/clif-rules.md` (always), `references/mcide-vocab.md` (when the session touches `_category` columns or vocabulary checks), and `references/poc-table.md` (when an edit or PR is proposed against a protected path).

Before reading patient-level data, code output, logs, or tracebacks, apply the
sensitive-data boundary in `references/clif-rules.md`. CLIF's federated rules (no
patient-level tables leave the site, `n >= 10` floor for shared outputs) apply
in every mode.

Then ensure `__CE_LANG__` exists:

- If `__CE_LANG__` is already present in chat context, consume it as-is.
- Otherwise load the `method-language-detect` skill and use its emitted envelope.
- If detection returns `primary=unknown`, route CLIF code guidance to both recipe files.

### Step 3: Read the project's local override (optional)

If the resolved config contains a `clif:` block under `stack_profile:`, merge it over the defaults. Recognized keys:

```yaml
stack_profile:
  profile: clif
  clif:
    data_dictionary_version: "2.1.0"   # selected family: 2.1.0 or 3.0.0
    mcide_version: "2.1.0"             # must match data_dictionary_version unless an authoritative exception is documented
    parquet_only: true                  # refuse CSV/Feather for CLIF tables
    protected_paths:                    # in addition to the built-in list
      - mCIDE/**
      - ddl/**
      - outlier-handling/**
      - reference_ranges/**
      - WORKFLOW.md
    poc_table_path: ./CLIF_POCs.md      # optional override; defaults to references/poc-table.md
    strict: true                        # block on any rule violation rather than warn
```

### Step 4: Emit the signal

Emit the `__CE_CLIF__` line (canonical envelope below) alongside `__CE_LANG__`; downstream `method-*` skills read both in their step-0 context scan. This skill never modifies the user's repo; it only loads rules and emits signals.

### Step 5: On protected-path edits

When the session is about to edit any `protected_paths` entry, the skill's guardrail runs **before** the edit:

1. Resolve the responsible POC by matching the file path against `references/poc-table.md` (e.g., `mCIDE/respiratory_support/**` -> Nicholas Ingraham, `@ingra107`).
2. Refuse the edit unless the prompt contains a phrase indicating POC authorization, e.g., `POC: @ingra107 approved` or `--poc-approved`.
3. If the user insists without authorization, write the proposed change to `analysis/clif-protected-edits/<timestamp>-<file>.diff` and surface a single-line warning:

   ```
   [method-clif] BLOCKED: edit to mCIDE/respiratory_support/respiratory_support_mode_categories.csv requires POC sign-off (Nicholas Ingraham, @ingra107). Diff staged at analysis/clif-protected-edits/2026-04-29T18-00-00-respiratory_support_mode_categories.diff
   ```

## What this skill does NOT do

- Does not edit files in the upstream CLIF repo on the user's behalf
- Does not contact POCs (it only cites the right person)
- Does not replace `method-data-qa`, `method-cohort`, etc. — it just changes how those skills behave when CLIF mode is active
- Does not de-identify data or run PHI scans (dispatch the `method-phi-leak-reviewer` agent)

## Handoff signal (canonical envelope)

```
__CE_CLIF__ active=<true|false> version=<dd-version> mcide_version=<mcide-version> selection=<explicit|declared|selected> strict=<true|false> rules=<path-to-clif-rules.md>
```

Consumers (other `method-*` skills) parse `active=true` to switch to CLIF behavior; they parse `version=` and `mcide_version=` as one selected family before validating categories; they parse `strict=true` to escalate warnings into refusals. If `mcide_version=` is absent, stop category validation and route back to this skill rather than assuming the v2.1 cache applies.

## Code recipes (drawn from the upstream CLIF org)

When the user is writing CLIF analysis code, surface canonical recipes from the upstream code-of-record packages:

- **Python users** (`__CE_LANG__ primary=python`): load `references/clifpy-recipes.md` — recipes drawn directly from `Common-Longitudinal-ICU-data-Format/clifpy` (`python3 -m pip install --upgrade clifpy`; uv projects use `uv add clifpy`). Covers `ClifOrchestrator` setup, schema validation, helper-based feature construction, vitals outlier handling, unit conversion for medications, and the data-quality assessment (DQA) pattern.
- **R users** (`__CE_LANG__ primary=r`): load `references/r-template-recipes.md` — recipes drawn from `Common-Longitudinal-ICU-data-Format/CLIF-Project-Template` (R) and the canonical `code/templates/R/` layout. Covers `renv` bootstrap, `arrow::open_dataset()` reads, cohort → QC → outlier handling → analysis, and the separate intermediate/final output paths.
- **`__CE_LANG__ primary=both`** or `unknown`: surface both files so the agent can choose.

For a new consortium project or an audit of an existing template-derived repository, route to the `method-clif-template` skill. It owns template initialization and structural audit; this skill remains the CLIF version, vocabulary, and protected-path guardrail.

For formal site-to-lead effect pooling, model-output synthesis, or a literature
meta-analysis, use `method-clif-meta-analysis`. A shared CLIF schema does not establish
comparable estimands or independent site estimates.

## References

Read each file at the step that names it (backtick paths, loaded on demand):

- `references/clif-rules.md` — Core rules (Parquet, UTC datetimes, mCIDE vocab, project layout, sensitive-data boundary, template workflow). Read at Step 2, always.
- `references/version-families.md` — Selection and migration contract for CLIF/mCIDE 2.1 and 3.0. Read before selecting a version family or validating v3 categories.
- `references/mcide-vocab.md` — Cached 2.1 allow-lists plus pointers to authoritative mCIDE CSV sources; never use it for v3.
- `references/poc-table.md` — CLIF table / mCIDE subdirectory to responsible POC (name and GitHub handle), for the protected-path guardrail. Names and handles only; no contact addresses are cached.
- `references/clifpy-recipes.md` — Python recipes (ClifOrchestrator, SOFA, wide dataset, validation). Load when generating Python CLIF code.
- `references/r-template-recipes.md` — R recipes (arrow, cohort, QC, meta-analysis, propensity, federated). Load when generating R CLIF code.
