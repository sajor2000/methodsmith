---
name: method-sap
description: "Deepens a complex SAP with a claim-to-dataset schema (scientific claims, not insurance claims), estimands, and decision evidence. Use when a causal, prediction, or multisite SAP outgrows method-plan."
---

# Claim-Linked Statistical Analysis Plan

"Claim" here means a scientific claim, not an insurance claim; this skill applies to any data source, including administrative claims.

## Skill Value

**Problem it solves:** Turn a clinical or observational study idea into a traceable analysis contract instead of disconnected methods prose.

**Use when:** A clinical or observational SAP needs claim-level linkage among datasets, variables, estimands, diagnostics, outputs, and evidence-backed decisions.

**Output:** A linked claims, datasets, variables, analyses, diagnostics, outputs, and decision-evidence schema for the canonical SAP, or an unresolved-decisions review.

**Ask only if:** Study aim, supporting dataset grain, unit of analysis, estimand, or a high-stakes method decision is not established by the supplied materials.

**Do not do:** Create a competing SAP, own workbook rendering, draft final manuscript prose, present a final method recommendation when data grain is unknown, or silently choose missing-data, causal-timing, or threshold defaults.

## Core Principles

1. **Schema-first, prose-second.** Define study objects before writing workbook tables or methods prose; prose renders the approved schema.
2. **Claims-based organization.** Give every analysis a named scientific claim and estimand. Keep analyses without a claim out of scope.
3. **Dataset-grain awareness.** Map every claim to a supporting dataset, denominator, and unit of analysis before choosing a method.
4. **Diagnostics and sensitivity are first-class outputs.** Attach at least one diagnostic or sensitivity analysis to every primary analysis.
5. **Explicit decisions log.** Record every threshold, recode, exclusion, and nontrivial method choice as an evidence-backed decision.
6. **Executable contract.** Name analysis scripts, output files, cohort scope, and column-level contents so a programmer can implement the plan without inventing specifications.

## Intake and Data Gate

Classify the study's aim (validation, association, prediction, benchmarking, or causal effect) and design (RCT, EHR/registry cohort, cross-sectional, multisite, `early-clinical-ai-evaluation`, or other), and note `protocol_stage: true` when the SAP accompanies a protocol (SPIRIT 2025 for trial protocols, PRISMA-P for review protocols). Capture:

- Study population, inclusion/exclusion criteria, data sources, study window, and site structure.
- Named claims, each with an analysis question and an ICH E9(R1) estimand (treatment, population, variable, intercurrent events with strategies, population-level summary).
- Dataset grain, denominator, identifiers, join keys, and unit of analysis for each claim.
- Exposure/intervention, outcome, covariates, temporal definitions, index date, and follow-up/censoring rules when longitudinal.
- Missing-data mechanism and intended handling, required outputs, and target journal or operational audience.

When data are available, run the `method-data-qa` skill before finalizing variables or models. Keep the SAP draft when provenance, grain, keys, types, row counts, or missing-data handling are unresolved. For observational or causal claims, also make the estimand, assumptions, and success criteria explicit, and specify the target-trial protocol: eligibility (assessable at time zero), treatment strategies, assignment, follow-up start and end, outcome, causal contrast, and analysis plan. Time zero is when eligibility is met and a strategy is assigned, by the same rule in every arm; name any grace period and how it is emulated (e.g., clone-censor-weight), and handle per-protocol deviations with artificial censoring plus inverse-probability weighting. Report against TARGET (2025). Unresolved choices block finalization.

Consume an existing `__CE_MODEL_STRATEGY__` handoff when present. For a nontrivial primary model decision without one, load `method-model-choice` after the data gate. Only `ready_for_review` strategy details may populate an execution-ready model specification; carry `blocked` or `provisional` decisions into the unresolved-decisions review.

Use the platform's blocking question tool for load-bearing gaps. If no such tool is available, present concise numbered questions in chat and wait. Do not silently select a default method or analysis unit.

## Build the Schema

Create these linked objects before rendering any output:

| Object | Required content |
|---|---|
| `Study` | Aim, design, population, sites, protocol/version, study window |
| `Dataset` | Source, grain, denominator, keys, refresh/provenance, analysis-ready status |
| `Claim` | Label, plain-language scientific claim, analysis question, and estimand with all five ICH E9(R1) attributes: treatment conditions compared, population, variable/endpoint with time point, each anticipated intercurrent event with its strategy (treatment policy, hypothetical, composite, while on treatment, or principal stratum), and population-level summary (e.g., risk difference, marginal OR, HR, RMST difference) |
| `Variable` | Role, category, temporal type, source, grain, coding, and analyses that use it |
| `Analysis` | Claim, question, estimand, unit of analysis, supporting dataset, primary/secondary method, model-strategy memo, script, output artifact, and decision ID |
| `Diagnostic` | Assumption or failure mode, diagnostic/sensitivity method, trigger, and interpretation |
| `Output` | Filename, subfolder, cohort scope, column-level contents, and interpretation |
| `Decision_Evidence` | Decision, rationale, threshold or rule, uncertainty, and 1–3 method citations |

Map variables to analyses with a visible `used_by` matrix. Give every analysis a plain-language question beside its estimand. Give each full sensitivity replication its own `SA-<name>` analysis row rather than burying it in prose. A sensitivity analysis targets the same estimand under a changed assumption; an analysis with a different estimand, population, or outcome definition (e.g., per-protocol) is supplementary and gets its own estimand. Read `references/estimands.md` for the attribute and strategy definitions, sensitivity-versus-supplementary rules, the target-trial protocol, and a filled `Claim`/`Analysis`/`Decision_Evidence` example.

## Method and Evidence Routing

Choose methods only after the claim, estimand, unit of analysis, and data structure are known. Use `method-model-choice` to resolve the primary family, link, dependence structure, diagnostics, fallback triggers, and stack-matched scaffold. Account for clustering, repeated measurements, time at risk, competing risks, missingness, validation reference standards, and any benchmarking hierarchy.

For randomized designs, prespecify adjustment covariates before unblinding: baseline only, chosen for prognostic strength (never by testing baseline imbalance), including the randomization stratification factors. State whether the summary is conditional or unconditional (marginal); for a marginal target with a binary or time-to-event outcome, use standardization/g-computation with bootstrap or literature-justified robust SEs (FDA 2023 covariate-adjustment guidance).

For nontrivial choices, record 1–3 citations in `Decision_Evidence`: primary model family, missing-data strategy, competing-risk handling, multilevel structure, agreement metric, composite outcome, causal adjustment, bias-analysis method, or benchmarking model. Find a methods anchor with the tools in `references/evidence-access.md`, read it before citing it, and record PMID/DOI plus the evidence label on the row.

For any observational claim, attach a bias analysis for the systematic errors that could move the estimate. Read `references/bias-sensitivity.md` when a claim needs an unmeasured-confounding or other bias sensitivity analysis, or when the user asks for an E-value; it covers the E-value and its limits, the known-but-unmeasured-confounder bound, and quantitative bias analysis practice.

## Evidence access

Read `references/evidence-access.md` before any literature lookup (PubMed and Paperclip MCP tools, fallbacks, and rules); never invent a citation, effect size, or guideline item.

- **Look up here:** estimand and analysis-method precedents for each `Decision_Evidence` row, plus the missing-data and sensitivity-analysis conventions for the design (RCT, EHR/registry cohort, target-trial emulation, validation, prediction, or benchmarking).

At the first literature lookup of a session, check once which of these servers is connected; never block SAP work on either, do not re-offer setup in the same session, and use the `method-pubmed` script, not ad hoc HTTP calls, when no PubMed server is connected. Use full text only when an abstract cannot verify a needed formula, cutoff, eligibility rule, or methods claim.

## Required Guardrails

- No method choice before `unit_of_analysis` and dataset grain are defined for that analysis.
- No high-stakes method choice without at least one citation in `Decision_Evidence`.
- No analysis without an explicit missing-data strategy and at least one diagnostic entry. Per estimand and variable group, the strategy names the assumed mechanism (MCAR/MAR/MNAR) and why; the primary approach (complete-case only when missingness is plausibly independent of the outcome given model covariates, otherwise multiple imputation or likelihood-based methods); for MI, the imputation model (outcome, all analysis-model variables and interactions, auxiliaries), the number of imputations (at least the percentage of incomplete cases; White, Royston & Wood 2011), and pooling by Rubin's rules; and an MNAR sensitivity analysis (delta-adjusted or tipping-point) for the primary endpoint.
- No observational causal claim without a named bias analysis for unmeasured confounding. When an E-value is reported, also report the estimate and its confidence interval, state the scale conversion when the effect measure is not a risk ratio, and never present the E-value as a threshold or as evidence for causality. For a confounder that is known but unmeasured, use the bounding-factor calculation rather than an E-value alone.
- No estimand without every anticipated intercurrent event (e.g., treatment discontinuation, rescue medication, switching, death before the outcome time point) named with its strategy. Flag hypothetical and principal-stratum strategies as resting on untestable assumptions and attach a sensitivity analysis.
- No threshold, recode, or exclusion criterion only in prose; record it in `Decision_Evidence`.
- No vague phrase such as “appropriate tests were used”; name the method, estimand, and evidence-backed rationale.
- Do not treat model discrimination as causal balance, post-treatment variables as baseline confounders, or an undocumented time zero as acceptable.

When an immediate answer is required but grain or unit of analysis is unknown, make the uncertainty part of the pasteable recommendation:

```text
[PROVISIONAL — unit of analysis not yet confirmed] <method name>, <one-line justification and its required assumption>.
```

Name the likely method and the assumption it rests on, but do not present the choice as final until the schema is complete.

## Hand Off the Schema

| Need | Owner |
|---|---|
| Canonical versioned SAP or implementation roadmap | `method-plan` |
| Primary model choice and R/Python scaffold | `method-model-choice` |
| `Overview`, `Outputs`, and `Master Variables` workbook | `method-sap-workbook` |
| Final Methods prose and section boundaries | `method-section-check` |
| Citation verification and editable Word fields | `method-citations` |
| Unresolved claim/dataset/schema decisions | This skill |

For a new Methodsmith SAP, use `method-plan` for the durable study-plan artifact. Add this schema to that artifact, then use `method-sap-workbook` for the workbook companion. Keep claim and decision identifiers aligned rather than creating competing plans.

Before handoff, verify that every claim maps to a dataset and grain, every analysis maps to a claim and output, every output names an interpretation, and every nontrivial decision has evidence. For randomized trials, also check the canonical SAP against the Gamble et al. 2017 minimum content (55 items; JAMA 2017;318:2337-43, PMID 29260229) and list any missing item (e.g., interim analyses, timing of final analysis relative to unblinding, protocol deviations, harms summaries, software versions) as an integrity blocker; the trial protocol itself follows SPIRIT 2025 (PMID 40294953). In review mode, clearly separate confirmed integrity blockers from methodological questions requiring analyst resolution.
