# Evidence access

Use connected MCP servers for literature; never invent a citation, effect size, or guideline item.

- **PubMed MCP** (canonical biomedical metadata). Call by purpose; two servers are common, so match the name on whichever is connected: search (`pubmed_search_articles` or `search_articles`), metadata by PMID (`pubmed_fetch_articles` or `get_article_metadata`), partial reference to PMID (`pubmed_lookup_citation` or `lookup_article_by_citation`), PMID/PMCID/DOI conversion (`pubmed_convert_ids` or `convert_article_ids`), related papers (`pubmed_find_related` or `find_related_articles`), full text (`pubmed_fetch_fulltext`, or `get_copyright_status` then `get_full_text_article` for open PMC). The documented default server (`@cyanheads/pubmed-mcp-server`) also offers `pubmed_lookup_mesh`, `pubmed_spell_check`, `pubmed_europepmc_search`, and `pubmed_format_citations` (a display check, never a substitute for a reference-manager field). Tool names carry the harness's server prefix; with the documented default server in Claude Code they are `mcp__pubmed-mcp-server__pubmed_search_articles`, `mcp__pubmed-mcp-server__pubmed_fetch_articles`, and so on.
- **Paperclip MCP** (full text across papers, preprints, trials, FDA documents): `search` with an explicit `source` (for example `pmc`), `lookup` by DOI/PMID/PMCID, then `cat`, `grep`, `scan`, `map`, or `filter` on the result, and `ask-image` for figures. In Claude Code these are `mcp__paperclip__search`, `mcp__paperclip__lookup`, and so on. The authenticated `paperclip` CLI is the fallback; neither is required.
- **Fallbacks:** without PubMed MCP (or when its calls error), load the `method-pubmed` skill, which owns the NCBI E-utilities fallback; without Paperclip, continue PubMed-only and state the full-text limitation.
- **Rules:** no PHI, patient-level values, or small-cell counts in any query; a search hit is not evidence until the source is read; label every claim at the level read (`abstract`, `full_text`, `figure`, `trial`, `regulatory`, `documentation`); keep PMID/PMCID/DOI, the query string, and the date as provenance; cite PubMed and include DOIs whenever PMC full text is used; lawful full-text access only.

## Evidence access: literature pulse per design option

- **Look up here:** prior studies for each design option under comparison: a literature pulse of the hit count and 2-3 key PMIDs read at abstract level, labelled `abstract`, never presented as a systematic search.

Run in Phase 1.2 for the prior-evidence gap and in Phase 2 before presenting design approaches. It adds no sub-agents; run it inline in the normal collaborative flow.

1. For each design option (or for the opening question when no options exist yet), run one search (`pubmed_search_articles` or `search_articles`) built from population, exposure, comparison, and outcome terms, `max_results` of 3-5. Never pass patient-level values, small-cell counts, or repository data.
   For a preclinical (animal-model) design option, search with animal studies included: leave out any human-only limit, and pass `--include-animal` on the `method-pubmed` script fallback.
2. Record the total hit count and the query string. Fetch metadata for the top 2-3 hits (`pubmed_fetch_articles` or `get_article_metadata`) and read the title and abstract before naming a paper.
3. Report it in one line per option as "literature pulse (not a systematic search): N hits; PMID ..., PMID ... (`abstract`)". Use it to say whether an option replicates, extends, or is net new, and to probe the prior-evidence gap with what was found rather than asking the user to recall it.
4. Carry the PMIDs and the date into the requirements document (Problem Frame or Dependencies / Assumptions) as provenance; put the systematic search itself under Deferred to Planning for `method-pubmed` or `method-lit-search`.
5. If neither the PubMed MCP nor the fallback above is available, state that the pulse was skipped and record prior evidence as an unverified assumption.
