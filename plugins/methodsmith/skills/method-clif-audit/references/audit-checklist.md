# CLIF Audit Checklist

## Contents

- A. Version and vocabulary (CA-01 to CA-05)
- B. Structure (CA-10 to CA-14)
- C. Environment (CA-20 to CA-26)
- D. Config (CA-30 to CA-35)
- E. clifpy usage (CA-40 to CA-49)
- F. Timezone (CA-50 to CA-53)
- G. Outputs and disclosure (CA-60 to CA-71)
- H. Reproducibility and release (CA-80 to CA-85)
- I. Code health (CA-90 to CA-95)

Each check lists what passes and what makes it a block (B) or a warning (W).
Every finding needs `file:line` or a path. Checks come from the CLIF website
(clif-icu.com), `CLIF-Project-Template`, `clifpy` 2.1.0 source, and recurring
defects in an October 2026 review of the consortium's project repositories.

## A. Version and vocabulary

- **CA-01 Version declared.** README or config names the CLIF data-dictionary version. W if absent; B for distribution.
- **CA-02 Family consistent.** Data dictionary and mCIDE are the same family (2.1 + 2.1 or 3.0 + 3.0), and `clif_version` passed to `clifpy` matches. B if mixed or contradictory.
- **CA-03 Category literals match the family.** Every `*_category` literal in filters, `case_when`, or `isin` exists in the selected vocabulary: 2.1 uses `IMV`, `High Flow NC`, `Room Air`; 3.0 uses lowercase snake_case (`imv`, `hfnc`, `room_air`, `l_and_d`). Case-sensitive comparisons against the other family's spelling match zero rows. B.
- **CA-04 3.0 analytics.** A 3.0 project that calls legacy SOFA, `compute_sofa_polars`, SOFA-2, or the waterfall handles their 2.1-spelled device heuristics (installed fix, or a recorded analytic-only mapping). B if neither.
- **CA-05 Optional fields.** Code tolerates absent `hospitalization_joined_id` and null `lab_value_numeric` (falls back to parsing `lab_value`, or documents exclusion). W.

## B. Structure

- **CA-10 Template layout.** `code/` with numbered steps, `config/` with a committed template, `utils/`, `output/final_no_phi/`, and gitignored `output/intermediate_phi/`. W per missing element; B if shared results go anywhere other than `output/final_no_phi/`.
- **CA-11 README completeness.** Objective, CLIF version, required tables and fields, cohort criteria, expected aggregate outputs, environment setup, and run order. W per missing item.
- **CA-12 Step order.** Cohort, then quality checks, then outlier handling, then analysis. Outlier handling runs before the respiratory waterfall or any forward fill; running it after propagates implausible values. B if after.
- **CA-13 Dead and variant code.** `archive/`, `older/`, paired `.py`/`.ipynb` copies, or dated notebook variants on the run path. W.
- **CA-14 Language examples.** R projects use `arrow::open_dataset()` with filtering before `collect()`; Python projects use `clifpy` or lazy polars for large tables. W.

## C. Environment

- **CA-20 Lockfile.** `uv.lock` (Python) or `renv.lock` (R) committed. B if no dependency specification at all; W if a spec without a lock.
- **CA-21 clifpy pin.** Exact pin in `pyproject.toml` (or requirements) and the lock resolves to the same version. W for a floor-only pin; B if pin and lock disagree.
- **CA-22 API exists in the pin.** Every imported `clifpy` symbol exists in the pinned version (for example `compute_ase`, `run_full_dqa`, `calculate_sofa2` are absent from early 0.x releases). B.
- **CA-23 Python version.** `requires-python` or `.python-version` is 3.10 or newer when dose conversion or SOFA-2 is used (both fail to import on 3.9). W.
- **CA-24 R installs.** No `install.packages()` at run time; `renv::restore()` from the lock. W.
- **CA-25 Runner.** Run script uses `set -euo pipefail` (or the PowerShell equivalent), `uv sync --locked` or `renv::restore()`, and a config preflight. `set -e` with `| tee` and no `pipefail` hides failures. W.
- **CA-26 Forks and git pins.** `clifpy` installed from a personal fork, branch, or deleted ref. W; B if the ref no longer resolves.

## D. Config

- **CA-30 Site config not committed.** `config/config.json` (or `.yaml`) is gitignored and only a template is tracked. B if a real site config is tracked.
- **CA-31 clifpy-compatible keys.** Config uses `data_directory` (or YAML `tables_path`), `filetype`, `timezone`, and optionally `output_directory` and `clif_version`, so it passes straight to `ClifOrchestrator(config_path=...)`. W for ad-hoc keys (`clif_folder`, `time_zone`, `file_type`, executable `.py` configs).
- **CA-32 No personal paths.** No user-home, HPC, or institution paths in tracked files, templates, or notebook metadata. W.
- **CA-33 Quoted version.** `clif_version` is a quoted string. An unquoted YAML `3.0` is a float; `clifpy` then loads no schema, `validate()` does nothing, and `isvalid()` returns `True`. B.
- **CA-34 Template parses.** Config templates are valid JSON or YAML (no trailing commas). B.
- **CA-35 Site timezone.** Timezone comes from site config. B if hard-coded to one site or forced to `UTC` for all sites.

## E. clifpy usage

- **CA-40 Reimplementations.** Hand-written SOFA, outlier handling or forked `outlier_config.yaml`, waterfall, dose conversion, stitching, wide or hourly building, ASE, comorbidity maps, or tz helpers where `clifpy` ships the capability. W each; B for divergent vendored copies or a reimplementation without tests that feeds a shared estimate. Accepted gaps: norepinephrine equivalents outside SOFA-2, CRRT episode fill, encounter-block keys for utilities that only accept `hospitalization_id`, R projects (no `clifpy`).
- **CA-41 Bounded loads.** `initialize`, `from_file`, and `load_data` pass `filters` and `columns`; every table in `create_wide_dataset(tables_to_load=...)` is preloaded with filters (otherwise it loads unfiltered). W.
- **CA-42 Raw reads.** Direct `pd.read_parquet` or `pl.read_parquet` of CLIF tables with a hard-coded extension, bypassing `clifpy` tz and ID normalization. W.
- **CA-43 Dose conversion.** Preferred units cover every drug the downstream step needs (legacy SOFA needs norepinephrine, epinephrine, dopamine, and dobutamine in `mcg/kg/min`), and rows with `_convert_status != "success"` are filtered or reported, including after `override=True`. B if failed rows feed analysis.
- **CA-44 SOFA.** New work uses SOFA-2 (`calculate_sofa2`) or justifies legacy SOFA; scores use explicit windows (`start_dttm`/`end_dttm` for SOFA-2 and polars, `start_time`/`end_time` for legacy); a baseline covariate is not scored over the whole stay. B for whole-stay scores used as baseline covariates.
- **CA-45 Stitching.** Window set through `ClifOrchestrator(stitch_encounter=True, stitch_time_interval=...)` and justified when not 6 hours; no re-stitch after replacing only one of hospitalization or ADT. W.
- **CA-46 Wide and hourly.** Code asserts that the expected hospitalization count survives (failed batches drop silently), reads `co.wide_df` (the method returns `None`), and treats hourly windows as anchored to each stay's first event. W.
- **CA-47 Private state.** No reassignment of orchestrator internals (`df_converted`, `resp.df`, `stitch_time_interval` after init) and no imports of private constants such as `DEVICE_RANK_DICT`. W.
- **CA-48 Report APIs.** `generate_text_report(results, table_name, path)` with the directory created first; `run_full_dqa` results read as dicts. W.
- **CA-49 Shadowed names.** Local functions named like `clifpy` functions with a different contract (a local `apply_outlier_handling` that returns a frame versus `clifpy`'s in-place version). W.

## F. Timezone

- **CA-50 No silent stripping.** No `tz_localize(None)`, `replace(tzinfo=None)`, or `dt.replace_time_zone(None)` after loading, unless a documented local-time convention follows. B when the result feeds windows, day counts, or hourly bins.
- **CA-51 DuckDB session zone.** No global `SET TimeZone` monkeypatch without restoring it; `clifpy` sets the process-wide DuckDB connection to UTC on load. W.
- **CA-52 Calendar boundaries.** Day, shift, and midnight boundaries name their zone. W.
- **CA-53 DST.** No `ambiguous=True` or `ambiguous="infer"` on site-local data without a test; prefer UTC arithmetic. W.

## G. Outputs and disclosure

- **CA-60 Export gate.** Every write to `output/final_no_phi/` passes through one function that enforces the small-cell rule and fails closed (raises, does not warn or `assert`). B if absent while counts are shared; B if suppression can be switched off in config.
- **CA-61 Threshold.** Suppress any count of 10 or fewer (clif-icu.com FAQ: more than 10 patients per cell), or a stricter site or DUA rule. B for thresholds below 10 or "no suppression"; W for the template's `< 10`.
- **CA-62 Complements.** Totals, percentages, or differences cannot back-calculate a suppressed cell. W.
- **CA-63 Extremes.** No min, max, or other single-patient values in shared outputs (`describe()` output, ranges). B.
- **CA-64 Identifiers and dates.** No `*_id`, `*_dttm`, `birth_date`, or row-level columns in shared outputs. B.
- **CA-65 Committed data.** `git ls-files` shows no Parquet, CSV, Feather, RDS, `.RData`, or `.Rhistory` with patient data, and no executed notebooks whose outputs show row-level frames. B. Report paths only; public demo data (`clif_demo`, CLIF-MIMIC demo) passes when labelled.
- **CA-66 Notebook hygiene.** `nbstripout` or marimo `.py` notebooks. W.
- **CA-67 Logs.** stdout and logs are not tee'd into `output/final_no_phi/`. B.
- **CA-68 Model objects.** Exported models drop row-level slots (R `glm` `$y`, `$residuals`, `$fitted.values`, `$qr`, `$model`; Python estimators with stored training data). B.
- **CA-69 clifpy artifacts.** `clifpy` `output_directory`, logs, `validation_errors_*.csv`, DQA JSON/PDF (may carry sample IDs and raw invalid strings), ECDF and summary files, and DuckDB spill directories are gitignored and outside shared folders. B if they can land in a tracked or shared path.
- **CA-70 Data directory.** Derived tables are not written into the CLIF data directory. W.
- **CA-71 Site naming.** Shared files use a site prefix (`{SITE}_{descriptor}.{ext}`) from config. W.

## H. Reproducibility and release

- **CA-80 Tests.** Non-trivial derivations have tests that run on demo or synthetic data. W.
- **CA-81 CI.** At least a locked install and a demo-data smoke run. W.
- **CA-82 Seeds.** Sampling and resampling set seeds (`create_wide_dataset(sample=True)` is unseeded). W.
- **CA-83 Provenance.** A run manifest records `clifpy` version, CLIF version, site timezone, and key parameters. W.
- **CA-84 Buddy test.** A passing buddy-test report from an independent site. B for distribution readiness.
- **CA-85 Preliminary report.** Before release, a methods summary, results summary, aggregated Table 1, and two primary figures (clif-icu.com project lifecycle). W.

## I. Code health

- **CA-90 Swallowed errors.** No bare `except: pass` or `except: continue` around loads or per-site steps; no blanket `warnings.filterwarnings("ignore")`. B when it can drop data silently; W otherwise.
- **CA-91 Site branches.** No `if site == ...` or MIMIC-only branches in shared logic; site differences come from config. W.
- **CA-92 Copy-paste variants.** Parameterize instead of duplicating scripts per subgroup or date. W.
- **CA-93 Path hacks.** No `sys.path` edits, `setwd()`, or cwd-relative config loading. W.
- **CA-94 Monoliths.** Scripts over about 2,000 lines are split by step. W.
- **CA-95 License.** A LICENSE file exists for consortium sharing. W.
