---
title: Make methodsmith evaluations and methods content verifiably world-class
status: proposed
base: feat/ml-training-protocol
---

# Why

The ML-prediction case needed five rounds of regex loosening (r7 to r12) because
compliant runs kept phrasing the same correct method in new ways ("Fourteen
sites", "PDP", `data.take(train)`, `frame.iloc[train]`, a `fit_primary` helper
that tunes internally). One round also exposed a regex that passed leaky code.
Text matching cannot carry the quality bar alone. This plan moves hard gates onto
structured outputs and code structure, widens coverage to the core biostatistics
skills, and makes the methods content provably correct against primary sources.

Current baseline (2026-10-17):

- 67 skills, 30 behavioral cases covering 21 skills plus 3 reviewer agents;
  48 skills have no behavioral case. Every skill has a skill-creator eval set.
- Scorer criterion types: `text_contains`, `text_not_contains`, `regex`,
  `regex_not`, `claim_absent`, `numeric`, `json_equals`, `json_set_equals`
  (dotted `json_path` with array indexes), `file_exists`, `file_unchanged`.
- Guideline registry is current for CONSORT 2025, SPIRIT 2025, TARGET, TRIPOD+AI,
  TRIPOD-LLM, STARD-AI, and PRISMA 2020. PROBAST+AI is absent.

# Working rules for every phase

- TDD at the agreed seam: `scoreEvaluationRun` for gates and new criterion types;
  skill-content tests for skill prose; red before green, one slice at a time.
- Before changing any gate, run it against every stored real run and every
  adversarial fixture (the oracle pattern used for r7 to r12).
- Acceptance for a covered skill: two fresh runs pass every hard gate (repo
  rule), plus the Phase 1 reliability report.
- MCP use: PubMed (`search_articles`, `get_article_metadata`,
  `get_full_text_article`) for every methods claim and PMID; Paperclip for
  full-text checks of specific claims; Context7 for current library APIs
  (scikit-learn, statsmodels, lifelines, R packages where indexed); Tavily for
  EQUATOR pages, benchmark papers, and anything without a PubMed record. Record
  the source and date of each lookup; never cite from memory.
- No model calls in CI. No PHI, no patient-level fixtures, no full traces.

# Phase 1: Trustworthy evaluations

## 1.1 Structured decision sidecar

Each covered skill also writes `<artifact>.decisions.json` next to its memo,
following a JSON schema stored in that skill's own `references/` (duplicated
per skill, per the self-contained-skill rule). Example fields for
`method-model-choice`: `validation.scheme`, `validation.outer_unit`,
`tuning.objective`, `tuning.inside_resampling`, `sample_size.method`,
`sample_size.inputs`, `calibration.methods`, `fixture_counts`.

- Hard gates move to `json_equals` and `json_set_equals` on the sidecar.
- Add consistency gates so the sidecar cannot drift from the prose: each
  sidecar number also appears in the memo (`numeric` or anchored regex).
- TDD: red tests in `tests/ml-prediction-case.test.ts` with sidecar fixtures
  (compliant, wrong scheme, AUROC objective, mismatched counts) before any
  skill edit; then the skill instruction and schema.
- Pilot on `method-model-choice` (ML prediction case), then `method-ml-track`
  and `method-model-card`.

## 1.2 Code-structure criterion for scaffolds

Add a criterion type `code_query` that parses Python and R scaffolds with
tree-sitter (`web-tree-sitter` WASM with `tree-sitter-python`; Context7 lists
both) so CI needs no Python runtime. The first rule replaces the regex gate:
a tuning call, or a call to a top-level function whose body tunes, sits inside
a resampling loop and receives that loop's training index. It should follow
helper calls one level deep.

- TDD at `scoreEvaluationRun`: the 18 existing case tests and the r5 to r14
  scaffolds are the parity suite; the new criterion must agree with the
  current regex on all of them before the regex is retired.
- Validation in `eval:validate`: the query parses, and the referenced language
  is supported.
- Decision needed: adding a WASM dependency to the scorer.

## 1.3 Phrasing corpus as permanent regression fixtures

Store short sanitized excerpts (synthetic-fixture outputs only) from r5 to r14
under `tests/fixtures/behavioral-corpus/method-model-choice-ml-prediction/`,
each labeled compliant or adversarial per gate. A test asserts that every hard
gate accepts every compliant excerpt and rejects every adversarial one. The
report counts false rejections per gate. Confirm with the maintainer that
excerpts count as "sanitized evidence summaries" under AGENTS.md.

## 1.4 Reliability and lift measurement

- `scripts/evals/prepare.ts`: productize the ad hoc `/tmp/methodsmith/eval-setup.ts`
  (run directory, fixture copy, digests, dispatch prompt) and auto-fill
  `completed_at` from the response file, which every run so far needed by hand.
- `scripts/evals/report.ts`: aggregate `evaluation.json` across runs into
  pass^k (probability that all k runs pass; tau-bench, Sierra) and mean score,
  per case and per gate.
- Baseline arm: run each case without the skill injected, k = 3, and report
  lift. Position against public agent benchmarks for data analysis (DSBench,
  DataSciBench, BLADE, DiscoveryBench, StatABench arXiv 2606.22977) by citation
  only; verify each before citing.
- Acceptance target to agree: pass^3 = 1.0 on hard gates for every covered case.

# Phase 2: Coverage of core methods

Priority order: methods where errors are common and consequential. Each new
case ships with a decision sidecar from day one, one compliant fixture, at least
three adversarial unit tests, and two passing fresh runs. Anchors were verified
through PubMed on 2026-10-17.

| Order | Skill | Case focus | Primary anchors (PMID) |
| :--- | :--- | :--- | :--- |
| 1 | `method-model-card` | calibration hierarchy, risk-distribution figure, imbalance gap reporting | Van Calster 26772608; TRIPOD+AI 38626948 |
| 2 | `method-sap` | estimand, multiplicity, missing-data strategy in an RCT SAP | CONSORT 2025 40228833; SPIRIT 2025 40294953; White MICE 21225900 |
| 3 | `method-power` | prediction-model sample size (development and external validation) | Riley 32188600, 30357870, 34031906, 34915593 |
| 4 | `method-model-choice` | survival with competing risks (no 1 - Kaplan-Meier cumulative incidence) | Austin 26858290 |
| 5 | `method-cohort` or `method-plan` | target trial emulation: time zero, eligibility, immortal time | TARGET 40903028; Hernan 26994063; Austin PS 21818162 |
| 6 | `method-review` | prediction-model appraisal; add PROBAST+AI | PROBAST+AI 40127903; TRIPOD+AI 38626948 |
| 7 | `method-review` | diagnostic accuracy (STARD versus STARD-AI routing) | STARD 26511519; STARD-AI 40954311 |
| 8 | `method-table1` | grouping, missingness, no p-values in RCT baseline tables | CONSORT 2025 40228833 |
| 9 | `method-prereg`, `method-evidence-map`, `method-figure` | prespecification integrity, evidence provenance, honest figures | to source in-cycle |
| 10 | `method-r`, `method-sas-stata`, `method-omics-qc` | language-specific correctness | to source in-cycle |

Workflow skills without cases (`method-commit`, `method-pr`, `method-worktree`,
and similar) come after the methods skills.

# Phase 3: Provably correct methods content

## 3.1 Citation ledger

Script extracts every PMID, DOI, and arXiv ID from `plugins/methodsmith/skills/**/references/`
and `SKILL.md`. A maintainer pass verifies each one through PubMed
`get_article_metadata` (title, year, journal) or Tavily for non-PubMed sources,
and records results in a committed ledger (same shape as `guideline-registry.yaml`:
source, verification date, status). A Bun test fails when a cited identifier has
no verified ledger entry. MCP calls stay out of CI; the ledger is the evidence.

## 3.2 Claim audit

For each reference file, list its load-bearing method claims (for example
"temperature scaling cannot independently correct calibration-in-the-large",
"Riley criterion 1 bounds shrinkage at 0.9"). Check each claim against the cited
full text with PubMed `get_full_text_article` or Paperclip, and mark it supported,
needs a qualifier, or unsupported. Fix or remove unsupported claims via TDD
content tests.

## 3.3 Numerical golden tests

Reproduce published worked examples as exact-value tests in the skills' bundled
scripts or generated scaffolds:

- Riley development sample size, BMJ 2020 worked example (32188600).
- Riley external-validation sample size, binary outcome (34031906).
- Random-effects meta-analysis on a public dataset (REML, Hartung-Knapp),
  matching published estimates.
- Cumulative incidence under competing risks versus 1 - Kaplan-Meier on a seeded
  dataset (26858290).

Run R and Python where the CI image has them; otherwise skip with a recorded
reason. Decision needed: whether CI should install R.

## 3.4 Library API currency

Use Context7 per release cycle to check every API the scaffolds name
(scikit-learn, statsmodels, lifelines, LightGBM, R packages where indexed). The
ML protocol already reflects scikit-learn 1.6 (`FrozenEstimator` replacing the
deprecated `cv="prefit"` in `CalibratedClassifierCV`). Record version floors in
the reference files and guard version-dependent features in scaffolds.

## 3.5 Guideline freshness sweep

Quarterly PubMed search by entry date for new or updated reporting guidelines
and risk-of-bias tools, plus a Tavily check of EQUATOR. Apply the
newest-version-only rule. Immediate item: evaluate adding PROBAST+AI (40127903)
alongside CHARMS for prediction-model appraisal.

## 3.6 R and Python parity

Where a skill generates both languages (`method-model-choice` has R and Python
cases), run both on the same seeded data and assert matching estimates within a
stated tolerance.

# Sequencing

1. Phase 0 (separate): land `feat/ml-training-protocol` after the maintainer
   confirms two unexplained modified files (`fixtures/aggregate-profile.md`,
   `method-model-choice/references/python-implementation.md`).
2. Phase 1.4 harness scripts first (small, unblocks everything), then 1.1
   sidecar pilot, 1.3 corpus, 1.2 code queries.
3. Phase 3.1 ledger in parallel with Phase 1 (no skill behavior change).
4. Phase 2 cases in the priority order, each using the Phase 1 machinery.
5. Phase 3.2 to 3.6 per skill as each Phase 2 case lands.

# Decisions needed from the maintainer

1. Approve the decision sidecar as the primary grading surface (changes the
   output contract of every covered skill).
2. Approve a tree-sitter WASM dependency for the scorer.
3. Confirm that synthetic-output excerpts may be committed as the phrasing corpus.
4. Decide whether CI installs R for golden tests.
5. Agree the reliability target (pass^3 on hard gates) and the baseline arm cost.
