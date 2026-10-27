---
name: method-table1
description: "Generates a traceable Table 1 (baseline characteristics) shell and validation report from the SAP and variable catalog. Use when the user asks for Table 1 or a baseline-characteristics table."
argument-hint: "[optional: --variables analysis/sap-tables/03-variables.csv --out-dir analysis/publication/tables --style-profile jama --strata exposure_var --design rct|observational|descriptive]"
---

# Table 1 Generator

> **Run the script from the user's project root.** `$SKILL_DIR` anchors the script path; the data and output paths resolve against `--project-root` (default: the current directory) and must stay project-relative.


## Skill Value

- **Problem it solves:** Baseline tables fail when variable lists, cohort columns, formatting, and validation are not traceable.
- **Use when:** The user asks for Table 1, baseline characteristics, demographic table, or manuscript-ready descriptive cohort table.
- **Output:** Traceable CSV/Markdown Table 1 shell and validation report.
- **Ask only if:** Only when baseline variable list, cohort grouping, or data source is missing.
- **Do not do:** Do not invent variables, cohorts, or patient-level output.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Create a publication-ready Table 1 shell from declared study artifacts. The script builds the specification and shell only; it never reads patient data. Filling cells (step 3b) is agent work under this specification, done only when the SAP or user names the analytic dataset.

When the requested Table 1 workflow creates or materially extends a Marimo, Jupyter, R Markdown, or Quarto notebook, load the `method-notebook-standards` skill before creating cells or chunks.

## Inputs

Prefer these project-local files:

- `analysis/sap.md`
- `analysis/sap-tables/03-variables.csv`
- `analysis/sap-tables/02-outputs.csv`

Bundled: `references/journal-style-profiles.yaml` holds the journal style profiles; the script blocks an unknown `--style-profile`.

If the variables catalog is missing, ask the user for the baseline variable list. Do not invent variables from a vague manuscript request.

## Workflow

1. Resolve the variables catalog, outputs catalog, output directory, and style profile. Default style profile is `jama` unless the project config names another profile.
2. Run:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/generate_table1.py" --variables analysis/sap-tables/03-variables.csv --out-dir analysis/publication/tables --style-profile jama --strata <stratification variable> --design <rct|observational|descriptive>
```

Baseline rows are fixed variables measured at or before time zero. The script skips `Time-varying` rows (with a warning naming them; add a `*_baseline` variable instead) and never lists the exposure category, which is the stratifier.

Pass the stratification variable the user or SAP names with `--strata` (comma-separated for more than one); the script records it in `table1-spec.json` and the shell headers, and warns when it is absent. Pass `--disclosure-floor <n>` only when the project or DUA declares a floor other than the default (suppress n<11).

3. Review the generated validation report before presenting the table as ready.
3a. Comparison columns follow `--design`. For randomized trials, never add p-values or tests of baseline difference (CONSORT 2025 item 25: any baseline difference after proper randomization is due to chance). For observational comparisons, the script adds an absolute standardized difference column instead of p-values (|SMD| > 0.10 flags meaningful imbalance by convention; Austin, Stat Med 2009, PMID 19757444). After matching or weighting, present the matched or weighted table and SMDs beside the crude ones.
3b. Fill or leave the shell: when the SAP or the user names the analytic dataset, compute the Overall and per-stratum cells from it (mean (SD) for approximately symmetric continuous rows and median (IQR) for skewed ones, as declared in the variables catalog or SAP and never both silently; `No. (%)` for categorical rows; a missing-count row for variables with missing values), apply step 4 before writing, and record the dataset path in the validation report. When no analytic dataset is named, deliver the shell with `TBD` cells and state the floor that will apply; never estimate cells from a manuscript or chat description.
3c. Lock the cells to the number registry: the shell's Overall cells already cite `{{num:table1.<variable>.overall}}` (ids in `table1-spec.json` under `registry_ids`). In the fill script, register every filled cell with `register_table` from the `method-numbers` helpers (`kind="count"` with `denominator` for `No. (%)`, `kind="estimate"` with `sd` or `iqr` for continuous rows), passing the analytic dataset as `sources` and `registry.sap_output` from the spec as `sap_output`; add per-stratum ids as `table1.<variable>.<stratum level>`. Then load the `method-numbers` skill, `render` the shell, and run its `check` on the rendered table. Never type a cell value into `table1.md` or `table1.csv`. The script warns when no SAP output names Table 1; fix the outputs catalog or pass `--sap-output`.
4. **Small-cell suppression (always, not only in CLIF mode):** before presenting or writing any stratified table, suppress or aggregate cells with n below the project's disclosure floor (default n<11 unless the project declares its own floor, for example the CLIF consortium floor of n>=10, or a site or DUA rule is stricter). Suppress complementary cells too when a suppressed value could be recovered by subtraction from totals. A Table 1 stratified by exposure routinely produces small cells — check every stratum, not just the obvious ones.
5. **Sensitive-data boundary.** Resolve `phi_environment.mode` in `.methodsmith/config.local.yaml` (worktree, then main checkout; legacy `compliant: true` = `approved`, `compliant: false` = `schema-only`, `sensitive_data: false` = `no-sensitive-data`; any schema-only signal wins; unreadable = `schema-only`). `approved` or `no-sensitive-data`: proceed silently and never mention the boundary again. `schema-only`: headings, types, counts, and aggregates only; never open, print, or paste data values; run data-reading scripts as `method-safe-run -- <command>` (path in the guard's deny message); save results as aggregate tables (counts under 11 suppressed) in `output/` or a `phi_environment.aggregate_dirs` entry. Unset, interactive: ask once with the blocking question tool (else a numbered list) offering `Approved endpoint: full access`, `Not approved or unsure: schema-only`, and `No sensitive data: public or synthetic`; save the answer as `phi_environment.mode` there once `git check-ignore -q .methodsmith/config.local.yaml` passes (else first add `.methodsmith/*.local.yaml` to `.gitignore`) so the guard hook sees it. Unset, headless: schema-only. In `schema-only`, run or hand over the script and read back only the suppressed aggregate table.
6. Table 1 output is aggregate-only: never write patient-level rows to publication, review-pack, or shared directories. If CLIF mode is active, write the aggregate-only output to `output/final_no_phi/`.

## Outputs

- `table1-spec.json` -- structured variables, source paths, style profile, and readiness state
- `table1.csv` -- editable table shell
- `table1.md` -- Markdown table shell for manuscripts and review packs
- `table1-validation-report.md` -- blockers, warnings, and provenance

## Readiness Rules

- Block when no baseline variables are declared (the script exits 1 and writes the blocker to the validation report).
- Warn when no SAP or outputs catalog is found (the script records these in the validation report).
- Warn when no stratification variable is declared (the script writes this warning when `--strata` is absent and when a named stratum is missing from the catalog).
- Preserve repo-relative paths in all generated artifacts.
- Use the configured journal style profile for formatting expectations.

## References

@./references/table1-spec.md

@./references/jama-table-rules.md
