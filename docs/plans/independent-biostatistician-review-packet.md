# Independent biostatistician review — packet for issue #124

Status: packet prepared 2026-10-22; the review itself needs an external
biostatistician (not the maintainers, not an agent).

## What the reviewer is asked to review

The method-* statistical guidance — the skills and agents that tell an
agent how to plan, execute, and check a health-data analysis — not this
repository's code. The deliverable is a written review with item-level
verdicts (agree / disagree with reason) on the guidance points listed
under "Review scope" below.

## Where the guidance lives

| Surface | Path | What a reviewer should read |
| --- | --- | --- |
| Analysis planning | `plugins/methodsmith/skills/method-sap/` | The SAP structure and pre-specification rules |
| Statistical review | `plugins/methodsmith/skills/method-review/references/*-checklist.md` | Reporting-guideline checklists (CONSORT, STROBE, PRISMA, AMSTAR-2, TRIPOD, and peers) encoded as checkable rules |
| Execution guardrails | `plugins/methodsmith/skills/method-r/`, `method-work/`, `method-numbers/` | Registry-gated numbers, fail-closed aggregates, the schema-only peek |
| Meta-analysis | `plugins/methodsmith/skills/method-meta-analysis/` | Model choice, heterogeneity, prediction intervals |
| Power/sample size | `plugins/methodsmith/skills/method-power/` | Default assumptions and when they mislead |
| Manuscript numbers | `plugins/methodsmith/skills/method-write/` | The delivery order, prose rules, legend standard, writing gate |
| Model selection | `plugins/methodsmith/skills/method-model-choice/`, `method-ml-track/` | Guidance for when ML methods enter a clinical-analysis plan |

## Review scope (the claims to check)

1. Pre-specification: the SAP skill's requirement that estimands,
   populations, and analyses be fixed before data work begins.
2. The numbers gate: reported numbers must trace to executed code
   output, never be typed by the agent.
3. Meta-analysis defaults: random-effects with REML, Knapp-Hartung
   test, prediction intervals reported, I-squared described not
   thresholded.
4. The schema-only boundary: an unapproved project sees types, counts,
   and missingness — never values.
5. Reporting-guideline checklists: faithful paraphrase, correct item
   IDs, newest guideline version only.
6. Small-cell suppression and the 11-row threshold rules.
7. The manuscript standard: fixed delivery order, continuous prose,
   self-contained legends, the writing gate.

## Method

- Reviewer reads the surfaces above against the scope list.
- Each point gets agree / disagree-with-reason / revise-to.
- Disagreements are filed as issues referencing #124, not edited
  directly, so the maintainer arbitrates.
- The review is published (anonymized if the reviewer prefers) as a
  `docs/audits/` entry with the reviewer's name or reviewer ID and date.

## Out of scope

The CLI/converter code, the website, and the marketplace plumbing.
The sensitive-data boundary's code correctness is covered by its own
contract tests; the reviewer may note concerns but need not audit it.
