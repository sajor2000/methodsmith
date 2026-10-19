# RoB 2 Tool for Randomised Trials

## Contents

- How RoB 2 works
- Preliminary considerations
- Domain 1: Randomization process
- Domain 2: Deviations from intended interventions
- Domain 3: Missing outcome data
- Domain 4: Measurement of the outcome
- Domain 5: Selection of the reported result
- Domain 1b: Cluster-randomized trials
- Reaching an overall judgement

Risk of Bias 2 (RoB 2), version 2 of the Cochrane risk-of-bias tool for randomized trials. It assesses the risk of bias in a single trial result that estimates the relative effect of two interventions or intervention strategies on one outcome, not the quality of the trial as a whole. RoB 2 is an appraisal tool, not a reporting guideline.

**Primary reference:** Sterne JAC, Savović J, Page MJ, et al. RoB 2: a revised tool for assessing risk of bias in randomised trials. BMJ. 2019;366:l4898. doi:10.1136/bmj.l4898. PMID: 31462531.

**Development and guidance:** Higgins JPT, Savović J, Page MJ, Sterne JAC, eds. Revised Cochrane risk-of-bias tool for randomized trials (RoB 2). 22 August 2019. https://www.riskofbias.info/welcome/rob-2-0-tool (checked on 2026-10-18).

**Source and licence:** Domains, signalling-question numbering, response options, and the judgement rules follow the official RoB 2 tool and guidance (22 August 2019). That guidance is licensed CC BY-NC-ND 4.0, which does not permit adapted redistribution, so the signalling questions below are faithful paraphrases that keep each question's meaning and official number. Use the official form for verbatim wording. The "What to look for in code/outputs" cues are added by this plugin. RoB 2 is a risk-of-bias appraisal tool, not an EQUATOR reporting guideline.

## How RoB 2 works

- Five domains apply to every randomized trial result; each is mandatory and no further domain may be added.
- Each domain holds signalling questions answered Yes (Y), Probably yes (PY), Probably no (PN), No (N), No information (NI), and Not applicable (NA) where a question is conditional.
- Answers map to a proposed domain judgement of Low risk of bias, Some concerns, or High risk of bias. The proposal can be overridden with a stated rationale.
- The overall judgement is Low when every domain is low; High when any domain is high, or when several domains raise concerns that substantially lower confidence; otherwise Some concerns.
- "Risk of bias" means risk of material bias: raise a concern only when it is likely to affect the reliability of the conclusion.
- Assess a specific result for a specific outcome and time point, not the study overall. A trial usually contributes several results, so several assessments may be needed.
- Record the answers, the free-text support, and the judgement. Use direct quotations from the trial report as evidence wherever possible.

## Preliminary considerations

**Description:** Before judging domains, document the study design (individually randomized parallel-group, cluster-randomized parallel-group, or individually randomized cross-over or matched), the experimental and comparator interventions, the outcome and the specific numerical result being assessed, whether the aim is the effect of assignment to intervention (intention-to-treat) or the effect of adhering to intervention (per-protocol), and which deviations the assessment will address when the aim is adherence. List the sources obtained (journal article, protocol, statistical analysis plan, registry record, regulatory document, and others).

**What to look for in code/outputs:**
- An assessment header recording design, interventions, outcome, the exact result (estimate and confidence interval, or a table/figure reference), and the effect of interest
- A source list, and a flag when the protocol or SAP was unavailable

**Effect of interest:** The domain on deviations from intended interventions is assessed differently for the two effects. When the aim is the effect of adhering to intervention, also specify which deviations are examined: occurrence of non-protocol interventions, failures in implementing the intervention, or non-adherence by participants.

---

## Domain 1: Randomization process

### Bias arising from the randomization process

**Description:** Assess whether the allocation sequence was random and concealed until assignment, and whether baseline differences suggest a problem with the process. Confounding is avoided when randomization balances known and unknown prognostic factors; knowledge of the next assignment allows selective enrolment, which is a form of selection bias.

Signalling questions (paraphrased; official numbering 1.1-1.3):
- 1.1 Was the allocation sequence random?
- 1.2 Was the allocation sequence concealed until participants were enrolled and assigned to interventions?
- 1.3 Did baseline differences between intervention groups suggest a problem with the randomization process?

**What to look for in code/outputs:**
- Sequence generation method (computer-generated, random number table, coin tossing, minimization with a random element) versus systematic methods (alternation, dates, record numbers)
- Allocation concealment (central or remote allocation, sequentially numbered opaque sealed envelopes, identical sequentially numbered drug containers)
- Baseline tables for all randomized participants, with a check for imbalances beyond chance and for excessive similarity

**Judgement rule (paraphrased):** Low requires adequate concealment with no concern about sequence generation and either chance-compatible baseline differences or no baseline information. Some concerns when concealment is adequate but the sequence was not random or baseline imbalance suggests a problem, when concealment information is missing but baseline differences look chance-compatible, or when no signalling question can be answered. High when allocation was not adequately concealed, or when concealment information is missing and baseline differences suggest a problem.

---

## Domain 2: Deviations from intended interventions

### Bias due to deviations from intended interventions

**Description:** Assess bias from deviations from the intended intervention: additional interventions inconsistent with the protocol, failures to implement the protocol interventions, or non-adherence by participants. The assessment depends on the effect of interest.

Signalling questions for the effect of assignment to intervention (paraphrased; official numbering 2.1-2.7):
- 2.1 Were participants aware of their assigned intervention during the trial?
- 2.2 Were carers and people delivering the interventions aware of participants' assigned intervention during the trial?
- 2.3 If Y/PY/NI to 2.1 or 2.2: Were there deviations from the intended intervention that arose because of the trial context?
- 2.4 If Y/PY to 2.3: Were these deviations likely to have affected the outcome?
- 2.5 If Y/PY/NI to 2.4: Were these deviations from intended intervention balanced between groups?
- 2.6 Was an appropriate analysis used to estimate the effect of assignment to intervention?
- 2.7 If N/PN/NI to 2.6: Was there potential for a substantial impact on the result of the failure to analyse participants in the group to which they were randomized?

Signalling questions for the effect of adhering to intervention (paraphrased; official numbering 2.1-2.6):
- 2.1 Were participants aware of their assigned intervention during the trial?
- 2.2 Were carers and people delivering the interventions aware of participants' assigned intervention during the trial?
- 2.3 If applicable: Were important non-protocol interventions balanced across intervention groups?
- 2.4 If applicable: Were there failures in implementing the intervention that could have affected the outcome?
- 2.5 If applicable: Was there non-adherence to the assigned intervention regimen that could have affected participants' outcomes?
- 2.6 If N/PN/NI to 2.3, or Y/PY/NI to 2.4 or 2.5: Was an appropriate analysis used to estimate the effect of adhering to intervention?

**What to look for in code/outputs:**
- Blinding of participants, carers, and people delivering the intervention, described explicitly rather than as "double blind"
- The analysis population: intention-to-treat or modified intention-to-treat (appropriate for the assignment effect) versus naive per-protocol, as-treated, or post-randomization exclusions (inappropriate)
- For the adherence effect, the method used to adjust for deviations (instrumental variable, inverse probability weighting) and its assumptions

**Judgement rule (paraphrased):** For the assignment effect the domain splits into a deviations part (2.1-2.5) and an analysis part (2.6-2.7); the domain is low only when both parts are low, some concerns when either part raises concerns without a high, and high when either part is high. For the adherence effect, imbalance in important non-protocol interventions with an appropriate analysis gives some concerns; failures in implementation or non-adherence that could affect the outcome with an inappropriate analysis gives high risk.

---

## Domain 3: Missing outcome data

### Bias due to missing outcome data

**Description:** Assess bias from missing measurements of the outcome, including bias introduced by the methods used to impute or otherwise account for them. Missing outcome data lead to bias in a complete-case analysis when missingness in the outcome depends on its true value. A single set of signalling questions applies to both effects of interest.

Signalling questions (paraphrased; official numbering 3.1-3.4):
- 3.1 Were data for this outcome available for all, or nearly all, participants randomized?
- 3.2 If N/PN/NI to 3.1: Is there evidence that the result was not biased by missing outcome data?
- 3.3 If N/PN to 3.2: Could missingness in the outcome depend on its true value?
- 3.4 If Y/PY/NI to 3.3: Is it likely that missingness in the outcome depended on its true value?

**What to look for in code/outputs:**
- Proportions of missing outcome data by group and reasons for missingness, from the CONSORT flow diagram or equivalent
- Whether imputed values were treated as observed data (they count as missing)
- Sensitivity analyses that vary the assumed relationship between missingness and the true outcome value

**Judgement rule (paraphrased):** Low when outcome data were available for all or nearly all randomized participants, or when there is evidence the result was not biased by missing data, or when missingness could not depend on the true value. Some concerns when data were not complete and missingness could depend on the true value but is not likely to. High when data were not complete and missingness is likely to depend on the true value.

---

## Domain 4: Measurement of the outcome

### Bias in measurement of the outcome

**Description:** Assess bias from errors in measuring the outcome, primarily differential errors related to intervention assignment. Consider whether the measurement method is appropriate, whether measurement or ascertainment could differ between groups, who the assessor is, whether the assessor was blinded, and whether the assessment is likely to be influenced by knowledge of the intervention received.

Signalling questions (paraphrased; official numbering 4.1-4.5):
- 4.1 Was the method of measuring the outcome inappropriate?
- 4.2 Could measurement or ascertainment of the outcome have differed between intervention groups?
- 4.3 If N/PN/NI to 4.1 and 4.2: Were outcome assessors aware of the intervention received by study participants?
- 4.4 If Y/PY/NI to 4.3: Could assessment of the outcome have been influenced by knowledge of intervention received?
- 4.5 If Y/PY/NI to 4.4: Is it likely that assessment of the outcome was influenced by knowledge of intervention received?

**What to look for in code/outputs:**
- Outcome type (participant-reported, observer-reported without judgement, observer-reported with judgement, intervention-provider decision, composite) and the resulting room for judgement
- Blinding of the outcome assessor, including participant-reported outcomes where the participant is the assessor
- Whether an intervention involving extra contacts created more opportunities to detect the outcome (diagnostic detection bias)

**Judgement rule (paraphrased):** Low when the measurement method was appropriate, ascertainment did not differ between groups, and either assessors were unaware or assessment could not be influenced. Some concerns when assessment could have been influenced but is unlikely to have been, or when ascertainment comparability is unknown and assessors were unaware or could not have been influenced. High when the measurement method was inappropriate, ascertainment could have differed between groups, or assessment is likely to have been influenced by knowledge of the intervention.

---

## Domain 5: Selection of the reported result

### Bias in selection of the reported result

**Description:** Assess bias from selecting the reported result, based on its direction, magnitude, or statistical significance, from among multiple effect estimates. Distinguish an outcome domain (a state or endpoint), an outcome measurement (a way of measuring it), and an outcome analysis (a specific result). This domain does not cover selective non-reporting of outcome domains, which is a review-level concern.

Signalling questions (paraphrased; official numbering 5.1-5.3):
- 5.1 Were the data that produced this result analysed in accordance with a pre-specified analysis plan that was finalized before unblinded outcome data were available for analysis?
- 5.2 Is the numerical result being assessed likely to have been selected, on the basis of the results, from multiple eligible outcome measurements (for example scales, definitions, time points) within the outcome domain?
- 5.3 Is the numerical result being assessed likely to have been selected, on the basis of the results, from multiple eligible analyses of the data?

**What to look for in code/outputs:**
- A dated protocol, registry entry, or statistical analysis plan finalized before unblinded outcome data were available
- Discrepancies between pre-specified and reported outcome measurements or analyses
- Signs of selective reporting: unusual subscale aggregation, changed primary outcomes, unreported adjusted analyses, unusual categorizations of continuous measures, changed composite definitions

**Judgement rule (paraphrased):** Low when the analysis followed a pre-specified plan finalized before unblinded data and neither measurement nor analysis selection is likely. Some concerns when the plan was not pre-specified but selection is unlikely, or when information is missing for either selection question. High when the result is likely to have been selected from multiple eligible measurements or from multiple eligible analyses.

---

## Domain 1b: Cluster-randomized trials

### Bias arising from identification or recruitment of individual participants within clusters

**Description:** For cluster-randomized parallel-group trials, including stepped-wedge designs, an additional domain addresses bias from identifying or recruiting individual participants after clusters were randomized. Add it to the five domains above.

Signalling questions (paraphrased; official numbering 1b.1-1b.3):
- 1b.1 Were all clusters randomized at the start of the trial, or were clusters recruited after randomization of the first cluster?
- 1b.2 If some clusters were recruited after randomization: Were participants recruited to these clusters without knowledge of their intervention status?
- 1b.3 If some clusters were recruited after randomization: Could the selection of participants into these clusters have been affected by knowledge of the intervention?

**What to look for in code/outputs:**
- Whether cluster randomization happened once at the start or rolled out over time
- Recruitment procedures and whether recruiters were aware of cluster allocation
- Baseline tables for participants recruited before and after randomization

---

## Reaching an overall judgement

**Description:** Combine the domain judgements into one overall risk-of-bias judgement for the result, with a rationale naming the main limitations. Apply the rules below and record the predicted direction of bias only when there is a clear basis for it.

**What to look for in code/outputs:**
- A table or figure of domain judgements and the overall judgement per result
- A sensitivity analysis restricted to results at low overall risk of bias

**Overall judgement rule (paraphrased):** Low when all domains are low. Some concerns when at least one domain raises some concerns and none is high. High when any domain is high, or when several domains raise concerns in a way that substantially lowers confidence.
