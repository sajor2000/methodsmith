# CLIF site-to-lead synthesis

## Site contract

Agree a protocol/SAP, analysis code commit, CLIF/mCIDE family, cohort and
phenotype definitions, UTC time origin, exposure contrast, outcome horizon,
variable units, factor references, transformation and missing-data rules before
distribution. A shared schema alone does not establish comparable estimands.
Schema migration is a separate decision, not part of meta-analysis.

The site runs the same local analysis and validates extraction, cohort counts,
model convergence, separation, events per fitted model, uncertainty, and
departures from the requested specification. Keep patient identifiers, detailed
event times, intermediate data, and fitted objects containing training rows
inside its approved environment. No patient data is needed by this skill.

Each returned scalar record needs a stable site/study identifier, synthesis and
analysis version, effect definition, estimate, SE on the same analysis scale,
model/link, adjustment set, reference category, follow-up, status and reason.
The bundle also records code and vocabulary versions, release-review outcome,
independence/overlap assessment, and releasable diagnostics. A multivariable
coefficient vector additionally needs coefficient names/order and a full
variance-covariance matrix. A scalar SE is insufficient for joint inference.

Use natural logs for OR/RR/HR and their SEs. Do not log an SE reported on the
ratio scale. Approximate SE reconstruction from a CI requires the actual scale,
confidence level, distribution and interval construction. Do not treat profile,
bootstrap or exact intervals as Wald intervals by default.

## Lead reconciliation

- Reconcile expected sites against received, failed, suppressed and excluded
  submissions. A missing file is not a site with no events.
- Verify manifests/checksums and specifications. Review departures, not just
  column names. Mixed log-OR, log-RR and log-HR values cannot share one pool.
- Check hospitals contributing to multiple sites, transfers/readmissions and
  repeated data releases. Obtain an overlap assessment without centralizing
  identifiers. An unknown overlap blocks the independent scalar template.
- Keep adjusted and unadjusted effects separate. Conditional logistic ORs can
  differ with adjustment and case mix because of non-collapsibility. Pooling
  them does not recover a common marginal patient effect.
- Prespecify weighting and target. An inverse-variance random-effects mean is
  not automatically the patient-weighted effect across the consortium.
- Review influence and leave-one-site-out results, heterogeneity and protocol
  deviations. A large site can dominate common-effect estimates; random effects
  does not remove site bias or solve transportability.

Release thresholds follow site/consortium policy, including complementary
suppression and differencing risks. A directory named `final_no_phi`, a cell-count floor,
or a coefficient-only file does not certify safe release. Preserve suppression
statuses without enough auxiliary detail to reconstruct protected values.

## Failed models and rare outcomes

Separation or inadequate events needs a planned local model strategy, such as
an appropriate penalized likelihood or a hierarchical method with justified
priors. Report method changes and uncertainty. Do not pool a nonconverged
coefficient, replace it with zero, add an arbitrary continuity correction to
regression coefficients, or average intercepts as a rescue strategy.

Two-stage coefficient meta-analysis, iterative federated likelihood/gradient
optimization, federated averaging of model parameters, and pooling predictive
performance answer different questions. A federated optimizer needs a separate
protocol and implementation. Global intercepts cannot repair missing slopes or
site-specific baseline risks by themselves.

For external model validation, distinguish a locked model from local retraining.
Request discrimination and calibration estimates with appropriate uncertainty,
outcome incidence, evaluation horizon and censoring method, and relevant
subgroup reporting. Do not pool AUCs, calibration slopes/intercepts or Brier
scores as interchangeable effects. Use metric-specific transformations and
variance methods, and document local model versions and recalibration.

## Lead-to-site return

Return input/code versions, the roster and dispositions, the pooled target and
method, weights, local and pooled intervals, heterogeneity, influential-site
results and unresolved queries. Review site-identifying displays under the
consortium agreement. When a global prediction model is requested, separately
deliver the complete equation, encoding/units, baseline risk or hazard,
applicability, local validation and recalibration plan. Statistical pooling alone
does not establish safe deployment or clinical benefit.
