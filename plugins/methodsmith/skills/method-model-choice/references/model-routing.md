# Model Routing

Read this file for every model-strategy decision. Route by aim and estimand before outcome family. A familiar software function is never the reason to choose a model.

## Core outcome routing

| Data and estimand | Primary candidates | Required checks | Common wrong turn |
|---|---|---|---|
| Continuous, unbounded mean | Linear model/ANCOVA | Functional form, residual pattern, influential observations | Testing raw outcome normality instead of model residual adequacy |
| Continuous, skewed positive | Gamma GLM, log-normal model, quantile model, or two-part model | Zero mass, target scale, retransformation, tail behavior | Log-transforming without defining the estimand after transformation |
| Binary | Logistic, log-binomial, or modified Poisson with robust variance | Desired OR/RR/RD scale, separation, calibration if predictive | Choosing logistic merely because it converges when the requested estimand is risk ratio |
| Ordinal | Proportional-odds or partial proportional-odds model | Ordering, sparse categories, proportional-odds assumption | Treating ordinal categories as continuous without justification |
| Nominal multinomial | Multinomial regression | Reference category, sparse cells, independence assumptions | Collapsing clinically distinct outcomes only to simplify fitting |
| Count | Poisson or negative binomial | Exposure/offset, overdispersion, excess zeros, truncation | Using Poisson after observed variance materially exceeds its mean structure |
| Semicontinuous or structural zeros | Hurdle/two-part or zero-inflated model | Whether zeros are structural, sampling, or outcome-defined | Selecting zero inflation solely from a likelihood improvement |
| Rate | Poisson/negative binomial with log exposure offset | Person-time definition and zero exposure | Modeling counts without the exposure denominator |
| Bounded proportion | Binomial model when numerator/denominator exist; beta-type model otherwise | Boundary values, denominator, measurement process | Treating a proportion with varying denominators as Gaussian |
| Time to first event | Cox, flexible parametric, or accelerated failure-time model | Time zero, censoring, PH/shape assumptions | Using logistic regression when follow-up varies materially |
| Competing event | Cause-specific and/or subdistribution model based on estimand | Competing-event definition and target quantity | Calling a cause-specific hazard a cumulative-incidence effect |
| Recurrent events | Andersen-Gill, PWP, frailty, or count/rate model | Event ordering, risk intervals, terminal events | Treating events from one subject as independent |
| Longitudinal/repeated | LMM, GLMM, MMRM, GEE, or transition model | Estimand and correlation structure | Adding a random intercept automatically without defining target interpretation |

## Aim overlays

### Descriptive or associational

Target the requested population summary or adjusted association. Avoid causal language. Prefer directly interpretable contrasts and confidence intervals over automated variable selection.

### Causal

Define treatment strategies, time zero, eligibility, follow-up, outcome, estimand, confounder set, censoring, interference assumptions, and positivity before choosing an outcome regression. Read `advanced-models.md` and route code review to the causal reviewer.

### Prediction

Define intended use, prediction horizon, target population, validation design, leakage boundary, calibration, and decision threshold. An inferential regression may still be a prediction model, but p-values are not its selection criterion.

Determine the minimum development sample size with the Riley et al. criteria (BMJ 2020, PMID `32188600`; `pmsampsize` in R/Stata), not a fixed events-per-variable rule (van Smeden et al. 2019, PMID `29966490`). Keep continuous predictors continuous and model nonlinearity with restricted cubic splines; never dichotomize for convenience (Harrell, *Regression Modeling Strategies*, 2nd ed., ch. 2). Use penalized estimation (ridge, lasso, elastic net, or uniform shrinkage) when the sample-size criteria are not comfortably met, and report bootstrap optimism-corrected discrimination and calibration slope (Steyerberg & Vergouwe 2014, PMID `24898551`). With several sites or calendar periods, validate by internal-external cross-validation (PMID `33836256`). Do not correct class imbalance in a risk model (PMID `35686364`). For flexible or machine-learning candidates, read `ml-training-protocol.md`.

### Validation or agreement

Match the metric and model to the reference standard, repeated ratings, and intended decision: calibration, discrimination, agreement, reliability, or measurement error are different targets.

### Evidence synthesis

Separate fixed-effect from random-effects meta-analysis based on the synthesis estimand and heterogeneity model, not the significance of a heterogeneity test. Route formal synthesis to `method-clif-meta-analysis`; use `method-meta-analysis` only for a compatible literature effect-size anchor for power.

## Estimation and inference

- State whether inference is model-based, robust/sandwich, bootstrap, permutation, small-sample corrected, Bayesian posterior, or design-based.
- Match standard errors to the sampling/dependence structure. Robust errors do not repair a wrong mean model, wrong time zero, or unidentified causal estimand.
- Pre-specify nonlinear terms and interactions from scientific need; do not use univariate screening or stepwise p-values as the primary model-building strategy.
- Distinguish conditional effects, marginal standardized effects, and predictions. For nonlinear mixed models, setting random effects to zero is not population marginalization.
- Centering choices in multilevel models change interpretation. Separate within-cluster and between-cluster effects when a predictor varies at both levels.

## Minimum diagnostics

Every primary model needs checks for convergence/identifiability, influential observations, functional form, family-specific residual behavior, and uncertainty calibration. Add design-specific checks:

- Binary: separation, calibration, sparse cells.
- Count: dispersion, zero structure, offset validity.
- Ordinal: proportional-odds or threshold assumptions.
- Survival: proportional hazards when used, time-varying effects, informative censoring.
- Prediction: minimum sample size (Riley criteria), resampling by the independent unit, calibration, optimism, bootstrap instability, net benefit, subgroup performance.
- Causal: balance, overlap/positivity, weight distribution, time alignment, sensitivity to unmeasured confounding.
- Meta-analysis: heterogeneity estimate uncertainty, influence, and prediction interval when appropriate.

## Fallback rules

Fallbacks respond to diagnosed failure, never to an inconvenient p-value:

1. Confirm data, coding, scale, and design matrix.
2. Confirm optimizer/convergence and identifiability.
3. Simplify only the unsupported component while preserving the estimand.
4. Use an alternative family or estimator when diagnostics show a structural mismatch.
5. If no defensible model remains, return `blocked` and identify the additional data or design decision required.

## Example memo skeleton

Illustrative structure only; every value comes from the project's own inputs and ledger.

```text
Status: provisional            Reviewer: pending
Aim/estimand: marginal mean difference in 12-month HbA1c, intervention vs usual care
Grain: patient-visit; 4 visits; 38 clinics (clusters); dropout 18%, related to baseline HbA1c (MAR plausible)
Primary: Gaussian LMM, clinic random intercept plus unstructured within-patient residual covariance (MMRM-type; no patient random intercept), REML, Kenward-Roger df
Rejected: GEE (dropout not plausibly MCAR; 38 clusters needs a bias-corrected sandwich) -> sensitivity analysis only
Diagnostics: residual vs fitted by visit; singularity; influential clinics; fallback = assess clinic variance support; if unsupported, retain the patient unstructured residual covariance without the clinic intercept
Sensitivity: delta-adjusted MNAR tipping point for dropout
Ledger: "MAR validity of likelihood LMM vs GEE" -> Fitzmaurice 2011 (textbook, documentation); PMID 11252587 (abstract)
```
