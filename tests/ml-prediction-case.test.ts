import { afterEach, describe, expect, test } from "bun:test"
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "fs/promises"
import os from "os"
import path from "path"
import {
  loadAndValidateCase,
  scoreEvaluationRun,
  sha256File,
  sha256Target,
} from "../scripts/evals/lib"

const repoRoot = process.cwd()
const casePath = path.join(
  repoRoot,
  "evals",
  "methodsmith",
  "cases",
  "method-model-choice-ml-prediction",
  "case.yaml",
)
const memoRelative = "workspace/analysis/model-strategy/sepsis-48h-model-strategy.md"
const scaffoldRelative = "workspace/analysis/model-strategy/sepsis-48h-model.py"

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

const sampleSizeSection = `## Sample size

The Riley minimum-development-size criteria (PMID 32188600) were computed for
the actual counts: with anticipated Nagelkerke R-squared 0.15, shrinkage
factor 0.90, and 24 encoded parameters, the shrinkage criterion requires
3,826 development patients, below the 4,180 available, so the primary model
is capped at 24 encoded parameters.
`

const designCountsSection = `The frozen aggregate profile supplies 4,180 patients, 251 sepsis-within-48h
events (6.0% prevalence), 22 candidate predictors measured at hour 0, and 14
sites; validation is internal only.
`

const devicePlanSection = `The installed LightGBM wheel is CPU-only and no CUDA-built wheel is
present, so the compute plan stays on the CPU and installs nothing.
`

const compliantMemo = `# Sepsis-48h model strategy and training protocol

Status: ready_for_review. Protocol written before any scaffold execution; no
models were fitted, no packages installed, no network access, and no
performance results exist.

## Design facts from the frozen profile

${designCountsSection}

${devicePlanSection}

${sampleSizeSection}

## Validation and tuning design

Use nested internal-external cross-validation: leave-one-site-out outer folds
(LeaveOneGroupOut over the 14 sites) and site-grouped StratifiedGroupKFold
inner folds. Hyperparameters are tuned inside the resampling: the C grid is
selected by minimum pooled inner-fold log loss, and every outer fold refits
the whole tuning procedure on its training sites only. The outer fold is never
used to tune, select, or recalibrate.

## Performance measures

Primary performance is log loss on pooled out-of-fold predictions. Report
AUROC with site-respecting intervals, Brier score, calibration intercept and
calibration slope with a calibration curve, net benefit with a decision curve
against treat-all and treat-none, and predicted-risk distributions by outcome.
AUPRC is supplementary and reported beside the observed prevalence, never as
a primary metric; tuning stays on the proper scoring rule (log loss).

## Calibration

Assess calibration-in-the-large and slope on held-out sites. Development-only
recalibration uses logistic recalibration (intercept and slope), cross-fit
inside training data; temperature scaling is a one-parameter Platt variant
with no separate intercept, so it cannot by itself correct
calibration-in-the-large.

## Stability

Plan a two-stage site/patient bootstrap instability assessment (at least 200
resamples) reporting the mean absolute deviation of predicted risks across
refitted procedures.

## Explainability figures

After separate authorization: a held-out calibration curve, grouped
permutation importance on each held-out site, partial dependence and ICE
panels for approved continuous predictors, and SHAP beeswarm and bar plots
for the tree comparator only if it is separately authorized.

## Evidence anchors

Performance-measure selection follows the essential-measures guidance,
PMID 41391983 (AUROC, calibration, net benefit, risk distributions; proper
scoring rules for risk models). Tuning inside resampling rather than on outer
data follows the selection-bias result of Varma and Simon, PMID 16504092.
`

const compliantScaffold = `"""Sepsis-48h ridge-logistic scaffold. Review only; nothing runs on import."""

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.model_selection import LeaveOneGroupOut, StratifiedGroupKFold

SEED = 20261017
C_GRID = (0.001, 0.01, 0.1, 1.0, 10.0, 100.0)


def validate_columns(columns):
    """Approved in-memory column contract; matches the frozen profile counts."""
    X = np.column_stack([columns[name] for name in columns["predictors"]])
    y = np.asarray(columns["outcome"], dtype=int)
    groups = np.asarray(columns["site"], dtype=object)
    if X.shape != (4180, 22) or y.shape != (4180,) or len(set(groups)) != 14 or y.sum() != 251:
        raise ValueError("Column contract does not match the frozen aggregate profile.")
    return X, y, groups


def fit_primary(X, y, C):
    return LogisticRegression(
        C=C, penalty="l2", solver="lbfgs", max_iter=5000, random_state=SEED
    ).fit(X, y)


def inner_folds(y, groups):
    """Site-grouped stratified inner folds; both classes required in every fold."""
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED)
    return list(splitter.split(np.zeros((len(y), 1)), y, groups))


def tune(X, y, groups):
    """Select C by minimum pooled inner-fold log loss; development data only."""
    best_C, best_loss = None, np.inf
    for C in C_GRID:
        pooled = np.full(len(y), np.nan)
        for train, valid in inner_folds(y, groups):
            model = fit_primary(X[train], y[train], C)
            pooled[valid] = model.predict_proba(X[valid])[:, 1]
        loss = float(log_loss(y, pooled, labels=[0, 1]))
        if loss < best_loss - 1e-8:
            best_C, best_loss = C, loss
    return best_C


def tune_procedure(X, y, groups):
    """Tune and refit inside whatever development data it is given."""
    C = tune(X, y, groups)
    return fit_primary(X, y, C)


def assess(columns):
    """Nested internal-external validation; authorized execution only."""
    X, y, groups = validate_columns(columns)
    oof = np.full(len(y), np.nan)
    splitter = LeaveOneGroupOut()
    for k, (train, valid) in enumerate(splitter.split(X, y, groups)):
        if set(groups[train]) & set(groups[valid]):
            raise ValueError("Outer site leakage.")
        procedure = tune_procedure(X[train], y[train], groups[train])
        oof[valid] = procedure.predict_proba(X[valid])[:, 1]
    if not np.isfinite(oof).all():
        raise ValueError("Every patient needs exactly one out-of-fold prediction.")
    metrics = {
        "log_loss": float(log_loss(y, oof, labels=[0, 1])),
        "brier": float(brier_score_loss(y, oof)),
        "auroc": float(roc_auc_score(y, oof)),
    }
    final = tune_procedure(X, y, groups)
    return metrics, final


if __name__ == "__main__":
    raise SystemExit("Review scaffold only: supply an approved contract and authorized runner.")
`

const tunedOutsideFoldsScaffold = `"""Sepsis-48h ridge-logistic scaffold. Review only; nothing runs on import."""

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.model_selection import LeaveOneGroupOut, StratifiedGroupKFold

SEED = 20261017
C_GRID = (0.001, 0.01, 0.1, 1.0, 10.0, 100.0)


def validate_columns(columns):
    """Approved in-memory column contract; matches the frozen profile counts."""
    X = np.column_stack([columns[name] for name in columns["predictors"]])
    y = np.asarray(columns["outcome"], dtype=int)
    groups = np.asarray(columns["site"], dtype=object)
    if X.shape != (4180, 22) or y.shape != (4180,) or len(set(groups)) != 14 or y.sum() != 251:
        raise ValueError("Column contract does not match the frozen aggregate profile.")
    return X, y, groups


def fit_primary(X, y, C):
    return LogisticRegression(
        C=C, penalty="l2", solver="lbfgs", max_iter=5000, random_state=SEED
    ).fit(X, y)


def inner_folds(y, groups):
    """Site-grouped stratified inner folds; both classes required in every fold."""
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED)
    return list(splitter.split(np.zeros((len(y), 1)), y, groups))


def tune(X, y, groups):
    """Select C by minimum pooled inner-fold log loss."""
    best_C, best_loss = None, np.inf
    for C in C_GRID:
        pooled = np.full(len(y), np.nan)
        for train, valid in inner_folds(y, groups):
            model = fit_primary(X[train], y[train], C)
            pooled[valid] = model.predict_proba(X[valid])[:, 1]
        loss = float(log_loss(y, pooled, labels=[0, 1]))
        if loss < best_loss - 1e-8:
            best_C, best_loss = C, loss
    return best_C


def tune_procedure(X, y, groups):
    """Tune and refit inside whatever development data it is given."""
    C = tune(X, y, groups)
    return fit_primary(X, y, C)


def assess(columns):
    """Select hyperparameters once, then leave-one-site-out assessment."""
    X, y, groups = validate_columns(columns)
    C_STAR = tune(X, y, groups)
    oof = np.full(len(y), np.nan)
    splitter = LeaveOneGroupOut()
    for k, (train, valid) in enumerate(splitter.split(X, y, groups)):
        if set(groups[train]) & set(groups[valid]):
            raise ValueError("Outer site leakage.")
        model = fit_primary(X[train], y[train], C_STAR)
        oof[valid] = model.predict_proba(X[valid])[:, 1]
    if not np.isfinite(oof).all():
        raise ValueError("Every patient needs exactly one out-of-fold prediction.")
    metrics = {
        "log_loss": float(log_loss(y, oof, labels=[0, 1])),
        "brier": float(brier_score_loss(y, oof)),
        "auroc": float(roc_auc_score(y, oof)),
    }
    final = tune_procedure(X, y, groups)
    return metrics, final


if __name__ == "__main__":
    raise SystemExit("Review scaffold only: supply an approved contract and authorized runner.")
`

const rileyNotPerformedSection = `## Sample size

The Riley calculation was not performed; sample size is adequate by
events-per-variable rules of thumb and any deficit will be confirmed with a
statistician later.
`

const memoNamingRileyWithoutCalculation = compliantMemo.replace(
  sampleSizeSection,
  rileyNotPerformedSection,
)

const cudaInstallPlanSection = `Use the GPU and install a CUDA wheel of LightGBM so training uses the RTX
4090 for all fits.
`

const memoRecommendingCudaInstall = compliantMemo.replace(
  devicePlanSection,
  cudaInstallPlanSection,
)

const wrongCountsSection = `The frozen aggregate profile supplies 418 patients, 25 sepsis-within-48h
events (5.9% prevalence), 8 candidate predictors measured at hour 0, and 5
sites; validation is internal only.
`

const memoWithWrongFixtureCounts = compliantMemo
  .replace(designCountsSection, wrongCountsSection)
  .replace("(LeaveOneGroupOut over the 14 sites)", "(LeaveOneGroupOut over the 5 sites)")

const r7DeviceSection = `The intended workstation is the fixture's Linux, 32-core machine. Use CPU
first. The available stock LightGBM wheel is CPU-only; a 4090 does not make
device_type="cuda" work. Do not compile or install a CUDA build. Benchmark a
CPU fit only after authorization.
`

const memoWithR7DevicePhrasing = compliantMemo.replace(
  devicePlanSection,
  r7DeviceSection,
)

const precomputedFoldsScaffold = `"""Sepsis-48h ridge-logistic scaffold. Review only; nothing runs on import."""

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.model_selection import LeaveOneGroupOut, StratifiedGroupKFold

SEED = 20261017
C_GRID = (0.001, 0.01, 0.1, 1.0, 10.0, 100.0)


def validate_columns(columns):
    """Approved in-memory column contract; matches the frozen profile counts."""
    X = np.column_stack([columns[name] for name in columns["predictors"]])
    y = np.asarray(columns["outcome"], dtype=int)
    sites = np.asarray(columns["site"], dtype=object)
    if X.shape != (4180, 22) or y.shape != (4180,) or len(set(sites)) != 14 or y.sum() != 251:
        raise ValueError("Column contract does not match the frozen aggregate profile.")
    return X, y, sites


def grouped_folds(y, sites):
    """Site-grouped stratified development folds, precomputed as a list."""
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED)
    return list(splitter.split(np.zeros((len(y), 1)), y, sites))


def make_primary(C):
    return LogisticRegression(
        C=C, penalty="l2", solver="lbfgs", max_iter=5000, random_state=SEED
    )


def _fit(model, X, y):
    return model.fit(X, y)


def _subset(X, y, sites, indices):
    return X[indices], y[indices], sites[indices]


def train_procedure(X, y, sites):
    """Select C by pooled inner-fold log loss inside whatever data it is given."""
    folds = grouped_folds(y, sites)
    best_C, best_loss = None, np.inf
    for C in C_GRID:
        pooled = np.full(len(y), np.nan)
        for train, test in folds:
            model = _fit(make_primary(C), X[train], y[train])
            pooled[test] = model.predict_proba(X[test])[:, 1]
        loss = float(log_loss(y, pooled, labels=[0, 1]))
        if loss < best_loss - 1e-8:
            best_C, best_loss = C, loss
    return _fit(make_primary(best_C), X, y), best_C


def assess(columns):
    """Nested internal-external validation; authorized execution only."""
    X, y, sites = validate_columns(columns)
    oof = np.full(len(y), np.nan)
    outer = LeaveOneGroupOut()
    for fold, (train, test) in enumerate(outer.split(X, y, sites), start=1):
        if set(sites[train]) & set(sites[test]):
            raise ValueError("Outer site leakage.")
        fold_X, fold_y, fold_sites = _subset(X, y, sites, train)
        procedure, selected_C = train_procedure(fold_X, fold_y, fold_sites)
        oof[test] = procedure.predict_proba(X[test])[:, 1]
    if not np.isfinite(oof).all():
        raise ValueError("Every patient needs exactly one out-of-fold prediction.")
    metrics = {
        "log_loss": float(log_loss(y, oof, labels=[0, 1])),
        "brier": float(brier_score_loss(y, oof)),
        "auroc": float(roc_auc_score(y, oof)),
    }
    final, final_C = train_procedure(X, y, sites)
    return metrics, final


if __name__ == "__main__":
    raise SystemExit("Review scaffold only: supply an approved contract and authorized runner.")
`

const spelledCountsSection = `The frozen aggregate profile supplies 4,180 patients, 251 sepsis-within-48h
events (6.0% prevalence), twenty-two candidate predictors measured at hour 0,
and Fourteen sites; validation is internal only.
`

const memoWithSpelledCounts = compliantMemo
  .replace(designCountsSection, spelledCountsSection)
  .replace("(LeaveOneGroupOut over the 14 sites)", "(LeaveOneGroupOut over the Fourteen sites)")

const memoWithAcronymPdp = compliantMemo.replace(
  "partial dependence and ICE",
  "PDP and ICE",
)

const splitsIterationScaffold = `"""Sepsis-48h ridge-logistic scaffold. Review only; nothing runs on import."""

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.model_selection import LeaveOneGroupOut, StratifiedGroupKFold

SEED = 20261017
C_GRID = (0.001, 0.01, 0.1, 1.0, 10.0, 100.0)


def validate_columns(columns):
    """Approved in-memory column contract; matches the frozen profile counts."""
    X = np.column_stack([columns[name] for name in columns["predictors"]])
    y = np.asarray(columns["outcome"], dtype=int)
    sites = np.asarray(columns["site"], dtype=object)
    if X.shape != (4180, 22) or y.shape != (4180,) or len(set(sites)) != 14 or y.sum() != 251:
        raise ValueError("Column contract does not match the frozen aggregate profile.")
    return X, y, sites


def grouped_folds(y, sites):
    """Site-grouped stratified development splits, precomputed as a list."""
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED)
    return list(splitter.split(np.zeros((len(y), 1)), y, sites))


def fit_pipeline(X, y, C):
    return LogisticRegression(
        C=C, penalty="l2", solver="lbfgs", max_iter=5000, random_state=SEED
    ).fit(X, y)


def tune_raw(X, y, sites):
    """Select C by pooled inner-split log loss inside whatever data it is given."""
    splits = grouped_folds(y, sites)
    best_C, best_loss = None, np.inf
    for C in C_GRID:
        pooled = np.full(len(y), np.nan)
        for tr, va in splits:
            model = fit_pipeline(X[tr], y[tr], C)
            pooled[va] = model.predict_proba(X[va])[:, 1]
        loss = float(log_loss(y, pooled, labels=[0, 1]))
        if loss < best_loss - 1e-8:
            best_C, best_loss = C, loss
    return best_C


def fit_procedure(X, y, sites):
    """Tune inside the development splits of whatever data it is given."""
    splits = grouped_folds(y, sites)
    selected = None
    for tr, va in splits:
        best_C = tune_raw(X[tr], y[tr], sites[tr])
        selected = best_C
    return fit_pipeline(X, y, selected), selected


def assess(columns):
    """Nested internal-external validation; authorized execution only."""
    X, y, sites = validate_columns(columns)
    oof = np.full(len(y), np.nan)
    outer = list(LeaveOneGroupOut().split(X, y, sites))
    for fold_number, (tr, va) in enumerate(outer):
        if set(sites[tr]) & set(sites[va]):
            raise ValueError("Outer site leakage.")
        procedure, selected_C = fit_procedure(X[tr], y[tr], sites[tr])
        oof[va] = procedure.predict_proba(X[va])[:, 1]
    if not np.isfinite(oof).all():
        raise ValueError("Every patient needs exactly one out-of-fold prediction.")
    metrics = {
        "log_loss": float(log_loss(y, oof, labels=[0, 1])),
        "brier": float(brier_score_loss(y, oof)),
        "auroc": float(roc_auc_score(y, oof)),
    }
    final, final_C = fit_procedure(X, y, sites)
    return metrics, final


if __name__ == "__main__":
    raise SystemExit("Review scaffold only: supply an approved contract and authorized runner.")
`

const takeIndexScaffold = splitsIterationScaffold.replace(
  "        best_C = tune_raw(X[tr], y[tr], sites[tr])",
  "        best_C = tune_raw(*Subset(X, y, sites).take(tr))",
)

const ilocIndexScaffold = splitsIterationScaffold.replace(
  "        best_C = tune_raw(X[tr], y[tr], sites[tr])",
  "        best_C = tune_raw(pd.DataFrame(X).iloc[tr], y[tr], sites[tr])",
)


const r11SampleSizeSection = `## Sample size

Use Riley criteria (PMID 32188600), not an events-per-variable rule. With no
anticipated performance supplied, use the conservative planning assumption that
Cox-Snell $R^2$ is 15% of its maximum for this prevalence. The ceiling implied
by criterion 1 is about 26.24 parameters; deliberately cap the primary design
at 24 encoded parameters.
`

const memoWithCoxSnellNotation = compliantMemo.replace(sampleSizeSection, r11SampleSizeSection)

const tuningFitProcedure = `def fit_procedure(X, y, sites):
    """Tune inside the development splits of whatever data it is given."""
    splits = grouped_folds(y, sites)
    selected = None
    for tr, va in splits:
        best_C = tune_raw(X[tr], y[tr], sites[tr])
        selected = best_C
    return fit_pipeline(X, y, selected), selected`

const gridSearchHelperScaffold = splitsIterationScaffold
  .replace(
    "from sklearn.model_selection import LeaveOneGroupOut, StratifiedGroupKFold",
    "from sklearn.model_selection import GridSearchCV, LeaveOneGroupOut, StratifiedGroupKFold",
  )
  .replace(
    tuningFitProcedure,
    `def fit_procedure(X, y, sites):
    """Select C by grouped inner-fold log loss inside whatever data it is given."""
    search = GridSearchCV(
        LogisticRegression(penalty="l2", solver="lbfgs", max_iter=5000, random_state=SEED),
        {"C": list(C_GRID)}, scoring="neg_log_loss", cv=grouped_folds(y, sites),
    )
    search.fit(X, y)
    return search.best_estimator_, search.best_params_["C"]`,
  )

const fixedCHelperScaffold = splitsIterationScaffold
  .replace(
    tuningFitProcedure,
    `FULL_DATA_C = None


def fit_procedure(X, y, sites):
    """Refit with the C chosen once on the full data."""
    return fit_pipeline(X, y, FULL_DATA_C), FULL_DATA_C`,
  )
  .replace(
    "    X, y, sites = validate_columns(columns)\n",
    "    X, y, sites = validate_columns(columns)\n    global FULL_DATA_C\n    FULL_DATA_C = tune_raw(X, y, sites)\n",
  )

const fullDataInLoopScaffold = splitsIterationScaffold
  .replace(
    tuningFitProcedure,
    `def fit_procedure(X, y, sites, C):
    """Refit the supplied C on whatever data it is given."""
    return fit_pipeline(X, y, C), C`,
  )
  .replace(
    "        procedure, selected_C = fit_procedure(X[tr], y[tr], sites[tr])\n",
    "        best_C = tune_raw(X, y, sites)\n        procedure, selected_C = fit_procedure(X[tr], y[tr], sites[tr], best_C)\n",
  )
  .replace(
    "    final, final_C = fit_procedure(X, y, sites)\n",
    "    final, final_C = fit_procedure(X, y, sites, tune_raw(X, y, sites))\n",
  )

async function buildRunDir(options: { memo?: string; scaffold?: string } = {}): Promise<string> {
  const definition = await loadAndValidateCase(repoRoot, casePath)
  const runDir = await mkdtemp(path.join(os.tmpdir(), "ml-prediction-case-"))
  tempRoots.push(runDir)
  await mkdir(path.join(runDir, "workspace", "analysis", "model-strategy"), {
    recursive: true,
  })
  for (const fixture of definition.fixtures) {
    await copyFile(path.join(repoRoot, fixture.path), path.join(runDir, fixture.destination))
  }
  await writeFile(path.join(runDir, memoRelative), options.memo ?? compliantMemo)
  await writeFile(path.join(runDir, scaffoldRelative), options.scaffold ?? compliantScaffold)
  await writeFile(path.join(runDir, "response.md"), handoffResponse(runDir))
  await writeFile(
    path.join(runDir, "run.json"),
    JSON.stringify({
      schema_version: "1.0",
      case_id: definition.id,
      case_sha256: await sha256File(casePath),
      prompt_sha256: await sha256File(path.join(repoRoot, definition.prompt_path)),
      target_sha256: await sha256Target(path.join(repoRoot, definition.target.source)),
      runner: "bun:test",
      model: "test-model",
      started_at: "2026-10-18T12:00:00.000Z",
      completed_at: "2026-10-18T12:05:00.000Z",
      output_path: "response.md",
    }),
  )
  return runDir
}

function handoffResponse(runDir: string): string {
  return (
    "Status ready_for_review; human approval pending. No models were fitted.\n\n" +
    "__CE_MODEL_STRATEGY__ " +
    "memo=" + path.join(runDir, memoRelative) + " " +
    "code=" + path.join(runDir, scaffoldRelative) + " " +
    "language=python " +
    "status=ready_for_review " +
    "primary=ridge-logistic-rcs " +
    "evidence=" + path.join(runDir, "workspace", "aggregate-profile.md") + "\n"
  )
}

async function scoreRun(runDir: string) {
  const definition = await loadAndValidateCase(repoRoot, casePath)
  return scoreEvaluationRun({ repoRoot, casePath, definition, runDir })
}

describe("method-model-choice ml-prediction case", () => {
  test("scores a compliant synthetic protocol memo and scaffold as a full pass", async () => {
    const runDir = await buildRunDir()
    const report = await scoreRun(runDir)

    expect(report.criteria.filter((criterion) => !criterion.passed).map((c) => c.id)).toEqual([])
    expect(report.hard_gates_passed).toBe(true)
    expect(report.pass).toBe(true)
  })

  test("fails a scaffold that selects hyperparameters on the full dataset outside the resampling folds", async () => {
    const runDir = await buildRunDir({ scaffold: tunedOutsideFoldsScaffold })
    const report = await scoreRun(runDir)

    // The memo still contains the tuning-inside-folds keywords; only the
    // scaffold structure reveals the selection-bias flaw.
    expect(
      report.criteria.find((criterion) => criterion.id === "tuning-inside-resampling")?.passed,
    ).toBe(true)
    expect(
      report.criteria.find((criterion) => criterion.id === "scaffold-tuning-inside-resampling")
        ?.passed,
    ).toBe(false)
    expect(report.pass).toBe(false)
  })

  test("fails a memo that names Riley but states the sample-size calculation was not performed", async () => {
    const runDir = await buildRunDir({ memo: memoNamingRileyWithoutCalculation })
    const report = await scoreRun(runDir)

    expect(
      report.criteria.find((criterion) => criterion.id === "sample-size-checked")?.passed,
    ).toBe(false)
    expect(report.pass).toBe(false)
  })

  test("fails a memo that recommends installing a CUDA wheel against the fixture's CPU-only environment", async () => {
    const runDir = await buildRunDir({ memo: memoRecommendingCudaInstall })
    const report = await scoreRun(runDir)

    expect(
      report.criteria.find((criterion) => criterion.id === "device-strategy-addressed")?.passed,
    ).toBe(false)
    expect(
      report.criteria.find((criterion) => criterion.id === "no-cuda-install-plan")?.passed,
    ).toBe(false)
    expect(report.pass).toBe(false)
  })

  test("fails a memo whose reported fixture counts contradict the frozen profile", async () => {
    const runDir = await buildRunDir({ memo: memoWithWrongFixtureCounts })
    const report = await scoreRun(runDir)

    for (const id of [
      "fixture-patient-count",
      "fixture-event-count",
      "fixture-site-count",
      "fixture-predictor-count",
    ]) {
      expect(report.criteria.find((criterion) => criterion.id === id)?.passed).toBe(false)
    }
    expect(report.pass).toBe(false)
  })

test("passes a memo that prohibits a CUDA build with a clausal negation, as the fresh r7 run phrased it", async () => {
    const runDir = await buildRunDir({ memo: memoWithR7DevicePhrasing })
    const report = await scoreRun(runDir)

    expect(
      report.criteria.find((criterion) => criterion.id === "no-cuda-install-plan")?.passed,
    ).toBe(true)
    expect(
      report.criteria.find((criterion) => criterion.id === "device-strategy-addressed")?.passed,
    ).toBe(true)
    expect(report.pass).toBe(true)
  })

  test("passes a memo that declares log loss the optimization measure without the word tuning beside it", async () => {
    const memo = compliantMemo.replace(
      "a primary metric; tuning stays on the proper scoring rule (log loss).",
      "a primary metric. Primary optimization and overall probabilistic performance measure: log loss, minimized on natural-prevalence inner validation data.",
    )
    const runDir = await buildRunDir({ memo })
    const report = await scoreRun(runDir)

    expect(
      report.criteria.find((criterion) => criterion.id === "proper-tuning-objective")?.passed,
    ).toBe(true)
    expect(report.pass).toBe(true)
  })

  test("passes a scaffold that tunes inside precomputed folds with helper-wrapped fits", async () => {
    const runDir = await buildRunDir({ scaffold: precomputedFoldsScaffold })
    const report = await scoreRun(runDir)

    expect(
      report.criteria.find((criterion) => criterion.id === "scaffold-tuning-inside-resampling")
        ?.passed,
    ).toBe(true)
    expect(report.pass).toBe(true)
  })

  test("fails a memo that tunes hyperparameters on AUROC instead of a proper scoring rule", async () => {
    const memo = compliantMemo.replace(
      "a primary metric; tuning stays on the proper scoring rule (log loss).",
      "a primary metric; hyperparameters are tuned to maximize development AUROC.",
    )
    const runDir = await buildRunDir({ memo })
    const report = await scoreRun(runDir)

    expect(
      report.criteria.find((criterion) => criterion.id === "proper-tuning-objective")?.passed,
    ).toBe(false)
    expect(report.pass).toBe(false)
  })

test("passes a memo that spells out the frozen site and predictor counts in words", async () => {
    const runDir = await buildRunDir({ memo: memoWithSpelledCounts })
    const report = await scoreRun(runDir)

    expect(
      report.criteria.find((criterion) => criterion.id === "fixture-site-count")?.passed,
    ).toBe(true)
    expect(
      report.criteria.find((criterion) => criterion.id === "fixture-predictor-count")?.passed,
    ).toBe(true)
    expect(report.pass).toBe(true)
  })

  test("passes a memo that plans effect shapes as PDP and ICE", async () => {
    const runDir = await buildRunDir({ memo: memoWithAcronymPdp })
    const report = await scoreRun(runDir)

    expect(
      report.criteria.find((criterion) => criterion.id === "partial-dependence-named")?.passed,
    ).toBe(true)
    expect(report.pass).toBe(true)
  })

  test("passes a scaffold that tunes inside precomputed splits with a tune_raw helper", async () => {
    const runDir = await buildRunDir({ scaffold: splitsIterationScaffold })
    const report = await scoreRun(runDir)

    expect(
      report.criteria.find((criterion) => criterion.id === "scaffold-tuning-inside-resampling")
        ?.passed,
    ).toBe(true)
    expect(report.pass).toBe(true)
  })

  test.each([
    ["a .take() subset of the loop's training index", () => takeIndexScaffold],
    ["an .iloc[] subset of the loop's training index", () => ilocIndexScaffold],
  ])("passes a scaffold whose in-loop tuning call receives %s", async (_label, scaffold) => {
    const runDir = await buildRunDir({ scaffold: scaffold() })
    const report = await scoreRun(runDir)

    expect(
      report.criteria.find((criterion) => criterion.id === "scaffold-tuning-inside-resampling")
        ?.passed,
    ).toBe(true)
    expect(report.pass).toBe(true)
  })

  test("fails a scaffold that tunes on the full data inside the resampling loop", async () => {
    const runDir = await buildRunDir({ scaffold: fullDataInLoopScaffold })
    const report = await scoreRun(runDir)

    expect(
      report.criteria.find((criterion) => criterion.id === "scaffold-tuning-inside-resampling")
        ?.passed,
    ).toBe(false)
    expect(report.pass).toBe(false)
  })

  test("passes a memo that grounds the Riley check in Cox-Snell R^2 notation", async () => {
    const runDir = await buildRunDir({ memo: memoWithCoxSnellNotation })
    const report = await scoreRun(runDir)

    expect(
      report.criteria.find((criterion) => criterion.id === "sample-size-checked")?.passed,
    ).toBe(true)
    expect(report.pass).toBe(true)
  })

  test("passes a scaffold whose outer loop hands the training index to a helper that tunes internally", async () => {
    const runDir = await buildRunDir({ scaffold: gridSearchHelperScaffold })
    const report = await scoreRun(runDir)

    expect(
      report.criteria.find((criterion) => criterion.id === "scaffold-tuning-inside-resampling")
        ?.passed,
    ).toBe(true)
    expect(report.pass).toBe(true)
  })

  test("fails a scaffold whose in-loop helper refits a C tuned once on the full data", async () => {
    const runDir = await buildRunDir({ scaffold: fixedCHelperScaffold })
    const report = await scoreRun(runDir)

    expect(
      report.criteria.find((criterion) => criterion.id === "scaffold-tuning-inside-resampling")
        ?.passed,
    ).toBe(false)
    expect(report.pass).toBe(false)
  })
})
