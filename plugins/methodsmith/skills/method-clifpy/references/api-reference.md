# clifpy API Reference: Package, Orchestrator, Tables

## Contents

- 1. Package facts and config file
- 2. Public API inventory (root exports)
- 2.1 `ClifOrchestrator`
- 2.2 Table classes

Verified against `clifpy` 2.1.0 (GitHub `Common-Longitudinal-ICU-data-Format/clifpy`,
2026-10-14). Citations are `path:line` in that repository. Utility functions are in
`utilities-reference.md`. Re-check with `inspect.signature` when the project pins
another version.

## 1. Package facts and config file

| Item | Value | Source |
|---|---|---|
| Version | `2.1.0`. `clifpy.__version__` comes from `importlib.metadata` and reads `"unknown"` in an uninstalled checkout | `pyproject.toml:9`, `clifpy/__init__.py:80-84` |
| Python | declared `>=3.9`, but **in practice 3.10+**: `utils/unit_converter.py` uses PEP 604 annotations (`pd.DataFrame \| duckdb.DuckDBPyRelation`, e.g. L287, L522, L760) without `from __future__ import annotations`, so the module raises `TypeError` on import under 3.9 **[verified: PEP 604 `type \| type` annotation fails on CPython 3.9.23]**. It is imported lazily by the orchestrator's dose-conversion methods (`clif_orchestrator.py:1161,1256`) and by SOFA-2 CV (`utils/sofa2/_cv.py:92`) | `pyproject.toml:24` |
| Core deps | `pandas==2.3.3` (exact pin), `duckdb>=1.0.0`, `polars>=1.33.1`, `pyarrow`, `pytz`, `pyyaml`, `psutil`, `tqdm`, `matplotlib`, `seaborn`, `reportlab`, `toml`. `pytest`, `build`, and `twine` are also *runtime* deps | `pyproject.toml:25-41` |
| Engines | pandas is the user-facing frame. DuckDB does loading, the wide pivot, SOFA, SOFA-2, ASE, and units. Polars does outlier handling, comorbidity, and the DQA backend (`_ACTIVE_BACKEND='polars'` if importable, else `'duckdb'`, `utils/validator.py:59`) | |
| Install | `uv add clifpy` (or `python3 -m pip install --upgrade clifpy` in a non-uv environment). Docs mention `clifpy[docs]`, but **no `docs` extra exists** (only a `dev` dependency-group) | `docs/user-guide/installation.md`, `pyproject.toml:58-71` |
| CLIF versions | `SUPPORTED_CLIF_VERSIONS = ("2.1", "3.0")`, `DEFAULT_CLIF_VERSION = "2.1"` | `schemas/__init__.py:27,30` |
| Schema dirs | `clifpy/schemas/2.1/*.yaml` (18 tables) and `clifpy/schemas/3.0/*.yaml` (40 tables). `ecmo_mcs` maps to `mcs_schema.yaml` under 3.0 (`_SCHEMA_NAME_OVERRIDES`, `schemas/__init__.py:36-40`). Version-agnostic files: `validation_rules.yaml`, `outlier_config.yaml`, `wide_tables_config.yaml`, `crosswalks/clif_2.1_to_3.0.yaml` | |
| Version selection | resolution order is explicit `clif_version=` arg, then config `clif_version`, then `"2.1"` (`clif_orchestrator.py:235`, `tables/base_table.py:241`). It applies to the **schema used for validation only**. Analytics utilities (SOFA, SOFA-2, ASE, waterfall, outliers) take no version argument and hard-code 2.1 vocabulary (`pitfalls.md`, item 4) | |
| Changelog | None at the root. `dev/docs/changelog.md` is stale (last entry 0.0.1, "CLIF 2.0"). For change history, rely on the docs and code | |

### Config file (`utils/config.py`)

- Formats: `.json`, `.yaml`, `.yml` (`config.py:44-58`). In YAML only, the key `tables_path` is renamed to `data_directory` (`config.py:54`).
- Required keys: `data_directory`, `filetype` (`csv`|`parquet`), `timezone`. `data_directory` must exist (`config.py:132-155`).
- Optional keys: `output_directory` (defaults to `<cwd>/output`, which is created), and `clif_version` (`"2.1"`|`"3.0"`). Unknown keys such as `site` are ignored.
- Auto-detect (no `config_path`): looks **only in the cwd** for `config.json`, then `config.yaml`, then `config.yml` (`config.py:103-108`). It does not look in `config/config.yaml`. `ClifOrchestrator.from_config()` defaults to `"./config.json"`.
- `get_config_or_params` (`config.py:161-257`): **if all three of `data_directory`, `filetype`, and `timezone` are passed, the config file is never read** (`config.py:203`). `config_path`, `output_directory`, and `clif_version` from the file are then silently ignored. Partial params override file values.
- `create_example_config(data_directory="./data", filetype="parquet", timezone="UTC", output_directory="./output", config_path="./config.json", format="json") -> None` writes `clif_version: "2.1"` (YAML uses the `tables_path` key).

```yaml
data_directory: /secure/clif            # or tables_path: (YAML only)
filetype: parquet
timezone: US/Central                    # site zone used for display/relabel (see `pitfalls.md`, Timezones)
output_directory: /secure/clif_out      # logs/, validation CSVs, plots land here
clif_version: "3.0"                     # QUOTE IT (see `pitfalls.md`, item 2)
```

---

## 2. Public API inventory

The root re-exports from `clifpy/__init__.py` are listed in `__all__` (L87-165): `data`, all 42 table
classes, `ClifOrchestrator`, `stitch_encounters`, `process_resp_support_waterfall`, `create_wide_dataset`,
`convert_wide_to_hourly`, `calculate_cci`, `apply_outlier_handling`, `get_outlier_summary`, `load_config`,
`load_data`, `setup_logging`, `get_logger`, `calculate_sofa2`, `calculate_sofa2_daily`, `SOFA2Config`,
`DuckDBResourceConfig`, `crosswalk_table_2_1_to_3_0`, `crosswalk_file_2_1_to_3_0`,
`normalize_category_value`, `BETA_TABLES`, `compute_sofa_polars`, `standardize_datetime_columns_polars`,
`ensure_datetime_precision_match_polars`, `convert_datetime_columns_to_site_tz_polars`,
`load_data_polars`, `load_clif_table_polars`.

**Not** exported at the root: `calculate_elix`, `calculate_mdro_flags`, `compute_sofa`, `compute_ase`,
`run_full_dqa`, the report generators, `CrosswalkMigrationRunner`, and the unit converter. `clifpy.utils` re-exports
`compute_sofa`, `compute_ase`, `run_full_dqa`, the report functions, the io lazy helpers, `get_config_or_params`,
and `create_example_config` (`utils/__init__.py:59-122`).

### 2.1 `ClifOrchestrator` (`clif_orchestrator.py:110`)

```python
ClifOrchestrator(config_path=None, data_directory=None, filetype=None, timezone=None,
                 output_directory=None, stitch_encounter=False, stitch_time_interval=6,
                 clif_version=None)
```
Side effects in the constructor: it creates `output_directory` (default `<cwd>/output`) and calls `setup_logging(output_directory)`,
which **resets the `clifpy` logger handlers** (`clif_orchestrator.py:244`, `logging_config.py:114`). All 42 table
attributes start as `None`. `wide_df=None` and `encounter_mapping=None`. `TABLE_CLASSES` (L63-108) maps names to classes.

| Method | Signature | Returns | Purpose / side effects |
|---|---|---|---|
| `from_config` | `@classmethod (config_path="./config.json")` | instance | Same as `cls(config_path=...)` |
| `load_table` | `(table_name, sample_size=None, columns=None, filters=None)` | table obj | `TableClass.from_file(..., clif_version=self.clif_version)`, then `setattr(self, table_name, obj)`. Unknown name raises `ValueError` |
| `initialize` | `(tables=None, sample_size=None, columns: Dict[str,List]=None, filters: Dict[str,Dict]=None)` | `None` | Default `tables=['patient']`. A `ValueError` per table is **caught and only logged** (L395). A missing file (`FileNotFoundError`) still raises. Runs `run_stitch_encounters()` when `stitch_encounter=True` |
| `run_stitch_encounters` | `()` | `None` | Loads hospitalization/adt **unfiltered** if missing. **Replaces** `hospitalization.df` and `adt.df` with versions that carry an `encounter_block` column (L419). Any exception is caught, and `encounter_mapping` is set to `None` |
| `get_loaded_tables` | `()` | `List[str]` | |
| `get_tables_obj_list` | `()` | `List` | |
| `get_encounter_mapping` | `()` | `DataFrame \| None` | **Triggers stitching** if the mapping is `None` (L459-471), whatever `stitch_encounter` is set to |
| `validate_all` | `()` | `None` | Calls `.validate()` on each loaded table. Results go to `co.<table>.errors`, and CSV files are written (see BaseTable methods below) |
| `create_wide_dataset` | `(tables_to_load=None, category_filters=None, sample=False, hospitalization_ids=None, encounter_blocks=None, cohort_df=None, output_format='dataframe', save_to_data_location=False, output_filename=None, return_dataframe=True, batch_size=1000, memory_limit=None, threads=None, show_progress=True)` | **`None`** | The result goes to `co.wide_df`. Base tables (patient, hospitalization, adt) are auto-loaded, with **hospitalization/adt filtered by `hospitalization_ids`**. **Tables in `tables_to_load` that are not yet loaded are loaded unfiltered (all rows)** (L698). Adds `assessment_value` to `patient_assessments.df` (mutation). Adds `encounter_block` when a mapping exists |
| `convert_wide_to_hourly` | `(aggregation_config, wide_df=None, id_name='hospitalization_id', hourly_window=1, fill_gaps=False, memory_limit='4GB', temp_directory=None, batch_size=None)` | `DataFrame` | Wraps the util. Does **not** expose the util's `timezone` arg (L1037) |
| `get_sys_resource_info` | `(print_summary=True)` | `Dict` | psutil CPU/RAM. Logs a summary |
| `convert_dose_units_for_continuous_meds` | `(preferred_units: Dict[str,str], vitals_df=None, hospitalization_ids=None, show_intermediate=False, override=False, save_to_table=True)` | `None` or `(converted_df, counts_df)` if `save_to_table=False` | Loads `medication_admin_continuous` (filtered by ids) if missing. **If `co.vitals` is None, it loads vitals filtered to `vital_category=['weight_kg']` into `co.vitals`** (L1188). With `save_to_table=True`, sets `.df_converted` and `.conversion_counts` on the table (`.df` is untouched). Does not forward `id_name`/`fallback_on_earliest` |
| `convert_dose_units_for_intermittent_meds` | same signature | same | Same behavior for `medication_admin_intermittent` (L1283) |
| `compute_sofa_scores` | `(wide_df=None, cohort_df=None, extremal_type='worst', id_name='encounter_block', fill_na_scores_with_zero=True, remove_outliers=True, create_new_wide_df=True)` | `DataFrame` | Legacy SOFA (`recipes.md` 3.7). With the default `create_new_wide_df=True` it **rebuilds and overwrites `co.wide_df`** (L1380) and also stores `co.wide_df_sofa`. Stores `co.sofa_df`. **Default `id_name='encounter_block'` triggers stitching.** `remove_outliers` only nulls values in the SOFA wide copy (the docstring claims it overwrites table dfs; it does not) |

`load_table`'s return annotation lists only the 2.1 classes. All 42 work.

### 2.2 Table classes (`clifpy/tables/`)

Every class subclasses `BaseTable`. The table name is the snake_case of the class name.
CLIF 2.1+3.0: `Patient, Hospitalization, Adt, Labs, Vitals, MedicationAdminContinuous,
MedicationAdminIntermittent, PatientAssessments, RespiratorySupport, Position, HospitalDiagnosis,
MicrobiologyCulture, MicrobiologySusceptibility, MicrobiologyNonculture, CrrtTherapy,
PatientProcedures, CodeStatus, EcmoMcs` (EcmoMcs loads the `mcs` schema under 3.0).
CLIF 3.0 only (stub classes, constructor only): `Mcs, IntermittentDialysis, Input, Output,
InvasiveHemodynamics, ConsultOrders, MiscIcuOrders, MedicationOrders, PatientDiagnosis,
PlaceBasedIndex, Provider, TherapyDetails, Transfusion, ClinicalTrial, ClinicalNotesFacts,
ValidatedDiagnosis, ModelRegistry, Scores, Radiology, Line, Drain, Airway, PatientAttributes, EdEncounter`.

**Constructor**: `Table(data_directory=None, filetype=None, timezone="UTC", output_directory=None, data=None, clif_version=None)`.
Direct construction does **not** load a file and does not tz-convert `data`. Output defaults to `<cwd>/output`.

**`from_file`** (`base_table.py:182`):
```python
Table.from_file(data_directory=None, filetype=None, timezone=None, config_path=None,
                output_directory=None, sample_size=None, columns=None, filters=None,
                verbose=False, clif_version=None)
```
This reads `<data_directory>/clif_<table>.<filetype>` through `utils.io.load_data` (materialized, tz-relabelled to `timezone`,
`*_id` columns cast to pandas `string`).

**BaseTable methods** (all tables):

| Method | Returns | Notes |
|---|---|---|
| `validate()` | `None` | Runs `validator.validate_dataframe(df, schema, clif_version)` and fills `.errors`. Writes `output/validation_errors_<table>.csv` when there are errors (L364). **No-op if `schema is None`** |
| `isvalid()` | `bool` | `False` if never validated. Vitals/MicrobiologyCulture override this to include extra error lists |
| `get_summary()` | `Dict` | Includes `numeric_stats` from `describe()` (min/max of raw values) |
| `save_summary()` | `None` | Writes `output/summary_<table>.json` (contains min/max) |
| `analyze_categorical_distributions(save=True)` | `Dict[str, DataFrame]` | Unique-ID counts per category. CSVs go to output |
| `plot_categorical_distributions(columns=None, figsize=(10,6), save=True, dpi=300)` | `Dict[str, Figure]` | PNGs go to output |
| `calculate_stratified_ecdf(value_column, category_column, category_values=None, save=True)` | `List[pl.DataFrame]` | **Writes every value** to `ecdf_<table>_<val>_by_<cat>.csv` |

**Table-specific helpers**:

- `Adt.check_overlapping_admissions(save_overlaps=False, overlaps_output_directory=None) -> int`. `save_overlaps=True` writes row-level overlap rows to CSV.
- `Hospitalization.calculate_length_of_stay() -> DataFrame`, `.get_mortality_rate() -> float`, `.get_summary_stats() -> Dict`, `.get_patient_hospitalization_counts() -> DataFrame`.
- `HospitalDiagnosis.load_table()` (reloads `.df`, unfiltered), `.get_diagnosis_summary()`, `.get_primary_diagnosis_counts()`, `.get_poa_statistics()`, `.get_diagnosis_by_format()`, `.get_hospitalization_diagnosis_counts()`.
- `Labs.get_lab_reference_units(save=False, output_directory=None) -> DataFrame[lab_category, reference_unit, count]`. `Labs.standardize_reference_units(inplace=True, save=False, lowercase=False, output_directory=None)` fuzzy-matches unit **strings** to the schema target and **mutates `.df` by default**. It does no value conversion. Also `.get_lab_category_stats()` and `.get_lab_specimen_stats()`.
- `Vitals.vital_units` and `.vital_ranges` (properties), `.filter_by_vital_category(vital_category) -> DataFrame`, `.get_vital_summary_stats() -> DataFrame`. Range validation is commented out (`vitals.py:84-90`).
- `MedicationAdminContinuous` / `MedicationAdminIntermittent`: `.med_category_to_group_mapping` (property). `MedicationAdminContinuous.resolve_mar_action_duplicates()` is a **stub (`pass`) and returns `None`** (`medication_admin_continuous.py:121-122`). After orchestrator conversion: `.df_converted` and `.conversion_counts`.
- `PatientAssessments.assessment_category_to_group_mapping` (property).
- `Position.get_position_category_stats() -> DataFrame`.
- `RespiratorySupport.waterfall(*, id_col='hospitalization_id', bfill=False, verbose=True, return_dataframe=False)` returns a **new** `RespiratorySupport` or a DataFrame, and leaves the original unmodified. It converts tz-aware `recorded_dttm` to UTC, runs the waterfall, and converts back. The new instance is built **without `clif_version`**, so it reverts to 2.1 (`respiratory_support.py:132`).
- `MicrobiologyCulture.validate_timestamp_order()` returns the violating rows or `None`. Static `cat_vs_name_map(df, category_col, name_col, *, group_col=None, dropna=True, sort='freq_then_alpha', max_names_per_cat=None, include_counts=False)`. Also `.organism_group_cat_name_map(include_counts=False, **kw)`, `.organism_cat_name_map(...)`, `.fluid_cat_name_map(...)`, and `.top_fluid_org_outliers(level='organism_group', min_count=0, top_k=10) -> Dict[str, DataFrame]`.

