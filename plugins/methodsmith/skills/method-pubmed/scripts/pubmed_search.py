"""PubMed search and fetch via biopython.Entrez.

Wraps NCBI E-utilities (esearch + efetch) with MeSH-aware filters, batched
retrieval, and structured CSV output. Biopython.Entrez automatically respects
NCBI rate limits (3 req/sec without API key, 10 req/sec with NCBI_API_KEY in
env) and retries transient failures.

Why biopython.Entrez and not raw requests:
- Free, well-maintained, used in production by NCBI itself
- Handles WebEnv + query_key handoff so retmax > 10000 works
- Auto-retry on HTTP 5xx with exponential backoff (max_tries default 3)
- Parses MEDLINE XML into Python dicts without manual XPath

Security note: CVE-2025-68463 -- Bio.Entrez.read/parse may resolve XSD/DTD URLs
on parse. We use it only on NCBI-returned XML; do not feed untrusted XML.

Usage:
    python pubmed_search.py "sepsis bundle compliance ICU" \\
        --years 10 --study-type cohort --max 50 \\
        --out analysis/pubmed/sepsis-bundle-2025.csv

Output schema (CSV):
    pmid,year,journal,study_type,title,first_author,doi,pmcid,
    abstract,mesh_terms,query_used
"""
from __future__ import annotations

import argparse
import csv
import os
import re
import sys
import time
from pathlib import Path

try:
    from Bio import Entrez
except ImportError:
    sys.exit(
        "biopython is required. Run with: uv run --with biopython python3 pubmed_search.py ...\n"
        "or install biopython in the project's environment (provides Bio.Entrez)"
    )


# Discovery filters, not validated systematic-review filters. "rct" is
# high-precision (indexed publication type only); "rct-sensitive" is the
# Cochrane Highly Sensitive Search Strategy, sensitivity-maximizing 2008
# revision, PubMed format (Cochrane Handbook ch. 4, Box 4.4.a), lines #1-#8.
# "prediction" and "diagnostic" are high-precision, low-sensitivity MeSH
# conjunctions; reviews should use a validated filter (e.g., Geersing 2012,
# PMID 22393453) instead.
STUDY_TYPE_FILTERS = {
    "rct":          '("Randomized Controlled Trial"[Publication Type])',
    "rct-sensitive": ('(randomized controlled trial[pt] OR controlled clinical trial[pt] '
                      'OR randomized[tiab] OR placebo[tiab] OR drug therapy[sh] '
                      'OR randomly[tiab] OR trial[tiab] OR groups[tiab])'),
    "cohort":       '("Cohort Studies"[MeSH Terms])',
    "case-control": '("Case-Control Studies"[MeSH Terms])',
    "cross-sectional": '("Cross-Sectional Studies"[MeSH Terms])',
    "prediction":   '("Prognosis"[MeSH Terms] AND "Models, Statistical"[MeSH Terms])',
    "review":       '("Systematic Review"[Publication Type] OR "Meta-Analysis"[Publication Type])',
    "diagnostic":   '("Sensitivity and Specificity"[MeSH Terms])',
}


# Cochrane double negative (Box 4.4.a, #10-#11): drops animal-only records but
# keeps records not yet MeSH-indexed, unlike humans[MeSH Terms].
HUMAN_FILTER = "NOT (animals[mh] NOT humans[mh])"


def build_query(term: str, years: int | None, study_type: str | None,
                english_only: bool = False, include_animal: bool = False) -> str:
    parts = [f"({term})"]
    if study_type:
        f = STUDY_TYPE_FILTERS.get(study_type)
        if not f:
            sys.exit(f"unknown study-type: {study_type}; "
                     f"valid: {sorted(STUDY_TYPE_FILTERS)}")
        parts.append(f)
    if years:
        parts.append(f'("last {years} years"[PDat])')
    if english_only:
        parts.append("English[lang]")
    query = f"({' AND '.join(parts)})"
    return query if include_animal else f"{query} {HUMAN_FILTER}"


def first_text(elt, default: str = "") -> str:
    if elt is None:
        return default
    if isinstance(elt, list):
        return str(elt[0]) if elt else default
    return str(elt)


def parse_record(rec: dict) -> dict:
    """Flatten a Bio.Entrez PubmedArticle dict into a CSV row."""
    citation = rec.get("MedlineCitation", {})
    article  = citation.get("Article", {})
    pmid     = first_text(citation.get("PMID", ""))
    title    = first_text(article.get("ArticleTitle", ""))
    journal  = first_text(article.get("Journal", {}).get("Title", ""))
    issue    = article.get("Journal", {}).get("JournalIssue", {}).get("PubDate", {})
    year     = first_text(issue.get("Year", "") or issue.get("MedlineDate", "")[:4])

    pubtypes = article.get("PublicationTypeList", [])
    study_type = "; ".join(str(p) for p in pubtypes) if pubtypes else ""

    authors = article.get("AuthorList", []) or []
    first_author = ""
    if authors:
        a0 = authors[0]
        first_author = (a0.get("LastName", "") + " " + a0.get("Initials", "")).strip()

    abstract_parts = article.get("Abstract", {}).get("AbstractText", [])
    if isinstance(abstract_parts, list):
        abstract = " ".join(str(p) for p in abstract_parts)
    else:
        abstract = str(abstract_parts)

    mesh = citation.get("MeshHeadingList", []) or []
    mesh_terms = "; ".join(
        str(m.get("DescriptorName", "")) for m in mesh
    )

    doi, pmcid = "", ""
    for art_id in rec.get("PubmedData", {}).get("ArticleIdList", []) or []:
        idtype = art_id.attributes.get("IdType", "") if hasattr(art_id, "attributes") else ""
        if idtype == "doi":
            doi = str(art_id)
        elif idtype == "pmc":
            pmcid = str(art_id)

    return {
        "pmid":         pmid,
        "year":         year,
        "journal":      journal,
        "study_type":   study_type,
        "title":        title.strip(),
        "first_author": first_author,
        "doi":          doi,
        "pmcid":        pmcid,
        "abstract":     re.sub(r"\s+", " ", abstract).strip(),
        "mesh_terms":   mesh_terms,
    }


def search(term: str, years: int | None, study_type: str | None,
           max_results: int, email: str, english_only: bool = False,
           include_animal: bool = False) -> list[dict]:
    Entrez.email = email
    if api_key := os.environ.get("NCBI_API_KEY"):
        Entrez.api_key = api_key

    query = build_query(term, years, study_type, english_only, include_animal)
    print(f"[query] {query}", file=sys.stderr)

    with Entrez.esearch(db="pubmed", term=query, retmax=max_results,
                        usehistory="y") as handle:
        es = Entrez.read(handle)

    count   = int(es["Count"])
    actual  = min(max_results, count)
    print(f"[hits]  {count} matched; fetching {actual}", file=sys.stderr)
    print(f"[mesh]  {es.get('QueryTranslation', '')}", file=sys.stderr)

    if actual == 0:
        return []

    rows: list[dict] = []
    batch_size = 200
    for start in range(0, actual, batch_size):
        with Entrez.efetch(db="pubmed", retmode="xml",
                           webenv=es["WebEnv"], query_key=es["QueryKey"],
                           retstart=start, retmax=min(batch_size, actual - start)) as handle:
            records = Entrez.read(handle)
        for rec in records.get("PubmedArticle", []):
            row = parse_record(rec)
            row["query_used"] = query
            rows.append(row)
        time.sleep(0.35)  # belt-and-suspenders; Entrez already throttles

    # The history server holds every match, not just --max; never return more.
    return rows[:actual]


def write_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cols = ["pmid", "year", "journal", "study_type", "title",
            "first_author", "doi", "pmcid", "abstract", "mesh_terms",
            "query_used"]
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)


def main() -> None:
    p = argparse.ArgumentParser(description="Search PubMed and write a structured CSV.")
    p.add_argument("query", help="free-text query; MeSH expansion happens server-side")
    p.add_argument("--years", type=int, default=None,
                   help="restrict to last N years")
    p.add_argument("--study-type", choices=sorted(STUDY_TYPE_FILTERS),
                   default=None)
    p.add_argument("--max", type=int, default=50, dest="max_results")
    p.add_argument("--english-only", action="store_true",
                   help="add English[lang]; off by default to avoid language bias")
    p.add_argument("--include-animal", action="store_true",
                   help="omit the human filter; for preclinical/animal questions only")
    p.add_argument("--out", type=Path, required=True,
                   help="output CSV path; parent dirs created")
    p.add_argument("--email", default=os.environ.get("NCBI_EMAIL", "anonymous@example.com"),
                   help="NCBI requests an email; set NCBI_EMAIL env or pass --email")
    args = p.parse_args()

    rows = search(args.query, args.years, args.study_type,
                  args.max_results, args.email, args.english_only,
                  args.include_animal)
    write_csv(rows, args.out)
    pmc_pct = sum(1 for r in rows if r["pmcid"]) / max(1, len(rows)) * 100
    print(f"__CE_PUBMED_RESULTS__ csv={args.out} n={len(rows)} "
          f"query={args.query!r} pmc_pct={pmc_pct:.0f}")


if __name__ == "__main__":
    main()
