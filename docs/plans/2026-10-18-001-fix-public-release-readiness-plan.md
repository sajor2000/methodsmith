---
title: Public-release readiness remediation
status: in-progress
date: 2026-10-18
base: fix/public-release-readiness
---

# Public-release readiness remediation

Follow-up to the pre-release debrief and the review against Matt Pocock's
engineering skills. This plan records what the readiness branch fixes and what
is deliberately deferred to tracked issues.

## Scope

Make the repository safe and accurate for a public release: close the
sensitive-data egress gap for Claude web tools, remove work contact addresses
from shipped reference material, finish the dependency cleanup started in PR
#62, add the governance and research-use documents a public repository needs,
and record the deferred work as issues rather than leaving it in prose.

No release-owned version is hand-bumped. PR #112 (release-please) is left
untouched and tracked as [issue #123](https://github.com/sajor2000/methodsmith/issues/123).

## Fixed in this branch

1. **Claude web-tool egress.** The hook matcher now registers `WebFetch` and
   `WebSearch`; `data-boundary-guard.py` scans their string-valued inputs with
   the existing identifier patterns and index, and denies without echoing the
   match. Regression tests were written first and failed before the change.
2. **Dependency cleanup folded in from PR #62.** `@semantic-release/changelog`,
   `@semantic-release/git`, and `semantic-release` are removed; js-yaml is
   raised to `^5.4.2` (lock resolves to 5.5.0); TypeScript 5.9.3 is pinned in
   devDependencies. The lockfile was regenerated with `bun install
   --ignore-scripts`.
3. **Frontmatter round-trip.** Raising js-yaml exposed an empty-string
   serialization bug: an empty `description:` parsed back as null. Empty
   strings are now quoted, and `tests/frontmatter.test.ts` passes.
4. **Work contact addresses removed.** `references/poc-table.md` keeps names and
   GitHub handles and drops every address; the consortium contact line in
   `clif-rules.md` points at the public CLIF site and GitHub organization. The
   refresh policy now says not to mirror contact addresses.
5. **Boundary documentation.** The three sensitive-data boundary sections
   (`README.md`, `plugins/methodsmith/README.md`, `docs/setup.md`) state that
   the check covers `WebSearch`, `WebFetch`, MCP arguments, and detected shell
   uploads, and that a missing `python3` leaves the guard inactive with a
   warning. The three sections stay identical; `tests/phi-environment-gate.test.ts`
   enforces it.
6. **AI-use disclosure.** `method-write`, `method-presubmit`, and
   `method-submission-package` require the ICMJE disclosure: name the tool and
   its purpose in the cover letter and the manuscript, never list an AI tool as
   an author, and keep a human accountable.
7. **Bias and confounding guidance.** `method-sap` gains a bias-analysis
   guardrail and `references/bias-sensitivity.md`, covering the E-value and its
   limits, the bound for a known but unmeasured confounder, and quantitative
   bias analysis practice. Citations were verified against PubMed.
8. **Public repository documents.** `SECURITY.md`, `CONTRIBUTING.md`,
   `CODE_OF_CONDUCT.md`, `CITATION.cff`, and the GitHub issue forms were added;
   the README, setup guide, plugin README, and website carry research-use and
   not-a-medical-device language.

## Deferred to tracked issues

| Issue | Work |
|---|---|
| [#119](https://github.com/sajor2000/methodsmith/issues/119) | Risk-of-bias and appraisal checklists: RoB 2, ROBINS-I, PROBAST (+PROBAST-AI), AMSTAR 2 |
| [#120](https://github.com/sajor2000/methodsmith/issues/120) | Reporting checklists: TIDieR, RIGHT, SRQR, PRISMA-S |
| [#121](https://github.com/sajor2000/methodsmith/issues/121) | CONSORT-Outcomes 2022 and SPIRIT-Outcomes 2022 |
| [#122](https://github.com/sajor2000/methodsmith/issues/122) | Public documentation accuracy review pass |
| [#123](https://github.com/sajor2000/methodsmith/issues/123) | Resolve the pending release-please PR #112 after this merges |
| [#124](https://github.com/sajor2000/methodsmith/issues/124) | Independent biostatistician review of the `method-*` statistical guidance |

## Deliberately not changed

- **`plugins/coding-tutor` stays.** It is a release-managed plugin with
  release-please configuration, manifest entries, converter tests, and install
  paths. It is not listed in any of this repository's three marketplaces, and
  its Cursor manifest still carries upstream `homepage`/`repository` values.
  Whether that attribution is intended is a documentation question, tracked in
  [#122](https://github.com/sajor2000/methodsmith/issues/122); it is not deleted
  here.
- **`ce-*` rename tables stay.** The old-to-new command tables in `README.md`,
  `docs/setup.md`, `plugins/methodsmith/README.md`, and
  `method-update/references/renamed-commands.md` are intentional migration
  documentation, not residue.
- **Historical plans under `docs/plans/` keep their old paths.** They record
  what was true when written.

## Validation

- `bun test` (full suite), `bunx tsc --noEmit`, `bun run release:validate`, and
  `bun run eval:validate`.
- Website build for the changed landing-page copy.
- Behavioral eval cases are unchanged because no skill description changed;
  `bun run legacy:fingerprints` is therefore not required. Re-run it if a
  description changes before merge.

## Progress

- **#123 resolved.** After PR #125 merged, release-please refreshed PR #112
  against the new base; it closed as superseded.
- **#119 implemented** on `feat/appraisal-checklists`: RoB 2, ROBINS-I,
  PROBAST+AI (supersedes PROBAST-2019; aliases `probast`, `probast-2019`), and
  AMSTAR 2 (supersedes AMSTAR 1) checklists with `role: appraisal` registry
  entries, a distinct appraisal layer in routing, and registry parity tests;
  the registry grows 39 -> 43. Citations verified against PubMed on
  2026-10-18.
- **#120 implemented** on `feat/reporting-checklists`: TIDieR, RIGHT, SRQR,
  and PRISMA-S checklists registered as `TIDIER`, `RIGHT`, `SRQR`, and
  `PRISMA-S` (registry 43 -> 47, verification date advanced to 2026-10-19).
  PRISMA-S item text is quoted verbatim under its CC BY 4.0 licence; TIDieR,
  RIGHT, and SRQR are paraphrased (BMJ, Annals, and Acad Med carry no open
  licence). Routing gains a cross-cutting extension layer (TIDieR, PRISMA-S),
  a practice-guideline primary (RIGHT), and a pick-one SRQR/COREQ rule.
