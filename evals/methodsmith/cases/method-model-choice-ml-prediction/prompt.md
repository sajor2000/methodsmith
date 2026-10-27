Use the injected `method-model-choice` instructions with
`workspace/aggregate-profile.md language:python`. The fixture contains frozen,
synthetic aggregate design facts and evidence; treat it as the available
evidence map and do not attempt to load another skill or access the network.

The study team asks for the full training and validation protocol before any
code is written: split and cross-validation design, the tuning plan, the
primary metric at this outcome prevalence, calibration, and how the
explainability figures will be produced.

Use the stable slug `sepsis-48h`. Write the memo and, only if permitted by the
status gate, one Python scaffold under `workspace/analysis/model-strategy/`.
Include the prediction decision sidecar required by the skill.
Keep the scaffold's training/assessment data flow easy to audit: iterate directly
over the splitter outputs or a cached list of those split pairs. Keep preflight
checks separate, without replacing the assessment iterator with enriched fold records.
Keep library imports at module scope so their bindings are visible during review.
Save the complete user-facing response to `response.md` and emit the terminal handoff.
