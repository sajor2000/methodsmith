---
name: method-cohort
description: "Defines a reproducible study cohort: inclusion/exclusion, index event, pinned concepts, SQL, waterfall counts. Use when an EHR, OMOP, claims, or phenotype cohort is needed."
argument-hint: "<cohort name>, optional: --vocab omop|icd10|icd9|cpt|loinc|snomed --index-event <event>"
---

# Cohort Definition Builder


## Skill Value

- **Problem it solves:** Cohort definitions are a common source of irrecoverable bias when criteria, timing, and code lists are implicit.
- **Use when:** The user needs an EHR, OMOP, claims, phenotype, or observational-study cohort before data QA or SAP finalization.
- **Output:** Cohort spec YAML, concept-set files or code lists, SQL/CTE query, and CONSORT-style waterfall counts.
- **Ask only if:** Only for cohort facts not supplied by PICO, prior research-question YAML, data source, or user prompt.
- **Do not do:** Do not run downstream modeling or pretend a vague population is a locked cohort.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Walks the user through defining a research cohort with vocabulary-pinned concept sets and an explicit index event. Cohort definition is the most common source of unrecoverable bias in observational research; this skill makes the definition explicit, version-controlled, and replayable.

## When this skill activates

- Starting a new observational study using EHR / claims / registry data
- Re-defining a cohort after a vocabulary refresh (e.g., 2023 ICD-10-CM changes)
- Validating an existing cohort by replaying its definition against a fresh extract
- Manual: `method-cohort "T2DM with statin initiation 2018-2023" --vocab omop`

## Prerequisites

- `stack_profile.data_root` is set (cohort runs against this)
- **Sensitive-data boundary.** Resolve `phi_environment.mode` in `.methodsmith/config.local.yaml` (worktree, then main checkout; legacy `compliant: true` = `approved`, `compliant: false` = `schema-only`, `sensitive_data: false` = `no-sensitive-data`; any schema-only signal wins; unreadable = `schema-only`). `approved` or `no-sensitive-data`: proceed silently and never mention the boundary again. `schema-only`: headings, types, counts, and aggregates only; never open, print, or paste data values; run data-reading scripts as `method-safe-run -- <command>` (path in the guard's deny message); save results as aggregate tables (counts under 11 suppressed) in `output/` or a `phi_environment.aggregate_dirs` entry. Unset, interactive: ask once with the blocking question tool (else a numbered list) offering `Approved endpoint: full access`, `Not approved or unsure: schema-only`, and `No sensitive data: public or synthetic`; save the answer as `phi_environment.mode` there once `git check-ignore -q .methodsmith/config.local.yaml` passes (else first add `.methodsmith/*.local.yaml` to `.gitignore`) so the guard hook sees it. Unset, headless: schema-only. In `schema-only`, generate the cohort script and read back only the aggregate waterfall counts.
- For OMOP: vocabulary tables exist (`concept`, `concept_ancestor`, `concept_relationship`)
- For non-OMOP: a code-list file (CSV or YAML) with `code,vocab,description`

## Core workflow

### Step 0: Context inputs (scan chat first)

Before eliciting cohort criteria, scan the most recent ~50 chat turns for `__CE_RESEARCH_QUESTION__ yaml=<path>`. If found, read the YAML and use it as the seed:

- `pico.population` → starting point for inclusion criteria (the user can refine, but the population is already framed)
- `pico.intervention` (or `pico.exposure` for observational templates) → starting point for the index event / exposure concept set
- `pico.comparator` → seed for the comparator concept set when comparator is non-null
- `pico.outcome` → seed for the outcome concept set used in follow-up
- `suggested_design` → if it starts with "target trial", surface the target_trial.* slots as additional inputs

Print: `[research-question] seeding cohort from analysis/research-question.yaml; pico.population = "..."`. The user still confirms each criterion in step 1; pre-seeding shortens the conversation, it does not skip review.

When `__CE_RESEARCH_QUESTION__` is absent, fall through to step 1 cold.

**CLIF profile**: if chat context contains `__CE_CLIF__ active=true`, switch defaults. Treat `https://clif-icu.com/` and the matching `version=` + `mcide_version=` values in the CLIF handoff as the authoritative data-dictionary family. If the pair is missing, incomplete, or mixed, route to the `method-clif` skill before emitting `_category` filters.

- Default source schema is the CLIF relational schema (read from Parquet files). Skip OMOP CTE generation; instead emit a `polars` (Python) or `arrow` + `dplyr` (R) script that reads `hospitalization.parquet`, `adt.parquet`, etc. from the `tables_path` in `config/config.json`.
- The cohort identifier is `hospitalization_id` (VARCHAR). Persist patient-level cohort IDs only as `output/intermediate_phi/cohort_ids.parquet` after verifying that path is approved, local, non-synced, and gitignored (otherwise under the approved restricted data root) — never CSV, never with an integer cast, and never share or commit them.
- Inclusion criteria default to `adt.location_category == "icu"` for ICU studies; `hospitalization.age_at_admission >= 18` for adult studies.
- All datetime filters are timezone-aware UTC.
- Write only disclosure-reviewed cohort-flow summaries to `output/final_no_phi/cohort_waterfall.csv`; replace SQL/CTE generation with a `code/01_cohort_<name>.{py,R}` script that starts the template workflow.
- `_category` filters must use mCIDE allow-listed values from the selected family. Use the bundled cache only for 2.1 + 2.1; for 3.0 + 3.0, require the declared v3 mCIDE source. Refuse to emit a filter with an unknown category string.
- For canonical code patterns, route by language: `__CE_LANG__ primary=python` -> use `clifpy` and `ClifOrchestrator` rather than rolling your own joins; `__CE_LANG__ primary=r` -> use `arrow::open_dataset()` per the CLIF project-template layout. If `__CE_LANG__` is absent, load the `method-language-detect` skill first; if still `unknown`, surface both implementation choices.

### Step 1: Elicit the cohort definition

Ask the user (or parse from `args`):

1. **Name and purpose** -- one sentence, becomes `cohort_name` and `cohort_purpose`
2. **Vocabulary** -- omop / icd10 / icd9 / cpt / loinc / snomed / mixed
3. **Vocabulary version** -- "OMOP v5.4 vocab 2024-Q1", "ICD-10-CM 2024", "SNOMED CT 2024-03-01". This MUST be pinned; vocabulary drift is a common cause of irreproducible cohorts
4. **Index event** -- the moment time-zero is defined (first diagnosis date, first prescription date, hospital admission, randomization)
5. **Inclusion criteria** -- positive criteria (must have)
6. **Exclusion criteria** -- negative criteria (must not have); each with a window (e.g., "no statin in prior 365 days")
7. **Eligibility window** -- continuous enrollment / observation window (e.g., 180 days prior, 365 days follow-up)
8. **Wash-out / look-back** -- explicit prior-period requirements
9. **Comparator** -- for a comparative claim, an active comparator of new users of an alternative with the same wash-out and enrollment rules, or sequential trial emulation for initiators versus non-initiators (Lund, Richardson & Stürmer, Curr Epidemiol Rep 2015, PMID 26954351); `none` only for descriptive cohorts

### Evidence access

Read `references/evidence-access.md` before any literature lookup (PubMed and Paperclip MCP tools, fallbacks, and rules); never invent a citation, effect size, or guideline item.

- **Look up here:** validated code sets and phenotype algorithms for each criterion (PheKB, eMERGE, OHDSI/OMOP phenotype studies) with their reported PPV and sensitivity, cited by PMID; a concept set without a read, published precedent is `project-defined` and the spec must say so.

### Step 2: Build concept sets

For each criterion, build a concept set:

```yaml
concept_set:
  name: T2DM
  vocabulary: OMOP
  vocabulary_version: 2024-Q1
  primary_concepts:
    - { concept_id: 201826, concept_name: "Type 2 diabetes mellitus", domain: Condition, vocabulary: SNOMED }
  include_descendants: true
  excluded_concepts:
    - { concept_id: 201254, concept_name: "Type 1 diabetes mellitus" }
```

Save concept sets to `analysis/cohort/concept-sets/<set-name>.yaml`. Set `source:` to the published algorithm the set follows (PheKB/eMERGE/OHDSI identifier plus PMID) or `project-defined`, and record any reported PPV/sensitivity in the optional `literature:` block with its PMID and evidence label (see `references/concept-set-yaml.md`); never copy a literature value into the project's own `validation` block, which `method-phenotype` fills from chart review.

### Step 3: Generate cohort SQL

For OMOP, emit a CTE-based query against the standard schema (`person`, `condition_occurrence`, `drug_exposure`, `procedure_occurrence`, `measurement`, `observation_period`). Use parameterized concept-set joins so the same SQL replays after a vocab refresh.

For non-OMOP / claims, emit a join against the source tables using the user-provided code lists.

Save the SQL to `analysis/cohort/sql/<cohort-name>.sql` with comments referencing each concept-set YAML.

### Step 4: Generate the CONSORT waterfall

Run the SQL (or print it for the analyst to run) and capture the cascade:

```
Persons in source                            : N0
  + has qualifying index event in window      : N1 (lost N0 - N1)
  + meets inclusion criteria at index         : N2 (lost N1 - N2)
  + continuous observation before index       : N3 (lost N2 - N3)
  - exclusion criterion 1 (window rel. index) : N4 (lost N3 - N4)
  - exclusion criterion 2                     : N5 (final cohort)
```

Assign the index date first: look-back exclusions and enrollment are defined relative to it. Each count is cumulative (persons remaining after every earlier step). All eligibility criteria must be assessable at time zero; never require post-index information such as a second fill or minimum follow-up.

Save as `analysis/cohort/<cohort-name>-waterfall.md` and `analysis/cohort/<cohort-name>-waterfall.csv`. This is the CONSORT-style figure for the manuscript.

**Small-cell suppression (always, not only in CLIF mode):** waterfall steps are aggregate counts, but a step that loses very few patients can still disclose. Before saving or sharing the waterfall, suppress or merge any step whose lost-N is below the project's disclosure floor (default n<11 unless the project declares its own floor, for example the CLIF consortium floor of n>=10, or a site or DUA rule is stricter), and never annotate a step with patient-identifying examples.

### Step 5: Write the cohort spec

`analysis/cohort/<cohort-name>.yaml`:

```yaml
cohort_name: T2DM_statin_init_2018_2023
cohort_purpose: ...
vocabulary: OMOP
vocabulary_version: 2024-Q1
data_wave_id: <from analysis/data-waves.md>
index_event:
  description: First statin prescription on or after T2DM diagnosis
  source: drug_exposure
  concept_set: statin_initiation
inclusion:
  - concept_set: T2DM
  - continuous_enrollment_prior_days: 365
exclusion:
  - { concept_set: T1DM, window: any }
  - { concept_set: statin_use, window: prior_365_days }
comparator:
  design: active_comparator_new_user   # or: sequential_trial_emulation / none (descriptive)
  concept_set: <comparator_initiation>
  same_washout_and_enrollment_rules: true
follow_up:
  start: index_date
  end: index_date + 365 days OR earliest_of(death, lost_to_followup, study_end)
final_n: <from waterfall>
```

### Step 6: Compound learning hook

If the cohort waterfall loses more than half the remaining persons at any single step (a heuristic; use the project's threshold if it sets one), suggest `method-compound` to capture the dropout pattern -- this is where cohort definitions go wrong silently.

## What this skill does NOT do

- Does not run statistical analysis (use the `method-work` skill)
- Does not validate the phenotype against chart review (use the `method-phenotype` skill)
- Does not validate the resulting dataset (load the `method-data-qa` skill next; the CONSORT waterfall produced here is the data-quality starting point)
- Does not replace the SAP — the cohort spec is referenced FROM the SAP, not instead of it
- Does not de-identify (use the `method-data-qa` skill and `method-phi-leak-reviewer` for that)

## Handoff signal

After step 5, print one line so `method-plan` SAP mode and `method-data-qa` can pick this cohort up from chat context:

```
__CE_COHORT__ name=<cohort-name> n=<final-n> yaml=<path-to-cohort.yaml> waterfall=<path-to-waterfall.csv>
```

The `yaml=` key points at the cohort spec (`analysis/cohort/<cohort-name>.yaml` from step 5); `waterfall=` points at the CONSORT waterfall CSV from step 4. Both keys must be present so downstream skills can pick whichever they need.

## References

`scripts/concept_set_to_capr.R` — converts a concept-set YAML into Capr concept-set R code and ATLAS-compatible JSON, then prints a `__CE_COHORT_CAPR__` summary line; use it when `__CE_LANG__ primary=r` and the cohort is OMOP-based. It requires the `Capr` and `yaml` R packages and stops when `vocabulary_version` is missing:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
Rscript "$SKILL_DIR/scripts/concept_set_to_capr.R" --in analysis/cohort/concept-sets/<set>.yaml --out-r analysis/cohort/concept-sets/<set>.R --out-json analysis/cohort/concept-sets/<set>.json
```

@./references/omop-cohort-template.sql

@./references/concept-set-yaml.md

@./references/eligibility-windows.md
