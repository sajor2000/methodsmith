# CLIF Guardrails for Execution

Load this when the CLIF profile is active (see the CLIF discovery stub in `SKILL.md`). The sensitive-data boundary gate in `SKILL.md` applies first and is not repeated here.

## Source of truth and versions

- Treat `https://clif-icu.com/` plus matching handoff `version=` and `mcide_version=` values as the source of truth.
- If the mCIDE family is not selected, load the `method-clif` skill before emitting category filters or category validation. Never assume a 2.1 cache or infer 3.0 from an `mCIDE/` path.

## Protected paths

Refuse edits to `mCIDE/**`, `ddl/**`, and `WORKFLOW.md` unless the prompt or PR description contains `POC: @<handle> approved`. If the POC cannot be resolved from local project docs, block and ask for the approving CLIF contact instead of guessing.

## Data format rules

- Refuse CSV/Feather IO for CLIF tables (Parquet only).
- Enforce timezone-aware UTC `*_dttm` columns.
- Preserve VARCHAR `patient_id` / `hospitalization_id`.
- Validate `*_category` writes against the selected mCIDE family.

## Output locations

- Keep patient-level working artifacts under the declared approved restricted data root. Use `output/intermediate_phi/` only when that exact path is approved, local, non-synced, and gitignored.
- Write shareable aggregates only to `output/final_no_phi/`.
- Place new analysis files under cohort → quality checks → outlier handling → analysis (`code/01_*` through `code/04_*`).

## Language routing

- `__CE_LANG__ primary=python` -> use `clifpy` / `ClifOrchestrator`.
- `__CE_LANG__ primary=r` -> use the CLIF project-template layout with `arrow::open_dataset()`.
- `__CE_LANG__` absent -> load the `method-language-detect` skill first; if still `unknown`, surface both implementation choices.
