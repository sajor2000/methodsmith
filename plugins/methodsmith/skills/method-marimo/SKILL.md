---
name: method-marimo
description: "Creates, edits, validates, and reviews marimo reactive Python notebooks (UI widgets, PEP 723, export). Use when working on a marimo notebook; Jupyter edits go to method-notebook-edit."
argument-hint: "[new|edit|validate|export]"
---

# Marimo Research Notebooks

## Skill Value

- **Problem it solves:** Reactive notebooks can hide dependency, mutation, and execution-order mistakes when treated like plain Python scripts or Jupyter JSON.
- **Use when:** The project has `import marimo`, a Marimo `.py` notebook, or the user asks for a reactive Python research notebook.
- **Output:** A text-native Marimo notebook or bounded edit, with declared dependencies, validation results, and reproducibility notes.
- **Ask only if:** The intended output, data source, or new-versus-existing-notebook boundary is unclear.
- **Do not do:** Do not silently convert a Jupyter notebook, fabricate unavailable data, or use broad exception handling to hide a failed cell.

## Workflow

1. Inspect existing project evidence. Reuse the project's Marimo and Python environment when present; otherwise state the proposed dependency method before creating files.
2. Load the `method-notebook-standards` skill before creating or materially extending a notebook.
3. For a new notebook, create a text-native `.py` file with `import marimo as mo`, `app = mo.App(...)`, and explicit `@app.cell` functions.
4. Keep data loading, transformation, modeling, and reporting in separate cells with clear returned values. Let dependencies be visible through cell inputs and outputs.
5. Treat widgets as user inputs, not hidden defaults. In edit, interactive-run, and script modes, resolve the declared restricted data root for file-backed data (or the registered verified data connection) before reading, creating, transforming, validating, or rendering analytical data or output. Synthetic data are allowed only when the user explicitly requests a clearly labeled test or demonstration; do not replace a failed production source or produce a synthetic study result. If the real source or its QA provenance is unavailable, do not run analytical code and do not persist output. An explicitly requested synthetic test/demo may persist only as a clearly labeled non-study artifact with synthetic fixture or generator provenance, never in a study-output location.
6. Keep mutable state out of cross-cell objects when a pure derived value can represent the same result.
7. Run `marimo check <notebook.py>` through the project runner when available, then execute the notebook's non-interactive path or report the validation gap. For `export`, run `marimo export` through the project runner only after validation passes, and apply the persisted-output rules below to the exported file.
8. Load the `method-data-qa`, `method-plan`, and `method-review` skills for analytical work inside the notebook; Marimo structure does not waive the data or method gates.

## Existing notebooks

- For a bounded edit to an existing Marimo `.py` notebook, preserve the app structure and modify only the requested cells.
- Load the `method-notebook-edit` skill when the target is Jupyter `.ipynb`; do not treat JSON notebook cells as Marimo functions.
- Keep PEP 723 dependency metadata, if present, synchronized with imports. Do not pin or install packages unless the user asks.

## Fail-loud rules

- Do not wrap ordinary reactive dependencies in broad `try/except` blocks.
- Do not gate output rendering behind unnecessary conditional cells.
- Surface missing files, invalid schemas, and failed assertions directly with the failed boundary and recovery options.
- Persisted study output must identify the real source location or registered extract ID/hash and the validation evidence used; synthetic test/demo output must instead identify its synthetic fixture or generator and remain clearly labeled non-study.

## Lifecycle evidence

When collaborating through a study record, use `method-study` to connect this notebook to plans, source/configuration dependencies, runs and figures. `marimo check` is structural evidence; reactive/cached output is not automatically a clean successful run. Record execution and stale descendants separately, and keep exported HTML, outputs and logs inside the approved data boundary. Explain changed cell dependencies and scientific rationale to the PI without exposing raw values.
