# Stage 3: Select Reviewers

## Roster (authoritative spawn list)

`references/persona-catalog.md` describes each reviewer's focus; this table decides when to spawn.

**Always-on:** `method-correctness-reviewer`, `method-testing-reviewer`, `method-maintainability-reviewer`, `method-project-standards-reviewer`, `method-learnings-researcher`. Spawn every review unless the Stage 3c lite-roster gate applies.

**Blinded EDA:** when SKILL.md blinding-state awareness found `stack_profile.blinding_state: blinded`, never spawn `method-methods-reviewer` or `method-multiplicity-reviewer`, even when their triggers match.

**Literature-backed findings:** pass the resolved skill-local path for `references/evidence-access.md` to `method-methods-reviewer`, `method-reporting-checklist-reviewer`, `method-causal-inference-reviewer`, `method-calibration-reviewer`, and `method-fairness-reviewer`; a finding that cites a guideline item or methods paper names its PMID/DOI source and evidence label.

**Conditional — spawn when the diff hits the trigger:**

| Agent | Spawn when... |
|-------|---------------|
| `method-r-code-reviewer` | `.R` / `.Rmd` / `.qmd` files in diff |
| `method-r-pipeline-reviewer` | `.R` / `.Rmd` / `.qmd` files in diff |
| `method-python-ds-reviewer` | `.py` / `.ipynb` files with DS imports (pandas, numpy, scipy, sklearn, statsmodels) in diff |
| `method-kieran-python-reviewer` | `.py` files in diff |
| `method-methods-reviewer` | inferential/model-fitting code, or `analysis/model-strategy/*-model-strategy.md` / its `.R` or `.py` scaffold in diff |
| `method-multiplicity-reviewer` | multiple comparisons, subgroup, or repeated-testing code in diff |
| `method-reproducibility-reviewer` | analysis scripts, notebooks, or env lock files in diff. Pass the resolved skill-local path for `references/study-metadata-schema.md` so the reviewer can check `.methodsmith/study-metadata.yaml` completeness. |
| `method-sap-drift-detector` | `analysis/sap.md` (or any markdown with `sap_version` frontmatter) exists in project |
| `method-data-mapping-reviewer` | codebook, SAP variable list, or `analysis/sap-tables/03-variables.csv` in diff |
| `method-phi-leak-reviewer` | data files, codebooks, notebooks, manuscripts, or figure files in diff, OR `stack_profile.data_root` is inside the repo |
| `method-targets-pipeline-reviewer` | `_targets.R`, `_targets.yaml`, or `tar_target(` in diff |
| `method-quarto-render-reviewer` | `.qmd`, `_quarto.yml`, `_publish.yml`, or `_book/` / `_site/` in diff |
| `method-reporting-checklist-reviewer` | `stack_profile.reporting_checklist` set to a non-null string (e.g., `STROBE`, `TRIPOD+AI`) AND a SAP exists. Pass the value, any `stack_profile.reporting_checklist_extensions`, and the resolved skill-local paths for `references/guideline-registry.yaml`, `references/guideline-routing.md`, and the selected checklist files. |
| `method-data-leakage-reviewer` | ML training/eval code in diff (sklearn, lightgbm, xgboost, pytorch, tensorflow, keras, lifelines, sksurv, tidymodels) |
| `method-fairness-reviewer` | prediction-model code in diff AND data has subgroup variables (sex, race, age band, site, payer) |
| `method-calibration-reviewer` | prediction-model evaluation code in diff that produces predicted probabilities |
| `method-omop-mapping-reviewer` | OMOP CDM tables, `concept_id` columns, or `analysis/cohort/concept-sets/` in diff |
| CLIF brief for `method-project-standards-reviewer` | `__CE_CLIF__ active=true` in chat context OR strong CLIF signals (CLIF_CLAUDE.md at root, or a git remote containing clif-icu, clif-consortium, or Common-Longitudinal-ICU-data-Format — NOT mCIDE/ or WORKFLOW.md alone). Extend the always-on standards reviewer's prompt with CLIF protected-path, Parquet-only, timezone, identifier, category, and patient-row rules. Require matching `version=` + `mcide_version=` before judging category values; flag an absent, mixed, or v2.1-cache-on-v3 family as a blocking review finding and route to the `method-clif` skill. Do not dispatch a nonexistent `method-clif-reviewer`. |
| `method-administrative-data-reviewer` | claims / billing / payer / administrative healthcare data in diff (Medicare, Medicaid, MarketScan, Optum, OMOP claims-flavor) |
| `method-concept-drift-reviewer` | concept sets, ICD/CPT/LOINC/SNOMED code lists in diff AND data spans multiple refresh waves or multiple years |
| `method-causal-inference-reviewer` | observational analysis with causal aim in diff (IPTW, matching, MSM, g-computation, DR, IV, RDD, DiD, target-trial emulation) |
| `method-bioinfo-pipeline-reviewer` | Snakefile / `*.smk` / `*.nf` / `nextflow.config` / `*.cwl` / Bioconductor pipelines / sample-sheet driven scripts in diff |
| `method-omics-batch-reviewer` | omics count / beta matrices in diff AND downstream differential or clustering or ML code |
| `method-sprint-audit-reviewer` | dispatched by `method-sprint close` (not by code review directly) |
| `method-security-reviewer` | auth, public endpoints, user input, permissions in diff |
| `method-performance-reviewer` | DB queries, loop-heavy data transforms, caching, async, large-data operations in diff |
| `method-reliability-reviewer` | error handling, retries, timeouts, background jobs in diff |
| `method-adversarial-reviewer` | >=50 changed non-test/non-generated lines, OR data mutations, external APIs, high-risk domains |
| `method-previous-comments-reviewer` | reviewing a PR with existing review comments |

The roster right-sizes itself: a small config change triggers 0 conditionals (5 reviewers); a Python analysis with statistical tests might add methods + python-ds + kieran-python + reproducibility (9 reviewers).

## Language-Aware Conditionals

Language-specific reviewers add a distinct, opinionated lens on top of the always-on and cross-cutting personas; they are not generic language checkers. Do not spawn them mechanically from file extensions alone; the trigger is meaningful changed analysis logic, data transformations, or modeling code in that language.

## Stage 3: Choose the roster

Read the diff and file list from Stage 1. The 4 always-on personas and 1 Methodsmith always-on agent are automatic. For each statistical, language-specific, and cross-cutting conditional persona in the Roster table above, decide whether the diff warrants it. This is agent judgment, not keyword matching. Apply the blinded-EDA exclusions before finalizing the roster.

**File-type awareness for conditional selection:** Instruction-prose files (Markdown skill definitions, JSON schemas, config files) are product code but do not benefit from runtime-focused reviewers. The adversarial reviewer's techniques (race conditions, cascade failures, abuse cases) target executable code behavior. For diffs that only change instruction-prose files, skip adversarial unless the prose describes auth, payment, or data-mutation behavior. Count only executable code lines toward line-count thresholds.

**`previous-comments` is PR-only.** Only select this persona when Stage 1 gathered PR metadata (PR number or URL was provided as an argument, or `gh pr view` returned metadata for the current branch). Skip it entirely for standalone branch reviews with no associated PR -- there are no prior comments to check.

Language-specific personas are additive. A Python analysis script may warrant `kieran-python` plus `python-ds`; an R notebook with statistical tests may warrant `r-code` plus `r-pipeline`, `methods` and `reproducibility`.

Announce the team before spawning:

```
Review team:
- correctness (always)
- testing (always)
- maintainability (always)
- project-standards (always)
- method-learnings-researcher (always)
- methods -- logistic regression model with hypothesis testing in analysis.py
- reproducibility -- analysis notebook without seed or environment spec
- python-ds -- pandas and sklearn imports with manual transform steps
- kieran-python -- new Python module with public functions
- performance -- large data join operation in preprocessing pipeline
```

This is progress reporting, not a blocking confirmation.

## Stage 3b: Discover project standards paths

Before spawning sub-agents, map each relevant criteria file to the changed files it governs. Search the tree under review for `CODING_STANDARDS.md`, `AGENTS.md`, and `CLAUDE.md`, then keep files whose directory is an ancestor of a changed path.

Apply path-scoped `AGENTS.md` and `CLAUDE.md` instructions wherever they govern; they remain binding repository guidance. Add any governing `CODING_STANDARDS.md` as designated code criteria and deduplicate equivalent rules during synthesis. In remote scope, enumerate and read criteria from the reviewed head rather than the current checkout. Treat a failed or uncertain search as uncertainty, never as an empty result.

Pass the resulting criteria-to-changed-files mapping to the `project-standards` persona inside a `<standards-paths>` block (see Stage 4). In local scope, the persona reads the mapped paths. In remote scope, include the criteria content read from the reviewed head because local paths may name a different revision.

## Stage 3c: Apply the fail-closed lite-roster gate

`depth:full` always keeps the complete Methodsmith roster. With `depth:auto`, use the lite roster only when all of the following are known from the Stage 1 diff: 1-39 executable changed lines, no untracked or uncounted paths, no changed tests/configuration/instructions, no auth, privacy, PHI, data mutation, external API, credentials, serialization, concurrency, filesystem, or process-execution signal, and no conditional reviewer beyond project standards. Any uncertainty uses the complete roster.

The lite roster is `method-correctness-reviewer` plus `method-project-standards-reviewer` when Stage 3b found an applicable standards file. Record the selected roster and the reason in Coverage. This optimization never applies to analytical code, notebooks, statistical methods, or reporting artifacts: those retain Methodsmith's methods, reproducibility, multiplicity, and stack-specific review paths regardless of size.
