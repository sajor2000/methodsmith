# BCG meta-analysis — the methodsmith demo project

One committed, reproducible demo answering issue #144: a public-data meta-analysis
with its real outputs checked in, so a newcomer can see exactly what the plugin
produces before installing anything.

## What it is

`analysis.R` runs a meta-analysis of the 13 randomized BCG vaccine trials shipped
with metafor (`dat.bcg`) — the classic public dataset; no PHI, no patient-level
data anywhere. It registers per-trial log risk ratios, fits the prespecified
primary model (REML with a Knapp-Hartung adjustment), reports the prediction
interval, and treats the allocation-method subgroup as descriptive. The outputs
in `output/` were produced by one run of that script and are committed:

- `output/effects.csv` — per-trial effects and 95% CIs (the display backing the text)
- `output/summary.md` — the headline numbers and reading notes
- `output/forest.png` — the forest plot

## How it maps to the plugin workflow

The demo is the artifact the plugin's drafting lane produces; the mapping:

1. `method-question` — fix the question (does BCG prevent TB?) and the estimand
   (log risk ratio, vaccinated vs. unassigned) before any analysis.
2. `method-plan` — the prespecification: REML + Knapp-Hartung, prediction interval,
   subgroup declared descriptive; the script's comments carry the SAP role.
3. `method-meta-analysis` — the `rma()` fit itself, with the small-study safeguards
   (HK adjustment, prediction interval) the skill insists on.
4. `method-write` — `output/summary.md` follows the drafting standard: continuous
   prose, ordered enumeration, no bullet points in the manuscript text, no AI
   hedging, numbers quoted from the run.
5. `method-review` — the honest-reading pass: heterogeneity is reported through the
   prediction interval rather than smoothed away, and the subgroup is never allowed
   to make a confirmatory claim.

## Reproduce

```
Rscript analysis.R
```

Requires R with metafor (4.x). The script is deterministic: same inputs and
package version, same outputs, seed fixed for anything stochastic.

## Honest limitations

- The committed outputs are real and rerunnable, but this demo exercises the
  analysis-and-reporting lane only; a full live pass of the review skills
  (model calls) is not committed — the repo's eval policy keeps model traces out.
- The BCG dataset is a teaching classic: 13 trials, 1948-1955, substantial
  heterogeneity. The demo's scientific content is deliberately unremarkable.
- The subgroup analysis is descriptive by construction; with this k it has no
  power for a confirmatory claim, and the summary says so.
