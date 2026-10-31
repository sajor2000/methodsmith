---
name: method-notebook-edit
description: "Edits existing Jupyter .ipynb notebooks with cell anchors, backups, and metadata-preserving writes. Use when the user asks to patch an existing .ipynb."
argument-hint: "<notebook.ipynb> --tag <anchor-tag> --source <file> [--markdown-source <file>] [--cell-type markdown|code]"
---

# Guarded Notebook Editing

> **Run the script from the user's project root.** `$SKILL_DIR` anchors the script path; `--notebook`, `--source`, and `--markdown-source` resolve against `--project-root` (default: the current directory) and must stay project-relative.


## Skill Value

- **Problem it solves:** Notebook edits can silently reorder cells, corrupt metadata, or break outputs when treated as plain text.
- **Use when:** The user asks to update, patch, or extend an existing notebook rather than generate a new one.
- **Output:** A backed-up notebook edit plus an anchor/change summary and validation notes.
- **Ask only if:** Only when target notebook, edit anchor, or desired insertion point is unclear.
- **Do not do:** Do not rewrite whole notebooks or discard metadata without explicit scope.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Existing notebooks are fragile because cell order, metadata, outputs, and JSON structure can drift silently. This skill edits them only through explicit anchors and always leaves a backup.

## When This Skill Activates

- The user asks to modify an existing `.ipynb` rather than generate a new script, Quarto file, or marimo notebook.
- A SAP amendment, sensitivity analysis, Table 1 note, or figure-generation cell must be inserted into a notebook that already exists.
- A reviewer asks for a small notebook change and preserving execution history matters.

## Workflow

1. Respect the selected format for new and existing work. Jupyter, marimo, R Markdown and Quarto are first-class choices. For new `.ipynb` work, use `method-work` scaffolding with Jupyter selected; do not force conversion to a text-native format.
2. Inspect the notebook structure and identify a unique anchor tag in `cell.metadata.tags`.
3. Load the `method-notebook-standards` skill before adding or materially changing executable cells. Put the explanatory Markdown and new code body in small project files, then run:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/notebook_edit.py" --notebook analysis/notebook.ipynb --tag sap-5-1 --markdown-source analysis/notebook-edits/new-cell.md --source analysis/notebook-edits/new-cell.py --cell-type code
```

4. Review the generated backup, modified notebook diff, and `.edit-report.md` file.
5. Run the notebook top-to-bottom with the project's normal runner if available. If no runner exists, surface that as a verification gap.

When an edit adds or changes code that reads, creates, transforms, validates, or renders analytical data or output, use the declared restricted data root for file-backed data (or the registered verified data connection). Synthetic, mock, sample, and fake-study data are allowed only when the user explicitly requests a clearly labeled test or demonstration; do not produce a synthetic study result. If the real source or QA provenance is unavailable, do not run the notebook and do not persist output. Record the real source location or registered extract ID/hash and validation evidence with each persisted study result. An explicitly requested synthetic test/demo may persist only as a clearly labeled non-study artifact with synthetic fixture or generator provenance, never in a study-output location.

## Guarantees

- The script refuses absolute paths and paths outside the project root.
- The script requires exactly one matching anchor tag.
- The original notebook is copied to `<notebook>.bak` before writing.
- A code-cell insertion requires `--markdown-source`; the tool inserts the explanatory Markdown directly before the code cell.
- If `nbformat` is installed, the script validates the notebook schema before and after editing. If it is missing, the script still performs structural JSON checks and prints install guidance.

## What This Skill Does Not Do

- Does not rewrite or reorder existing cells.
- Does not execute notebooks inside the edit script; step 5 runs them only through the project's normal runner.
- Does not edit notebooks without a unique metadata tag anchor.
- Does not hide manual review; `.ipynb` diffs must be inspected before treating the change as complete.

## References

@./references/notebook-edit-policy.md
