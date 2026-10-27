---
name: method-question
description: "Turns one chosen biomedical study idea into PICO, FINER, a hypothesis, and PubMed-query YAML. Use when the user wants PICO/FINER framing; open design exploration goes to method-brainstorm."
argument-hint: "<one-line research question>, optional: --ideation-survivor <path>"
---

# Research Question Hardening


## Skill Value

- **Problem it solves:** Literature search, cohort building, and SAP writing drift when the research question is not structured.
- **Use when:** The user has a clinical or biomedical study idea that needs PICO/FINER framing before evidence search.
- **Output:** analysis/research-question.yaml plus __CE_RESEARCH_QUESTION__ handoff.
- **Ask only if:** Only for missing PICO, hypothesis, feasibility, or outcome elements that cannot be inferred.
- **Do not do:** Do not write the SAP or run literature extraction.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Turns a fuzzy clinical research question into a structured `analysis/research-question.yaml` that the rest of the biomedical lifecycle reads as input. The output is a small YAML file, not a long requirements doc — for the long requirements form use the `method-brainstorm` skill. The two skills are complementary: brainstorm produces narrative requirements; this skill produces structured biomedical data.

## When this skill activates

- After `method-ideate` biomedical-research mode has produced a survivor candidate the user wants to harden
- When the user describes a study idea in one sentence and the next step is `method-pubmed` but the query is too vague
- Before `method-checklist` if the design is unclear and the routing questions can't be answered cleanly
- Manual: `method-question "sepsis bundle adherence and 30-day mortality in adult ICU patients"`
- Triggered also when a user starts the lifecycle but a `method-pubmed` search comes back too broad (the hit-count rule in the suggested-query step)

## Prerequisites

- One sentence describing the research question, OR a path to an `method-ideate` survivor

## Evidence access

Read `references/evidence-access.md` before any literature lookup (PubMed and Paperclip MCP tools, fallbacks, and rules); never invent a citation, effect size, or guideline item.

- **Look up here:** the FINER novelty check (search, read the closest prior paper, cite its PMID at the level read) and the suggested PubMed query, which must be test-run with `pubmed_search_articles` or `search_articles` to record its hit count before it is written to the YAML.

## Core workflow

### Step 1: Decompose into PICO

Ask the user one question at a time (or extract from the survivor) until the four PICO slots are filled:

| Slot | Definition | Example |
|------|------------|---------|
| **P**opulation | Inclusion criteria, setting, demographic constraints | "Adult ICU patients (≥ 18) with sepsis-3 criteria, 2018-2023, US academic medical centers" |
| **I**ntervention or **E**xposure | What is being tested or compared | "Timely initiation of all clinically indicated Hour-1 sepsis components under prespecified component-specific rules" |
| **C**omparator | What is the alternative | "At least one indicated component not initiated within its prespecified window; nonindicated components are not failures" |
| **O**utcome | What is being measured, with timing | "30-day all-cause mortality, with ascertainment regardless of discharge" |

For sepsis-bundle examples, record component indications, recognition/time zero, initiation versus completion, and any grace period. Fluids and vasopressors are conditional; the Hour-1 bundle does not require every action to be completed within an hour for every patient (official SCCM bundle: https://sccm.org/SCCM/media/SCCM/PDFs/Surviving-Sepsis-Campaign-Hour-1-Bundle.pdf). A stricter study-defined measure needs its own justification. Confirm vital-status coverage after discharge before choosing 30-day all-cause mortality; if only in-hospital deaths are observable, name that distinct outcome and its discharge handling consistently throughout PICO and YAML.

For descriptive or prediction studies, the comparator slot may be `null` — record that explicitly so downstream skills know the design is not comparative.

For target-trial-emulation candidates, additionally elicit: eligibility criteria (assessable at time zero), treatment strategies (full specification, exhaustive so every eligible person fits one arm), assignment procedure (and confounders that need adjustment), follow-up start/end with time zero at eligibility plus strategy assignment in every arm, any grace period, outcome ascertainment, causal contrast, and analysis plan (Hernán & Robins, Am J Epidemiol 2016, PMID 26994063). For a trial, elicit what happens when patients stop, switch, receive rescue therapy, or die before the outcome, so the SAP can state an ICH E9(R1) estimand.

### Step 2: Score on FINER

Five 1-5 ratings, each with a one-line rationale:

- **F**easible — cohort size accessible, IRB feasibility, time horizon realistic, data infrastructure exists
- **I**nteresting — does the field care; is the question alive
- **N**ovel — is this already answered (search with the Evidence access tools, read the closest prior paper, cite its PMID, and label the level read; a result-list title is not evidence)
- **E**thical — equipoise, IRB-able, consent feasible
- **R**elevant — will the answer change practice

If any score is ≤ 2, surface the issue plainly. A weak FINER score is not a refusal — many strong studies score poorly on novelty (replication is valuable). It is a flag the user must acknowledge.

### Step 3: Suggest a design

From PICO + FINER, propose one design:

| Signal | Design |
|--------|--------|
| Intervention is randomly assignable + clinical equipoise | RCT |
| Intervention not randomizable + comparator group exists in data | Cohort (prospective if data starting now, retrospective otherwise) |
| Outcome is rare → working backward from cases | Case-control |
| Goal is to predict an outcome from a set of features | Prediction model (development → external validation → impact) |
| Goal is to estimate a causal effect from observational data | Target trial emulation (cohort with explicit emulation framing) |
| Goal is to evaluate a diagnostic test | Diagnostic accuracy (cross-sectional or paired) |

### Step 4: Suggest a PubMed query

Build the PubMed query string the user will run via `method-pubmed`. Use MeSH terms when the population/exposure/outcome maps to one cleanly; fall back to free-text + MeSH-major filters when not. Include:

- Population MeSH terms with explosions (e.g., `"Sepsis"[Mesh]`)
- Exposure / intervention as either MeSH (`"Patient Care Bundles"[Mesh]`) or free-text
- Outcome as either MeSH (`"Mortality"[Mesh]`) or free-text plus a study-type filter

Keep the query 80% recall, 20% precision — `method-pubmed` will narrow further with `--years` and `--study-type`.

Test-run the query before writing it: call `pubmed_search_articles` or `search_articles` with a small `max_results` and record the total hit count and the run date in the YAML. 0 hits means loosen the query; more than ~1000 hits with no MeSH alignment means tighten it. The query carries PICO terms only, never patient-level values. Without a PubMed MCP, run the `method-pubmed` E-utilities script for the count. This single count check is not the literature search; `method-pubmed` runs that.

### Step 5: Suggest a primary reporting checklist

This is a hint to `method-checklist`. Map the design to the most likely primary checklist:

| Design | Primary checklist | Companions / extensions |
|--------|-------------------|-------------------------|
| RCT (`ai_involvement: none`) | CONSORT (2025) | -- |
| RCT (AI intervention; `ai-primary` or `llm-based`) | CONSORT (2025) | CONSORT-AI |
| Observational cohort | STROBE (STROBE-MR replaces it for Mendelian randomization) | RECORD if EHR/claims/registry; RECORD-PE if pharmacoepidemiology on those data |
| Target trial emulation | TARGET (standalone) | RECORD if routinely collected EHR/claims/registry data |
| Prediction model (regression or ML) | TRIPOD+AI | TRIPOD-Cluster if clustered/multisite data; REFORMS if `ai-primary` or `llm-based` |
| Diagnostic accuracy | STARD (STARD-AI replaces it for an AI index test) | CLAIM if imaging AI |
| Systematic review | PRISMA (PRISMA-DTA / -NMA / -IPD / -ScR replace it by subtype) | QUADAS-3 for DTA appraisal |
| Early clinical evaluation of an AI decision-support system (`early-clinical-ai-evaluation`) | DECIDE-AI | -- |

When the next deliverable is a protocol rather than a results paper, set `protocol_stage: true`: trial protocols route to SPIRIT 2025 (plus SPIRIT-AI for AI interventions) and systematic-review protocols to PRISMA-P.

Use the canonical `ai_involvement` values `none`, `ai-assisted`, `ai-primary`, or `llm-based` when recording AI involvement.

The actual routing decision still happens in `method-checklist` — this is just a defaulted suggestion to write into the YAML.

### Step 6: Write `analysis/research-question.yaml`

```yaml
research_question:
  one_line: "Among adult ICU patients with sepsis-3, does 1-hour bundle adherence reduce 30-day mortality?"
  pico:
    population:    "Adult ICU patients (≥18) with sepsis-3, 2018-2023, US academic medical centers"
    intervention:  "Timely initiation of all indicated Hour-1 components under prespecified component-specific rules"
    comparator:    "At least one indicated component not initiated in its window; nonindicated components not counted as failures"
    outcome:       "30-day all-cause mortality, regardless of discharge; requires confirmed vital-status coverage"
  target_trial:          # only when suggested_design is a target trial emulation; slots in references/pico-templates.md
    eligibility:           "..."
    treatment_strategies:  "..."
    assignment_procedure:  "..."
    follow_up_start:       "..."
    follow_up_end:         "..."
    outcome_ascertainment: "..."
    grace_period:          "..."
    causal_contrast:       "..."
    analysis_plan:         "..."
  finer:
    feasible:    {score: 4, rationale: "EHR data available; n≈8k expected"}
    interesting: {score: 5, rationale: "Active controversy on bundle benefit"}
    novel:       {score: 3, rationale: "Prior RCTs of protocolised early sepsis care (ProCESS, PMID 24635773, read: abstract); bundle adherence in academic-only cohorts underexplored"}
    ethical:     {score: 5, rationale: "Observational; no consent burden beyond HIPAA waiver"}
    relevant:    {score: 5, rationale: "Practice change if effect size > 5 percentage points"}
  suggested_design:    "Target trial emulation (retrospective EHR cohort)"
  suggested_checklist: TARGET
  suggested_extensions: [RECORD]           # TARGET is standalone; RECORD because the data are routinely collected EHR
  ai_involvement: none                     # none | ai-assisted | ai-primary | llm-based
  protocol_stage: false                    # true when the next deliverable is a protocol (SPIRIT 2025 / PRISMA-P)
  suggested_pubmed_query: '("Sepsis"[Mesh]) AND ("Patient Care Bundles"[Mesh] OR "bundle adherence"[Title/Abstract]) AND ("mortality"[Mesh] OR "30-day"[Title/Abstract]) AND ("Cohort Studies"[Mesh])'
  suggested_pubmed_query_hits: 45          # total_count from the pubmed_search_articles / search_articles test run; re-run before relying on it
  query_checked_on: <YYYY-MM-DD>           # date of that test run, resolved at runtime
  source_ideation: docs/ideation/2026-04-28-ideation-doc.md   # if --ideation-survivor was passed
```

### Step 7: Emit signal

```
__CE_RESEARCH_QUESTION__ yaml=analysis/research-question.yaml design=<...> checklist=<...> query=<one-liner-quoted>
```

`method-pubmed` reads this and uses `query` as the default if no query is passed on the command line. `method-checklist` reads it and pre-fills the routing answers.

## What this skill does NOT do

- Does not run the literature search (next: `method-pubmed`); the single hit-count test of the suggested query is not a literature search
- Does not match to a checklist (next: `method-checklist`; this skill only suggests)
- Does not produce a long-form requirements doc (use the `method-brainstorm` skill for that)
- Does not write the SAP (use the `method-plan` skill after the lifecycle has more inputs)

## References

@./references/pico-templates.md — PICO templates by design type, including target-trial-emulation slots
@./references/finer-rubric.md — Scoring guidance for each FINER dimension with worked examples
@./references/checklist-routing-hints.md — Design → primary checklist mapping (mirrors `method-checklist`)
