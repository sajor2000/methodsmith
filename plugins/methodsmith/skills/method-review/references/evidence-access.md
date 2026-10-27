# Evidence access

Use connected MCP servers for literature; never invent a citation, effect size, or guideline item.

- **PubMed MCP** (canonical biomedical metadata). Call by purpose; two servers are common, so match the name on whichever is connected: search (`pubmed_search_articles` or `search_articles`), metadata by PMID (`pubmed_fetch_articles` or `get_article_metadata`), partial reference to PMID (`pubmed_lookup_citation` or `lookup_article_by_citation`), PMID/PMCID/DOI conversion (`pubmed_convert_ids` or `convert_article_ids`), related papers (`pubmed_find_related` or `find_related_articles`), full text (`pubmed_fetch_fulltext`, or `get_copyright_status` then `get_full_text_article` for open PMC). The documented default server (`@cyanheads/pubmed-mcp-server`) also offers `pubmed_lookup_mesh`, `pubmed_spell_check`, `pubmed_europepmc_search`, and `pubmed_format_citations` (a display check, never a substitute for a reference-manager field). Tool names carry the harness's server prefix; with the documented default server in Claude Code they are `mcp__pubmed-mcp-server__pubmed_search_articles`, `mcp__pubmed-mcp-server__pubmed_fetch_articles`, and so on.
- **Paperclip MCP** (full text across papers, preprints, trials, FDA documents): `search` with an explicit `source` (for example `pmc`), `lookup` by DOI/PMID/PMCID, then `cat`, `grep`, `scan`, `map`, or `filter` on the result, and `ask-image` for figures. In Claude Code these are `mcp__paperclip__search`, `mcp__paperclip__lookup`, and so on. The authenticated `paperclip` CLI is the fallback; neither is required.
- **Fallbacks:** without PubMed MCP (or when its calls error), load the `method-pubmed` skill, which owns the NCBI E-utilities fallback; without Paperclip, continue PubMed-only and state the full-text limitation.
- **Rules:** no PHI, patient-level values, or small-cell counts in any query; a search hit is not evidence until the source is read; label every claim at the level read (`abstract`, `full_text`, `figure`, `trial`, `regulatory`, `documentation`); keep PMID/PMCID/DOI, the query string, and the date as provenance; cite PubMed and include DOIs whenever PMC full text is used; lawful full-text access only.

## Reviewer rules

Applies to the orchestrator and to every reviewer sub-agent that cites a reporting-guideline item, a methods reference, or a benchmark in a finding.

- In `mode:agent` and `mode:report-only`, do not run the `method-pubmed` fallback, which writes CSV and summary files; when PubMed MCP is unavailable or errors, record the citation as an evidence gap in the finding instead.
- **Look up here:** reporting-guideline statements and item wording (start from the PMIDs/DOIs in `references/guideline-registry.yaml` and the selected checklist files) and the methods references a reviewer cites to justify a finding; a guideline item or methods claim without a read source stays at anchor 50 or below and names the gap in `evidence`.
- Reviewer prompts inherit the PHI Safety Boundary: only code, schemas, metadata, and PHI-free context may appear in a literature query.
- The registry `status` (`verified`, `verified-but-superseded`, `provisional`, `unverified`) is a source-identity status, not an evidence label; a finding still labels what was read (`abstract`, `full_text`, and so on).
- Registry drift (a PMID or DOI that resolves to a different title, journal, or year) is a finding against the skill's references, never a reason to cite the wrong paper; re-resolve with the PubMed metadata tool and report the mismatch.
