# Model Card: {{ model.id }}

## Contents

- 1. Model details
- 2. Intended use
- 3. Factors
- 4. Metrics
- 5. Evaluation data
- 6. Training data
- 7. Quantitative analyses
- 8. Ethical considerations
- 9. Caveats and recommendations

## 1. Model details

| Field | Value |
|-------|-------|
| Model name | {{ model.id }} |
| Version | {{ model.version }} |
| Date | {{ model.date }} |
| Model type | {{ model.type }} (e.g., logistic regression, gradient-boosted trees, transformer) |
| Architecture | {{ model.architecture }} |
| Owner / Contact | {{ model.owner }} |
| License | {{ model.license | default("CC-BY-4.0 -- model weights subject to data-use agreement") }} |
| Pretrained weights licence | {{ model.weights_license }} (pretrained or foundation-model components only, e.g. TabPFN; state whether the licence permits the intended use) |
| Citation | {{ model.citation }} |

## 2. Intended use

### 2.1 Primary intended use

{{ model.intended_use }}

### 2.2 Primary intended users

{{ model.intended_users }}

### 2.3 Out-of-scope uses

- Not for use as the sole decision-making input
- Not validated outside {{ training.population }} -- generalization to {{ ... }} requires re-validation
- Not for use in {{ excluded_populations }} (e.g., pediatric, pregnancy, ICU) without explicit re-evaluation

## 3. Factors

### 3.1 Relevant factors

The model's performance has been evaluated by:
- Sex (F, M, intersex)
- Race / ethnicity ({{ race_categories }})
- Age ({{ age_bands }})
- Site / hospital ({{ site_count }} sites)
- Payer ({{ payer_categories }})

### 3.2 Evaluation factors

Performance is reported overall and stratified by all factors above.

## 4. Metrics

### 4.1 Performance overall ({{ eval.internal.validation_type }}: apparent | bootstrap optimism-corrected | held-out split | internal-external)

N = {{ eval.internal.n }}; events = {{ eval.internal.n_events }} (prevalence {{ eval.internal.prevalence }})

| Metric | Value | 95% CI |
|--------|-------|--------|
| C-statistic (AUC) | {{ eval.internal.auc }} | {{ eval.internal.auc_ci }} |
| Brier score | {{ eval.internal.brier }} | {{ eval.internal.brier_ci }} |
| Calibration intercept (calibration-in-the-large) | {{ eval.internal.calibration_intercept }} | {{ eval.internal.calibration_intercept_ci }} |
| Calibration slope | {{ eval.internal.calibration_slope }} | {{ eval.internal.calibration_slope_ci }} |
| Log loss (when reported) | {{ eval.internal.log_loss }} | {{ eval.internal.log_loss_ci }} |
| AUPRC (when reported; no-skill baseline = prevalence {{ eval.internal.prevalence }}) | {{ eval.internal.auprc }} | {{ eval.internal.auprc_ci }} |
| Sensitivity (at threshold {{ eval.internal.threshold }}) | {{ eval.internal.sens }} | {{ eval.internal.sens_ci }} |
| Specificity (at threshold {{ eval.internal.threshold }}) | {{ eval.internal.spec }} | {{ eval.internal.spec_ci }} |
| PPV | {{ eval.internal.ppv }} | {{ eval.internal.ppv_ci }} |
| NPV | {{ eval.internal.npv }} | {{ eval.internal.npv_ci }} |
| Predicted-risk distribution by outcome | Figure {{ eval.internal.risk_distribution_fig }} | -- |

### 4.2 Performance by subgroup

| Subgroup | N | Events | AUC | AUC 95% CI | Calibration intercept | Calibration slope | TPR | FPR |
|----------|---|--------|-----|------------|------------------------|-------------------|-----|-----|
| Sex = F | ... | ... | ... | ... | ... | ... | ... | ... |
| Sex = M | ... | ... | ... | ... | ... | ... | ... | ... |
| Age 18-44 | ... | ... | ... | ... | ... | ... | ... | ... |
| Age 45-64 | ... | ... | ... | ... | ... | ... | ... | ... |
| Age 65+ | ... | ... | ... | ... | ... | ... | ... | ... |
| Race = ... | ... | ... | ... | ... | ... | ... | ... | ... |
| Site = A | ... | ... | ... | ... | ... | ... | ... | ... |

### 4.3 External validation

N = {{ eval.external.n }}; events = {{ eval.external.n_events }}; cohort = {{ eval.external.cohort }}

| Metric | Value | 95% CI |
|--------|-------|--------|
| C-statistic (AUC) | {{ eval.external.auc }} | {{ eval.external.auc_ci }} |
| Calibration intercept (calibration-in-the-large) | {{ eval.external.calibration_intercept }} | {{ eval.external.calibration_intercept_ci }} |
| Calibration slope | {{ eval.external.calibration_slope }} | {{ eval.external.calibration_slope_ci }} |
| ... | ... | ... |

### 4.4 Decision-curve analysis

Net benefit at thresholds {{ thresholds }} compared with treat-all and treat-none -- see Figure {{ fig_id }}. The threshold range was fixed from clinical consequences before results were seen.

AUROC, the calibration plot, net benefit, and the distribution of predicted risks by outcome are the essential measures (Van Calster et al., Lancet Digit Health 2025, PMID 41391983). AUPRC, when shown, is supplementary and is not compared across groups with different prevalence.

### 4.5 Model stability

Instability from {{ eval.stability.n_bootstrap }} bootstrap refits of the full model-building procedure: mean absolute prediction error {{ eval.stability.mape }}; see the prediction, calibration, and decision-curve instability plots in Figure {{ eval.stability.fig_id }} (Riley & Collins, Biom J 2023, PMID 37466257). Omit this section only when the evaluation did not include a stability analysis, and say so in section 9.

## 5. Evaluation data

| Field | Value |
|-------|-------|
| Datasets | {{ eval.datasets }} |
| Motivation | {{ eval.motivation }} |
| Preprocessing | {{ eval.preprocessing }} |
| Time period | {{ eval.dates }} |
| Inclusion criteria | {{ eval.inclusion }} |
| Exclusion criteria | {{ eval.exclusion }} |

## 6. Training data

| Field | Value |
|-------|-------|
| Datasets | {{ training.source }} |
| N | {{ training.n }} |
| Date range | {{ training.dates }} |
| Features | {{ training.features }} (count: {{ training.feature_count }}) |
| Outcome definition | {{ training.outcome }} |
| Outcome prevalence | {{ training.class_balance }} |
| Imbalance correction | {{ training.imbalance_correction }} (if any was used: method, rationale, and recalibration to the natural prevalence; TRIPOD+AI item 13). When the training records do not establish this, report the gap in section 9 -- never render "none" by default |
| Train / val / test split | {{ training.split }} -- {{ training.split_strategy }} (group / temporal / random) |

## 7. Quantitative analyses

### 7.1 Unitary results

See section 4.1.

### 7.2 Intersectional results

| Subgroup intersection | N | AUC | Calibration |
|-----------------------|---|-----|-------------|
| Sex=F × Age 65+ × Race=Black | ... | ... | ... |
| Sex=M × Age 18-44 × Race=White | ... | ... | ... |

(Report at minimum the smallest-N intersection if N >= 30, a project default rather than a literature cutoff; otherwise note insufficient data.)

## 8. Ethical considerations

### 8.1 Sensitive population
{{ ethical.sensitive_pop }}

### 8.2 Risks identified
- Algorithmic bias: {{ ethical.bias_risk }}
- Privacy: {{ ethical.privacy_risk }}
- Misuse: {{ ethical.misuse_risk }}

### 8.3 Mitigation steps taken
{{ ethical.mitigations }}

## 9. Caveats and recommendations

- Performance is degraded outside the training population. Re-validation required for new sites.
- Calibration drift is expected over time. Recommended re-calibration cadence: {{ recalib_cadence }}.
- Concept drift monitoring: {{ drift_plan }}.
- Human-in-the-loop required: model is decision SUPPORT, not decision AUTOMATION.
- Re-evaluation triggered by: {{ retrigger_conditions }}.
- Validation status: {{ external_validation_status }}. A model without external or internal-external validation is not ready for deployment decisions.
