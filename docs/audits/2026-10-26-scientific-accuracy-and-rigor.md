# Scientific accuracy and rigor audit

Date: 2026-10-26. Scope: the current working tree, including its pre-existing uncommitted edits. Base commit: `099d156e94e578213aa741e1d77a313b898097a8`; branch: `refactor/state-dir-rename-and-hardening`.

## Assessment

Inventory-wide screening covered **69 shipped skills: 68 Methodsmith skills and one coding tutor**. The audit found **six P1 findings and two P2 findings**, affecting seven skill directories directly. The most consequential defects are in statistical verification: the checker can accept an incorrect P value and reject a correct one-sided result. Other findings concern interval reconstruction, genome-build verification, temporal validation, batch confounding, and examples that can encode biased study definitions.

The scientific design is often careful: estimands precede model choice, causal assumptions are explicit, formal synthesis separates dependent contributions, and numerical provenance is distinguished from scientific approval. These strengths do not justify a blanket scientific-validity claim while the findings below remain open.

This was an **inventory-wide content screen with risk-based deeper review**, not exhaustive validation of every supported analysis, every reference file, or LLM behavior. “No additional finding” below means no confirmed defect in the screened instructions; it does not mean a skill passed a complete scientific evaluation.

## Scope and method

- Enumerated every `plugins/*/skills/*/SKILL.md`: 69 entries, 8,659 lines. Test-fixture skills and machine-installed skill copies were excluded.
- Screened entry-point instructions for scientific claims, design assumptions, evidence handling, inference, leakage, reproducibility, and approval language. Deep review concentrated on study design, cohort/phenotype validation, power, synthesis, modeling, omics, reporting, and verification. Operational workflows received a narrower scientific-contract screen.
- Inspected selected supporting formulas, scripts, templates, and evaluation cases. The 450-file hash manifest identifies the source boundary; it is **not a claim that all 450 files were read**. The 49-entry reporting-guideline registry received structural checks and selected source-identity checks, not a fresh item-by-item audit of all checklists.
- Used **Exa MCP** for primary-source discovery and retrieval; **PubMed MCP** for 18 cited records; **Jev MCP** to screen retrieved content and reconcile five bounded claims against supplied evidence excerpts. No patient data or credentials were used.
- Executed existing focused tests and synthetic numerical counterexamples. No skill, script, agent, or evaluation behavior was modified. No commit, push, PR, installation, or production operation was performed.
- Rechecked source fingerprints at report preparation. A concurrent change to an installer-detection helper was reread; generated Python caches were excluded from the final manifest. The report is bound to [the recorded snapshot](2026-10-26-scientific-rigor-snapshot.json), rather than to a released version.

Severity: **P1** can change an analytic conclusion or give a false validation result in a supported workflow. **P2** is a narrower defect or conflicting example that can misdirect a generated study. No P0 finding was established within this scope.

## Findings

### F01 — P1: the P-value checker loses printed precision and mishandles negative statistics

**Location:** [verify_stats.py](../../plugins/methodsmith/skills/method-verify/scripts/verify_stats.py#L217), especially `p_envelope()` and `check_p_item()`; `printed_decimals()` starts at line 157.

`check_p_item()` converts the printed statistic to a float before constructing its rounding envelope. Thus `"2.00"` becomes `2.0`, which `printed_decimals()` treats as an integer, permitting a half-unit rounding error instead of 0.005. Separately, `p_envelope()` clamps the lower signed statistic at zero. For a negative t or z statistic, the resulting P envelope can extend to 1 instead of surrounding the actual two-sided P value.

**Executed counterexample:** `z="-2.00", reported_p="0.500"` returns **PASS**, although the correct two-sided P is approximately **0.0455003**. The computed envelope was `[0.1336144, 1.0]`, which does not even contain the checker's own central recomputation. `t="-3.00", df=30, reported_p="0.500"` also returns PASS; the central P is approximately 0.0053900.

**Consequence:** an internally inconsistent reported result can clear the verification gate; loss of precision can also hide an incorrect significance decision near alpha.

**Recommended correction:** preserve the original printed string for rounding; form the signed rounding interval before applying the tail transformation; account for an interval crossing zero. Require the recomputed central P to fall within its envelope.

**Required regression evidence:** sign symmetry for two-sided t/z; `"2"`, `"2.0"`, and `"2.00"` produce distinct appropriate envelopes; negative-statistic counterexamples fail; near-threshold decisions use the declared precision. Compare with base R or another independent maintained implementation.

### F02 — P1: the verification gate assumes two-sided t/z tests and can reject valid non-inferiority results

**Location:** [verify_stats.py](../../plugins/methodsmith/skills/method-verify/scripts/verify_stats.py#L185) and [the verification check catalog](../../plugins/methodsmith/skills/method-verify/references/check-catalog.md#L164).

The t/z recomputation has no supported alternative-hypothesis field. The skill instructs the agent to extract applicable reported statistics and treat a decision-error FAIL as blocking. Meanwhile, `method-power` explicitly supports one-sided non-inferiority and TOST workflows.

**Executed counterexample:** `z="2.05", reported_p="0.0202", alpha=0.025` is correct for an upper-tail test. Base R gives 0.0201822. The checker recomputes 0.0403644 and returns **FAIL**, calling it a significance decision error. Adding `alternative="greater"` to the item does not change its calculation.

**Consequence:** a correctly analyzed supported trial can be mislabeled statistically inconsistent. The default alpha of 0.05 can instead reduce the same mismatch to an unjustified warning.

**Recommended correction:** carry sidedness and direction from the SAP into a validated claims contract. Support the specified tail or return “unsupported/not checked”; never silently substitute a two-sided test. Adjusted, exact, permutation, or sequential P values also need method-specific handling rather than automatic comparison with an ordinary reference distribution.

**Required regression evidence:** upper/lower/two-sided t/z; a valid NI result; both TOST components; unsupported P-value constructions reported as unresolved. Preserve the correct upper-tail convention for F and chi-square tests.

### F03 — P1: power-anchor pooling reconstructs SEs without validating interval construction

**Location:** [effect-parser.md](../../plugins/methodsmith/skills/method-meta-analysis/references/effect-parser.md#L123), particularly line 125; [pool_effects.R](../../plugins/methodsmith/skills/method-meta-analysis/scripts/pool_effects.R#L170), especially lines 174 and 183.

The parser tells the agent to recreate a symmetric log-scale interval when a reported CI is asymmetric. The helper then divides every selected interval width by `2 * 1.96`. Its compatibility contract records neither confidence level nor interval method/degrees of freedom and does not accept a source-reported SE. An instruction about 90% intervals in the reference does not alter the helper's hard-coded divisor.

For a normal 95% Wald interval, this reconstruction is conventional. It is not generally valid for a t interval, a 90% interval, or a profile-likelihood, exact, or percentile-bootstrap interval. Asymmetry is a reason to inspect the method, not permission to manufacture a new Wald interval. [Cochrane's current effect-measure chapter](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-06) explicitly distinguishes normal and small-sample t reconstructions. The formal federated synthesis skill already states the stronger rule in its own `references/federated.md` lines 25–28.

**Executed numerical check:** for an MD with source SE 1 and a 95% t interval with 9 df, dividing the width by 3.92 produces SE **1.154162**, variance **1.332090**. Thus this input receives the wrong within-study uncertainty before REML runs. The literature-derived anchor and its downstream power sweep can change.

**Recommended correction:** prefer a reported SE or valid source-level reconstruction; require interval level, method and df where relevant. Reject unresolved non-Wald intervals and asymmetry beyond declared rounding. Preserve the source's estimate and interval.

**Required regression evidence:** 95% normal, 90% normal, 95% t with known df, asymmetric profile/bootstrap intervals, and incompatible or unknown interval methods. Check pooling against a maintained implementation after valid SE extraction.

### F04 — P1: the genome-build helper reports a clean audit despite an explicit build mismatch

**Location:** [audit_build.py](../../plugins/methodsmith/skills/method-genome-build/scripts/audit_build.py#L74), `inspect_vcf()`, and the checks beginning at line 125; [the skill's stated checks](../../plugins/methodsmith/skills/method-genome-build/SKILL.md#L64).

The VCF reader records `##reference`, but the auditor never compares it with the declared build. It does not retain VCF contig lengths/assembly annotations for comparison. BAM lengths are retained but not used in build checks either. In practice the build-specific check depends on an optional chromosome-1 MD5. Files with inspection errors are skipped without adding an issue; T2T has no configured chromosome-1 MD5.

**Executed counterexample:** a synthetic VCF with `##reference=GRCh37` and `##contig=<ID=1,length=249250621,assembly=GRCh37>` audited as `GRCh38` returns **an empty issues list**. These lengths differ under the skill's own build-detection reference. The CLI consequently can exit 0 and report no build mismatches.

**Consequence:** the helper can appear to establish consistency when a common header contains enough information to show inconsistency, or when a check could not run. The skill does describe manual checks too, so this finding concerns the helper and its clean-result semantics, not a claim that the entire manual workflow must miss the mismatch.

**Recommended correction:** compare available reference/assembly declarations and diagnostic contig lengths; distinguish verified, incompatible, unknown and uninspected files. Missing tools or absent evidence must not become a clean validation. Establish a supported T2T version/evidence contract.

**Required regression evidence:** the synthetic VCF above; same-build naming differences; missing samtools; absent MD5 with informative lengths; contradictory assembly tokens; unsupported/unknown reference; T2T validation.

### F05 — P1: calendar-period leave-one-group-out is presented without a forward-validation distinction

**Location:** [ml-training-protocol.md](../../plugins/methodsmith/skills/method-model-choice/references/ml-training-protocol.md#L54), especially lines 62, 66 and 79.

The protocol groups sites and calendar periods together and recommends `LeaveOneGroupOut` for both. That splitter trains on every other group. Holding out 2020 can therefore train on 2021 and 2022. It estimates a period-transport task, not prospective performance using only information available before 2020.

This is **conditional on the validation target**: leave-one-period-out is not inherently invalid. The defect is failing to distinguish period transport from forward temporal validation while offering this as the general route for periods. The plugin's other leakage instructions correctly require temporal ordering.

The official [LeaveOneGroupOut API](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.LeaveOneGroupOut.html) describes the all-other-groups training rule. The official [TimeSeriesSplit API](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html) explains the future-training/past-evaluation problem.

**Recommended correction:** elicit the deployment/transport estimand. For forward evaluation, use rolling/expanding calendar windows, with an appropriate outcome-maturation gap and patient grouping. Use `TimeSeriesSplit` only when its assumptions fit; irregular clinical calendar cohorts may need an explicit calendar splitter. Allow nonchronological period transport only when labeled and justified.

**Required regression evidence:** a three-period fixture where every forward-validation training timestamp precedes assessment; grouped patients; outcome horizons; separate legitimate site/period-transport cases.

### F06 — P1: omics identifiability checks can be conditional on an unrelated PCA display

**Location:** [method-omics-qc](../../plugins/methodsmith/skills/method-omics-qc/SKILL.md#L72), line 74; [batch-confound-rules.md](../../plugins/methodsmith/skills/method-omics-qc/references/batch-confound-rules.md#L21), especially line 24.

The main instruction runs the design-rank check if the first two PCs separate by batch and condition is associated with batch. Complete aliasing exists in the sample design regardless of how much expression variation it explains or which PCs display it. Two dominant unrelated sources of variation can hide condition/batch separation in PC3.

**Executed synthetic check:** eight samples with `batch == condition` and two larger orthogonal nuisance components yield rank **2 for a 3-column** `~ batch + condition` design, while correlations of condition with PC1 and PC2 are both **0**. A first-two-PC trigger can miss an unidentified contrast.

The supporting reference also says stable results with/without a batch are “OK to publish with caveat” without restricting that advice to identifiable partially confounded designs. Deleting a batch or obtaining stable coefficients does not recover an unidentified condition effect under complete aliasing. The [official DESeq2 vignette, model-matrix section](https://bioconductor.org/packages/release/bioc/vignettes/DESeq2/inst/doc/DESeq2.html#model-matrix-not-full-rank) explains why these effects cannot be separated.

**Recommended correction:** always inspect design support/rank and estimability before expression PCA. Separate complete aliasing from partial association, and require estimable contrasts rather than a PCA or Cramér's V threshold to establish identification. Preserve explicit limits on what sensitivity analyses can establish.

**Required regression evidence:** aliasing with no PC1/PC2 signal; partial confounding with a full-rank design; contrasts identifiable only within supported batches; deletion that destroys overlap. Keep project-default QC cutoffs labeled as conventions.

### F07 — P2: the research-question example misdefines Hour-1 bundle adherence

**Location:** [method-question](../../plugins/methodsmith/skills/method-question/SKILL.md#L45), lines 48–49 and 120–123.

The worked sepsis example calls patients nonadherent if fewer than five of five elements were completed within one hour. The [official SCCM Hour-1 bundle](https://sccm.org/SCCM/media/SCCM/PDFs/Surviving-Sepsis-Campaign-Hour-1-Bundle.pdf) makes fluid and vasopressor actions conditional on physiology and distinguishes prompt initiation from completion of every action in an hour.

**Consequence:** copying the example into a cohort/exposure definition can label clinically appropriate care nonadherent and entangle severity/indication with the exposure. This is an example-level defect, not evidence that the general PICO workflow is invalid.

**Recommended correction:** specify adherence to applicable components, with component-specific eligibility, time origin and timing. Label any stricter study-defined completion measure explicitly and justify it. Also distinguish 30-day all-cause mortality from 30-day in-hospital mortality and specify how discharge affects ascertainment; the example currently alternates between these outcome descriptions.

**Required regression evidence:** a normotensive patient without a fluid/pressor indication, persistent hypotension requiring pressors, and an outcome-ascertainment definition consistent across PICO and YAML.

### F08 — P2: the eligibility reference reintroduces a future-observation requirement

**Location:** [eligibility-windows.md](../../plugins/methodsmith/skills/method-cohort/references/eligibility-windows.md#L17), line 19; compare its line 39 and [the skill's time-zero rule](../../plugins/methodsmith/skills/method-cohort/SKILL.md#L120).

The reference describes continuous enrollment as commonly 365 days before index plus the entire follow-up period. Used as an inclusion requirement, future enrollment conditions eligibility on post-index information. The same reference and main skill correctly prohibit post-index minimum follow-up requirements.

**Consequence:** an agent following the window description can exclude early disenrollment or short follow-up, introducing selection bias and, depending on the rule, immortal-time bias. This is a contradiction in the instructions, not a defect in the bundled SQL: the SQL only requires observation through index.

**Recommended correction:** define baseline observability through time zero; represent later disenrollment through follow-up/censoring and its assumptions or weights. When a special design intentionally conditions on future observation, define the changed target population and justify it rather than presenting it as a general rule. The [target-trial framework](https://pubmed.ncbi.nlm.nih.gov/26994063/) supports explicit alignment of eligibility, treatment assignment and follow-up.

**Required regression evidence:** an otherwise eligible person who disenrolls at day 90 remains eligible at baseline and receives the prespecified follow-up handling rather than automatic exclusion.

## Practices supported by the inspected evidence

- `method-model-choice`, `method-sap` and `method-trial-design` generally put estimands, units, dependence and assumptions before software selection. The trial-design skill preserves a qualified human review gate and engine provenance.
- `method-clif-meta-analysis` explicitly addresses overlap, failed/suppressed sites, non-collapsibility, sparse outcomes, interval-method differences and local governance. Its distinction between REML and Paule–Mandel is correct in the inspected paths.
- `method-phenotype` recognizes algorithm-stratified verification sampling and requires population stratum information for weighted sensitivity/specificity, rather than reporting naive sample-cell ratios. The [Begg–Greenes paper](https://pubmed.ncbi.nlm.nih.gov/6871349/) addresses this selection-bias problem. The executed existing tests exercise important design-aware calculations.
- `method-power` uses a clinically justified target difference and prediction-model sample-size criteria rather than a universal EPV rule. The [DELTA2 paper](https://pubmed.ncbi.nlm.nih.gov/30560792/) and Riley development papers ([binary/survival](https://pubmed.ncbi.nlm.nih.gov/30357870/), [continuous](https://pubmed.ncbi.nlm.nih.gov/30347470/)) support those choices. This source check does not validate every formula branch.
- The power-anchor choice of HKSJ when estimated heterogeneity is positive and Wald when it is zero was **not flagged as an error**: [current Cochrane methods guidance](https://methods.cochrane.org/statistics/news/issue-3-january-2025-newsletter) supports the stated conditional recommendation. Small-k uncertainty still needs qualification.
- `method-numbers`, `method-signoff` and the publication workflows distinguish source traceability, technical readiness and human scientific approval. A number registry establishes provenance, not the validity of an estimator.
- The registry's selected current identities—[CONSORT 2025](https://pubmed.ncbi.nlm.nih.gov/40228833/), [SPIRIT 2025](https://pubmed.ncbi.nlm.nih.gov/40294953/), [TRIPOD+AI](https://pubmed.ncbi.nlm.nih.gov/38626948/) and [PROBAST+AI](https://pubmed.ncbi.nlm.nih.gov/40127903/)—resolved through PubMed. This does not establish item-level fidelity or rule out an unsearched successor for every guideline.

## Every shipped skill: coverage and disposition

`S` = scientific/methodological instructions reviewed, with selected deeper references where risk warranted. `W` = operational or editorial workflow screened for its scientific contract, without validating the delegated scientific method. Findings are listed for direct owners; downstream consumers must also be considered when fixing them.

| Skill | Scope | Disposition / scientific contract inspected |
|---|---|---|
| coding-tutor | W | No formal finding; quiz scores and Fibonacci-style scheduling are educational heuristics, not a validated mastery scale or evidence of the stated aspirational programming outcomes. |
| method-adversarial-review | W | No additional finding; distinguishes independent corroboration, rebuttal convergence and unresolved disagreement. |
| method-anti-slop | W | No additional finding; source-grounded qualifiers and preservation of scientific terminology; stylistic P0 labels are not statistical severity evidence. |
| method-brainstorm | S | No additional finding; design pressure tests and preliminary literature pulses are separated from systematic searches. |
| method-checklist | S | No additional finding in routing screen; complete source-item fidelity not evaluated. |
| method-citations | S | No formal finding; metadata identity and passage support are separate; a failed lookup alone must not be interpreted as proof of intentional fabrication. Resolver coverage was not exhaustively tested. |
| method-clean-branches | W | No direct scientific method; preservation of research artifacts depends on its Git safety workflow. |
| method-clif | S | No additional finding; explicit schema/vocabulary family selection; live clifpy recipe parity not tested. |
| method-clif-meta-analysis | S | No additional finding in selected contracts/scripts; dependence and estimand safeguards are substantive. Python numerical execution had a dependency-related skip. |
| method-clif-template | W | No additional finding; template/buddy-test readiness explicitly does not certify cohort or scientific validity. |
| method-cohort | S | **F08**; otherwise explicit time zero, vocabulary provenance and cumulative flow accounting. |
| method-commit | W | No direct scientific method; protects data and keeps commits bounded. |
| method-compound | W | No additional finding; requires validated learnings rather than unsupported speculation. |
| method-compound-refresh | W | No additional finding; uncertain guidance is marked stale rather than silently treated as true. |
| method-data-qa | S | No additional finding in selected QA/missingness instructions; structural QA is distinguished from SAP validity. |
| method-debug | W | No additional finding; reproduces and diagnoses failures before claiming a fix. |
| method-doc-review | W | No additional finding; document review is not statistical execution or scientific approval. |
| method-evidence-map | S | No additional finding; metadata, abstract, full-text and figure evidence are distinguished. |
| method-extract | S | No additional finding; unreported fields stay unreported; modal methods do not determine model choice. Search/reading caps are discovery limits. |
| method-fabric | W | No additional finding in routing/boundary screen; live platform and estimator behavior not validated. |
| method-figure | S | No additional finding in selected guide/assets; competing-risk incidence, ratio scales and uncertainty are explicit. A style/manifest pass does not validate plotted data. |
| method-genome-build | S | **F04**; manual traceability contract is stronger than the helper's current checks. |
| method-grill | S | No additional finding; probes falsifiability, measurement and design assumptions. |
| method-handoff | W | No additional finding; prior verification claims must be rechecked. |
| method-ideate | W | No additional finding; preliminary evidence pulse does not establish comprehensive novelty or feasibility. |
| method-journal-select | W | No additional finding; venue/indexing claims require sources and do not grade study quality. |
| method-language-detect | W | No direct scientific method; language detection is not methodological validation. |
| method-lit-search | S | No additional finding; a single search is not called a completed systematic review. |
| method-marimo | W | No additional finding; executable provenance and real versus synthetic output are distinguished. |
| method-meta-analysis | S | **F03**; compatibility and independent-contribution safeguards are useful; not a complete systematic review. |
| method-ml-track | S | No separate finding; protects test locking and alternative validation schemes. Tracking does not establish scientific validity; review the F05 handoff when used. |
| method-model-card | S | No additional finding in inspected schema/template; missing validation/fairness evidence is surfaced, not invented. Clinical approval is separate. |
| method-model-choice | S | **F05**; otherwise estimand-first routing, dependence, leakage and uncertainty are explicit. |
| method-notebook-edit | W | No additional finding; structural preservation and execution evidence do not certify scientific results. |
| method-notebook-standards | W | No additional finding; requires input/provenance evidence for persisted study results. |
| method-numbers | S | No additional scientific finding; provenance/formatting gates are expressly not estimator validation. |
| method-omics-qc | S | **F06**; modality thresholds are appropriately labeled project defaults, but identification cannot depend on those heuristics. |
| method-optimize | S | No additional finding; bounded tuning and a separate final assessment are explicit. |
| method-phenotype | S | No additional finding in selected design-aware formulas/helper/tests; not a new coverage study for every small-cell or subgroup design. |
| method-plan | S | No additional finding in selected SAP/planning contracts; unresolved data/model choices stay provisional. |
| method-power | S | No separate finding; downstream exposure to **F03** and cross-workflow conflict with **F02**. All supported numerical branches were not executed. |
| method-pr | W | No direct scientific method; scientific claims in PR descriptions still require real evidence. |
| method-prereg | S | No formal finding; registry timing and analysis history are explicit. Current policies of every registry were not independently refreshed. |
| method-presubmit | W | No additional finding in editorial contract; source/number checks and human accountability are explicit. |
| method-pubmed | S | No additional finding; discovery filters, incomplete retrieval and evidence levels are identified. Retrieval is not a systematic-review completeness guarantee. |
| method-question | S | **F07**; structured PICO/FINER and target-trial elements otherwise support reproducibility. |
| method-r | S | No additional finding in router/event-study reference; heterogeneous staggered-adoption effects and pretrend limitations are explicit. |
| method-release-notes | W | No direct scientific method; version/history claims remain source-dependent. |
| method-report-bug | W | No direct scientific method; reproducible issue collection does not validate an analysis. |
| method-resolve-feedback | W | No additional finding; methodological feedback is substantive and needs an evidence-backed response. |
| method-review | S | No additional finding in review/routing screen; persona agreement or confidence is not scientific proof. Delegated agents were not all audited. |
| method-sap | S | No additional finding in selected estimand, missingness and bias-analysis contracts. |
| method-sap-workbook | S | No additional finding; table schemas preserve claim, grain, methods and output traceability; no statistical calculations validated here. |
| method-sas-stata | W | No additional finding; assesses portability without claiming language-level statistical equivalence. |
| method-section-check | W | No additional finding; preserves required methodological rationale and uncertainty statements. |
| method-sessions | W | No direct scientific method; past-session statements remain historical context requiring verification. |
| method-setup | W | No additional finding in inference/configuration screen; detected environment is not study approval. |
| method-signoff | W | No additional finding; named human approval remains separate from a structurally valid ledger. |
| method-sprint | W | No additional finding; scoped artifact/computation checks are distinguished from human signoff. |
| method-submission-package | W | No additional finding; packaging/number gates do not invent or establish scientific results. |
| method-table1 | S | No additional finding in inspected workflow; RCT baseline tests are avoided and observational SMDs are conventional flags. Shell generation is separate from computation. |
| method-trial-design | S | No additional finding in selected engine/frontier contract; exact engine example execution was skipped because optional engines were unavailable. |
| method-update | W | No direct scientific method; installer migration helper reread after concurrent modification. |
| method-verify | S | **F01, F02**; several contextual checks are careful, but the recomputation gate currently produces false validation results. |
| method-voice | W | No additional finding; uncertainty and prespecified-test language should remain calibrated to evidence. |
| method-work | W | No additional finding in analytical execution gates; provenance/QA and explicit failure handling precede modeling. |
| method-workflow | W | No additional finding in routing screen; a workflow progress card is not evidence of scientific completion. |
| method-worktree | W | No direct scientific method; isolates changes without establishing result validity. |
| method-write | W | No additional finding in inspected drafting contract; placeholders, source support and human accountability preserve evidence boundaries. |

## Verification performed

### Existing deterministic checks

Two focused test invocations covered 11 distinct files: **80 pass, 2 skip, 0 fail**. They included power-reference guards, formal-synthesis code, phenotype validation, trial design/frontier checks, model-strategy contracts, guideline registries/versioning, figure workflow and statistic verification.

```sh
bun test tests/power-formula-guards.test.ts tests/clif-meta-analysis-code.test.ts tests/phenotype-validate-script.test.ts tests/trial-design-engine-example.test.ts tests/trial-design-frontier.test.ts tests/model-strategy-skill-contract.test.ts tests/newest-guideline-version.test.ts tests/reporting-guideline-registry.test.ts
bun test tests/verify-stats.test.ts tests/figure-workflow.test.ts tests/guideline-registry.test.ts
bun run eval:validate
bun run release:validate
```

`eval:validate` validated **32 behavioral case definitions**. It did not execute those cases. `release:validate` reported metadata in sync, with 55 agents and 68 Methodsmith skills. The skipped tests were the optional R trial-engine example and the Python unconverged Paule–Mandel publication check. The environment lacked rpact/gsDesign and the relevant Python numerical dependencies. No dependencies were installed.

Passing these checks is not evidence against F01–F08: the targeted counterexamples are missing from the relevant coverage. For example, some power checks assert reference text; they do not independently establish the numerical validity of every formula or software branch.

### Executed counterexamples

| Check | Observed evidence |
|---|---|
| Incorrect negative z P | `z=-2.00, P=.500` passed; central two-sided P was .0455003. |
| Incorrect negative t P | `t=-3.00, df=30, P=.500` passed; central two-sided P was .0053900. |
| Correct one-sided z P | `z=2.05, P=.0202, alpha=.025` failed; base R upper-tail P was .0201822. |
| t-based CI reconstruction | Source SE=1 and df=9 became SE=1.154162, variance=1.332090 under the helper's conversion. |
| Explicit VCF build mismatch | Synthetic GRCh37 reference/length/assembly audited as GRCh38 returned no issues. |
| Confounding without PC1/PC2 signal | Rank 2/3 despite zero condition correlations with PC1 and PC2. |

All examples were synthetic or arithmetic. Scratch evidence and logs are under `/tmp/methodsmith/scientific-audit/20261026/`; they are temporary and not committed. The essential inputs and outcomes are preserved above.

### MCP evidence and its limits

Exa searches retrieved current Cochrane guidance, official scikit-learn documentation, the SCCM bundle, and DESeq2 documentation. The DESeq2 confounding section was retrieved from the current full vignette; other source-specific limits include excerpted Cochrane material and selected package pages. PubMed returned 18 requested cited records; metadata/abstract access did not constitute full-text review of all 18 papers or citation verification of all 180 explicit PMIDs detected in skill Markdown.

Jev source screens returned `pass` for the retrieved groups used here, with injection probabilities 0.02–0.12. Five bounded source-reconciliation claims returned `verified`, none contradicted/unsupported, and none requiring review. Their complete `(supports, contradicts, says_nothing)` distributions were `(1,0,0)`, `(.99,.01,0)`, `(.98,.02,0)`, `(1,0,0)`, and `(.96,.04,0)`; confidence values were 1, .98, .97, 1 and .94. This was an advisory check against supplied excerpts/summaries, not independent expert validation, exhaustive source acquisition, or proof that a skill will behave correctly.

No live skill-creator behavior runs were performed. No behavioral change was made in this audit, so the repository's two-fresh-context acceptance requirement was not exercised. Any follow-up change to skill behavior must update its cases/eval set where applicable and run the required fresh-context evaluations, in addition to the numerical regression cases above.

## Recommended order of work

1. Repair F01 and F02 together around an explicit statistical-test/rounding contract, with independent numerical fixtures.
2. Repair F03 and F04 so a validation result cannot silently rely on the wrong uncertainty or absent reference evidence.
3. Correct F05 and F06 in both skill references and behavioral cases, testing the scientific target and identifiability rather than preferred wording.
4. Correct F07 and F08, then verify that the cohort/PICO/SAP handoffs preserve the revised definitions.

Before calling the full skill set scientifically validated, execute affected skills in the repository's fresh-context workflow and separately evaluate unsupported or unexecuted statistical branches. Preserve the distinction between syntactic tests, numerical validation, source fidelity and qualified scientific review.
