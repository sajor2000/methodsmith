---
name: method-clif-template
description: "Initializes or audits a CLIF analysis repo against the official CLIF Project Template, with PHI and output safeguards. Use when creating or checking a CLIF project repo."
argument-hint: "[init <empty-directory> | audit [project-directory]] [--version 2.1.0|3.0.0]"
---

# CLIF Project Template

## Skill Value

- **Problem it solves:** New CLIF projects need a consistent, consortium-readable structure without accidentally copying PHI, weakening output controls, or mixing dictionary families.
- **Use when:** Creating a new CLIF analysis repository from the official template or auditing an existing template-derived project.
- **Output:** An initialized project skeleton or a structural audit with explicit readiness and remediation findings.
- **Ask only if:** The requested destination, CLIF/mCIDE family, or intent to replace a non-empty directory is ambiguous.
- **Do not do:** Do not clone into a non-empty directory, copy clinical tables, infer a CLIF version, or place row-level data in shared output paths.

Use the official [CLIF Project Template](https://github.com/Common-Longitudinal-ICU-data-Format/CLIF-Project-Template) as the project-layout source. Treat [clif-icu.com](https://clif-icu.com/) and `method-clif` as authoritative for the selected data-dictionary and mCIDE family.

## Route

- `init <empty-directory>` creates a new local project from the official GitHub template only after the target is confirmed empty and the CLIF family is selected through `method-clif --version` or a matching declared project source.
- `audit [project-directory]` inspects a local project without modifying it. When omitted, audit the current repository.

## Initialize

1. Load the `method-clif` skill and require a single selected CLIF/mCIDE family. Do not initialize on an unknown or mixed version.
2. Confirm the destination is an explicit empty directory. If it is non-empty, stop and require a new location; never merge template files into an existing project.
3. Use GitHub's template mechanism or a shallow clone of `Common-Longitudinal-ICU-data-Format/CLIF-Project-Template`; retain its Apache-2.0 license and bundled `clif_demo` for safe first-run validation. Never replace it with clinical data.
4. Create the template structure: `code/`, `config/`, `guides/`, `utils/`, `output/final_no_phi/`, and `output/intermediate_phi/`. Keep `config/config.json` site-local and gitignored; it may name a registered source location but must not contain credentials.
5. Replace placeholders in the project README with selected CLIF version, objective, required tables and fields, cohort definition, expected aggregate outputs, language environment, and run instructions. Record required tables from the approved study/SAP; do not invent fields or categories.
6. Keep the template's four-step convention: `01` cohort identification, `02` quality checks, `03` outlier handling, and `04` analysis. Use Parquet inputs and UTC `*_dttm` fields. R uses `renv` and `arrow::open_dataset()`; Python uses the project's managed environment and `clifpy` only when it is declared as a dependency.
7. Make `output/intermediate_phi/` local-only. `output/final_no_phi/` accepts aggregate results only: no patient or hospitalization identifiers, no row-level records, no raw CSV/Parquet, and no reported cell smaller than 11 (the clif-icu.com FAQ requires more than 10 patients per cell; the CLIF-Project-Template README states `n >= 10`, so apply the stricter FAQ rule, and a stricter site or DUA rule always wins).
8. Before distributing the project, require an independent site to run it and return `BUDDY_TEST_REPORT.md` from the template's buddy-test report. Do not mark the project distribution-ready until the report passes and the README carries its buddy-test stamp.

## Audit

Check and report each item as pass, warning, or block:

- README has an explicit CLIF version, objective, required table/field rationale, cohort criteria, expected outputs, and environment/run instructions.
- `config/config.json` is excluded from Git and contains no secrets or PHI samples.
- Required structure and separate PHI/intermediate versus final aggregate output paths exist.
- Code follows cohort -> quality checks -> outlier handling -> analysis, uses Parquet and timezone-aware UTC datetimes, and keeps patient-level content out of final outputs.
- Output guidance requires aggregate-only sharing and the CLIF floor of more than 10 patients per reported cell (`n >= 11`), or a stricter site or DUA floor when one applies.
- Any edit to CLIF protected paths remains subject to `method-clif` POC approval.
- When the audit assesses distribution readiness, `BUDDY_TEST_REPORT.md` exists, records a pass from another site, and the README carries the corresponding validation stamp. A missing buddy test is a block for distribution readiness, not ordinary local development.

An audit does not certify data quality, cohort validity, disclosure safety, or consortium approval. Route those questions to `method-data-qa`, the study SAP, `method-signoff`, and the responsible CLIF POC.

This audit covers template structure only. For a full repository audit that also checks dependency pins, config keys, `clifpy` usage and reimplementations, timezone handling, export gates, and reproducibility, use `method-clif-audit`.
