---
title: MedSci Skills competitive audit
status: active
date: 2026-10-19
module: competitive-research
problem_type: research
tags: [competitive-analysis, positioning, gaps]
---

# MedSci Skills competitive audit

Audit of [Aperivue/medsci-skills](https://github.com/Aperivue/medsci-skills) —
"Agent Skills for medical research" — against Methodsmith. Requested to check
whether the comparison in the README is still accurate and to identify gaps.

**Source of record:** their `main` README and
`docs/competitive_positioning.md`, both read 2026-10-19. Their latest release at
that date was **v6.1.0** (2026-10-04); the repository had 346 stars, 80 forks,
61 releases, 1,075 commits, and 9 contributors. They state 54 skills and 93
deterministic detectors, and ship a Zenodo DOI plus an arXiv preprint.

## Corrections to our README

One claim was stale and is fixed in the same change:

| Claim | Was | Now verified | Action |
|---|---|---|---|
| Their reporting checklists | "46 guidelines" | Their README states **49** "reporting guidelines and risk-of-bias tools" | Corrected. The count is no longer a differentiator, so the row now leans on how the checklists are encoded (official item IDs, newest-version-only enforced by test) |

Two rows were also sharpened for accuracy, both verified against their
positioning doc: they do chain skills in defined sequences (so "router, no
compound step" understated them; there is still no compound/learnings step),
and they do produce an analysis plan inside `/analyze-stats` (so "not
SAP-centred" becomes the more precise "analysis plan, no estimands").

## Where Methodsmith leads

Verified by reading their README and positioning doc. Keep these in the
comparison and in the pitch:

- **Enforced PHI boundary.** We ship a `PreToolUse` hook that blocks data reads
  and identifier egress. Theirs is a `/deidentify` skill plus the instruction
  "do not give an agent identifiable patient data" — discipline and a
  pseudonymisation pass, not enforcement at the tool layer. They state the same
  caveat we do ("not clinically validated").
- **Parallel specialist reviewers.** We ship 55 agents that run and get
  deduplicated. Their catalogue is skills plus detectors; they describe no
  reviewer-agent layer.
- **Estimands.** ICH E9(R1) estimands in the SAP, with estimand drift detection.
  They have no estimand concept.
- **Per-number provenance.** Our registry traces each reported number to a SAP
  output, script commit, and source hash, with a fail-closed gate. They have
  "drift guards" but not per-number provenance to a commit.
- **Harness breadth.** Our converter covers Pi, Gemini CLI, Kiro, OpenCode and
  Qwen Code beyond the four they support.

## Gaps

Ranked by impact on adoption for our audience. Each is something they ship that
we do not.

### High

1. **No citable artifact.** They have a Zenodo concept DOI
   (`10.5281/zenodo.20155321`) and an arXiv preprint describing their
   architecture, plus a README citation block and `CITATION.cff`. We have
   `CITATION.cff` only. For a tool whose audience publishes, "cite the version
   you used" is a real trust signal, and it is how a tool accrues academic
   legitimacy. *Recommendation: archive tagged releases to Zenodo through its
   GitHub integration and add the DOI badge and citation block. Requires a
   maintainer action; the repo side is small.*

2. **No standalone reference-integrity gate.** Their `/verify-refs` takes a
   manuscript or bibliography (`.md`, `.docx`, `.bib`, `.txt`, `.tsv`) and marks
   every reference `OK`, `MISMATCH`, `UNVERIFIED`, or **`FABRICATED`** after
   PubMed, CrossRef and OpenAlex lookups, writing `qc/reference_audit.json`. We
   have `method-citations`, which verifies metadata through PubMed while
   building an editable DOCX, and it explicitly forbids inventing references —
   but we do not document a bibliography-audit mode that flags fabricated
   references in an existing list, and we do not use CrossRef or OpenAlex.
   *Recommendation: add an audit mode to `method-citations` (or a sibling
   skill) that scans a bibliography and reports per-reference verdicts.*

3. **No no-terminal install.** They ship a double-click classroom installer for
   Windows and macOS that also installs a desktop update shortcut, plus
   step-by-step setup guides for users without Python or Node. Our install is
   `install.sh` / `install.ps1` or a Claude Code plugin command — all terminal
   or agent-mediated. Our audience is statisticians and clinician-researchers,
   the group least likely to be comfortable in a terminal.
   *Recommendation: decide whether a packaged installer is in scope; at minimum,
   make the non-terminal Claude Code path unmistakable.*

### Medium

4. **No arithmetic self-consistency checks.** Their detector suite recomputes
   reported *P* values from printed *t*, *F*, *chi²* and *z* statistics and runs
   GRIM checks against declared means, flagging a decision error as Major. Our
   number registry proves *provenance* (where a number came from) but does not
   recompute whether a reported statistic is internally consistent.
   *Recommendation: add a recomputation gate to `method-verify`. This is the
   most substantive methodological gap and needs careful implementation.*

5. **Thinner submission lane.** They have `find-journal`, `add-journal`,
   `fill-icmje-coi` (ICMJE conflict-of-interest forms), `sync-submission`
   (submission drift control), and `grant-builder`. We have
   `method-submission-package`, `method-presubmit`, and `method-signoff`.
   Missing: journal selection, COI form filling, grant building, and submission
   drift control. *Recommendation: journal selection and ICMJE COI are the two
   with the clearest fit; the others are optional.*

6. **No committed reproducible demos.** They ship five end-to-end demo projects
   on public datasets with code, outputs, and QC reports committed to the
   repository (diagnostic accuracy, meta-analysis, survey epidemiology, model
   engineering, external validation), including one that documents where the
   model failed. We ship a scripted tour video and a synthetic terminal
   transcript. A committed demo is stronger evidence than a video because a
   reader can rerun it. *Recommendation: add one or two demo projects with
   committed outputs.*

7. **`gh skill install` is undocumented.** GitHub CLI 2.90+ can install skills
   directly (`gh skill install Aperivue/medsci-skills --all --agent
   claude-code --scope user`). We document no such route. *Recommendation: verify
   it works for our repository and add it to the install table; low effort.*

### Low

8. **No internationalisation.** They ship Chinese and Korean READMEs and 12
   country locale packs for de-identification. Our identifier patterns are
   US-centric (SSN, US phone format). Non-US sites are a real share of the
   audience. *Recommendation: locale packs for identifiers would strengthen the
   PHI guard more than translated READMEs would; treat as future work.*

9. **No imaging lane.** They cover radiomics, medical-imaging model validation
   (`model-assessment`, MONAI/nnU-Net integration), and multimodal LLM
   evaluation. We have `method-omics-qc` but nothing for imaging. *Recommendation:
   out of scope unless imaging AI becomes a target audience.*

10. **No machine-checked third-party notices.** They ship `THIRD-PARTY-NOTICES.md`
    checked against the tree on every build, because some bundled guideline
    templates are CC BY-NC. We paraphrase guideline text and record licence
    status per entry in `guideline-registry.yaml`, enforced by test, but we do
    not publish a consolidated notices file. *Recommendation: consider adding one
    derived from the registry.*

## What not to copy

- Their scope is deliberately narrower than ours (one physician-researcher's
  clinical-manuscript pipeline, biased toward radiology and diagnostic
  accuracy); several of their skills are out of scope for us by design.
- Their positioning doc argues explicitly against skill-count comparisons. That
  is the right instinct and matches our own README, which is why the corrected
  checklist row now leans on encoding rather than count.
- We already decided against badge walls and autonomy framing in
  [`docs/brand/research.md`](../brand/research.md); this audit does not
  change that.

## Observation

Their `docs/competitive_positioning.md` compares itself against K-Dense,
OpenClaw, AIPOCH, and Orchestra AI, and does not mention Methodsmith. We are not
currently on their radar; the audit is therefore about closing real gaps rather
than countering a specific claim.

## Recommended next actions

In priority order:

1. Archive a release to Zenodo and add the DOI (maintainer action).
2. Add a bibliography-audit mode that flags fabricated references.
3. Decide on a no-terminal install path.
4. Add a statistic-recomputation gate to `method-verify`.
5. Add journal selection and ICMJE COI skills.
6. Add one committed reproducible demo project.
7. Document the `gh skill install` route.

## Closure record (2026-10-19)

- Gap #2 (reference integrity): closed by `method-citations`
  `scripts/verify_references.py` (PR #138) — extract/classify/audit with
  OK/MISMATCH/UNVERIFIED/FABRICATED verdicts.
- Gap #4 (statistic recomputation): closed by `method-verify` check 9
  `scripts/verify_stats.py` (PR #140) — P recomputation from t/F/chi2/z with
  rounding envelopes at the declared alpha, and rounding-aware GRIM.
- Gap #5 (submission lane): journal selection closed by the
  `method-journal-select` skill. ICMJE COI remains open as a decision: the
  checklists already demand COI disclosures and nothing in the lane collects
  them, but a workflow step inside `method-submission-package` (collect
  declarations, produce form-ready data, cross-check the manuscript's COI
  statement) may serve better than a standalone skill.
- Gaps #1, #3, #6, #7: deliberately not taken (maintainer action, audience
  decision, optional).

## Closure record (2026-10-21)

The ten gaps were filed as tracked issues (#141-#148). Current state:

- Gap #1: open as #141 — Zenodo archive and DOI; maintainer action, awaiting
  the account link on zenodo.org.
- Gap #3: closed by the docs-only fallback (PR #154) — the no-terminal path is
  documented for every Claude Code surface; the packaged classroom installer
  stays out of scope unless the issue is reopened.
- Gap #5: closed — journal selection landed as `method-journal-select`
  (PR #151), and ICMJE COI took the Option B path recorded above: a
  collect-and-cross-check step inside `method-submission-package` (PR #153)
  with a behavioral eval case for the funding/COI-statement mismatch blocker.
- Gap #6: closed as #144 — one committed reproducible demo project
  (`demo/bcg-meta-analysis/`, PR #160): a public-data meta-analysis
  (metafor::dat.bcg, 13 RCTs, no PHI) with the real run's outputs checked
  in, deterministic to rerun, mapped to the plugin's drafting lane, and
  carrying an honest limitations note.
- Gap #7: closed by PR #150 — the `gh skill install` route verified on
  gh 2.100.0 (pinned installs, plugins/ convention discovery) and documented,
  with the tests/fixtures sweep noted as a caveat.
- Gap #8: closed as #146 — locale packs shipped as pure data (PR #159,
  docs parity in #162): `hooks/locales/uk.json` is the template pack (NHS
  number and Scottish CHI with checksum validators, the unit postcode as a
  quasi-identifier, column-name patterns), opt-in via
  `phi_environment.locale`; checksum-INVALID synthetic fixtures pass by
  design; a malformed or unknown pack fails closed. New countries need no
  guard-code changes.
- Gap #9: wontfix, recorded as #147.
- Gap #10: closed by the machine-checked `THIRD-PARTY-NOTICES.md` (PR #149),
  generated from this registry and the checklist licence headers.
