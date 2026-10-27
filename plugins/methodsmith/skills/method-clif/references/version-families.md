# CLIF and mCIDE Version Families

Use this reference whenever CLIF activation, setup, QA, cohort generation, or
review needs a data-dictionary or mCIDE version.

| Family | Use when | Vocabulary handling |
| --- | --- | --- |
| CLIF 2.1 + mCIDE 2.1 | The project declares the released 2.1.0 structured data dictionary or its matching mCIDE source. | `mcide-vocab.md` is a portability cache for this family only; reconcile uncertain values with the project mCIDE CSV. |
| CLIF 3.0 + mCIDE 3.0 | The project explicitly declares the 3.0.0 multimodal family. clif-icu.com still marks 3.0.0 as work in progress (2.1.0 is the current release), so record the dictionary date the project used. | Read the declared v3 data dictionary and mCIDE sources (the CLIF repository `3.0` branch, or `clifpy`'s bundled `schemas/3.0/`). Do not validate against the bundled v2.1 cache. Several v3 tables remain Alpha, so treat the current dictionary as authoritative. |

## Selection precedence

1. Treat `--version 2.1.0` as the explicit CLIF 2.1 + mCIDE 2.1 call, and
   `--version 3.0.0` as the explicit CLIF 3.0 + mCIDE 3.0 call. Record
   `selection=explicit`; do not require a separate mCIDE argument.
2. Honor a matching `data_dictionary_version` + `mcide_version` pair in
   `.ce-datascience/config.local.yaml`.
3. Honor a matching pair stated in the repository data dictionary or source
   manifest.
4. Otherwise ask the user to choose one of the two supported families.

Do not mix families silently. If a direct call conflicts with an explicitly
declared pair, ask which source is intended. Treat an incomplete or mixed
declaration as a blocking ambiguity for category validation and category-filter
generation.

## Version-specific safeguards

- CLIF 2.1 values in `mcide-vocab.md` retain their published spelling and case.
- CLIF 3.0 is a breaking multimodal version. It changes schema and vocabulary
  conventions, including lowercase snake_case mCIDE permissible values, and
  several tables remain Alpha. A 2.x-to-3.0 migration requires an explicit
  value mapping and row-count/key reconciliation; never bulk lowercase a
  dataset as a substitute for a mapping.
- For the value mapping, use `clifpy`'s official crosswalk
  (`crosswalk_table_2_1_to_3_0`, `crosswalk_file_2_1_to_3_0`, or
  `CrosswalkMigrationRunner` with a dry run first). It covers category values in
  the Beta tables only and flags ambiguous values (for example albumin
  concentrations) for human review. Table and column renames still need a
  hand mapping: `crrt_therapy` to `renal_replacement_therapy`, `ecmo_mcs` to
  `mcs`, the `key_icu_orders` and `intake_output` splits, and singular `_unit`
  columns.
- `clifpy` validates 3.0 with a quoted `clif_version: "3.0"`, but its SOFA,
  SOFA-2 respiratory, and waterfall heuristics still compare against 2.1
  spellings. Route 3.0 analytic code through the `method-clifpy` skill.
- When a v3 project lacks its authoritative mCIDE source, report that validation
  is deferred and ask for the source. This plugin has no bundled v3 schema or
  vocabulary cache, so it does not certify v3 category validation. Do not
  invent allowed values or fall back to the v2.1 cache.

## Config and handoff

```yaml
stack_profile:
  profile: clif
  clif:
    data_dictionary_version: "2.1.0"
    mcide_version: "2.1.0"
```

```text
__CE_CLIF__ active=true version=2.1.0 mcide_version=2.1.0 selection=declared strict=true rules=references/clif-rules.md
```
