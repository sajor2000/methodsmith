# Python Implementation

Use the project's locked environment and existing conventions. Check `pyproject.toml`, lockfiles, requirements, imports, and installed versions before writing calls. Do not install packages.

## Preferred established paths

| Need | Candidate path | Capability boundary |
|---|---|---|
| Inferential linear/GLM | `statsmodels` formula/API | Verify family, link, contrasts, covariance type, diagnostics |
| Gaussian mixed model | `statsmodels.regression.mixed_linear_model.MixedLM` | Gaussian LMM; not a general frequentist GLMM implementation |
| Population-average repeated outcome | `statsmodels.genmod.generalized_estimating_equations.GEE` | Requires correct groups, family, covariance structure, and cluster count |
| Bayesian binomial/Poisson random effects | Installed `statsmodels` Bayesian mixed-GLM path or approved Bayesian stack | Approximation and output differ from `MixedLM`; do not present as equivalent frequentist GLMM |
| Survival | Installed `lifelines`, `statsmodels`, `scikit-survival`, or project-approved path | Match inferential versus predictive aim and package capabilities |
| Bayesian hierarchy | Installed PyMC/Bambi or project-approved path | Priors, sampling diagnostics, posterior predictive checks |
| Prediction/ML | `scikit-learn` pipeline or installed project stack | Split by independent unit; all learning inside resampling; follow `ml-training-protocol.md` |
| Meta-analysis | Existing project implementation or route computation to `method-meta-analysis` | Do not invent parity with mature R tooling |

If Python cannot credibly implement the selected model with installed dependencies, retain the statistical recommendation but set `status=provisional` and the code path to `none` while a vetted R or Bayesian alternative awaits human approval. Use `status=blocked` when no credible implementation path exists. Never emit `ready_for_review` without its required scaffold, and never silently replace a GLMM with ordinary logistic regression or a GEE because it is easier to code.

## Scaffold contract

The `.py` scaffold must:

1. Declare required columns and fail when any are absent.
2. Assert row grain/identifier expectations and validate grouping/event/exposure columns.
3. Keep family, link, formula, groups, random design, and covariance choices explicit.
4. Fit one primary model and isolate sensitivity models.
5. Treat convergence warnings and unsupported covariance estimates as failures requiring review.
6. Produce estimand-aligned contrasts, standardized predictions, or performance estimates.
7. Respect cluster/subject/time boundaries during bootstrap or validation.
8. Save no row-level predictions, random effects, or patient data by default.

For `MixedLM`, verify `groups`, fixed-effects design, `re_formula`/random-effects design, optimizer result, and covariance identifiability. For GEE, verify the cluster identifier, time/wave ordering when used, family/link, working correlation, and whether the number of clusters supports the requested sandwich inference. For Bayesian models, record R-hat, effective sample size, divergences, prior/posterior predictive checks, and sensitivity to material priors.

Pin no new dependency in the scaffold. If an unfamiliar or version-sensitive API is required, verify official documentation for the installed version; otherwise write no scaffold, use `provisional` or `blocked` with `code=none`, and record the exact version gap.
