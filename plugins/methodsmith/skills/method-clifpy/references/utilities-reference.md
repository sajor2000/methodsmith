# clifpy API Reference: Utilities

## Contents

- io, io_polars, datetime_polars, config
- wide_dataset, unit_converter, outlier_handler, stitching_encounters, waterfall
- SOFA (legacy, polars, SOFA-2), ASE, comorbidity, MDRO
- crosswalk and 2.1 to 3.0 migration, query
- validator (DQA), report_generator, rule_codes, logging, demo data

Verified against `clifpy` 2.1.0 (2026-10-14). R = exported at the `clifpy` root,
U = exported from `clifpy.utils`. Citations are `path:line` in the clifpy repository.

## Utilities

**io** (`utils/io.py`)
- `load_data(table_name, table_path=None, table_format_type=None, sample_size=None, columns=None, filters=None, site_tz=None, verbose=False, return_rel=False, lazy=False, config_path=None)` returns a DataFrame, a `DuckDBPyRelation` (`return_rel`, parquet only; CSV warns and falls back), or a `LazyRelation` (`lazy`). The two flags are mutually exclusive. [R,U] (L417)
- `fetch_lazy_result(rel, cast_ids=True, site_tz=None, close_connection=True, verbose=False) -> DataFrame`, `close_lazy_relation(rel)`, `class LazyRelation(relation, connection)` with `.close()` [U].
- `convert_datetime_columns_to_site_tz(df, site_tz_str, verbose=True) -> DataFrame` acts on every column whose name contains `dttm`. Aware columns are `tz_convert`-ed; naive columns are `tz_localize`-d (and logged as a warning) (L623-697) [U].
- `load_parquet_with_tz(file_path, columns=None, filters=None, sample_size=None, site_tz=None, verbose=False, return_rel=False, lazy=False)`. `io.load_config(file_path)` is a raw YAML reader, distinct from `config.load_config`.
- `filters` semantics: `{col: value}` becomes `col = 'value'`, and `{col: [v,...]}` becomes `col IN (...)`. Values are string-quoted, and the parquet path **does not escape quotes** (`io.py:321,350`). Conditions are combined with AND. There are no ranges or time filters.

**io_polars / datetime_polars**
- `load_data_polars(table_name, table_path, table_format_type, sample_size=None, columns=None, filters=None, site_tz=None, lazy=True, verbose=False) -> pl.DataFrame|pl.LazyFrame` [R]
- `load_clif_table_polars(data_directory, table_name, filetype='parquet', hospitalization_ids=None, columns=None, site_tz=None, lazy=True)` [R]
- `load_parquet_polars(...)`, `load_csv_polars(...)` (same kwargs as `load_data_polars` minus table name)
- `standardize_datetime_columns(df, target_timezone, target_time_unit='ns', ambiguous='earliest', non_existent='null', datetime_columns=None)` [R as `standardize_datetime_columns_polars`]
- `ensure_datetime_precision_match(df1, df2, df1_datetime_col, df2_datetime_col, target_timezone, target_time_unit='ns')` [R as `..._polars`]
- `convert_datetime_columns_to_site_tz(df, site_tz_str, verbose=True)` (polars) [R as `..._polars`]. `standardize_datetime_for_comparison(col: pl.Expr, target_timezone, target_time_unit='ns') -> pl.Expr`.

**config** (`utils/config.py`): `load_config(config_path=None) -> Dict` [R,U], `get_config_or_params(config_path=None, data_directory=None, filetype=None, timezone=None, output_directory=None)` [U], `create_example_config(...)` [U].

**wide_dataset** (`utils/wide_dataset.py`)
- `create_wide_dataset(clif_instance, optional_tables=None, category_filters=None, sample=False, hospitalization_ids=None, cohort_df=None, output_format='dataframe', save_to_data_location=False, output_filename=None, return_dataframe=True, base_table_columns=None, batch_size=1000, memory_limit=None, threads=None, show_progress=True) -> DataFrame|None` (L103) [R,U]. `optional_tables` and `base_table_columns` are marked DEPRECATED in the docstring, but the orchestrator still passes `optional_tables=tables_to_load`. `cohort_df` needs `hospitalization_id, start_time, end_time` (L190) and **is mutated in place** (`hospitalization_id` is cast to str, times to datetime; L196-201). Supported tables and pivot/wide types are defined in `schemas/wide_tables_config.yaml`.
- `convert_wide_to_hourly(wide_df, aggregation_config, id_name='hospitalization_id', hourly_window=1, fill_gaps=False, memory_limit='4GB', temp_directory=None, batch_size=None, timezone='UTC') -> DataFrame` (L325) [R,U]. `hourly_window` must be an int from 1 to 72. Aggregations are `max`, `min`, `mean`, `median`, `first`, `last`, `boolean`, and `one_hot_encode`, and output columns get suffixes such as `<col>_mean` and `<col>_boolean`. Output keys: `id_name, window_number, window_start_dttm, window_end_dttm, patient_id, day_number`. `wide_df` requires `event_time, id_name, day_number`.

**unit_converter** (`utils/unit_converter.py`)
- `convert_dose_units_by_med_category(med_df, vitals_df=None, preferred_units=None, show_intermediate=False, override=False, return_rel=False, id_name='hospitalization_id', fallback_on_earliest=False) -> (converted, counts)` (L1301). It adds `med_dose_converted`, `med_dose_unit_converted`, and `_convert_status`. A pre-filled `weight_kg` in `med_df` is honored exactly, and otherwise the weight comes from an ASOF join on vitals `weight_kg`. Preferred units are `{mcg,mg,ng,g,ml,l,u,mu}[/kg|/lb][/hr|/min]`, written lowercase with no spaces (`ACCEPTABLE_RATE_UNITS`, L211). Categories without a preferred unit are converted to their **base unit** (`mcg/min`, `ml/min`, `u/min`, or `mcg`, `ml`, `u`).
- `standardize_dose_to_base_units(med_df, vitals_df=None, show_intermediate=False, id_name='hospitalization_id') -> (rel, rel)` (L854).
- `find_most_recent_weight(med_df, vitals_df, id_name='hospitalization_id', fallback_on_earliest=False) -> DuckDBPyRelation` (L759).

**outlier_handler**: `apply_outlier_handling(table_obj, outlier_config_path=None) -> None` (L18) [R,U] **replaces `table_obj.df`** with out-of-range values set to null and prints stats with `print()`. `get_outlier_summary(table_obj, outlier_config_path=None) -> Dict` (L579) [R,U] does not mutate.

**stitching_encounters**: `stitch_encounters(hospitalization, adt, time_interval=6) -> (hospitalization_stitched, adt_stitched, encounter_mapping)` (L7) [R,U]. Required hospitalization columns: `patient_id, hospitalization_id, admission_dttm, discharge_dttm, age_at_admission, admission_type_category, discharge_category`. Required ADT columns: `hospitalization_id, in_dttm, out_dttm, location_category, hospital_id`. A gap of `<= time_interval` hours (inclusive) links two stays. `encounter_block` is int32.

**waterfall**: `process_resp_support_waterfall(resp_support, *, id_col='hospitalization_id', bfill=False, verbose=True) -> DataFrame` (L8) [R,U].

**sofa (legacy)**: `compute_sofa(wide_df, cohort_df=None, extremal_type='worst', id_name='encounter_block', fill_na_scores_with_zero=True, remove_outliers=True) -> DataFrame` (L215) [U]. Constant `REQUIRED_SOFA_CATEGORIES_BY_TABLE` (L9). `extremal_type='latest'` raises `NotImplementedError`.

**sofa_polars**: `compute_sofa_polars(data_directory, cohort_df: pl.DataFrame, filetype='parquet', id_name='hospitalization_id', extremal_type='worst', fill_na_scores_with_zero=True, remove_outliers=True, timezone=None, time_unit='us') -> pl.DataFrame` (L953) [R]. The cohort needs `hospitalization_id, start_dttm, end_dttm`. Data is read straight from files, ignoring the config and `clif_version`.

**sofa2** (`utils/sofa2/`) [R]
- `calculate_sofa2(cohort_df, clif_config_path=None, return_rel=False, dev=False, *, sofa2_config=None, perf_profile=False, id_name='hospitalization_id', id_mapping=None, memory_limit=None, duckdb_config=None)` (`_core.py:232`) returns a DataFrame, a relation, or `(results, intermediates)` if `dev=True`.
- `calculate_sofa2_daily(cohort_df, clif_config_path=None, return_rel=False, *, sofa2_config=None, perf_profile=False, id_name='hospitalization_id', id_mapping=None, memory_limit=None, duckdb_config=None)` (`_core.py:719`). It splits windows of at least 24 h into whole days (partial days dropped). Day 1 missing is scored 0, and later days carry the last observation forward. Output adds `nth_day`.
- `@dataclass SOFA2Config` (`_utils.py:16-87`) fields: `resp_lookback_hours=6.0, liver_lookback_hours=24.0, kidney_lookback_hours=12.0, hemo_lookback_hours=24.0, pressor_min_duration_minutes=60, pf_sf_tolerance_hours=4.0, post_sedation_gcs_invalidate_hours=12.0, deprioritize_gcs_motor=False, rrt_carryforward_days=3, uo_first_measurement_baseline='window_start', uo_prewindow_lookback_hours=48.0`.
- `memory_limit` is deprecated in favor of `duckdb_config=DuckDBResourceConfig(memory_limit=None, temp_directory=None, max_temp_directory_size=None, batch_size=None, threads=None)` [R]. `DuckDBResourceConfig.from_system(memory_fraction=None)` is auto-applied on Windows.

**ase**: `compute_ase(hospitalization_ids=None, config_path=None, data_directory=None, filetype='parquet', timezone='UTC', apply_rit=True, rit_only_hospital_onset=True, include_lactate=False, verbose=True) -> DataFrame` (L1579) [U]. Step helpers are also public: `load_and_register`, `drop_tables`, `process_blood_cultures`, `calculate_qad`, `calculate_lab_dysfunction`, `calculate_clinical_interventions`, `combine_components_for_ase`, `apply_rit_post_processing(df, rit_days=14, only_hospital_onset=True)`.

**comorbidity**: `calculate_cci(hospital_diagnosis, hierarchy=True)` (L138) [R,U] and `calculate_elix(hospital_diagnosis, hierarchy=True)` (L17). Both accept a `HospitalDiagnosis` object, a pandas frame, or a polars frame. **Both return a pandas DataFrame** (`comorbidity.py:135,256`) even though they are annotated `-> pl.DataFrame`. CCI uses Quan 2011 with 17 conditions plus `cci_score`. Elixhauser uses Quan + van Walraven with 31 conditions plus `elix_score`. Code maps live in `data/comorbidity/{cci,elixhauser}.yaml`.

**mdro_flags**: `calculate_mdro_flags(culture, susceptibility, organism_name, cohort=None, hospitalization_ids=None, config_path=None) -> DataFrame` (L17). `culture` and `susceptibility` must be **table objects** (it reads `.df`). The config is in `data/mdro.yaml`, which currently defines **only `pseudomonas_aeruginosa`**. Output columns: `<abx>_agent`, `<group>_group`, and `mdro_<org>_{mdr,xdr,pdr,dtr}`.

**crosswalk** [R]: `normalize_category_value(value)`, `load_crosswalk(crosswalk_path=None)`, `crosswalk_table_2_1_to_3_0(df, table_name, crosswalk_path=None) -> (converted_copy, report)` (pandas or eager polars), `crosswalk_file_2_1_to_3_0(input_path, output_path, table_name, *, backend='duckdb', chunk_size=1_000_000, crosswalk_path=None) -> report`, and `BETA_TABLES` (16 tables).

**migrate_versions_2_1_to_3**: `CrosswalkMigrationRunner(config_path=None, data_dir=None, output_dir=None, filetype='parquet', log_dir=None)` with `.audit()` and `.run(dry_run=False) -> bool` (L105-171). Helper functions: `tz_map(path)`, `zones(tzmap)`, `summary(path, id_cols)`, `tz_status(src_tz, dst_tz)`.

**query** (internal/legacy): `lookup_extremal_values_in_long_table(ids_w_dttm, query_dict, table_name)` and `lookup_extremal_vital_values(ids_w_dttm, query_dict, vitals_df)`, which is marked "TODO: deprecate".

**validator** (`utils/validator.py`, 8k lines) [U]
- `run_full_dqa(df, schema=None, table_name='', tables=None, error_threshold=50.0, warning_threshold=10.0, hosp_years=None, plausibility_thresholds=None, clif_version='2.1') -> Dict` (L7457). `table_name` is required. When `schema` is `None`, the schema is loaded for `clif_version`. The return is `{table_name, clif_version, backend, conformance, completeness, relational, plausibility}`, and each check value is a **dict** (`to_dict()`) with `passed, errors, warnings, info, metrics, atomic_total, atomic_passed, check_type, clif_version`. `tables=[table objs]` adds the relational and cross-table plausibility checks.
- Single pillars: `run_conformance_checks(df, schema, table_name)`, `run_completeness_checks(df, schema, table_name, error_threshold=50.0, warning_threshold=10.0)`, `run_plausibility_checks(df, schema, table_name, hosp_years=None, plausibility_thresholds=None)`. These return **objects** (`DQA*Result` with `.passed`, `.errors`, ...).
- Cross-table: `run_relational_integrity_checks(tables)`, `run_cross_table_completeness_checks(tables)`, `run_cross_table_plausibility_checks(tables, plausibility_thresholds=None)`. Cache variants: `extract_cross_table_cache(table_obj)` plus the `run_*_from_cache(caches)` functions.
- Atomic checks: `check_table_exists`, `check_table_presence`, `check_required_columns`, `check_column_dtypes`, `check_datetime_format(..., expected_tz='UTC')`, `check_lab_reference_units`, `check_medication_dose_units`, `check_categorical_values`, `check_category_group_mapping`, `check_missingness`, `check_conditional_requirements`, `check_mcide_value_coverage`, `check_relational_integrity`, `check_chronological_order`, `check_numeric_range_plausibility`, `check_field_plausibility`, `check_medication_dose_unit_consistency`, `check_cross_table_temporal_plausibility`, `check_overlapping_periods`, `check_category_temporal_consistency`, `check_duplicate_composite_keys`. Each has `_polars` and `_duckdb` variants.
- Compat helpers: `validate_dataframe(df, schema, table_name=None, plausibility_thresholds=None, clif_version=None) -> List[Dict]` (L7614; used by `BaseTable.validate`), `get_schema_check_counts(table_name, schema_dir=None)`, `build_absent_table_dqa_result(table_name, schema_dir=None)`, `format_clifpy_error`, `determine_validation_status`, `classify_errors_by_status_impact`, `get_validation_summary`. `_load_schema` is underscore-named but exported.

**report_generator** [U]
- `generate_validation_pdf(validation_data, table_name, output_path, site_name=None, feedback=None) -> str` (L418)
- `generate_text_report(validation_data, table_name, output_path, site_name=None) -> str` (L808). `table_name` is a **required positional** argument. The parent directory is not created. The header is hard-coded as `"CLIF 2.1 DQA VALIDATION REPORT"` (L824) even for 3.0 runs.
- `collect_dqa_issues(validation_data) -> (category_scores, all_issues)`, `compute_table_stats(df, schema)` (not called by any clifpy code; see `pitfalls.md`, PHI exposure surfaces), `collect_table_results(json_dir, table_names, feedback_dir=None)` (expects `<json_dir>/<table>_dqa.json`), `generate_combined_validation_pdf(table_results, output_path, table_names, site_name=None, feedback_map=None, display_names=None)`, `generate_consolidated_csv(...)`, and `generate_combined_report(json_dir, output_dir, table_names, site_name=None, feedback_dir=None) -> pdf_path|None`, which writes `combined_validation_report.pdf` and `consolidated_validation.csv`. Constants: `DQA_CATEGORIES`, `TABLE_DISPLAY_NAMES`.

**rule_codes**: `enrich_issue(issue, check_key=None)`, `build_finding(message, details)`, `extract_column_field(issue)`, `passing_finding(rule_code, partial=False)`, `truncate_comment(message, max_len=400)`.

**logging_config** [R]: `setup_logging(output_directory=None, level=logging.INFO, console_output=True, separate_error_log=True) -> Logger` and `get_logger(name)`. `class EmojiFormatter`.

**data/loader** (`clifpy.data`): `load_demo_clif(tables=None, timezone='UTC', verbose=False) -> ClifOrchestrator`, `load_demo_<table>(return_raw=False)` for patient, labs, vitals, respiratory_support, position, adt, hospitalization, medication_admin_continuous, and patient_assessments, `list_demo_datasets() -> Dict`, and `get_demo_summary() -> None`. `DEMO_TABLES` contains those 9 tables.
