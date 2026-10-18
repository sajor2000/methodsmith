---
name: method-model-choice
description: "Chooses and justifies the statistical model (regression, mixed/GEE, survival, causal, prediction, Bayesian) after the estimand is set. Use when the user asks which model to fit."
argument-hint: "<research question, SAP path, or data-profile path> [language:auto|r|python]"
---

# Model Strategy

## Skill Value

- **Problem it solves:** Model choices are often driven by software defaults or precedent instead of the estimand, outcome, data grain, dependence structure, and evidence.
- **Use when:** A study needs a primary model, alternatives, random-effects structure, R/Python implementation scaffold, or a documented reason for choosing one method over another.
- **Output:** `analysis/model-strategy/<slug>-model-strategy.md`, an optional stack-matched `.R` or `.py` scaffold, and a `__CE_MODEL_STRATEGY__` handoff.
- **Ask only if:** A load-bearing input cannot be established from the request, SAP, data profile, repository, or prior handoff.
- **Do not do:** Do not choose a final model before data grain and estimand are known, run models without authorization, install packages, fabricate language parity, or claim to replace human biostatistical approval.
- **Interaction:** Check repository, configuration, handoffs, and supplied artifacts first. Ask one decision-changing question at a time with `AskUserQuestion` in Claude Code, `request_user_input` in Codex, `ask_user` in Gemini, or `ask_user` in Pi via `pi-ask-user`. In Claude Code, first call `ToolSearch` with `select:AskUserQuestion` when the schema is not loaded. Only when no blocking tool exists or the call errors, present concise numbered choices in chat and wait.

Treat PhD-level biostatistical practice as the quality bar, not an identity claim. A complete recommendation is `ready_for_review`; only a named human reviewer can approve it.

## Resolve Inputs

Read `$ARGUMENTS` and scan recent context for:

```text
__CE_RESEARCH_QUESTION__
__CE_DATA_PROFILE__
__CE_DATA_QA__
__CE_BIOINFO_QC_PASS__
__CE_BIOINFO_QC_FAIL__
__CE_EVIDENCE_MAP__
__CE_METHOD_EXTRACT__
__CE_MODEL_STRATEGY__
__CE_LANG__
```

Also inspect a supplied SAP, data dictionary, QA report, and `.ce-datascience/config.local.yaml` when present. For omics work, inspect `reports/bioinfo-qa/*.md` for the canonical pass/fail signal or sign-off blocker count. A `__CE_BIOINFO_QC_FAIL__` signal or confirmed blockers make the strategy `blocked`; do not select or scaffold an omics model until they are resolved. Never inspect patient-level or row-level files merely to avoid asking for an already-missing design decision. Use aggregate QA outputs and authorized schema information whenever they are sufficient.

Create one decision per outcome-estimand pair. Before selecting a model, establish:

1. Scientific aim: descriptive, associational, causal, predictive, validation, or evidence synthesis.
2. Estimand and reporting scale: mean difference, odds ratio, risk ratio, rate ratio, hazard, marginal risk, conditional effect, prediction, pooled effect, or another explicit target.
3. Outcome type and support, including zero mass, bounds, censoring, competing events, or repeated observation.
4. Unit of analysis, dataset grain, denominator, and time zero/follow-up when applicable.
5. Dependence: independent, paired, repeated, clustered, nested, crossed, spatial, or serial.
6. Candidate fixed effects, grouping variables, within-cluster predictors, and design-mandated terms.
7. Missing-data strategy and informative missingness/censoring risks.
8. Usable observations, events, subjects, clusters, levels per grouping factor, and observations per cluster.
9. Target stack and available package environment.

## Gate the Decision

Use exactly one status:

| Status | Meaning | Code scaffold |
|---|---|---|
| `blocked` | Grain, unit, outcome, or another prerequisite is contradictory or unavailable. | None |
| `provisional` | A leading method can be named only under explicit unresolved assumptions. | None |
| `ready_for_review` | Inputs, rationale, evidence, diagnostics, and implementation path are complete enough for human review. | Required |

Do not call a recommendation final or approved. A failed data-QA or bioinformatics-QA gate is `blocked`. When no data exist yet, a design-stage recommendation may be `provisional`, with the exact future QA facts required to promote it. An estimand or design element that had to be assumed rather than established (for example, how death or another intercurrent event enters the estimand) is an unresolved assumption: ask the one question it raises, and if the answer is not yet in hand, use `provisional` and name the assumption in the approval prerequisites.

## Route the Model

Read `references/model-routing.md` for every run. Read `references/mixed-effects.md` whenever observations are paired, repeated, clustered, nested, crossed, or longitudinal. Read `references/advanced-models.md` for survival, causal, predictive, Bayesian, joint-model, or meta-analysis branches.

Choose in this order:

1. Aim and estimand.
2. Outcome family and link/scale.
3. Dependence and sampling/design structure.
4. Time, censoring, competing events, missingness, and survey/cluster design.
5. Estimation and inference method.
6. Diagnostics, sensitivity analyses, and predeclared fallback triggers.

Do not select the most common model in prior papers by vote. Applied precedent is a feasibility clue; appropriateness comes from the current estimand and data-generating structure.

## Ground the Decision

After the candidate decision questions are known, load `method-evidence-map` to acquire the evidence or consume an existing `__CE_EVIDENCE_MAP__` artifact. That skill owns PubMed/Paperclip acquisition; model strategy owns mapping its evidence to model decisions.

### Evidence access

When this run needs literature, read `references/evidence-access.md` first (tool use plus the model-decision evidence procedure); never invent a citation, effect size, or guideline item.

- **Look up here:** the method's primary reference and at least one applied example per candidate model family (acquired through `method-evidence-map`, or directly with these tools when no map exists), plus the design-specific simulation or guidance that settles each contested decision.

Literature never overrides observed grain, estimand, design constraints, or a failed QA gate.

## Match the Implementation Stack

Resolve language in this order: explicit `language:r|python`, current user request, stack profile, `__CE_LANG__`, then dominant analysis files and lockfiles. Ask only when both stacks are active and no owning analysis file is apparent.

- For R, read `references/r-implementation.md`.
- For Python, read `references/python-implementation.md`.

Use installed, locked packages when they can implement the selected method. If the selected model lacks a credible implementation in the active stack, use `provisional` with `code=none` while a vetted alternate stack awaits human approval, or `blocked` when no credible implementation path exists. Never emit `ready_for_review` without the required scaffold, write fake code, or install or update packages without explicit authorization.

## Write the Artifacts

Use a stable ASCII slug and write under `analysis/model-strategy/`:

```text
<slug>-model-strategy.md
<slug>-model.R     # R only, ready_for_review only
<slug>-model.py    # Python only, ready_for_review only
```

For prediction-model strategies only, read `references/ml-prediction-decisions.md`
and `references/ml-prediction-decisions.schema.json`. Also write
`<slug>-model-strategy.decisions.json` beside the memo and check its agreement
with the memo before handing off. Other model branches keep their existing outputs.

The memo must contain:

1. An exact `Status: <blocked|provisional|ready_for_review>` line and named human reviewer (`pending` until a human acts).
2. Research aim, estimand, effect/reporting scale, and unit of analysis.
3. Dataset grain, denominator, sample/event/cluster counts, and dependence structure.
4. Candidate models considered and a reason each non-selected candidate was rejected or reserved for sensitivity analysis.
5. Primary model: family, link, formula roles, fixed effects, random effects, covariance/correlation structure, estimation, and inference.
6. Missing-data, censoring, competing-risk, and multiplicity handling as applicable.
7. Required diagnostics with pass/fail interpretation and predeclared fallback triggers.
8. Sensitivity analyses that test the assumptions most likely to alter the conclusion.
9. R/Python package and API choice, detected version or unresolved version gap, code path, and known capability limits.
10. Decision-to-evidence ledger with identifiers, query provenance, and `abstract`/`full_text` labels.
11. Residual uncertainties and the exact evidence required for approval.

The scaffold must be input-contract-first, fail on missing columns, fit only the selected primary model, include diagnostics and sensitivity hooks, and never contain synthetic results or hard-coded patient values. It may use placeholders for approved column names only when the memo marks them clearly.

## Hand Off

Emit exactly one terminal signal:

```text
__CE_MODEL_STRATEGY__ memo=<path> code=<path|none> language=<r|python|none> status=<blocked|provisional|ready_for_review> primary=<model-id|none> evidence=<path|none>
```

Then route downstream work without duplicating it:

| Need | Owner |
|---|---|
| Canonical SAP | `method-plan` |
| Claim/dataset/estimand schema | `method-sap` |
| Literature evidence map | `method-evidence-map` |
| Formal site/study synthesis | `method-clif-meta-analysis` |
| Literature effect-size anchor for power | `method-meta-analysis` |
| Power or simulation-based design | `method-power` |
| Prediction experiment tracking | `method-ml-track` |
| Implementation and statistical audit | `method-review` |

The model-strategy memo is a decision input to the SAP, not a competing SAP.
