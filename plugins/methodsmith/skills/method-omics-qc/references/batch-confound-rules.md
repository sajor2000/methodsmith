# Batch-Confound Detection Rules

The single most damaging silent failure in omics. When batch and condition are aliased, no statistical method recovers the correct signal.

The numeric cutoffs here (Cramér's V > 0.5, 0.3-0.5, PC1 > 30% variance, > 90% separation) are project defaults, not published thresholds. Cite a source per SKILL.md Evidence access or label them `project default` in the report.

## Heuristic flags (P0)

1. **Date-of-processing equals condition arm.** All cases processed on day 1, all controls on day 2: full aliasing (the `~ batch + condition` design matrix is rank-deficient). Strong partial overlap: Cramér's V between batch and condition > 0.5.
2. **Plate / lane equals condition arm.** Same as above with plate or sequencing lane.
3. **Site equals condition arm in multi-site data.** Cases from site A, controls from site B.
4. **Sex differs between arms.** If condition is unbalanced by sex AND sex is not a study variable, batch-effect-removal will mask sex differences.
5. **PC1 separates by batch perfectly.** PCA on count matrix; PC1 explains > 30% variance and separates samples by batch label with > 90% accuracy. If condition is also separated → confounded.

## Heuristic warnings (P1)

1. **Batch and condition associated (Cramér's V 0.3-0.5).** Partial confound; model batch in the DE design, at a cost in power.
2. **Some batches have very few samples.** Inspect replication, residual degrees of freedom and contrast support; N=1 or N=2 is a warning, not a universal impossibility rule for every model.
3. **Batch correction applied without inspection.** ComBat / RUV / SVA called blindly; the analyst should look at PCA before and after.

## What to recommend when confounded

- **Re-block the experiment.** Often impossible after the fact, but should be the first option.
- **Separate aliasing from partial confounding.** Always check the design matrix and intended contrast independently of PC1/PC2. If a partially confounded contrast remains identifiable, prespecified with/without-batch sensitivity analyses may describe robustness. Stability alone does not establish validity or publication readiness, and cannot rescue full aliasing.
- **Use within-batch comparisons only.** If each batch contains both arms, restrict to within-batch contrasts.
- **Paired / matched comparisons require support.** Matching within batch is possible only where both conditions are observed and must preserve the intended estimand; it cannot create missing condition-by-batch combinations.

## What NOT to recommend

- Applying ComBat with `mod = NULL` (or ComBat-Seq with `group = NULL`) when condition differs across batches (removes condition signal), or testing differential expression on a ComBat-corrected matrix with unbalanced groups (inflated confidence; Nygaard et al., Biostatistics 2016, PMID 26272994). Prefer batch as a term in the DE model.
- "Batch as a random effect" when batch is fully aliased with condition -- the model is unidentifiable.
- Reporting batch-corrected effect sizes without showing the original.

## Reporting in the manuscript

The batch-confound assessment should appear in the Methods section (illustrative numbers; report the observed values):

> "We assessed batch-effect confounding with Cramér's V between batch (sequencing run date) and condition arm; V = 0.18 indicated partial overlap suitable for inclusion of batch as a covariate in the differential-expression model. Sensitivity analyses excluding batch X (N = 8) yielded concordant top-50 differentially expressed genes (Spearman r = 0.94)."
