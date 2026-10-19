---
name: method-presubmit
description: "Runs the final gate on a manuscript, abstract, cover letter, or grant: section discipline, voice, and anti-slop passes. Use when a draft is about to go to co-authors."
---

# Pre-Submission Audit

## Skill Value

- **Problem it solves:** Drafts can reach authors with interpretation in Methods or Results, uncited attribution, or ungrounded AI-writing patterns.
- **Use when:** Any manuscript, abstract, cover letter, or grant-narrative draft is about to be handed off.
- **Output:** A corrected draft plus a concise section-by-severity audit summary.
- **Ask only if:** Section boundaries or the intended handoff scope cannot be identified from the draft.
- **Do not do:** Do not present known P0 or section-discipline failures as finished work, and do not invent citations or claims.
- **Interaction:** Check the draft and conversation first. Ask one decision-changing question at a time using the current harness's blocking question UI; if unavailable, present numbered choices and wait.

A single gate that runs before any manuscript text leaves your hands, combining `method-section-check`, `method-voice`, and `method-anti-slop`. This is not optional polish — run it silently before presenting any drafted or edited manuscript section, and report the results rather than presenting a self-certified-clean draft without having checked.

## What runs where

| Section | Skill applied | Bar to clear |
|---|---|---|
| Methods | `method-section-check` | No unsupported red-flag rationale; preserve concise rationale required by the applicable guideline, protocol, regulation, or reproducibility standard |
| Results | `method-section-check` | Zero unsupported red-flag phrases; every claim carries its statistic; zero editorializing adverbs |
| Abstract — Methods and Results subsections of a structured abstract | `method-section-check` | Same bar as body Methods/Results; an interpretive clause in an abstract Results subsection fails the gate |
| Introduction, Discussion, Abstract background/conclusions, cover letter, grant text | `method-voice` + `method-anti-slop` | Voice self-check passes; zero P0; every P1 AI-tell fixed or flagged for author judgment |
| Figure legends, table footnotes | `method-section-check` | Results rules apply; no interpretive clauses in legends |
| Whole document | `method-anti-slop` | No uncited attribution; no thesaurus-swapped technical terms; em-dash and intensifier discipline held throughout |
| Numbers (all sections, tables, legends) | `method-numbers` gate | Every reported number is a registry placeholder or its rendered text; the gate prints `PASS` |
| Citations (all sections) | Evidence access | Every citation carries a PMID, PMCID, or DOI; spot-checked claims are supported by the source at the labelled level |

## Evidence access

When this run needs literature, read `references/evidence-access.md` first; never invent a citation, effect size, or guideline item.

- **Look up here:** spot-check that cited claims are supported by their source at the labelled level and that no citation lacks a PMID, PMCID, or DOI; route full reference repair to `method-citations`.

## Procedure

1. Identify section boundaries in the draft (Methods / Results / Discussion / Introduction / Abstract subsections / figure legends and table footnotes / other).
2. Run the Methods and Results text through the `method-section-check` red-flag list. Any unsupported hit is a required fix before delivery — move the content to Discussion or delete it. Preserve rationale that records a required or prespecified basis for a methodological choice; do not delete it merely because it answers "why." Treat rationale naming a reporting guideline, protocol, regulation, causal model, or prespecified evidence base as protected content: if its accuracy is uncertain, flag it for verification rather than silently deleting it or reducing the sentence to the method alone.
3. Run Discussion, Introduction, and other narrative text through the `method-voice` self-check and the `method-anti-slop` banned-construction list. Then check the whole document, including Methods, Results, legends, and footnotes, for the whole-document `method-anti-slop` items: uncited attribution, thesaurus-swapped technical terms, non-definitional em-dashes, and ungrounded intensifiers.
4. Citation spot-check: list every citation and flag any without a PMID, PMCID, or DOI (`pubmed_convert_ids` or `convert_article_ids`, and `pubmed_lookup_citation` or `lookup_article_by_citation`, recover one from a partial reference). Then choose the citations behind the load-bearing claims (primary comparison, effect sizes, guideline items), resolve each with `pubmed_fetch_articles` or `get_article_metadata`, read the source at the stated level, and flag any claim the source does not support at that level. Never add, replace, or repair a citation from memory; a missing or unsupported citation is flagged for the author or routed to `method-citations`.
4a. **Number gate.** Load the `method-numbers` skill and run its `check` on the manuscript sources, rendered copies, and tables (it reads `analysis/numbers/registry.json`). A `FAIL` exit, or a gate that could not run, blocks readiness: quote its `file:line: reason: token` lines as printed, and never add a result to the allowlist or edit the registry to make it pass.
4b. **AI-use disclosure.** When AI-assisted technologies contributed to the draft, confirm that the disclosure names the tool and its purpose, that it appears in both the cover letter and the manuscript, that no AI tool is listed as an author, and that a named human is accountable for the content (ICMJE Recommendations, Section V and Section II.A.4). An absent or vague disclosure is a required fix, not an author decision.
5. Compile findings into an audit report: section, quoted flagged phrase (short), issue category (interpretation-in-Methods / interpretation-in-Results / uncited-attribution / untraced-number / missing-identifier / unsupported-citation / throat-clearing / vague-declarative / ungrounded-intensifier / em-dash-overuse / thesaurus-swap / other), and the fix applied or recommended.
6. Apply P0 and Methods/Results fixes directly — do not leave known credibility or section-discipline failures for the author to catch. P1 items get fixed directly when the rewrite is unambiguous; flag for author judgment when a rewrite could change meaning. P2 items are noted, not blocking.
7. Present the corrected draft together with a short audit summary (counts by category, not a line-by-line transcript, unless the user asks for the full list) so the author can see what was caught and fixed without wading through the whole checklist.

## Non-negotiable bar

A draft does not go to an author with any of the following still present, regardless of how the request was phrased ("just get me a draft," "quick version," "don't worry about polish"):

- Any unsupported hedge, caveat, or interpretive clause inside Methods or Results, except factual statistical statements that report what the analysis showed and concise rationale required to document a prespecified methodological choice under the applicable reporting standard, protocol, regulation, or reproducibility requirement.
- Any uncited "studies show" / "research suggests" / "experts believe."
- Any statistical intensifier ("significant," "substantial," "robust") without its statistic attached, and any threshold language for a non-significant result ("did not reach significance," "trend toward significance," "no difference") instead of the estimate, CI, and exact P value.
- Any number the `method-numbers` gate reports as untraced, stale, unknown, or small-cell, or a gate that did not run.
- Any citation that lacks a PMID, PMCID, or DOI, or any spot-checked citation whose source does not support the claim at the labelled level, left unflagged.
- Any AI-assisted contribution to the draft left undisclosed, any AI tool listed as an author, or any AI-generated source cited as primary evidence.

Speed pressure from the user is not a reason to skip this gate — a fast draft with these failures intact is not actually faster once the author has to catch them.
