# SAP Template

## Contents

- YAML Frontmatter
- Section Template
- Writing Guidance

Use this template when producing a Statistical Analysis Plan in SAP mode. The YAML frontmatter and `SAP-N.M` section identifiers are load-bearing -- downstream skills (`method-work` SAP tracking, SAP-drift detector) parse them by ID. Do not renumber or restructure section IDs without updating consumers.

Every new SAP must include the biostatistics-style tabular SAP contract. The prose SAP is the narrative plan; `analysis/sap-tables/01-overview.csv`, `02-outputs.csv`, `03-variables.csv`, and the rendered `<slug>-tabular-sap.xlsx` workbook are the programmer/coordinating-center handoff.

## YAML Frontmatter

```yaml
---
sap_version: 1
study_type: observational | rct | systematic-review | diagnostic-accuracy | case-report | qualitative | animal | health-economic | prediction-model | target-trial-emulation | quality-improvement | early-clinical-ai-evaluation | exploratory | other
ai_involvement: none | ai-assisted | ai-primary | llm-based
protocol_stage: false
reporting_checklist: null
reporting_checklist_extensions: []
# Legacy compatibility only; prefer the reporting_checklist fields above.
guidelines_selected: []
date_created: YYYY-MM-DD
date_amended: YYYY-MM-DD
status: draft | final | amended
---
```

- `sap_version` starts at `1` and increments on substantive amendments (not typo fixes)
- `study_type` must be one of the values shown; pick the closest fit. The original four values (`observational`, `rct`, `exploratory`, `other`) remain valid
- `protocol_stage` is optional (default `false`). Set `true` when the SAP accompanies a protocol: trial protocols route to SPIRIT 2025, systematic-review protocols to PRISMA-P
- `early-clinical-ai-evaluation` covers early-stage clinical evaluation of AI decision-support systems and routes to DECIDE-AI
- `ai_involvement` is optional. Set it when the study uses AI/ML methods: `ai-assisted` for AI as a tool within traditional methods, `ai-primary` for AI as the primary analytical approach, `llm-based` for studies using large language models. Defaults to `none` when omitted
- `reporting_checklist` and `reporting_checklist_extensions` mirror the canonical stack-profile fields when the SAP needs a portable per-study copy
- `guidelines_selected` is legacy compatibility. When canonical fields are absent and it is set, it specifies exactly which reporting guidelines apply (e.g., `[CONSORT, CONSORT-AI]`). When all fields are empty or omitted, guidelines are auto-selected from `study_type` and `ai_involvement` via the routing map
- `date_amended` and `status: amended` are set only when revising a finalized SAP
- A SAP in `draft` status may be edited freely; `final` signals the analysis plan is locked

## Section Template

```markdown
---
sap_version: 1
study_type: observational | rct | systematic-review | diagnostic-accuracy | case-report | qualitative | animal | health-economic | prediction-model | target-trial-emulation | quality-improvement | early-clinical-ai-evaluation | exploratory | other
ai_involvement: none
protocol_stage: false
reporting_checklist: null
reporting_checklist_extensions: []
guidelines_selected: []
date_created: YYYY-MM-DD
date_amended: YYYY-MM-DD
status: draft | final | amended
---

# Statistical Analysis Plan: [Study Title]

## SAP-1: Study Objectives

### SAP-1.1: Primary Objective

[State the primary research question in one sentence. Frame as testable hypothesis when possible.]

### SAP-1.2: Secondary Objectives

[List secondary objectives. Each should be independently testable.]

### SAP-1.3: Exploratory Objectives

[List exploratory analyses. Mark clearly as hypothesis-generating, not confirmatory.]

### SAP-1.4: Estimand(s)

When the endpoint definition is unresolved, carry the supplied outcome wording into every estimand attribute and mark the missing definition as a gap. Do not add an unconfirmed cause, setting, or other qualifier, even in a provisional estimand.

[For each primary and key secondary objective, state the estimand per ICH E9(R1): (1) population, (2) treatment condition(s) being compared, (3) endpoint/variable with time point, (4) each anticipated intercurrent event (e.g., treatment discontinuation, rescue medication, treatment switching, death before outcome assessment) with its strategy (treatment policy, hypothetical, composite variable, while on treatment, principal stratum), and (5) population-level summary (e.g., risk difference, marginal or conditional odds ratio, hazard ratio, RMST difference). Flag hypothetical and principal-stratum strategies as resting on untestable assumptions. For observational causal questions, state the target-trial causal contrast (intention-to-treat or per-protocol analogue) and time zero. Analysis sets in SAP-4 support the estimand; they do not replace it.]

---

## SAP-2: Study Design

### SAP-2.1: Study Type

[Observational (cohort, case-control, cross-sectional), RCT (parallel, crossover, cluster), or other. Include temporal direction (retrospective, prospective, ambispective).]

### SAP-2.2: Study Population

[Define inclusion and exclusion criteria. Specify the source population and sampling frame.]

### SAP-2.3: Exposure / Intervention

[Define the exposure (observational) or intervention (RCT). Include timing, dosing, or measurement details.]

### SAP-2.4: Comparator

[Define the comparison group. For observational studies, specify how unexposed subjects are identified.]

---

## SAP-3: Endpoints

### SAP-3.1: Primary Endpoint(s)

[Define the primary outcome measure. Include how it is measured, at what time point, and the minimum clinically important difference (MCID) if applicable.]

### SAP-3.2: Secondary Endpoint(s)

[List secondary outcomes with measurement definitions.]

### SAP-3.3: Exploratory Endpoint(s)

[List exploratory outcomes. These do not drive power calculations.]

---

## SAP-4: Analysis Populations

### SAP-4.1: Primary Analysis Population

[Define the primary analysis set (e.g., full analysis set / intention-to-treat) that supports the SAP-1.4 estimand. Specify how subjects are assigned to it. An analysis set is not an estimand.]

### SAP-4.2: Additional Analysis Sets

[Define any additional analysis sets (e.g., per-protocol, as-treated, complete-case). State whether each supports a sensitivity analysis (same estimand, different assumptions) or a supplementary analysis (different estimand, e.g., a per-protocol effect).]

---

## SAP-5: Statistical Methods

### SAP-5.1: Primary Analysis

[Specify the statistical model, estimation method, and inference approach for the primary estimand (SAP-1.4). Include covariates, effect measure (OR, HR, RR, mean difference), whether the effect is conditional or marginal, confidence interval method, confidence level, sidedness, and significance threshold. For randomized trials, prespecify baseline-only prognostic covariates and include the randomization stratification factors; for a marginal effect from a nonlinear model, name the standardization/g-computation estimator and its bootstrap or robust variance (FDA 2023 covariate-adjustment guidance).]

### SAP-5.2: Secondary Analyses

[Specify methods for each secondary endpoint. May reference SAP-5.1 if methods are identical.]

### SAP-5.3: Subgroup Analyses

[List pre-specified subgroups with justification. State whether subgroup analyses are exploratory or confirmatory. Specify the interaction test used.]

### SAP-5.4: Interim Analyses and Stopping Guidance (RCT)

[Number and timing of interim analyses, information fraction, alpha-spending function, futility rules, who sees unblinded data, and the timing of the final analysis relative to database lock and unblinding. "Not applicable: no interim analysis" if none. Not applicable for non-randomized designs.]

### SAP-5.5: Protocol Deviations and Adherence (RCT)

[Definition of important protocol deviations, how adherence is measured, and how each deviation or adherence event maps to an intercurrent-event strategy in SAP-1.4. Not applicable for non-randomized designs.]

### SAP-5.6: Harms and Software (RCT)

[How adverse events and other harms are summarized (populations, coding dictionary, grading), and the statistical software and versions used for the analysis.]

---

## SAP-6: Sample Size and Power

[State the target sample size, the assumptions behind the power calculation (effect size, variance, alpha, power, dropout rate), and the software or formula used. For retrospective studies using existing data, state the available sample size and the minimum detectable effect at 80% power. For prediction-model development, justify N with the Riley et al. criteria (BMJ 2020;368:m441; R `pmsampsize`), not events-per-variable alone. For descriptive, agreement, or accuracy studies, justify N by the target confidence-interval width. Never report post-hoc power computed from the observed effect (Hoenig & Heisey, Am Stat 2001).]

---

## SAP-7: Multiplicity Adjustments

[Specify the multiplicity adjustment method (Bonferroni, Holm, Hochberg, FDR, gatekeeping, hierarchical testing) and which comparisons it covers. If no adjustment is applied, state the rationale (e.g., single primary endpoint, all secondary analyses are exploratory).]

---

## SAP-8: Missing Data Handling

[Describe the assumed missing data mechanism (MCAR, MAR, MNAR). Specify the primary approach (complete-case, multiple imputation, MMRM, inverse probability weighting) and any sensitivity analyses for alternative assumptions.]

---

## SAP-9: Sensitivity Analyses

[List each planned sensitivity analysis: it targets the same estimand as SAP-5.1 under a different assumption (e.g., MNAR delta-adjusted or tipping-point imputation, alternative model specification, alternative handling of an intercurrent event within the same strategy). Change one assumption at a time. List supplementary analyses (different populations, outcome definitions, or estimands, such as a per-protocol set) separately and label them supplementary; agreement between a per-protocol and a treatment-policy result does not demonstrate robustness (ICH E9(R1) A.5.2-A.5.3; Morris, Kahan & White 2014).]

---

## SAP-10: Tables, Figures, and Listings

[Provide a numbered list of planned tables, figures, and listings (TFLs). Each entry should reference the SAP section it supports. Include shell table layouts for key outputs when useful.]

- Table 1: Baseline characteristics (SAP-2.2, SAP-4.1)
- Table 2: Primary analysis results (SAP-5.1)
- Figure 1: Study flow diagram / CONSORT (SAP-4.1)

---

## SAP-11: Reproducibility Metadata

[Reference the project's `.methodsmith/study-metadata.yaml` file if it exists. Document the key reproducibility parameters for this study: random seeds, software versions, dataset split strategy (for ML studies), and any LLM provenance (for LLM-based studies). See the study metadata schema for the full field set.

This section is optional for traditional statistical analyses. It is strongly recommended for studies with `ai_involvement` set to any value other than `none`.]

---

## SAP-12: Output Catalog

The full per-artifact inventory lives in `analysis/sap-tables/02-outputs.csv` (also rendered in the multi-sheet workbook `analysis/sap-tables/<slug>-tabular-sap.xlsx`). Every output file in the catalog must trace back to a SAP-N.M analysis section. Programmers implement against the catalog row-by-row; coordinating-center audits read the catalog cell-by-cell.

The tabular catalog should mirror a biostatistics handoff workbook. Use these exact output columns: `Output File (SITE_ID_ prefix added automatically)`, `Subfolder`, `Dataset / Cohort Scope`, `Script Section`, `Contents`, `Role at Coordinating Center`, and `Interpretation`. Group outputs with visible section-banner rows such as `SETUP / DIAGNOSTICS | <script>` and `MODEL OUTPUTS | <script>`.

Generate this catalog with `method-sap-workbook <slug>` as part of every new SAP. If `method-data-qa` has not yet profiled the actual columns, keep the SAP in draft and list `method-data-qa` followed by `method-sap-workbook <slug>` as required next steps.

---

## SAP-13: Variable Catalog

The variable-by-analysis matrix lives in `analysis/sap-tables/03-variables.csv`. Each row is one variable; each analysis (`SAP-5.N`) has a column flagging whether the variable is used. The catalog also records type (Fixed vs Time-varying), format/values, and the source file (long vs wide). Use workbook-friendly analysis flag columns (`A2`, `A3`, `A4`, etc.) so the matrix matches the `Overview` analysis IDs.

Generated alongside SAP-12 by `method-sap-workbook`.
```

## Writing Guidance

When filling in this template from a study design brainstorm:

1. Carry forward all study design decisions from the origin document -- do not re-litigate design choices made during brainstorming
2. Fill every section; if a section is not applicable, write "Not applicable: [reason]" rather than leaving it blank
3. Flag incomplete sections with `<!-- GAP: [description of what is needed] -->` so the gap checklist can detect them
4. Use precise statistical language -- name specific tests, models, and adjustment methods rather than vague descriptions like "appropriate statistical methods"
5. Cross-reference between sections using SAP-N.M identifiers (e.g., "using the population defined in SAP-4.1")
6. Keep the document self-contained -- a statistician should be able to execute the analysis plan without referring to the brainstorm document
7. For RCTs, fill SAP-1.4 and SAP-5.4 to SAP-5.6, then cross-check the SAP against the Gamble et al. 2017 minimum content (55 items; JAMA 2017;318:2337-43, PMID 29260229) and confirm the trial protocol follows SPIRIT 2025 (34 items; BMJ 2025;389:e081477, PMID 40294953). Record the SAP's relationship to the protocol (protocol version) and the SAP author and version history in the document header.
8. SAP-11 (Reproducibility Metadata) is optional for traditional statistical analyses but strongly recommended when `ai_involvement` is not `none`. At minimum, reference the study metadata file path; detailed provenance fields live in `.methodsmith/study-metadata.yaml`
