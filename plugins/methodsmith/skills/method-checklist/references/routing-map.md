# Routing Map: Study Type to Reporting Checklist

This deterministic decision tree selects a primary reporting guideline and only adds extensions whose scope matches the study attributes. It is self-contained: it emits candidate names, while `method-review` resolves those names against the canonical evidence registry before treating any selection as authoritative.

## Contents

- AI Involvement Values
- Primary Checklist
- Worked examples
- Selection Rules
- Edge Cases
- Overrides

## AI Involvement Values

`ai_involvement` uses the canonical values shared with `method-review`: `none`, `ai-assisted` (AI as a tool within traditional methods), `ai-primary` (the AI model is the primary analytical approach or the object being evaluated), and `llm-based` (the study uses or evaluates a large language model). An extension's scope must still match; generic AI involvement alone never adds one.

## Primary Checklist

```text
IF design == RCT:
  primary = CONSORT  # CONSORT 2025 core
  IF ai_involvement IN [ai-primary, llm-based] AND the AI is the trial intervention: extension += CONSORT-AI
  IF protocol_stage == true: protocol = SPIRIT  # SPIRIT 2025 (Chan et al., BMJ 2025, PMID 40294953)
  IF protocol_stage == true AND ai_involvement IN [ai-primary, llm-based] AND the AI is the trial intervention: protocol += SPIRIT-AI (layered on SPIRIT 2025)
  IF cluster_design: extension += CONSORT-CLUSTER  # Campbell et al., BMJ 2012, PMID 22951546
  IF adaptive_design: extension += CONSORT-ADAPTIVE  # ACE, Dimairo et al., BMJ 2020, PMID 32554564
  IF n_of_1_design: extension += CONSORT-NOF1  # CENT 2015, Vohra et al., BMJ 2015, PMID 25976398
  # design extensions were written against CONSORT 2010, now superseded by CONSORT 2025; map their core items to CONSORT 2025 numbers. Never add REFORMS to an RCT.

ELIF design == target_trial_emulation:  # observational data explicitly emulating a target trial
  primary = TARGET
  companion += STROBE only when the journal requires it (TARGET is intended as a standalone guideline; Cashin et al. 2025, PMID 40903028)
  IF data_source IN [EHR, claims, registry]: extension += RECORD  # RECORD items are numbered against STROBE; map 6.x/12.x to TARGET items 5 and 7
  IF data_source IN [EHR, claims, registry] AND pharmacoepidemiology == true: extension += RECORD-PE  # extends RECORD + STROBE (Langan et al., BMJ 2018, PMID 30429167)

ELIF design IN [observational_cohort, observational_case_control, observational_cross_sectional]:
  primary = STROBE
  IF data_source IN [EHR, claims, registry]: extension += RECORD
  IF data_source IN [EHR, claims, registry] AND pharmacoepidemiology == true: extension += RECORD-PE  # extends RECORD + STROBE (Langan et al., BMJ 2018, PMID 30429167)
  IF mendelian_randomization == true: primary = STROBE-MR  # stand-alone STROBE extension, 20 items (Skrivankova et al., JAMA 2021, PMID 34698778); do not also require STROBE
  IF genetic_association == true: extension += STREGA
  IF target_trial_emulation == true: re-route to design == target_trial_emulation (TARGET primary)
  IF RWE_treatment_effect == true: extension += START-RWE  # planning/reporting template, not a reporting checklist (Wang et al., BMJ 2021, PMID 33436424)

ELIF design == prediction_model:
  primary = TRIPOD+AI  # supersedes TRIPOD 2015 for regression and ML models alike (Collins et al. 2024, PMID 38626948)
  IF ai_involvement == llm-based: extension += TRIPOD-LLM  # Gallifant et al., Nat Med 2025, PMID 39779929
  IF ai_involvement IN [ai-primary, llm-based] AND the study makes ML-based science claims: extension += REFORMS
  IF data_source IN [EHR, claims]: do not add PDSQI-9 automatically  # PDSQI-9 rates LLM clinical summaries, not datasets

ELIF design == diagnostic_accuracy:
  primary = STARD-AI IF index test uses AI/ML ELSE STARD  # STARD-AI (40 items) contains STARD 2015; never apply both (Sounderajah et al., Nat Med 2025, PMID 40954311)
  IF modality == imaging: extension += CLAIM  # CLAIM 2024, 44 items; not for radiomics/pathomics

ELIF design == systematic_review:
  primary = PRISMA  # PRISMA 2020
  IF subtype == diagnostic_accuracy: primary = PRISMA-DTA; appraisal += QUADAS-3  # QUADAS-3, Whiting et al., Ann Intern Med 2026, PMID 41698208
  IF subtype == network_meta: primary = PRISMA-NMA
  IF subtype == individual_patient_data: primary = PRISMA-IPD
  IF subtype == scoping_review: primary = PRISMA-SCR
  IF subtype == prediction_model: extension += CHARMS as data extraction and appraisal  # Moons et al., PLoS Med 2014, PMID 25314315; PROBAST+AI (Moons et al., BMJ 2025, PMID 40127903) is the registry's risk-of-bias and applicability tool for the included models (role: appraisal, never a reporting primary); TRIPOD-SRMA (PMID 37137496) is the dedicated reporting checklist but is not yet in the registry
  # Appraisal of included studies uses the registry's appraisal tools; they are never auto-added to reporting_checklist_extensions: RoB 2 (Sterne et al., BMJ 2019, PMID 31462531) for randomised trials, ROBINS-I (Sterne et al., BMJ 2016, PMID 27733354) for non-randomised studies of interventions, AMSTAR 2 (Shea et al., BMJ 2017, PMID 28935701) for included systematic reviews (overviews)
  # DTA, NMA, IPD, and ScR are stand-alone checklists built on PRISMA 2009, now superseded by PRISMA 2020; also check PRISMA 2020 items 24-27 (registration, support, competing interests, data/code availability)
  IF protocol_stage == true: protocol = PRISMA-P  # PRISMA-P 2015 (Moher et al., Syst Rev 2015, PMID 25554246)

ELIF design == qualitative: primary = COREQ
ELIF design == mixed_methods:
  primary = route the quantitative strand through this tree (GRAMMS is never primary)
  extension += GRAMMS  # verified on EQUATOR; update in development (PMID 41841629)
ELIF design == animal: primary = ARRIVE
ELIF design == case_report: primary = CARE
ELIF design == economic_evaluation: primary = CHEERS
ELIF design == quality_improvement: primary = SQUIRE  # SQUIRE 2.0
ELIF design == chatbot_health_advice: primary = CHART
ELIF design == early-clinical-ai-evaluation:  # live clinical use of AI decision support, before a comparative trial
  primary = DECIDE-AI  # Vasey et al., Nat Med 2022, PMID 35585198
ELIF design == ml_methods:
  primary = route the underlying design through this tree (TRIPOD+AI for an AI prediction model)
  extension += REFORMS (ML-based science; REFORMS is never primary)
ELIF design == pathology_deep_learning: no dedicated verified guideline; route by aim (STARD-AI / TRIPOD+AI, plus CLAIM for imaging). DEAL is an LLM checklist: require explicit request before DEAL
ELSE: ask the user which supported guideline applies

ALWAYS (any design): IF ai_involvement == llm-based AND the study develops, fine-tunes, prompt-engineers, or evaluates an LLM on any task (classification, generation, summarization, QA, extraction): extension += TRIPOD-LLM (TRIPOD+AI stays primary when the LLM is a prediction model; CHART stays primary for chatbot health-advice studies); add REFORMS only for ML-based science claims (never for chatbot-advice studies or RCTs); DEAL (LLM-specific, DEAL-A or DEAL-B) only on explicit request
ALWAYS (economic evaluation): IF ai_involvement IN [ai-primary, llm-based] AND the intervention is AI: cite CHEERS-AI (Elvidge et al., Value Health 2024, PMID 38795956) alongside CHEERS; no local checklist file
OPTIONAL (any clinical-AI modelling study): offer MI-CLAIM (Norgeot et al., Nat Med 2020, PMID 32908275) or MI-CLAIM-GEN for generative models (Miao et al., Nat Med 2025, PMID 39915678) as a documentation template, never as the primary reporting guideline
```

`protocol_stage: true` selects the protocol checklist (SPIRIT 2025 for trials, PRISMA-P for systematic reviews) in place of the results-stage primary; record it as `reporting_checklist` while the protocol is being written and switch to the results-stage primary afterwards.

## Worked examples

- "Retrospective EHR cohort emulating a trial of early vs delayed dialysis" -> `__CE_CHECKLIST__ primary=TARGET extensions=[RECORD]` (STROBE only if the journal asks).
- "Logistic-regression risk score for 30-day readmission" -> `__CE_CHECKLIST__ primary=TRIPOD+AI extensions=[]` (TRIPOD+AI supersedes TRIPOD 2015).
- "Protocol for an RCT of an AI triage tool" -> protocol SPIRIT 2025 + SPIRIT-AI; at results, `primary=CONSORT extensions=[CONSORT-AI]`.

## Selection Rules

1. Read canonical `stack_profile.reporting_checklist` and `reporting_checklist_extensions` first.
2. Pass each selected name to `method-review` for resolution against the canonical evidence registry; reject unknown names there.
3. Do not route entries with `evidence_status: unverified` as authoritative (`unverified` is a registry status, not an evidence label).
4. Treat `appraisal`, `template`, `data-quality-tool`, and `evaluation-instrument` roles as distinct from primary reporting guidelines.
5. Layer base and extension checklists; an extension never replaces its base unless the registry records it with `replaces:` (STROBE-MR, TARGET, STARD-AI, PRISMA-DTA, PRISMA-NMA, PRISMA-IPD, PRISMA-SCR) or records supersession. A replacing extension is the primary.
6. When current and legacy versions coexist, select the current version and retain the legacy citation only for historical compatibility.
7. If study attributes cannot distinguish competing routes, ask one decision-changing question rather than guessing.

## Edge Cases

- Mixed-methods studies may combine the applicable quantitative guideline with GRAMMS; label each section by method.
- A prediction sub-analysis inside an RCT keeps CONSORT as the trial primary and applies TRIPOD+AI only to the prediction analysis.
- A target-trial emulation uses TARGET (standalone, 21 items) as the primary reporting guideline; add RECORD for routinely collected EHR, claims, or registry data, and STROBE only when the journal requires it.
- An imaging study routes by aim: STARD-AI (in place of STARD) for an AI diagnostic-accuracy study, TRIPOD+AI for a prediction model; add CLAIM for the imaging AI.
- Qualitative interview and focus-group studies use COREQ (its stated scope); SRQR, the broader qualitative guideline listed by EQUATOR, is not in the registry.
- Generic AI involvement does not trigger CHART.
- CLAIM is limited to medical imaging and does not cover imaging-biomarker (radiomics, pathomics) studies. DEAL (an LLM checklist; DEAL-A 39 items, DEAL-B 22 items) is opt-in and requires an explicit request; PDSQI-9 is an LLM-summary evaluation instrument, never a reporting guideline.

## Overrides

If the user selects a different supported guideline, preserve the choice in `stack_profile.guidelines_override_reason` and retain the evidence status in the review record.
