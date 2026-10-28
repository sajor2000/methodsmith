# Collaborative research lifecycle: implementation and verification

Date: 2026-10-27. Branch: `docs/release-market-audit-20261027`.
Plan: `docs/plans/2026-10-27-0929-feat-collaborative-research-lifecycle-plan.md`.

## Outcome

Local implementation of the study/revision foundation and integrations is present.
The complete plan is **not yet release-validated**. No commit, push, PR or release
was created in this implementation run. The earlier audit and plan are preserved.

## Implemented

- `method-study`: protected local inventory, expected-revision updates under a
  writer lock, digest/dependency freshness, run evidence, content-bound recorded
  approvals, one manuscript master, non-overwriting handoffs and preserved
  submission copies. Unknown historical provenance stays unknown.
- Four native-format execution adapters: Jupyter fresh kernels, marimo export,
  fresh-process R Markdown, and Quarto execution. Protected run logs and copies;
  explicit execution authorization; missing engines do not pass. These helpers
  are not execution sandboxes or scientific validators.
- `method-revision`: stable comments, shared change IDs, multiple-round guidance,
  explicit dispositions and evidence-bound response states. The validator checks
  retained file hashes and rejects completion claims for merely implemented work.
- Content-bound signoff v2 with legacy v1 readability and explicit limits.
- Citation reports expose identity, claim-support and access-level separately.
  Legacy `FABRICATED` remains wire-compatible but is explained as not-found,
  not proof of fabrication. Claim support still requires actual evidence review.
- Dated journal profiles with required-rule/evidence checks; preservation and
  scientific-content comparison instructions for journal transfers.
- Safe status projection and responsive visual cards. Protected paths, notebook
  values and reviewer comments are not copied into the projection. Git review
  binds exact staged bytes and outgoing history to a human disclosure record;
  this is not an automated PHI detector or an authenticated-signature service.
- Existing lifecycle, notebook, figure, number, run tracking, citation, signoff,
  submission and PR skills route through these contracts. Documentation and
  displayed inventories reflect 72 skills. No release versions changed.

## Verification performed

- Full suite: **1969 pass, 10 skip, 0 fail**, 1979 tests across 131 files.
  Command: `PATH=/tmp/methodsmith/lifecycle-framework-venv/bin:$PATH bun test`.
  Log: `/tmp/methodsmith/lifecycle-tests-verified.log`.
- `bun run typecheck`, `bun run release:validate`, `bun run eval:validate`,
  `bun run legacy:fingerprints`, and `git diff --check` passed.
  Behavioral validation covers 41 case definitions; it is not a live model run.
- Regression proof observed before implementation for intake, conflicting writes,
  stale dependencies after refresh, content-bound approval, journal evidence,
  reviewer completion claims and separate citation identity/support fields.
- Live synthetic Jupyter success/error runs passed. The error test includes an
  allowed-error tag and still fails verification. Sources remain unchanged.
- Live synthetic marimo success/error and R Markdown success/error runs checked.
  An R Markdown `error=TRUE` render initially passed despite a failed chunk;
  the adapter now overrides that option for verification and its regression test
  confirms failure without leaking error content into stdout.
- Word handoff tests prove byte preservation and refusal to overwrite external
  edits. Existing DOCX number/field tests pass in the full suite. These are not
  live Word/Zotero integration checks.
- Status preview inspected at desktop and phone widths, with no browser console
  errors. Narrow layouts expose every evidence field as a card. Synthetic sample:
  `/tmp/methodsmith/lifecycle-preview/status-final.html`.
- Runtime checks used Python 3.13.3 in a temporary virtual environment, marimo
  0.19.11 and R 4.5.0. The system Python was not modified. The temporary environment
  avoids the default interpreter's missing notebook dependencies/XML problem.

## Review and remaining gates

Inline inspection and simplification retained portable skill-owned helpers,
removed avoidable evaluation-file formatting churn, and corrected stale
transitive dependencies, manuscript handoff visibility and failed R chunk status.

The user authorized sequential fresh-context agents. Three independent bounded
code-review rounds are now recorded below; all five reproduced defects were fixed
and independently closed. This is not a full multi-persona `ce-code-review`
receipt. Both new lifecycle cases have passed twice with frozen input digests;
remaining affected existing cases and wider acceptance coverage are still pending.

Outstanding before claiming the full plan complete or release-ready:

1. Run the affected behavioral cases twice in genuinely fresh contexts with
   frozen case/prompt/target hashes and inspect the traces.
2. Exercise the complete three-pathway by four-format acceptance matrix.
   Quarto is not installed here; its execution adapter remains runtime-unverified.
3. Verify actual Word/Zotero editing and Refresh in the supported application.
4. Obtain the planned physician investigator, biostatistician and data scientist
   task-based scientific assessment. An agent cannot supply these signoffs.
5. Complete independent code review and resolve the separate release audit's
   release-pipeline blockers before publication.

A current content digest, successful render, valid profile or passing synthetic
test is never reported as clinical validation, citation-support proof, human
approval or successful journal submission.

## JEV advisory result

The final JEV gate returned `escalate`: composite 0.6552 and minimum
`safe_to_apply` 0.19, with low confidence on specification/blast radius and test
coverage. It named no concrete code defect. Both submitted completion claims
were verified (test-count confidence 1.0; incomplete-release-status confidence
0.94). This is unresolved advisory review, not patch approval; no unchanged
retry was made. Receipt: `/tmp/methodsmith/lifecycle-review/jev-gate.json`.

The request included all source/test/document changes in bounded patch groups.
The generated one-line SVG exceeded the per-file tool limit; its sole change
(`70 skills` to `72 skills`) was checked by exact byte replacement and disclosed
in the review input. The gate reported no truncation. This limited asset check
is not an independent review of the rendered brand asset.


## Independent review R1 and remediation

The user authorized sequential fresh-context review/evaluation agents on 2026-10-27.
An independent read-only reviewer reproduced three defects: old-run replay after
input changes, unchecked retained execution outputs, and historical output in
Jupyter skipped cells. The report is retained locally at
`/tmp/methodsmith/review-r1-findings.md`.

The adapter now captures declared study input bindings before execution, checks
them afterward, and requires matching bindings when attaching evidence. Retained
output files have contained relative locators and content hashes checked on
attachment and status. Jupyter skip tags block verification and historical output
is cleared in the execution copy without changing the source or running excluded
code. New regressions exercise all three reproductions, including deleted output.
Targeted validation: **10 passed, 0 failed** across study-record and notebook
evidence tests using the isolated Python environment. Independent re-review and
the full-suite rerun remain pending; this does not close scientific signoff.


### R2 remediation

Fresh-context R2 independently confirmed all three R1 fixes and reproduced two
additional gaps (report `/tmp/methodsmith/review-r2-findings.md`). Effective
coverage now propagates through every dependency and gates downstream approval.
Run attachment/status validate a versioned contract, typed timezone-aware ordered
timestamps, typed environment, outcome/exit/coverage consistency, and required
primary execution-output identity/hash. Successful Jupyter evidence cannot
report skipped cells. Eight malformed-record variants and a multi-level coverage
regression were added. Targeted result: **11 passed, 0 failed**, 91 assertions.
Full-suite rerun and independent closure check are in progress.

### R3 closure and full-suite result

Independent R3 closed both R2 findings, rejected ten malformed variants, and
successfully attached genuine Jupyter, R Markdown and marimo runs using study
bindings. Report: `/tmp/methodsmith/review-r3-findings.md`. No remaining concrete
defect was established within that bounded review scope.

Full-suite rerun: **1,971 passed, 10 skipped, 1 failed**, 1,982 tests. The failure
is `method-plan/SKILL.md` at 17,024 bytes exceeding the 16,000-byte contract. That
file acquired outside-task edits during this session; ownership clarification is
pending before modification. Log: `/tmp/methodsmith/lifecycle-tests-r2.log`.
The first frozen fresh-context method-study lifecycle evaluation is in progress.

### Behavioral evaluation progress

`method-study-lifecycle`, frozen run `study-lifecycle-20261027-01`, model
`gpt-6-astra`, passed 4/4 weighted points, all hard gates and credential scan.
Direct response inspection found explicit unknown provenance, incomplete coverage,
no claimed inspection/execution, preserved Jupyter format, and no unsolicited
marimo conversion. These narrow text gates plus response review do not establish
runtime or scientific validity. Independent repeat 02 is running with the same
frozen source; no prior response or grading criteria were supplied to its agent.


### Completed lifecycle behavioral repeats and release-audit fixes

Both `method-study-lifecycle` and `method-revision-lifecycle` passed twice in
independent fresh contexts, model `gpt-6-astra`: each run 4/4 points, all hard gates
and credential scans passed. Response inspection confirmed unknown historical
provenance, no invented execution or conversion, shared reviewer-change identity,
and partial responses for unrun analysis. Aggregate report:
`/tmp/methodsmith/lifecycle-behavioral-report.json`. These are narrow synthetic
routing/claim checks, not the complete acceptance matrix or clinical validation.

Release creation now depends on a reusable same-commit CI workflow. Release-branch
test skipping and release-merge metadata skipping were removed. Workflow
concurrency separates standalone CI from the release caller. CI installs notebook
execution dependencies so Jupyter regression tests run there. New release-gating
and inventory-table tests pass (2 tests, 21 assertions); release metadata passes
with 72 skills and 55 agents. GitHub-hosted execution is not yet verified.

Prominent README safeguard claims now specify Claude Code, Python, heuristic
limits and instruction-only behavior on other hosts. Setup includes a host table;
research-tool disclosure text describes policy rather than guaranteed prevention.
The README links the runnable BCG example and describes the inventory as agents,
including reviewers and researchers. Versions remain automation-owned.

### Exact-candidate release hardening

Release review R1 found that Release Please discovers pending release commits
independently of the triggering checkout. The creation wrapper now checks all
candidate SHAs against the validated event SHA and freezes that candidate set
before calling the pinned release-please 17.1.3 library. The upstream action is
limited to PR maintenance (`skip-github-release: true`). A mismatched old pending
candidate blocks; rerun its original validated workflow rather than bypassing it.

R2 confirmed that fix and found existing-tag and partial-retry issues. Tags are
now established at the validated SHA and dereferenced (including annotated tags)
before and after creation. A conflicting create/readback fails; mismatched tags
are never moved. The publish checkout uses the validated SHA directly. Durable
root release existence plus tag binding reconstructs the publish signal across
partial/cancelled retries, including the library's all-duplicate exception.
Later administrative tag movement remains outside this local transaction;
repository tag protection and hosted execution still need verification.
Reports: `/tmp/methodsmith/release-gating-review-r1.md` and `release-gating-review-r2.md`.


### Quarto runtime findings

Quarto 1.10.19 was downloaded from its official release into `/tmp/methodsmith/`
without a system install. The synthetic success/error probes first identified
missing temporary-environment dependencies, then demonstrated that an allowed
error chunk rendered successfully. The adapter now disables caching/daemon reuse,
retains the Jupyter execution notebook, and rejects error outputs or unexecuted
code cells. Attachment/status validate the same retained execution evidence.
Quarto engines without retained Jupyter evidence remain explicitly unavailable;
knitr-based `.qmd` verification is not implemented. Native `.Rmd` remains supported.

This changes the method-study whole-directory digest, so the two prior study
behavioral runs remain historical evidence and must be repeated against the final
source before claiming current-source acceptance. Revision-case digests are
unchanged. Release R3 independently closed tag-binding and partial retry findings;
report `/tmp/methodsmith/release-gating-review-r3.md`.

Quarto regression result: **6 notebook tests passed**, including true success,
allowed-error rejection and `eval: false` rejection. Quarto assigns execution
counts even to excluded cells, so retained counts alone were insufficient; explicit
evaluation overrides are also checked. The synthetic adapter matrix passed
**12/12**: clinical difference-in-proportions arithmetic, simple seeded prediction,
and inverse-variance arithmetic in Jupyter, marimo, R Markdown and Jupyter-backed
Quarto. This is adapter/evidence smoke coverage, not the full scientific lifecycle
acceptance matrix. Existing-skill fresh-context evaluations are still running
sequentially (14 planned runs across 7 covered cases).

Final-candidate full-suite rerun with the isolated Python and Quarto runtimes:
**1,991 passed, 10 skipped, 1 failed**, 2,002 tests / 133 files. The sole failure
remains the concurrently edited `method-plan/SKILL.md` size contract; no new
failure appeared in lifecycle, release or notebook checks. Log:
`/tmp/methodsmith/lifecycle-tests-final-candidate.log`. Ownership clarification
for that outside-task edit is still pending, so it has been preserved.

Existing covered targets completed **14/14** fresh-context runs (7 cases twice):
ML tracking, numerical traceability, setup boundary, two submission-package cases,
approved-boundary work and workflow synthesis. Every criterion, hard gate,
credential scan and final digest check passed; transcript review found no semantic
failure. Summary `/tmp/methodsmith/lifecycle-existing-eval-summary.md`; aggregate
`/tmp/methodsmith/lifecycle-existing-eval-aggregate.json`.

Coverage remains absent for nine modified targets without repository cases:
notebook-edit, notebook-standards, marimo, r, figure, signoff, citations,
journal-select and pr. COI subjects correctly reported missing fixture dependencies;
their passes do not prove a complete submission package. Final study-source review
and two refreshed study-intake runs are pending after Quarto changes.

The final Quarto review found a further false-success path through flow-style YAML
`execute: {eval: false}`. That review stopped before dispatching the study repeats;
its failed evidence is preserved at `/tmp/methodsmith/lifecycle-final-study-validation.md`.
Execution-option checks now use safe YAML parsing for document and cell options,
including aliases, instead of line-only matching. Missing PyYAML, malformed or
unsupported options fail closed. CI installs PyYAML explicitly. Expanded native
runtime tests: **18 passed, 0 failed**, 117 assertions, including flow-style and
alias skip regressions. Independent closure and final study repeats remain pending.

A subsequent independent probe found format-specific `format.html.execute.eval`
was not checked. The structural validator now walks every YAML branch, rejects
non-true evaluation settings, rejects external metadata includes and cyclic
options, and parses frontmatter on delimiter lines (including CRLF normalization)
rather than splitting on arbitrary `---` text. Conservative inactive-branch
blocking is documented. Expanded notebook regressions: **7 passed**, 73 assertions,
including real Quarto nested-format exclusion and titles containing `---`.
Log: `/tmp/methodsmith/quarto-final-structural-regressions.log`. The preceding
failed review and unrun evaluation state remain preserved in
`/tmp/methodsmith/lifecycle-final-study-validation-r2.md`.

R3 then reproduced an inherited `_quarto.yml` exclusion missing from retained
notebook frontmatter. Quarto support is now explicitly limited to standalone
documents: inherited project configurations and profile/project environment
overrides block before execution; the helper does not override their exclusions.
Accepted documents run under a retained isolated `_quarto.yml`, whose exact
configuration is required at attachment/status. Unsupported project-based and
knitr-based Quarto verification remains a documented limitation. Native tests:
**20 passed, 0 failed**, 124 assertions. Log:
`/tmp/methodsmith/quarto-isolated-project-tests.log`. Final closure/evaluations pending.

R4 verified project isolation but found Quarto moved `skip-execution` into retained
cell metadata while still assigning a positive count. Completeness now checks
retained cell metadata and YAML tag lists for execution exclusions without
removing them. The native skip-tag regression and retained-notebook unit probe
reject this combination. Notebook regression result: **8 passed**, 79 assertions;
log `/tmp/methodsmith/quarto-tag-regressions.log`. Final review/evaluations pending.

Final study closure R5 passed: 20 regression tests / 127 assertions and 28 bounded
probe checks, including false-success attachment rejection. Both final-source
study-intake subjects passed 4/4 and all hard gates; transcripts were inspected.
Report: `/tmp/methodsmith/lifecycle-final-study-validation-r5.md`.

The remaining skill-size issue was fixed without deleting the outside-task grill
addition: four existing general principles and the detailed output-mode paragraph
were moved verbatim to a same-skill reference with mandatory read links.
`method-plan/SKILL.md` is now 15,862 bytes. Structure/data-first tests pass. Missing
optional runtime probes now skip instead of throwing ENOENT; a no-Quarto run
passed 42 tests with 4 expected skips. Final full suite with Quarto is rerunning;
two fresh planning-case checks are pending for the reference extraction.
