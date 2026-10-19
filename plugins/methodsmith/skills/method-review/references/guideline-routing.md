# Reporting Guideline Routing Map

## Contents

- Primary Guidelines
- AI Extension Layer
- Trial Design Extension Layer
- Cross-cutting Extension Layer
- Observational Extension Layer
- Appraisal Layer
- Extension Selection Rules
- Guideline Metadata

Route a study to its applicable reporting guidelines based on stack-profile and SAP fields. `guideline-registry.yaml` is the machine-readable source of truth for the supported checklist files, their evidence status, and their methodological roles.

## Primary Guidelines

Each `study_type` maps to exactly one primary guideline. When `study_type` is absent or unrecognized, the reviewer asks the user rather than guessing.

| `study_type` | Primary guideline | Checklist file |
|---|---|---|
| `rct` | CONSORT 2025 | `references/consort-checklist.md` |
| `observational` | STROBE (STROBE-MR for Mendelian randomization) | `references/strobe-checklist.md` (`references/strobe-mr-checklist.md`) |
| `systematic-review` | PRISMA 2020 (PRISMA-DTA, -NMA, -IPD, or -ScR for those review types) | `references/prisma-checklist.md` (or the subtype file) |
| `diagnostic-accuracy` | STARD 2015 (STARD-AI when the index test uses AI) | `references/stard-checklist.md` (`references/stard-ai-checklist.md`) |
| `case-report` | CARE | `references/care-checklist.md` |
| `qualitative` | COREQ | `references/coreq-checklist.md` |
| `animal` | ARRIVE 2.0 | `references/arrive-checklist.md` |
| `health-economic` | CHEERS 2022 | `references/cheers-checklist.md` |
| `prediction-model` | TRIPOD+AI (regression or machine learning; supersedes TRIPOD 2015) | `references/tripod-ai-checklist.md` |
| `target-trial-emulation` | TARGET (standalone) | `references/target-checklist.md` |
| `quality-improvement` | SQUIRE 2.0 | `references/squire-checklist.md` |
| `practice-guideline` | RIGHT | `references/right-checklist.md` |
| `early-clinical-ai-evaluation` | DECIDE-AI (early, small-scale live clinical evaluation of an AI decision-support system) | `references/decide-ai-checklist.md` |
| `exploratory` | _(none required)_ | _(reviewer skips unless user overrides)_ |
| `other` | _(ask user)_ | _(reviewer asks which guideline to apply)_ |

**Target trial emulation:** an `observational` study whose design or SAP explicitly emulates a target trial routes as `target-trial-emulation`: TARGET is the primary reporting guideline and is designed to stand alone (Cashin et al. 2025, PMID 40903028). Add RECORD (routinely collected EHR, claims, or registry data) or STROBE only when the journal or data source requires them.

**Stand-alone replacements:** some extensions are complete checklists that already contain their base, so they are the primary in place of it, never layered on it. The registry records each one with a `replaces:` key: STROBE-MR replaces STROBE for Mendelian randomization (Skrivankova et al. 2021, PMID 34698778); TARGET replaces STROBE for target trial emulation; STARD-AI (40 items, contains STARD 2015) replaces STARD for AI-centred diagnostic accuracy studies (Sounderajah et al. 2025, PMID 40954311); and PRISMA-DTA, -NMA, -IPD, and -ScR replace PRISMA 2020 for their review types.

**Systematic review subtypes:** a diagnostic test accuracy review uses PRISMA-DTA (`references/prisma-dta-checklist.md`; PMID 29362800) in place of PRISMA 2020, appraised with QUADAS-3 (`references/quadas-3-checklist.md`; PMID 41698208); a network meta-analysis uses PRISMA-NMA (PMID 26030634); an IPD meta-analysis uses PRISMA-IPD (PMID 25919529); a scoping review uses PRISMA-ScR (PMID 30178033); a review of prediction-model studies adds CHARMS for data extraction and appraisal (PMID 25314315). The subtype extensions predate PRISMA 2020, so also check PRISMA 2020 items 24-27 (registration, support, competing interests, data and code availability).

**Mixed methods:** route the quantitative strand to its primary and add GRAMMS (`references/gramms-checklist.md`; O'Cathain et al. 2008, PMID 18416914); GRAMMS is never the primary.

**Qualitative research:** COREQ is the primary for interview and focus-group studies. SRQR (`references/srqr-checklist.md`; O'Brien et al. 2014, PMID 24979285) covers every qualitative design; route to it when the design is not an interview or focus-group study, or when the journal or protocol names it. SRQR and COREQ overlap for interviews and focus groups: apply one, chosen with a stated reason, never both.

**Prediction models:** TRIPOD+AI supersedes TRIPOD 2015 for every prediction-model study, regression or machine learning (Collins et al. 2024, PMID 38626948). A request for TRIPOD or TRIPOD 2015 (aliases `tripod`, `tripod-2015`) resolves to TRIPOD+AI; the superseded checklist is not shipped. The same rule applies to every guideline: always route to the newest version, and resolve an old version name to the successor that replaced it.

**Protocol stage:** a trial protocol or pre-results SAP uses SPIRIT 2025 (`references/spirit-checklist.md`; PMID 40294953) instead of CONSORT; a systematic review protocol uses PRISMA-P 2015 (`references/prisma-p-checklist.md`; PMID 25554246) instead of PRISMA 2020.

**Backward compatibility:** The original values `observational`, `rct`, `exploratory`, and `other` continue to work unchanged. New values extend the enum without breaking existing SAPs.

## AI Extension Layer

When `ai_involvement` is set to a value other than `none`, the reviewer layers the applicable AI extension checklist(s) on top of the primary guideline. Extensions supplement the base checklist -- both must be applied together. Exception: a stand-alone replacement (STARD-AI here; see Primary Guidelines) is applied instead of its base, never with it.

| `ai_involvement` | Condition | Extension guideline | Checklist file |
|---|---|---|---|
| `ai-primary` or `llm-based` | `study_type: rct` and the AI (or LLM) is the trial intervention | CONSORT-AI | `references/consort-ai-checklist.md` |
| `ai-primary` or `llm-based` | `study_type: rct` (protocol stage) and the AI (or LLM) is the trial intervention | SPIRIT-AI, layered on the SPIRIT 2025 core | `references/spirit-ai-checklist.md` (+ `references/spirit-checklist.md`) |
| `ai-primary` | `study_type: prediction-model` | TRIPOD+AI (already primary) | _(no additional file)_ |
| `ai-primary` | `study_type: prediction-model` | REFORMS, only when the study makes ML-based scientific claims beyond reporting a clinical model | `references/reforms-checklist.md` |
| `ai-primary` | clinical AI model documentation requested (model card, supplement) | MI-CLAIM (partial-report checklist for data, results, and study characteristics; use as a documentation template, not the primary guideline) | `references/mi-claim-checklist.md` |
| `ai-primary` | `study_type: diagnostic-accuracy` | STARD-AI (replaces STARD 2015; 40 items) | `references/stard-ai-checklist.md` |
| `ai-primary` | medical imaging study (`diagnostic-accuracy` or `prediction-model`; not radiomics or pathomics) | CLAIM | `references/claim-checklist.md` |
| `ai-primary` | chatbot health-advice study | CHART (primary for chatbot health-advice studies; replaces the design-based primary) | `references/chart-checklist.md` |
| `ai-primary` | `study_type: health-economic` | CHEERS-AI (Elvidge et al. 2024, PMID 38795956); no local checklist file, cite the extension alongside CHEERS 2022 | — |
| `ai-assisted` | AI is a tool inside traditional methods, not the intervention or object of study | none auto-added; report the tool's role, version, and validation in Methods (CONSORT-AI, SPIRIT-AI, STARD-AI, TRIPOD-LLM, and REFORMS apply only to `ai-primary` or `llm-based`) | — |
| `llm-based` | any study that develops, fine-tunes, prompt-engineers, or evaluates an LLM, on any task (classification, generation, summarization, QA, extraction) | TRIPOD-LLM (TRIPOD+AI stays primary when the LLM is a prediction model; CHART stays primary for chatbot health-advice studies) | `references/tripod-llm-checklist.md` |
| `llm-based` | ML-based scientific claims (never for chatbot-advice studies or RCTs) | REFORMS | `references/reforms-checklist.md` |
| `llm-based` | chatbot health-advice study | CHART (primary for chatbot health-advice studies; replaces the design-based primary) | `references/chart-checklist.md` |
| `llm-based` | LLM development or fine-tuning (DEAL-A) or applied pretrained-LLM study (DEAL-B) | DEAL (opt-in: only on explicit request by the user, journal, or protocol; never auto-routed) alongside TRIPOD-LLM, which stays the default LLM extension | `references/deal-checklist.md` |
| `llm-based` | study generating or evaluating LLM summaries of clinical documentation | PDSQI-9 as an evaluation instrument (not a reporting guideline); never auto-routed | `references/pdsqi-checklist.md` |
| `none` | any | _(no extensions)_ | _(skip AI layer)_ |

## Trial Design Extension Layer

When `study_type: rct`, layer design extensions on the CONSORT 2025 core (or on SPIRIT 2025 at the protocol stage, where no design extension below applies). These extensions were written against CONSORT 2010, now superseded by CONSORT 2025; cite their published item IDs and map to CONSORT 2025 numbers for core items. Each checklist file gives the mapping. REFORMS is never applied to an RCT.

| Condition | Extension guideline | Checklist file |
|---|---|---|
| cluster randomised design | CONSORT-CLUSTER (Campbell et al. 2012, PMID 22951546) | `references/consort-cluster-checklist.md` |
| adaptive design (pre-planned adaptations based on accumulating data) | CONSORT-ADAPTIVE / ACE (Dimairo et al. 2020, PMID 32554564) | `references/consort-adaptive-checklist.md` |
| N-of-1 trial or series of N-of-1 trials | CONSORT-NOF1 / CENT 2015 (Vohra et al. 2015, PMID 25976398) | `references/consort-nof1-checklist.md` |

## Cross-cutting Extension Layer

These extensions layer on the primary for the relevant study types rather than extending one trial design.

| Condition | Extension guideline | Checklist file |
|---|---|---|
| Intervention description in any evaluative design, trial or not (extends item 5 of CONSORT 2010, which CONSORT 2025 supersedes, and item 11 of SPIRIT 2013, which SPIRIT 2025 supersedes; apply with the current core) | TIDieR (Hoffmann et al. 2014, PMID 24609605) | `references/tidier-checklist.md` |
| Literature search reporting in any review (extends PRISMA 2020; apply with the PRISMA core, the subtype core, or PRISMA-P at the protocol stage) | PRISMA-S (Rethlefsen et al. 2021, PMID 34285662) | `references/prisma-s-checklist.md` |

## Observational Extension Layer

When the primary is STROBE or TARGET, add RECORD for routinely collected data (EHR, claims, or registry); add RECORD-PE as well when the study is pharmacoepidemiology on EHR, registry, or claims data (Langan et al. 2018, PMID 30429167); add STREGA for genetic association studies. RECORD items are numbered against STROBE; under TARGET, map RECORD 6.x and 12.x to TARGET items 5 and 7. STaRT-RWE is a planning and reporting template, not a reporting checklist.

## Appraisal Layer

Appraisal tools assess risk of bias, methodological quality, or confidence; they are never reporting guidelines, never a primary, and never layered onto a reporting checklist. Route one only when the review task is appraisal: the study's own model, or studies included in a review. Each old name below was replaced by its successor in the registry (`rob-1`, `cochrane-rob-1` -> ROB2; `robins` -> ROBINS-I; `probast`, `probast-2019` -> PROBAST+AI, which supersedes PROBAST-2019; `amstar`, `amstar-1` -> AMSTAR-2; `quadas-2` -> QUADAS-3).

| Appraisal task | Tool | Checklist file |
|---|---|---|
| Risk of bias in a result from a randomised trial (own trial or an included trial) | ROB2 | `references/rob2-checklist.md` |
| Risk of bias in a result from a non-randomised study of interventions | ROBINS-I | `references/robins-i-checklist.md` |
| Quality, risk of bias, and applicability of a prediction model (development or evaluation), own model or included studies | PROBAST+AI | `references/probast-ai-checklist.md` |
| Confidence in a systematic review of healthcare interventions (an overview of reviews, or appraising an existing review) | AMSTAR-2 | `references/amstar-2-checklist.md` |
| Risk of bias and applicability of a diagnostic accuracy study (in a DTA review) | QUADAS-3 | `references/quadas-3-checklist.md` |
| Data extraction and appraisal for a review of prediction model studies | CHARMS | `references/charms-checklist.md` |

## Extension Selection Rules

1. **Read stack profile** for `stack_profile.reporting_checklist` and `stack_profile.reporting_checklist_extensions`.
2. **If canonical stack-profile fields are set**, use those values and load checklist files from `guideline-registry.yaml`.
3. **Read SAP frontmatter** for `study_type`, `ai_involvement`, and legacy `guidelines_selected`.
4. **If legacy `guidelines_selected` is explicitly set** and canonical stack-profile fields are absent, use that list as a compatibility override.
5. **Otherwise, route by `study_type`** to get the primary guideline from the table above.
6. **If `ai_involvement` is not `none`**, scan the AI extension table for matching conditions. A condition matches when the study attributes and the guideline scope both align. Do not treat generic AI involvement as sufficient for DEAL, CHART, or PDSQI-9. If `study_type: rct`, also apply the Trial Design Extension Layer.
7. **Resolve evidence status before combining** primary + extensions. `verified` entries may be routed; `provisional` entries require an explicit note; `unverified` entries are not authoritative selections.
8. **Combine primary + extensions** into the final checklist set. Load each file and review against it.

## Guideline Metadata

| Abbreviation | Full name | Items | Scope |
|---|---|---|---|
| CONSORT | Consolidated Standards of Reporting Trials (2025) | 30 | RCTs |
| SPIRIT | Standard Protocol Items: Recommendations for Interventional Trials (2025) | 34 | Trial protocols |
| PRISMA-P | PRISMA for systematic review Protocols (2015) | 17 | Systematic review protocols |
| TARGET | Transparent Reporting of Observational Studies Emulating a Target Trial (2025) | 21 | Target trial emulation |
| STROBE | Strengthening the Reporting of Observational Studies in Epidemiology | 22 | Observational |
| STROBE-MR | STROBE using Mendelian Randomization (stand-alone) | 20 (30 subitems) | Mendelian randomization |
| RECORD | REporting of studies Conducted using Observational Routinely-collected health Data | 13 | Routinely collected data (with STROBE) |
| RECORD-PE | RECORD for pharmacoepidemiology | 15 | Pharmacoepi with routinely collected data (with RECORD + STROBE) |
| STREGA | STrengthening the REporting of Genetic Association studies | additions to 12 STROBE items | Genetic association (with STROBE) |
| STaRT-RWE | Structured template for RWE study implementation (template, not a checklist) | 9 tables + design diagram | RWE treatment-effect studies |
| PRISMA | Preferred Reporting Items for Systematic Reviews and Meta-Analyses (2020) | 27 (42 incl. sub-items) | Systematic reviews |
| PRISMA-DTA | PRISMA for diagnostic test accuracy reviews (2018) | 27 (incl. D1, D2; omits PRISMA 15, 22) | DTA systematic reviews (stand-alone) |
| PRISMA-NMA | PRISMA for network meta-analyses (2015) | 32 (27 + S1-S5) | Network meta-analyses (stand-alone) |
| PRISMA-IPD | PRISMA for individual participant data reviews (2015) | 31 (27 + A1-A4) | IPD meta-analyses (stand-alone) |
| PRISMA-ScR | PRISMA for scoping reviews (2018) | 22 (20 essential + 2 optional) | Scoping reviews and evidence maps (stand-alone) |
| PRISMA-S | PRISMA extension for reporting literature searches (with the PRISMA core) | 16 | Search reporting in systematic reviews |
| CHARMS | Data extraction and appraisal for systematic reviews of prediction models | 7 framing items + 11 domains | SR of prediction models (with PRISMA) |
| QUADAS-3 | Quality Assessment of Diagnostic Accuracy Studies (2026; supersedes QUADAS-2) | 4 domains (appraisal tool) | Risk of bias in DTA systematic reviews |
| ROB2 | Risk of Bias 2 for randomised trials (appraisal tool) | 5 domains + domain 1b for cluster trials, signalling questions per domain | Risk of bias in randomised trial results |
| ROBINS-I | Risk Of Bias In Non-randomised Studies - of Interventions (appraisal tool) | 7 domains, signalling questions per domain | Risk of bias in non-randomised studies of interventions |
| PROBAST+AI | Prediction model Risk Of Bias ASsessment Tool +AI (appraisal tool; supersedes PROBAST-2019) | 4 domains, 2 parts (16 + 18 signalling questions), 6 applicability items | Prediction model quality, risk of bias, applicability |
| AMSTAR-2 | A MeaSurement Tool to Assess systematic Reviews, version 2 (appraisal tool) | 16 items, 7 critical domains, 4-level confidence rating | Confidence in systematic reviews of interventions |
| STARD | Standards for Reporting Diagnostic Accuracy (2015) | 30 (34 incl. sub-items) | Diagnostic accuracy |
| STARD-AI | STARD for AI-centred diagnostic accuracy (replaces STARD 2015) | 40 | AI diagnostic accuracy |
| CARE | CAse REport guidelines | 13 | Case reports |
| COREQ | Consolidated Criteria for Reporting Qualitative Research | 32 | Qualitative |
| SRQR | Standards for Reporting Qualitative Research | 21 | Qualitative research (alternative to COREQ) |
| RIGHT | Reporting Items for practice Guidelines in HealThcare | 22 | Practice guidelines |
| ARRIVE | Animal Research: Reporting of In Vivo Experiments | 21 | Animal research |
| CHEERS | Consolidated Health Economic Evaluation Reporting Standards | 28 | Health economics (CHEERS-AI for AI interventions) |
| SQUIRE | Standards for QUality Improvement Reporting Excellence (2.0) | 18 | Quality improvement |
| GRAMMS | Good Reporting of A Mixed Methods Study | 6 | Mixed methods |
| TIDieR | Template for Intervention Description and Replication | 12 | Intervention description (any evaluative design) |
| CONSORT-AI | CONSORT extension for AI interventions (written against CONSORT 2010, superseded by CONSORT 2025) | 14 | AI + RCT |
| SPIRIT-AI | SPIRIT extension for AI trial protocols (written against SPIRIT 2013, superseded by SPIRIT 2025) | 15 | AI + trial protocol |
| CONSORT-CLUSTER | CONSORT extension for cluster randomised trials (2012; written against CONSORT 2010) | 19 extended items (item 10 replaced by 10a-10c) | Cluster RCT |
| CONSORT-ADAPTIVE | Adaptive designs CONSORT Extension, ACE (2020; written against CONSORT 2010, superseded by CONSORT 2025) | 7 new + 9 modified (+6 with added explanation) | Adaptive RCT |
| CONSORT-NOF1 | CONSORT extension for N-of-1 trials, CENT 2015 (written against CONSORT 2010, superseded by CONSORT 2025) | 14 of 25 core items extended | N-of-1 trials |
| TRIPOD+AI | Prediction-model reporting, regression or ML (supersedes TRIPOD 2015) | 27 | Any prediction model |
| TRIPOD-LLM | TRIPOD+AI extension for large language models | 19 (50 subitems) | Any LLM development or evaluation study |
| DECIDE-AI | Early-stage clinical evaluation of AI decision support | 27 (17 AI-specific + 10 generic) | Live clinical AI evaluation |
| MI-CLAIM | Minimum Information about Clinical AI Modeling | 6 parts | Model documentation |
| REFORMS | Recommendations for machine-learning-based science | 32 (8 modules, 1a-8b) | ML-based science (never RCTs) |
| CLAIM | Checklist for AI in Medical Imaging (2024 update) | 44 | AI + imaging (not radiomics/pathomics) |
| DEAL | Development, Evaluation, and Assessment of Large Language Models (DEAL-A / DEAL-B) | 39 (A) / 22 (B) | LLM studies |
| CHART | Chatbot Health Advice reporting | 12 (39 subitems) | Chatbot health-advice studies |
| PDSQI-9 | Provider Documentation Summarization Quality Instrument | 9 attributes | LLM clinical-note summaries |
