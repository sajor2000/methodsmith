---
name: method-ml-track
description: "Adds reproducible ML experiment tracking (data hashes, splits, metrics, SAP links) with MLflow, W&B, DVC, or an offline log. Use when building or reviewing ML experiments."
argument-hint: "[--backend mlflow|wandb|dvc|offline, --project name]"
---

# ML Experiment Tracking Setup


## Skill Value

- **Problem it solves:** ML analyses lose reproducibility when splits, seeds, metrics, and artifacts are not tracked consistently.
- **Use when:** The user builds or reviews ML experiments, prediction models, validation runs, or tracking setup.
- **Output:** Experiment tracking plan or scaffold with run metadata, metrics, artifacts, and reproducibility checks.
- **Ask only if:** Only when tracking backend, task type, or required metrics cannot be inferred.
- **Do not do:** Do not make a tracking service mandatory when local artifacts are sufficient.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Most ML papers in biomedicine are unreproducible because runs are not tracked. By the time the analyst writes the manuscript, "the version that got 0.89 AUC" is on no disk, with no record of hyperparameters or training-data hash. This skill wires tracking from day 1.

## When this skill activates

- New ML project (immediately after `method-cohort` and before model training)
- Mid-project transition from "exploratory" to "manuscript-bound" runs
- After `method-data-leakage-reviewer` flagged irreproducible eval
- Manual: `method-ml-track --backend mlflow --project sepsis-risk`

## Prerequisites

- A Python or R ML project (most modern frameworks have tracking integrations)
- For mlflow: pip-installed; tracking-server URL OR approved, gitignored restricted store
- For wandb: API key in `~/.netrc` or env; project quota
- For dvc: dvc-installed; remote configured
- For offline: just file-system writable

## Validation design and disclosure boundary

Preserve the SAP's validation design: bootstrap optimism correction, nested CV,
internal-external validation, temporal validation or a locked held-out test set.
A separate test split is not mandatory. Record the complete development/tuning
procedure inside the appropriate resampling. If no held-out set exists, use
`test_data_sha: null` and null test metrics; record the prespecified resampling
scheme, corrected metrics and uncertainty instead. Never invent test results or
force a small-data split merely to fill the schema. When a held-out set exists,
score it only after final model lock and record when it was unlocked.

Tracking is not permission to upload data. Establish the project's sensitive-data
mode and approved storage/backend before reading training files or initializing
network logging. In schema-only mode, run data-reading/hash/training commands
through the method-safe-run command; never paste row values into context. If mode or
backend approval is unresolved, use a restricted, gitignored offline location
and report the missing decision; do not start SaaS logging.

Keep complete sensitive run logs and model artifacts in the approved restricted,
gitignored working area. A shareable `runs/` summary is a separate release:
apply the project/site/DUA disclosure floor (default counts below 11), suppress
small counts, complements and related subgroup metrics/CIs that reveal them,
and record the review status. Null/suppressed values with a reason satisfy the
shareable schema; they are not fabricated zeroes or missing logging failures.
Use `method-numbers` for reportable aggregate registration and source provenance.
Commit/export only reviewed aggregate summaries. Keep serialized models that
retain training examples (for example nearest-neighbor models), SHAP arrays,
patient-level evaluation output, row identifiers and revealing file paths out of
Git and external trackers. A model-file hash does not certify safe release.

## Core workflow

### Step 1: Pick the backend

| Backend | When to pick |
|---------|--------------|
| **mlflow** | Self-hostable, file or DB backend, multi-language (Python + R + Java). Default for most academic settings |
| **wandb** | SaaS-first, hosted UI, requires network (check the current plan terms for academic use). Pick when sharing with collaborators in real time and no PHI leaves the site |
| **dvc** | Git-native, versions approved data + model artifacts through approved remotes only. Pick for dataset-heavy projects with strict reproducibility |
| **offline** | No network or UI. Complete sensitive logs stay restricted and gitignored; only disclosure-reviewed summaries may enter `runs/` or Git |

If `--backend` not passed, infer from existing config (presence of `mlflow`, `wandb`, `.dvc/`); else prompt.

### Step 2: Generate boilerplate

Write `analysis/ml/tracking.py` (or `tracking.R`) with backend-specific init code:

**mlflow example:**

```python
import mlflow
import hashlib
from pathlib import Path

def sha256_file(path, chunk=1 << 20):
    """Stream the file so large extracts are not read into memory at once."""
    h = hashlib.sha256()
    with Path(path).open("rb") as fh:
        for block in iter(lambda: fh.read(chunk), b""):
            h.update(block)
    return h.hexdigest()

def init_run(train_path, approved_tracking_uri, experiment="sepsis-risk", run_name=None):
    # train_path comes from the project config, never a hard-coded path
    # Require an approved restricted store or approved backend from project config.
    # Local stores must be outside Git or explicitly gitignored before logging.
    mlflow.set_tracking_uri(approved_tracking_uri)
    mlflow.set_experiment(experiment)
    run = mlflow.start_run(run_name=run_name)
    # Always log data hash
    mlflow.log_param("train_data_sha", sha256_file(train_path)[:16])
    mlflow.log_param("git_sha", _git_sha())
    mlflow.log_param("study_id", _study_id())
    return run
```

### Step 3: Define the required-log schema

Write `analysis/ml/run-schema.yaml` -- the minimum fields every run must log. The field list, names, and placement rules live in `references/run-log-schema.yaml`; that schema is authoritative, so when the two disagree fix the project schema to match it. Every run must log:

- Provenance params: data hash, Git SHA, study id, random seed.
- Validation params: `validation_type`, `split_strategy`, `n_configurations_evaluated`.
- Development metrics (resampling/tuning): the selection metric (`auc_validation`, with `log_loss_validation` as the proper scoring rule), `auprc_validation` (interpreted against prevalence, never alone), the validation scheme, train counts, and `instability_mape` when refit instability is measured.
- Held-out test metrics ONLY for the locked final model, once; record `test_set_unlocked_at`.
- Restricted artifacts (model, eval results, calibration plot, feature importance) stay in the approved restricted store -- never automatic tracker uploads, and only separately reviewed aggregates go to the backend.

A run that omits the required validation evidence is not eligible for manuscript inclusion. For non-held-out designs, that evidence is `validation_type`, `validation_procedure`, and `corrected_performance`. Held-out fields are conditional on that design; disclosure-suppressed shared values are acceptable when the complete restricted record and review reason are retained. A run that logs test-set metrics before the model is locked is not eligible either: scoring exploratory runs on the test set turns it into a selection set (REFORMS, Kapoor et al., Sci Adv 2024, PMID 38691601). Report `n_configurations_evaluated` with the final model (TRIPOD+AI item 12c, PMID 38626948).

### Step 4: Write the linkage to the SAP

Add to `analysis/sap.md`:

> "All ML runs are tracked via {{ backend }} at {{ uri }}. The run-id of the final model reported in the manuscript is logged in `analysis/ml/manuscript-run.txt` and committed alongside the SAP."

### Step 5: Provide the run-log fallback

For any backend, retain a complete offline run log in the approved restricted, gitignored area. Write `runs/<run-id>.yaml` only as a disclosure-reviewed aggregate summary for Git. It is not an unfiltered mirror: withhold small cells/complements and revealing derived metrics, identifier-bearing paths and row-level artifacts. If review is pending, keep the summary uncommitted and report the blocker.

```yaml
run_id: <uuid>
started: <ISO>
completed: <ISO>
backend: mlflow
backend_run_id: <mlflow run id>
params:
  train_data_sha: <sha256 of the training extract>
  # one key per hyperparameter
metrics:
  auc_validation: 0.84
  # one key per reported metric
artifacts:
  - name: reviewed-calibration-plot.png
    path: <non-revealing aggregate artifact path>
    sha: <sha256>
study_id: <id>
disclosure:
  review_status: pending
  suppression_reason: <small cells and related metrics withheld, or null>
  restricted_record_id: <opaque id; no restricted file path>
```

### Step 6: Emit signal

`__CE_ML_TRACK__ backend=<name> uri=<uri> schema=<path>` so subsequent skills know tracking exists.

## What this skill does NOT do

- Does not train models (use the `method-work` skill and write training scripts that call into the tracker)
- Does not enforce schema at training-time -- the discipline is the analyst's. The reviewer agent (eventually) checks runs/*.yaml against schema
- Does not version the data itself beyond hashing (use DVC for data versioning)
- Does not push runs to a public registry

## References

@./references/backends-comparison.md

@./references/run-log-schema.yaml
