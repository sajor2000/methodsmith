---
name: method-r
description: "Routes R work: analysis design, tidyverse, event-study DiD, packages, testthat, CRAN, profiling, targets. Use when a project is R-first or the user needs R help; diffs and PRs go to method-review."
argument-hint: "[analysis|review|tidyverse|event-studies|package|testing|cran|performance|targets]"
---

# R Statistics Router

## Skill Value

- **Problem it solves:** R projects need language-specific workflow guidance without bypassing Methodsmith design, data-QA, and reporting gates.
- **Use when:** The project uses R, RStudio, `.R`, `.Rmd`, `.qmd`, `renv`, `DESCRIPTION`, or `_targets.R`.
- **Output:** A selected R workflow with the relevant analytical contract and validation plan.
- **Ask only if:** The task could reasonably belong to more than one R workflow.
- **Do not do:** Do not change package dependencies, publish to CRAN, or replace failed data with synthetic examples without explicit authorization.

## Route

Pick the narrowest row and read its reference file before writing code. Each file holds that workflow's scope, steps, and guardrails.

| Task | Workflow |
|---|---|
| R analysis design, base R, modeling, sensitivity analysis | Use the shared R workflow below |
| Read-only R code review | Read `references/review.md` |
| dplyr, tidyr, ggplot2, purrr, joins | Read `references/tidyverse.md` |
| Event-study or staggered adoption design | Read `references/event-studies.md` |
| Package API, documentation, release structure | Read `references/package-development.md` |
| testthat fixtures, snapshots, mocks | Read `references/package-testing.md` |
| CRAN readiness and submission preparation | Read `references/cran.md` |
| Profiling and performance improvement | Read `references/performance.md` |
| `targets` pipeline authoring and validation | Read `references/targets.md` |

## Shared R workflow

1. Inspect `renv.lock`, `DESCRIPTION`, `_targets.R`, Quarto/R Markdown files, and existing project conventions before proposing packages or file layout.
2. Load the `method-notebook-standards` skill before creating or materially extending an `.Rmd` or `.qmd` analysis.
3. For research analysis, load `method-plan` to establish the canonical SAP; add `method-sap` only when a complex clinical design needs claim-to-dataset and decision-evidence modeling.
4. Load the `method-data-qa` skill before model code and keep R transformations fail-loud at schema, join, and type boundaries.
5. Preserve lockfiles and record `sessionInfo()` or the project-equivalent environment evidence with any reproducible result.
6. Load the `method-review` skill for causal, survival, or reporting claims; language-specific R syntax does not validate methodology by itself.
7. When `phi_environment.mode` in `.methodsmith/config.local.yaml` is `schema-only`, run R scripts that read data as `method-safe-run -- Rscript <script>` (or `method-safe-run -- quarto render <doc>`), using the path the guard's deny message gives; it shows only the exit code, files written, and a stderr summary of traceback frames and error types. Run `targets::tar_make()`, `rmarkdown::render()`, and `make` the same way. Write results with `write.csv()` or `knitr::kable()` as aggregate tables, counts under 11 suppressed, under `output/` or another `phi_environment.aggregate_dirs` entry.

## Evidence-first R guidance

1. Treat the project lockfile and installed package version as the starting point; do not recommend a current R API from memory when version-specific behavior matters.
2. When available, use Ref MCP to read the official documentation for the exact R package and function before proposing an unfamiliar, version-sensitive, or safety-relevant call. Record the package/version or a version gap with the recommendation.
3. When current ecosystem or CRAN-policy discovery is necessary, use Tavily MCP to find candidate primary sources, then read the official package, CRAN, R-project, or rOpenSci source. A search snippet or a third-party blog is not sufficient evidence for an API or submission rule.
4. If the configured research tool is unavailable, state the verification gap and use only repository-local evidence or stable base-R behavior; never invent an option, version, benchmark, or policy.

## Study and manuscript continuity

For an active study record, use `method-study` to retain native R Markdown or Quarto notebooks, declared inputs and verified runs. Use an isolated R process for clean-run evidence; cached chunks and successful rendering alone do not prove every intended analysis executed. Keep one authoritative manuscript and reconcile external Word edits before rendering over them. Do not convert the user's notebook format merely for lifecycle integration.
