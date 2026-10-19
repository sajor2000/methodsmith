# CONSORT-Outcomes 2022 Checklist for Trial Report Outcome Reporting

## Contents

- Methods -- Outcomes (items 6a.1-6a.10)
- Methods -- Sample size (item 7a.1)
- Methods -- Statistical methods (items 12a.1-12a.4)
- Results -- Outcomes and estimation (item 17a.1)
- Results -- Ancillary analyses (item 18.1)

OUTCOME REPORTING extension for randomized trial reports (CONSORT-Outcomes 2022).
17-item extension covering outcome definition and justification, the target difference, analysis methods for multiplicity, exclusions, and missing data, and prespecified vs non-prespecified analyses in trial reports. CONSORT-Outcomes 2022 was written against CONSORT 2010, which CONSORT 2025 supersedes; apply it with the CONSORT 2025 core, never instead of it. It is a matched pair with SPIRIT-Outcomes 2022 for trial protocols: when outcome reporting is reviewed, offer both.

**Primary reference:** Butcher NJ, Monsour A, Mew EJ, et al. Guidelines for Reporting Outcomes in Trial Reports: The CONSORT-Outcomes 2022 Extension. JAMA. 2022;328(22):2252-2264. doi:10.1001/jama.2022.21022. PMID: 36511921.

**Source and licence:** All 17 extension item IDs and their CONSORT-section mapping were verified on 2026-10-19 against Table 1 of the JAMA paper, which interleaves the extension items with the core items of CONSORT 2010, which CONSORT 2025 supersedes. The JAMA article is copyright 2022 American Medical Association (all rights reserved) and carries no open licence (checked 2026-10-19 via Crossref and the published PDF), so the item descriptions below are faithful paraphrases that keep every element of the official item. Use the JAMA paper or the CONSORT website's fillable checklist for verbatim wording. The "What to look for" bullets are methodsmith review guidance, not CONSORT-Outcomes 2022 content.

Each item gives the official item ID keyed to the CONSORT 2010 numbering that CONSORT 2025 supersedes, a description, and what to look for in analysis code and outputs when evaluating compliance. Apply the CONSORT 2025 core alongside this extension.

---

## Methods -- Outcomes (items 6a.1-6a.10)

### Item 6a.1 -- Primary outcome domain rationale

**Description:** Explain why the domain of the trial's primary outcome was selected.

**What to look for in code/outputs:**
- Protocol or SAP text justifying the chosen primary outcome domain

### Item 6a.2 -- Outcome definition

**Description:** For each outcome, state the specific measurement variable (for example, systolic blood pressure), the analysis metric (for example, change from baseline, final value, time to event), the method of aggregation (for example, mean or proportion), and the time point.

**What to look for in code/outputs:**
- Outcome definition table with variable, metric, aggregation, and time point per outcome
- Analysis code extracting outcome variables consistent with those definitions

### Item 6a.3 -- Minimal important change

**Description:** When the primary outcome's analysis metric expresses within-participant change, define and justify the minimal important change for individuals.

**What to look for in code/outputs:**
- Stated minimal important change value with its justification
- Change-score computation in the analysis matching the defined metric

### Item 6a.4 -- Cutoff values for categorical analysis

**Description:** When continuous outcome data were analyzed as categorical (method of aggregation), state the cutoff values used.

**What to look for in code/outputs:**
- Categorization thresholds in the analysis code matching the reported cutoffs

### Item 6a.5 -- Analysis time points

**Description:** When outcome assessments were made at several post-randomization time points, name the time points used for the analysis.

**What to look for in code/outputs:**
- Analysis time-point selection documented; assessments at other time points not silently dropped

### Item 6a.6 -- Composite outcome components

**Description:** When a composite outcome was used, define every individual component of the composite.

**What to look for in code/outputs:**
- Component list in the protocol, SAP, or outcome-definition table
- Composite construction code using exactly those components

### Item 6a.7 -- Non-prespecified outcomes

**Description:** Flag any outcomes that were not prespecified in the trial registry or protocol.

**What to look for in code/outputs:**
- Outcomes reported that are absent from the registry entry or protocol
- Non-prespecified outcomes labelled as such (for example, exploratory)

### Item 6a.8 -- Study instruments

**Description:** Describe the study instruments used to assess the outcome (for example, questionnaires, laboratory tests), together with their reliability, validity, and responsiveness in a population similar to the study sample.

**What to look for in code/outputs:**
- Instrument names with measurement properties cited
- Instrument version or configuration recorded

### Item 6a.9 -- Outcome assessors

**Description:** Describe who assessed the outcome (for example, a nurse or parent) and any qualifications or trial-specific training needed to administer the study instruments.

**What to look for in code/outputs:**
- Assessor role and training documented in methods

### Item 6a.10 -- Outcome data quality

**Description:** Describe the processes used to promote outcome data quality during collection (for example, duplicate measurements) and after collection (for example, range checks of outcome data values), or say where those details can be found.

**What to look for in code/outputs:**
- Quality-check steps in the pipeline (range checks, duplicate measurement handling)
- Reference to a data management document when details live elsewhere

## Methods -- Sample size (item 7a.1)

### Item 7a.1 -- Target difference

**Description:** State and justify the target difference used between treatment groups (for example, the minimal important difference).

**What to look for in code/outputs:**
- Sample-size calculation inputs in the SAP matching the stated target difference
- Justification for the target difference value

## Methods -- Statistical methods (items 12a.1-12a.4)

### Item 12a.1 -- Multiplicity

**Description:** Describe any methods used to handle multiplicity in analyzing or interpreting the primary and secondary outcomes (for example, coprimary outcomes, one outcome assessed at several time points, or subgroup analyses of an outcome).

**What to look for in code/outputs:**
- Multiplicity adjustment (for example, alpha spending, hierarchical testing) in the SAP and analysis code
- Adjustment scope matching the listed multiplicity sources

### Item 12a.2 -- Outcome data exclusions

**Description:** Give and justify the criteria for excluding any outcome data from the analysis and reporting, or state that no outcome data were excluded.

**What to look for in code/outputs:**
- Exclusion filters documented and applied in code
- Counts of excluded outcome data reported

### Item 12a.3 -- Missing data

**Description:** Describe how missingness patterns were assessed (for example, missing not at random) and how missing outcome items or entire assessments were handled.

**What to look for in code/outputs:**
- Missingness summary (per outcome and time point)
- Handling method in the analysis code matching the described approach

### Item 12a.4 -- Analysis population

**Description:** Define the outcome analysis population relative to protocol nonadherence (for example, as a randomized analysis).

**What to look for in code/outputs:**
- Analysis-population definition in the SAP; population flags in the analysis dataset consistent with it

## Results -- Outcomes and estimation (item 17a.1)

### Item 17a.1 -- All prespecified outcome results

**Description:** Report the results of all prespecified outcome analyses, or state where those results can be found if not in this report.

**What to look for in code/outputs:**
- Results present for every prespecified outcome analysis
- External reference (supplement, registry results page) where a result is not in the main report

## Results -- Ancillary analyses (item 18.1)

### Item 18.1 -- Non-prespecified analysis justification

**Description:** For any analyses that were not prespecified, explain why they were done.

**What to look for in code/outputs:**
- Non-prespecified (exploratory) analyses labelled with their rationale
