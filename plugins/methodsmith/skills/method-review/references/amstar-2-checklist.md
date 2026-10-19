# AMSTAR 2 Tool for Systematic Reviews

## Contents

- How AMSTAR 2 works
- Items 1-16
- Critical domains
- Rating overall confidence

A MeaSurement Tool to Assess systematic Reviews, second version (AMSTAR 2). It critically appraises systematic reviews of healthcare interventions that include randomised trials, non-randomised studies, or both. AMSTAR 2 is an appraisal tool, not a reporting guideline; use PRISMA 2020 to report a review. It is not intended for diagnostic test accuracy reviews, individual participant data meta-analyses, network meta-analyses, scoping reviews, or realist reviews.

**Primary reference:** Shea BJ, Reeves BC, Wells G, et al. AMSTAR 2: a critical appraisal tool for systematic reviews that include randomised or non-randomised studies of healthcare interventions, or both. BMJ. 2017;358:j4008. doi:10.1136/bmj.j4008. PMID: 28935701. PMCID: PMC5833365.

**Supersession:** AMSTAR 2 supersedes AMSTAR 1 (Shea et al. Development of AMSTAR: a measurement tool to assess the methodological quality of systematic reviews. BMC Med Res Methodol. 2007;7:10, doi 10.1186/1471-2288-7-10, PMID 17302989); the old names amstar and amstar-1 resolve to AMSTAR 2.

**Source and licence:** The 16 items and the response categories are quoted verbatim from the BMJ article (CC BY 4.0, https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5833365/, checked on 2026-10-18). The full user guide is supplementary appendix 1 to that article, and the instrument itself is the supplementary figure. The "What to look for in code/outputs" cues are added by this plugin.

## How AMSTAR 2 works

- 16 items, each answered Yes, Partial Yes, or No. The items are framed so that "Yes" is the positive result.
- There is no "not applicable" or "cannot answer" option: every item is relevant to contemporary systematic reviews of healthcare interventions. If no information is given, do not give the authors the benefit of the doubt; rate the item "No".
- "Partial Yes" is available on items where partial adherence to the standard is worth distinguishing.
- Seven items are designated as critical domains. Weaknesses there undermine confidence in the review.
- Do not combine item ratings into a single score. Scores hide critical weaknesses. Instead, rate overall confidence using the critical-domain rules.
- Identify critical domains before starting the appraisal, and record the appraiser's rationale for each item.

---

## Items 1-16

### Item 1 -- PICO

**Description:** Did the research questions and inclusion criteria for the review include the components of PICO? Add a timeframe when it is critical to capturing relevant clinical outcomes.

**What to look for in code/outputs:**
- A protocol or methods section that states population, intervention, control group, and outcome for each review question
- Screening criteria that map onto those PICO elements

### Item 2 -- Protocol before the review

**Description:** Did the report of the review contain an explicit statement that the review methods were established prior to the conduct of the review, and did the report justify any significant deviations from the protocol?

**What to look for in code/outputs:**
- A registered or published protocol, with independent verification, dated before the review began
- A list of deviations from the protocol and their justification

### Item 3 -- Study design selection

**Description:** Did the review authors explain their selection of the study designs for inclusion in the review? When both randomised and non-randomised studies address the same question, consider whether restricting to randomised trials would give an incomplete summary.

**What to look for in code/outputs:**
- A stated rationale for including randomised trials, non-randomised studies, or both
- A documented strategy rather than an unstated design restriction

### Item 4 -- Literature search

**Description:** Did the review authors use a comprehensive literature search strategy? This item also covers grey literature, which the original instrument handled separately.

**What to look for in code/outputs:**
- At least two databases searched, with search strings and dates reported
- Searches of reference lists, trial registries, or grey literature, and a stated search strategy for non-randomised studies
- A reproducible search log or query file

### Item 5 -- Duplicate study selection

**Description:** Did the review authors perform study selection in duplicate?

**What to look for in code/outputs:**
- Two reviewers screening titles, abstracts, and full texts, with agreement or disagreement handling described
- Screening records or a screening tool that captures reviewer identity

### Item 6 -- Duplicate data extraction

**Description:** Did the review authors perform data extraction in duplicate? For non-randomised studies this includes extracting adjusted effect estimates, so judgement is needed to select the estimate that best fits the PICO question and is at lowest risk from confounding.

**What to look for in code/outputs:**
- Two reviewers extracting data, with a reconciliation step
- An extraction form that records which effect estimate was selected and why

### Item 7 -- Excluded studies (critical domain)

**Description:** Did the review authors provide a list of excluded studies and justify the exclusions?

**What to look for in code/outputs:**
- A list of studies excluded at full-text stage, each with a reason
- A flow diagram consistent with the counts in that list

### Item 8 -- Description of included studies

**Description:** Did the review authors describe the included studies in adequate detail? Detail is needed about research designs, study populations, interventions, comparators, and outcomes.

**What to look for in code/outputs:**
- A characteristics-of-included-studies table covering design, population, intervention, comparator, and outcome
- Enough detail to judge whether combining studies is appropriate and to explain heterogeneity

### Item 9 -- Risk of bias in included studies (critical domain)

**Description:** Did the review authors use a satisfactory technique for assessing the risk of bias in individual studies included in the review? The item specifies bias domains for randomised and non-randomised studies based on the Cochrane risk-of-bias instruments (RoB 2 and ROBINS-I).

**What to look for in code/outputs:**
- A named risk-of-bias tool per design, applied at the outcome or result level
- Domain-level ratings with support, not a single quality score
- For non-randomised studies, an assessment covering confounding, selection, intervention classification, deviations, missing data, outcome measurement, and selective reporting

### Item 10 -- Funding of included studies

**Description:** Did the review authors report on the sources of funding for the studies included in the review?

**What to look for in code/outputs:**
- A funding or sponsor field per included study, carried into the synthesis or discussion
- Explicit consideration of industry funding where it is present

### Item 11 -- Meta-analytical methods (critical domain)

**Description:** If meta-analysis was performed, did the review authors use appropriate methods for statistical combination of results?

**What to look for in code/outputs:**
- An effect measure and model (fixed or random effects) justified for the data
- An appropriate heterogeneity estimator and, for few studies, a small-sample adjustment such as Hartung-Knapp
- Separate synthesis of randomised and non-randomised studies where their risks of bias differ

### Item 12 -- Impact of risk of bias on the meta-analysis

**Description:** If meta-analysis was performed, did the review authors assess the potential impact of risk of bias in individual studies on the results of the meta-analysis or other evidence synthesis?

**What to look for in code/outputs:**
- Sensitivity or subgroup analyses by risk-of-bias level, or a meta-regression on risk of bias
- A stated rule for whether high-risk studies enter the primary synthesis

### Item 13 -- Risk of bias in interpretation (critical domain)

**Description:** Did the review authors account for risk of bias in primary studies when interpreting or discussing the results of the review?

**What to look for in code/outputs:**
- A discussion that weights conclusions by the risk of bias in the included studies
- Explicit caution where the evidence base is at serious or high risk of bias

### Item 14 -- Heterogeneity

**Description:** Did the review authors provide a satisfactory explanation for, and discussion of, any heterogeneity observed in the results of the review?

**What to look for in code/outputs:**
- A quantified heterogeneity estimate with an interpretation
- An investigation of clinical and methodological sources of heterogeneity, not only statistical tests

### Item 15 -- Publication bias (critical domain)

**Description:** If they performed quantitative synthesis, did the review authors carry out an adequate investigation of publication bias (small study bias) and discuss its likely impact on the results of the review?

**What to look for in code/outputs:**
- Funnel plot, Egger or equivalent test, where the number of studies allows
- A discussion of publication bias even when a test is underpowered, including for non-randomised evidence

### Item 16 -- Conflicts of interest

**Description:** Did the review authors report any potential sources of conflict of interest, including any funding they received for conducting the review?

**What to look for in code/outputs:**
- A funding and competing-interest statement for the review itself, separate from the funding of the included studies

---

## Critical domains

**Description:** Seven items are critical domains. A flaw in a critical domain may not be fatal if further information shows the original rating was wrong, but it should generally undermine confidence in the review. The listed domains are a suggestion; appraisers may add or substitute others. For example, failing to include non-randomised studies in a review of adverse outcomes (item 3) may be critical, as may an inability to explain large variation in treatment effects (item 14).

**What to look for in code/outputs:**
- A pre-appraisal record of which domains are treated as critical for this review

**Critical domains (verbatim):**
- Protocol registered before commencement of the review (item 2)
- Adequacy of the literature search (item 4)
- Justification for excluding individual studies (item 7)
- Risk of bias from individual studies being included in the review (item 9)
- Appropriateness of meta-analytical methods (item 11)
- Consideration of risk of bias when interpreting the results of the review (item 13)
- Assessment of presence and likely impact of publication bias (item 15)

---

## Rating overall confidence

**Description:** Rate overall confidence in the results of the review from the pattern of critical and non-critical weaknesses. Do not derive an overall score from the item ratings.

**What to look for in code/outputs:**
- A stated overall confidence rating with the critical and non-critical weaknesses that drove it

**Rating rules (verbatim):**
- **High:** no or one non-critical weakness. The review provides an accurate and comprehensive summary of the results of the available studies that address the question of interest.
- **Moderate:** more than one non-critical weakness. The review has more than one weakness but no critical flaws, and may provide an accurate summary of the results of the available studies included in the review.
- **Low:** one critical flaw with or without non-critical weaknesses. The review has a critical flaw and may not provide an accurate and comprehensive summary of the available studies that address the question of interest.
- **Critically low:** more than one critical flaw with or without non-critical weaknesses. The review has more than one critical flaw and should not be relied on to provide an accurate and comprehensive summary of the available studies.

Multiple non-critical weaknesses may diminish confidence and it may be appropriate to move the overall appraisal down from moderate to low confidence.
