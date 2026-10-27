# CLIF-Safe Rules

## Contents

- 1. Storage
- 2. Identifiers
- 3. Datetime
- 4. mCIDE vocabularies
- 5. Project layout (from `CLIF-Project-Template`)
- 6. Template workflow (from `CLIF-Project-Template`)
- 7. PHI / data privacy authorization
- 8. Protected paths (no edits without POC sign-off)
- 9. Federated analysis pattern
- 9b. Staged data loading
- 9c. Hybrid Python + R pipeline
- 10. Common pitfalls (codified from `CLIF_CLAUDE.md` and observed in consortium repos)
- 11. Reporting checklist defaults under CLIF profile
- 12. References (read-only, cite as needed)

These rules apply whenever `__CE_CLIF__ active=true` is present in chat context. Core source: `https://clif-icu.com/` is the authoritative public CLIF site for the data dictionary, mCIDE context, tools, and consortium status. Use GitHub repositories for implementation details after anchoring to the CLIF site and selected data-dictionary/mCIDE family. Support CLIF 2.1 + mCIDE 2.1 and CLIF 3.0 + mCIDE 3.0. Read `version-families.md` before category validation; never apply the v2.1 cache to v3. Implementation sources: `github.com/Common-Longitudinal-ICU-data-Format/CLIF`, `github.com/Common-Longitudinal-ICU-data-Format/clifpy`, `github.com/Common-Longitudinal-ICU-data-Format/CLIF-MIMIC`, `github.com/Common-Longitudinal-ICU-data-Format/CLIF-TableOne`, and `github.com/Common-Longitudinal-ICU-data-Format/CLIF-Project-Template`.

## 1. Storage

- **Parquet only.** CLIF tables are persisted as `.parquet`. Never `read_csv` / `pd.read_csv` / `write.csv` for CLIF tables. Never emit Feather, ORC, RDS, or pickle for CLIF tables.
- **Python**: prefer `polars` (`pl.read_parquet`, `pl.scan_parquet` for lazy). Pandas (`pd.read_parquet`) is acceptable for small tables only.
- **R**: prefer `arrow` + `dplyr` (`arrow::read_parquet`, `arrow::open_dataset` for partitioned datasets), collected via `dplyr::collect()`.
- Keep patient-level working artifacts under the declared approved restricted data root. The template path `output/intermediate_phi/` may be used only after verifying that it is approved, local, non-synced storage and gitignored. Never share, commit, upload, or place patient-level artifacts in a review pack. Write shareable figures, tables, and model summaries only to `output/final_no_phi/`.

## 2. Identifiers

- `patient_id` and `hospitalization_id` are **VARCHAR**. Never cast to `int`/`int64`/`numeric`. Joins, group-bys, and filters preserve string type.
- `hospitalization_joined_id` is an optional linkage key for chained encounters. Use it when the site populates it; otherwise use `clifpy` encounter stitching (`ClifOrchestrator(stitch_encounter=True, stitch_time_interval=...)`) and state the window. Do not invent an ad-hoc grouping key, and never assume the column exists.
- Primary unit of analysis is `hospitalization_id` for encounter-level analyses, `patient_id` for cross-encounter analyses.

## 3. Datetime

- All `*_dttm` columns are timezone-aware UTC. Format: `YYYY-MM-DD HH:MM:SS+00:00`. Never tz-naive.
- `birth_date` is a `DATE` (no time, no zone).
- When parsing, always specify `tz="UTC"` (Python) or `tz = "UTC"` (R, lubridate). When writing, ensure timestamps round-trip as UTC.
- Time arithmetic uses `dt.total_hours()` / `as.numeric(difftime(..., units="hours"))`. Never subtract naive timestamps.
- `clifpy`'s `timezone=` setting relabels loaded UTC data into the site zone without moving the instant; naive stored values are assumed to already be in that zone. Never strip the zone after loading. When analysis uses local calendar days or shifts, state which zone defines the boundary (the dictionary's date-only rule is local midnight, then UTC).

## 4. mCIDE vocabularies

- Every `*_category` column has an allow-listed vocabulary. For CLIF 2.1 + mCIDE 2.1, see `mcide-vocab.md`; for CLIF 3.0 + mCIDE 3.0, read the declared v3 mCIDE source. Never invent new category strings; never silently relabel or use the v2.1 cache for v3.
- When a source value cannot be mapped, write `Other` (where the vocab includes it) and preserve the raw value in the corresponding `*_name` column.
- Validate before writing: `assert df["location_category"].is_in(ALLOWED_LOCATION_CATEGORIES).all()`.

## 5. Project layout (from `CLIF-Project-Template`)

```
project/
├── code/                  # Cohort, QC, outlier handling, and analysis scripts
├── config/
│   ├── config_template.json  # Committed template; copy to config.json
│   └── config.json        # Site-specific paths, gitignored, never committed
├── guides/                # Creator guide, primer, buddy-testing guide and report template
├── output/
│   ├── intermediate_phi/  # Optional only when approved, local, non-synced, and gitignored
│   └── final_no_phi/      # Aggregate, shareable results only
├── renv/                  # R environment (if R)
├── renv.lock              # R lockfile (if R)
├── pyproject.toml         # Python dependencies (if Python)
├── uv.lock                # Python lockfile used by current CLIF repos
├── requirements.txt       # Optional exported Python requirements
├── utils/                 # Shared helpers, including Python and R config loaders
└── README.md
```

The template supports Python and R (`code/templates/Python/` and `code/templates/R/`).
Outlier thresholds come from `clifpy` (`outlier_config.yaml`) or the project's
documented analysis step, not from a site-level override folder.

Rules:
- New analysis files go under `code/`. Do not create top-level `analysis.py` / `script.R`.
- Site-specific paths live in `config/config.json` (not hardcoded).
- `output/final_no_phi/` is the only sanctioned destination for shared results. Patient-level intermediates belong under the approved restricted data root; use `output/intermediate_phi/` only when that exact path is approved, local, non-synced, and gitignored.

## 6. Template workflow (from `CLIF-Project-Template`)

The project template supplies a four-step convention. Treat the filenames and
templates as adaptable, but preserve the data-sharing boundary:

1. **Cohort identification** (`code/01_cohort_*`)
   - Apply inclusion/exclusion criteria and write patient-level working tables under the approved restricted data root. Use `output/intermediate_phi/` only when that path passes the storage checks above; write any cohort summary to `output/final_no_phi/`.

2. **Quality checks** (`code/02_*quality*`)
   - Check the cohort's required fields, mCIDE categories, and plausible ranges.

3. **Outlier handling** (`code/03_*outlier*`)
   - Set physiologically implausible values to missing using the CLIF-approved handling path.

4. **Analysis** (`code/04_*analysis*`)
   - Read the prepared cohort and write only aggregate results with every reported cell above 10 (`n >= 11`, the CLIF floor) to `output/final_no_phi/`.

When `method-plan` runs under CLIF profile, reflect this workflow rather than a generic QC-first three-script split.

## 7. Sensitive-data boundary

- **Sensitive-data boundary.** Resolve `phi_environment.mode` in `.methodsmith/config.local.yaml` (worktree, then main checkout; legacy `compliant: true` = `approved`, `compliant: false` = `schema-only`, `sensitive_data: false` = `no-sensitive-data`; any schema-only signal wins; unreadable = `schema-only`). `approved` or `no-sensitive-data`: proceed silently and never mention the boundary again. `schema-only`: headings, types, counts, and aggregates only; never open, print, or paste data values; run data-reading scripts as `method-safe-run -- <command>` (path in the guard's deny message); save results as aggregate tables (counts under 11 suppressed) in `output/` or a `phi_environment.aggregate_dirs` entry. Unset, interactive: ask once with the blocking question tool (else a numbered list) offering `Approved endpoint: full access`, `Not approved or unsure: schema-only`, and `No sensitive data: public or synthetic`; save the answer as `phi_environment.mode` there once `git check-ignore -q .methodsmith/config.local.yaml` passes (else first add `.methodsmith/*.local.yaml` to `.gitignore`) so the guard hook sees it. Unset, headless: schema-only.
- An orchestrator's exact `PHI authorization: confirmed` marker counts as `approved`; `PHI authorization: not confirmed` counts as `schema-only`.
- **Never** share, commit, upload, or send patient-level CLIF tables across sites. CLIF is federated: code travels, data does not.
- Keep patient-level work under the approved restricted data root. Use `output/intermediate_phi/` only when explicitly verified as approved, local, non-synced, and gitignored. Share only reviewed aggregates in `output/final_no_phi/`, with every reported cell above 10 (`n >= 11`) and no raw data files. The CLIF floor comes from the clif-icu.com FAQ ("more than 10 patients per cell"); the template README states `n >= 10`, so use the stricter FAQ rule, and a stricter site or DUA rule always wins.
- When the user asks to commit or share data, refuse and provide code or instructions for a secure local run instead.
- Treat clinical notes, imaging, raw names, and free-text fields as PHI-suspect. CLIF 3.0's notes and imaging require the same prohibition with heightened caution.

## 8. Protected paths (no edits without POC sign-off)

These paths must not be edited without the responsible point-of-contact's authorization. The POC table is in `poc-table.md`.

- `mCIDE/**` — minimum Common ICU Data Elements. Schema-level changes here ripple across every consortium site.
- `ddl/**` — DDL statements that define the relational schema.
- `WORKFLOW.md` — process document; any change is a consortium-level decision.

The CLIF repository removed its `outlier-handling/` and `reference_ranges/`
directories: outlier thresholds and reference ranges are applied downstream in
`clifpy` or in each project, not in the ETL specification. Changes to `clifpy`'s
shared `outlier_config.yaml` go through the `clifpy` repository and the affected
table POC.

To override: include `POC: @<github-handle> approved` (or `--poc-approved`) in the prompt. Without that, refuse and stage the diff under `analysis/clif-protected-edits/`.

## 9. Federated analysis pattern

- Develop on MIMIC-IV converted to CLIF format (`CLIF-MIMIC` pipeline) or on local CLIF data.
- Ship the analysis script via PR; each site runs it locally and returns aggregate results.
- Validate site-portability: scripts must read paths from `config/config.json`, not hardcoded paths; must not assume a particular OS or filesystem; must list dependencies in `renv.lock` (R) or `uv.lock` / `pyproject.toml` (Python) with project-controlled versions.
- **Distinguish aggregation targets:**
  - **Two-stage meta-analysis:** sites submit reviewed aggregate effects and same-scale uncertainty under a common estimand/model contract. Validate compatibility, independence, convergence, and site dispositions before pooling. REML is one justified estimator, not an asserted consortium-wide mandate.
  - **Federated model estimation:** iterative distributed likelihood/gradient methods or a prespecified hierarchical model require a separate algorithm and validation. Averaging site coefficients or intercepts does not rescue failed rare-outcome models and is not equivalent to fitting a global model.
- For formal site-to-lead or literature synthesis, use `method-clif-meta-analysis`; it covers aggregate contracts, failed/suppressed sites, R/Python estimator differences, and lead-to-site feedback.
- Site output files follow `{SITE_ID}_{descriptor}.{ext}` naming. The site identifier is always the prefix.
- Keep aggregation separate from patient-level analysis. Use the project's approved layout; do not assert that a separate repository is universally required.

### Consortium project lifecycle (clif-icu.com)

1. **Scope:** check feasibility against each site's IRB cohort criteria and data windows; propose through the consortium's proposal form or contact channel on clif-icu.com.
2. **Code:** build from `CLIF-Project-Template` and develop on CLIF-MIMIC or demo data.
3. **Buddy test:** one other site runs the project end to end and records the buddy-test report; data-security failures block release.
4. **Preliminary results report:** methods summary, results summary, aggregated Table 1, and two primary figures before consortium release.
5. **Share:** the PI releases the project to sites, which return only `output/final_no_phi/`.

For a full repository audit against these rules, use `method-clif-audit`.

## 9b. Staged data loading

Load tables in stages to manage memory — never load the full labs or vitals table before filtering:

1. Load `patient` and `hospitalization` tables first.
2. Apply inclusion/exclusion criteria to produce a vector of `hospitalization_id` values.
3. Load specialty tables (`vitals`, `labs`, `respiratory_support`, `medication_admin_continuous`) filtered to those IDs via semi-join or IN-filter.
4. Only then `collect()` into memory.

## 9c. Hybrid Python + R pipeline

Some consortium projects use Python for data wrangling and R for statistical modeling, connected by intermediate parquet:

- Python may create patient-level working data only in `output/intermediate_phi/`; R may read it locally for causal inference (IPTW, MSM, competing risks).
- The final R output is aggregate-only and belongs in `output/final_no_phi/`.
- This pattern leverages DuckDB/Polars speed for large table joins and R's superior causal inference ecosystem.

## 10. Common pitfalls (codified from `CLIF_CLAUDE.md` and observed in consortium repos)

### Clinical data pitfalls
- Do not use `hospital_diagnosis` (billing diagnoses) as a predictor — finalized after discharge, prone to leakage.
- `medication_admin_continuous` has no end time. End is inferred from `med_dose == 0` or the next administration. Do not assume a fixed duration.
- `lab_value` may be non-numeric (e.g., `"> upper limit"`, `"<0.01"`). Use `lab_value_numeric` for arithmetic; preserve `lab_value` for QC.
- `mar_action_group == "administered"` is the only value that means the medication was given. `not_administered` and `other` must be filtered out before exposure analyses.
- `ADT.location_category` is a *physical* location, not a patient-status flag. ICU presence is `location_category == "icu"`.
- `device_category == "IMV"` is invasive ventilation; `NIPPV`, `CPAP`, `High Flow NC`, `Face Mask`, `Trach Collar`, `Nasal Cannula`, `Room Air`, `Other` are non-invasive or no support. These are CLIF 2.1 spellings; CLIF 3.0 uses lowercase snake_case (`imv`, `nippv`, `cpap`, `hfnc`, `face_mask`, `trach_collar`, `nasal_cannula`, `room_air`, `other`, plus `t_piece` and `blow_by`). Never collapse these silently, and never compare against the other family's spelling.
- `lab_value_numeric` is optional; when it is absent or null, parse `lab_value` and report how many values were unparseable.

### R coding pitfalls
- **`large_utf8` Arrow type breaks cross-site joins.** Some ETL implementations produce `large_utf8` instead of `utf8`. Joins between the two fail silently. Always `cast_large_utf8_to_utf8()` after `open_dataset()`.
- **`ifelse()` drops attributes.** Use `data.table::fifelse()` or `dplyr::if_else()`.
- **`fill()` direction must be explicit.** Always `group_by(patient_id)` before `fill()` and specify `.direction`. Omitting bleeds values across groups.
- **Timezone mismatch.** Always pass `tz = config$timezone` to `as.POSIXct()`, then convert to UTC with `lubridate::with_tz()`.
- **Namespace collisions.** Arrow and dplyr both export `filter` and `select`. Declare `select <- dplyr::select` at script top.

### Python coding pitfalls
- **Outlier handling is clifpy's job.** Use `apply_outlier_handling` on the table object before the respiratory waterfall — do not hardcode or fork thresholds.
- **Do not reimplement clifpy.** SOFA (prefer SOFA-2), the respiratory waterfall, dose conversion, encounter stitching, wide/hourly datasets, ASE, and comorbidity indices ship in `clifpy`. Load the `method-clifpy` skill for verified signatures and pitfalls.
- **Prefer polars for large tables.** `pl.scan_parquet()` for lazy evaluation on vitals/labs (often >50M rows). Pandas `read_parquet()` loads everything into memory.
- **uv is the current Python default.** Newer CLIF Python projects use `uv` with `pyproject.toml` and `uv.lock` for environment management. Check for `uv.lock` before suggesting `pip install`; use `uv add` / `uv sync` when the project already uses uv.

### Statistical modeling pitfalls
- **Never include SOFA as a propensity score covariate when its components are already in the model.** SOFA is a composite of respiratory, coagulation, hepatic, cardiovascular, renal, and neurological sub-scores. Including both creates collinearity. Display SOFA in Table 1 but exclude from propensity models.
- **Variables with fewer than 2 unique values at a site must be excluded from propensity models dynamically.** Small sites may have zero variance in some covariates — the model will fail or produce infinite weights.
- **Age cap at 119 years.** Any age > 119 is treated as a data error and set to NA.

### Output conventions
- **Two-tier output directory:** `output/intermediate_phi/` is local, gitignored patient-level working data; `output/final_no_phi/` holds aggregate site-submitted artifacts. Only `final_no_phi/` contents are shared.
- **CONSORT flow as a running dictionary.** Track exclusion counts at every filtering step — update the dictionary inline, not as a post-hoc summary. Save as both CSV and embedded in the QC report.
- **Sensitivity analysis naming.** Use a letter suffix on the parent step number (e.g., `06b_sensitivity_analysis.R`), not a new step number. This keeps the main pipeline numbering stable.

## 11. Reporting checklist defaults under CLIF profile

- Observational cohort study on CLIF data → STROBE + RECORD (EHR extension).
- Prediction model on CLIF data → TRIPOD+AI.
- Target trial emulation → TARGET (primary), with STROBE + RECORD as companions.
- RCT using CLIF for outcome ascertainment → CONSORT.

`method-checklist` should pre-fill the routing answer with these defaults when CLIF profile is active and the user has not specified otherwise.

## 12. References (read-only, cite as needed)

- CLIF official site and data dictionary: https://clif-icu.com/
- CLIF data dictionary v2.1.0: https://clif-icu.com/data-dictionary/data-dictionary-2.1.0
- CLIF GitHub (main): https://github.com/Common-Longitudinal-ICU-data-Format/CLIF
- CLIF WORKFLOW.md: https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/blob/main/WORKFLOW.md
- mCIDE directory: https://github.com/Common-Longitudinal-ICU-data-Format/CLIF/tree/main/mCIDE
- **clifpy** (official Python client, PyPI: `python3 -m pip install --upgrade clifpy`; uv projects: `uv add clifpy`): https://github.com/Common-Longitudinal-ICU-data-Format/clifpy — examples in `examples/`, docs at https://common-longitudinal-icu-data-format.github.io/clifpy/
- **CLIF-Project-Template** (Python and R skeleton with `code/`, `config/`, `guides/`, `output/`, `utils/`, and a buddy-test report template): https://github.com/Common-Longitudinal-ICU-data-Format/CLIF-Project-Template
- CLIF-MIMIC pipeline (MIMIC -> CLIF): https://github.com/Common-Longitudinal-ICU-data-Format/CLIF-MIMIC
- CLIF Lighthouse (validation tool; the repository is now `CLIF-Lighthouse-Deprecated`, superseded by CLIF-TableOne and `clifpy` DQA even though some site pages still mention it): https://github.com/Common-Longitudinal-ICU-data-Format/CLIF-Lighthouse-Deprecated
- CLIF consortium agent plugin (`clif-icu` skill, PHI hooks, reviewer agents; Apache-2.0): https://github.com/Common-Longitudinal-ICU-data-Format/skills. It can be installed alongside methodsmith; when both are active, follow the stricter output rule and the user's declared sensitive-data boundary.
- Consortium site and contact channels: https://clif-icu.com/
- CLIF GitHub organization (issues and discussions): https://github.com/Common-Longitudinal-ICU-data-Format
