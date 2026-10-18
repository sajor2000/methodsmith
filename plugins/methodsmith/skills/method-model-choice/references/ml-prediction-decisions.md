# Prediction decision sidecar, version 1.0

Write `<slug>-model-strategy.decisions.json` beside every prediction-model
strategy memo, including blocked and provisional recommendations. Follow
`references/ml-prediction-decisions.schema.json`.

Record decisions supported by the current aggregate profile and evidence:

| Field | Meaning |
|---|---|
| `schema_version` | `"1.0"` |
| `status` | The memo's status; human approval remains pending |
| `validation.scheme` | `internal_external_cv`, `nested_cv`, `held_out`, `bootstrap`, or `other` |
| `validation.outer_unit` | Independent outer assessment unit, such as `site` or `patient` |
| `tuning.objective` | Canonical selected score, such as `log_loss` or `brier_score` for binary risk |
| `tuning.inside_resampling` | Whether model selection occurs within development resampling |
| `sample_size.method` | `riley`, `simulation`, or `other`; explain the calculation in the memo |
| `sample_size.inputs` | Aggregate patients, events, and candidate predictors used by the check |
| `calibration.methods` | Planned assessment components; use `calibration_in_the_large`, `calibration_slope`, and `calibration_curve` when applicable |
| `fixture_counts` | Aggregate patients, events, sites, and candidate predictors from the supplied profile |
| `unresolved` | Exact unanswered design questions or approval prerequisites blocking a complete recommendation |

Choose the design from the study, not from an example sidecar. For binary
prediction, select a proper tuning score, log loss or Brier, and keep AUPRC
supplementary. Preserve site boundaries for multi-site internal-external
validation. Keep preprocessing, feature selection, tuning, and recalibration
inside the appropriate training folds.

For blocked or provisional strategies, keep every field present, use JSON
`null` for unknown decisions or counts, and name the missing facts in
`unresolved`. Mirror null decisions as `unknown` in the memo summary. Emit
`code=none` and no scaffold under these statuses. A `ready_for_review` sidecar
requires concrete decisions, known counts, and an empty `unresolved` array;
human review itself is not an unresolved design decision.

Include exactly one plain-text line for each label below in the memo. Use
canonical values from the corresponding sidecar fields, not display synonyms
or Markdown tables. The status line already required by the main skill counts;
keep it once rather than repeating it in the summary.

```text
Status: <status>
Validation scheme: <validation.scheme>
Outer validation unit: <validation.outer_unit>
Objective: <tuning.objective>
Tuning inside resampling: <true|false|unknown>
Sample-size method: <sample_size.method>
```

Before emitting the existing handoff, check that these six lines agree with
the JSON, all aggregate counts agree with the supplied profile and memo, and
the calibration plan agrees with `calibration.methods`. Keep the narrative
rationale, sample-size calculation, evidence ledger, and independent scaffold
checks: a sidecar declaration is not proof of code behavior or clinical validity.
