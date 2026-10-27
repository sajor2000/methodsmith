---
name: method-phenotype
description: "Validates a computable phenotype against chart review: 2x2 table, PPV, NPV, sensitivity, specificity, Wilson intervals. Use when checking a phenotype or code list."
argument-hint: "<phenotype name>, <chart-review CSV path>, optional --algorithm-output csv"
---

# Phenotype Algorithm Validation


## Skill Value

- **Problem it solves:** Phenotype algorithms can look plausible but misclassify cases, and their accuracy can differ across subgroups or datasets.
- **Use when:** The user defines, reviews, or validates clinical phenotypes, code lists, or computable cohort definitions.
- **Output:** Phenotype validation report (2x2, PPV/NPV/sensitivity/specificity with Wilson CIs, subgroup results, sample-size caveats), a suppressed aggregate CSV, a concept-set provenance update, and a handoff signal.
- **Ask only if:** Only when phenotype target, source vocabularies, or validation data are unclear.
- **Do not do:** Do not certify clinical validity without evidence.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

EHR phenotypes are algorithmic case definitions (e.g., "T2DM = 2+ ICD codes within 12 months OR HbA1c ≥ 6.5% OR T2DM medication"). They drift, they have built-in PPV/sensitivity tradeoffs, and they need explicit validation. This skill runs the validation against a chart-review gold standard.

## When this skill activates

- A new phenotype is defined and used as inclusion / outcome
- A previously-validated phenotype is being applied to a new dataset (re-validate, don't trust)
- Reviewer (`method-administrative-data-reviewer`) flagged unvalidated phenotype
- Manual: `method-phenotype T2DM analysis/cohort/chart-review-T2DM.csv`

## Prerequisites

- A chart-review file (`chart-review-<phenotype>.csv`) with columns: `subject_id`, `chart_label` (0/1 = absent/present per chart adjudication)
- An algorithm output file: same `subject_id`s, with `algo_label` (0/1 = phenotype-not-met / phenotype-met)
- Optional: subgroup columns (`sex`, `age_band`, `race`)
- The sampling design of the chart review: simple random sample of the cohort, or sampled within algorithm strata. For an algo-stratified sample, also the cohort counts of algorithm-positive and algorithm-negative patients (aggregate counts only); without them sensitivity and specificity are not estimable. Sample-size planning is in `references/sampling-strategies.md`.

## PHI and disclosure rules

The chart-review file is patient-level PHI — a manually adjudicated gold standard keyed by `subject_id`. Handle it like any patient-level extract:

- Keep the chart-review and algorithm-output files in a gitignored location (e.g., `output/intermediate_phi/`); never commit, share, or copy them into report directories. If they arrive elsewhere, verify the path is gitignored before proceeding.
- **Sensitive-data boundary.** Resolve `phi_environment.mode` in `.methodsmith/config.local.yaml` (worktree, then main checkout; legacy `compliant: true` = `approved`, `compliant: false` = `schema-only`, `sensitive_data: false` = `no-sensitive-data`; any schema-only signal wins; unreadable = `schema-only`). `approved` or `no-sensitive-data`: proceed silently and never mention the boundary again. `schema-only`: headings, types, counts, and aggregates only; never open, print, or paste data values; run data-reading scripts as `method-safe-run -- <command>` (path in the guard's deny message); save results as aggregate tables (counts under 11 suppressed) in `output/` or a `phi_environment.aggregate_dirs` entry. Unset, interactive: ask once with the blocking question tool (else a numbered list) offering `Approved endpoint: full access`, `Not approved or unsure: schema-only`, and `No sensitive data: public or synthetic`; save the answer as `phi_environment.mode` there once `git check-ignore -q .methodsmith/config.local.yaml` passes (else first add `.methodsmith/*.local.yaml` to `.gitignore`) so the guard hook sees it. Unset, headless: schema-only.
- Never write `subject_id`s, row-level data, or free-text chart excerpts into the report. Reports carry aggregate counts only.
- Apply small-cell suppression to every reported cell — confusion-matrix cells and subgroup rows alike. Default disclosure floor is n<11 unless the project declares its own floor (for example the CLIF consortium floor of n>=10) or a site or DUA rule is stricter: suppress or merge subgroups below the floor, and suppress complementary cells recoverable by subtraction from totals. Small N is a re-identification risk, not only a CI-width problem.
- The saved cell-count CSV (Step 6) contains only suppressed aggregate counts, never `subject_id`-level rows.

## Evidence access

When this run needs literature, read `references/evidence-access.md` first; never invent a citation, effect size, or guideline item.

- **Look up here:** published PPV/sensitivity/specificity benchmarks for this phenotype, vocabulary, and population (PheKB/eMERGE validations, RECORD-style validation reports), cited by PMID and used only as comparators; any PPV assumed before the chart review (for example the planning value in `references/sampling-strategies.md`) is an assumption until a looked-up or measured value replaces it.

## Core workflow

### Step 1: Load and merge

Apply the project's declared patient-key normalization before joining; do not case-fold or remove leading zeroes unless that identifier schema requires it. Validate nonempty, unique `subject_id` keys in both inputs before joining, and require a one-to-one patient join. Duplicate or conflicting patient labels block validation; never silently deduplicate or count encounters/adjudicator rows as independent patients. Repeated-unit designs require a separately specified clustered analysis. Inner-join on the validated keys, document unmatched subjects and reasons, and assess whether exclusions could bias verification before reporting N matched and N dropped. The bundled validator rejects blank or duplicate patient keys without echoing their values.

### Step 2: Compute the 2x2

| | Chart positive | Chart negative |
|--|----------------|----------------|
| Algo positive | TP | FP |
| Algo negative | FN | TN |

### Step 3: Compute metrics for the sampling design

- **PPV** = TP / (TP + FP) -- "of those flagged by the algorithm, what fraction are real cases?"
- **NPV** = TN / (TN + FN) -- "of those NOT flagged, what fraction are truly negative?"
- **Sensitivity** = TP / (TP + FN) -- "of the real cases, what fraction does the algorithm catch?"
- **Specificity** = TN / (TN + FP)
- **F1** (optional, descriptive only) -- prevalence-dependent and ignores TN; never a primary validity metric.
- Cohen's kappa is reported for **inter-adjudicator** agreement on the reference standard, not for algorithm-vs-chart validity.

PPV and NPV are estimated directly under either design. Under algo-stratified sampling, the raw-cell sensitivity and specificity are biased by verification (work-up) bias whenever the stratum sampling fractions differ (Begg & Greenes, Biometrics 1983, PMID 6871349). Compute them only with the inverse-sampling-fraction weights in `references/sampling-strategies.md`; never from raw sample cells. Without the cohort stratum counts, report PPV and NPV only and state that sensitivity and specificity are not estimable from this design.

For directly estimated proportions, use the Wilson score interval (better small-sample behavior than Wald); weighted sensitivity and specificity use a logit-scale delta-method interval (`references/sampling-strategies.md`):

```
p = TP / (TP + FP)
n = TP + FP
z = 1.96
center = (p + z^2 / (2*n)) / (1 + z^2 / n)
half_width = z * sqrt(p*(1-p)/n + z^2 / (4*n^2)) / (1 + z^2/n)
ci = (center - half_width, center + half_width)
```

### Step 4: Per-subgroup validation

Repeat all metrics by subgroup (sex, age band, race, site) when subgroup data is in the chart-review file. Phenotype performance can differ by subgroup; do not assert a published subgroup pattern (for example a lower PPV in one age band) without a source read and cited by PMID per Evidence access.

### Step 5: Sample-size-aware reporting

If chart-review N is too small for stable estimates (cutoffs below are project defaults, not literature values):
- N < 50 in any cell → report estimate but mark "wide CI; consider expanding chart review"
- N < 30 in any subgroup → warn and either pool or omit
- Below the disclosure floor (default n<11) in any reported cell or subgroup → suppress or merge before the statistical caveats even apply; see "PHI and disclosure rules"

### Step 6: Write the report

`reports/phenotype-validation/<phenotype>-<date>.md`:

```
# Phenotype validation: T2DM

## Algorithm
"2+ ICD-10 E11.x within 12 months OR HbA1c >= 6.5% OR T2DM-specific medication"
Source: analysis/cohort/concept-sets/T2DM.yaml (vocab v2024-Q1)

## Chart review
N = 200 (100 algo-positive, 100 algo-negative)
Cohort: 2,000 algo-positive, 8,000 algo-negative (P(algo+) = 0.20)
Adjudicators: 2 (with consensus); inter-adjudicator kappa = 0.91
Sampling: stratified random within algo strata

## Performance overall

| Metric | Estimate | 95% CI |
| PPV | 0.94 | (0.88, 0.97) Wilson |
| NPV | 0.85 | (0.77, 0.91) Wilson |
| Sens (weighted) | 0.61 | (0.49, 0.71) logit delta method |
| Spec (weighted) | 0.98 | (0.96, 0.99) logit delta method |

Unweighted cells would give Sens 0.86 and Spec 0.93: verification bias from sampling the
algo-positive stratum at 5% and the algo-negative stratum at 1.25%.

## Performance by subgroup

| Subgroup | N | PPV | NPV | Sens (weighted) |
| Female | 105 | 0.95 | 0.86 | 0.64 |
| Male | 95 | 0.93 | 0.84 | 0.58 |

## Implications for the study

PPV >= 0.90 (project threshold; an assumption unless a cited benchmark replaces it) → false-positive misclassification judged small for this use.
Weighted sensitivity is 0.61: about 4 in 10 true cases in the cohort are missed; expect under-ascertainment of the outcome.
```

The numbers in this example are illustrative, not benchmarks; a comparison with a published PPV or sensitivity cites its PMID and evidence label.

Save `reports/phenotype-validation/<phenotype>-<date>.csv` for the cell counts and confusion matrix — suppressed aggregates only, per "PHI and disclosure rules" (no `subject_id`s, no cells below the disclosure floor).

The bundled script computes Steps 2-5 from one merged CSV (`subject_id`, `chart_label`, `algo_label`, optional `sex`/`age_band`/`race`/`site`), so write the Step 1 merge to a gitignored path first:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/validate_phenotype.py" <phenotype> <merged-csv> --out reports/phenotype-validation/<phenotype>-<date>.md --design algo-stratified --n-algo-pos-pop <cohort algo+ count> --n-algo-neg-pop <cohort algo- count>
```

Use `--design srs` for a simple random sample of the cohort (no stratum counts). Without stratum counts under the default `algo-stratified` design, the script reports sensitivity and specificity as not estimable. Set `--disclosure-floor` to the project floor (default 11). It writes the Markdown report, the suppressed aggregate CSV, and a `.yaml` validation block beside it, applying the disclosure floor to all three: if any 2x2 cell is from 1 to floor-1, all four cells read `suppressed` and n and every metric and CI are withheld, because n with PPV/NPV/Se/Sp recovers the small cell. Zero cells are publishable. A subgroup axis (missing values count as a group) is dropped whole if any group is below the floor or has a small cell. The stdout signal keeps the aggregate metrics and adds `suppressed=yes|no`; do not copy them into shared outputs when `suppressed=yes`.

### Step 7: Update the concept set provenance

Add to `analysis/cohort/concept-sets/<phenotype>.yaml`:

```yaml
validation:
  against: <chart-review file>
  date: <ISO>
  sampling_design: algo-stratified
  sens_spec_method: "inverse-sampling-fraction weighted (Begg & Greenes 1983), logit delta-method CI"
  ppv: 0.94
  ppv_ci: [0.88, 0.97]
  npv: 0.85
  npv_ci: [0.77, 0.91]
  sens: 0.61
  sens_ci: [0.49, 0.71]
  spec: 0.98
  spec_ci: [0.96, 0.99]
  by_subgroup:
    sex: ...
    age_band: ...
```

### Step 8: Emit signal

The bundled script (`scripts/validate_phenotype.py`) prints the canonical envelope:

```
__CE_PHENOTYPE_VALIDATE__ name=<phenotype-name> n=<n> design=<algo-stratified|srs> suppressed=<yes|no> ppv=<v> npv=<v> sens=<v|NA> spec=<v|NA> report=<path-to-report.md> csv=<path-to-suppressed.csv> yaml=<path-to-validation.yaml>
```

Surface this line so `method-plan` SAP mode and the concept-set provenance YAML pick the validation up. `sens=NA` means sensitivity was not estimable from the design; never substitute the raw-cell value.

## What this skill does NOT do

- Does not adjudicate the chart review (that's a human task; this skill assumes the gold-standard labels are given)
- Does not correct sensitivity/specificity for algo-stratified sampling unless the cohort stratum counts are supplied; without them it reports PPV and NPV only
- Does not make the phenotype better -- only measures it
- Does not handle continuous-outcome phenotypes (e.g., HbA1c-as-continuous); restricted to binary phenotype labels

## References

@./references/wilson-ci.md

@./references/sampling-strategies.md
