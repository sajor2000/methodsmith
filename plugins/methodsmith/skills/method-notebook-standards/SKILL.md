---
name: method-notebook-standards
description: "Sets the structure and documentation contract for new or extended marimo, Jupyter, R Markdown, and Quarto notebooks. Use when creating notebook cells or chunks."
argument-hint: "[new|extend] [notebook scope or path]"
---

# Research Notebook Standards

## Skill Value

- **Problem it solves:** Notebook logic becomes hard to review and reproduce when topology, cell responsibilities, and narrative are implicit.
- **Use when:** Creating or materially extending a Marimo `.py`, Jupyter `.ipynb`, R Markdown `.Rmd`, or Quarto `.qmd` notebook or notebook workflow.
- **Output:** A recorded notebook topology decision and a cell/chunk structure that is reviewable, documented, and reusable.
- **Ask only if:** Only when new or material notebook work has no explicit master-notebook versus multi-file decision.
- **Do not do:** Do not silently broaden a bounded existing-notebook edit into a whole-notebook rewrite.
- **Interaction:** Ask the topology question with `AskUserQuestion` in Claude Code, `request_user_input` in Codex, `AskUser` in Droid, `question` in OpenCode, or `ask_user` in Gemini and Pi via `pi-ask-user`. For Pi batch questions, put `context`, `options`, `allowMultiple`, and `allowFreeform` on each `questions` entry; do not also pass them at the top level. In Claude Code, first call `ToolSearch` with `select:AskUserQuestion` when the schema is not loaded. Only when no blocking tool exists or the call errors, present numbered choices in chat and wait.

## Start with topology

For new or materially extended notebook work, ask whether to use one master notebook or a multi-file workflow before creating cells. Record the answer in the notebook introduction or project plan.

- **One master notebook:** record its path, scope, and ordered sections.
- **Multi-file workflow:** record each notebook or helper module path, its single responsibility, execution order, and the master entry point.
- **Bounded existing edit:** preserve the existing topology. Apply this standard only to added or materially changed cells and flag pre-existing debt without silently remediating it.

## Cell and chunk contract

1. Put a Markdown cell or narrative block immediately before every code cell or executable chunk. State its purpose, key inputs or assumptions, and output or decision. Add method rationale when it is not obvious.
2. Target fewer than 30 executable lines per code cell or chunk. Count code, not blank lines, comments, or metadata.
3. Allow a larger cell only when it is one cohesive operation and the preceding Markdown says why splitting or extraction would make it less clear. Move reusable or complex logic into a helper function or module.
4. Keep each cell or chunk focused on one visible responsibility: setup, input validation, transformation, analysis, visualization, or reporting.
5. Name cells/chunks when the format supports it so reviews, errors, and rendered outputs can refer to a stable unit.

## Format safeguards

- **Marimo:** Keep dependencies visible through cell inputs/outputs; use idempotent cells, few globals, no cross-cell mutation, and helper modules for growing logic.
- **Jupyter:** Preserve metadata and execution order. Insert Markdown/code pairs and validate the notebook after edits.
- **R Markdown and Quarto:** Use named, scoped chunks with nearby narrative. Set chunk-level execution options deliberately when output, warnings, errors, or evaluation behavior differs from the document default.

## Real-data execution contract

For any notebook edit, interactive run, or script execution that reads, creates, transforms, validates, or renders analytical data or output, use the declared restricted data root for file-backed data (or the registered verified data connection) and confirm the source against QA evidence. Synthetic, mock, sample, and fake-study data are allowed only when the user explicitly requests a clearly labeled test or demonstration; do not produce a synthetic study result. If the real source or provenance is unavailable, do not run analytical cells or persist output. Every persisted study result must record the real source location or registered extract ID/hash and its validation evidence. An explicitly requested synthetic test/demo may persist only as a clearly labeled non-study artifact with synthetic fixture or generator provenance, never in a study-output location.

## Completion check

Before handoff, verify the topology decision is recorded, every added or materially changed executable unit has its preceding Markdown/narrative, exceptions explain their size, the real source and validation evidence are recorded for persisted analytical output, and the format's normal structural or render validation has run (or its gap is reported).

## Study evidence handoff

When a study record is in use, link material cells/chunks to the scientific plan or decision and register their source/configuration dependencies through `method-study`. Distinguish structural validation, actual execution, fresh outputs and human scientific review. Jupyter needs a fresh kernel for reproducibility evidence; marimo static checks and cached reactive state are not clean-run evidence; R Markdown needs an isolated R process; Quarto freeze/cache does not track every external input. Preserve the user's chosen native format and existing topology decision. A changed input leaves dependent figures, tables and claims stale until revalidated.
