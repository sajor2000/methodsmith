# State Detection

File-system signals to determine which lifecycle steps have been completed. Use the native file-search/glob tool (e.g., Glob in Claude Code) to check for these artifacts. Resolve all paths relative to the repo root (`git rev-parse --show-toplevel`).

## Detection Table

| Skill | Done signal | In-progress signal |
|---|---|---|
| `method-question` | `analysis/research-question.yaml` exists and contains `pico:` block | File exists but `pico:` has empty slots |
| `method-pubmed` | `analysis/pubmed/` contains a result `.csv` (with its sibling `.md` summary) | Directory exists but is empty |
| `method-extract` | `analysis/pubmed/` contains `*-methods.csv` or `*-methods-summary.md` | — |
| `method-checklist` | `stack_profile.reporting_checklist` is set in `.methodsmith/config.local.yaml`, or `analysis/checklists/*.md` exists | — |
| `method-meta-analysis` | `analysis/effect-size/` contains a `*-pooled.md` result | — |
| `method-power` | `analysis/power/` directory or `analysis/power-analysis.*` file exists | — |
| `method-cohort` | `analysis/cohort/` contains `.sql` or `.json` concept-set files | Directory exists but no SQL/JSON |
| `method-data-qa` | `reports/data-qa/*.md` or `analysis/data-qa-report.md` exists and contains a `GO` verdict (not `NO-GO`), `__CE_DATA_PROFILE__`, or `__CE_DATA_QA__ ... pass=true` | Report exists but contains `NO-GO`, blockers, or no verdict |
| `method-model-choice` | Every `analysis/model-strategy/*-model-strategy.md` has an exact `Status: ready_for_review` line | Any strategy memo has `Status: blocked`, `Status: provisional`, a conflicting status, or no exact status line |
| `method-phenotype` | `reports/phenotype-validation/*.md` exists with PPV/sensitivity results | — |
| `method-plan` (SAP) | `analysis/sap.md` (or the user-specified SAP path) has `sap_version` in YAML frontmatter and `status: final` or `status: amended` | SAP has `sap_version` with `status: draft` |
| `method-plan` (implementation) | `docs/plans/` contains a file with `status: active` or `status: completed` | — |
| `method-sap-workbook` | `analysis/sap-tables/` directory exists with CSV files | — |
| `method-sprint` (open) | `analysis/sprint-log.yaml` exists and contains `status: open` | — |
| `method-sprint` (closed) | `analysis/sprint-log.yaml` exists and all sprints have `status: closed` | — |
| `method-work` | Implementation files exist matching the plan's unit file lists | — |
| `method-review` | PR exists on the current branch, or `/tmp/methodsmith/method-review/` contains a run artifact | — |
| `method-compound` | `docs/solutions/` contains a new learning file dated within the last 7 days | — |
| `method-omics-qc` | `reports/bioinfo-qa/*.md` QC summary exists | — |
| `method-genome-build` | `.methodsmith/config.local.yaml` contains `genome_build` key | — |
| `method-ml-track` | `mlruns/`, `wandb/`, or `dvc.yaml` exists at repo root | — |
| `method-model-card` | `analysis/model-card.md` or `docs/model-card.md` exists | — |
| `method-numbers` | `analysis/numbers/registry.json` exists and the `method-numbers` `check` on the manuscript sources and tables exits 0 (`PASS`) | Registry exists but the check prints `FAIL`, or it has not been run on the manuscript |

## Rendering Rules

- **Done**: artifact exists and appears complete per the "Done signal" column
- **In progress**: artifact exists but matches the "In-progress signal" column, or the artifact is ambiguous (e.g., data-qa report exists but has no GO/NO-GO verdict)
- **Not started**: no artifact found

When multiple signals are ambiguous, prefer "not started" over "in progress" to avoid false progress. For model strategy, `blocked` or `provisional` takes precedence over `ready_for_review`; do not mark the step done until every discovered memo is ready for review.

## Stack Profile Detection

If `.methodsmith/config.local.yaml` exists, read `stack_profile.language` and `stack_profile.reporting` to determine language-specific annotations for the lifecycle card.

If no config exists, load the `method-language-detect` skill detection rules (check for `renv.lock`, `requirements.txt`, `pyproject.toml`, `.R` files, `.py` files) to infer the primary language.

Reporting framework inference:
- `language: python` + no Marimo signals → default to Jupyter
- `language: python` + `marimo` in `pyproject.toml` or `requirements.txt` → Marimo
- `language: r` + `_quarto.yml` or `.qmd` files → Quarto
- `language: r` + `.Rmd` files → R Markdown
