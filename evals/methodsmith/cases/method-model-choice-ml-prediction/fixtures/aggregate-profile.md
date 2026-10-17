# Synthetic aggregate design profile

- Request: design the training and validation protocol for the sepsis prediction model (splits and cross-validation, tuning plan, primary metric at this prevalence, calibration, explainability figures) and deliver the strategy memo plus scaffold.
- Aim: develop and internally validate a clinical prediction model for sepsis within 48 hours of ICU admission.
- Estimand: predicted risk per patient at ICU hour 0; intended use is an early-warning screen, evaluated by ranking and by calibrated risk.
- Outcome: binary sepsis-within-48h indicator, adjudicated at hour 48.
- Unit and grain: one row per patient; no repeated rows; site identifier available.
- Usable counts: 4,180 patients, 251 events (6.0% prevalence), 22 candidate predictors measured at or before hour 0.
- Dependence: patients independent within site; 14 sites, median 298 patients per site.
- Missingness: 3% across labs; imputation inside the pipeline is acceptable.
- Intended validation: internal only; no external set exists yet.
- Stack: Python with locked scikit-learn and lightgbm (stock pip wheels, CPU build). Local hardware: Linux workstation, 32 cores, one NVIDIA RTX 4090; no CUDA-built LightGBM wheel is installed.
- Data QA: passed, `__CE_DATA_QA__` status=GO; no unresolved blockers.

## Frozen evidence map

| Decision | Identifier | Verification | Query provenance |
|---|---|---|---|
| PR plot more informative than ROC for imbalanced binary classifiers | PMID 25738806 | abstract | PubMed query `precision recall ROC imbalanced`, 2026-09-26 |
| No systematic ML advantage over logistic regression for clinical prediction models | PMID 30763612 | abstract | PubMed query `machine learning logistic regression clinical prediction`, 2026-09-26 |
| Calibration must be assessed separately from discrimination | PMID 31842878 | abstract | PubMed query `calibration discrimination predictive analytics`, 2026-09-26 |
| Minimum sample size for prediction model development | PMID 32188600 | abstract | PubMed query `sample size clinical prediction model Riley`, 2026-09-26 |
| TRIPOD+AI reporting requirements | PMID 38626948 | abstract | PubMed query `TRIPOD AI reporting prediction models`, 2026-09-26 |
| Essential measures: AUROC, calibration plot, net benefit, risk distributions; classification measures improper | PMID 41391983 | abstract | PubMed query `Van Calster performance evaluation predictive AI models medical decisions guidance`, 2026-10-17 |
| Imbalance correction miscalibrates risk without improving AUROC | PMID 35686364 | abstract | PubMed query `harm of class imbalance corrections risk prediction models`, 2026-10-17 |
| Internal-external cross-validation for clustered data | PMID 33836256 | abstract | PubMed query `internal-external cross-validation prediction model clustered`, 2026-10-17 |
| Bootstrap instability of model predictions | PMID 37466257 | abstract | PubMed query `stability of clinical prediction models instability plots Riley`, 2026-10-17 |
