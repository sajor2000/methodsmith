# SAP-Mode Workflow

Detailed workflow for `method-plan` when **SAP mode** is active. Linked from `SKILL.md` § "Dual-Mode: SAP vs Implementation". Phases 0-2 still run as normal; this file replaces Phases 3-5 with SAP-specific behavior.

## Contents

1. SAP Phase 2.5 — Data profile gate before SAP structure.
2. SAP Phase 3 — Structure the SAP (template, signal scan, fill rules).
3. Canonical handoff-signal envelopes (the `__CE_*__` table consumed by Phase 3).
4. CLIF-profile behavior under SAP mode.
5. SAP Phase 4 — Write the SAP file.
6. SAP Phase 4.5 — Create or require the biostatistics-style tabular SAP companion.
7. SAP Phase 5 — Gap check and review.
8. SAP versioning rules.

---

## 0. SAP Phase 2.5: Data Profile Gate Before SAP Structure

Before SAP Phase 3, inspect the available dataset columns and QA status. The SAP must not finalize variable, missingness, cohort-size, feature, or model sections from assumptions when inspectable data exists.

1. Look for `__CE_DATA_PROFILE__`, `__CE_DATA_QA__`, `__CE_MODEL_STRATEGY__`, `__CE_COHORT__`, and `__CE_CLIF__` signals in chat context and `analysis/`, and for `method-data-qa` reports at `reports/data-qa/<extract_id>.md` (legacy fallback: `analysis/data-qa-report.md`).
2. If a data profile or QA report exists, read it before filling SAP-2 through SAP-8. Use exact observed column names/types, candidate grain, key fields, date columns, null rates, duplicate rates, and blockers/warnings.
3. If a dataset or registered data wave exists but no profile/QA report exists, stop SAP structuring long enough to load the `method-data-qa` skill in pre-SAP column profile mode. Then resume SAP Phase 3 using its report.
4. If no inspectable dataset exists yet, keep the SAP in `status: draft`, add `<!-- GAP: missing method-data-qa column profile; SAP variable/model sections provisional -->`, and list `method-data-qa` followed by `method-model-choice` as required next steps before `method-sap-workbook`, `method-sprint`, `method-work`, coding, or modeling.
5. When a primary or complex secondary analysis needs a nontrivial model choice, require a `ready_for_review` `__CE_MODEL_STRATEGY__` handoff before treating that model specification as execution-ready. A `blocked` or `provisional` strategy keeps the SAP model section in draft.
6. If `method-data-qa` reports blockers, do not write a final SAP. Plan data remediation or re-extraction first.

### Causal/observational analysis guardrail

For an observational study or causal claim, record explicit analysis assumptions: estimand, causal assumptions, unit/grain, key fields, time zero, and success criteria. Treat unresolved choices about the target population, exposure/intervention, comparator, outcome, follow-up horizon, confounder adjustment, or missing-data approach as blockers when they would change the estimand or interpretation. Ask the analyst to resolve the choice or document an approved assumption; keep `status: draft` and do not finalize while a methodological choice remains unresolved.

For an RCT, or any causal claim, fill SAP-1.4 with the ICH E9(R1) estimand: population, treatment conditions, endpoint with time point, each anticipated intercurrent event with its strategy, and population-level summary. An analysis set such as ITT is not an estimand; an unresolved intercurrent-event strategy blocks finalization like any other estimand choice.

## 1. SAP Phase 3: Structure the SAP

1. Read the SAP template from `references/sap-template.md`.
2. Scan chat context and `analysis/` for upstream biomedical-skill handoff signals (see § 2 below), including the data profile/QA signals required by SAP Phase 2.5. The model parses each signal out of recent chat turns (one line per signal beginning with `__CE_*__`) and out of the `analysis/` artifact paths the signals point at, then uses them as inputs in step 3.
3. Fill each SAP section (SAP-1 through SAP-10) from the input document, the upstream signal artifacts from step 2, and research findings.
4. Carry forward all study design decisions from the origin document -- do not re-litigate design choices made during brainstorming.
5. Fill every section; if a section is not applicable, write "Not applicable: [reason]" rather than leaving it blank.
6. Flag incomplete sections with `<!-- GAP: [description] -->` HTML comments (including the upstream-signal gaps from step 2 and the causal/observational guardrail when it applies).
7. Use precise statistical language -- name specific tests, models, and adjustment methods.
8. Ground SAP-1 background and SAP-5 methods justification per `references/evidence-access.md`: cite only sources that were read, with PMID/DOI and an evidence label; otherwise write a GAP comment rather than a citation from memory.

When a signal is present, treat its output file (`csv=`, `yaml=`, `json=`, `file=`, or `path=`) as authoritative input for that section. When a signal is absent for a section the SAP needs, write `<!-- GAP: missing /method-<skill> output; SAP-<N.M> unanchored -->` as a placeholder rather than fabricating content. Tell the user which skills they should run to fill the gaps and offer to re-run `method-plan deepen` after.

## 2. Canonical handoff-signal envelopes

Each emitter MUST emit at minimum the listed keys; extra keys are allowed (forward-compatible). When a consumer expects a key that the emitter wrote `null` for (e.g. narrative-mode effect-size pooling), treat it as missing rather than an error.

| Signal | Emitted by | Feeds SAP section |
|--------|------------|-------------------|
| `__CE_RESEARCH_QUESTION__ yaml=<path> design=<string> checklist=<string> query="<one-line>"` | `method-question` | SAP-1 framing, SAP-1.1 hypothesis |
| `__CE_PUBMED_RESULTS__ csv=<path> n=<int> query=<string> pmc_pct=<float>` | `method-pubmed` | SAP-1 background, SAP-2 rationale |
| `__CE_EVIDENCE_MAP__ path=<artifact> sources=pubmed[,paperclip] full_text_pct=<n> claims=<n>` | `method-evidence-map` | SAP-1 background, SAP-2 rationale, SAP-5 analysis-plan justification |
| `__CE_METHOD_EXTRACT__ csv=<path> n=<int> modal_method=<string>` | `method-extract` | SAP-1 background, SAP-5 analysis-plan justification |
| `__CE_CHECKLIST__ primary=<name> extensions=[<comma-or-empty>]` | `method-checklist` | SAP frontmatter `reporting_checklist` |
| `__CE_COHORT__ name=<string> n=<int> yaml=<path-to-cohort.yaml> waterfall=<path-to-waterfall.csv>` | `method-cohort` | SAP-2 population, SAP-2.2 inclusion/exclusion |
| `__CE_DATA_PROFILE__ dataset=<path-or-wave> rows=<int> columns=<int> grain=<string> report=<path>` | `method-data-qa` pre-SAP mode | SAP-2 variables and data sources, SAP-8 missingness and data-quality prerequisites, SAP-13 variable catalog |
| `__CE_DATA_QA__ wave=<id> pass=<bool> blockers=<int> warns=<int> report=<path>` | `method-data-qa` | SAP-8 data-quality assertions |
| `__CE_MODEL_STRATEGY__ memo=<path> code=<path\|none> language=<r\|python\|none> status=<blocked\|provisional\|ready_for_review> primary=<model-id\|none> evidence=<path\|none>` | `method-model-choice` | SAP-5 model family, estimand alignment, dependence structure, diagnostics, sensitivities, and decision evidence |
| `__CE_PHENOTYPE_VALIDATE__ name=<string> n=<int> ppv=<float> sens=<float> yaml=<path> report=<path>` | `method-phenotype` | SAP-2 case-definition validation |
| `__CE_EFFECT_SIZE__ metric=<m> n_studies=<int> point=<v\|null> ci=<lo,hi\|null> pi=<lo,hi\|NA> i2=<float\|null> mode=<reml\|narrative> contract=<path>` | `method-meta-analysis` | SAP-3.1 MCID and SAP-6 effect-size anchor after reading the selected compatibility contract; `method-power` sweeps `pi=` when finite, else `ci=` |
| `__CE_POWER__ design=<string> total=<int> file=<path>` (optional `n_per_arm`, `epv` for prediction-model variant) | `method-power` | SAP-6 sample-size result |
| `__CE_CLIF__ active=<bool> version=<dd-version> strict=<bool> rules=<path>` | `method-clif` | SAP frontmatter `data_source: CLIF`, SAP-2 layout, SAP-12 dissemination |
| `__CE_LANG__ primary=<python\|r\|both\|unknown> secondary=<...\|null> source=<auto\|cached\|manual>` | `method-language-detect` (via `method-setup`) | SAP-2 implementation-units split (Python vs R scaffolding choices) |

## 3. CLIF profile under SAP mode

When `__CE_CLIF__ active=true` is present:

- Set the SAP frontmatter field `data_source: CLIF` (with the data dictionary `version` from the signal).
- Default the implementation-unit sequence to the Project Template workflow (cohort → quality checks → outlier handling → analysis under `code/`).
- Default `reporting_checklist: STROBE` + `reporting_checklist_extensions: [RECORD]` for observational studies if not already set by `__CE_CHECKLIST__`.
- Add a SAP-12 dissemination note: "patient-level data does not leave each site; only aggregate results in `output/final_no_phi/` are shared, while `output/intermediate_phi/` remains gitignored and local-only".
- Place protected-path edits (`mCIDE/`, `ddl/`, `WORKFLOW.md`) out of scope for any implementation unit unless the user has stated POC sign-off.

## 4. SAP Phase 4: Write the SAP

1. Determine the output path: use the user-specified path, or default to `analysis/sap.md` relative to the project root. Create the `analysis/` directory if it does not exist.
2. Set the YAML frontmatter:
   - `sap_version: 1`
   - `study_type:` one of the values listed in `references/sap-template.md`
   - `date_created:` today's date
   - `date_amended:` leave empty for initial draft
   - `status: draft`
3. Write the SAP file to disk using the Write tool.
4. Confirm: `SAP written to [path]`.

## 4.5. SAP Phase 4.5: Biostatistics Tabular SAP Companion

Every new SAP must be paired with the biostatistics-style tabular SAP workbook contract. Treat `method-sap-workbook` as part of the SAP deliverable, not optional polish.

1. Derive a study slug from the SAP title or user-provided slug.
2. If the SAP has usable data-profile evidence and no critical data QA blockers, generate or update the core tabular SAP files via `method-sap-workbook <slug>`:
   - `analysis/sap-tables/01-overview.csv` with exact columns `Analysis`, `Claim`, `Unit of Analysis`, `Data File(s)`, `Analysis Question`, `Primary Method`, `Secondary Methods`, `Site Script`
   - `analysis/sap-tables/02-outputs.csv` with exact columns `Output File (SITE_ID_ prefix added automatically)`, `Subfolder`, `Dataset / Cohort Scope`, `Script Section`, `Contents`, `Role at Coordinating Center`, `Interpretation`
   - `analysis/sap-tables/03-variables.csv` with exact columns `Category`, `Variable`, `Description`, `Type`, `Format / Values`, `File`, one flag column per analysis (`A2`, `A3`, etc.), and optional `Notes`
   - `analysis/sap-tables/<slug>-tabular-sap.xlsx` when `openpyxl` is available
3. Use visible section-banner rows in `02-outputs.csv` such as `SETUP / DIAGNOSTICS | <script>`, `TABLE OUTPUTS | <script>`, `MODEL OUTPUTS | <script>`, and `FIGURE DATA OUTPUTS | <script>`. The remaining cells in a banner row stay blank so the workbook renderer can merge the row.
4. If data QA is missing or blocked, or a required model strategy is absent, `blocked`, or `provisional`, do not invent workbook rows. Keep `status: draft` and retain the relevant gap comment. For QA-only gaps, list `method-data-qa` followed by `method-sap-workbook <slug>`; when a model strategy is also required, insert `method-model-choice` between them. Complete these handoffs before `method-sprint`, `method-work`, coding, or modeling.
5. The SAP gap report must state whether the tabular companion is present, generated, or blocked by missing data QA. A new SAP with no tabular companion and no explicit blocker is incomplete.

## 5. SAP Phase 5: Gap Check and Review

1. Read the gap checklist from `references/sap-gap-checklist.md`.
2. Scan the written SAP against every item in the checklist.
3. Report gaps to the user in the format specified by the checklist (critical, important, advisory).
4. If critical gaps exist, recommend the user resolve them before finalizing (`status` remains `draft`).
5. If no critical gaps exist, offer to set `status: final`.
6. Present the post-generation menu (same options as implementation mode, substituting SAP path for plan path).

## 6. SAP versioning

When updating an existing SAP:

- Increment `sap_version` in the frontmatter.
- Set `date_amended` to today's date.
- Set `status: amended`.
- Preserve all existing SAP-N.M section IDs -- never renumber. Add new subsections as SAP-N.M+1.
