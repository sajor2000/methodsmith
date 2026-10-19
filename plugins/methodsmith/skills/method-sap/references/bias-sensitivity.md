# Bias and Confounding Sensitivity Analysis

## Contents

- When a bias analysis is required
- The E-value and its limits
- Known but unmeasured confounders
- Quantitative bias analysis
- What the SAP records
- Sources

Read this file when a `Diagnostic` or `Decision_Evidence` row concerns unmeasured confounding, misclassification, selection, or missing-data bias, or when the user asks for an E-value.

## When a bias analysis is required

Every observational causal claim carries a `Diagnostic` entry for the systematic errors that could move the estimate: unmeasured confounding, exposure or outcome misclassification, selection, and missing data. Name the bias, the model used to quantify it, and the assumption that model rests on. A qualitative sentence in the limitations section is not a bias analysis.

## The E-value and its limits

The E-value is the minimum strength of association, on the risk-ratio scale, that an unmeasured confounder would need with both the exposure and the outcome to fully explain away the observed exposure-outcome association, conditional on the measured covariates (VanderWeele & Ding 2017). Report it for the point estimate and for the confidence limit closest to the null. A large E-value means a strong unmeasured confounder would be needed to explain the result away.

Limits that constrain how it may be used:

- It requires a risk-ratio-scale effect measure. Convert odds ratios and hazard ratios with the published approximations and state that the converted value is approximate.
- It applies to a binary, well-defined exposure contrast, and to a single unmeasured confounder or a set of confounders treated as one.
- No threshold defines a "small enough" E-value; it cannot be used as a pass/fail test (Ioannidis, Tan & Blum 2019).
- It is a monotone transform of the estimate and its confidence interval, so it adds no information beyond them. Report the estimate and interval as the primary result and the E-value as a robustness statement, never as evidence for causality.
- It addresses confounding only; it says nothing about misclassification, selection, or missing-data bias.

## Known but unmeasured confounders

An E-value is a statement about a confounder of unknown strength. When the confounder is known but unmeasured (a variable absent from the data whose associations can still be estimated or bounded), an E-value alone is not sufficient and can mislead:

- Use the bounding-factor inequality (Ding & VanderWeele 2016) with the exposure-confounder and confounder-outcome associations taken from the literature, a pilot, or a validation subsample, and report the implied bias factor.
- Or model the confounder directly in a quantitative bias analysis with explicit parameter values and their sources.
- State that an E-value computed alongside a known unmeasured confounder answers a different question (how strong an unknown confounder would have to be) and does not substitute for the bound.

## Quantitative bias analysis

Good practice for a quantitative bias analysis (Lash et al. 2014):

1. Select the biases that could plausibly change the conclusion, and record why the others were not analysed.
2. Choose a bias model for each: misclassification by sensitivity and specificity, confounding by a bias factor or direct adjustment, selection by selection probabilities.
3. Assign parameter values from a defensible source (internal validation, external literature, expert elicitation), and record the source for each.
4. Propagate uncertainty. Prefer a probabilistic (Monte Carlo) analysis over one set of values, and report a simulation interval alongside the conventional interval.
5. Present the bias-adjusted estimate as what the estimate would be under the stated assumptions, not as the corrected truth, and show which assumptions drive the result.

## What the SAP records

For each bias analysis, add or extend an `Analysis` row with the bias addressed, the bias model, the parameter values and their sources, and the output artifact. Mark it a sensitivity analysis when it targets the same estimand and supplementary when it does not, per `references/estimands.md`. Add a `Decision_Evidence` row citing the method, and a `Diagnostic` row naming the assumption the conclusion depends on.

## Sources

- VanderWeele TJ, Ding P. Sensitivity analysis in observational research: introducing the E-value. Ann Intern Med 2017;167:268-74. PMID 28693043. https://doi.org/10.7326/M16-2607
- Ioannidis JPA, Tan YJ, Blum MR. Limitations and misinterpretations of E-values for sensitivity analyses of observational studies. Ann Intern Med 2019;170:108-11. PMID 30597486. https://doi.org/10.7326/M18-2159
- Ding P, VanderWeele TJ. Sensitivity analysis without assumptions. Epidemiology 2016;27:368-77. PMID 26841057. https://doi.org/10.1097/EDE.0000000000000457
- Lash TL, Fox MP, MacLehose RF, Maldonado G, McCandless LC, Greenland S. Good practices for quantitative bias analysis. Int J Epidemiol 2014;43:1969-85. PMID 25080530. https://doi.org/10.1093/ije/dyu149
