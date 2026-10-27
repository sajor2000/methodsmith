# Sprint Audit Checklist

Used by `method-sprint-audit-reviewer` at `method-sprint close` time. The reviewer walks each item and produces a P0/P1/P2 finding per failure.

## P0 (block sign-off)

1. **Planned output missing** -- a row in `outputs_planned` has no corresponding artifact at the declared `subfolder/output_file` path
2. **Output hash drift** -- an output exists but re-running the producing script (in a clean environment) yields a different hash. Reproducibility is broken
3. **Out-of-scope SAP edit** -- any analysis/ file outside the sprint's `scope` SAP sections was modified between `commit_open` and `commit_close`. Sprint discipline is broken
4. **Data wave changed mid-sprint** -- the current `data_wave_id` (in `analysis/data-waves.md` or `.methodsmith/data-state.yaml`) does not match `entry_criteria.data_wave_id`. Underlying data shifted
5. **SAP version changed mid-sprint** -- `sap_version` in `analysis/sap.md` does not match `entry_criteria.sap_version`. SAP drifted

## P1 (warn; sign-off allowed with note)

1. **Extra output produced** -- an artifact exists in the sprint's subfolders that is not in `outputs_planned`. Could be exploratory; reviewer decides
2. **Errored notebook / Quarto chunk** -- any `.qmd` or `.ipynb` cell errored during render. Not necessarily a sprint failure (could be a known TODO)
3. **Long sprint duration** -- > 4 weeks elapsed between `opened_at` and `closed_at`. Suggest splitting next time
4. **No commits during sprint** -- 0 git commits between `commit_open` and `commit_close`. Was work actually done?

## P2 (info; cosmetic)

1. **File order in folder differs** from declared `outputs_planned` order
2. **README in sprint folder is empty** -- minor; not a blocker
3. **Sprint name is generic** (`sprint`, `sprint-1`) -- suggest descriptive naming for future sprints

## Reproducibility re-run

If the project has a `Makefile` or `_targets.R` or `dvc.yaml`, the reviewer attempts a clean re-run:

```bash
git stash
git checkout HEAD~0   # ensure clean
make clean && make    # or tar_make() or dvc repro
```

If hashes match → ok. If not → P0 finding.

If no build system exists, skip the re-run and emit a P1 "no automated build; manual reproducibility check required".

## Output

`method-sprint-audit-reviewer` returns the JSON in the SKILL.md prompt contract: `verdict`, `p0_count`, `p1_count`, `p2_count`, `blocking_findings`, and `advisory_findings`. `verdict` is `fail` when any P0 finding exists (P0 blocks sign-off), otherwise `pass`.
