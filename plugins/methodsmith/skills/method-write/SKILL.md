---
name: method-write
description: "Drafts, revises, and audits evidence-bound manuscripts, sections, abstracts, and reviewer responses with claim provenance. Use when scientific prose must be written or revised (entry point)."
---

# Scientific Writing

## Skill Value

- **Problem it solves:** Scientific prose can sound polished while drifting from the study question, analysis, evidence, or target publication.
- **Use when:** Planning, drafting, revising, or auditing a scientific manuscript, section, abstract, or reviewer response.
- **Output:** Usable prose or an actionable audit, plus unresolved evidence gaps and the checks performed.
- **Ask only if:** The deliverable, study design, target publication, or controlling source cannot be inferred and the missing choice would change the work.
- **Do not do:** Do not invent results, citations, methods, ethics determinations, or author decisions. Do not apply one journal's rules unless that journal and article type are established.
- **Interaction:** Check project and conversation evidence first. Ask one decision-changing question at a time using the current harness's blocking question UI; if unavailable, present numbered choices and wait.

Write from the study outward. Scientific validity, source traceability, and statistical meaning control the prose. Journal style and sentence polish come later.

## Establish the writing contract

Identify the requested task, intended readers, study design, manuscript section, target journal or venue, and controlling artifacts. Use this authority order:

1. Verified data, frozen results, protocol, and approved SAP.
2. Applicable reporting guideline and current target-journal instructions.
3. Project terminology, claim ledger, display shells, and author voice guidance.
4. Exemplars and general style preferences.

For each empirical claim, preserve its population, denominator, unit, time period, estimate, uncertainty, analysis status, and source. Label missing support instead of filling it with plausible text. Exemplars may guide structure or cadence, but never supply facts or policy.

Use `method-checklist` when the reporting guideline is not already established. Use live journal instructions only for a named submission target. A generic biomedical profile is not proof of compliance with a specific journal.

**AI-use disclosure.** When AI-assisted technologies, including this agent, contributed to the work, the author must disclose that at submission and describe, in both the cover letter and the appropriate manuscript section, which tool was used and for what purpose. Never list an AI tool as an author, never cite AI-generated material as a primary source, and keep a named human accountable for accuracy, integrity, originality, attribution, and plagiarism checking (ICMJE Recommendations, Section V and Section II.A.4). Nondisclosure can be treated as misconduct. When the tool inventory is unknown, record the disclosure as an author decision rather than omitting it.

Read `references/scientific-writing-patterns.md` when drafting or revising prose. Use its PubMed-grounded examples to identify sentence functions and reporting content, not as prose to imitate.

Before opening a manuscript or supporting artifact that may contain patient-level content, apply the boundary. **Sensitive-data boundary.** Resolve `phi_environment.mode` in `.ce-datascience/config.local.yaml` (worktree, then main checkout; legacy `compliant: true` = `approved`, `compliant: false` = `schema-only`, `sensitive_data: false` = `no-sensitive-data`; any schema-only signal wins; unreadable = `schema-only`). `approved` or `no-sensitive-data`: proceed silently and never mention the boundary again. `schema-only`: headings, types, counts, and aggregates only; never open, print, or paste data values; run data-reading scripts as `method-safe-run -- <command>` (path in the guard's deny message); save results as aggregate tables (counts under 11 suppressed) in `output/` or a `phi_environment.aggregate_dirs` entry. Unset, interactive: ask once with the blocking question tool (else a numbered list) offering `Approved endpoint: full access`, `Not approved or unsure: schema-only`, and `No sensitive data: public or synthetic`; save the answer as `phi_environment.mode` there once `git check-ignore -q .ce-datascience/config.local.yaml` passes (else first add `.ce-datascience/*.local.yaml` to `.gitignore`) so the guard hook sees it. Unset, headless: schema-only. In `schema-only`, work only from de-identified excerpts, metadata, or reviewed aggregates.

In every mode, never commit or publish PHI/PII or patient-level source details in Git, citations, or unrestricted exports. When editing an approved artifact in place, preserve protected source details only when the destination is approved and the detail is scientifically necessary; otherwise use a visible placeholder and flag it for author or privacy review.

## Evidence access

When this run needs literature, read `references/evidence-access.md` first; never invent a citation, effect size, or guideline item.

- **Look up here:** every factual claim in the Introduction and Discussion that is not this study's own result must resolve to a read source with a PMID or DOI; the citation ledger itself comes from `method-citations`.

## Choose the route

### Plan or outline

Build a compact claim-evidence outline before drafting. State the research question or objective, the primary estimand or descriptive target, the main answer supported by the results, and the purpose of each section. Under each section, list the evidence it will use and any open loop.

Keep open loops visible as `evidence needed`, `analysis needed`, or `author decision needed`. Resolve `evidence needed` through Evidence access when a connector is available; otherwise leave the loop open rather than citing from memory. A thesis in scientific writing is the strongest claim the design and results support, not the most provocative framing.

### Draft

For a full empirical manuscript, default to this order when the available artifacts permit it: displays and result ledger, Results, Methods, Discussion, Introduction, abstract, then title. Follow another order when the article type, journal, or user's materials require it.

Use `method-section-check` for Methods, Results, legends, and table notes. Use `method-voice` only when its clinical register fits the assignment. Keep citations attached to the claims they support; obtain each one through Evidence access, read before citing, and record the level read. Do not turn an association into causation, a secondary analysis into a primary finding, or absence of evidence into evidence of no effect.

Numbers come only from the number registry: cite every count, percent, estimate, CI, and P value as `{{num:<id>}}` (load the `method-numbers` skill; its `ids` command lists ids, kinds, and SAP outputs without values), and never type a result number, including in the abstract, legends, and table notes. When a needed number has no entry, write `{{num:missing.<what>}}` and list it under `author decision needed`; the gate keeps it visible until the analysis registers it.

### Revise

First perform a developmental pass. For each section, write one sentence stating what it contributes to the paper. Flag content that does not serve that function, missing logical steps, unsupported claims, duplicated findings, and conclusions that outrun the design.

Then test the paper from a skeptical scientific reader's position. Surface credible alternative explanations, bias, measurement limits, scope conditions, and likely reviewer objections. Address them only with available evidence or calibrated limitations. Do not manufacture controversy or quietly replace the authors' scientific claim.

Only after the argument and evidence are stable, perform the line edit. Preserve technical terms, uncertainty, citations, author voice, and meaning. Remove generic framing, inflated claims, and unsupported authority language. Use `method-anti-slop` as a calibrated review pass, not a ban on warranted hedging, Methods passive voice, or precise domain terminology.

### Audit or finalize

Before finalizing, load the `method-numbers` skill and run its `check` on the manuscript sources and rendered copies; report each `FAIL` line as an evidence or provenance failure. For an audit, report findings first in this order: evidence or provenance failure, inference risk, Methods or Results boundary violation, cross-artifact inconsistency, reporting-guideline or journal mismatch, then prose quality. Cite exact locations and distinguish deterministic checks from scientific judgment.

Before author handoff, run `method-presubmit`. Use `method-citations` when Word citations or reference repair are in scope. Never describe a manuscript as submission-ready while unresolved evidence, authorship, ethics, disclosure, data-sharing, citation, or journal-compliance blockers remain.

## Delivery contract

For drafting or revision, lead with the usable text or edited artifact. Follow it with a concise summary of material changes, unresolved evidence gaps, and verification performed. For an audit, lead with actionable findings and proposed fixes.

Separate the handoff into `verified`, `author decision needed`, and `not checked`. Preserve human author accountability for every claim, number, citation, and disclosure.
