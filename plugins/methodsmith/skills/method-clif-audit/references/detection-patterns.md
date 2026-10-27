# Detection Patterns

## Contents

- Inventory commands
- Version and vocabulary
- Environment and config
- clifpy usage and reimplementation signatures
- Timezone
- Outputs and disclosure
- Code health

Patterns locate candidates; read the surrounding code before grading. Run them
from the audited repository root with read-only commands. Never print the
contents of a data file a pattern finds. Where `rg` is unavailable, use
`grep -rnE` with the same expression and `--exclude-dir=.git`.

## Inventory commands

```bash
git ls-files | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -40   # tracked layout
git ls-files '*.parquet' '*.csv' '*.feather' '*.rds' '*.RData' '*.Rhistory' '*.pkl' '*.xlsx'
git ls-files '*.ipynb'
ls .github/workflows 2>/dev/null
rg -l --hidden -g '!.git' 'clifpy' 
```

## Version and vocabulary

- **CA-01/02:** `rg -n -i 'clif[_ -]?(version|v)\s*[:=]?\s*"?[23]\.[01]' README* config* code utils`
- **CA-03 2.1 spellings:** `rg -n "'IMV'|\"IMV\"|High Flow NC|Room Air|Nasal Cannula|Trach Collar"`
- **CA-03 3.0 spellings:** `rg -n "'imv'|\"imv\"|'hfnc'|room_air|nasal_cannula|l_and_d"`
- **CA-04:** `rg -n 'compute_sofa|calculate_sofa2|waterfall\(' ` on a 3.0 project
- **CA-05:** `rg -n 'hospitalization_joined_id|lab_value_numeric'`

A project with both spellings and no normalization step is a CA-03 candidate.

## Environment and config

- **CA-20:** `ls uv.lock renv.lock pyproject.toml requirements*.txt DESCRIPTION 2>/dev/null`
- **CA-21:** `rg -n 'clifpy' pyproject.toml requirements*.txt` and `rg -n -A2 'name = "clifpy"' uv.lock`
- **CA-22:** `rg -n -o 'from clifpy[\w.]* import [\w, ()]+|clifpy\.[\w.]+'` then compare with the pinned release
- **CA-23:** `rg -n 'requires-python' pyproject.toml; cat .python-version`
- **CA-24:** `rg -n 'install\.packages\('`
- **CA-25:** `rg -n 'set -e|pipefail|uv sync' *.sh`
- **CA-26:** `rg -n 'git\+https.*clifpy|clifpy @ git'`
- **CA-30:** `git ls-files config/ ; git check-ignore -v config/config.json config/config.yaml`
- **CA-31:** `rg -n '"(tables_path|clif_folder|clif_data_path|tables_location|clif_directory|CLIF_DIR|file_type|time_zone|site_timezone)"'`
- **CA-32:** `rg -n '/(Users|home|gpfs|scratch|mnt|Volumes)/|[A-Z]:\\\\Users'`
- **CA-33:** `rg -n 'clif_version:\s*[0-9]'` (unquoted YAML)
- **CA-34:** `python3 -c "import json,sys; json.load(open(sys.argv[1]))" config/config_template.json`
- **CA-35:** `rg -n 'timezone\s*=\s*"UTC"|"timezone":\s*"UTC"|tz\s*=\s*"America/'`

## clifpy usage and reimplementation signatures

- **SOFA:** `rg -n -i 'def .*sofa|sofa_(cv|resp|coag|liver|renal|cns)'` outside `clifpy` calls; files named `*sofa*.py` or `pySofa.py`
- **Outlier handling:** `rg -n -i 'outlier_config|def apply_outlier|outlier.*thresholds|clip\(.*lower='`; files `outlier_handler.*`, `outlier-thresholds/`
- **Waterfall:** `rg -n -i 'device_category.*ffill|ffill.*device|def .*waterfall'`
- **Dose conversion:** `rg -n -i 'mcg/kg/min.*\*|def convert_.*dose|/\s*weight_kg|\*\s*1000\s*/\s*60'`
- **Stitching:** `rg -n -i 'def .*stitch|shift\(1\).*(discharge|out_dttm)|encounter_block\s*='`
- **Wide/hourly:** `rg -n 'pivot_table|pivot\(|date_trunc\(.hour|floor\(.h.\)|resample\(.(1)?h'` on CLIF tables
- **ASE:** `rg -n -i 'blood_culture.*qad|qualifying antibiotic|def .*ase\b'`
- **Comorbidity:** `rg -n -i 'charlson|elixhauser|I21|I50\.'` outside `calculate_cci`/`calculate_elix` calls
- **Vendored clifpy:** `rg -l 'from clifpy' --files-without-match` on files named like clifpy modules; `pyCLIF*.py`
- **Raw reads (CA-42):** `rg -n "read_parquet\(.*clif_|scan_parquet\(.*clif_|f\"clif_\{"`
- **Unbounded loads (CA-41):** `rg -n 'initialize\(|from_file\(|load_table\('` and check for `filters=`
- **Units (CA-43):** `rg -n 'preferred_units|_convert_status|override=True'`
- **SOFA windows (CA-44):** `rg -n 'compute_sofa_scores\(|compute_sofa_polars\(|calculate_sofa2'` and check `cohort_df`
- **Stitch window (CA-45):** `rg -n 'stitch_time_interval|time_interval='`
- **Private state (CA-47):** `rg -n '\.df_converted\s*=|\.df\s*=|DEVICE_RANK_DICT|REQUIRED_SOFA_CATEGORIES'`
- **Reports (CA-48):** `rg -n 'generate_text_report\(|generate_validation_pdf\('`
- **Shadowing (CA-49):** `rg -n 'def (apply_outlier_handling|stitch_encounters|create_wide_dataset|compute_sofa|calculate_cci)'`

## Timezone

- **CA-50:** `rg -n 'tz_localize\(None\)|tzinfo=None|replace_time_zone\(None\)|tz_convert\(None\)'`
- **CA-51:** `rg -n -i "set timezone|SET TimeZone"`
- **CA-52:** `rg -n 'dt\.date\b|dt\.floor\(.D.\)|as\.Date\('` near window logic
- **CA-53:** `rg -n "ambiguous=(True|'infer'|\"infer\")"`

## Outputs and disclosure

- **CA-60/61:** `rg -n -i 'suppress|min_cell|small.?cell|< ?(5|10|11)\b|<= ?10'`
- **CA-60 off switch:** `rg -n -i 'suppress\w*:\s*false|suppress\w*\s*=\s*False'`
- **CA-63:** `rg -n "describe\(\)|\.min\(\)|\.max\(\)|'min'|'max'"` in scripts writing to `final_no_phi`
- **CA-64:** `rg -n 'to_csv|write_csv|to_parquet|write_parquet|saveRDS'` then check the columns written
- **CA-65:** inventory commands above; for notebooks, `rg -c '"output_type"' file.ipynb` and `rg -c 'hospitalization_id' file.ipynb` (counts only)
- **CA-66:** `ls .pre-commit-config.yaml; rg -n nbstripout .pre-commit-config.yaml`
- **CA-67:** `rg -n 'tee .*final|sys\.stdout\s*=|sink\('`
- **CA-68:** `rg -n 'saveRDS\(|joblib\.dump|pickle\.dump'` then check what model object is saved
- **CA-69:** `rg -n 'output_directory'`; `git check-ignore -v output/logs output/validation_errors_x.csv .tmp`
- **CA-70:** writes whose path joins `data_directory` or `tables_path`

## Code health

- **CA-90:** `rg -n 'except\s*(Exception)?\s*:\s*$' -A1 | rg 'pass|continue'`; `rg -n "filterwarnings\(.ignore"`
- **CA-91:** `rg -n -i "site(_name)?\s*==\s*['\"]|mimic"` in shared code
- **CA-92:** `git ls-files | rg '_v[0-9]+\.|_copy|_[0-9]{6}\.'`
- **CA-93:** `rg -n 'sys\.path\.(append|insert)|setwd\('`
- **CA-94:** `git ls-files '*.py' '*.R' '*.Rmd' '*.qmd' | xargs wc -l | sort -rn | head`
- **CA-95:** `ls LICENSE* COPYING* 2>/dev/null`
