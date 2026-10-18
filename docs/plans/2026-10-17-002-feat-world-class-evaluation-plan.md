---
title: Make methodsmith evaluations and methods content verifiably world-class
status: in_progress
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

Pilot implementation (local, 2026-10-18): `method-model-choice` adds a
skill-local version-1.0 schema and ML-only sidecar instructions. The prediction case
adds strict JSON gates plus six anchored memo-agreement checks using `json_one_of`
and `json_text_equals`. Existing prose, aggregate-count, and scaffold gates remain
independent. Log loss and Brier are both valid. This is not a general JSON Schema
validator or semantic contradiction detector; code-structure work remains deferred.

Three-run pilot evidence:

- Runner: skill-creator fresh-context injection through `droid exec`; model
  `gpt-6-sol`, medium reasoning, isolated run directories, only Read/ApplyPatch.
  All three local transcripts were inspected: separate session IDs, current
  sidecar references read, writes confined to each run, no study-model fitting or
  network tools. No baseline arm or description-trigger experiment was run.
- Run IDs: `ml-sidecar-pilot-20261018-7c2f-{1,2,3}` under the behavioral-evals
  temp root. Frozen case/prompt/whole-skill hashes are identical:
  - Case: `830221fc3a70a26a3452a593cd6b7fe05b4e3d01b82dc34c46c12d6bad6ca813`
  - Prompt: `a5a9c0812d0541f479cf7990ec003deb615720deef95ab2582c854f1005e68bb`
  - Target: `d04d21c23ec97ee415cdcd7077afaa5e33c335c122e2009b8a004474968c40cb`
- Every new sidecar/memo-agreement gate passed in all three runs. Scores were
  91/94, 94/94, and 94/94. Overall and combined hard-gate pass rates are 2/3;
  their `pass^3` estimates are 0. Mean score is 93/94. Credential scans passed 3/3.
- Run 1 failed only `scaffold-tuning-inside-resampling`. Its outer loop passes
  training-site subsets to a tuning helper across a multiline function call;
  the existing regex does not recognize that layout. Preserve this failed
  outcome rather than loosening the regex or editing frozen evidence. This
  observation is not a certification of the scaffold's other code semantics.
  The next evaluation improvement is section 1.2's structural checker.
- Aggregate evidence: `/tmp/methodsmith-sidecar-pilot-report.json`. Manifest
  SHA-256 values, in run order:
  - `6b52c8f9f0a8a6028769cd78116f19589138c66fda224b461ced13e66681be11`
  - `043537838e9e41b8498ba0b7899ad3af9a268e22fcfb2c4773819d78c088112b`
  - `51fd5d7e444d78932ab04894de4cd3644f967d3e605ef19ab728872a67a9fac0`
- Deterministic validation: `bun test --timeout 30000` gave 1,681 pass,
  11 skip, 0 fail across 116 files. Typecheck, all 30 cases, release metadata,
  and whitespace checks passed; read-only code review found no actionable bugs.
  Earlier attempts hit a 120-second command limit and a five-second installer
  test limit; the isolated installer check passed. JSON syntax and local schema
  references were checked, but no general JSON Schema validator was installed.
- The ML sidecar slice is implemented, not a product-wide reliability claim.
  Retain all three runs: the complete batch is not all-pass. Changes remain
  uncommitted on `feat/eval-prepare`; no publishing or release action occurred.
- Final Jev gate: `escalate`, composite 0.6535, `safe_to_apply` 0.39;
  correctness confidence 0.10. It marked the test count unsupported and two
  run-summary claims contradicted. Preserve the original input and response at
  `/tmp/methodsmith-sidecar-gate.json` and
  `/tmp/methodsmith-sidecar-gate-result.json`; no retry was made.
- At the user's request, a separate read-only reviewer audited all five claims.
  The audit supports them, reproduced the aggregate JSON exactly, and checked
  all run/report/manifest bindings, 12 scored-artifact hashes, fixtures, input
  hashes, and distinct saved model sessions. All 16 new gate IDs occur once per
  run and pass. The sent Jev evidence contains the disputed counts and is
  within documented size bounds (`truncated:false`), but omits the literal test
  command/exit record, fresh-session metadata, and per-run reports tying the
  sole failure specifically to run 1. These are evidence-packaging limitations;
  they do not explain Jev's numerical disagreements. The audit establishes
  factual reporting, not all-pass behavioral acceptance, scaffold correctness,
  or statistical independence.

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

**Implemented and piloted locally; sign-off is blocked by the final evidence gate's escalation.**
The registered `code_query` rule is `tuning_inside_resampling`, with explicit `python`/`r`
language selection. Exact dependencies are `web-tree-sitter@0.27.1`,
`tree-sitter-python@0.25.0`, and `@davisvaughan/tree-sitter-r@1.3.0`. Both shipped
WASM grammars load and parse committed smoke fixtures with native lifecycle scripts disabled.

- TDD stayed at `scoreEvaluationRun` and `loadAndValidateCase`. Current focused results:
  81 tests pass, zero fail across the scorer contract and ML case suites.
- Before retiring the regex, the compliant case fixtures and all ten r5–r14 archive copies
  passed the structural gate; all three sidecar-pilot copies also passed, including the
  multiline helper layout. The current repeat remains 13/13. Probe:
  `/tmp/methodsmith/code-query/parity.ts`; evidence:
  `/tmp/methodsmith/code-query/parity-latest.jsonl`. Every copied source's original hash
  was checked unchanged. These are structural compatibility probes, not new behavioral
  evaluations or changes to historical grades.
- Read-only review `a7ed1207-3c78-404a-ad9a-2a5cfa3909d1` found seven actionable
  gaps: selection-loss provenance, reassigned indices, callable bindings, unused candidate
  arguments, inline grids, R parameter commas, and annotation-only assignments.
  Each received a public-seam red-to-green regression and fix. Follow-up regressions also
  cover global callable replacement, nondominating aliases, and cross-helper scope.
  The reviewer has not performed a second post-fix review.
- The original criterion ID/weight remain unchanged. The guide documents the deliberately
  bounded Python/R API shapes and the limits of static evidence. No source is executed.
- Prior pilot failures and the earlier Jev escalation remain intact. This is not an
  all-pass batch, product-wide acceptance verdict, or statistical-correctness proof.
- Full deterministic validation: `bun test --timeout 30000` exited 0 with **1,700 pass,
  11 skip, 0 fail** (1,711 tests, 116 files). Evidence:
  `/tmp/methodsmith/code-query/full-tests.log`. Typecheck, all 30 behavioral cases,
  release metadata, and `git diff --check` also passed.

Fresh structural pilot (2026-10-18):

- Runs: `ml-structural-pilot-8d31-{1,2,3}`, prepared with identical frozen inputs:
  - Case: `cdf8a3636c9ddbc114c20f4cf5616dec0cb49244b124e6b4f8b7e6890df4ed37`
  - Prompt: `a5a9c0812d0541f479cf7990ec003deb615720deef95ab2582c854f1005e68bb`
  - Target: `d04d21c23ec97ee415cdcd7077afaa5e33c335c122e2009b8a004474968c40cb`
- Runner: current-source skill-creator injection into three separate `droid exec`
  invocations, `gpt-6-sol`, medium reasoning, isolated working directories, only
  Read/ApplyPatch model tools (plus the Script wrapper). All runners exited 0.
  Saved transcripts show distinct session IDs, reads of the current sidecar
  reference/schema, and writes confined to each run. No model-issued execution or
  network tools appear. The configured SessionStart telemetry hook also ran; that
  is separate from the model's tool activity. Separate contexts do not prove
  statistical independence.
  - Run 1 session: `b2532aea-4712-46de-aff4-e85eeacd3b6a`
  - Run 2 session: `0b1d0bc3-9412-4e2a-80fa-472f0a932c06`
  - Run 3 session: `73b84c51-49c2-4236-a512-2ff7621a3337`

| Run | Score | Hard gates / overall | Structural gate | Failed criterion |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 94/94 | pass | pass | none |
| 2 | 92/94 | fail | pass | `proper-tuning-objective` |
| 3 | 94/94 | pass | pass | none |

- All 16 sidecar/memo gates and credential scans passed 3/3. Overall and combined
  hard-gate pass rates are 2/3, and their `pass^3` estimates are 0. Mean score:
  93.33333333333333/94. This small synthetic batch does not establish reliability.
- Run 2's memo explicitly says "Minimize inner-fold log loss" and declares
  `Objective: log_loss`, consistent with its sidecar. The pre-existing prose regex
  does not recognize that ordering: it recognizes minimize after the scoring rule,
  but not before it. Preserve the 92/94 failure. No criterion, response, or frozen
  input was edited to make this batch pass.
- Aggregate evidence: `/tmp/methodsmith/code-query/pilot-report.json`.
  Separate framework/WASM fingerprints: `/tmp/methodsmith/code-query/framework-sha256.txt`.
  Manifest SHA-256 values, in run order:
  - `7f9e6cf2ae9b647951d3b87fb8c77ed31daa2c05fcbb7ed8a5501d715886b2f0`
  - `bfe2b3e27e14cd14222c2d8a324018f06e52e8fbc694cfe2604f0f93f48534de`
  - `03f806754c6419d70b9394788beba8190524fe11a9e258e336491fbe7519ff75`
- No baseline arm, description-trigger experiment, model fitting, or general
  JSON Schema validation was performed. Changes remain uncommitted; no publishing
  or release action occurred.
- Final Jev gate: **escalate**, composite **0.738**, `safe_to_apply` **0.19**.
  It returned `truncated:true`, `incomplete_context`, and low review confidence;
  `test_gap` was the limiting rubric (confidence 0.20). All six factual claims
  received `verified` verdicts, with zero contradicted or unsupported, but all six
  remain action `review` and the overall patch is not approved. The submitted
  production diff was 45,162 characters and evidence totaled 174,792 characters;
  no input-size compliance or complete-context verdict is claimed despite those
  local counts. Preserve `/tmp/methodsmith/code-query/gate.json` and
  `/tmp/methodsmith/code-query/gate-result.json`. No retry was made. Stop sign-off
  for human review; do not use the verified factual summaries as patch approval.

Add a criterion type `code_query` that parses Python and R scaffolds with
tree-sitter (`web-tree-sitter` WASM with `tree-sitter-python` for Python and
the r-lib grammar `tree-sitter-r`, published on npm as
`@davisvaughan/tree-sitter-r`, for R) so CI needs neither a Python nor an R
runtime. Build or vendor a `.wasm` for each grammar and pin both versions. The first rule replaces the regex gate:
a tuning call, or a call to a top-level function whose body tunes, sits inside
a resampling loop and receives that loop's training index. It should follow
helper calls one level deep.

- TDD at `scoreEvaluationRun`: parity with the current regex is required only
  on compliant inputs (the compliant case fixtures and the r5 to r14
  scaffolds); the new criterion must accept all of them before the regex is
  retired.
- Adversarial inputs are asserted separately and must be rejected on their
  own terms, not by agreement with the regex: tuning on the full data before
  or inside the outer loop, a tuning helper fed the held-out index, a
  fit-only helper that refits a fixed hyperparameter, and an inner tuning loop
  standing in for outer-fold tuning. The regex is known to accept some leaky
  shapes (for example, a tuning helper called inside a calibration cross-fit
  while the outer loop is leaky), so agreement there is not a goal.
- Validation in `eval:validate`: the query parses, the referenced language is
  supported, and both grammars load by parsing a small committed Python
  fixture and a small committed R fixture.
- Decision approved: pinned WASM dependencies for this scorer slice.

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
  Implemented via `bun run eval:prepare`; run `--complete` after dispatch to record
  the response modification time without changing frozen input digests.
- `scripts/evals/report.ts`: aggregate `evaluation.json` across runs into
  pass^k (probability that all k runs pass; tau-bench, Sierra) and mean score,
  per case and per gate.
  Implemented via `bun run eval:report --run-dir <path> [--run-dir <path> ...] --k 3`.
  Groups preserve frozen inputs, model, and runner; insufficient repeats produce
  `null`. A local smoke check of 14 archived synthetic runs found eight separate
  groups, none with three repeats. Fresh runs remain necessary for pass^3 estimates.
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
2. Approved: pinned tree-sitter WASM dependencies for the scorer (section 1.2).
3. Confirm that synthetic-output excerpts may be committed as the phrasing corpus.
4. Decide whether CI installs R for golden tests.
5. Agree the reliability target (pass^3 on hard gates) and the baseline arm cost.
