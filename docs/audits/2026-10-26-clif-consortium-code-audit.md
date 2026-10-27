---
title: CLIF consortium code and clifpy usage audit
status: active
date: 2026-10-26
module: clif
problem_type: research
tags: [clif, clifpy, audit, federated, disclosure]
---

# CLIF consortium code and clifpy usage audit

This audit covers the public repositories in the
[Common-Longitudinal-ICU-data-Format](https://github.com/Common-Longitudinal-ICU-data-Format)
GitHub organization, the public site [clif-icu.com](https://clif-icu.com/), and the
`clifpy` source. It asked three questions: what coding conventions the consortium
prescribes, how projects actually use `clifpy`, and whether Methodsmith's CLIF
skills give correct guidance.

**Source of record:** shallow clones of 73 of the 74 organization repositories
(`.github` failed to clone; `CLIF-OMOP` is empty), read 2026-10-26. `clifpy` was
read at HEAD `c4a1eeb` (2026-10-14, version 2.1.0). The site was read the same day.
Row-level data was never opened. Where repositories commit data files, this
document reports only counts, not names or contents; the specific paths went to
the requester for follow-up with the repository owners.

## Scope

| Group | Repositories | Focus |
|---|---|---|
| Specification and tooling | 37 (CLIF, CLIF-Project-Template, CLIF-101, the consortium `skills` plugin, CLIF-TableOne, ETL and dashboard repositories) | Prescribed conventions, ecosystem consistency |
| Research projects | 35 | Coding practice, template conformance, `clifpy` usage |
| `clifpy` | 1 | Verified API, pitfalls, defects in our recipes |

## Consortium conventions (what is prescribed)

- **Data dictionary:** 2.1.0 is the current release, with 16 Beta and 12 Concept
  tables. 3.0.0 is still work in progress on the site (last updated 2026-10-13):
  15 Beta, 13 Alpha, 10 Concept, and 2 proposed tables. The site's homepage banner
  still gives a July 2026 release date. 3.0 uses lowercase snake_case category
  values and renames or splits several tables (`crrt_therapy` became
  `renal_replacement_therapy`, `ecmo_mcs` became `mcs`, and `key_icu_orders` and
  `intake_output` were each split in two).
- **Project layout (CLIF-Project-Template):**
  - `code/templates/{Python,R}/` with numbered steps 01-04 (cohort, quality
    checks, outlier handling, analysis).
  - `config/config_template.json` using `clifpy`-compatible keys: `data_directory`,
    `filetype`, `timezone`, `output_directory`.
  - `guides/`, `utils/` (config loaders), `output/final_no_phi/`, and a gitignored
    `output/intermediate_phi/`.
  - uv for Python and renv for R.
  - A buddy test by an independent site before release.
- **Lifecycle (clif-icu.com):** scope the project, build it from the template, run
  the buddy test, write a preliminary results report (Table 1 and two figures),
  then release on the consortium channel. Sites return only
  `output/final_no_phi/`.
- **ETL boundary:** the CLIF repository removed its `outlier-handling/` and
  `reference_ranges/` directories. Thresholds are applied downstream through
  `clifpy` or by each project.

### Inconsistencies inside the ecosystem

| Topic | Disagreement |
|---|---|
| Small-cell floor | The clif-icu.com FAQ requires "more than 10 patients per cell" (n >= 11), while the template README and CLIF-TableOne use n >= 10. The consortium `skills` plugin uses < 11, and projects range from < 5 to none. |
| 3.0 status | The consortium `skills` plugin calls 3.0 released in July 2026; the data-dictionary pages call it work in progress. |
| Config keys | The template, CLIF-TableOne, and CLIF-101 each use different key names. |
| CLIF-101 validation guide | Documents `clifpy` classes and arguments that do not exist, and recommends the deprecated Lighthouse. |
| Template demo data | `clif_demo` is labelled synthetic, but it is derived from the public MIMIC-IV demo. |

## Findings across 35 research projects

| Pattern | Frequency |
|---|---|
| No enforced small-cell rule on shared outputs (absent, switchable off, or below 10) | 27 of 35 |
| Config incompatible with `clifpy`'s schema or location | 30 of 35 |
| Hand-written versions of features `clifpy` already has (SOFA, outlier handling, waterfall, dose units, stitching, wide/hourly, ASE) | about 20 of 35 |
| No tests | 32 of 35 |
| No CI | 35 of 35 |
| `clifpy` pinned with only a floor, stale in the lock, or not at all | most Python projects. Locks resolve versions 0.2.2-0.5.0; only two projects use 2.1.0 |
| Timezone stripped, hard-coded, or localized ambiguously | 16 of 35 |
| Personal or HPC paths in tracked files | 10 of 35 |
| Min/max or other single-patient values in shared outputs | at least 6 |
| Committed data, notebook outputs, or workspace images that should not be tracked | a few repositories; paths reported privately for owner follow-up |

The highest-cost patterns:

- **Forked SOFA and outlier code.**
  - Three projects carry modified copies of `clifpy`'s polars SOFA, each 1,600-1,800
    lines. The copies no longer agree with each other or with upstream.
  - Eight projects carry diverging copies of the outlier threshold file.
  - `clifpy` fixes never reach these forks.
- **Version and API drift.**
  - Several projects import functions their pinned version does not contain;
    `compute_ase` is missing from 0.3.1, for example.
  - In some projects the pin and the lockfile name different versions.
- **Wrong-number risks that run cleanly:**
  - outlier handling applied after the respiratory waterfall, which carries implausible
    values forward before they are removed;
  - SOFA scored over a whole stay and then used as a baseline covariate;
  - `timezone="UTC"` forced for every site;
  - rows that failed dose conversion reused after `override=True`;
  - a local function named `apply_outlier_handling` whose contract is the opposite
    of `clifpy`'s.

### Practices worth copying

- A single export gate that refuses identifier and datetime columns and fails
  closed on small cells (VentTRACE, CLIF-latent-cardiogenicshock).
- Outlier handling before the waterfall (CLIF-epi-of-sedation, CLIF-pt-consult-order-tte).
- Timezone contract tests around `clifpy` calls (CLIF-epi-of-sedation, VentTRACE).
- A run manifest recording the `clifpy` version and source (VentTRACE).
- Synthetic demo data with unit tests (quality_of_imv); `nbstripout` or marimo
  notebooks; runner scripts with `set -euo pipefail` and `uv sync --locked`.
- A committed buddy-test report (CLIF-epidemiology-of-CRRT,
  Clinical-implications-of-sepsis-definitions, CLIF-pt-consult-order-tte).

## clifpy findings (verified against 2.1.0 source)

- **Python version:** the package declares support for Python 3.9, but dose
  conversion and SOFA-2 fail to import on 3.9 (PEP 604 annotations). Use 3.10 or
  newer.
- **`clif_version` handling:**
  - `clif_version` selects the validation schema only.
  - Legacy SOFA, the polars SOFA, SOFA-2's respiratory rules, and the waterfall
    heuristics still compare against 2.1 spellings. On 3.0 data they silently
    miss IMV, room air, and HFNC.
  - An unquoted YAML `clif_version: 3.0` is parsed as a float. No schema loads,
    `validate()` does nothing, and `isvalid()` returns `True`.
- **Wide and hourly datasets:**
  - Batches that hit an error are skipped silently.
  - Tables in `tables_to_load` that were not preloaded are read unfiltered.
  - Hourly output drops the timezone.
  - Hourly windows start at each stay's first event, not on the clock hour.
- **Files that can hold row-level values or IDs:** DQA output (sample IDs and raw
  invalid strings), ECDF and summary files, overlap CSVs, validation CSVs, logs,
  and DuckDB spill files.
- **Upstream documentation:** the upstream README and DQA guide contain examples
  that do not run. Do not copy them.

## Changes to Methodsmith

| Area | Change |
|---|---|
| New skill `method-clifpy` | Verified API reference (orchestrator, tables, utilities), recipes, 40 pitfalls, a table mapping each need to the `clifpy` function that covers it, and required post-call assertions |
| New skill `method-clif-audit` | Read-only repository audit with checks CA-01 to CA-95, detection patterns, block/warning rules, and a reimplementation inventory |
| `method-clif` recipes | Fixed two broken recipes (the `generate_text_report` signature and legacy SOFA needing dobutamine). Corrected the minimum Python version to 3.10. Added the wide-dataset and stitching caveats, and routing to `method-clifpy` |
| `method-clif` rules | One small-cell rule (more than 10 per cell). Protected paths reduced to `mCIDE/`, `ddl/`, `WORKFLOW.md`. Current template layout. Consortium lifecycle. 3.0 category spellings. Optional fields. `clifpy` timezone semantics. The consortium `skills` plugin noted as coexisting |
| Version families | 3.0 marked pre-release. Points to `clifpy`'s official crosswalk and its 3.0 schemas. Lists the table and column renames that still need a hand mapping |
| POC table | Added the 3.0 POCs listed on clif-icu.com |
| R recipes | Config keys follow the current template. Outlier handling no longer depends on a removed folder |

## Recommendations for the consortium

These were not acted on here; they are for the consortium to decide:

1. Settle one small-cell floor across the FAQ, the template, CLIF-TableOne, and the
   `skills` plugin.
2. Add to the template:
   - a fail-closed `publish()` helper;
   - an exact `clifpy` pin with a committed `uv.lock`;
   - CI that runs on `clif_demo`;
   - an `nbstripout` hook.
3. Upstream to `clifpy`:
   - version-aware device spellings in the SOFA and waterfall code;
   - `encounter_block` support across `compute_ase`, `compute_sofa_polars`, and
     `calculate_cci`;
   - a public norepinephrine-equivalent helper;
   - the documentation fixes listed above.
4. Point the template's Python example at a repository that uses current
   `clifpy` APIs end to end.
