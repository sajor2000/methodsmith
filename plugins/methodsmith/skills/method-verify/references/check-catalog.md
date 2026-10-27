# Verification Check Catalog

## Contents

- 1. Sample Size Check
- 2. Data Leakage Scan
- 3. Effect Direction Check
- 4. Missing Data Audit
- 5. PHI Scan
- 6. Figure Quality
- 7. Reproducibility Check
- 8. Number Registry Check
- 9. Statistic Recomputation Check

Each check runs independently. Skip checks that don't apply to the current analysis.

## 1. Sample Size Check

**What:** Does the analysis N match expectations?

**Sources to cross-reference:**
- `reports/data-qa/<extract_id>.md` (canonical `method-data-qa` output; fall back to legacy `analysis/data-qa-report.md`) — expected N from data QA gate
- `analysis/power/` — minimum N from power calculation
- SAP file — stated sample size or inclusion/exclusion criteria

**Use the design's information unit.** Separate screened/enrolled/randomized N,
expected analyzable N, dropout-inflated recruitment target, observed events and
independent clusters. Name the comparator and its SAP source before assigning a
status. For survival, compare target and observed events as well as follow-up;
adequate patient N alone does not establish the planned information. For cluster
studies compare independent clusters and their sizes. For prediction development,
check the prespecified Riley criteria/parameter and event assumptions, not a
fixed EPV rule. Do not substitute a recruitment target for analyzable N.

**Pass:** The population/denominator and required design-specific information
match the SAP, and participant flow reconciles with data QA. Planned attrition
is accounted for against analyzable N, not counted as a recruitment-target error.
**Warn:** A disclosed information shortfall, planned attrition beyond assumptions,
unknown comparator, or missing target prevents confirming planned precision.
A 10-25% N difference is a screening flag, not evidence of bias or adequate power.
**Fail:** Unexplained participant duplication/loss or the wrong denominator breaks
the analysis contract, or a prespecified required event/cluster/information gate
is unmet. Never mark event adequacy PASS merely because enrollment N is large.

**How to check:** Reconcile cohort flow counts with the QA/SAP populations and
power output fields (`total`, `with_dropout`, events and clusters). Use recorded
design assumptions; do not compute observed/post-hoc power from the fitted effect.

## 2. Data Leakage Scan

**What:** Are train/test/validation splits respected? Is information from the future used to predict the past?

**Checks:**
- Normalization (StandardScaler, center/scale) fit on training data only, not full dataset
- No feature engineering using outcome variable
- Temporal splits honor time ordering (no future data in training set)
- Subject-level splits: same patient/subject not in both train and test
- No target encoding or frequency encoding computed on full dataset before splitting
- Feature selection, univariable screening, and oversampling (e.g., SMOTE) happen only after the split, inside training folds
- Hyperparameters and decision thresholds are chosen without touching the test set
- No duplicate or near-duplicate encounters across splits; repeated encounters are grouped by patient
- Every predictor is available at the prediction time point (no post-index codes, discharge diagnoses, or future labs)

Leakage taxonomy: Kapoor & Narayanan, Patterns 2023 (PMID 37720327).

**Pass:** No leakage signals detected.
**Warn:** Ambiguous pattern found (e.g., scaling code exists but split location is unclear).
**Fail:** Clear leakage detected (e.g., `StandardScaler().fit(X)` before `train_test_split()`).

**When to skip:** No train/test split exists (single-cohort observational study with no prediction model).

## 3. Effect Direction Check

**What:** Does the observed effect direction match the hypothesis?

**Source:** `analysis/research-question.yaml` — `pico.outcome` and the study hypothesis.

**Pass:** Effect direction matches hypothesis, or study is descriptive (no directional hypothesis).
**Warn:** Estimated direction is opposite to the hypothesis. First verify the exposure reference level, outcome event coding (e.g., Cox `event` 1 = event), and effect-measure orientation (e.g., OR for exposed vs unexposed) in the code; if coding is correct, report the reversal as a finding, not a defect. A CI spanning the null is an imprecise result, not a reversal.
**Fail:** N/A — a reversed effect is never a structural error, only a scientific finding.

**When to skip:** No `analysis/research-question.yaml` exists, or the study is purely descriptive.

## 4. Missing Data Audit

**What:** Is missingness reported, and is its handling valid under a stated mechanism and consistent with the SAP?

**Checks:**
- Missingness per key variable (exposure, outcome, primary covariates), reported for context
- Assumed mechanism (MCAR, MAR, MNAR) stated, and the handling method matches the SAP (e.g., SAP says "multiple imputation with m=20" — verify)
- First distinguish inferential estimation from prediction, and development from validation/deployment.
- For inferential multiple imputation of covariates, include the outcome and analysis-model variables as appropriate to the substantive model; justify any exception. Choose m for stable estimates/Monte Carlo error (the percentage of incomplete cases is a starting heuristic, not a universal validity threshold; White, Royston & Wood, Stat Med 2011, PMID 21225900).
- For prediction, verify the prespecified missing-predictor strategy and whether missingness is allowed at deployment. Outcome-inclusive MI during model development can be appropriate; it does not authorize using held-out labels to impute predictors in a deployed prediction pipeline. In deployment-faithful validation with missing predictors, apply the locked, training-fitted strategy without validation outcomes. Keep imputation, feature selection and tuning inside the appropriate resampling folds. An inferential MI analysis targeting fully observed future patients is a different validation estimand and needs its own explicit assumptions; do not deploy an outcome-dependent imputer. Sisk et al., simulation study: https://arxiv.org/abs/2206.12295.
- Complete-case analysis is justified (MCAR, or missingness depending only on covariates) and allowed by the SAP

**Pass:** Missingness is reported; the mechanism is stated; handling matches the SAP; MI (if used) meets the checks above.
**Warn:** Imputation method or m differs from the SAP; complete-case analysis is used without a stated justification; no MNAR sensitivity analysis (e.g., delta adjustment) is planned for a missing outcome.
**Fail:** Missing outcome or exposure data with no handling stated in the SAP; inferential covariate MI that unjustifiably omits the outcome; or validation/deployment predictor imputation that uses unavailable outcomes and leaks information. Do not fail a deployment-faithful prediction imputer merely because it excludes the outcome.

Never pass or fail on percent missing alone: bias depends on the mechanism and the method, not the proportion (Madley-Dowd et al., J Clin Epidemiol 2019, PMID 30878639).

## 5. PHI Scan

**What:** Do output files contain patient-level identifiers?

**Checks:**
- Files in `output/`, `analysis/`, and any `data_root` path
- Look for: MRN, SSN, date of birth, full name, address, phone, email, medical record number
- Check column names: `mrn`, `ssn`, `dob`, `name`, `address`, `phone`, `email`, `patient_name`
- Check for patient-level rows (individual-level data) in output files

**Pass:** No PHI signals detected.
**Warn:** Column names suggestive of PHI but values appear de-identified (e.g., hashed IDs).
**Fail:** Clear PHI detected (dates of birth, names, addresses in output files).

**CLIF-specific:** When `__CE_CLIF__ active=true`, permit patient-level working data only in gitignored `output/intermediate_phi/`; verify it is never shared or committed. Require `output/final_no_phi/` to contain aggregate-only artifacts with no identifiers, raw data files, or reported cells below the CLIF project floor of n>=10 (a stricter site or DUA rule wins).

## 6. Figure Quality

**What:** Do generated figures meet the project's style profile (`method-figure`; target-journal rules only when a journal is declared)?

**Checks:**
- All text legible at final print size (default minimum 8pt unless the profile says otherwise)
- No text overlap: titles, legends, footnotes, axis labels, annotations don't collide
- Legends don't obscure data
- Axes labelled, with units

**Pass:** All figures meet style requirements.
**Warn:** Minor issue detected (e.g., one label at 7pt, or legend partially overlapping non-critical area).
**Fail:** Major issue (text fully unreadable, legend blocking data, no axis labels).

**How to check:** Read each figure file (PNG, PDF, SVG) and visually inspect. For Matplotlib/ggplot2 source code, check font size parameters.

If `analysis/publication/figures/figure-manifest.json` exists, validate it with `method-figure` before marking figures manuscript-ready. The manifest must link each figure to source data, source code, caption, alt text, SAP section, and style profile.

**When to skip:** No figure files found in output or analysis directories.

## 7. Reproducibility Check

**What:** Can this analysis be reproduced from the code and data?

**Checks:**
- Random seeds set and recorded in output metadata: R `set.seed()` (parallel R: `RNGkind("L'Ecuyer-CMRG")` or `future.seed = TRUE`); Python `np.random.default_rng(seed)` (preferred over legacy `np.random.seed()`) and `random_state=`
- Package versions locked: `renv.lock` (R) or `requirements.txt` / `pyproject.toml` / `conda.lock` (Python)
- Data paths are project-root-relative (e.g., `here::here()`, `pathlib` relative to the repo root) or read from config; no hardcoded absolute or user-specific paths
- No interactive/manual steps required (all steps scriptable)

**Pass:** Seeds set, package versions locked, data paths configurable.
**Warn:** Seeds set but no lockfile, or lockfile exists but some packages are unpinned.
**Fail:** No random seeds in scripts that use randomization (bootstrap, imputation, cross-validation, train/test split).

## 8. Number Registry Check

**What:** Does every reported number trace to the analysis that produced it?

**Checks:** Load the `method-numbers` skill and run its `check` on the manuscript sources, rendered copies, and tables. The gate reads `analysis/numbers/registry.json` and fails on untraced numbers, inline computed values, unknown placeholder ids, stale entries (a source file or script changed), untraceable entries (no sources, no SAP output, or an uncommitted script), unsuppressed counts from 1 to 10, unknown SAP output IDs, and when it found nothing to check.

**Pass:** The gate exits 0 and prints `PASS`.
**Warn:** Never; a number either traces or it does not.
**Fail:** The gate exits 1, or it could not run. List its `file:line: reason: token` lines as printed.

**When to skip:** No registry exists and the outputs do not yet feed a manuscript, table, caption, or model card.

## 9. Statistic Recomputation Check

**What:** Are reported statistics internally consistent? Does the printed P value follow from the printed t/F/chi2/z and its df, and can the printed mean or percentage exist at the printed N?

**How to check:** Extract the printed statistics from outputs and tables into a claims file — each value and reported P as the printed string, so its rounding is known — then run the bundled script:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/verify_stats.py" check analysis/numbers/stat-claims.json --alpha <SAP-alpha> --out qc/stat_check.json
```

For ordinary reference-distribution tests, the script uses the declared t/z `alternative` (`two-sided`, `greater`, `less`) and the upper tail for F/chi2, preserving signed statistic rounding. Each item records `p_method`; adjusted, exact, permutation and sequential P values need their actual method and are WARN/not checked here. Set `alternative="unknown"` when the SAP does not establish it. Never infer sidedness from significance or halve a reported P to make it agree. Legacy items without these fields retain ordinary two-sided t/z or upper-tail F/chi2 behavior; new extractions must declare them. Pass the SAP alpha explicitly with CLI `--alpha`; a top-level `alpha` field in the claims file does not configure this helper. The std-lib calculation needs no scipy. GRIM separately checks integer-count compatibility at the printed rounding. Malformed supported-test items fail closed.

**Pass:** The reported P lies inside the recomputed rounding envelope (or a statistic has no reported P, in which case the recomputed P is attached); an integer count reproduces the mean or percentage.
**Warn:** The P method or sidedness is unsupported/unknown (not checked, requiring analyst resolution); the reported P is inconsistent but stays on the same side of alpha; a mean or percentage is impossible only under an inferred granularity (confirm the measurement scale before failing it).
**Fail:** The reported and recomputed P values fall on opposite sides of the declared alpha (a decision error); a mean or percentage is arithmetically impossible under the declared granularity or the printed denominator; or a claims item is malformed.

**When to skip:** No inferential statistics (t/F/chi2/z with P values) and no means or percentages with N appear in the outputs or tables.
