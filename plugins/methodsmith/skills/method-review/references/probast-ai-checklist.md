# PROBAST+AI Tool for Prediction Model Studies

## Contents

- How PROBAST+AI works
- Part 1: Model development (quality and applicability)
- Part 2: Model evaluation (risk of bias and applicability)
- Domain 1: Participants and data sources
- Domain 2: Predictors
- Domain 3: Outcome
- Domain 4: Analysis
- Applicability
- Reaching an overall judgement

Prediction model Risk Of Bias ASsessment Tool +AI (PROBAST+AI). It assesses the methodological quality of a prediction model's development, the risk of bias in its predictive performance, and the applicability of the model to a stated purpose. It applies to any prediction or classification model in healthcare, whether built with regression or with artificial intelligence and machine learning methods. PROBAST+AI is an appraisal tool, not a reporting guideline; use TRIPOD+AI to report a model.

**Primary reference:** Moons KGM, Damen JAA, Kaul T, et al. PROBAST+AI: an updated quality, risk of bias, and applicability assessment tool for prediction models using regression or artificial intelligence methods. BMJ. 2025;388:e082505. doi:10.1136/bmj-2024-082505. PMID: 40127903. PMCID: PMC11931409.

**Source and licence:** Domain names, the two-part structure, the signalling-question counts, and the applicability-item counts follow the BMJ article (CC BY-NC 4.0, https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11931409/, checked on 2026-10-18). The article publishes the tool in supplementary tables 3 and 4, including the full signalling questions and the Explanation and Elaboration Light document; the domain descriptions and cues below are faithful paraphrases and use the article's official counts, not its verbatim item text. Use the published supplementary tables for the exact signalling questions. The "What to look for in code/outputs" cues are added by this plugin.

**Supersession:** PROBAST+AI supersedes PROBAST-2019 (Wolff et al. PROBAST. Ann Intern Med. 2019;170(1):51-58, doi 10.7326/M18-1376, PMID 30596875). The 2019 tool had 20 signalling questions across the domains participants, predictors, outcome, and analysis; the 2019 explanation and elaboration document remains the background reference. The old names PROBAST and PROBAST-2019 resolve to PROBAST+AI.

## How PROBAST+AI works

- The tool has two parts: model development (quality and applicability) and model evaluation (risk of bias and applicability). A study may include either part or both; assess each evaluated model separately.
- Both parts have four domains: participants and data sources, predictors, outcome, and analysis. The first three domains share the same signalling questions for either part.
- Model development uses 16 signalling questions to assess the quality of the development process. Model evaluation uses 18 signalling questions to assess the risk of bias in the reported performance estimates.
- Applicability is rated for the participants and data sources, predictors, and outcome domains: three applicability items for development and three for evaluation, six in total.
- Domain 4 (analysis) has five signalling questions for development and seven for evaluation.
- Each domain is assessed in four sections: general information, the signalling questions, a per-domain judgement, and a rationale.
- Domain judgements combine into an overall judgement: for development, low, high, or unclear concern about quality; for evaluation, low, high, or unclear risk of bias; and low, high, or unclear concern about applicability.
- Fairness and algorithmic bias are addressed throughout the signalling questions, and differences in scoring between regression-based and AI/machine-learning models are described in the Explanation and Elaboration Light.

## Part 1: Model development (quality and applicability)

**Description:** Assess the quality of how the model was constructed: data collection and study design through to fitting the final model or algorithm. Low quality here is a red flag that the developed model may be less reliable or less accurate when evaluated on new data. Development signalling questions number 16 across the four domains.

**What to look for in code/outputs:**
- A development protocol or SAP describing data source, eligibility, predictors, outcome, sample size, and modelling strategy before fitting
- A record of the modelling approach, hyperparameter search, and how the final model was selected

## Part 2: Model evaluation (risk of bias and applicability)

**Description:** Assess the risk of bias in the reported predictive performance: calibration, discrimination, net benefit, or classification metrics. Evaluation can be apparent (same data), internal (splitting, resampling, cross-validation), or external (separate data). Evaluation signalling questions number 18 across the four domains.

**What to look for in code/outputs:**
- Which performance estimates are reported (apparent, internal, external) and the data each used
- Whether internal validation repeated the full modelling pipeline inside each resample
- Whether an external evaluation used data truly separate from development

---

## Domain 1: Participants and data sources

### Participants and data sources (development: quality; evaluation: risk of bias)

**Description:** Assess issues related to the participants and data sources used for model development or model evaluation: the source of data, eligibility criteria, the setting, and whether the sample is representative of the intended population.

**What to look for in code/outputs:**
- Data source, recruitment period, setting, and eligibility criteria recorded in the protocol and reflected in the analysis code
- The target population defined before modelling, with the sampled population compared against it
- For evaluation, whether the evaluation sample is independent of the development sample

### Applicability -- Participants and data sources

**Description:** Judge whether the participants and data sources match the review question or the intended use of the model (population, setting, and case mix). Applicability items are rated separately from risk of bias.

**What to look for in code/outputs:**
- An applicability judgement with a rationale comparing the study population to the intended-use population

---

## Domain 2: Predictors

### Predictors (development: quality; evaluation: risk of bias)

**Description:** Assess the definition and measurement of the predictors included in the development or evaluation of the model, including whether predictors were available at the intended time of use and whether the predictor set is reproducible.

**What to look for in code/outputs:**
- Predictor definitions and measurement timing consistent between development and evaluation
- A check that no predictor is derived from information unavailable at prediction time
- For AI models, handling of predictors inside tree-based or neural methods, and reproducibility of preprocessing

### Applicability -- Predictors

**Description:** Judge whether the predictors, and how they were defined and measured, match the review question or the intended use of the model.

**What to look for in code/outputs:**
- An applicability judgement and rationale recorded for the predictors

---

## Domain 3: Outcome

### Outcome (development: quality; evaluation: risk of bias)

**Description:** Assess the definition and measurement of the outcome being predicted, including how the outcome was ascertained and whether the outcome definition is consistent across development and evaluation.

**What to look for in code/outputs:**
- The outcome definition, ascertainment method, and time horizon recorded and applied consistently
- A check that the outcome was measured without knowledge of the predictors where that matters

### Applicability -- Outcome

**Description:** Judge whether the outcome definition and measurement match the review question or the intended use of the model.

**What to look for in code/outputs:**
- An applicability judgement and rationale recorded for the outcome

---

## Domain 4: Analysis

### Analysis (development: quality; evaluation: risk of bias)

**Description:** Assess the data analysis methods: the choice of analysis method, the number of predictors relative to sample size, handling of missing data, handling of class imbalance, and the fairness and calibration methods applied. This domain has five signalling questions for development and seven for evaluation.

**What to look for in code/outputs:**
- Sample size justified against the number of candidate predictors (for example with `pmsampsize`)
- Missing-data handling documented and appropriate to the missingness mechanism
- For AI models, justified treatment of class imbalance rather than naive resampling, and fairness checks across relevant groups
- Performance metrics appropriate to the model's purpose, with calibration reported alongside discrimination

---

## Applicability

**Description:** Rate applicability for the participants and data sources, predictors, and outcome domains. Applicability is a separate judgement from quality (development) and risk of bias (evaluation).

**What to look for in code/outputs:**
- Three applicability items for development and three for evaluation, each with a rationale
- An overall applicability judgement of low, high, or unclear concern

---

## Reaching an overall judgement

**Description:** Combine the four domain judgements into an overall judgement for development (quality) and, separately, for evaluation (risk of bias), and combine the applicability items into an overall applicability judgement. Each is scored low, high, or unclear.

**What to look for in code/outputs:**
- A summary table of domain and overall judgements per assessed model
- Separate rows for development quality and evaluation risk of bias when a study does both

**Overall judgement rule (paraphrased):** Follow the combination guidance carried over from the tool formerly named PROBAST-2019, reproduced in the PROBAST+AI supplementary tables: a high concern in any domain drives a high overall judgement for that part, and missing information in a key domain gives unclear.
