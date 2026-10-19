# ROBINS-I Tool for Non-randomised Studies of Interventions

## Contents

- How ROBINS-I works
- Target trial and effect of interest
- Domain 1: Confounding
- Domain 2: Selection of participants
- Domain 3: Classification of interventions
- Domain 4: Deviations from intended interventions
- Domain 5: Missing data
- Domain 6: Measurement of outcomes
- Domain 7: Selection of the reported result
- Reaching an overall judgement

Risk Of Bias In Non-randomised Studies - of Interventions (ROBINS-I). It assesses the risk of bias in a specific result from a study that did not use randomization to allocate units (individuals or clusters) to comparison groups: cohort studies, case-control studies, quasi-randomized studies, and other non-randomised designs. ROBINS-I is an appraisal tool, not a reporting guideline.

**Primary reference:** Sterne JAC, Hernán MA, Reeves BC, et al. ROBINS-I: a tool for assessing risk of bias in non-randomised studies of interventions. BMJ. 2016;355:i4919. doi:10.1136/bmj.i4919. PMID: 27733354. PMCID: PMC5062054.

**Source and licence:** Domain names, the seven-domain structure, the signalling-question approach, and the judgement categories follow the BMJ article (CC BY-NC 3.0, https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5062054/) and the official tool at https://www.riskofbias.info/ (checked on 2026-10-18). The full signalling questions and the criteria for domain judgements live in the tool's supplementary tables A to C; the questions below are faithful paraphrases of the issues those tables address. The tool should not be modified for use. The "What to look for in code/outputs" cues are added by this plugin.

**Version note:** The 2016 tool remains the published ROBINS-I. A draft ROBINS-I V2 (20 November 2025) is explicitly subject to change. Pin the tool version in the review protocol, and use RoB 2 instead for randomized or quasi-randomized trials of interventions assessed at the result level.

## How ROBINS-I works

- Seven domains cover bias in a specific result. The first two address issues before the start of the compared interventions (baseline), the third addresses classification of the interventions themselves, and the last four address issues after interventions start: deviations from intended interventions, missing data, measurement of outcomes, and selection of the reported result.
- Each study is viewed as an attempt to emulate a hypothetical pragmatic randomized trial (the target trial) conducted in the same participants without features putting it at risk of bias. Bias is a systematic difference between the study result and the result expected from the target trial.
- Signalling questions elicit factual information; answers are Yes (Y), Probably yes (PY), Probably no (PN), No (N), or No information (NI), with free-text support using quotations from the study where possible.
- Domain judgements are Low risk, Moderate risk, Serious risk, or Critical risk of bias, plus No information. "Low risk" corresponds to the risk of bias in a high-quality randomized trial, so only exceptionally is a non-randomised study low risk due to confounding.
- Judgements carry forward to an overall judgement for the outcome being assessed: low only when all domains are low; moderate when all domains are low or moderate; serious when at least one domain is serious but none is critical; critical when at least one domain is critical. A study at critical risk should not enter any synthesis, and studies at serious risk need caution.
- "Risk of bias" means risk of material bias: raise a concern only when it is likely to affect the validity of the conclusion. Use No information only when the study reports too little to judge.

## Target trial and effect of interest

**Description:** Describe the target trial for the non-randomised study: population, experimental intervention, comparator, and outcomes. Define the effect of interest as either the effect of assignment to intervention at baseline (intention-to-treat) or the effect of starting and adhering to intervention (per-protocol). Identify in advance the confounding domains (prognostic factors that predict whether an individual receives one or the other intervention) and co-interventions of concern.

**What to look for in code/outputs:**
- A protocol section stating the target trial, the effect of interest, and the pre-specified confounders and co-interventions
- Confounder selection justified by subject-matter knowledge, scoping review, or clinical input rather than data-driven selection

---

## Domain 1: Bias due to confounding

### Bias due to confounding

**Description:** Assess baseline confounding, which occurs when one or more prognostic variables also predict the intervention received at baseline, and time-varying confounding, which occurs when individuals switch between the compared interventions and post-baseline prognostic factors affect the intervention received after baseline.

Signalling questions (paraphrased; the full tool is supplementary table A, and criteria for judgements are supplementary tables B and C):
- Were all important confounding domains identified, and were they measured using valid and reliable variables?
- Did the analysis control for all important confounding domains, using an appropriate method given the design and the effect of interest?
- Did the analysis avoid adjusting for variables affected by the intervention (potential mediators or colliders)?
- For time-varying confounding, did the analysis use a method appropriate to the treatment-confounder feedback structure (for example g-methods)?

**What to look for in code/outputs:**
- A pre-specified confounder list with the rationale for each variable
- The adjustment method (regression, propensity score, standardization, inverse probability weighting, g-formula) and whether its assumptions hold for the design
- A check that adjustment variables are measured before the intervention and are not consequences of it

---

## Domain 2: Bias in selection of participants into the study

### Bias in selection of participants into the study

**Description:** Assess selection bias from excluding eligible participants, from the initial follow-up time of some participants, or from some outcome events, when the exclusion is related to both intervention and outcome. This is distinct from confounding. Inclusion of prevalent rather than new users of an intervention is a specific example.

Signalling questions (paraphrased; the full tool is supplementary table A, and criteria for judgements are supplementary tables B and C):
- Was selection of participants into the study, or into the analysis, based on characteristics observed after the start of intervention?
- Could some participants have been excluded because they started the intervention after the start of follow-up (immortal time)?
- Were the participants included in the analysis a representative sample of the population of interest?

**What to look for in code/outputs:**
- Cohort entry aligned with the start of the intervention, with a new-user design where appropriate
- A participant flow that shows exclusions and their timing, and no exclusion on post-baseline characteristics
- A check for immortal time bias (time between eligibility and intervention start excluded from both groups)

---

## Domain 3: Bias in classification of interventions

### Bias in classification of interventions

**Description:** Assess bias from differential or non-differential misclassification of intervention status. Non-differential misclassification is unrelated to the outcome and usually biases the effect estimate towards the null; differential misclassification relates to the outcome or its risk and is likely to bias the estimate.

Signalling questions (paraphrased; the full tool is supplementary table A, and criteria for judgements are supplementary tables B and C):
- Were intervention groups clearly defined?
- Was the information used to classify participants into intervention groups recorded at the start of the intervention?
- Could classification of participants into intervention groups have been affected by knowledge of the outcome or by risk of the outcome?

**What to look for in code/outputs:**
- Intervention definitions written in the protocol with the data fields that operationalize them
- Exposure ascertainment from records or data captured before outcome measurement
- A check that classification was blinded to outcome status

---

## Domain 4: Bias due to deviations from intended interventions

### Bias due to deviations from intended interventions

**Description:** Assess bias from systematic differences between intervention groups in the care provided that deviate from the intended interventions. The assessment depends on whether the effect of interest is the effect of assignment to intervention or the effect of starting and adhering to intervention.

Signalling questions (paraphrased; the full tool is supplementary table A, and criteria for judgements are supplementary tables B and C):
- Were there deviations from the intended intervention beyond what would be expected in usual practice?
- Were these deviations balanced between intervention groups?
- Was the analysis appropriate to estimate the effect of interest, given the deviations and co-interventions?

**What to look for in code/outputs:**
- Co-intervention data collected and compared across groups
- For the adherence effect, a method that adjusts for deviations (inverse probability weighting, g-methods) with its assumptions stated
- For the assignment effect, an analysis that preserves the initial groups

---

## Domain 5: Bias due to missing data

### Bias due to missing data

**Description:** Assess bias from missing follow-up for individuals initially included and followed (differential loss to follow-up related to prognostic factors) and from excluding individuals with missing information on intervention status or other variables such as confounders.

Signalling questions (paraphrased; the full tool is supplementary table A, and criteria for judgements are supplementary tables B and C):
- Were outcome data available for all, or nearly all, participants?
- Were participants excluded because of missing data on intervention status, confounders, or other variables?
- If data were missing, was the analysis appropriate given the likely missingness mechanism, and is the result robust to plausible assumptions?

**What to look for in code/outputs:**
- Proportions of missing data by group and by variable, with reasons
- Handling of missing data (complete case, multiple imputation, weighting) and whether the mechanism assumption is justified
- Sensitivity analyses that vary the missingness assumption

---

## Domain 6: Bias in measurement of outcomes

### Bias in measurement of outcomes

**Description:** Assess bias from differential or non-differential errors in outcome measurement, including when outcome assessors were aware of intervention status, when different methods were used in different groups, or when measurement errors relate to intervention status or effects.

Signalling questions (paraphrased; the full tool is supplementary table A, and criteria for judgements are supplementary tables B and C):
- Was the outcome measure appropriate for the outcome of interest?
- Could the outcome measure have been influenced by knowledge of the intervention received?
- Were outcome assessors unaware of the intervention received?
- Were the methods of outcome assessment comparable across intervention groups?

**What to look for in code/outputs:**
- Blinding of outcome assessors, and the outcome type (objective versus judgement-based)
- Identical measurement methods and thresholds across groups
- Evidence of differential ascertainment, such as extra testing in one group

---

## Domain 7: Bias in selection of the reported result

### Bias in selection of the reported result

**Description:** Assess selective reporting of a result in a way that depends on the findings and prevents the estimate from being included in a meta-analysis or other synthesis.

Signalling questions (paraphrased; the full tool is supplementary table A, and criteria for judgements are supplementary tables B and C):
- Is the reported effect estimate likely to be selected, on the basis of the results, from multiple outcome measurements within the outcome domain?
- Is the reported effect estimate likely to be selected, on the basis of the results, from multiple analyses of the intervention-outcome relationship?
- Is the reported effect estimate likely to be selected, on the basis of the results, from different subgroups?

**What to look for in code/outputs:**
- A dated protocol or analysis plan compared against what was reported
- Discrepancies in outcome definitions, analysis methods, or subgroup choices between the plan and the report

---

## Reaching an overall judgement

**Description:** Combine the seven domain judgements into one overall risk-of-bias judgement for the outcome being assessed, with a rationale. Record the predicted direction of bias only where there is a clear basis, and note that for some domains the bias is best expressed as towards or away from the null and for others as an increase or decrease in the effect estimate.

**What to look for in code/outputs:**
- A domain-by-domain table with the overall judgement per outcome
- Synthesis decisions that exclude critical-risk studies and handle serious-risk studies cautiously

**Overall judgement rule (paraphrased):** Low when all domains are at low risk. Moderate when all domains are low or moderate. Serious when at least one domain is serious and none is critical. Critical when at least one domain is critical. No information when there is no clear indication of serious or critical risk but one or more key domains lack information.
