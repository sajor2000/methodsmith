# Advanced Model Routing

Read only the branches needed for the current decision.

## Survival, competing risks, and recurrent events

Define time zero, event, competing events, censoring, truncation, and target contrast first. Cox models target hazards and require proportional-hazards assessment unless effects are explicitly time-varying. Flexible parametric or AFT models may better match absolute-risk or time-ratio targets. Cause-specific and Fine-Gray models answer different competing-risk questions; name the estimand rather than selecting both by convention. Recurrent-event methods must state whether event order, gap time, subject frailty, and terminal events matter.

Use a joint longitudinal-survival model only when the association between an endogenous longitudinal process and event risk is part of the estimand or informative dropout cannot be addressed by a simpler justified model. Specify the shared structure and association parameter; route complex implementation and validation for human review.

## Causal estimation

An outcome regression is not a causal design by itself. Require a target-trial or equivalent specification: eligibility, treatment strategies, assignment, time zero, follow-up, outcome, estimand, censoring, and analysis plan. Use a DAG or defensible causal model for adjustment.

Choose among standardization/g-computation, propensity-score weighting or matching, marginal structural models, doubly robust estimators, instrumental variables, regression discontinuity, or difference-in-differences based on identification assumptions and longitudinal structure. Diagnose positivity, balance, weight instability, treatment-confounder timing, interference, and unmeasured confounding. Route review to `method-causal-inference-reviewer` through `method-review`.

## Prediction and machine learning

Choose models from intended use, sample/event size, nonlinearities, interactions, deployment constraints, and validation design. Respect subject/site/time boundaries in splitting. Keep preprocessing, imputation, feature selection, and tuning inside resampling. Compare against a simple prespecified baseline. Report calibration, discrimination (AUROC), clinical utility (net benefit), risk distributions, instability, subgroup performance, and external, temporal, or internal-external validation as appropriate. Do not resample or reweight for class imbalance.

Do not use test-set performance for model selection. Do not interpret feature importance as a causal effect. Read `ml-training-protocol.md` for the Python training loop: validation design, fold structure, sample size and stability, performance measures, imbalance, tuning on proper scoring rules, candidate learners including tabular foundation models, device strategy, calibration, thresholds, and explainability figures. Route experiment recording to `method-ml-track` and final documentation to `method-model-card`.

## Bayesian hierarchical models

Use Bayesian modeling when prior information, partial pooling, complex hierarchy, direct probability statements, or regularization of weak variance components materially serves the estimand. Specify prior predictive implications, parameterization, sampler settings, convergence thresholds, effective sample size, posterior predictive checks, and sensitivity to reasonable priors.

Bayesian fitting does not repair unidentified causal effects, poor data grain, or separation between the requested estimand and likelihood. Prefer a simple identifiable hierarchy over a custom model whose diagnostics cannot be interpreted.

## Meta-analysis and evidence synthesis

Define the synthesis estimand, effect measure, within-study uncertainty, and source of heterogeneity. A fixed-effect model estimates one common effect under its assumptions; a random-effects model estimates a distribution/mean across heterogeneous effects. Do not choose based only on a heterogeneity-test p-value.

For random effects, predeclare the tau-squared estimator, interval method, influence checks, and prediction interval when meaningful. Investigate dependence among multiple effects from one study, small numbers of studies, publication bias limitations, and clinical/methodological heterogeneity before pooling. Route extraction to `method-extract`, pooling to `method-meta-analysis`, and power assumptions to `method-power`.

## Complex distributions and custom models

Hurdle, zero-inflated, mixture, latent-class, nonlinear, spatial, multistate, and measurement-error models require a scientifically identifiable mechanism, not merely better fit. State which process each component represents and how parameters answer the estimand. Predeclare simpler comparators and simulation or posterior-predictive checks. If the available data cannot distinguish components, prefer the simpler model or return `blocked`.
