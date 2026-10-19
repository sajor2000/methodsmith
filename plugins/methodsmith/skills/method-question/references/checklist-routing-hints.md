# Checklist Routing Hints

Default mapping from `suggested_design` → primary EQUATOR checklist. This is a *hint* written into `analysis/research-question.yaml`; the authoritative routing decision still happens in `method-checklist`. Hints exist so users without checklist expertise still get a sensible default and `method-checklist` can pre-fill its routing answers.

| Design | Primary | Common extensions |
|--------|---------|-------------------|
| RCT (no AI) | CONSORT (2025) | SPIRIT 2025 + SPIRIT-Outcomes 2022 (protocol), CONSORT-CLUSTER (cluster RCT), CONSORT-ADAPTIVE (adaptive), CONSORT-NOF1 (N-of-1), CONSORT-NPT (non-pharmacological), CONSORT-Harms, TIDieR (intervention description), CONSORT-Outcomes 2022 (outcome reporting) |
| RCT (AI intervention; `ai_involvement: ai-primary` or `llm-based`) | CONSORT (2025) | CONSORT-AI; SPIRIT 2025 + SPIRIT-AI (protocol); TIDieR (intervention description); CONSORT-Outcomes 2022 (outcome reporting) |
| RCT — pilot or feasibility | CONSORT extension for pilot trials | — |
| Pragmatic trial | CONSORT extension for pragmatic trials | — |
| Observational cohort (general) | STROBE | — |
| Mendelian randomization | STROBE-MR (stand-alone; replaces STROBE) | — |
| Observational cohort (EHR data) | STROBE | RECORD |
| Observational cohort (pharmacoepi on EHR, registry, or claims data) | STROBE | RECORD + RECORD-PE |
| Case-control | STROBE | RECORD if EHR-derived |
| Cross-sectional | STROBE | RECORD if EHR-derived |
| Target trial emulation | TARGET (standalone) | RECORD for routinely collected EHR/claims/registry data; RECORD-PE if pharmacoepi on EHR, registry, or claims data |
| Prediction model — development | TRIPOD+AI | TRIPOD-Cluster if clustered/multisite data; REFORMS if `ai-primary` or `llm-based`; PROBAST+AI to appraise the model's quality and risk of bias; CHARMS only for systematic reviews of prediction models |
| Prediction model — external validation | TRIPOD+AI | PROBAST+AI to appraise risk of bias and applicability |
| Prediction model — clinical impact / RCT of model | CONSORT (2025) | CONSORT-AI; TRIPOD+AI for the model itself |
| Diagnostic accuracy (no AI) | STARD | QUADAS-3 if doing a SR |
| Diagnostic accuracy (AI) | STARD-AI (stand-alone; replaces STARD) | CLAIM if imaging |
| Imaging AI | STARD-AI or TRIPOD+AI depending on aim | CLAIM (not radiomics/pathomics) |
| ML-based science (AI prediction model) | TRIPOD+AI (or the underlying design's primary) | REFORMS |
| Generative AI / LLM paper | Ask whether the study is chatbot health advice, a trial, a diagnostic test, or a prediction model | Apply CHART only to chatbot health-advice reporting; add TRIPOD-LLM for any LLM development or evaluation; do not auto-route DEAL (opt-in on request) or the PDSQI-9 evaluation instrument |
| Early clinical evaluation of an AI decision-support system (`early-clinical-ai-evaluation`) | DECIDE-AI | — |
| Systematic review / meta-analysis | PRISMA 2020; PRISMA-DTA, PRISMA-NMA, or PRISMA-IPD replace it for those subtypes | PRISMA-S for literature-search reporting; QUADAS-3 for DTA appraisal; CHARMS + PROBAST+AI for reviews of prediction models; RoB 2 or ROBINS-I to appraise included primary studies; AMSTAR 2 for included reviews (overviews) |
| Scoping review | PRISMA-ScR | PRISMA-S for literature-search reporting |
| Case report | CARE | — |
| Qualitative | COREQ (interviews and focus groups) | SRQR for other qualitative designs or journal preference; pick one with a stated reason, never both |
| Mixed-methods | Primary of the quantitative strand | GRAMMS (never primary) |
| Animal study | ARRIVE 2.0 | — |
| Economic evaluation | CHEERS 2022 | CHEERS-AI for AI interventions |
| Quality improvement | SQUIRE 2.0 | — |
| Practice guideline report | RIGHT | — |
| Real-world evidence (regulatory) | STaRT-RWE (planning/reporting template, not a checklist) | RECORD-PE if pharmacoepi |

AI involvement uses the canonical `ai_involvement` values `none`, `ai-assisted`, `ai-primary`, and `llm-based`; an AI extension applies only when its scope matches the study.

`protocol_stage: true` (the deliverable is a protocol): randomized-trial protocols route to SPIRIT 2025 (Chan et al., BMJ 2025, PMID 40294953; + SPIRIT-AI for AI interventions) and systematic-review protocols to PRISMA-P (Moher et al., Syst Rev 2015, PMID 25554246). `early-clinical-ai-evaluation` routes to DECIDE-AI (Vasey et al., Nat Med 2022, PMID 35585198).

## Special cases

- **Replication studies** — use the original study's checklist plus an explicit "replication" framing in SAP-1; do not invent a separate replication checklist.
- **Multi-arm or factorial RCT** — base CONSORT plus the relevant extension (CONSORT-Multi-arm or factorial).
- **Cluster RCT** — CONSORT-CLUSTER.
- **Adaptive design** — ACE / CONSORT-Adaptive.
- **N-of-1** — CONSORT N-of-1.

## Anti-patterns

- **Picking PRISMA for a primary research study** — PRISMA is for systematic reviews. A primary cohort study uses STROBE.
- **Picking CONSORT for an observational study** — CONSORT is for randomized trials. An observational study uses STROBE.
- **Picking STARD for a prediction model** — STARD is for diagnostic accuracy of a single index test. A multivariable prediction model uses TRIPOD+AI.
- **Making a layered extension the primary** — CONSORT-AI, CLAIM, REFORMS, and GRAMMS layer on a primary checklist; they never replace it. Stand-alone extensions are the exception: STROBE-MR, STARD-AI, and the PRISMA subtype checklists (PRISMA-DTA, -NMA, -IPD, -ScR) replace their base for their study type.
- **Treating TARGET as an add-on** — for a target trial emulation, TARGET is the primary and is designed as a standalone guideline (Cashin et al. 2025); do not make STROBE the primary.
- **No checklist for AI papers** — all AI / ML clinical papers map to *some* extension. If the routing here doesn't fit, ask `method-checklist` directly.
- **Treating an appraisal tool as a reporting checklist** — RoB 2, ROBINS-I, PROBAST+AI, AMSTAR 2, QUADAS-3, and CHARMS assess risk of bias or methodological quality; they never serve as a study's primary reporting guideline.
