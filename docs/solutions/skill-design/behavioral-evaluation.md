# Reproducible Behavioral Evaluation

Use the repository-owned behavioral evaluation layer when a skill or agent change can alter what
the model does but static content assertions cannot prove the intended behavior. The pilot covers
`method-doc-review` and `method-data-qa`.

## Design

Each case under `evals/methodsmith/cases/` freezes:

- the target skill or agent source;
- a user-shaped prompt and synthetic or seeded fixtures;
- required and prohibited behaviors;
- weighted outcome criteria and hard safety gates;
- a passing threshold and explicit limitations.

The scorer checks observable outputs and artifacts. It does not require a particular hidden
reasoning path or tool sequence unless that sequence is itself a published contract. Every hard
gate must pass, the credential scan must pass, and the weighted score must meet the case threshold.

Deterministic validation and live evaluation are intentionally separate:

- `bun run eval:validate` checks case structure, paths, fixture hashes, criterion references, and
  thresholds. It is safe for normal CI.
- `bun run eval:prepare` creates a new run directory, copies the declared fixtures, freezes input
  digests, and writes a dispatch prompt. Its `--complete` mode records the response file's
  modification time as `completed_at`. Neither mode calls a model.
- `bun run eval:score --case <id> --run-dir <path>` scores an already-completed run without calling
  a model. It writes `evaluation.json` and `manifest.json`.
- `bun run eval:report --run-dir <path> [--run-dir <path> ...]` aggregates explicitly selected
  scored runs without calling a model or changing stored evidence.
- `skill-creator` supplies the fresh-context model run. Do not use typed plugin dispatch from an
  existing session because plugin skill and agent definitions are cached at session start.

## Run Layout

Keep every live run under:

```text
/tmp/methodsmith/behavioral-evals/<run-id>/
├── run.json
├── dispatch.md
├── response.md
├── workspace/
├── evaluation.json
└── manifest.json
```

## Prepare and Complete a Run

From the repository root:

```bash
bun run eval:prepare --case method-model-choice-ml-prediction \
  --run-dir /tmp/methodsmith/behavioral-evals/ml-prediction-01 \
  --runner skill-creator --model "<actual model identifier>"
```

Record the runner and model actually used, not placeholder values. The command validates the
requested case, copies every fixture to its declared destination, and creates `run.json` with
pre-dispatch digests and `completed_at: null`. It also writes `dispatch.md`, which injects the
current target instructions and frozen prompt without exposing the grading criteria. Dispatch
that prompt through `skill-creator` in an independent fresh context. The generated prompt names
the reference directory and response path and preserves the case's offline or forward mode.

After the runner has finished writing the response and requested artifacts:

```bash
bun run eval:prepare --run-dir /tmp/methodsmith/behavioral-evals/ml-prediction-01 --complete
bun run eval:score --case method-model-choice-ml-prediction \
  --run-dir /tmp/methodsmith/behavioral-evals/ml-prediction-01
```

Completion reads the response file's modification time, not the time the completion command
runs. It rejects missing, empty, or stale responses and paths that escape the run directory.
It fills only a null `completed_at`; repeating the command preserves an existing valid
completion timestamp. It never refreshes input digests, so source drift still fails scoring.
There is no background watcher: call `--complete` after the runner finishes, before scoring.
The file timestamp is a local filesystem observation, not proof of a model's execution time.

Preparation refuses existing run directories rather than overwriting prior work. If preparation
fails after creating files, inspect that directory and use a new run ID for the next attempt.

`run.json` uses this contract:

```json
{
  "schema_version": "1.0",
  "case_id": "method-data-qa-pre-sap",
  "case_sha256": "SHA-256 captured before dispatch",
  "prompt_sha256": "SHA-256 captured before dispatch",
  "target_sha256": "SHA-256 captured before dispatch (whole-directory digest for a SKILL.md target)",
  "runner": "skill-creator",
  "model": "record the actual model",
  "started_at": "ISO-8601 timestamp",
  "completed_at": "ISO-8601 timestamp",
  "output_path": "response.md"
}
```

Prepare the workspace by copying each fixture to the `destination` declared in the case manifest.
Before dispatch, hash the case YAML, prompt, and target source and record those digests in
`run.json`. The target digest is not a single-file hash: for a `SKILL.md` target it covers every
file in the skill directory (sorted relative path plus per-file SHA-256), because most scored
literals live in the skill's `references/` files and a single-file hash would let them drift
without invalidating the run. The scorer computes this digest with `sha256Target()`; record it
before dispatch, not by pasting the value the scorer reports back — a digest captured only after
seeing the scorer's output attests nothing. Run the case prompt through `skill-creator`, injecting
that target source from the current checkout. Save the complete user-facing response and any
requested artifacts, then run `eval:score`. Scoring rejects the run if any pre-dispatch digest
differs from the current file.

> **Migration note (whole-directory target digest).** `target_sha256` for a `SKILL.md` target is
> now the whole-directory digest, not the single-file hash it used to be. Any `run.json` recorded
> before this change carries the old single-file value and will fail scoring with a
> `run target_sha256 ... does not match current ...` error. This is intentional fail-closed
> behavior — re-record the affected runs against the current checkout rather than editing the
> stored digest by hand.

The scorer canonicalizes the repository and run paths before reading them, so a symlink cannot
escape the repository or `/tmp/methodsmith/behavioral-evals` roots. It snapshots `run.json`, the
primary output, the case, prompt, target, fixtures, and every unique scored artifact exactly once.
The report and manifest hashes are derived from those immutable bytes. Both output files are fully
written and synced to same-directory temporary files before publishing starts. The publisher then
renames `evaluation.json` first and `manifest.json` last; a failure before the first rename leaves
the previously published pair unchanged. Each rename is atomic and replaces a pre-existing output
symlink rather than following it. The two renames are not a single cross-file transaction, so an
operating-system failure between them can still require rerunning the scorer.

## Aggregate Repeated Runs

```bash
bun run eval:report \
  --run-dir /tmp/methodsmith/behavioral-evals/ml-prediction-01 \
  --run-dir /tmp/methodsmith/behavioral-evals/ml-prediction-02 \
  --run-dir /tmp/methodsmith/behavioral-evals/ml-prediction-03 \
  --k 3
```

The command writes JSON to stdout. Select the complete predeclared batch, including failed runs;
it does not discover a batch automatically. It reports run counts, observed pass rates, mean
weighted scores and score ratios, combined hard-gate reliability, credential-scan counts, and
per-gate pass/failure counts.

Groups stay separate by case ID, case digest, prompt digest, target digest, runner, and model.
Within a group the target metadata, scoring threshold, and gate contract must agree. The command
checks the manifest's report hash, its shared fields, the run metadata hash and bindings, and the
primary response hash. It rejects repeated canonical paths, symlink aliases, and copied runs with
identical frozen run metadata. It fails the entire command on invalid input rather than silently
discarding a failed or damaged run. Exit code 0 means the report was generated, **not** that the
evaluated skill passed.

For `n` runs with `s` successes, `pass_k` is `C(s,k) / C(n,k)`, computed as a product rather than
factorials. Under independent repeats of a frozen setup this estimates the probability that all
`k` attempts pass; it is not the probability that at least one attempt passes. The same estimator
is reported for combined hard gates and each individual gate. The default `k` is 3:

- Three passing runs and one failure give `pass_k = 0.25` at `k = 3`.
- Fewer than `k` runs give `null`, not a perfect-reliability estimate.
- At `k = 1`, the estimate equals the observed pass rate.
- A credential-scan failure can fail the overall run even when every hard gate passes.

Hashes detect drift in the checked files; they are not signed attestations or proof that model
contexts were independent. Reporting does not re-score criteria, inspect every secondary
artifact, or require historical inputs to match the current checkout. Small samples, selected
batches, and synthetic-only cases cannot establish product-wide reliability. No baseline arm,
lift measurement, live model run, or acceptance target is implied by generating a report.

## Acceptance Policy

For a material behavioral change to a covered target:

1. Update or add a case when the intended behavior changed.
2. Run `eval:validate` and the deterministic Bun test suite.
3. Run each affected case twice in independent fresh contexts through `skill-creator`.
4. Require identical hard-gate outcomes across both runs. A passing weighted score cannot override
   a hard-gate failure.
5. Report sanitized scores, failed criterion IDs, model identifier, pre-dispatch digests, and
   manifest hashes in the pull request.

Do not commit live run directories, raw private prompts, complete model traces, credentials, PHI,
or patient-level data. Committed fixtures must be synthetic or explicitly seeded test documents.
Evidence manifests demonstrate what was evaluated; they do not establish real-world clinical,
statistical, or production validity.

## Case Authoring Rules

- Prefer deterministic facts, evidence IDs, invariant safety boundaries, and post-run artifacts.
- Use `code_query` with `language: python` or `language: r` and the closed named
  `query: tuning_inside_resampling` for supported training-scaffold structure. `query` is a
  registered rule, not arbitrary tree-sitter source. Validation rejects unknown names and
  languages, loads both pinned grammars, compiles their loop queries, and parses committed
  smoke fixtures. Runtime and grammars are exact devDependencies: `web-tree-sitter` 0.27.1,
  `tree-sitter-python` 0.25.0, and `@davisvaughan/tree-sitter-r` 1.3.0. Their shipped WASM
  assets resolve relative to the module, without native package builds or Python/R interpreters.
  Source artifacts use the same snapshot, digest, containment, and credential checks as other
  scored text. Invalid source syntax fails the gate without executing source.
- Use `json_one_of` for an allowed JSON value. Supply a nonempty `expected` array and a dotted
  `json_path`; comparisons use strict deep equality, so a string is not interchangeable with a
  number or boolean. Missing fields fail.
- Use `json_text_equals` to compare a JSON scalar at `json_path` with capture group 1 of
  `pattern` in the run-relative `text_path`. Exactly one match must exist. Captured text is
  trimmed and compared to the scalar's string form, case-insensitively unless `case_sensitive`
  is true. Objects, arrays, and null do not match. Both artifacts are snapshotted, hashed, and
  credential-scanned, including a text artifact used only by this comparison.
- Use `regex_not` for deterministic prohibited language whose acceptable negations cannot be
  represented safely by a literal substring check. Author the regular expression so explicit
  negations remain valid; the scorer passes only when the expression does not match.
- Use `claim_absent` when a prohibited assertion has bounded, reviewable subject and claim terms.
  The scorer uses a deterministic clause grammar rather than general language parsing. Periods,
  question marks, exclamation marks, semicolons, commas, and en/em dashes end subject ownership. A
  colon carries ownership only when its left side consists solely of a configured subject, as in
  `The trial design: regulator-ready`. `but`, `however`, `yet`, and `and` carry the prior subject
  only when the following text starts with a supported predicate verb (`is`, `are`, `was`, `were`,
  `has`, `have`, `had`, a modal, `require`, or `need`). The adversatives `but`, `however`, and `yet`
  also carry ownership when the next clause begins with a configured claim, optionally preceded by
  `also`, to cover elliptical predicates such as `not validated but regulator-ready`; a preceding
  semicolon always prevents that carry. Within each resulting clause, the scorer requires a
  configured subject before the claim or an explicitly carried subject, then evaluates negation,
  qualification, temporal or conditional prerequisites, and negated reporting frames in that same
  clause. Bare `that` owns a claim only when a supported predicate follows it, so a complementizer
  such as `confirmation that an approved protocol exists` does not become the claim subject.
  Qualified predicates include `has to be`, `needs to be`, and `must` or `should` with up to two
  supported adverbs before `be`. `not only`, `not merely`, and `not just` are contrastive frames,
  not ordinary negations. Keep subject and claim lists literal and narrow, and use the single
  `negation_pattern` only for explicit disclaimers.
  Negated reporting frames include instructions not to use a measure and evidence that does
  not establish a claim; contrastive "not only" frames remain affirmative.
- Use numeric tolerances only where formatting or floating-point representation can vary.
- Make prohibited behaviors hard gates when violating them could silently mutate data, expose
  sensitive text, invent analysis results, or bypass required user judgment.
- Keep prompts user-shaped and omit expected answers so forward tests do not leak the scoring key.
- State limitations narrowly. A synthetic aggregate-data pass is not evidence of patient-data
  readiness, privacy compliance, or general agent quality.

### ML-only decision-sidecar pilot

Prediction strategies from `method-model-choice` add a version-1.0
`<slug>-model-strategy.decisions.json` beside the memo. The contract and JSON Schema live inside
that skill's `references/`; other model branches, scaffold status rules, and the terminal handoff
are unchanged. Unknown decisions use null under blocked/provisional status, with exact unresolved
questions and no scaffold. This fixture has complete inputs and expects `ready_for_review`.

The ML prediction case retains every existing prose/scaffold gate and adds strict JSON gates for
version, status, site-aware validation, a proper tuning score (log loss or Brier), tuning inside
resampling, Riley inputs, calibration components, frozen counts, and unresolved decisions. Six
canonical memo rows are checked for agreement with the JSON. Memo counts remain independently
bound to the frozen fixture by the existing count gates.

These sidecar gates are not a general JSON Schema validator, semantic contradiction detector, numerical
sample-size verifier, or code parser. The schema documents the wider skill contract; this pilot
checks the explicitly declared fields. A declaration cannot prove correct scaffold implementation.
Malformed JSON or a missing primary criterion artifact aborts scoring, preserving the scorer's
existing fail-closed contract. A missing secondary comparison artifact fails its gate. Historical
run digests must not be rewritten to make old outputs eligible for the new contract.

### Bounded scaffold structure

The ML prediction case replaces its scaffold-tuning regex with `code_query`, retaining the
criterion ID, weight, and hard-gate status. Python support covers `.split(...)` assessment loops,
`list`/`enumerate` wrappers and precomputed split aliases; array and `.iloc` row subsets,
`.take` and explicit subset helpers, and simple dataclass bundles. Imported sklearn
`GridSearchCV`/`RandomizedSearchCV` fits and explicit log-loss/Brier grid selectors count as
tuning. Manual selectors must vary the fitted estimator, select by comparison or a loss-series
`min`/`argmin` family, and keep both candidate-fit and selection-loss observations in the
outer training partition. Fit-only names never establish tuning. Calls into a top-level helper
and one further helper are followed; checked-fit wrappers preserve search-estimator bindings.
Python `.fit()` calls unwrap named arguments. Helper parameters resolve by keyword name when
supplied, including reordered keyword arguments, and otherwise by position.
R support is narrower: `folds$splits`, `rsample::analysis` versus `rsample::assessment`,
`rsample::vfold_cv`/`group_vfold_cv`, and qualified `tune::tune_grid`/`tune_bayes` calls,
directly or through top-level helpers.

Every recognized assessment loop doing model work needs its own training-only tuning evidence.
A nested calibration/resampling loop, whether inline or reached through a supported helper, is
not counted as a separate assessment when every fit's data can be traced to the enclosing
loop's training partition. The enclosing assessment still needs its own tuning evidence.
Full-data, held-out, or unproven nested work remains an assessment candidate; an unrelated
compliant calibration loop cannot rescue a leaky outer loop. Preflight-only loops and inner
loops inside a manual search are not outer assessments. Evidence contains source line numbers
and partition classifications, not source excerpts.

This is bounded static evidence, not a type checker, interpreter, complete control-flow or
interprocedural analysis, or a guarantee against every leakage pattern. Unknown branches,
dynamic dispatch, monkey-patching, arbitrary libraries, and unsupported loop/data-container
forms need human review. Only the registered API/AST shapes are checked. Passing does not prove
correct objective arithmetic, sufficient inner validation, proper downstream use of the selected
model, correct calibration, or clinical validity. Unsupported compliant layouts may fail.
Archive compatibility was checked on isolated copies through `scoreEvaluationRun`, not by
rewriting original run digests or regrading published reports.

The ML fixture requests module-level imports and explicit assessment loops over splitter
outputs or cached split pairs. A loop over enriched records assembled by a separate preflight
loop remains unsupported. Its acceptance claims are limited to that declared layout.

This pattern adapts the frozen protocols, objective scoring, synthetic health-data cases, and
hash-based evidence used in
[`bojieli/ai-agent-book`](https://github.com/bojieli/ai-agent-book), especially its
[agent-evaluation chapter](https://github.com/bojieli/ai-agent-book/blob/main/chapter6/README.en.md),
[chapter 6 evaluation write-up](https://github.com/bojieli/ai-agent-book/blob/main/chapter6/README.en.md) (the original public-health-reporting-eval directory is no longer in the repository),
and [skill experiment protocol](https://github.com/bojieli/ai-agent-book/blob/main/chapter2/agent-skills-ppt/experiment_protocol.json).
The Methodsmith implementation and fixtures are original and use the external repository as conceptual
grounding only.
