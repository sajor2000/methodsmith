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
from the audited repository root with read-only commands.

**Search scope (required).** Every `rg` below searches code and configuration
only, so a matching value in a tracked data file or notebook output is never
printed. Start each shell call with this allowlist and pass it to every `rg`:

```bash
SAFE=(-g '*.py' -g '*.R' -g '*.r' -g '*.Rmd' -g '*.qmd' -g '*.sql' -g '*.sh' -g '*.ps1'
      -g '*.toml' -g '*.yaml' -g '*.yml' -g '*.md' -g 'config/*.json' -g '*_template.json'
      -g '!output/**' -g '!data/**' -g '!**/intermediate_phi/**')
```

End every `rg` with an explicit path (`.` or a directory) and `< /dev/null`: in a
non-interactive shell, `rg` without a path reads stdin and can hang. Notebooks
(`.ipynb`) and data files are inspected only with count-only commands (CA-65). Never print the
contents of a data file a pattern finds. Where `rg` is unavailable, use
`grep -rnE` with the same expression and `--exclude-dir=.git`.

## Inventory commands

```bash
git ls-files | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -40   # tracked layout
git ls-files '*.parquet' '*.csv' '*.feather' '*.rds' '*.RData' '*.Rhistory' '*.pkl' '*.xlsx'
git ls-files '*.ipynb'
ls .github/workflows 2>/dev/null
rg "${SAFE[@]}" -l 'clifpy' . < /dev/null   # file names only
```

## Version and vocabulary

- **CA-01/02:** `rg "${SAFE[@]}" -n -i 'clif[_ -]?(version|v)\s*[:=]?\s*"?[23]\.[01]' README* config* code utils`
- **CA-03 2.1 spellings:** `rg "${SAFE[@]}" -n "'IMV'|\"IMV\"|High Flow NC|Room Air|Nasal Cannula|Trach Collar" . < /dev/null`
- **CA-03 3.0 spellings:** `rg "${SAFE[@]}" -n "'imv'|\"imv\"|'hfnc'|room_air|nasal_cannula|l_and_d" . < /dev/null`
- **CA-04:** `rg "${SAFE[@]}" -n 'compute_sofa|calculate_sofa2|waterfall\(' . < /dev/null` on a 3.0 project
- **CA-05:** `rg "${SAFE[@]}" -n 'hospitalization_joined_id|lab_value_numeric' . < /dev/null`

A project with both spellings and no normalization step is a CA-03 candidate.

## Environment and config

- **CA-20:** `ls uv.lock renv.lock pyproject.toml requirements*.txt DESCRIPTION 2>/dev/null`
- **CA-21:** `rg "${SAFE[@]}" -n 'clifpy' pyproject.toml requirements*.txt` and `rg "${SAFE[@]}" -n -A2 'name = "clifpy"' uv.lock`
- **CA-22:** `rg "${SAFE[@]}" -n -o 'from clifpy[\w.]* import [\w, ()]+|clifpy\.[\w.]+' . < /dev/null` then compare with the pinned release
- **CA-23:** `rg "${SAFE[@]}" -n 'requires-python' pyproject.toml; cat .python-version`
- **CA-24:** `rg "${SAFE[@]}" -n 'install\.packages\(' . < /dev/null`
- **CA-25:** `rg "${SAFE[@]}" -n 'set -e|pipefail|uv sync' *.sh`
- **CA-26:** `rg "${SAFE[@]}" -n 'git\+https.*clifpy|clifpy @ git' . < /dev/null`
- **CA-30:** `git ls-files config/ ; git check-ignore -v config/config.json config/config.yaml`
- **CA-31:** `rg "${SAFE[@]}" -n '"(tables_path|clif_folder|clif_data_path|tables_location|clif_directory|CLIF_DIR|file_type|time_zone|site_timezone)"' . < /dev/null`
- **CA-32:** `rg "${SAFE[@]}" -n '/(Users|home|gpfs|scratch|mnt|Volumes)/|[A-Z]:\\\\Users' . < /dev/null`
- **CA-33:** `rg "${SAFE[@]}" -n 'clif_version:\s*[0-9]' . < /dev/null` (unquoted YAML)
- **CA-34:** `python3 -c "import json,sys; json.load(open(sys.argv[1]))" config/config_template.json`
- **CA-35:** `rg "${SAFE[@]}" -n 'timezone\s*=\s*"UTC"|"timezone":\s*"UTC"|tz\s*=\s*"America/' . < /dev/null`

## clifpy usage and reimplementation signatures

- **SOFA:** `rg "${SAFE[@]}" -n -i 'def .*sofa|sofa_(cv|resp|coag|liver|renal|cns)' . < /dev/null` outside `clifpy` calls; files named `*sofa*.py` or `pySofa.py`
- **Outlier handling:** `rg "${SAFE[@]}" -n -i 'outlier_config|def apply_outlier|outlier.*thresholds|clip\(.*lower=' . < /dev/null`; files `outlier_handler.*`, `outlier-thresholds/`
- **Waterfall:** `rg "${SAFE[@]}" -n -i 'device_category.*ffill|ffill.*device|def .*waterfall' . < /dev/null`
- **Dose conversion:** `rg "${SAFE[@]}" -n -i 'mcg/kg/min.*\*|def convert_.*dose|/\s*weight_kg|\*\s*1000\s*/\s*60' . < /dev/null`
- **Stitching:** `rg "${SAFE[@]}" -n -i 'def .*stitch|shift\(1\).*(discharge|out_dttm)|encounter_block\s*=' . < /dev/null`
- **Wide/hourly:** `rg "${SAFE[@]}" -n 'pivot_table|pivot\(|date_trunc\(.hour|floor\(.h.\)|resample\(.(1)?h' . < /dev/null` on CLIF tables
- **ASE:** `rg "${SAFE[@]}" -n -i 'blood_culture.*qad|qualifying antibiotic|def .*ase\b' . < /dev/null`
- **Comorbidity:** `rg "${SAFE[@]}" -n -i 'charlson|elixhauser|I21|I50\.' . < /dev/null` outside `calculate_cci`/`calculate_elix` calls
- **Vendored clifpy:** `rg --files-without-match 'from clifpy|import clifpy' -g 'pyCLIF*.py' -g '*sofa*.py' -g '*outlier_handler*.py' -g '*waterfall*.py' -g '*stitch*.py' .` (file names only)
- **Raw reads (CA-42):** `rg "${SAFE[@]}" -n "read_parquet\(.*clif_|scan_parquet\(.*clif_|f\"clif_\{" . < /dev/null`
- **Unbounded loads (CA-41):** `rg "${SAFE[@]}" -n 'initialize\(|from_file\(|load_table\(' . < /dev/null` and check for `filters=`
- **Units (CA-43):** `rg "${SAFE[@]}" -n 'preferred_units|_convert_status|override=True' . < /dev/null`
- **SOFA windows (CA-44):** `rg "${SAFE[@]}" -n 'compute_sofa_scores\(|compute_sofa_polars\(|calculate_sofa2' . < /dev/null` and check `cohort_df`
- **Stitch window (CA-45):** `rg "${SAFE[@]}" -n 'stitch_time_interval|time_interval=' . < /dev/null`
- **Private state (CA-47):** `rg "${SAFE[@]}" -n '\.df_converted\s*=|\.df\s*=|DEVICE_RANK_DICT|REQUIRED_SOFA_CATEGORIES' . < /dev/null`
- **Reports (CA-48):** `rg "${SAFE[@]}" -n 'generate_text_report\(|generate_validation_pdf\(' . < /dev/null`
- **Shadowing (CA-49):** `rg "${SAFE[@]}" -n 'def (apply_outlier_handling|stitch_encounters|create_wide_dataset|compute_sofa|calculate_cci)' . < /dev/null`

## Timezone

- **CA-50:** `rg "${SAFE[@]}" -n 'tz_localize\(None\)|tzinfo=None|replace_time_zone\(None\)|tz_convert\(None\)' . < /dev/null`
- **CA-51:** `rg "${SAFE[@]}" -n -i "set timezone|SET TimeZone" . < /dev/null`
- **CA-52:** `rg "${SAFE[@]}" -n 'dt\.date\b|dt\.floor\(.D.\)|as\.Date\(' . < /dev/null` near window logic
- **CA-53:** `rg "${SAFE[@]}" -n "ambiguous=(True|'infer'|\"infer\")" . < /dev/null`

## Outputs and disclosure

- **CA-60/61:** `rg "${SAFE[@]}" -n -i 'suppress|min_cell|small.?cell|< ?(5|10|11)\b|<= ?10' . < /dev/null`
- **CA-60 off switch:** `rg "${SAFE[@]}" -n -i 'suppress\w*:\s*false|suppress\w*\s*=\s*False' . < /dev/null`
- **CA-63:** `rg "${SAFE[@]}" -n "describe\(\)|\.min\(\)|\.max\(\)|'min'|'max'" . < /dev/null` in scripts writing to `final_no_phi`
- **CA-64:** `rg "${SAFE[@]}" -n 'to_csv|write_csv|to_parquet|write_parquet|saveRDS' . < /dev/null` then check the columns written
- **CA-65:** inventory commands above; for notebooks, `rg -c '"output_type"' file.ipynb` and `rg -c 'hospitalization_id' file.ipynb` (counts only)
- **CA-66:** `ls .pre-commit-config.yaml; rg -n nbstripout .pre-commit-config.yaml`
- **CA-67:** `rg "${SAFE[@]}" -n 'tee .*final|sys\.stdout\s*=|sink\(' . < /dev/null`
- **CA-68:** `rg "${SAFE[@]}" -n 'saveRDS\(|joblib\.dump|pickle\.dump' . < /dev/null` then check what model object is saved
- **CA-69:** `rg "${SAFE[@]}" -n 'output_directory' . < /dev/null`; `git check-ignore -v output/logs output/validation_errors_x.csv .tmp`
- **CA-70:** writes whose path joins `data_directory` or `tables_path`

## Code health

- **CA-90:** `rg "${SAFE[@]}" -n 'except\s*(Exception)?\s*:\s*$' -A1 | rg 'pass|continue' . < /dev/null`; `rg "${SAFE[@]}" -n "filterwarnings\(.ignore" . < /dev/null`
- **CA-91:** `rg "${SAFE[@]}" -n -i "site(_name)?\s*==\s*['\"]|mimic" . < /dev/null` in shared code
- **CA-92:** `git ls-files | rg '_v[0-9]+\.|_copy|_[0-9]{6}\.'`
- **CA-93:** `rg "${SAFE[@]}" -n 'sys\.path\.(append|insert)|setwd\(' . < /dev/null`
- **CA-94:** `git ls-files '*.py' '*.R' '*.Rmd' '*.qmd' | xargs wc -l | sort -rn | head`
- **CA-95:** `ls LICENSE* COPYING* 2>/dev/null`
