# Evidence access

Use connected MCP servers for literature; never invent a citation, effect size, or guideline item.

- **PubMed MCP** (canonical biomedical metadata). Call by purpose; two servers are common, so match the name on whichever is connected: search (`pubmed_search_articles` or `search_articles`), metadata by PMID (`pubmed_fetch_articles` or `get_article_metadata`), partial reference to PMID (`pubmed_lookup_citation` or `lookup_article_by_citation`), PMID/PMCID/DOI conversion (`pubmed_convert_ids` or `convert_article_ids`), related papers (`pubmed_find_related` or `find_related_articles`), full text (`pubmed_fetch_fulltext`, or `get_copyright_status` then `get_full_text_article` for open PMC). The documented default server (`@cyanheads/pubmed-mcp-server`) also offers `pubmed_lookup_mesh`, `pubmed_spell_check`, `pubmed_europepmc_search`, and `pubmed_format_citations` (a display check, never a substitute for a reference-manager field). Tool names carry the harness's server prefix; with the documented default server in Claude Code they are `mcp__pubmed-mcp-server__pubmed_search_articles`, `mcp__pubmed-mcp-server__pubmed_fetch_articles`, and so on.
- **Paperclip MCP** (full text across papers, preprints, trials, FDA documents): `search` with an explicit `source` (for example `pmc`), `lookup` by DOI/PMID/PMCID, then `cat`, `grep`, `scan`, `map`, or `filter` on the result, and `ask-image` for figures. In Claude Code these are `mcp__paperclip__search`, `mcp__paperclip__lookup`, and so on. The authenticated `paperclip` CLI is the fallback; neither is required.
- **Fallbacks:** without PubMed MCP (or when its calls error), load the `method-pubmed` skill, which owns the NCBI E-utilities fallback; without Paperclip, continue PubMed-only and state the full-text limitation.
- **Rules:** no PHI, patient-level values, or small-cell counts in any query; a search hit is not evidence until the source is read; label every claim at the level read (`abstract`, `full_text`, `figure`, `trial`, `regulatory`, `documentation`); keep PMID/PMCID/DOI, the query string, and the date as provenance; cite PubMed and include DOIs whenever PMC full text is used; lawful full-text access only.

## SAP mode

Applies before writing SAP-1 (study objectives and background rationale) or SAP-5 (statistical methods justification), and whenever a plan's `Context & Research` section cites literature.

- **Look up here:** background evidence for SAP-1 (the prior studies, event rates, and effect sizes the objectives rest on) and method precedents for SAP-5 (the primary reference for each named model, adjustment, or missing-data approach); when `__CE_EVIDENCE_MAP__`, `__CE_PUBMED_RESULTS__`, or `__CE_METHOD_EXTRACT__` already supplies a read and labeled source, cite it from that artifact instead of searching again.

### How the SAP records it

- Cite in the SAP body with the PMID (and DOI when available) and the evidence label; keep the query string and date in SAP-11 reproducibility metadata or in the evidence-map artifact the signal points at.
- A claim with no read source becomes `<!-- GAP: unsourced claim in SAP-<N.M> -->`, never a citation from memory or from a search-result snippet.
- Prior effect sizes and event rates reach SAP-3.1 and SAP-6 only through `method-meta-analysis`/`method-power` handoffs or a read source; mark any planning value that is not one of those as an assumption.
- Reporting-guideline items named in the SAP come from the checklist the `__CE_CHECKLIST__` signal selected, not from memory.
