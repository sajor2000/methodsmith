---
name: method-model-card
description: "Generates a clinical model card: intended use, data, performance with intervals, calibration, fairness, limits. Use when the user asks for a model card."
argument-hint: "<model artifact path>, optional: --eval-output path/to/eval-results.json"
---

# Model Card Generator


## Skill Value

- **Problem it solves:** Models can ship without clear intended use, validation scope, subgroup behavior, or clinical limitations.
- **Use when:** The user asks for a model card, prediction model documentation, AI reporting artifact, or validation summary.
- **Output:** A model card with intended use, data provenance, metrics, calibration, fairness, risks, and limitations.
- **Ask only if:** Only when intended use, population, model type, or validation evidence is missing.
- **Do not do:** Do not fabricate performance metrics or approval claims.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Generates a model card in the model-card framework introduced by Mitchell and colleagues (a computer-science conference paper outside PubMed; locate it through Paperclip or the publisher before citing it), adapted for clinical/biomedical use, and supports TRIPOD+AI (PMID 38626948) reporting of performance, fairness, and model availability. Look up the exact reporting-item numbers and any regulatory expectation per Evidence access rather than asserting them.

## When this skill activates

- After model evaluation is done (overall + subgroup performance computed)
- Before manuscript submission for prediction-model studies
- After `method-review` flagged absent model card during TRIPOD+AI compliance check
- Manual: `method-model-card models/risk-model.pkl --eval-output reports/eval-2025-04.json`

## Prerequisites

- A trained model artifact (any format: pickle, joblib, .rds, .keras, .pt, ONNX)
- Evaluation results: overall metrics + per-subgroup metrics (sex, race, age, site at minimum)
- Calibration plot data (prob-binned or smoothed)
- Training data summary (N, dates, source, features list)

## Evidence access

When this run needs literature, read `references/evidence-access.md` first; never invent a citation, effect size, or guideline item.

- **Look up here:** fairness-metric definitions (demographic parity, equalized odds, calibration by group) and the reporting items the card must satisfy (TRIPOD+AI, PMID 38626948, DOI 10.1136/bmj-2023-078378; model-card and model-reporting literature), cited by PMID or DOI with an evidence label; literature never supplies, adjusts, or recomputes a performance metric, and every number in the card comes from the eval output.

## Core workflow

### Step 1: Read the model + eval output

Parse the eval-output JSON. Expected schema:

```json
{
  "model_id": "risk-model-v2",
  "training": {
    "n": 12500, "dates": "2018-01 to 2022-12",
    "source": "EHR site A", "features": ["age", "sex", "creatinine"]
  },
  "evaluation": {
    "internal": {
      "validation_type": "bootstrap optimism-corrected",
      "n": 12500, "n_events": 1310, "prevalence": 0.105,
      "auc": 0.84, "auc_ci": [0.82, 0.86],
      "brier": 0.08, "brier_ci": [0.07, 0.09],
      "calibration_intercept": -0.02, "calibration_intercept_ci": [-0.08, 0.04],
      "calibration_slope": 0.96, "calibration_slope_ci": [0.89, 1.03],
      "threshold": 0.20,
      "sens": 0.71, "sens_ci": [0.68, 0.73], "spec": 0.84, "spec_ci": [0.83, 0.85],
      "ppv": 0.35, "ppv_ci": [0.33, 0.37], "npv": 0.96, "npv_ci": [0.95, 0.96]
    },
    "external": { "cohort": "site B", "n": 5500, "n_events": 610, "auc": 0.79, "auc_ci": [0.77, 0.81],
                  "calibration_intercept": 0.15, "calibration_intercept_ci": [0.06, 0.24],
                  "calibration_slope": 0.88, "calibration_slope_ci": [0.79, 0.97] },
    "subgroups": {
      "sex_F": { "n": 7100, "n_events": 700, "auc": 0.85, "auc_ci": [0.83, 0.87], "calibration_intercept": -0.04,
                 "calibration_slope": 0.98, "tpr": 0.72, "fpr": 0.15 },
      "sex_M": { "n": 5400, "n_events": 610, "auc": 0.83, "auc_ci": [0.81, 0.85], "calibration_intercept": 0.01,
                 "calibration_slope": 0.94, "tpr": 0.69, "fpr": 0.17 },
      ...
    }
  }
}
```

This schema is the superset of the evaluation keys the template uses (illustrative values); model, intended-use, and population fields come from the user or model metadata. Required: `validation_type` (apparent, bootstrap optimism-corrected, held-out split, or internal-external; TRIPOD+AI item 12c), `n`, `n_events` (item 21), and a 95% CI for every reported performance estimate (item 23a), plus `tpr` and `fpr` per subgroup at the deployment threshold for the fairness gaps. Required training metadata: `training.imbalance_correction` (TRIPOD+AI item 13) -- state the method when the training records establish one; report the gap in section 9 when they do not, and never render `none` by default. Optional keys, rendered only when present: `log_loss`, `auprc` (always shown beside `prevalence`), `risk_distribution_fig` (the essential risk-distribution figure; state the gap in section 9 when absent, PMID 41391983), `stability` (`n_bootstrap`, `mape`, `fig_id`), and `model.weights_license` (required when the model uses pretrained or foundation-model weights). When `stability` is absent, state in section 9 that no instability analysis was done. If the eval output is missing required fields, surface the gap and refuse to generate a card with placeholders.

### Step 2: Fill the template

Use `references/model-card-template.md`. Sections:

1. **Model details** -- name, version, date, type, owner
2. **Intended use** -- primary intended use, primary intended users, out-of-scope use cases
3. **Factors** -- relevant subgroups, evaluation factors
4. **Metrics** -- model performance overall and by subgroup (table)
5. **Evaluation data** -- datasets, motivation, preprocessing
6. **Training data** -- as above for training
7. **Quantitative analyses** -- unitary and intersectional results
8. **Ethical considerations** -- subjects, mitigations, risks
9. **Caveats and recommendations** -- known limitations, recalibration plan, monitoring plan

Lock the metrics to the number registry: in the evaluation script, register each reported metric with `register_number` from the `method-numbers` helpers (`kind="estimate"` with `ci=` for AUC and calibration, `kind="count"` for events, the evaluation output file as `sources`, and its SAP output as `sap_output`), write every numeric cell of the card source as `{{num:<id>}}`, and produce `analysis/model-card.md` with the `method-numbers` `render` command.

### Step 3: Build the fairness summary table

For each protected attribute in the eval output, report (derive gaps and ratios only from reported values; never rerun the evaluation or recompute from predictions, and treat a missing metric as a Step 1 gap):

- AUC per group + 95% CI
- Calibration intercept + slope per group
- Sensitivity and specificity at the deployment threshold per group
- Demographic parity ratio (selection rate group_A / group_B)
- Equal-opportunity gap (max TPR difference across groups) and equalized-odds gap (max of the TPR difference and the FPR difference across groups, as in `fairlearn.metrics.equalized_odds_difference`)

Highlight any AUC gap > 0.05 or calibration intercept |Δ| > 0.10 in the card body, not just in a footnote. These flags are project defaults, not literature thresholds; if the card claims a benchmark, cite it per Evidence access.

### Step 4: Write outputs

- `analysis/model-card.md` -- the markdown card
- `analysis/model-card.html` -- rendered (for sharing)
- `analysis/model-card.json` -- structured form for deployment registries

Completion check: every numeric cell in the card traces to a key in the eval JSON, no template placeholder (`{{ ... }}`) remains in the rendered card, and the `method-numbers` `check` on it prints `PASS`; if any fails, fix the input or the fill and regenerate before writing outputs.

### Step 5: Cross-link

Write a one-line reference at the bottom of the SAP and the manuscript Methods section:

> "Model card available at `analysis/model-card.md`."

## What this skill does NOT do

- Does not run the evaluation (you bring eval results)
- Does not fix unfair models -- it surfaces gaps; mitigation is a separate decision (see `method-fairness-reviewer`)
- Does not validate calibration -- that's `method-calibration-reviewer`
- Does not handle pre-deployment monitoring -- see `method-concept-drift-reviewer` and ML lifecycle tools

## References

@./references/model-card-template.md
