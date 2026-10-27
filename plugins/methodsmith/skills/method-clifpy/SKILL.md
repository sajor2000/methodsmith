---
name: method-clifpy
description: "Writes and reviews CLIF Python code that calls clifpy correctly: verified API, version and timezone rules, no reimplemented helpers. Use when code uses clifpy."
argument-hint: "[task, file, or clifpy function name]"
---

# clifpy Usage

## Skill Value

- **Problem it solves:** CLIF projects hand-roll SOFA, outlier handling, unit conversion, stitching, and wide datasets that `clifpy` already provides, and call `clifpy` from memory with wrong arguments, wrong version vocabularies, and silent timezone shifts.
- **Use when:** Writing, fixing, upgrading, or reviewing Python that loads CLIF tables or calls any `clifpy` function, class, or utility.
- **Output:** Working `clifpy` code that uses the verified API, the selected CLIF version, explicit timezone handling, post-call assertions, and output paths that keep row-level artifacts out of shared folders.
- **Ask only if:** The CLIF version family or the site timezone is unknown and the code depends on it. Exception: the output-path approval gate in workflow step 6 always applies; ask for any output, DuckDB temp, or log path that lacks approval before running on real data.
- **Do not do:** Do not write `clifpy` calls from memory, copy examples from the upstream README or validation guide without checking them, or reimplement a capability `clifpy` already ships.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

The references were verified against `clifpy` GitHub commit `c4a1eeb` (2026-10-14),
diffed against the published 2.1.0 package, and checked against the
public docs at `https://common-longitudinal-icu-data-format.github.io/clifpy/`.
`https://clif-icu.com/` remains authoritative for the data dictionary and mCIDE.

## Workflow

1. **Anchor CLIF context.** Consume `__CE_CLIF__` when present; otherwise load
   the `method-clif` skill. Take `version=` (2.1.0 or 3.0.0) from it and never
   infer a family from table names. CLIF 2.1.0 is the current release; 3.0.0 is
   pre-release on clif-icu.com.
2. **Establish the installed version.** Read `uv.lock` (or `requirements*.txt`,
   `pyproject.toml`) and, when an environment exists, run
   `python -c "import clifpy; print(clifpy.__version__)"`. If the project pins a
   version older than the references, verify each call against that version's
   source with `inspect.signature` before using it; old pins (0.2-0.5) lack
   SOFA-2, `run_full_dqa`, the 3.0 crosswalk, and the polars helpers. Use
   Python 3.10 or newer: the package declares 3.9, but dose conversion and
   SOFA-2 fail to import on 3.9. Add or upgrade with `uv add clifpy` and keep the
   lockfile; never add an unpinned `pip install` to project code.
3. **Reuse before writing.** Map the task to the capability table below. If
   `clifpy` covers it, call `clifpy`. Write custom code only for a documented gap
   (see the table) or when a project must reproduce a frozen earlier method, and
   say so in a comment that names the gap.
4. **Write the call from the references.** Read `references/api-reference.md`
   or `references/utilities-reference.md` for the signature and
   `references/recipes.md` for the workflow. Apply the
   version, timezone, and mutation rules in `references/pitfalls.md` before
   finishing.
5. **Assert after every high-risk call.** Required checks, aggregate only:
   - every loaded table has `schema is not None` (a typo in `clif_version` silently disables validation);
   - the expected `hospitalization_id` count survives `create_wide_dataset` and `convert_wide_to_hourly` (failed batches are dropped silently);
   - `_convert_status == "success"` share after dose conversion, with failures filtered or reported;
   - every category literal in filters exists in the selected family's vocabulary (2.1 `IMV` versus 3.0 `imv`);
   - datetime columns carry the expected zone after each step that can strip it.
6. **Keep outputs in the boundary.** Set `output_directory`, DuckDB
   `temp_directory`, and log locations to an approved restricted location;
   gitignore is an extra safeguard, not a substitute for approval. If these
   paths are not already declared approved (project config, the saved
   sensitive-data boundary, or the user), stop and ask the user to supply or
   confirm them before running anything on real data; never default to a
   repo-relative, `/tmp`, or merely gitignored path. Done when every one of the
   three paths is recorded in the run manifest as user- or config-approved. Treat `clifpy` logs, validation CSVs,
   DQA JSON/PDF, ECDF and summary files, and DuckDB spill files as restricted
   until reviewed; several contain row-level values or sample IDs. Shared
   results still go only to `output/final_no_phi/` under the CLIF small-cell rule
   in `method-clif`.
7. **Record provenance.** Write the `clifpy` version, CLIF version, site
   timezone, and key parameters (stitch window, SOFA config, preferred units) to
   the run manifest or log, not just the README.

## Capability map

| Need | Use | Not |
| --- | --- | --- |
| Load and filter tables | `ClifOrchestrator.initialize(tables, columns, filters)` or `Table.from_file(filters=, columns=)` | Raw `pd.read_parquet` of CLIF tables without tz handling |
| Validate schema, DQA report | `validate_all()`; `run_full_dqa` + `generate_text_report` | Custom dtype or category checks that duplicate the schema |
| Outlier handling | `apply_outlier_handling(table_obj)` before the waterfall | Forked threshold files, capping instead of nulling |
| Respiratory support fill | `RespiratorySupport.waterfall()` | Hand forward-fill of device or mode |
| Medication units | `convert_dose_units_for_continuous_meds` / `_intermittent_meds` | Row-wise conversion or pivots across mixed units |
| Encounter linkage | `ClifOrchestrator(stitch_encounter=True, stitch_time_interval=...)` or `stitch_encounters` | `shift()`-based gap logic |
| Wide and hourly frames | `create_wide_dataset` then `convert_wide_to_hourly` | Per-table `pivot_table` and hand hourly grids |
| SOFA | `calculate_sofa2` / `calculate_sofa2_daily` (new work); legacy `compute_sofa_scores` or `compute_sofa_polars` only to replicate SOFA-1 | Vendored SOFA forks |
| Adult sepsis event | `clifpy.utils.ase.compute_ase` | Reimplemented CDC ASE logic |
| Comorbidity | `calculate_cci`, `calculate_elix` | Hand ICD maps |
| MDRO | `calculate_mdro_flags` (pseudomonas only today) | Custom resistance rules for that organism |
| 2.1 to 3.0 values | `crosswalk_table_2_1_to_3_0`, `CrosswalkMigrationRunner` | Bulk lowercasing |
| Demo data | `clifpy.data.load_demo_clif` | Real data for development |

Documented gaps where project code is acceptable: norepinephrine-equivalent
dose outside SOFA-2, CRRT episode fill, encounter-block keys for `compute_ase`,
`compute_sofa_polars`, and `calculate_cci` (map IDs before and after), CRRT and
3.0-only analytics, and MAR action de-duplication
(`resolve_mar_action_duplicates()` is an empty stub).

## Version rule for analytics

`clif_version` changes only the validation schema. Legacy SOFA, `compute_sofa_polars`,
SOFA-2's respiratory rules, and the waterfall heuristics still compare against
CLIF 2.1 spellings. On 3.0 data, ventilated patients can silently miss
respiratory SOFA points and room-air or HFNC rules never fire. For a 3.0 project,
either confirm the installed version fixed this or map the affected
`device_category` values to the 2.1 spellings for the analytic call only, record
the mapping, and never write the mapped values back as CLIF data. In-memory
mapping works for functions that take a frame (legacy `compute_sofa`, the
waterfall). SOFA-2 and `compute_sofa_polars` read tables from files, so give
them a mapped copy of `respiratory_support` in a temporary dataset directory in
the approved restricted area, with its own config pointing there. Create and
delete it in one `try`/`finally` block so a failed or cancelled run still
removes it, and confirm the directory no longer exists before reporting the
run complete. On the published 2.1.0 package, validate 3.0 data with table
classes (`Table.from_file(..., clif_version="3.0")`); `ClifOrchestrator` has no
`clif_version` argument there.

## Reviewing existing clifpy code

When asked to review rather than write, check the capability map, every pitfall
in `references/pitfalls.md`, and the installed version, and report each finding
with `file:line`, the failure it causes, and the corrected call. For a whole
repository audit, route to `method-clif-audit`.

## References

- `references/api-reference.md` — package facts, config keys, and verified signatures for `ClifOrchestrator` and the table classes. Read before writing any orchestrator or table call.
- `references/utilities-reference.md` — verified signatures for io, wide/hourly, units, outliers, stitching, waterfall, SOFA, ASE, comorbidity, MDRO, crosswalk, DQA, logging, and demo loaders. Read before calling any utility.
- `references/recipes.md` — end-to-end recipes for loading, timezones, wide/hourly, waterfall, units, SOFA-2, legacy SOFA, ASE, stitching, comorbidity, MDRO, DQA, migration, and demo data.
- `references/pitfalls.md` — version, mutation, timezone, performance, logging, PHI-surface, and upstream-doc defects. Read before finishing any change.
