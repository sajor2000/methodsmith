# ML Prediction Training Protocol

Apply after `model-routing.md` fixes the prediction aim and the model family is chosen. This file covers the Python supervised-training loop for risk models: validation design, fold structure, sample size and stability, metrics, imbalance, tuning, candidate learners, device strategy, calibration, thresholds, uncertainty, explainability, and reporting. Route experiment logging to `method-ml-track`, iterative metric optimization loops to `method-optimize`, figure production to `method-figure`, and final documentation to `method-model-card`. Nothing here licenses package installation or touching a locked test set.

## Contents

- Run order
- Validation design
- Resampling: fold count and structure
- Sample size and model stability
- Performance measures at low prevalence
- Class imbalance
- Hyperparameter tuning
- Candidate learners
- Local device strategy
- Calibration
- Decision thresholds and clinical utility
- Uncertainty, fairness, and missing data
- Explainability and figures
- Reporting
- Scaffold skeleton
- Completion gates
- Evidence seeds

## Run order

1. Check sample size and lock the validation design.
2. Fix the fold structure by independent unit (patient, and site or period when present).
3. Fix the performance measures from intended use, not from prevalence alone.
4. Fit the prespecified penalized logistic baseline.
5. Tune each candidate inside resampling on a proper scoring rule.
6. Fit the final model; assess calibration, then discrimination, clinical utility, and stability.
7. Produce explainability artifacts on a declared split.
8. Score the locked test set exactly once, or report the resampling-corrected estimate.

A memo that skips the sample-size check, the validation design, or the measure decision is `provisional` at best.

## Validation design

State one design in the memo before any fitting:

| Design | When | Estimate |
|---|---|---|
| Bootstrap optimism correction of the whole pipeline | Single-source data; default for small or moderate event counts | Optimism-corrected calibration and discrimination |
| Nested CV (tuning inner, performance outer) | Heavy tuning; no spare events | Outer-fold estimate of the whole procedure |
| Internal-external CV (leave one site or period out) | Data from several sites, regions, or calendar periods | Per-cluster performance, pooled, with between-cluster heterogeneity |
| Locked held-out test set | Large data where one split leaves enough events for a stable estimate | One test score after model lock |

- A random split-sample test set wastes events and gives an unstable estimate in small or moderate data; prefer resampling there and develop on all data (Collins et al., BMJ 2024, PMID 38191193).
- With clustered data (sites, hospitals, practices, periods), use internal-external CV to examine generalizability and heterogeneity across clusters; report pooled performance and its spread, not only an average (Takada et al. 2021, PMID 33836256; de Jong et al. 2021, PMID 33948970). Leave-one-site-out also exposes site-specific calibration drift that random folds hide.
- When a held-out set exists: split once by the independent unit, stratify on outcome, lock it, record when it was unlocked, and score it only after the final model is locked (REFORMS, PMID 38691601; TRIPOD+AI, PMID 38626948).
- Tuning, thresholding, calibration, and model selection belong to development data.
- Record the number of configurations evaluated. The best CV score is optimistic by selection; the reported estimate comes from nested CV, internal-external CV, the locked test set, or bootstrap correction, never from the tuning leaderboard.
- An "internal only" study states that external validation is still required and, when planning it, sizes it with the Riley external-validation criteria (PMID 38253388).

## Resampling: fold count and structure

| Situation | Choice |
|---|---|
| Default development and tuning | 5-fold CV, outcome-stratified |
| Small sample, final internal estimate | Repeated CV (for example 5x5) or bootstrap |
| Multiple rows per patient | `StratifiedGroupKFold` on patient |
| Several sites or periods | `LeaveOneGroupOut` on site or period for the outer loop |
| Any model comparison | Identical fold assignments across every candidate |

- Fit every learning step inside the folds through a `Pipeline`: imputation, scaling, encoding, spline bases, and feature selection all leak when fitted before the split (Kapoor & Narayanan, Patterns 2023, PMID 37720327).
- Report fold-level metrics plus the pooled estimate, with an interval.

## Sample size and model stability

- Gate development on the Riley criteria (BMJ 2020, PMID 32188600; `pmsampsize`), not events-per-variable rules (van Smeden, PMID 29966490). Treat the regression-based minimum as a floor for flexible learners, not a target: most ML prediction studies do not even meet it (Tsegaye et al. 2025, PMID 39814217), and too-small samples damage training, evaluation, and calibration of AI models (Riley et al., Lancet Digit Health 2025, PMID 40461350).
- When individual-level precision or fairness matters, also check the precision of individual risk estimates (Riley et al. 2025, PMID 40624575; `pmstabilityss`).
- Count events, not rows. The event count bounds model complexity, tuning budget, and subgroup analyses.
- Assess instability for every final model: repeat the entire model-building procedure in at least 200 (preferably 1000) bootstrap samples and report the prediction instability plot, the mean absolute prediction error, and calibration and decision-curve instability plots (Riley & Collins, Biom J 2023, PMID 37466257). Large instability is a reason to simplify or penalize, not a footnote.

## Performance measures at low prevalence

Choose measures by what they reward, not by habit. Report these as the essential set for any binary risk model (Van Calster et al., Lancet Digit Health 2025, PMID 41391983):

| Domain | Report | Notes |
|---|---|---|
| Calibration | Flexible calibration curve, calibration-in-the-large, calibration slope | Calibration first: a well-ranked but miscalibrated risk misleads decisions |
| Discrimination | AUROC (c-statistic) with interval | Prevalence-independent ranking measure |
| Clinical utility | Net benefit with decision curve over a prespecified threshold range | The decision-analytic measure; compare with treat-all and treat-none |
| Overall | Brier score or log loss; plot of predicted risk distributions by outcome | Proper scoring rules |

- AUPRC (average precision) is a supplementary, prevalence-dependent measure. Report it beside the outcome prevalence (its no-skill baseline) when screening workload or PPV matters, and never compare AUPRC across datasets or subgroups with different prevalence. AUPRC is not a better model-comparison measure than AUROC under class imbalance and can favour improvements in higher-prevalence subgroups (McDermott et al., NeurIPS 2024, arXiv 2401.06091). The PR curve remains useful to show precision at operating points (Saito & Rehmsmeier 2015, PMID 25738806).
- Do not use F1, accuracy, or threshold-dependent classification measures as primary measures: they are improper at clinically relevant thresholds (PMID 41391983). Report sensitivity, specificity, PPV, and NPV only at prespecified, clinically justified thresholds.
- Name the computation of every curve-based measure: `average_precision_score` and trapezoidal `auc(recall, precision)` differ.
- Compare every candidate against a prespecified penalized logistic baseline with splines under identical resampling; on tabular clinical data, flexible learners often do not beat it (Christodoulou 2019, PMID 30763612). Report the comparison either way.

## Class imbalance

- Do not correct class imbalance for a risk model. Random undersampling, oversampling, and SMOTE produce strongly overestimated risks without improving AUROC, and a threshold shift achieves the same sensitivity-specificity trade-off (van den Goorbergh et al., JAMIA 2022, PMID 35686364). Class weights (`class_weight="balanced"`, `scale_pos_weight`, `is_unbalance`) reweight the effective prevalence in the same way; leave them at their neutral defaults.
- If a correction is used anyway (for example a pretrained pipeline requires it), state why, recalibrate to the natural prevalence on development data, and report both (TRIPOD+AI item 13).
- Handle the low prevalence through the measures, the decision threshold, and enough events, not by reshaping the data.

## Hyperparameter tuning

| Tool | Use when | Notes |
|---|---|---|
| Optuna (TPE) | Default on one machine | Seed the sampler (`TPESampler(seed=...)`), prune per fold with `MedianPruner`, log scales for rates and penalties |
| Random search | Cheap first pass | Strong baseline, no space assumptions |
| Grid search | At most 2-3 low-cardinality parameters | Penalized logistic `C` grid |
| Ray Tune | Multi-node clusters | Unnecessary on one workstation |

- Tune on a proper scoring rule: inner-fold log loss (`neg_log_loss`) or Brier score (`neg_brier_score`). These reward calibrated probabilities; AUROC and AUPRC ignore calibration and can select overconfident models.
- Declare the search space and budget (trials or wall-clock) before the first run; record every trial and the winner to the tracker.
- Keep the space small (about 6-8 hyperparameters) when events are few.
- Tune GBDT learning rate together with the number of trees via early stopping on an inner fold of the training split, never on the outer fold.
- Fix the seeds of sampler, model, and fold assignment; hold fold assignment fixed across candidates.

## Candidate learners

| Learner | Role | Constraints |
|---|---|---|
| Penalized logistic regression with restricted cubic splines | Mandatory baseline; often the final model | Ridge or elastic net; transparent; strong calibration |
| Gradient-boosted trees (LightGBM, XGBoost, CatBoost) | Default flexible candidate for tabular data | Native missing-value handling; tune on log loss; check calibration |
| Tabular foundation models (TabPFN family) | Optional candidate for small tabular data | See below |
| Random forest | Rarely preferred | Check calibration closely; tune on log loss like any other candidate |
| Deep tabular networks | Only with large data and a stated reason | Higher variance and tuning cost |

Tabular foundation models are the main 2025-2026 change in tabular prediction. TabPFN v2 is a pretrained transformer that predicts in context without per-dataset tuning and outperformed tuned baselines on datasets up to 10,000 samples (Hollmann et al., Nature 2025, PMID 39780007); the TabArena living benchmark (NeurIPS 2025 Datasets and Benchmarks, arXiv 2506.16791) tracks tuned GBDTs, deep tabular models, and foundation models under one protocol. Use one only when all of these hold:

- the package and weights are already installed and approved; never install them from this skill;
- the weight licence fits the use: TabPFN-2.5 and later weights carry non-commercial licences, so commercial or deployed use needs explicit licence clearance;
- the data are within the model's documented size and feature limits for the installed version;
- it runs under the same folds, the same proper-scoring comparison, and the same calibration, stability, and decision-curve checks as every other candidate; benchmark wins do not exempt it;
- explanations use model-agnostic methods (permutation importance, partial dependence, model-agnostic SHAP), since `TreeExplainer` does not apply.

## Local device strategy

- Establish the CPU baseline first: `n_jobs=-1` (or `num_threads` at physical core count) and a timed baseline fit. Move to GPU only when fitting time limits the tuning budget or stability bootstrap.

| Stack | Device path | Constraint |
|---|---|---|
| scikit-learn | CPU (`n_jobs`) | GPU only through the cuML accelerator where supported |
| LightGBM | `device_type="cuda"` | Needs a CUDA-enabled build; the stock PyPI wheel is CPU-only. CUDA build is a user-authorized step, never run by this skill: `pip install lightgbm --no-binary lightgbm --config-settings=cmake.define.USE_CUDA=ON` |
| XGBoost 2.0 or later | `tree_method="hist"`, `device="cuda"` | `gpu_hist` is deprecated; set the ordinal with `device="cuda:0"` |
| cuML accelerator | `python -m cuml.accel.install` or `cuml.accel.install()` before importing sklearn | Supported estimators only; others fall back to CPU |
| TabPFN family | GPU recommended by the package | Check the installed version's CPU limits before planning a CPU run |

- With a few thousand rows, CPU GBDT on many cores is usually fast enough; the bootstrap stability analysis, not a single fit, is what usually justifies a GPU.
- Apple-silicon machines have no CUDA. Claim GPU speedups only where a CUDA or ROCm device and the matching build exist.
- Verify the device engaged and that a device switch does not move the metric on one fold; record device, library versions, and wheel build in the run log. GPU tree construction is not always bit-reproducible.

## Calibration

- Assess for every binary risk model: a flexible calibration curve (loess or spline, with risk distribution shown), calibration-in-the-large (intercept with the linear predictor as offset), calibration slope, and Brier score. Discrimination never certifies calibration (Van Calster 2019, PMID 31842878). A Hosmer-Lemeshow p-value carries no weight.
- Recalibrate only when development assessment shows miscalibration. Methods:

| Method | When |
|---|---|
| Logistic recalibration (intercept and slope) | Default for binary risk; few events |
| Sigmoid (Platt) via `CalibratedClassifierCV(method="sigmoid")` | Same idea inside scikit-learn |
| Isotonic | Many events (hundreds per fold or more); overfits with few |
| Temperature scaling, `method="temperature"` (scikit-learn 1.8 or later) | Mainly multiclass; a single scale parameter without an intercept, so it cannot fix calibration-in-the-large |
| `CalibratedClassifierCV(FrozenEstimator(model))` (scikit-learn 1.6 or later) | Calibrating one locked model on disjoint development data; `cv="prefit"` is deprecated |

- Fit calibration on out-of-fold development predictions or a disjoint development split; the locked test set scores the calibrated model once. Report discrimination after calibration.
- When deployment prevalence or case mix differs, update the intercept (and slope if needed) before considering refitting (Steyerberg 2004, PMID 15287085; Janssen 2007, PMID 18083464).

## Decision thresholds and clinical utility

- Fix the threshold range for decision curves from clinical consequences before seeing results: the threshold probability encodes the harm-to-benefit ratio of acting (Vickers et al., Diagn Progn Res 2019, PMID 31592444).
- A model is useful only where its net benefit exceeds treat-all and treat-none across reasonable thresholds; show the decision curve with its instability across bootstrap models.
- If an alert threshold is needed, choose it on development data from the decision curve or a prespecified cost scorer (`TunedThresholdClassifierCV`, scikit-learn 1.5 or later, with grouped CV). The threshold is a deployment choice; the reported risk stays the calibrated probability.

## Uncertainty, fairness, and missing data

- Report intervals for every measure (bootstrap respecting the independent unit). Individual-level uncertainty comes from the stability bootstrap; conformal prediction (MAPIE 1.0 or later, whose API changed from 0.x; verify against the installed version) is optional for prediction sets and needs exchangeability between calibration and deployment data.
- Report calibration and discrimination by prespecified subgroups (sex, age band, race and ethnicity where recorded and appropriate, site) with intervals; flag subgroups too small to estimate (Collins et al., BMJ 2024, PMID 38191193).
- Choose the missing-data strategy for deployment, not only for development: the same handling must be available when the model runs. Regression imputation without the outcome, or native GBDT missing handling, plus missing indicators when missingness is informative and stable, are reasonable; multiple imputation with the outcome cannot be applied at deployment (Sisk et al. 2023, PMID 37105540; Sperrin et al. 2020, PMID 32540389). Fit imputation inside the folds.

## Explainability and figures

- Compute on a declared split and label every figure with model version and split: out-of-fold development predictions during development; the locked test set when one exists. Report which explanations were produced and on which data (TRIPOD+AI, PMID 38626948).
- Global importance: permutation importance with repeats and intervals on out-of-fold or test data, scored with a proper rule (log loss or Brier) as well as AUROC. Correlated predictors share and dilute importance; group them or permute them together. GBDT gain importance is descriptive only.
- SHAP for tree models: `TreeExplainer` with an interventional background sample; beeswarm for the overview, mean |SHAP| bar plot for ranking, dependence plots for shape, waterfall for one prediction. State the scale (log-odds or probability). SHAP describes the model, not causal effects. Keep SHAP arrays in restricted storage; they are patient-adjacent (`method-ml-track` rules).
- Partial dependence: `PartialDependenceDisplay.from_estimator` on the fitted pipeline with ICE curves and a rug or density of the data. With correlated features, PDPs extrapolate into unsupported regions; use accumulated local effects and name the dependency.
- Route production and styling to `method-figure`: vector output or at least 300 dpi, colorblind-safe palettes, at least 8 pt fonts at final size, captions naming model, split, measure computation, and n.

## Reporting

- Report against TRIPOD+AI (PMID 38626948) and check risk of bias and applicability against PROBAST+AI (PMID 40127903). Use TRIPOD-LLM (PMID 39779929) when a large language model produces or consumes predictions.

## Scaffold skeleton

Illustrative; every name and value comes from the project contract:

```python
from pathlib import Path
import pandas as pd
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline
from lightgbm import LGBMClassifier

REQUIRED_COLUMNS = [...]  # approved predictors named in the memo
OUTCOME = "..."           # approved binary outcome column
RANDOM_SEED = 20260926
SCORING = {
    "log_loss": "neg_log_loss",      # tuning objective (proper scoring rule)
    "brier": "neg_brier_score",
    "auroc": "roc_auc",
    "average_precision": "average_precision",  # supplementary; report with prevalence
}

def load_development(path: Path) -> pd.DataFrame:
    frame = pd.read_parquet(path)
    missing = [c for c in [*REQUIRED_COLUMNS, OUTCOME] if c not in frame.columns]
    if missing:
        raise ValueError(f"missing required columns: {missing}")
    return frame

def make_model() -> Pipeline:
    return Pipeline([
        # imputation, encoding, and splines fit inside the folds only
        ("clf", LGBMClassifier(
            objective="binary",
            random_state=RANDOM_SEED,
            n_jobs=-1,  # CPU build; device_type="cuda" needs a CUDA-built wheel
            # no class_weight / scale_pos_weight: imbalance correction miscalibrates risk
        )),
    ])

def evaluate(dev_path: Path) -> dict:
    frame = load_development(dev_path)
    folds = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)
    return cross_validate(
        make_model(), frame[REQUIRED_COLUMNS], frame[OUTCOME],
        cv=folds, scoring=SCORING, return_estimator=False,
    )
```

Tuning, calibration, decision curves, stability bootstrap, and explanations wrap this skeleton per the sections above; the memo states which split each number came from.

## Completion gates

The protocol is complete when: the Riley sample-size check is reported; the validation design is named and locked, with internal-external CV when sites or periods exist; folds are grouped by the independent unit and stratified; no imbalance correction is applied (or it is justified and recalibrated); the penalized baseline is fit; tuning uses a proper scoring rule with declared space, budget, and seeds; the device is chosen and verified; calibration is assessed with a named method; AUROC, calibration, net benefit, and risk distributions are reported, with AUPRC beside prevalence when used; instability is assessed by bootstrap; subgroup performance is reported; explanations exist on a declared split with figures routed to `method-figure`; and the locked test set, if any, was scored exactly once.

## Evidence seeds

Seed identifiers for `method-evidence-map`; verify each before citing and label at the level read.

| Decision | Identifier |
|---|---|
| Essential performance measures; improper classification measures | PMID 41391983 |
| AUPRC not superior to AUROC under imbalance | NeurIPS 2024, arXiv 2401.06091 |
| PR curves under imbalance | PMID 25738806 |
| Imbalance correction miscalibrates risk | PMID 35686364 |
| Minimum sample size; AI sample size; individual precision | PMIDs 32188600, 39814217, 40461350, 40624575 |
| Model instability by bootstrap | PMID 37466257 |
| Internal, internal-external, external validation | PMIDs 38191193, 33836256, 33948970 |
| External validation sample size | PMID 38253388 |
| Calibration | PMID 31842878 |
| Decision curve analysis | PMID 31592444 |
| Missing data for prediction and deployment | PMIDs 37105540, 32540389 |
| ML versus logistic regression | PMID 30763612 |
| Tabular foundation model | PMID 39780007; TabArena arXiv 2506.16791 |
| Reporting and risk of bias | PMIDs 38626948, 40127903, 39779929 |
| Leakage | PMIDs 37720327, 38691601 |
