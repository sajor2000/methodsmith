---
name: method-data-qa
description: "Profiles columns or runs a GO/NO-GO data-quality gate on an extract before SAP finalization, modeling, or unblinding. Use when the user asks to check data readiness."
argument-hint: "[data file path or extract_id, optional --sap path/to/sap.md]"
---

# Data Quality Assessment Gate


## Skill Value

- **Problem it solves:** Analysis can start before grain, keys, missingness, duplicates, dates, and extract validity are understood.
- **Use when:** The user asks to inspect columns, validate a fresh extract, compare data to cohort/SAP expectations, or check readiness.
- **Output:** A data profile or GO/NO-GO QA report plus __CE_DATA_PROFILE__ or data-wave handoff signal.
- **Ask only if:** Only for file paths, intended grain, key fields, or SAP/cohort links that cannot be inferred.
- **Do not do:** Do not certify SAP correctness or run modeling.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

This skill formalizes the data-QA gate that exists between data extraction and SAP/modeling work. **No SAP finalization, coding, or modeling runs until the available data columns and QA status are documented.** A "fail" outcome blocks the pipeline; a "warn" outcome requires PI sign-off; a "pass" outcome unlocks the data lock + modeling phase. When the SAP does not exist yet, run in pre-SAP column profile mode and emit a data profile that `method-plan` uses to draft the SAP without inventing variables.

## When This Skill Activates

- A new data wave or extract was recorded and downstream code expects to model it
- The SAP shape may have drifted from the data shape (analyst noticed column rename, type change, or value-set expansion)
- Before unblinding for confirmatory analysis (final QA pass against the locked SAP)
- After a re-extract following an EHR query fix
- Manual invocation via `method-data-qa` to spot-check a dataset

## Prerequisites

1. A SAP exists at `analysis/sap.md` (or specified via `--sap`) for full SAP-aligned QA. If no SAP exists yet, run pre-SAP column profile mode instead of stopping.
2. A stack profile exists so `data_root` is known. If none exists, ask the user to run the `method-setup` command (it is manual-invocation-only and cannot be loaded by the model), or ask them directly for `data_root` and proceed with that answer.
3. The data extract is recorded in `analysis/data-waves.md` with extract id, location, source, received date, row count when known, and a content hash when available.
4. **Sensitive-data boundary.** Resolve `phi_environment.mode` in `.methodsmith/config.local.yaml` (worktree, then main checkout; legacy `compliant: true` = `approved`, `compliant: false` = `schema-only`, `sensitive_data: false` = `no-sensitive-data`; any schema-only signal wins; unreadable = `schema-only`). `approved` or `no-sensitive-data`: proceed silently and never mention the boundary again. `schema-only`: headings, types, counts, and aggregates only; never open, print, or paste data values; run data-reading scripts as `method-safe-run -- <command>` (path in the guard's deny message); save results as aggregate tables (counts under 11 suppressed) in `output/` or a `phi_environment.aggregate_dirs` entry. Unset, interactive: ask once with the blocking question tool (else a numbered list) offering `Approved endpoint: full access`, `Not approved or unsure: schema-only`, and `No sensitive data: public or synthetic`; save the answer as `phi_environment.mode` there once `git check-ignore -q .methodsmith/config.local.yaml` passes (else first add `.methodsmith/*.local.yaml` to `.gitignore`) so the guard hook sees it. Unset, headless: schema-only. In `schema-only`, write the profiling script, run it only if it prints aggregates, otherwise hand it to the user to run locally, and build the report from that aggregate output.
5. When `data_root` is set, in any mode, refresh the identifier index so new extracts are covered: check that `scripts/method-identifier-index` exists in this skill's directory, then run it with the first interpreter found among `python3`, then `python`, then `py`. It prints counts only.

   ```bash
   SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
   python3 "$SKILL_DIR/scripts/method-identifier-index"
   ```
6. If the dataset is a research cohort built from EHR or claims data, load the `method-cohort` skill first — the CONSORT waterfall it produces is the starting point for the row-count check in step 3 below. When `__CE_COHORT__` appears in chat context or `analysis/cohort/<name>-waterfall.csv` exists, use it as the expected-N source instead of re-deriving from the SAP.

## Core Workflow

### Step 0: Choose QA mode

If a SAP is available, run **SAP-aligned QA mode** and compare the data to SAP-declared variables, populations, missingness rules, and analysis windows.

If no SAP is available, run **pre-SAP column profile mode**:

- Inspect the dataset or table schema before `method-plan` writes SAP variable/model sections.
- Produce row count, column count, column names and types, candidate grain, primary or candidate keys, important date columns, timezone assumptions, null rates, duplicate rates, distinct counts for categorical columns, and basic numeric summaries.
- **PHI guard (always, not only in CLIF mode):** never echo row-level data, free-text columns, identifiers, or dates of birth into the QA report — report counts and masked samples instead. When listing distinct categorical values with counts in a report that may be shared, suppress categories below the disclosure floor (default n<11 unless the project declares its own floor, for example the CLIF consortium floor of n>=10, or a site or DUA rule is stricter) or bucket them as "other".
- Flag obvious validity issues such as impossible dates, negative counts where not plausible, sentinel missing values, mixed-grain rows, and PHI-suspect columns.
- Do not invent study variables or analysis models. Mark SAP-dependent checks as "deferred until SAP exists."
- Emit `__CE_DATA_PROFILE__` so `method-plan` can use the actual columns and state which variables remain provisional.

### Step 1: Resolve the data wave

Read `analysis/data-waves.md`; if the project also maintains `.methodsmith/data-state.yaml`, reconcile it with the same wave id and status. If a specific `extract_id` was passed, use it; otherwise use the most recently recorded, unlocked wave. Refuse to QA a `locked` wave unless `--force` is passed (locked waves are immutable; QA already passed).

### Step 2: Parse the SAP for shape expectations

Skip SAP parsing in pre-SAP column profile mode. Instead, treat the observed column profile as planning evidence and label all SAP-dependent thresholds as pending.

Extract from the SAP:
- **Population size**: expected N from inclusion/exclusion criteria
- **Required variables**: from SAP-2 (Variables) section
- **Variable types**: continuous / categorical / time-to-event
- **Value sets for categoricals**: e.g., `sex: {M, F}`, `treatment: {placebo, drug}`
- **Date variables**: enrollment, randomization, event, censor
- **Missingness rule**: e.g., "≤ 5% missing per primary outcome variable"

If the SAP doesn't specify these, output a `WARN: SAP under-specified` finding and proceed with looser defaults.

### Step 3: Run the QA checks

**CLIF profile**: when chat context contains `__CE_CLIF__ active=true`, additionally run the CLIF-specific gate before the generic checks. Treat `https://clif-icu.com/` and the matching `version=` + `mcide_version=` values in the CLIF handoff as the authoritative family. If either version is missing, incomplete, or mixed, stop the category check and route to the `method-clif` skill; do not use a v2.1 cache by default.

- **Storage check**: refuse to QA non-Parquet inputs for CLIF tables; emit a `block` finding if asked to QA CSV/Feather data declared as CLIF.
- **Parquet reader**: Parquet needs `pyarrow` (or `polars`/`duckdb`) in the Python environment, or `arrow` in R. If the import fails, stop with the install line for the project's manager (`uv add pyarrow`, or `pip install pyarrow` in an activated venv; `install.packages('arrow')` in R) instead of converting the data to CSV.
- **ID type check**: `patient_id` and `hospitalization_id` are VARCHAR — `block` if cast to int.
- **Datetime check**: every `*_dttm` column is timezone-aware UTC — `block` if any tz-naive timestamps exist.
- **mCIDE vocabulary check**: every `*_category` column conforms to the selected CLIF/mCIDE family. Use the bundled allow-list only for 2.1 + 2.1; for 3.0 + 3.0, read the project’s declared v3 mCIDE source and record it in the report. Each violation is a `block` (or `warn` when `strict=false` was set on `__CE_CLIF__`).
- **Outlier-handling check**: physiologic ranges follow `clifpy`'s `outlier_config.yaml` or the project's documented thresholds; `warn` on out-of-range, never silently clip.
- **PHI guard**: free-text columns (`*_name`, `clinical_notes_text`, raw `discharge_name`) are not echoed in the report — replace with a count + sample-of-distinct-after-mask.
- **Canonical implementation**: prefer upstream CLIF tooling when available. `__CE_LANG__ primary=python` -> use `clifpy`'s `ClifOrchestrator` DQA path. `__CE_LANG__ primary=r` -> use the CLIF project-template QC and outlier-handler pattern. If `__CE_LANG__` is absent, load the `method-language-detect` skill; if still `unknown`, surface both implementations. Roll your own only when neither applies.

### Causal workflow integrity checks (Python data stacks)

For Python/Pandas/Polars/DuckDB workflows that prepare a causal analysis dataset, run QA-17 through QA-23 in addition to the generic checks. Preserve the risk-based gate: confirmed integrity failures are `block`; ambiguous methodological or stack-specific risks are `warn` and require analyst resolution. Never substitute synthetic or fallback data silently. Treat Polars, DuckDB, and large eager-load concerns as warnings unless the run confirms an integrity violation.

Apply each check from `references/qa-checks.md` against the data. Generate findings into one of these buckets:

| Bucket | Meaning | Effect on gate |
|--------|---------|----------------|
| `block` | Row count, key, type, or value-set violation that makes modeling impossible or unsafe | NO-GO |
| `warn` | Missingness above expected threshold, distribution shift, suspected outlier cluster | Require PI sign-off |
| `info` | Cosmetic (column order, label drift) | No effect |
| `pass` | Check ran cleanly | No effect |

### Step 4: Generate the report

When generating the report as an R Markdown or Quarto notebook rather than a static report, load the `method-notebook-standards` skill before creating or materially extending its executable chunks.

Write to `reports/data-qa/<extract_id>.md` (markdown) and `reports/data-qa/<extract_id>.html` (rendered Quarto / RMarkdown) when the project has a Quarto or RMarkdown render path; otherwise the Markdown report is the deliverable and the report states that the `.html` path was not rendered. Use `references/report-template.md`. Sections:

1. **Summary banner** (GO / NO-GO / GO with PI sign-off)
2. **Column profile**: row count, column count, names/types, candidate grain, candidate keys, date columns, null rates, duplicate rates
3. **Wave provenance**: extract_id, source, hash, row count, ingestion date
4. **CONSORT/STROBE flow**: enrollment → eligibility → analysis populations, when available
5. **Missingness map**: heatmap (or fallback table), per-variable %
6. **Findings table**: bucket × check × variable × details
7. **Sign-off block**: empty, for PI to fill if `warn` bucket non-empty

If any `warn` finding requires PI approval, add the report path and finding summary to the project signoff ledger used by `method-signoff`. Data-QA approval must remain separate from the data lock; the ledger records human acceptance of warnings, not permission to mutate locked data.

### Step 5: Emit GO/NO-GO and update data state

Always emit a unified handoff signal that `method-plan` SAP mode reads (and a legacy GO/NO-GO line for backward compatibility):

```
__CE_DATA_PROFILE__ dataset=<path-or-wave> rows=<n> columns=<n> grain=<candidate-grain-or-unknown> report=<path>
__CE_DATA_QA__ wave=<id> pass=<true|false> blockers=<n> warns=<n> report=<path>
```

In pre-SAP column profile mode, `pass=true` means no structural blockers were found in the profile; it does not mean SAP-specific checks have passed. If GO (`pass=true`): also emit `__CE_DATA_QA_PASS__ extract_id=<id>` and state that an authorized human may record a dated `locked` entry only after SAP-aligned QA is complete. If NO-GO (`pass=false`): also emit `__CE_DATA_QA_FAIL__ extract_id=<id> blockers=<count>` and stop. Print the path to the report.

### Step 6: Compound learning hook

If any `block` or `warn` finding fires AND the same finding pattern appeared on a prior extract (lookup via `method-learnings-researcher` for `problem_type: data_quality_issue`), suggest `method-compound` to capture the pattern. Use the heuristic: same variable + same check + ≥ 2 occurrences across studies = compound-worthy.

## Pipeline mode

When invoked from an automated workflow (LFG-style, headless `method-work`, or any `disable-model-invocation` context), skip the user prompts and emit only the structured signals. The report file is still written.

## What This Skill Does NOT Do

- **It does not modify the data.** This is a read-only assessment. Cleaning is a separate `method-work` task.
- **It does not lock the data.** After SAP-aligned QA, an authorized human records a dated `locked` entry for the wave in `analysis/data-waves.md`, naming the QA report path and content hash; update `.methodsmith/data-state.yaml` too when the project uses it.
- **It does not check SAP correctness.** That's `method-sap-drift-detector` (which now also covers amendments). We check data-vs-SAP shape consistency only.
- **It does not run statistical models.** No fits, no tests, no inferential output. Descriptive only.

## References

@./references/qa-checks.md

@./references/report-template.md

@./references/missingness-patterns.md
