---
name: method-journal-select
description: "Matches a finished manuscript or abstract to candidate journals by sourced scope fit, indexing, and access policy, returning a ranked target with backups. Use when choosing where to submit."
argument-hint: "[path/to/manuscript or abstract] [optional: --constraints indexing=medline,access=hybrid]"
---

# Journal Selection

## Skill Value

- **Problem it solves:** Target-journal choice made on habit or hearsay fails on scope mismatch and unverifiable indexing claims.
- **Use when:** Choosing where to submit a finished or nearly finished manuscript, or ranking venues for an abstract.
- **Output:** A ranked, sourced candidate table with a recommended target, two backups, and a per-journal next-step list.
- **Ask only if:** Must-have constraints (indexing, access policy, fee cap, timeline) are unknown and they would change the ranking.
- **Do not do:** Do not invent metrics, rank on unsourced cells, or choose for the author.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

## Workflow

1. **Profile the work:** design, population, primary outcome, key finding, article type -- from the manuscript, the abstract, or the SAP. With no artifact at all, ask for a one-paragraph study summary rather than guessing.
2. **Collect must-have constraints** (blocking question tool; one question at a time, only when the answer changes the ranking): required indexing (MEDLINE, PMC, Scopus), access policy (subscription, hybrid, full open access, APC cap), review-speed needs, article-type limits.
3. **Build the candidate pool** of 5-8 journals. Each candidate's scope statement comes from that journal's own aims-and-scope page, read with the web tools -- never from memory or a third-party summary. No candidate enters the pool without a sourced scope statement.
4. **Gather scope-fit evidence:** for each candidate, search PubMed restricted to that journal for similar recent studies; record the count and recency. Zero similar recent studies is a scope-fit risk to surface, not an automatic exclude (indexing lag, narrow specialty).
5. **Run the legitimacy screen:** verify each candidate's indexing claims against the NLM Catalog (or DOAJ for open-access venues). Flag unverifiable indexing claims, copycat names of reputable journals, and APC-only venues with no verifiable indexing in the table; do not silently drop or accept them.
6. **Rank and report:** a table of journal, scope fit with evidence counts, indexing with verification source, access policy and fees with source, and decision speed (sourced or marked unknown). Every cell is sourced or marked unknown.
7. **Recommend:** a target plus two backups with rationale, and a per-journal next-step list (article type, word limits, required reporting checklist). Hand checklist selection to `method-checklist` and packaging to `method-submission-package`.

## Evidence access

- **Web search/fetch** (native web tools -- WebSearch/WebFetch in Claude Code, web search in Codex; a web MCP where connected): aims and scope, author guidelines, editorial policies, APCs, indexing claims.
- **PubMed MCP** (search with the journal name; `pubmed_search_articles` or `search_articles`, `get_article_metadata` for journal-name confirmation); fallback: the `method-pubmed` E-utilities path.
- **Egress rule:** searches carry study topics, designs, and journal names only -- never data values, identifiers, or patient text.

## Sourcing rules

- Every metric (impact factor, acceptance rate, median days to decision, APC) carries a source URL and date, or is marked unknown. Never rank on an invented number.
- A journal's scope statement comes from the journal's own site or the NLM Catalog.
- An unverifiable indexing claim is flagged in the table with the claim as printed and the check that failed; it is neither dropped nor repeated as fact.

## Failure handling

| Condition | Response |
|---|---|
| Web tools unavailable | Work from a user-named shortlist; label every unsourced cell unknown; do not invent metrics |
| PubMed MCP unavailable | Use the `method-pubmed` E-utilities fallback for journal-scoped searches |
| No manuscript yet | Rank on the abstract or study summary and mark the fit judgment provisional |
| Constraints unknown | Ask one blocking question for must-haves; proceed on scope fit alone if the user declines |

## Output

```text
__CE_JOURNAL_SELECT__ target=<journal> backups=<n> candidates=<n> sourced_cells=<n> unknown_cells=<n>
```

The author makes the final choice; the ranking, the flags, and their sources travel with the recommendation.
