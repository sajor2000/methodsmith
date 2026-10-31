# Question Bank

## Contents

- Goal
- Task and deliverable
- Hypothesis
- Data
- Proposed analysis
- Target journal
- Audience

Each branch lists the probes to draw questions from, what a strong answer looks like, and red flags that need a follow-up or an open-risk entry. Ask only the probes the gathered facts leave open.

## Goal

- **Probes:** What decision changes if the result is positive? If it is null? Who acts on it (clinicians, administrators, policymakers, other researchers)? Why does it matter now? Is the aim descriptive, predictive, or causal?
- **Strong answer:** Names the decision and the actor, and states what a null result would still teach.
- **Red flags:** The goal is "to explore" with no decision attached; descriptive, predictive, and causal aims mixed in one question; only a positive result would be publishable.

## Task and deliverable

- **Probes:** What should be produced, who will use or execute it, what counts as success, and which data access, resource, or timing constraints matter?
- **Strong answer:** Names the deliverable, consumer, acceptance criteria, and material constraints.
- **Red flags:** The requested artifact cannot answer the aim, acceptance criteria are unclear, or access is assumed without confirmation.

## Hypothesis

Adapt this branch to the aim: for prediction clarify target, prediction horizon, intended use, and performance criteria; for descriptive work clarify the question and quantities to estimate. Do not require a directional causal hypothesis for either.

- **Probes:** Population, exposure or intervention, comparator, and outcome (PICO/PECO)? Time zero and follow-up window? For causal aims, expected direction and a clinically meaningful difference? Primary versus secondary outcomes? What result would falsify it?
- **Strong answer:** For causal aims, one primary hypothesis, a defined time zero, a stated direction, and a minimal clinically important difference. For prediction or descriptive aims, the target or question and the criteria named in the adaptation above.
- **Red flags:** Several co-primary outcomes; an outcome defined with information from after time zero; a comparator that is "everyone else"; no falsifying result.

## Data

- **Probes:** Source and provenance (EHR, claims, registry, trial, omics)? Unit of analysis and grain? Approvals in place (IRB, DUA, data steward)? Is this environment approved for PHI? Expected cohort size and event count? Coverage gaps, missingness, and measurement validity of the exposure and outcome (validated phenotype, chart review, PPV; look up published validation studies by PMID before asking)? Does the data cover the full time window?
- **Strong answer:** Names the source, the grain, the approval status, an approximate event count, and how exposure and outcome are measured and validated.
- **Red flags:** Exposure or outcome from unvalidated codes; events too few for the planned model; enrollment gaps or left truncation not addressed; data access not yet approved; a plan to "get the data later".

## Proposed analysis

- **Probes:** Study design (cohort, case-control, trial, target trial emulation)? Estimand (population, treatment strategies, outcome, intercurrent events, summary measure)? Confounders and the causal assumptions behind them? Missing-data mechanism and plan? Multiplicity across outcomes and subgroups? Prespecified sensitivity analyses? Sample size or power justification?
- **Strong answer:** One estimand stated in full, a confounding strategy tied to assumptions, a missing-data plan, and a power or precision justification grounded in prior evidence cited by PMID (prior event rate or effect size), not an assumed figure.
- **Red flags:** Immortal time bias; adjustment for mediators or colliders; complete-case analysis by default with heavy missingness; subgroup fishing; model choice made before data QA; power assumed rather than justified.

## Target journal

- **Probes:** Which journal, and a backup? Article type and its word, reference, and display-item limits? Required reporting checklist (CONSORT, STROBE, RECORD, TRIPOD+AI, and so on)? Preregistration requirement? Data and code sharing policy? Has the journal published similar work recently (check with the PubMed search tool and the journal name, not the user's memory)?
- **Strong answer:** A primary and a backup journal, the matching checklist, and limits that the planned outputs fit.
- **Red flags:** No backup; planned tables and figures exceed the limits; a trial or prediction model with no registration or required checklist; a data-sharing policy the DUA cannot meet.

## Audience

- **Probes:** Who must believe this result? What do they already believe? What would make them change practice? What will the first hostile reviewer attack (confounding, generalizability, data quality, novelty)? What figure or table would convince a skeptic?
- **Strong answer:** Names the audience, the prior belief being challenged, and the single most likely reviewer objection with a planned answer.
- **Red flags:** The audience is "everyone"; no anticipated objection; novelty claimed without a literature check; a generalizability limitation the audience cannot accept.
