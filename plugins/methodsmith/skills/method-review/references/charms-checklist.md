# CHARMS Checklist for Systematic Reviews of Prediction Modelling Studies

## Contents

- Review Framing (CHARMS Table 1)
- Domain 1: Source of Data
- Domain 2: Participants
- Domain 3: Outcome to be Predicted
- Domain 4: Candidate Predictors
- Domain 5: Sample Size
- Domain 6: Missing Data
- Domain 7: Model Development
- Domain 8: Model Performance
- Domain 9: Model Evaluation
- Domain 10: Results
- Domain 11: Interpretation and Discussion
- Presentation and Summary for Systematic Reviews (plugin addition)

CHecklist for critical Appraisal and data extraction for systematic Reviews of prediction Modelling Studies (CHARMS).
Seven items to frame the review question (Table 1) and 11 domains to extract and critically appraise the primary studies (Table 2), for systematic reviews of studies that develop, validate, or update diagnostic or prognostic prediction models. CHARMS is a data-extraction and appraisal checklist, not a reporting guideline.

**Primary reference:** Moons KGM, de Groot JAH, Bouwmeester W, et al. Critical appraisal and data extraction for systematic reviews of prediction modelling studies: the CHARMS checklist. PLoS Med. 2014;11(10):e1001744. doi:10.1371/journal.pmed.1001744. PMID: 25314315. PMCID: PMC4196729.

**Source and licence:** Framing items and domain key items are quoted verbatim from Tables 1 and 2 of the PLoS Med article (CC BY 4.0, https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4196729/). Table 2 also marks each key item as relevant to applicability and/or risk of bias; those flags are not reproduced here. The "What to look for in code/outputs" bullets are review cues added by this plugin, not checklist text.

For the reporting of the review itself, CHARMS refers to PRISMA; TRIPOD-SRMA (Snell et al. BMJ 2023, PMID 37137496) is the dedicated reporting checklist for systematic reviews of prediction models, and PROBAST+AI (Moons et al. BMJ 2025, PMID 40127903) is the dedicated risk-of-bias and applicability tool.

CHARMS is used alongside PRISMA when conducting systematic reviews of studies that develop, validate, or update prediction models. It guides both data extraction and critical appraisal. Each domain below describes the information to extract and appraise, and what to look for in analysis code and outputs when evaluating compliance during a code or analytic review of a prediction modelling systematic review.

---

## Review Framing (CHARMS Table 1)

Key items to guide the framing of the review aim, search strategy, and study inclusion and exclusion criteria:

1. **Prognostic versus diagnostic prediction model** -- Define whether the aim is to review models to predict future events (prognostic prediction models) or current (disease) status (diagnostic prediction models).
2. **Intended scope of the review** -- Define intended scope of the review and intended purpose of the models reviewed in it.
3. **Type of prediction modelling studies** -- Define the type of prediction modelling studies to include: prediction model development without external validation in independent data; prediction model development with external validation in independent data; external model validation, possibly with model updating.
4. **Target population to whom the prediction model applies** -- Define the target population relevant to the review scope.
5. **Outcome to be predicted** -- Define the outcome of interest to be predicted.
6. **Time span of prediction** -- Define over what specific time period the outcome is predicted (prognostic models only).
7. **Intended moment of using the model** -- The systematic review may focus on models to be used at a specific moment in time.

**What to look for in code/outputs:**
- Review protocol or screening code records each framing item (e.g., PICOTS fields) before data extraction begins
- Inclusion and exclusion logic in screening code matches the framing items

---

## Domain 1: Source of Data

### Source of Data

**Description (CHARMS key items):**
- Source of data (e.g., cohort, case-control, randomised trial participants, or registry data)

**What to look for in code/outputs:**
- Data extraction fields recording the data source type (randomized trial, prospective cohort, retrospective cohort, registry, electronic health record database, administrative claims)
- Code or notes distinguishing prospective data collection from retrospective use of existing data
- Documentation of the geographic setting, number of centers, and care setting (primary care, secondary care, emergency) for each included study
- Summary statistics describing the distribution of study designs across the systematic review's included studies
- Extraction of the time period over which data were collected for each study

---

## Domain 2: Participants

### Participants

**Description (CHARMS key items):**
- Participant eligibility and recruitment method (e.g., consecutive participants, location, number of centres, setting, inclusion and exclusion criteria)
- Participant description
- Details of treatments received, if relevant
- Study dates

**What to look for in code/outputs:**
- Inclusion and exclusion criteria for participants extracted and coded per study
- Code or notes documenting the setting and moment of intended model use (e.g., patients presenting to the emergency department with suspected sepsis)
- Baseline characteristic summaries extracted: age, sex, key clinical variables relevant to the prediction problem
- Assessment of whether the study population matches the target population in the review question
- Documentation of spectrum of disease severity and case mix in each included study

---

## Domain 3: Outcome to be Predicted

### Outcome to be Predicted

**Description (CHARMS key items):**
- Definition and method for measurement of outcome
- Was the same outcome definition (and method for measurement) used in all patients?
- Type of outcome (e.g., single or combined endpoints)
- Was the outcome assessed without knowledge of the candidate predictors (i.e., blinded)?
- Were candidate predictors part of the outcome (e.g., in panel or consensus diagnosis)?
- Time of outcome occurrence or summary of duration of follow-up

**What to look for in code/outputs:**
- Outcome variable definition extracted per study: clinical event, diagnosis, composite endpoint, or continuous measure
- Time horizon for prediction extracted (e.g., 30-day mortality, 5-year recurrence, in-hospital readmission)
- Measurement method for the outcome documented (administrative coding, clinical adjudication, registry linkage, laboratory confirmation)
- Competing events identified and their handling documented (e.g., censoring, cause-specific modeling, subdistribution hazard approach for competing risk outcomes)
- Assessment of whether the outcome definition is consistent with the review's target outcome and clinically meaningful
- Proportion of outcomes verified by blinded adjudication extracted and flagged when outcome verification was not blinded

---

## Domain 4: Candidate Predictors

### Candidate Predictors

**Description (CHARMS key items):**
- Number and type of predictors (e.g., demographics, patient history, physical examination, additional testing, disease characteristics)
- Definition and method for measurement of candidate predictors
- Timing of predictor measurement (e.g., at patient presentation, at diagnosis, at treatment initiation)
- Were predictors assessed blinded for outcome, and for each other (if relevant)?
- Handling of predictors in the modelling (e.g., continuous, linear, non-linear transformations or categorised)

**What to look for in code/outputs:**
- Full list of candidate predictors considered during development extracted and coded per study
- Measurement method and timing of predictor assessment documented (e.g., vital signs at hospital admission, lab values from first blood draw)
- Documentation of whether candidate predictors were pre-specified based on clinical knowledge or identified by data-driven variable selection
- Continuous predictor handling extracted: categorization (and cut-points), linear assumption, spline or polynomial transformation
- Assessment of predictor availability at the intended moment of model use (some predictors may require results not available at decision time)
- Inter-predictor correlation or multicollinearity assessment documented when reported

---

## Domain 5: Sample Size

### Sample Size

**Description (CHARMS key items):**
- Number of participants and number of outcomes/events
- Number of outcomes/events in relation to the number of candidate predictors (Events Per Variable)

**What to look for in code/outputs:**
- Number of participants, number of events, and events-per-variable (EPV) ratio extracted per study
- Code or notes flagging studies with EPV below commonly used thresholds (EPV < 10 for binary outcomes is a commonly cited concern; note that current guidance recommends events-per-parameter calculations over EPV thresholds)
- For validation studies: number of participants and events in the validation sample extracted separately from development sample
- Assessment of whether the sample size section provides a formal justification or power calculation
- Summary statistics describing the distribution of sample sizes and event counts across included studies

---

## Domain 6: Missing Data

### Missing Data

**Description (CHARMS key items):**
- Number of participants with any missing value (include predictors and outcomes)
- Number of participants with missing data for each predictor
- Handling of missing data (e.g., complete-case analysis, imputation, or other methods)

**What to look for in code/outputs:**
- Missing data handling method extracted per study: complete case analysis, single imputation, multiple imputation (and number of imputations), missing indicator method
- Proportion of missing data for key predictors and the outcome extracted when reported
- Assessment of whether the missing data mechanism was considered (missing completely at random, missing at random, missing not at random)
- Code or notes flagging studies that performed complete case analysis with >5-10% missing data as potentially biased
- Documentation of whether imputation was done separately for the development and validation samples in internal validation studies

---

## Domain 7: Model Development

### Model Development

**Description (CHARMS key items):**
- Modelling method (e.g., logistic, survival, neural networks, or machine learning techniques)
- Modelling assumptions satisfied
- Method for selection of predictors for inclusion in multivariable modelling (e.g., all candidate predictors, pre-selection based on unadjusted association with the outcome)
- Method for selection of predictors during multivariable modelling (e.g., full model approach, backward or forward selection) and criteria used (e.g., p-value, Akaike Information Criterion)
- Shrinkage of predictor weights or regression coefficients (e.g., no shrinkage, uniform shrinkage, penalized estimation)

**What to look for in code/outputs:**
- Modeling method extracted: logistic regression, Cox proportional hazards, Fine-Gray subdistribution hazard, random forest, gradient boosting, neural network, or other machine learning approach
- Predictor selection method extracted and appraised: all pre-specified predictors included, backward/forward/stepwise selection, LASSO, elastic net, or other penalization
- Stepwise selection based solely on statistical significance without clinical pre-specification flagged as a concern for overfitting
- Shrinkage or penalization applied (ridge, LASSO, elastic net, global shrinkage factor) extracted and documented
- Interaction terms included in the final model extracted and their clinical justification documented
- Final model presented as a score, nomogram, regression equation, or software tool extracted

---

## Domain 8: Model Performance

### Model Performance

**Description (CHARMS key items):**
- Calibration (calibration plot, calibration slope, Hosmer-Lemeshow test) and Discrimination (C-statistic, D-statistic, log-rank) measures with confidence intervals
- Classification measures (e.g., sensitivity, specificity, predictive values, net reclassification improvement) and whether a priori cut points were used

**What to look for in code/outputs:**
- Discrimination metrics extracted per study: C-statistic (AUC for binary outcomes, Harrell's C for survival), sensitivity and specificity at a reported threshold, D-statistic
- Calibration metrics extracted: calibration plot (visual), Hosmer-Lemeshow test, calibration slope, calibration-in-the-large (O/E ratio)
- Reliance on Hosmer-Lemeshow test alone as evidence of good calibration flagged (test has low power and is sensitive to sample size)
- Overall performance metrics extracted: Brier score, Nagelkerke R-squared, scaled Brier score
- Confidence intervals for performance metrics extracted when reported
- Code or notes documenting whether performance metrics were computed on the same data used for development (optimistic) vs. a held-out validation set (less biased)

---

## Domain 9: Model Evaluation

### Model Evaluation

**Description (CHARMS key items):**
- Method used for testing model performance: development dataset only (random split of data, resampling methods, e.g., bootstrap or cross-validation, none) or separate external validation (e.g., temporal, geographical, different setting, different investigators)
- In case of poor validation, whether model was adjusted or updated (e.g., intercept recalibrated, predictor effects adjusted, or new predictors added)

**What to look for in code/outputs:**
- Validation type extracted per study: apparent performance only, internal validation (bootstrap or cross-validation), internal-external cross-validation, temporal external validation, geographic external validation, independent external validation
- Studies reporting only apparent performance without any validation flagged as high risk of optimism
- Internal validation method extracted: bootstrap resampling with optimism correction, k-fold cross-validation, leave-one-out cross-validation
- Optimism-corrected performance estimates extracted separately from apparent estimates
- For external validation studies: the development study being validated identified and the degree of overlap in population and setting described
- Heterogeneity in external validation performance across geographic settings or time periods documented and analyzed

---

## Domain 10: Results

### Results

**Description (CHARMS key items):**
- Final and other multivariable models (e.g., basic, extended, simplified) presented, including predictor weights or regression coefficients, intercept, baseline survival, model performance measures (with standard errors or confidence intervals)
- Any alternative presentation of the final prediction models, e.g., sum score, nomogram, score chart, predictions for specific risk subgroups with performance
- Comparison of the distribution of predictors (including missing data) for development and validation datasets

**What to look for in code/outputs:**
- Final model equation, regression coefficients, or score weights extracted per study (enables model reproduction and meta-analysis of effects)
- Predictor-specific effect estimates (odds ratios, hazard ratios, regression coefficients) with confidence intervals extracted
- Meta-analysis code pooling C-statistics or calibration metrics across studies using appropriate variance-stabilizing transformations (logit transformation for C-statistics)
- Heterogeneity statistics (I-squared, tau-squared) reported for meta-analyzed performance metrics
- Forest plots of C-statistics or calibration slopes across included studies generated
- Studies reporting only graphical results without numerical estimates flagged as limiting meta-analysis inclusion

---

## Domain 11: Interpretation and Discussion

### Interpretation and Discussion

**Description (CHARMS key items):**
- Interpretation of presented models (confirmatory, i.e., model useful for practice versus exploratory, i.e., more research needed)
- Comparison with other studies, discussion of generalizability, strengths and limitations

**What to look for in code/outputs:**
- Documentation of whether the included studies assessed clinical utility: decision curve analysis, net reclassification improvement (NRI), integrated discrimination improvement (IDI)
- Extraction of net benefit or decision curve analysis results when reported
- Assessment of whether authors' conclusions are proportionate to the strength of validation evidence (development-only studies should not claim external validity)
- Recommendations for intended clinical application qualified by the available validation evidence
- Limitations sections addressing overfitting, missing data handling, outcome definition, and generalizability extracted and summarized across included studies
- Recommendations for future validation or model updating identified as knowledge gaps in the systematic review discussion

---

## Presentation and Summary for Systematic Reviews

### Risk of Bias Assessment Across Domains (plugin addition, not a CHARMS item)

**Description:** For formal risk-of-bias and applicability judgements use PROBAST+AI (Moons et al., BMJ 2025, PMID 40127903; `references/probast-ai-checklist.md`); CHARMS supports extraction. Summarize critical appraisal findings across CHARMS domains for all included studies, identifying the prevalence of methodological concerns and their likely direction of bias on reported model performance.

**What to look for in code/outputs:**
- Risk of bias or methodological concern coded per domain per study using a structured appraisal table (commonly using PROBAST+AI alongside CHARMS for formal bias ratings)
- Code generating a summary visualization of methodological quality across included studies
- Sensitivity analyses in the meta-analysis restricting to studies with adequate sample size, external validation, or no stepwise selection
- Meta-regression examining the association between methodological quality indicators and reported discrimination or calibration
- Narrative synthesis discussing the overall quality of the prediction model literature for the target condition and how it limits confidence in pooled estimates
