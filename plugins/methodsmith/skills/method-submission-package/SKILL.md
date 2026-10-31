---
name: method-submission-package
description: "Assembles traceable journal packages. Use when preparing submission files, readiness checks or journal transfers."
argument-hint: "[optional: --out-dir manuscript --format quarto]"
---

# Manuscript Package Builder

> **Run the commands below from the user's project root.** The `SKILL_DIR` anchor locates the bundled script; `--project-root` and `--out-dir` stay project-relative.


## Skill Value

- **Problem it solves:** Manuscript submission packages fail when required outputs, checklist items, and provenance are scattered.
- **Use when:** The user needs a journal/manuscript package, submission bundle, or final report handoff.
- **Output:** A manuscript package manifest with included artifacts, missing items, and readiness notes.
- **Ask only if:** Only when target journal, package scope, or required artifacts are unclear.
- **Do not do:** Do not invent missing tables, figures, or manuscript claims.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Build a traceable manuscript package manifest. The skill wires known study artifacts together; it does not invent manuscript prose or scientific claims.

## Workflow

1. Confirm the SAP exists and is the correct study contract.
2. Confirm Table 1 and figure manifests exist, or surface them as blockers.
3. Include selected reporting checklist files from the guideline registry.
4. Include preregistration and model-card artifacts when applicable.
4b. **AI-use disclosure.** When AI-assisted technologies contributed to the manuscript, confirm the disclosure names the tool and its purpose, appears in both the cover letter and the manuscript, lists no AI tool as an author, and leaves a named human accountable for the content (ICMJE Recommendations, Section V and Section II.A.4). Treat a missing or vague disclosure as a package blocker.
4c. **ICMJE COI disclosures.** Collect each author's ICMJE disclosure data: relevant financial activities with commercial entities, funding received for this work, and affiliation (ICMJE Recommendations, Section II.D). Write the form-ready data as one structured entry per author under `manuscript/coi/` — data only; each author completes and signs their own ICMJE form. Cross-check the manuscript's COI statement against the collected data and against every funder named in the manuscript, cover letter, or registry entry. A missing COI statement, a funder present in one source but absent from another, or a "no conflicts" statement contradicted by the collected data blocks the package until reconciled.
5. If the deliverable is a Word manuscript, run `method-citations` before
   final packaging and include the field-bearing DOCX master plus its citation
   ledger; a flattened DOCX or static bibliography is not the editable master.
6. **Number gate.** Load the `method-numbers` skill and run its `check` on the manuscript sources, rendered copies, and tables (it reads `analysis/numbers/registry.json`). A `FAIL` exit, or a gate that could not run, blocks readiness: quote its `file:line: reason: token` lines as printed, and never add a result to the allowlist or edit the registry to make it pass.
7. Run:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/build_package_manifest.py" --project-root . --out-dir manuscript --format quarto
```

The builder independently runs the number gate and records its status in the manifest. It defaults to the project-local `analysis/numbers/method_numbers.py` installed by `method-numbers`; if that helper is absent, pass `--number-gate` with the absolute script path obtained by loading that skill. Use repeated `--number-input` arguments for an explicitly scoped set of manuscript/table files. Missing tooling, no reportable occurrences or a failing gate produces blocked readiness, even when all publication artifacts exist.

8. The script writes `checklists`, `registry_packages`, and `reproducibility` as empty lists and rewrites the manifest on every run; after the final run, add the artifacts from steps 3-4 to those lists. For a Word deliverable, also set the optional `word_master` and `citation_ledger` paths from the step 5 `__CE_CITATION_LEDGER__` handoff (`docx=` and `path=`).
9. Review `manuscript/package-readiness-report.md` before calling the package submission-ready.
10. The script never sets `ready-for-signoff`. The agent sets `readiness: ready-for-signoff` only after step 8, when the script result is `ready-with-review`, the step 6 number gate printed `PASS`, and the user names the human reviewer who reviewed the readiness report; record that name in `signoff_reviewer`. Never set it from a `blocked` result or without a named reviewer. A rerun resets readiness, so repeat steps 6-10 after any rerun.

## Quarto Path

Load the `method-notebook-standards` skill before creating or materially extending executable Quarto analysis notebooks that feed the manuscript package.

For Quarto projects, create or update a package manifest that expects:

- `manuscript/manuscript.qmd`
- `manuscript/package-manifest.json`
- `manuscript/tables/`
- `manuscript/figures/`
- `manuscript/supplement/`
- `manuscript/checklists/`

For non-Quarto projects, generate the same package manifest without forcing a conversion; the script writes the `manuscript.qmd` section stub only for `--format quarto`.

## References

@./references/package-manifest-schema.yaml

@./references/quarto-manuscript-template.md

@./references/journal-package-checklist.md

## Journal adaptation and preserved baseline

For journal-specific packaging, read `references/journal-profile.md`, produce a dated profile from current official instructions and run `scripts/validate_journal_profile.py` using the same loaded `SKILL_DIR` anchor as the package builder. Missing or unresolved required rules block readiness. A validator pass only permits review; compare scientific claims, registered numbers and citation associations before approving reformatted output.

Use `method-study` to designate one manuscript master, preserve coauthor edits, and create an explicit protected snapshot after final checks. The working package manifest is overwritten by the builder and is not a submission baseline. Never describe a snapshot as submitted without actual submission evidence. For reviewer rounds, load `method-revision`; for journal transfer, keep the prior package intact and record the new profile and artifact digests. No automatic journal submission.
