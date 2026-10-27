# clifpy Pitfalls

## Contents

- Version handling (items 1-5)
- Mutation and silent behavior (items 6-20)
- Timezones (items 21-26)
- Performance (items 27-29)
- Logging and output locations (items 30-31)
- PHI exposure surfaces (items 32-35)
- Upstream docs and README defects (items 36-40)

Verified against `clifpy` 2.1.0 (2026-10-14). Citations are `path:line` in the
clifpy repository. Re-check an item before relying on it with another version.



**Version handling**
1. The default is **2.1**. Data in 3.0 format loaded without `clif_version="3.0"` is validated against 2.1 vocabulary.
2. **An unquoted YAML `clif_version: 3.0` is parsed as a float.** The float is passed through unchanged (`clif_orchestrator.py:235`), and `load_schema` raises `ValueError`. `BaseTable._load_schema` catches that error (`base_table.py:152-167`), so `schema=None`. `validate()` then does **nothing**, and `isvalid()` returns `True`. The same silent pass happens for any typo (for example `"3"`). Always quote the value, and assert `co.<table>.schema is not None`.
3. If you pass `data_directory`, `filetype`, and `timezone` together, the config file is ignored, including its `clif_version` and `output_directory` (`config.py:203`).
4. **Analytics hard-code CLIF 2.1 category spellings:**
   - Legacy SOFA: `DEVICE_RANK_DICT` uses `'IMV','High Flow NC','Room Air',...` and `sofa_resp` uses `IN ('IMV','NIPPV','CPAP')` (`sofa.py:35-46,172-173`). The same applies to `sofa_polars.py:56-66`. On 3.0 data (`imv`) or after the waterfall (which lowercases), ventilated patients never score 3 or 4 on the respiratory component.
   - SOFA-2 resp lowercases but compares against `'room air'`, `'nasal cannula'`, and `'high flow nc'` (`sofa2/_resp.py:266,268,279`). Under 3.0 (`room_air`, `nasal_cannula`, `hfnc`), FiO2 imputation for room air and nasal cannula, and HFNC "advanced support", silently do not fire.
   - The waterfall heuristics compare against `"nasal cannula"`, `"room air"`, and `"trach collar"` (`waterfall.py:246,317,337`), with the same effect on 3.0 data.
   - The ASE IMV logic uses `LOWER(device_category)='imv'`, which works for both versions.
5. `EcmoMcs` under 3.0 loads the `mcs` schema, but `outlier_config.yaml` has only an `ecmo_mcs` key, and the SOFA-2 ECMO loader reads the file `clif_ecmo_mcs.*` (`sofa2/_core.py:66`).

**Mutation and silent behavior**
6. `run_stitch_encounters()` replaces `hospitalization.df` and `adt.df`. Re-running it while `encounter_block` is already present produces `encounter_block_x`/`_y` columns, because the final merge is on the full input frame (`stitching_encounters.py:165`). Reload the source tables before restitching. Stitching errors are swallowed, and the mapping is set to `None`.
7. `get_encounter_mapping()` and `compute_sofa_scores(id_name='encounter_block')` (the default) trigger stitching and may **load full unfiltered hospitalization and ADT tables**.
8. `compute_sofa_scores()` overwrites `co.wide_df`. `create_wide_dataset(cohort_df=...)` mutates `cohort_df`. `create_wide_dataset` adds `assessment_value` to `patient_assessments.df`.
9. Dose conversion may set `co.vitals` to a **weight-only** table (`clif_orchestrator.py:1188`). If `co.vitals` was loaded earlier without `weight_kg`, weight-based conversions fail with `_convert_status = 'cannot convert to a weighted unit if weight_kg is missing'`.
10. `apply_outlier_handling` replaces `.df`, acts on **raw** `med_dose` keyed by `med_category` and unit, not on `df_converted`, and uses `print`. The `fio2_set` range is 0.21 to 1.0 (`outlier_config.yaml:665-667`), so FiO2 stored as a percentage is nulled entirely. Rescale it first.
11. `Labs.standardize_reference_units()` defaults to `inplace=True`.
12. `initialize()` catches `ValueError` per table and only logs a warning, so a typo in a table name means the table is silently skipped.
13. **Wide/hourly batches fail silently.** An exception in a batch is logged, and the batch is skipped with `continue` (`wide_dataset.py:1546-1548` for wide, `:770-772` for hourly). Hospitalizations can be lost without any error. Assert that `wide_df.hospitalization_id.nunique()` matches the expected count.
14. `create_wide_dataset(sample=True)` uses an **unseeded** `np.random.choice` (`wide_dataset.py:252`).
15. The wide pivot keys rows by `hospitalization_id || strftime(ts,'%Y%m%d%H%M')`, and `first(value)` keeps one value per minute and category (`wide_dataset.py:1300-1301`). Same-minute duplicates are collapsed arbitrarily.
16. Legacy `compute_sofa` uses `MAX(COLUMNS([...]))` over fixed names. If **any** of `norepinephrine_mcg_kg_min`, `epinephrine_mcg_kg_min`, `dopamine_mcg_kg_min`, `dobutamine_mcg_kg_min`, `fio2_set`, `creatinine`, `bilirubin_total`, `map`, `spo2`, `po2_arterial`, `platelet_count`, or `gcs_total` is absent from the wide frame (for example no dobutamine in the cohort, or a pressor left unconverted), it raises a DuckDB `BinderException` **[verified with duckdb]**. The cohort columns are `start_time`/`end_time`, while SOFA-2, `compute_sofa_polars`, and MDRO use `start_dttm`/`end_dttm`.
17. `MedicationAdminContinuous.resolve_mar_action_duplicates()` is a no-op stub. MAR action de-duplication (for example rate changes and stops) is the caller's job.
18. Comorbidity uses **all ICD10CM codes regardless of POA** and drops non-ICD10CM codes. Hospitalizations with no qualifying code are absent from the output. MDRO cohort filtering uses `result_dttm` first (`mdro_flags.py:354`), which is a post-collection time.
19. `RespiratorySupport.waterfall()` returns an object that reverts to `clif_version` 2.1. Its output contains synthetic scaffold rows (`is_scaffold=True`).
20. `SOFA2Config.post_sedation_gcs_invalidate_hours`: the docstring says the default is 1.0, but the code default is **12.0** (`sofa2/_utils.py:39` vs `:77`). Set it explicitly and report it.

**Timezones**
21. The `timezone` setting is a *display/relabel* zone, not a storage-zone override. Naive storage is assumed to already be in `timezone` (`io.py:697`). If naive local data is loaded with a different `timezone`, the instants shift by the offset (`docs/tz_dx.md` Matrix B).
22. Every eager load runs `duckdb.execute("SET timezone='UTC'")` on DuckDB's **process-wide default connection** (`io.py:332,573`), which changes the zone for any `duckdb.sql()` the user runs in the same process.
23. `convert_wide_to_hourly` **strips tzinfo** (`tz_localize(None)`, `wide_dataset.py:433`). Windows are naive site-local wall-clock, start at **each group's first event** (not on clock hours), and are DST-naive.
24. pytz's DST table freezes at about 2037. Far-future shifted dates (CLIF-MIMIC) use a fixed offset, which is intentional (`docs/tz_dx.md` section 11).
25. `compute_ase` sets the DuckDB TimeZone from config. Its `config_path` is parsed with `json.load`, so **YAML configs crash** (`ase.py:1634-1635`). Use JSON or pass `data_directory`/`filetype`/`timezone`.
26. The tz mislabel of `admin_dttm` after dose conversion (issue #144) is fixed: the converter captures and restores input zones (`unit_converter.py:1394`, `docs/tz_dx.md` section 9). Re-check `df_converted["admin_dttm"].dt.tz` after upgrading.

**Performance** (`docs/duckdb_perf_guide.md`)
27. Push `columns` and `filters` into `initialize`/`load_data` (they become the parquet scan predicate). Use `return_rel=True` or `lazy=True` for very large tables. `DuckDBResourceConfig` (`memory_limit`, `temp_directory`, `max_temp_directory_size`, `batch_size`, `threads`) bounds SOFA-2. Its batching reloads the tables for each batch.
28. Defaults that spill or temp to unsafe locations: DuckDB spills to `.tmp` in the **cwd** (`_duckdb_config.py` docstring), and `convert_wide_to_hourly` uses `/tmp/duckdb_temp` with `threads=4` hard-coded (`wide_dataset.py:466-468`). Spill files contain row-level data.
29. `filters` lists become SQL `IN ('a','b',...)` literals with no quote escaping on the parquet path. Very large ID lists produce very large SQL strings.

**Logging and output locations**
30. `setup_logging` runs on **every** orchestrator and table construction and resets the `clifpy` handlers and level (`logging_config.py:114`). Custom logging configuration is clobbered. Logs: `<output_directory>/logs/clifpy_all.log` and `clifpy_errors.log` (append mode), plus `validation_log_<table>.log` (overwritten), plus stdout. The migration runner logs to `<output_dir>/logs/crosswalk_2.1_to_3.0_<ts>.log`.
31. `output_directory` defaults to `<cwd>/output`, which is created even when you never ask for output. In a git repo this is an easy way to commit artifacts.

**PHI exposure surfaces** (relevant to approved-boundary work)
32. Files written with **row-level or extreme values**:
    - `calculate_stratified_ecdf(save=True)`: every value.
    - `Adt.check_overlapping_admissions(save_overlaps=True)`: overlapping rows.
    - `create_wide_dataset(save_to_data_location=True)`: the full wide frame, written into the **data** directory.
    - `save_summary()` and `get_summary()`: `describe()` min/max.
    - `report_generator.compute_table_stats`: min/max of DATETIME and DATE columns, such as `birth_date` and `death_dttm`. It is only printed if the caller adds `validation_data['table_stats']`.
33. DQA payloads include **sample IDs**: `run_cross_table_completeness_checks*` put up to 10 `patient_id`/`hospitalization_id` values in `details["sample_ids"]` (`validator.py:6986,7149`). Categorical checks include up to 20 raw invalid category strings, with counts (`validator.py:2274,2393`), which can leak free text placed in the wrong column. `str(e)` error messages can echo values. Treat DQA JSON, PDF, and CSV output as restricted until it has been reviewed.
34. Logs: `Invalid encounter blocks found: {invalid_blocks}` writes IDs to the log (`clif_orchestrator.py:655`). ASE `verbose=True` prints fluid-category counts. The rest of the logging is mostly counts and shapes.
35. `validate()` writes `validation_errors_<table>.csv` to `output_directory`. This file contains the error dicts, so the same caveats as item 33 apply.

**Docs and README defects** (do not copy these examples)
36. `README.md`: `ClifOrchestrator(data_directory=..., timezone=...)` without `filetype` falls back to config auto-detect and fails without a cwd config. It also says "`wide_df = orchestrator.create_wide_dataset()` hourly resolution", but the call returns `None` and the data is event-level.
37. `docs/user-guide/validation.md`:
    - `result.passed` is shown on `run_full_dqa` output, which is a dict.
    - `ClifOrchestrator("/data", "parquet", ...)` passes the data directory positionally into the `config_path` slot.
    - `orchestrator.tables` and `validation_status` do not exist.
    - It claims "DQA is run during initialization", which is false.
    - `generate_*_report(results, output_path=...)` omits the required `table_name`.
38. `docs/user-guide/sofa.md`: the orchestrator path is shown without first converting pressors to `mcg/kg/min`, which causes a `BinderException` (item 16).
39. `comorbidity-index.md` and the docstrings say "pandas", while the annotations say polars. The runtime returns pandas. The docs install `clifpy[docs]`, but no such extra exists.
40. `encounter-stitching.md` says "gap less than window", but the code links stays when gap ≤ window.
