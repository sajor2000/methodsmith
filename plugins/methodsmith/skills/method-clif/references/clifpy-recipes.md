# CLIFpy Recipes

## Contents

- 1. Load selected tables and validate them
- 2. Create a wide dataset, then aggregate only if needed
- 3. Handle outliers and stitch encounters
- 4. Convert medication doses, then score SOFA
- 5. Run the DQA API explicitly
- 6. Use utility functions for MDRO and comorbidity flags
- 7. Install and source policy

Use these current `clifpy` patterns with synthetic/demo data, or with real CLIF
data when the saved sensitive-data boundary `phi_environment.mode` is `approved`
(schema-only projects run these recipes locally and return aggregates). Source:
`https://clif-icu.com/`, the current `clifpy` user guide, and
`Common-Longitudinal-ICU-data-Format/clifpy`, verified against `clifpy` 2.1.0
(2026-10-14). For the full verified API, pitfalls, SOFA-2, ASE, timezones, and
2.1 to 3.0 migration, load the `method-clifpy` skill. Recheck the API before
upgrading an existing locked project.

## 1. Load selected tables and validate them

Use the template's site-local configuration (JSON or YAML with
`data_directory`, `filetype`, `timezone`, and optionally `output_directory` and
a quoted `clif_version`). Load only the tables, columns, and categories the task
needs before calling `validate_all()`. IDs are strings.

```python
from clifpy import ClifOrchestrator

co = ClifOrchestrator(config_path="config/config.json", clif_version="2.1")
ids = [str(x) for x in cohort_ids]
co.initialize(
    tables=["hospitalization", "vitals", "labs"],
    filters={
        "hospitalization": {"hospitalization_id": ids},
        "vitals": {"hospitalization_id": ids,
                   "vital_category": ["heart_rate", "sbp", "spo2"]},
        "labs": {"hospitalization_id": ids,
                 "lab_category": ["hemoglobin", "creatinine"]},
    },
)
assert all(getattr(co, t).schema is not None for t in co.get_loaded_tables())
co.validate_all()   # returns None; errors are in co.<table>.errors
```

Category examples here are CLIF 2.1 spellings; CLIF 3.0 values are lowercase
snake_case. An unquoted YAML `clif_version: 3.0` silently disables validation.

## 2. Create a wide dataset, then aggregate only if needed

`create_wide_dataset()` builds event-level data, returns `None`, and stores the
result in `co.wide_df`. Preload every table named in `tables_to_load` with
filters; otherwise it is read unfiltered. Use `convert_wide_to_hourly()` only
when a consistent time window is required; its windows start at each stay's
first event and its timestamps are timezone-naive.

```python
co.create_wide_dataset(
    tables_to_load=["vitals", "labs", "respiratory_support"],
    category_filters={
        "vitals": ["heart_rate", "sbp", "spo2"],
        "labs": ["hemoglobin", "creatinine"],
        "respiratory_support": ["device_category", "fio2_set", "peep_set"],
    },
    hospitalization_ids=ids,
)
wide = co.wide_df
assert wide["hospitalization_id"].nunique() == len(set(ids))  # failed batches drop silently
hourly = co.convert_wide_to_hourly(
    aggregation_config={"mean": ["heart_rate"], "min": ["sbp", "spo2"]},
    hourly_window=1,
)
```

## 3. Handle outliers and stitch encounters

`apply_outlier_handling()` replaces the table object's `.df` and returns
`None`. Run it before the respiratory waterfall or any forward fill. Enable
encounter stitching at orchestrator construction; the mapping is available after
`hospitalization` and `adt` are initialized.

```python
from clifpy import ClifOrchestrator
from clifpy.utils.outlier_handler import apply_outlier_handling

co = ClifOrchestrator(
    config_path="config/config.json",
    stitch_encounter=True,
    stitch_time_interval=6,
)
co.initialize(["hospitalization", "adt", "vitals"],
              filters={t: {"hospitalization_id": ids}
                       for t in ["hospitalization", "adt", "vitals"]})
apply_outlier_handling(co.vitals)
encounter_mapping = co.get_encounter_mapping()
```

To rerun `co.run_stitch_encounters()`, reload **both** `hospitalization` and
`adt` first; rerunning on tables that already carry `encounter_block` creates
duplicate `encounter_block_x`/`_y` columns.

## 4. Convert medication doses, then score SOFA

For new work prefer SOFA-2 (`calculate_sofa2`, see `method-clifpy`). The legacy
orchestrator score below needs all four vasopressors in `mcg/kg/min`, including
dobutamine; a missing input column raises a DuckDB `BinderException`.
`compute_sofa_scores()` does not accept preferred units and overwrites
`co.wide_df`.

```python
preferred_units = {m: "mcg/kg/min"
                   for m in ["norepinephrine", "epinephrine", "dopamine", "dobutamine"]}
co.convert_dose_units_for_continuous_meds(
    preferred_units=preferred_units,
    hospitalization_ids=ids,
)
mac = co.medication_admin_continuous
failed_share = (mac.df_converted["_convert_status"] != "success").mean()
sofa = co.compute_sofa_scores(id_name="hospitalization_id")
```

## 5. Run the DQA API explicitly

`run_full_dqa()` returns a dictionary (`conformance`, `completeness`,
`relational`, `plausibility`, each holding dicts), not an orchestrator report
object. `generate_text_report()` takes `table_name` as a required positional
argument and does not create the directory. DQA output can include sample IDs
and raw invalid category strings, so keep it in the restricted output area until
reviewed; never place it in `output/final_no_phi/` unreviewed.

```python
import os
from clifpy.utils.validator import run_full_dqa
from clifpy.utils.report_generator import generate_text_report

os.makedirs("output/intermediate_phi/dqa", exist_ok=True)
results = run_full_dqa(co.labs.df, table_name="labs", clif_version=co.clif_version)
generate_text_report(results, "labs", "output/intermediate_phi/dqa/labs_dqa.txt")
```

## 6. Use utility functions for MDRO and comorbidity flags

MDRO and comorbidity functions are utilities, not `ClifOrchestrator` methods.
Do not use `hospital_diagnosis` as a predictor at admission or another pre-
discharge time point; it is finalized after discharge, and the comorbidity
functions ignore present-on-admission flags. Both return pandas frames and omit
hospitalizations without a qualifying code. MDRO currently supports only
`pseudomonas_aeruginosa`.

```python
from clifpy.utils.comorbidity import calculate_cci, calculate_elix
from clifpy.utils.mdro_flags import calculate_mdro_flags

cci = calculate_cci(co.hospital_diagnosis)
elix = calculate_elix(co.hospital_diagnosis)
mdro = calculate_mdro_flags(
    culture=co.microbiology_culture,
    susceptibility=co.microbiology_susceptibility,
    organism_name="pseudomonas_aeruginosa",
    hospitalization_ids=ids,
)
```

## 7. Install and source policy

- In a uv project, use `uv add clifpy` and `uv sync`; otherwise
  `python3 -m pip install --upgrade clifpy` inside the project environment.
- Preserve a project's existing lockfile; do not add an unreviewed exact pin.
- Use Python >=3.10. The package declares 3.9, but dose conversion and SOFA-2
  fail to import on 3.9.
- Prefer individual table classes for focused reads and `ClifOrchestrator` for
  multi-table operations, stitching, wide datasets, or SOFA.
- `clifpy` validates CLIF 3.0 with `clif_version="3.0"` and migrates values with
  `crosswalk_table_2_1_to_3_0`, but its SOFA and waterfall heuristics still use
  2.1 spellings. Do not apply these 2.1 category examples to a declared v3
  dataset; follow `method-clifpy` for the 3.0 workflow.
