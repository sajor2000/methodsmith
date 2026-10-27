# Scientific rigor corrections

This change addresses F01-F08 from the 2026-10-26 scientific accuracy and rigor audit. The audit screened 69 shipped skills with risk-based deeper inspection; neither that screen nor these corrections establishes comprehensive scientific or clinical validity.

The fixes were reproduced and implemented from base `099d156e94e578213aa741e1d77a313b898097a8` on an isolated feature branch. The original checkout's unrelated edits were left untouched. No release-owned versions were changed.

| Finding | Corrected behavior | Regression evidence |
|---|---|---|
| F01 | Preserve printed precision and signed t/z rounding intervals, including zero crossings and scientific notation. | Negative-statistic false passes, sign symmetry, distinct decimal precision, equivalent exponent notation; independent base-R P values. |
| F02 | Validate ordinary test direction; honor upper/lower/two-sided t/z and upper-tail F/chi-square. Unknown sidedness and unsupported P constructions remain unchecked warnings. | Valid one-sided non-inferiority result at alpha .025; both directions; unsupported methods and invalid inputs; stable extreme tails. |
| F03 | Prefer a source SE on the declared scale; otherwise require a documented symmetric Wald interval, confidence level, rounding allowance, and t df when applicable. Never manufacture a symmetric non-Wald interval. | Base-R normal 95%, normal 90%, t9, log-ratio, reported-SE and rejection cases; full pooling runtime tests with `meta` 8.5-0. |
| F04 | Check available assembly/reference tokens, diagnostic chromosome lengths and MD5s. Distinguish incompatible, unknown, uninspected and compatible header evidence; scope T2T lengths to CHM13 v2.0. | Explicit GRCh37/38 mismatch without MD5, contradictory headers, missing tools/evidence, unsupported T2T, and naming-only incompatibility. |
| F05 | Distinguish historical period transport from forward validation. Forward assessment uses earlier-only training, patient grouping and justified outcome-maturation gaps. | Fresh-context three-period deployment advice; existing ML-prediction regression case. |
| F06 | Check design rank and contrast estimability independently of PC1/PC2; batch-deletion stability cannot rescue complete aliasing. | Fresh-context completely aliased design hidden from PC1/PC2. |
| F07 | Define adherence using indicated components and initiation rules; keep mortality ascertainment consistent after discharge. | Fresh-context normotensive patient without fluid/pressor indications and 30-day all-cause endpoint. |
| F08 | Determine baseline observability through index; handle subsequent disenrollment through censoring/ascertainment assumptions. | Fresh-context day-90 disenrollment remains baseline eligible. |

## Source and validation boundary

The original audit used Exa, PubMed and Jev MCP tools for primary-source checks. This correction pass refreshed [Cochrane CI-to-SE guidance](https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-06) and the official [TimeSeriesSplit contract](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html) through Exa MCP; Jev screening passed both retrieved sources. Other audit anchors include the official [DESeq2 rank-deficiency guidance](https://bioconductor.org/packages/release/bioc/vignettes/DESeq2/inst/doc/DESeq2.html#model-matrix-not-full-rank), [SCCM Hour-1 bundle](https://sccm.org/SCCM/media/SCCM/PDFs/Surviving-Sepsis-Campaign-Hour-1-Bundle.pdf), and [target-trial framework](https://pubmed.ncbi.nlm.nih.gov/26994063/).

Executable regressions were observed failing before the relevant numerical/header fixes, then passing. Prose changes use versioned synthetic cases and skill-creator fresh-context forward tests with the current source injected at dispatch. Case, prompt and target digests are recorded before dispatch; scoring fails closed on drift. Two runs per affected case are required. Full traces and run workspaces remain under `/tmp/methodsmith/behavioral-evals/`; only sanitized summaries belong in Git.

Header evidence does not establish complete sequence identity. Synthetic behavior tests do not establish clinical validity, exhaustive method coverage, or a validated accuracy rate.

## Executable verification and review

The final implementation is commit `424ce287291ce63a4bba4e2deced4dde4db2de05`. Its full local suite passed: **1,804 passed, 5 optional skips, 0 failed**, with 13,880 assertions across 122 test files. Type checking, release consistency, plugin validation, all 39 behavioral case definitions and whitespace checks passed. No website route changed; browser testing was not applicable.

The numerical checks used base R and independent reference calculations, including a `metafor` REML comparison. Full pooling integration ran with `meta` 8.5-0 installed in a temporary library. A working local Python 3.12 interpreter was selected because the default Homebrew Python 3.14 had an Expat library-loading failure. No dependency lockfile or system installation changed. The five skips cover optional website, trial-engine, Parquet, workbook-rendering and Python numerical dependencies. CI now installs and probes base R so its core uncertainty checks cannot silently skip for a missing interpreter; optional R package integration remains a local check.

Independent review reproduced five issues in the first candidate: ignored BAM assembly tags, incomplete CHM13 version parsing, ignored GENCODE assembly descriptions, roundoff rejection of exact Wald intervals, and a malformed reference-loading cue. Each was corrected with a failing reproduction and passing control. Further corrective reviews exposed held-out-label mutation false passes in the evaluator. The repairs preserve original provenance for partial writes, follow tuple/source aliases and accept supported training-only tuple/reset-index forms. All 61 independently authored tuning probes matched their expected decisions after repair; the genome review's 56 version/header controls also matched. These are bounded static-analysis and header checks, not execution of arbitrary Python or proof of sequence identity.

The first code-review verdict was "Ready with fixes"; its retained findings and the subsequent corrective findings were resolved. A Claude Opus 5.5 peer contributed source review; its effort setting was unverified and its attempted runtime review did not execute. The parent independently reproduced the concrete findings. The earlier candidate's Jev advisory result was `escalate`, with no concrete defect identified; it is not counted as a passing review.

The final Jev MCP gate also returned `escalate`: composite 0.616, safe-to-apply 0.20, with `truncated: true` and incomplete-context/low-confidence reasons. Four completion claims were labeled verified below automatic-acceptance confidence; the statistical-test coverage claim was unsupported, with no claim contradicted. The complete composed input was supplied within the documented size limits, but the service reported truncation. This advisory remains unresolved and is not counted as a passing gate. It identified no concrete additional defect. The passing executable checks and independent reproductions above remain the verification evidence; final human PR review is pending.

## Fresh-context acceptance

All **18 final runs across nine cases passed every hard gate**, with two independent generic contexts per case. Each dispatch injected the current on-disk skill source through skill-creator. `eval:prepare --complete` and `eval:score` recorded completion and scoring; `eval:report --k 2` checked the frozen manifests and aggregates. A separate digest check confirmed that every final case, prompt and entire skill directory still matches the prepared inputs and that the recorded run, response and evaluation files remain unchanged.

| Case | Run 1 | Run 2 |
|---|---|---|
| Statistical test contract | 8/8 | 8/8 |
| Uncertainty extraction | 12/12 | 12/12 |
| Genome evidence | 8/8 | 8/8 |
| Forward temporal validation | 8/8 | 8/8 |
| Hidden omics aliasing | 8/8 | 8/8 |
| Indicated bundle components | 8/8 | 8/8 |
| Baseline observability | 6/6 | 6/6 |
| Compatible meta-analysis anchor | 12/12 | 12/12 |
| ML prediction regression | 94/94 | 94/94 |

The [sanitized evidence manifest](2026-10-26-scientific-rigor-evidence.json) records all 36 launched runs, including superseded candidates: 33 passed and three failed under their original graders. Two question-case failures rejected correct mortality-ascertainment qualifiers; one ML-case failure rejected supported training-only tuple/reset-index code. The grader corrections retain explicit negative controls for wrong endpoints, missing ascertainment and held-out-data leakage. Those historical evaluations were preserved unchanged; acceptance uses fresh runs after the relevant source and grader corrections. The original three skill-creator scenarios and balanced trigger/near-miss sets were retained.

Two passing observations per case do not establish a reliable error rate. The tests exercise synthetic decision contracts and scaffold structure; no clinical model was fitted, no assay QC was performed, and no literature pool was estimated by the behavioral evaluators. Human scientific review remains pending.

## Base drift

Before publication, `origin/main` had advanced to `e05b7f68f2bd0135dd9251b7f130d2e371123b53`, including boundary-hardening and CLIF changes. A read-only `git merge-tree --write-tree HEAD origin/main` succeeded without conflicts, producing tree `1ba9b86f06152e1bb67e23c85129f0e210331d4d`. The overlapping changes concern state/config paths, evidence-access prose and README inventory; they do not replace these scientific corrections. No branch history was rewritten and the original checkout was not modified. The local counts above describe the tested feature-branch source; PR CI will exercise the combined tree.
