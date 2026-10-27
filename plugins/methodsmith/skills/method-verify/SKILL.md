---
name: method-verify
description: "Runs an analysis-output sanity gate: sample size, leakage, effect direction, missing data, PHI, figures, reproducibility, P recomputation. Use when a step finishes."
argument-hint: "[optional: path to specific output file or directory to verify]"
---

# Analysis Verification Gate


## Skill Value

- **Problem it solves:** Analysis errors are cheaper to catch between steps than at final manuscript or code review.
- **Use when:** The user finishes an analysis step or wants a quick sanity check before marking work done.
- **Output:** Pass/fail verification notes with blockers and recommended fixes.
- **Ask only if:** Only when target output, SAP section, or expected direction cannot be inferred.
- **Do not do:** Do not replace full code review, reporting-checklist review, or data QA.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Quick mid-workflow sanity check on analysis outputs. Distinct from the reporting checklist (`method-checklist` + `method-reporting-checklist-reviewer`) which fires at manuscript time — this skill catches errors during analysis execution.

## Stack Profile

The repository root is pre-resolved at skill load:
!`git rev-parse --show-toplevel 2>/dev/null || true`

Use the resolved absolute path or resolve it at runtime, then read `.methodsmith/config.local.yaml` with the native file-read tool. In a linked worktree, fall back to the main checkout when the machine-local file is absent. Parse `language`, `data_root`, and `reporting`; if no config can be read, infer them from project files.

## Input

<verify_input> #$ARGUMENTS </verify_input>

If empty, verify all analysis outputs found under `output/`, `analysis/`, and any `data_root` from the stack profile.

## Verification Checks

Run each check from the catalog in `references/check-catalog.md`. Each check produces one of:

- **PASS** — check passed, no action needed
- **WARN** — potential issue, surfaces for human review but does not block
- **FAIL** — definite problem, blocks task completion when invoked by `method-work`

## Core Workflow

### Step 1: Gather context

Read the stack profile for language and data paths. Check for:
- `analysis/research-question.yaml` — for hypothesis direction check
- The SAP: `analysis/sap.md`, or any markdown file with `sap_version` in its frontmatter (for example under `docs/plans/`) — for sample size and imputation checks
- The data QA report: `reports/data-qa/<extract_id>.md` (written by `method-data-qa`), falling back to legacy `analysis/data-qa-report.md` — for expected N from the data QA gate
- `analysis/power/` — for minimum sample size from power calculation
- `analysis/signoff/signoff-ledger.json` — for unresolved human signoffs surfaced by `method-signoff`
- `__CE_CLIF__ active=true` in context — for CLIF-specific checks
- **Sensitive-data boundary.** Resolve `phi_environment.mode` in `.methodsmith/config.local.yaml` (worktree, then main checkout; legacy `compliant: true` = `approved`, `compliant: false` = `schema-only`, `sensitive_data: false` = `no-sensitive-data`; any schema-only signal wins; unreadable = `schema-only`). `approved` or `no-sensitive-data`: proceed silently and never mention the boundary again. `schema-only`: headings, types, counts, and aggregates only; never open, print, or paste data values; run data-reading scripts as `method-safe-run -- <command>` (path in the guard's deny message); save results as aggregate tables (counts under 11 suppressed) in `output/` or a `phi_environment.aggregate_dirs` entry. Unset, interactive: ask once with the blocking question tool (else a numbered list) offering `Approved endpoint: full access`, `Not approved or unsure: schema-only`, and `No sensitive data: public or synthetic`; save the answer as `phi_environment.mode` there once `git check-ignore -q .methodsmith/config.local.yaml` passes (else first add `.methodsmith/*.local.yaml` to `.gitignore`) so the guard hook sees it. Unset, headless: schema-only. In `schema-only`, run every check (including the PHI scan) through scripts that return only file names, column headings, counts, and categories, never rows or matched values.

### Step 2: Run check catalog

Execute each applicable check from `references/check-catalog.md`. Skip checks that don't apply (e.g., skip leakage scan if no train/test split exists; skip figure quality if no figures found).

**Number gate.** Load the `method-numbers` skill and run its `check` on the manuscript sources, rendered copies, and tables (it reads `analysis/numbers/registry.json`). A `FAIL` exit, or a gate that could not run, blocks readiness: quote its `file:line: reason: token` lines as printed, and never add a result to the allowlist or edit the registry to make it pass. Run it whenever `analysis/numbers/registry.json` exists or the outputs feed a manuscript, table, caption, or model card; each `FAIL` line is a FAIL check.

**Statistic recomputation gate.** When outputs or tables report t/F/chi2/z statistics with P values, or means and percentages with an N, extract the printed numbers into a claims file (values and reported P as the printed strings — their rounding drives the tolerance). Record `alternative` from the SAP (`two-sided`, `greater`, `less`, or `unknown`); ordinary F/chi2 tests use `greater`. Record `p_method="ordinary"` only for an unadjusted reference-distribution P value; identify adjusted, exact, permutation or sequential values separately. Unknown sidedness and unsupported P methods remain WARN/not checked, never a substituted two-sided calculation. Pass the SAP alpha with `--alpha` and run:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/verify_stats.py" check analysis/numbers/stat-claims.json --alpha <SAP-alpha> --out qc/stat_check.json
```

If `python3` is unavailable, probe `python` then `py`; if none is available, recompute a sample of the reported statistics by hand and report the sweep as incomplete, never as passed. Each script `FAIL` (a decision error, an arithmetically impossible summary, or a malformed item) is a FAIL check; each `WARN` is a WARN check.

### Step 3: Emit verification report

```
## Verification Report

 1. [PASS] Sample size: N=8,234 matches cohort definition (data-qa reported N=8,234)
 2. [PASS] No data leakage signals detected
 3. [WARN] Effect direction: OR=0.72 (protective) — hypothesis predicted harmful exposure
 4. [PASS] Missing data: BMI 3.2% missing (MAR assumed), MI m=20 with outcome in imputation model, matches SAP-8
 5. [PASS] No PHI detected in output/
 6. [WARN] Figure analysis/figures/fig1.png: legend overlaps data region
 7. [PASS] Seeds set, renv.lock present

Result: 5 PASS, 2 WARN, 0 FAIL
```

### Step 4: Emit signal

```
__CE_VERIFY__ pass=5 warn=2 fail=0 blocking=<true|false>
```

`blocking=true` when any FAIL exists. `method-work` reads this signal to gate task completion.

## What this skill does NOT do

- Does not replace `method-data-qa` — that skill runs pre-modeling as a GO/NO-GO gate between extraction and analysis
- Does not replace `method-checklist` or `method-reporting-checklist-reviewer` — those verify reporting guideline compliance at manuscript time
- Does not replace `method-signoff` — that skill builds PI-facing review packets and validates the signoff ledger
- Does not modify analysis files — read-only verification
- Does not run or rerun statistical analyses — the recomputation gate rechecks printed statistics for internal consistency (P from t/F/chi2/z, GRIM on means and percentages); it does not fit models or verify model correctness

## References

`references/check-catalog.md` — Full catalog of verification checks with pass/warn/fail criteria
