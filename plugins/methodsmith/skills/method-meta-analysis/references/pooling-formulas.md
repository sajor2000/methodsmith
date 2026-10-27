# Pooling Formulas (what `scripts/pool_effects.R` computes)

The bundled script is the authority: it pins every method in its `meta::metagen` call, because `meta` defaults changed across versions (for example the prediction interval moved from k-2 to k-1 df in `meta` 7.1). This page explains those choices and how to read the output. Do not hand-code a variance estimator when R is available.

| Quantity | Pinned method | Source |
|---|---|---|
| tau^2 | REML (`method.tau = "REML"`) | Veroniki et al., Res Synth Methods 2016;7:55-79, PMID 26332144 |
| 95% CI of the pooled effect | Hartung-Knapp-Sidik-Jonkman, t with k-1 df (`method.random.ci = "HK"`) when tau^2 > 0; Wald z when tau^2 = 0 | Cochrane Handbook v6.5, section 10.10.4.4; IntHout et al., BMC Med Res Methodol 2014;14:25, PMID 24548571 |
| 95% prediction interval | t with k-1 df (`method.predict = "V"`) | Cochrane Handbook v6.5, section 10.10.4.3; Veroniki et al., Res Synth Methods 2019;10:23-43, PMID 30129707 |

For formal site-to-lead synthesis or a systematic review, use `method-clif-meta-analysis`; power-anchor filters are not review eligibility rules.

## Inputs per study

For each study `i`:
- `theta_i` = effect size on the analytic scale (log(HR), log(OR), MD, SMD)
- `v_i = se_i^2`, from a source-reported SE or a validated symmetric Wald interval with its actual confidence level and, for t intervals, df. Use the log scale for ratio metrics. `scripts/effect_uncertainty.R` enforces the contract in `effect-parser.md`; division by 3.92 is limited to a normal 95% interval.
- `w_i = 1 / (v_i + tau^2)` = random-effects inverse-variance weight

## tau^2 by REML

REML estimates the heterogeneity variance by optimizing a restricted likelihood.
Use the bundled maintained package call rather than a hand-written iteration.
The closed-form DerSimonian-Laird moment estimator uses common-effect weights;
iterating that expression does not turn it into REML. R `meta::metagen` and
`metafor::rma(method="REML")` provide the requested estimator.

## Pooled estimate and CI

```
pooled_theta = sum(w_i * theta_i) / sum(w_i)
se_HK^2      = sum(w_i * (theta_i - pooled_theta)^2) / ((k - 1) * sum(w_i))
pooled_ci    = pooled_theta +/- t_{k-1, 0.975} * se_HK      # HKSJ, when tau^2 > 0
pooled_ci    = pooled_theta +/- 1.96 * sqrt(1 / sum(w_i))   # Wald, only when tau^2 = 0
```

The Wald z interval is too narrow with few studies (IntHout 2014: its error rate can exceed 30% where HKSJ at most doubles the nominal 5%). HKSJ can itself be too narrow when tau^2 is estimated as 0, and very wide with k = 3; Cochrane's guidance is HKSJ when tau^2 > 0 and k > 2.

For ratio metrics, exponentiate the estimate and both limits.

## Heterogeneity

```
I^2 = max(0, (Q - (k - 1)) / Q) * 100%
tau^2 = (from REML); tau = between-study SD on the analytic scale
```

Read I^2 with the Cochrane Handbook v6.5 section 10.10.2 overlapping bands: 0-40% might not be important, 30-60% may represent moderate, 50-90% may represent substantial, 75-100% considerable heterogeneity. I^2 is relative and depends on study precision, so interpret it with tau and the prediction interval (Higgins JPT, Thompson SG, Deeks JJ, Altman DG. Measuring inconsistency in meta-analyses. BMJ 2003;327(7414):557-60. PMID 12958120; PMCID PMC192859; DOI 10.1136/bmj.327.7414.557).

## Prediction interval

The prediction interval is the range a NEW study's effect would fall in -- wider than the CI. Often more useful for planning a new study.

```
PI = pooled_theta +/- t_{k-1, 0.975} * sqrt(tau^2 + SE(pooled_theta)^2)
```

For ratio metrics, exponentiate. PI is what `method-power` should use as the sensitivity-sweep bounds; the signal carries it as `pi=lo,hi`. The script emits `pi=NA` when `meta` returns no finite bounds, and `method-power` falls back to `ci=`. Prediction intervals are unstable with few studies (Cochrane encourages them from about five studies); with k = 3-4 state that the PI is imprecise.

## When NOT to pool

The k and I^2 cutoffs below are working conventions of this skill, not literature-derived thresholds; state them in the output and look up the question-specific guidance (see `references/evidence-access.md`) when a reviewer or the SAP needs a sourced justification.

- k < 3: report narrative range only
- I^2 > 80%: report pooled estimate but caution; consider subgroup or meta-regression
- Mixed OR and RR in the input: subset to the modal metric; OR -> RR needs each study's control risk (see `references/effect-parser.md`)
- Adjusted and unadjusted OR/HR: select one compatible primary estimand/adjustment set before fitting; separate sensitivity pools cannot justify a mixed primary power anchor (see `references/effect-parser.md`)
- Small-study effects (funnel plot asymmetry): suggest a sensitivity analysis; do not drop studies by size for the primary estimate

## Software equivalents

- R: `meta::metagen(TE, seTE, studlab, sm = "HR", method.tau = "REML", method.random.ci = "HK", prediction = TRUE, method.predict = "V")`; `metafor::rma(yi, vi, method = "REML", test = "knha")`
- Python: `statsmodels.stats.meta_analysis.combine_effects(effect, variance, method_re = "iterated", use_t = True)` gives Paule-Mandel tau^2 (recommended alongside REML by Veroniki 2016), not REML; label it as such, or call R `metafor` through `rpy2`
- Stata: `meta set theta se, eform`; `meta summarize, random(reml) se(khartung) predinterval`
