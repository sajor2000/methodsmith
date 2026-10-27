---
name: method-checklist
description: "Selects EQUATOR reporting guidelines (CONSORT, STROBE, RECORD, PRISMA, TRIPOD+AI, TARGET, STARD, CLAIM) for a study. Use when the user asks which reporting checklist applies."
argument-hint: "[study description, optional --interactive]"
---

# Reporting Checklist Match


## Skill Value

- **Problem it solves:** Reporting requirements are often discovered too late, after the SAP or manuscript misses required design-specific items.
- **Use when:** The user asks which checklist applies, mentions EQUATOR/reporting standards, or starts a study without a guideline.
- **Output:** Canonical stack-profile fields for primary reporting_checklist and reporting_checklist_extensions, resolved through the evidence-backed guideline registry.
- **Ask only if:** Only for routing facts that cannot be inferred from the research question, design, data source, or existing profile.
- **Do not do:** Do not score a finished manuscript; reporting-checklist review happens during code/document review.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Picks the right reporting checklist(s) at PLAN time so the SAP is written against them, not corrected after the fact. Distinct from `method-reporting-checklist-reviewer` which validates AT REVIEW time -- this skill makes the upfront choice.

## When this skill activates

- During `method-ideate` after the study premise is solidified
- During `method-plan` BEFORE drafting the SAP
- Whenever the user asks "which checklist do I follow?"
- When `stack_profile.reporting_checklist` is empty AND a SAP exists

## Prerequisites

- A one-line study description (or `method-ideate` output)
- Stack profile exists (the user has run the `method-setup` command; if not, ask them to, or infer the stack from the repository and confirm)

## Evidence access

When this run needs literature, read `references/evidence-access.md` first; never invent a citation, effect size, or guideline item.

- **Look up here:** the target journal's required checklist (journal author guidelines via web search, URL kept) and the current version of each selected guideline: confirm the statement citation by PMID with the metadata tool before it is written into the `analysis/checklists/` placeholder. The guideline registry's citations themselves are owned by `method-review`.

## Core workflow

### Step 0: Context inputs (scan chat first)

Before asking routing questions, scan the most recent ~50 chat turns for `__CE_RESEARCH_QUESTION__ yaml=<path> design=<...> checklist=<...>`. If found, read the YAML and pre-fill these routing answers from the structured fields, then ask only the questions still unanswered:

| Routing question | Pre-fill from YAML field |
|---|---|
| Design | `suggested_design` (cohort / case-control / RCT / prediction model / target trial / etc.) |
| Direction (prospective / retrospective) | infer from `pico.population` time frame |
| AI involvement | infer from `pico.intervention_or_exposure` and `suggested_design` |
| Population | `pico.population` |

Pre-fills are starting points, not answers — the model must surface them and let the user override before writing to stack profile. Example:

```
[research-question] pre-filled from analysis/research-question.yaml:
  design: cohort_retrospective
  ai_involvement: none                         # none | ai-assisted | ai-primary | llm-based
  population: human
  primary checklist (suggested): STROBE
  extensions (suggested): RECORD
Confirm or correct any of these? (or say "go" to accept all)
```

When `__CE_RESEARCH_QUESTION__` is absent, fall through to step 1 and ask all questions.

**CLIF profile**: when chat context contains `__CE_CLIF__ active=true`, pre-fill `data_source = EHR (CLIF)` and bias the routing toward:

- Observational cohort → STROBE + RECORD (always; CLIF is EHR-derived).
- Prediction model → TRIPOD+AI.
- Target trial emulation → TARGET as primary, with RECORD (CLIF is EHR-derived); STROBE only when the journal requires it.
- RCT using CLIF for outcome ascertainment → CONSORT (and RECORD if outcomes are EHR-defined).

Surface these defaults to the user and let them override before writing to stack profile.

### Step 1: Ask the routing questions

If `--interactive` or the study description is too sparse, ask 4-6 questions one at a time:

1. **Design**: RCT / observational cohort / case-control / cross-sectional / qualitative / systematic review / meta-analysis / case report / animal study / economic evaluation / diagnostic accuracy / prediction model / early clinical evaluation of an AI decision-support tool (`early-clinical-ai-evaluation`)
2. **Direction** (if observational): prospective / retrospective
3. **Aim**: causal / descriptive / predictive / qualitative-exploratory / mixed
4. **AI involvement** (canonical `ai_involvement` values shared with `method-review` and `method-plan`): `none` / `ai-assisted` (AI as a tool within traditional methods, e.g., data cleaning or a classifier in the pipeline) / `ai-primary` (the AI model is the primary analytical approach or the object being evaluated) / `llm-based` (the study uses or evaluates a large language model). Older answers map as: none -> `none`; data-cleaning only -> `ai-assisted`; model-as-tool -> `ai-assisted`; model-as-study-object -> `ai-primary`, or `llm-based` when the model under study is an LLM. Write only the canonical values.
5. **Stage and pre-registration**: protocol stage (`protocol_stage: true` routes trials to SPIRIT 2025 and systematic reviews to PRISMA-P) or results stage; pre-registration planned / not planned / already done
6. **Population**: human / animal / cell / in-silico

If the description already answers some of these, skip those questions. When a target journal is known, look up its author guidelines by web search for a mandated checklist and record the URL; never ask the user to recall it.

### Step 2: Apply the routing rules

Apply `references/routing-map.md` (authoritative, inlined below) to map the answers to a primary checklist, extensions, and any protocol-stage checklist. Apply only evidence-backed entries and preserve provisional or unverified status instead of presenting it as authoritative. Key current rules: TRIPOD+AI is primary for every prediction-model study (it supersedes TRIPOD 2015); always route to the newest version of a guideline, and resolve any old version name to the successor that replaced it; SPIRIT 2025 covers RCT protocols and PRISMA-P systematic-review protocols; DECIDE-AI covers early clinical AI evaluation; TARGET, STROBE-MR, STARD-AI, and the PRISMA subtype checklists (DTA, NMA, IPD, ScR) are stand-alone and replace their base checklist; QUADAS-3 is the DTA-review appraisal tool.

If the answers don't fit a branch, ask a clarifying question rather than guessing.

### Step 3: Write the selection to stack profile

Resolve the repository root with `git rev-parse --show-toplevel` and update `<repo-root>/.methodsmith/config.local.yaml`; never write relative to the current subdirectory. The shape that `method-review` and `method-plan` read is the canonical surface — keep these field names exact:

```yaml
stack_profile:
  # existing fields unchanged
  study_type: cohort_retrospective
  ai_involvement: none                         # none | ai-assisted | ai-primary | llm-based
  reporting_checklist: STROBE                  # canonical primary; non-null string turns on method-reporting-checklist-reviewer
  reporting_checklist_extensions:              # zero or more strings
    - RECORD
```

If a legacy `guidelines_selected` block already exists, leave it in place for compatibility unless the user asks to clean the config. Do not create that legacy block for new configs.

The string form (`reporting_checklist: STROBE`) is what `method-review` Stage 3 conditional dispatches on and what `method-plan` SAP frontmatter reads from. Never write the old boolean form because it was ambiguous (which checklist?) and is deprecated.

### Step 4: Drop the checklist into the project

For each selected guideline, write a placeholder file at `analysis/checklists/<guideline>.md` containing the checklist items as a fillable table. Head it with the guideline statement's citation (PMID/DOI confirmed with the metadata tool) and the version, taken from the matching snippet when one exists (`references/checklist-snippets/CONSORT.md`, `STROBE.md`, `TRIPOD-AI.md`, `SPIRIT.md`, and the plan-time placeholders `TRIPOD-LLM.md`, `DECIDE-AI.md`, `PRISMA-P.md` in the same folder; load only the selected guidelines' snippets). For a guideline without a snippet, write the confirmed citation and an empty table to be filled from the published checklist; never invent items. The user (or `method-work`) fills these as the SAP and analysis develop.

### Step 5: Emit signal for downstream skills

Print one line so `method-plan` SAP mode and `method-review` Stage 3 can pick the selection up from chat context:

```
__CE_CHECKLIST__ primary=STROBE extensions=[RECORD]
```

The bracket-list form mirrors how `method-plan` parses signals in its SAP-Phase 3 step 2 lookup table.

Completion check: the signal, `stack_profile.reporting_checklist`, and the `analysis/checklists/` files name the same guidelines, and every placeholder carries a citation confirmed by PMID or DOI; fix any mismatch before finishing.

## What this skill does NOT do

- Does not validate against the checklist (dispatch the `method-reporting-checklist-reviewer` agent at review time)
- Does not write the SAP (use the `method-plan` skill)
- Does not pre-register (use the `method-prereg` skill)
- Does not explain WHY a checklist was missed -- just which one applies; the validating reviewer handles compliance scoring
- Never commit a reporting-guideline source document (statement PDF, supplement, Word checklist), and never tell the user to; cite it by DOI, PMID, or URL and keep any local copy out of version control.

## References

@./references/routing-map.md
