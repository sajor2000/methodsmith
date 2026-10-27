---
name: method-pubmed
description: "Searches PubMed/MEDLINE via E-utilities with MeSH-aware queries into a PMID and abstract CSV. Use when the user explicitly wants PubMed or PMIDs; broad asks go to method-lit-search."
argument-hint: "<query terms>, optional: --years 5 --study-type rct|rct-sensitive|cohort|case-control|prediction|review --max 50 --english-only"
---

# PubMed Method Search

> **Script paths are relative to this skill's directory.** Prefix each script path with that directory (the `SKILL_DIR` anchor below) — the agent's working directory is the user's project, not the skill, and `--out` paths resolve against the project.


## Skill Value

- **Problem it solves:** Biomedical planning needs traceable literature metadata before methods extraction or SAP justification.
- **Use when:** The user asks for PubMed, MEDLINE, PMIDs, biomedical abstracts, or literature metadata.
- **Output:** Structured PubMed results with PMIDs, abstracts/metadata, query details, and downstream handoff.
- **Ask only if:** Only when no query, research-question YAML, or PICO context is available.
- **Do not do:** Do not claim full-text coverage or replace Paperclip/full-text methods extraction.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Search PubMed/MEDLINE via NCBI E-utilities and return a structured CSV that downstream skills (`method-extract`, `method-meta-analysis`) consume. This skill owns the plugin's canonical biomedical metadata and PMID workflow; `method-lit-search` routes broader requests here when PubMed is the right source.

## Prerequisites

- Python with Biopython: run the script with `uv run --with biopython python3 ...`, or install Biopython in the project's environment; never into a shared system interpreter
- Optional but recommended: `export NCBI_API_KEY=<key>` (lifts rate limit from 3 → 10 req/sec)
- Optional: `export NCBI_EMAIL=<your-email>` (NCBI courtesy)

## Evidence access

Before any literature lookup, read `references/evidence-access.md` (PubMed and Paperclip MCP tools, fallbacks, and evidence rules); never invent a citation, effect size, or guideline item.

**MCP egress (every mode):** send PubMed, Paperclip, and other MCP or web tools only search terms, MeSH terms, PMIDs, DOIs, and titles, never data values, identifiers, row text, or data files; an endpoint approval does not cover third-party services.

- **Look up here:** the PICO query from `analysis/research-question.yaml`, MeSH expansion (NCBI's `QueryTranslation`), and PMID/PMCID/DOI capture for every CSV row.

When the PubMed MCP path is used instead of the script, write the same CSV
columns (`pmid,year,journal,study_type,title,first_author,doi,pmcid,abstract,mesh_terms,query_used`),
fill `pmcid`/`doi` with `pubmed_convert_ids` or `convert_article_ids` when the
metadata call omits them, surface MeSH expansion with `pubmed_lookup_mesh` when
the default server is connected and otherwise say explicitly that
`QueryTranslation` was not surfaced, and still emit the `__CE_PUBMED_RESULTS__`
line in Step 3. The CSV holds abstracts; rows are
`abstract`-level evidence until a source is read in full.

MCP path mechanics: translate `--years N` into the connector's date filter
(`date_from` = current year minus N); the connector's `query_translation`
field is the `[mesh]` line. Fetch metadata in batches of at most 20 PMIDs:
`get_article_metadata` silently returns at most 20 records per call, and a
large result may be spooled to a file by the harness instead of shown inline;
parse that file with a script rather than re-requesting. Before emitting
`n=`, reconcile the CSV row count against the searched PMID list and fetch any
PMIDs still missing.

## Workflow

### 0. Context inputs (scan chat first)

Before asking the user for a query, scan the most recent ~50 chat turns for `__CE_RESEARCH_QUESTION__ yaml=<path> ... query="<one-line>"`. If found:

1. Read the YAML at the path (`analysis/research-question.yaml` by default).
2. Use the `suggested_pubmed_query` field as the default query if no `<query terms>` argument was passed on the command line.
3. Use `pico.population` and `outcome` to derive a default `--years` window (default 10) and `--study-type` filter (e.g., `cohort` if `suggested_design` names a cohort design).
4. Print one line so the chain is visible:

   ```
   [research-question] using query from analysis/research-question.yaml: "<query>"
   ```

If `__CE_RESEARCH_QUESTION__` is not present and no `<query terms>` are passed, ask the user for a query (or recommend load the `method-question` skill first to harden the question).

### 1. Run the bundled script

`scripts/pubmed_search.py` wraps biopython.Entrez and handles MeSH expansion, batched retrieval, rate limits, and retries; use it instead of hand-rolled HTTP calls.

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/pubmed_search.py" \
    "sepsis bundle compliance ICU" \
    --years 10 --study-type cohort --max 50 \
    --out analysis/pubmed/sepsis-bundle-2025.csv
```

The script prints three diagnostic lines to stderr the user should always see:
- `[query] ((sepsis bundle ...) AND ("Cohort Studies"[MeSH Terms]) AND ...) NOT (animals[mh] NOT humans[mh])` — the query string sent to NCBI, with the study-type, date, and human filters added (and `English[lang]` only with `--english-only`).
- `[hits]  142 matched; fetching 50` — the size of the matched set vs what was retrieved.
- `[mesh]  ...` — NCBI's `QueryTranslation`, the actual query NCBI ran after MeSH expansion. Always surface it.

Filters are discovery aids, not validated systematic-review filters:
- The human limit is the Cochrane double negative (`NOT (animals[mh] NOT humans[mh])`, Cochrane Handbook ch. 4, Box 4.4.a), so records not yet MeSH-indexed survive.
- `--include-animal` drops the human limit from the query (and from `[query]` and the CSV `query_used`); pass it only when the question is preclinical/animal research.
- No language limit is applied unless `--english-only` is passed (Cochrane Handbook §4.4: language restrictions risk language bias).
- `--study-type rct` is high-precision (indexed publication type only, misses unindexed trials); `rct-sensitive` is the Cochrane Highly Sensitive Search Strategy (Box 4.4.a). `prediction` and `diagnostic` are high-precision, low-sensitivity MeSH filters; for a review, use a validated filter such as Geersing et al. 2012 (PLoS One, PMID 22393453) and name it in the search record.

### 2. Write the human summary

After the CSV exists, write a sibling Markdown summary at `analysis/pubmed/<query-slug>-<YYYYMMDD>.md` with:

1. **Top-10 shortlist** — the most recent and most relevant study designs for the question; journal prestige is not a quality signal. Label it a hand-pickable list, not a ranking of evidence quality.
2. **MeSH-term histogram** — top 15 MeSH terms across results. Reveals what the literature actually indexes this topic as, not what the user typed.
3. **Study-type histogram** — RCTs vs cohorts vs reviews. Tells the user whether the prior literature is observational or interventional.
4. **% with PMC full-text** — proportion of rows with non-empty `pmcid`. This is the upper bound on what `method-extract` can do with full text.

### 3. Emit the handoff signal

The script already prints `__CE_PUBMED_RESULTS__ csv=<path> n=<count> query=<...> pmc_pct=<...>`. Surface this line in the chat so `method-extract` can pick the CSV up by parsing the chat context.

## Out of scope

- Does not acquire arbitrary PDFs; use `method-evidence-map` for claim-focused lawful full-text verification
- Does not extract methods from full text (next: `method-extract`)
- Does not pool effect sizes (next-next: `method-meta-analysis`)
- Does not create editable Word citation fields (use `method-citations`)
- Does not match to a reporting checklist (different skill: `method-checklist`)

## References

@./references/mesh-expansion.md — When NCBI's MeSH expansion goes wrong and how to detect it

@./references/eutils-endpoints.md — E-utilities reference, batch limits, error handling
