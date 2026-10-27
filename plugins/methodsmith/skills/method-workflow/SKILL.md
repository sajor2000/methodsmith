---
name: method-workflow
description: "Shows the methodsmith study lifecycle for the current project and recommends the next safe skill. Use when the user asks what to run next or wants lifecycle status."
---

# Workflow Navigator


## Skill Value

- **Problem it solves:** Users do not know which slash skill comes next after setup, QA, SAP, sprint, or analysis work.
- **Use when:** The user starts or resumes a science project, feels unsure what to run next, or wants lifecycle status.
- **Output:** Lifecycle card with detected project type, current status, and next recommended skill.
- **Ask only if:** Only when project type remains ambiguous after scanning repo and stack-profile signals.
- **Do not do:** Do not run lifecycle skills or modify project state.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Shows the ordered skill sequence for a science project, detects progress, and recommends the next step. Read-only guidance — does not replace any existing skill.

## Stack Profile

The repository root is pre-resolved at skill load:
!`git rev-parse --show-toplevel 2>/dev/null || true`

Use the resolved absolute path or resolve it at runtime, then read `.methodsmith/config.local.yaml` with the native file-read tool. In a linked worktree, fall back to the main checkout when the machine-local file is absent. Parse these `stack_profile` keys: `language`, `ide`, `reporting`, `data_layer`, `clif.data_dictionary_version`, `clif.mcide_version`, and the optional `inference` map; if no config can be read, infer them from project files.

Treat a saved inference value with its `confidence` and `evidence` as a reusable
setup handoff. Do not re-ask a setup question when a high-confidence value is
available. If routing must use a fallback, say so and name the missing evidence
that would refine it.

## Phase 0: Detect Signals

Scan the working directory for project-type signals. Do not ask the user yet.

**CLIF signals** (strong signals → auto-route to CLIF overlay; weak signals need 2+ to route):

Strong (any one sufficient):
- `CLIF_CLAUDE.md` at repo root
- Git remote contains `clif-consortium` or `clif-icu`
- `__CE_CLIF__ active=true` in chat context

Weak (need 2+ together):
- `mCIDE/` directory exists
- `clif_*.parquet` files exist
- `WORKFLOW.md` at repo root

Do NOT route to CLIF for: generic `patient.parquet`, `vitals`, `labs`, `renv.lock` alone, or `WORKFLOW.md` alone — these appear in non-CLIF EHR projects.

When CLIF routes, reuse a matching saved `data_dictionary_version` +
`mcide_version` pair or a matching `__CE_CLIF__` handoff. If the family is
absent, incomplete, or mixed, recommend `method-clif` as the next safe skill and
state that it will ask the user to choose CLIF 2.1 + mCIDE 2.1 or CLIF 3.0 +
mCIDE 3.0. Do not infer 3.0 from `mCIDE/` alone or silently apply v2.1.

**OMOP signals** (any one → observational study + OMOP overlay):
- SQL files referencing `cdm_source`, `concept`, `person`, or `observation_period`
- `analysis/cohort/` contains `.sql` with OMOP table names

**Bioinformatics signals** (any one → bioinformatics path):
- `.fastq`, `.fastq.gz`, `.bam`, `.vcf` files in project tree
- `Snakefile`, `nextflow.config`, or `workflow/Snakefile` exists
- `Bioconductor` in `renv.lock` or `DESCRIPTION`

**Claims signals** (any one → observational-study + claims overlay):
- Medicare, Medicaid, MarketScan, NDC, enrollment-gap, or payer-claim logic in active analysis files

**Generic EHR signals** (two or more → observational-study + generic-EHR overlay):
- cohort, encounter, diagnosis, medication, laboratory, or vital-sign fields in active analysis files

**No biomedical signals** → default to Technical / software path without asking and label the route `fallback: no biomedical project evidence`.

## Phase 1: Detect or Ask Project Type

If signals clearly indicate a project type, auto-route and print a one-line banner with its evidence:

```
[method-workflow] Auto-detected: Observational study (CLIF data layer, R; evidence: CLIF_CLAUDE.md, clif_*.parquet)
```

If project type remains unclear after scanning available files, ask this routing question using the Skill Value interaction rule above.

**Question:** "What type of project is this?"

**Options:**
1. Observational study (cohort, case-control, cross-sectional)
2. Clinical trial analysis (RCT, trial emulation)
3. Prediction / ML model (development, validation, impact)
4. Bioinformatics / omics (genomics, transcriptomics, proteomics)

## Phase 2: Detect Progress and Emit Card

Read `references/lifecycle-paths.md` for the skill sequence matching the project type. Then read `references/state-detection.md` and check each signal to determine step status:

- Done: file artifact exists and appears complete
- In progress: artifact exists but is partial or ambiguous
- Not started: no artifact found

Resolve language from the highest-confidence compatible source in this order:
explicit current request, saved profile, saved inference, `__CE_LANG__`, then
project files. Resolve data domain from Phase 0 signals or saved inference
(OMOP, CLIF, admin claims, bioinformatics, generic EHR, or generic data). Never
convert an unknown language to `both`; show `unknown` and recommend setup only
when the selected lifecycle needs a language-specific artifact.

Emit the lifecycle card (an example rendering for Path 1; take the steps from `references/lifecycle-paths.md`):

```
## Workflow: Observational Study (OMOP)
Language: Python (Jupyter) | Data layer: OMOP

 1. [done] `method-question`    analysis/research-question.yaml
 2. [done] `method-pubmed`                analysis/pubmed/
 3. [    ] `method-extract`
 4. [    ] `method-checklist`       STROBE + RECORD
 5. [    ] `method-meta-analysis`
 6. [    ] `method-power`
 7. [    ] `method-cohort`          OMOP SQL + concept sets
 8. [    ] `method-data-qa`
 9. [    ] `method-phenotype`
10. [    ] `method-model-choice`
11. [    ] `method-plan` (SAP mode)
12. [    ] `method-sap-workbook`
13. [    ] `method-sprint`
14. [    ] `method-work`                  Jupyter .ipynb
15. [    ] `method-review`

Next step: `method-extract`
  Extract statistical methods from your PubMed results for SAP justification.
```

Render each status as `[done]`, `[wip ]` (in progress), or `[    ]` (not
started), and after each done or in-progress step name the artifact that set it.

When `analysis/numbers/registry.json` exists, add a `Numbers:` line under the card with the `method-numbers` gate status from `references/state-detection.md` (`PASS`, `FAIL` with its problem count, or `not run`); a `FAIL` makes fixing it the next step before any manuscript or submission step.

Inline language-specific and data-layer notes at the steps where they matter (e.g., step 7 shows "OMOP SQL + concept sets" or "CAPR + SQL" depending on language; step 14 shows "Jupyter .ipynb" or "Marimo .py" or "Quarto .qmd").

If all steps are complete, emit: "All lifecycle steps complete. Load the `method-compound` skill to document learnings."

If no stack profile exists, append: "Run the `method-setup` command first to review the detected profile."

## What this skill does NOT do

- Does not run any lifecycle skill — it only recommends the next one
- Does not replace setup -- the user must run the `method-setup` command first for a full stack profile (it is manual-invocation-only)
- Does not create files or modify project state
- Does not replace `method-clif` — CLIF activation happens automatically via `method-clif`

## References

`references/lifecycle-paths.md` — Ordered skill sequences for all 5 project types with language branches and data-layer overlays

`references/state-detection.md` — File-system signals used to infer which steps are complete
