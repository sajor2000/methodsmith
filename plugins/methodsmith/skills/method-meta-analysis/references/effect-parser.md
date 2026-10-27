# Effect-Size String Parsers

## Contents

- [Hazard / odds / risk ratios](#hazard--odds--risk-ratios)
- [Adjusted labels](#adjusted-labels)
- [Parsed CSV contract](#parsed-csv-contract)
- [Mean differences](#mean-differences)
- [P-value-only reports](#p-value-only-reports)
- [Survival outcomes (special)](#survival-outcomes-special)
- [Conversion rules](#conversion-rules)
- [Conversions for the method-power handoff](#conversions-for-the-method-power-handoff)
- [Edge cases](#edge-cases)

The `effect_size_reported` field in `method-extract` output is free-text. Parse it with the regex patterns below.

## Hazard / odds / risk ratios

```
HR 0.78 (0.65, 0.93)            -> metric=HR, point=0.78, lo=0.65, hi=0.93
OR=1.45 (95% CI 1.10-1.91)      -> metric=OR, point=1.45, lo=1.10, hi=1.91
RR 0.80 [0.71-0.90]             -> metric=RR, point=0.80, lo=0.71, hi=0.90
adjusted HR 0.77, 95% CI 0.61 to 0.97 -> metric=HR, point=0.77, lo=0.61, hi=0.97
```

Regex (Python). Numbers may be signed, so MD/SMD reductions such as "MD -2.4 (-3.7 to -1.1)" keep their sign; a hyphen counts as a range separator only when it is surrounded by spaces or directly followed by a digit:

```
metric_re   = r'\b(HR|OR|RR|aOR|aHR|aRR|IRR|SMR|HRR|MD|SMD)\b'
number_re   = r'([−-]?\d*\.?\d+)'
estimate_re = rf'(?:=|\s){number_re},?\s*[\(\[]?\s*(?:95%\s*CI[:\s]*)?{number_re}\s*(?:\bto\b|,|;|–|—|\s-\s|-(?=\d))\s*{number_re}'
```

Replace the Unicode minus (`−`) with `-` before `float()`. After parsing, check every row: point and both bounds must be positive for ratio metrics, and `lo <= point <= hi` for every metric. A row that fails is a parse error, not data (for example "-1.2-0.2", which is ambiguous); drop it and count it with the other unparseable rows. Never drop a row only because its effect is negative: losing harms or reductions biases the pool.

## Adjusted labels

Normalise `aHR`, `aOR`, `aRR`, and "adjusted HR" to the base label in the `metric` column and keep the adjustment in a separate `adjusted` (true/false) column, because `scripts/pool_effects.R` matches `--metric` against the label exactly and would silently leave `aHR` rows out of an `HR` pool.

Sharing a label does not make effects interchangeable. Conditional and marginal
OR/HR can differ even without confounding (Daniel, Zhang & Farewell, Biom J 2021,
PMID 33314251). Select the scientific estimand and compatible adjustment set
before pooling. Never use a mixed adjusted/unadjusted primary pool as the power
anchor. Separate compatible pools may be sensitivity analyses with separate
outputs, but only the selected primary pool supplies the canonical handoff.
RR/MD collapsibility does not remove confounding or compatibility requirements.
For observational intervention effects, choose the appropriate adjusted estimate
using the protocol and confounding assessment, not the largest reported benefit
(Cochrane Handbook chapter 24).

## Parsed CSV contract

Write `analysis/effect-size/<query>-parsed.csv` with:

- `pmid, year, first_author, sample_size, metric, effect`, with source CI bounds `effect_lo, effect_hi` when available;
- `population, comparator, estimand, outcome, time_horizon, adjustment_specification, adjusted,
  analysis_scale, unit, study_design, independent_unit_id`.

Every row needs `uncertainty_source` naming the read source/table. Prefer a source-reported `standard_error` with `standard_error_scale=log` for OR/HR/RR or `identity` for MD/SMD; never log a ratio-scale SE. Without a reported SE, require `ci_method` (`wald_normal` or `wald_t`), `ci_level` as a fraction (e.g., `0.95` or `0.90`), and `ci_df` for t intervals. Also declare `ci_rounding_tolerance`: the maximum midpoint discrepancy justified by the source's printed rounding on the analysis scale, not a free tolerance to make an asymmetric interval pass. Set zero for exact unrounded bounds. The bundled `scripts/effect_uncertainty.R`, called by the pooling helper, validates and reconstructs these SEs; its numerical extraction uses base R.

Unknown, profile-likelihood, exact or bootstrap intervals cannot be converted by assuming a normal 95% CI. Obtain a justified source SE/variance or use an appropriate method outside this scalar helper; keep unresolved rows accounted for and block their use as a numeric power anchor. A valid source SE does not itself establish normality or scientific compatibility.

Resolve these scientific declarations from the protocol and read sources; do not
fill unknown fields with invented labels to satisfy the validator. `adjusted`
is `true`, `false` or `not_applicable` when genuinely appropriate. Use `none`
for no covariate adjustment. `analysis_scale` describes the input, not the
internal fit: `ratio` for unlogged OR/HR/RR and `identity` for MD or already
standardized SMD. Use a consistent declared unit (`dimensionless` for ratios);
convert MD units and their uncertainty before pooling. For SMD, establish the
same standardization/Hedges correction rather than mixing Cohen d and Hedges g.
Use a normalized study-design label and a reviewed independent contribution ID;
different publications from one cohort do not become independent because their
PMIDs differ. Resolve shared controls/overlap under the protocol before using
this independent-effects helper. More complex covariance methods belong in the
formal synthesis workflow.

The script rejects missing declarations, duplicate independent-unit IDs and
mixed scientific targets/units/adjustment sets. A pooled primary set must also
share the declared design. Narrative-only output for fewer than three compatible
effects carries no numeric power anchor. Matching strings document assertions;
they do not prove clinical compatibility or independence.

Keep `doi, pmcid, study_type, evidence_level` and inclusion/exclusion reasons in
the source ledger. Save the parsing/selection code as `<query>-parse.R` or `.py`
in the project. The successful helper writes `<output-stem>-contract.csv` for
the selected rows and names it in `contract=`; retain it with the summary and
read it before power/SAP use.

## Mean differences

```
MD 2.4 (95% CI 1.1-3.7) mmHg     -> metric=MD, point=2.4, lo=1.1, hi=3.7, unit=mmHg
SMD 0.34 (0.18-0.50)             -> metric=SMD, point=0.34, lo=0.18, hi=0.50
mean diff 4.5 (SE 1.2)           -> metric=MD, effect=4.5, standard_error=1.2, standard_error_scale=identity (retain source provenance)
```

## P-value-only reports

```
p < 0.001    -> point and CI not extractable; do NOT include in pooled estimate
p = 0.04
```

These rows are dropped from pooling. Surface count of dropped rows in the report.

## Survival outcomes (special)

When the paper reports both HR and median-survival difference, prefer HR for pooling. Median-survival differences are harder to combine across designs.

## Conversion rules

- For binary outcomes pooled across studies, prefer log(OR) or log(RR) -> pool log -> exponentiate the pooled estimate
- For continuous outcomes, prefer SMD over MD when scale differs across studies (Hedges g, with Hedges correction for small samples)
- For survival, prefer log(HR) -> pool -> exponentiate

## Conversions for the method-power handoff

Label every converted value as a conversion, with its inputs and their sources.

- Hedges g from Cohen d: `g = J * d`, `J = 1 - 3/(4*(n1 + n2) - 9)`. Record which one each study reported.
- ln(OR) -> SMD: `d = ln(OR) * sqrt(3)/pi` (= ln(OR)/1.81; Chinn, Stat Med 2000;19:3127-31, PMID 11113947). Assumes a logistic latent variable with comparable variation across studies.
- Two-proportion inputs from a ratio and a control risk P0: `p_T = OR*P0 / (1 - P0 + OR*P0)` or `p_T = RR*P0`. Cite P0 separately (PMID and level read); never pass an OR or RR to a two-proportion function as if it were a proportion.
- OR -> RR at control risk P0: `RR = OR / (1 - P0 + P0*OR)` (Zhang & Yu, JAMA 1998;280:1690-1, PMID 9832001). OR approximates RR only when P0 is below about 10%. The formula is exact for an unadjusted OR at the true P0, but biased with too-narrow CIs when applied to adjusted ORs (Gallis & Turner, Ann Glob Health 2019, PMID 31807416).
- NNT = `1/|P0 - p_T|`; state P0 and the time horizon. Never compute NNT from an OR or RR without P0.
- HR is not an RR or OR. Convert to event probabilities only through a survival model, for example `p_T(t) = 1 - (1 - P0(t))^HR` under proportional hazards, where `P0(t)` is the control-arm event probability by time `t`.

## Edge cases

- Asymmetric CI on the analysis scale beyond documented rounding: inspect its construction; never refit or symmetrize the published interval to manufacture a Wald SE.
- Known symmetric Wald CI: `SE = (upper - lower) / (2 * critical)` on the analysis scale, with `critical = qnorm((1+ci_level)/2)` or `qt((1+ci_level)/2, ci_df)`. Confidence level and degrees of freedom come from the source, not a default. See Cochrane Handbook chapter 6, section on obtaining SEs from confidence intervals: https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-06.
- Multiple effect estimates per paper (primary + sensitivity): use the primary
