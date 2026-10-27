# clifpy Recipes

## Contents

- 3.1 Load, filter, validate
- 3.2 Timezones
- 3.3 Wide dataset, then hourly
- 3.4 Respiratory-support waterfall
- 3.5 Medication unit conversion
- 3.6 SOFA-2 (preferred for new work)
- 3.7 Legacy SOFA (replication only)
- 3.8 ASE / sepsis
- 3.9 Encounter stitching
- 3.10 Comorbidity
- 3.11 MDRO
- 3.12 DQA report
- 3.13 2.1 to 3.0 migration
- 3.14 Demo data

Verified against `clifpy` 2.1.0 (2026-10-14). Use synthetic or demo data, or real
CLIF data only inside the approved sensitive-data boundary. Every recipe that
prints or saves output keeps it aggregate; route anything row-level to the
approved restricted area.

## 3. Correct-usage recipes

### 3.1 Load, filter, validate
```python
from clifpy import ClifOrchestrator
co = ClifOrchestrator(config_path="config/config.yaml", clif_version="3.0")  # or "2.1"
ids = [str(x) for x in cohort_ids]            # *_id columns are pandas string dtype
co.initialize(
    tables=["hospitalization", "vitals", "labs"],
    columns={"labs": ["hospitalization_id", "lab_result_dttm", "lab_category",
                      "lab_value_numeric", "reference_unit"]},
    filters={"hospitalization": {"hospitalization_id": ids},
             "vitals": {"hospitalization_id": ids, "vital_category": ["heart_rate", "map"]},
             "labs":   {"hospitalization_id": ids, "lab_category": ["creatinine"]}},
)
co.validate_all()                      # returns None
n_err = {t: len(getattr(co, t).errors) for t in co.get_loaded_tables()}   # aggregate only
```
Category spelling must match the chosen version. Under 3.0, `device_category` values are `imv`, `hfnc`, ...; under 2.1 they are `IMV`, `High Flow NC`, ....

### 3.2 Timezones
```python
co = ClifOrchestrator(config_path=cfg)              # config timezone = site zone, e.g. US/Central
co.labs.df["lab_result_dttm"].dt.tz                 # -> US/Central (tz-aware)
# Lazy path: tz is NOT applied until fetch
from clifpy.utils.io import load_data, fetch_lazy_result
rel = load_data("labs", data_dir, "parquet", lazy=True, filters={"lab_category": ["lactate"]})
df = fetch_lazy_result(rel, site_tz="US/Central")   # closes the connection by default
```
Rules: CLIF storage is UTC `TIMESTAMPTZ`, and loading relabels it to `timezone` without moving the instant. If storage is **naive local wall-clock**, set `timezone` to the true storage zone, because naive values are *localized* to `timezone` (`io.py:697`, `docs/tz_dx.md` section 6 Matrix B). `return_rel=True` returns tz-aware **UTC** regardless of `site_tz`.

### 3.3 Wide dataset, then hourly
```python
co.initialize(["patient", "hospitalization", "adt", "vitals", "labs", "respiratory_support"],
              filters={t: {"hospitalization_id": ids} for t in
                       ["hospitalization", "adt", "vitals", "labs", "respiratory_support"]})
co.create_wide_dataset(
    tables_to_load=["vitals", "labs", "respiratory_support"],
    category_filters={"vitals": ["heart_rate", "map", "spo2"],         # pivot: category values
                      "labs": ["creatinine", "lactate"],
                      "respiratory_support": ["device_category", "fio2_set", "peep_set"]},  # wide: column names
    hospitalization_ids=ids)
wide = co.wide_df                                   # method returns None
hourly = co.convert_wide_to_hourly(
    aggregation_config={"mean": ["heart_rate"], "min": ["map", "spo2"],
                        "max": ["creatinine"], "one_hot_encode": ["device_category"]},
    hourly_window=1, fill_gaps=False)               # -> heart_rate_mean, map_min, ...
```
Pre-load (filtered) every table you pass in `tables_to_load`. Otherwise it is loaded whole (`clif_orchestrator.py:698`).

### 3.4 Respiratory-support waterfall
```python
rs = co.respiratory_support.waterfall(bfill=False, verbose=False)        # new RespiratorySupport
df = co.respiratory_support.waterfall(return_dataframe=True, verbose=False)
df = df[~df["is_scaffold"]]        # drop synthetic HH:59:59 rows if you need observed rows only
```
The waterfall lowercases `device_category`, `device_name`, `mode_category`, and `mode_name` (`waterfall.py:155-157`). It rescales `fio2_set` by /100 when the mean is above 1 (L172-173). It inserts hourly scaffold rows and adds `device_cat_id → device_id → mode_cat_id → mode_name_id`.

### 3.5 Medication unit conversion
```python
co.convert_dose_units_for_continuous_meds(
    preferred_units={"norepinephrine": "mcg/kg/min", "epinephrine": "mcg/kg/min",
                     "dopamine": "mcg/kg/min", "dobutamine": "mcg/kg/min",
                     "propofol": "mcg/kg/min", "insulin": "u/hr"},
    hospitalization_ids=ids)
mac = co.medication_admin_continuous
qc = mac.conversion_counts                    # aggregate QA table
bad = (mac.df_converted["_convert_status"] != "success").mean()
```
Failed rows keep their original or base dose and `_clean_unit` in the `*_converted` columns. The wide-dataset pivot then emits columns such as `norepinephrine_mcg_kg_min` alongside unconverted `x_<unit>` columns (`wide_dataset.py:1018-1031, 1218-1235`). Requires Python ≥3.10.

### 3.6 SOFA-2 (preferred for new work)
```python
import pandas as pd
from clifpy import calculate_sofa2, calculate_sofa2_daily, SOFA2Config, DuckDBResourceConfig
cohort = pd.DataFrame({"hospitalization_id": ids, "start_dttm": t0, "end_dttm": t1})  # tz-aware
s2 = calculate_sofa2(cohort, clif_config_path="config/config.yaml",
                     sofa2_config=SOFA2Config(),
                     duckdb_config=DuckDBResourceConfig(memory_limit="16GB",
                                                        temp_directory="/secure/duckdb_tmp"))
daily = calculate_sofa2_daily(cohort, clif_config_path="config/config.yaml")   # nth_day
# stitched encounters:
s2e = calculate_sofa2(cohort_eb, clif_config_path=cfg, id_name="encounter_block",
                      id_mapping=co.get_encounter_mapping())
```
Output columns: `sofa2_total`, `sofa2_{brain,resp,cv,liver,kidney,hemo}`, plus the variables they were computed from. Windows for the same id must not overlap.

### 3.7 Legacy SOFA (original 1996 SOFA; for replication only)
```python
co.convert_dose_units_for_continuous_meds(preferred_units={m: "mcg/kg/min" for m in
    ["norepinephrine", "epinephrine", "dopamine", "dobutamine"]}, hospitalization_ids=ids)
sofa = co.compute_sofa_scores(id_name="hospitalization_id")        # overwrites co.wide_df
# with windows: cohort_df columns are [id_name, 'start_time', 'end_time']  (NOT *_dttm)
```
Legacy SOFA and SOFA-2 differ as follows:
- `compute_sofa` (`sofa.py`) is SOFA-1 on the *worst value per id* over a wide frame. It has CV `sofa_cv_97`, PaO2 imputed from SpO2 via Severinghaus when SpO2 < 97, a crude device rank, and no urine output, RRT, or sedation logic.
- `calculate_sofa2` (`sofa2/`) implements the SOFA-2 spec. It uses per-subscore lookbacks, P/F or S/F, ECMO, mechanical CV support, RRT, urine-output rate, and GCS invalidation around sedation. It reads tables directly through `load_data(config_path=...)`.
- `compute_sofa_polars` is a Polars port of the **legacy** score.

Use SOFA-2 unless you are reproducing a SOFA-1 analysis.

### 3.8 ASE / sepsis
```python
from clifpy.utils.ase import compute_ase
ase = compute_ase(hospitalization_ids=ids, config_path="config/config.json",   # JSON only!
                  apply_rit=True, include_lactate=False, verbose=False)
n_sepsis = int(ase["sepsis"].sum())
```
The output has one row per blood culture (`bc_id`) with `episode_id`, `type` (community or hospital), `presumed_infection`, `sepsis`, `sepsis_wo_lactate`, `no_sepsis_reason`, `blood_culture_dttm`, `ase_onset_w_lactate_dttm`, `total_qad`, ....

### 3.9 Encounter stitching
```python
co = ClifOrchestrator(config_path=cfg, stitch_encounter=True, stitch_time_interval=6)
co.initialize(["hospitalization", "adt"], filters={"hospitalization": {"hospitalization_id": ids},
                                                   "adt": {"hospitalization_id": ids}})
mapping = co.encounter_mapping           # hospitalization_id -> encounter_block (int32)
# functional form (no mutation of inputs; returns copies)
from clifpy import stitch_encounters
h2, a2, mapping = stitch_encounters(hosp_df, adt_df, time_interval=6)
```

### 3.10 Comorbidity
```python
from clifpy.utils.comorbidity import calculate_cci, calculate_elix
cci  = calculate_cci(co.hospital_diagnosis)        # pandas: hospitalization_id, 17 flags, cci_score
elix = calculate_elix(co.hospital_diagnosis)       # 31 flags, elix_score
cci = cohort[["hospitalization_id"]].merge(cci, how="left").fillna({"cci_score": 0})
```

### 3.11 MDRO
```python
from clifpy.utils.mdro_flags import calculate_mdro_flags
co.initialize(["microbiology_culture", "microbiology_susceptibility"])
mdro = calculate_mdro_flags(co.microbiology_culture, co.microbiology_susceptibility,
                            organism_name="pseudomonas_aeruginosa",
                            cohort=win_df)           # win_df: hospitalization_id, start_dttm, end_dttm
```

### 3.12 DQA report
```python
import json, os
from clifpy.utils.validator import run_full_dqa
from clifpy.utils.report_generator import generate_text_report, generate_validation_pdf
os.makedirs(out, exist_ok=True)
tbls = co.get_tables_obj_list()
for t in tbls:
    res = run_full_dqa(t.df, table_name=t.table_name, tables=tbls, clif_version=co.clif_version)
    generate_text_report(res, t.table_name, os.path.join(out, f"{t.table_name}_dqa.txt"))
    generate_validation_pdf(res, t.table_name, os.path.join(out, f"{t.table_name}_dqa.pdf"))
    json.dump(res, open(os.path.join(out, f"{t.table_name}_dqa.json"), "w"), default=str)
failed = {k for k, v in res["conformance"].items() if not v["passed"]}   # dicts, not objects
```

### 3.13 2.1 to 3.0 migration
```python
from clifpy.utils.migrate_versions_2_1_to_3 import CrosswalkMigrationRunner
r = CrosswalkMigrationRunner(data_dir="/secure/clif21", output_dir="/secure/clif30")
r.run(dry_run=True); ok = r.run()           # writes only BETA_TABLES; log in <output_dir>/logs/
# single table
from clifpy import crosswalk_table_2_1_to_3_0, RespiratorySupport
rs30, rep = crosswalk_table_2_1_to_3_0(rs21_df, "respiratory_support")
RespiratorySupport(data=rs30, timezone="US/Central", clif_version="3.0").validate()
```
Only values in `*_category`, `*_group`, and `*_type` columns change. Column names do not change. `albumin` (split into `albumin_5` and `albumin_25`), `oxytocin`, `Blow by` (mode_category), and the `csf`/`other` lab specimens are left unchanged and flagged in `rep["columns"][col]["ambiguous"]`. `rep["is_complete"]` must be checked.

### 3.14 Demo / synthetic data
```python
from clifpy.data import load_demo_clif, list_demo_datasets
co = load_demo_clif(tables=["patient", "hospitalization", "adt", "vitals"])   # CLIF-MIMIC demo, 2.1 vocab
# 3.0 demo parquet ships too but has no loader:
from importlib.resources import files
d30 = str(files("clifpy") / "data" / "clif_demo" / "3.0")
co30 = ClifOrchestrator(data_directory=d30, filetype="parquet", timezone="US/Eastern",
                        output_directory="/tmp/clif_demo_out", clif_version="3.0")
```
`load_demo_clif` writes logs to `<cwd>/output/logs` because it passes `output_directory=None`.
