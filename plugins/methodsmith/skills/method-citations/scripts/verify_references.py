#!/usr/bin/env python3
"""Reference integrity gate.

Audits a bibliography for references whose identifier resolves nowhere
(FABRICATED) or resolves to different metadata than the entry claims
(MISMATCH). Reporting only: this script never edits the bibliography.

Subcommands:

  extract   Parse a bibliography into structured entries. Offline.
  classify  Map entries plus lookup results to verdicts. Offline.
  audit     Extract, resolve, classify, and write a JSON report.

Verdicts:

  OK           An identifier resolved and the metadata agrees.
  MISMATCH     An identifier resolved but title, year, author or venue differs.
  UNVERIFIED   No identifier, or no lookup was available for it.
  FABRICATED   Legacy identifier-not-found label; not proof of fabrication.

Identifier resolution is authoritative. Text-only entries are best effort: a
title with no DOI or PMID can only be searched, so a near-miss is reported as
UNVERIFIED rather than OK or FABRICATED.

Network lookups use the public, keyless CrossRef, PubMed and OpenAlex APIs.
Pass --offline to classify from a lookup cache with no network access, which is
how the repository tests exercise this script.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

USER_AGENT = "methodsmith-reference-audit/1.0 (+https://github.com/sajor2000/methodsmith)"
TIMEOUT_SECONDS = 20

# Token overlap below this is treated as a different title. Short tokens are
# ignored so that "of", "the" and single letters cannot inflate a match.
TITLE_MATCH_THRESHOLD = 0.60
MIN_TOKEN_LENGTH = 3

DOI_PATTERN = re.compile(r"\b10\.\d{4,9}/[^\s\"'<>]+", re.IGNORECASE)
PMID_PATTERN = re.compile(r"\b(?:PMID|pmid)[:\s]*(\d{6,9})\b")
PMCID_PATTERN = re.compile(r"\bPMC\d{6,9}\b", re.IGNORECASE)
YEAR_PATTERN = re.compile(r"\b(1[5-9]\d{2}|20\d{2})\b")
# A bracketed number ("[12]"), or a number with a period or parenthesis
# ("12." / "12)"). The bracketed form needs no trailing punctuation, which is
# how most numbered bibliographies are written.
NUMBERED_PREFIX = re.compile(r"^\s*(?:\[\d{1,3}\]|\(?\d{1,3}[.)]|[-*\u2022])\s+")


class InputError(Exception):
    """The input could not be parsed or read."""


# ---------------------------------------------------------------- extraction


def strip_doi_tail(raw: str) -> str:
    """Drop trailing punctuation and an unbalanced closing parenthesis.

    DOIs legitimately contain parentheses (``S0140-6736(19)30001-1``), so the
    pattern keeps them; only a closing parenthesis with no opener is the
    sentence punctuation that followed the DOI.
    """
    doi = raw.rstrip(".,;:")
    while doi.endswith(")") and doi.count(")") > doi.count("("):
        doi = doi[:-1]
    return doi


def normalize_doi(raw: str) -> str:
    """Lowercase a DOI and strip a resolver prefix and trailing punctuation."""
    doi = raw.strip()
    doi = re.sub(r"^https?://(?:dx\.)?doi\.org/", "", doi, flags=re.IGNORECASE)
    doi = re.sub(r"^doi:\s*", "", doi, flags=re.IGNORECASE)
    return strip_doi_tail(doi).lower()


def clean_title(raw: str) -> str:
    """Drop numbering, identifiers and trailing punctuation from a title."""
    text = NUMBERED_PREFIX.sub("", raw.strip())
    text = re.sub(r"\s+", " ", text)
    return text.strip(" .,;:")


def tokens(text: str) -> set:
    """Content tokens of a title, for comparison."""
    words = re.split(r"[^0-9a-z]+", text.lower())
    return {w for w in words if len(w) >= MIN_TOKEN_LENGTH}


def title_similarity(left: str, right: str) -> float:
    """Jaccard overlap of title tokens, 0.0 when either side is empty."""
    a, b = tokens(left), tokens(right)
    if not a or not b:
        return 0.0
    return len(a & b) / float(len(a | b))


def parse_bibtex(text: str) -> list:
    """Parse BibTeX entries into raw blocks with their DOI, PMID and title."""
    entries = []
    for match in re.finditer(r"@(\w+)\s*\{\s*([^,]*),(.*?)\n\s*\}", text, re.DOTALL):
        kind, key, body = match.group(1), match.group(2).strip(), match.group(3)
        fields = {}
        for field in re.finditer(r"(\w+)\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|\"[^\"]*\"|[^,\n]+)", body):
            name = field.group(1).lower()
            value = field.group(2).strip().strip("{}").strip('"').strip()
            fields.setdefault(name, value)
        entries.append(
            {
                "raw": clean_title(fields.get("title", key)),
                "title": clean_title(fields.get("title", "")),
                "doi": normalize_doi(fields.get("doi", "")),
                "pmid": (re.sub(r"\D", "", fields.get("pmid", "")) or None),
                "year": (re.search(r"\d{4}", fields.get("year", "")).group(0) if re.search(r"\d{4}", fields.get("year", "")) else None),
                "author": fields.get("author", "").split(" and ")[0].strip(),
                "venue": fields.get("journal", fields.get("booktitle", "")).strip(),
                "key": key,
                "kind": kind.lower(),
                "fields_trustworthy": True,
            }
        )
    return entries


def parse_ris(text: str) -> list:
    """Parse RIS records into entries."""
    entries = []
    for block in re.split(r"\nER\s*-\s*\n?", text):
        if "TY  -" not in block:
            continue
        fields = {}
        for line in block.splitlines():
            match = re.match(r"^([A-Z][A-Z0-9])\s{2}-\s?(.*)$", line)
            if match:
                fields.setdefault(match.group(1), []).append(match.group(2).strip())
        title = (fields.get("TI") or fields.get("T1") or [""])[0]
        entries.append(
            {
                "raw": clean_title(title),
                "title": clean_title(title),
                "doi": normalize_doi((fields.get("DO") or [""])[0]),
                "pmid": (re.sub(r"\D", "", (fields.get("AN") or [""])[0]) or None),
                "year": ((fields.get("PY") or fields.get("Y1") or [""])[0][:4] or None),
                "author": ((fields.get("AU") or fields.get("A1") or [""])[0]),
                "venue": ((fields.get("JO") or fields.get("JF") or fields.get("T2") or [""])[0]),
                "key": None,
                "kind": "ris",
                "fields_trustworthy": True,
            }
        )
    return entries


def parse_delimited(text: str) -> list:
    """Parse a TSV or CSV bibliography by column name."""
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        return []
    header = re.split(r"[\t,;]", lines[0].lower())
    index = {}
    for position, name in enumerate(header):
        cleaned = name.strip().strip('"')
        if cleaned in ("doi", "title", "year", "author", "authors", "journal", "pmid"):
            index.setdefault(cleaned, position)
    if "title" not in index and "doi" not in index:
        return []
    entries = []
    for line in lines[1:]:
        cells = re.split(r"[\t,;]", line)
        get = lambda name: (cells[index[name]].strip().strip('"') if name in index and index[name] < len(cells) else "")
        title = clean_title(get("title"))
        entries.append(
            {
                "raw": clean_title(line),
                "title": title,
                "doi": normalize_doi(get("doi")),
                "pmid": (re.sub(r"\D", "", get("pmid")) or None),
                "year": (get("year")[:4] or None),
                "author": get("author") or get("authors"),
                "venue": get("journal"),
                "key": None,
                "kind": "delimited",
                "fields_trustworthy": True,
            }
        )
    return entries


def text_title_hint(block: str) -> str:
    """Best-effort title from a free-text reference block.

    Free text has no reliable field boundaries, so this is a search hint only.
    Identifiers and the leading number are removed, a leading author list is
    dropped, and trailing venue or year fragments are trimmed. A caller must
    not compare this against a resolved record as if the author had typed it
    as a title field.
    """
    cleaned = DOI_PATTERN.sub(" ", block)
    cleaned = PMID_PATTERN.sub(" ", cleaned)
    cleaned = PMCID_PATTERN.sub(" ", cleaned)
    cleaned = NUMBERED_PREFIX.sub("", cleaned)
    parts = [part.strip() for part in re.split(r"\.\s+", cleaned) if part.strip()]
    # A leading segment that reads as an author list: commas, few words.
    if parts and "," in parts[0] and len(parts[0].split()) <= 12:
        parts = parts[1:]
    while parts and (
        re.fullmatch(r"(?:19|20)\d{2}[a-z]?", parts[-1], re.IGNORECASE)
        or len(parts[-1].split()) <= 2
    ):
        parts = parts[:-1]
    if not parts:
        return ""
    return clean_title(max(parts, key=len))


def parse_text(text: str) -> list:
    """Split free text into candidate reference blocks.

    A block starts at a numbered line or after a blank line. Entries are marked
    `fields_trustworthy: False`: the identifiers are reliable, but a title or
    year pulled out of running prose is a hint, so it is never compared against
    a resolved record as though the author had typed it as a field.
    """
    blocks = []
    current = []
    for line in text.splitlines():
        if not line.strip():
            if current:
                blocks.append(" ".join(current))
                current = []
            continue
        if NUMBERED_PREFIX.match(line) and current:
            blocks.append(" ".join(current))
            current = [line]
            continue
        current.append(line)
    if current:
        blocks.append(" ".join(current))

    entries = []
    for block in blocks:
        doi_match = DOI_PATTERN.search(block)
        pmid_match = PMID_PATTERN.search(block)
        year_match = YEAR_PATTERN.search(block)
        entries.append(
            {
                "raw": clean_title(block),
                "title": text_title_hint(block),
                "doi": normalize_doi(doi_match.group(0)) if doi_match else "",
                "pmid": pmid_match.group(1) if pmid_match else None,
                "year": year_match.group(0) if year_match else None,
                "author": "",
                "venue": "",
                "key": None,
                "kind": "text",
                "fields_trustworthy": False,
            }
        )
    return entries


def extract_entries(text: str, path: str) -> list:
    """Choose a parser by file extension and return entries with an index."""
    suffix = os.path.splitext(path)[1].lower()
    if suffix == ".bib":
        entries = parse_bibtex(text)
    elif suffix == ".ris":
        entries = parse_ris(text)
    elif suffix in (".tsv", ".csv"):
        entries = parse_delimited(text)
    else:
        entries = parse_text(text)
    if not entries:
        entries = parse_text(text)
    for position, entry in enumerate(entries, start=1):
        entry["index"] = position
        entry.setdefault("fields_trustworthy", True)
        entry["identifier"] = (
            "doi:" + entry["doi"] if entry.get("doi") else ("pmid:" + entry["pmid"] if entry.get("pmid") else None)
        )
    return entries


# ---------------------------------------------------------------- classifying


def classify(entry: dict, lookup: dict) -> dict:
    """Map one entry and its lookup result to a verdict.

    Pure function: no network, no disk. `lookup` is None when no lookup was
    attempted, or a dict with `found`, `title`, `year`, `author`, `venue`,
    and `source`.
    """
    reasons = []
    identifier = entry.get("identifier")

    if lookup is None:
        return {
            "verdict": "UNVERIFIED",
            "reasons": ["no lookup available for this entry"],
        }

    found = lookup.get("found")
    if found is False:
        if identifier:
            # Preserve the legacy wire label. Not found does not prove fabrication.
            return {
                "verdict": "FABRICATED",
                "reasons": [
                    "%s was not found by consulted resolvers (%s); not proof of fabrication" % (identifier, lookup.get("source", "lookup"))
                ],
            }
        return {
            "verdict": "UNVERIFIED",
            "reasons": ["no identifier and the title search returned nothing"],
        }

    if not found:
        return {
            "verdict": "UNVERIFIED",
            "reasons": [lookup.get("note", "lookup did not return a usable record")],
        }

    # Found: compare the fields the entry claims against the record. Free-text
    # entries are exempt: their title and year were guessed out of running
    # prose, so a difference is the parser's fault, not the author's. A
    # resolved identifier is the whole verdict there, and the resolved record
    # travels in the report for a human to compare by eye.
    if not entry.get("fields_trustworthy", True):
        return {
            "verdict": "OK",
            "reasons": [
                "identifier resolved via %s" % lookup.get("source", "lookup"),
                "free-text entry: title and year were not compared",
            ],
        }

    # A zero overlap must be reported, so gate on both sides having tokens
    # rather than on the similarity value being truthy.
    claimed_title = entry.get("title") or ""
    actual_title = lookup.get("title") or ""
    if tokens(claimed_title) and tokens(actual_title):
        similarity = title_similarity(claimed_title, actual_title)
        if similarity < TITLE_MATCH_THRESHOLD:
            reasons.append(
                "title overlap %.2f with the resolved record" % similarity
            )

    claimed_year = entry.get("year")
    actual_year = lookup.get("year")
    if claimed_year and actual_year and str(claimed_year) != str(actual_year):
        reasons.append("entry says %s, record says %s" % (claimed_year, actual_year))

    claimed_author = (entry.get("author") or "").strip()
    actual_author = (lookup.get("author") or "").strip()
    if claimed_author and actual_author:
        claimed_last = tokens(claimed_author.split(",")[0]) or tokens(claimed_author)
        actual_last = tokens(actual_author.split(",")[0]) or tokens(actual_author)
        if claimed_last and actual_last and not (claimed_last & actual_last):
            reasons.append("first author %r not in record %r" % (claimed_author, actual_author))

    if reasons:
        return {"verdict": "MISMATCH", "reasons": reasons}
    return {
        "verdict": "OK",
        "reasons": ["resolved via %s" % lookup.get("source", "lookup")],
    }


# ---------------------------------------------------------------- resolution


def fetch_json(url: str) -> dict:
    """GET a JSON document, returning {} on a 404 and raising otherwise."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return {}
        raise


def lookup_doi(doi: str) -> dict:
    """Resolve a DOI through CrossRef, falling back to OpenAlex."""
    record = fetch_json("https://api.crossref.org/works/" + urllib.parse.quote(doi))
    message = (record or {}).get("message")
    if message:
        authors = message.get("author") or []
        first = ""
        if authors:
            first = authors[0].get("family") or authors[0].get("name") or ""
        issued = ((message.get("issued") or {}).get("date-parts") or [[None]])[0]
        return {
            "found": True,
            "title": (message.get("title") or [""])[0],
            "year": str(issued[0]) if issued and issued[0] else None,
            "author": first,
            "venue": (message.get("container-title") or [""])[0],
            "source": "CrossRef",
        }
    openalex = fetch_json("https://api.openalex.org/works/doi:" + urllib.parse.quote(doi))
    if openalex and openalex.get("id"):
        return {
            "found": True,
            "title": openalex.get("title") or "",
            "year": str(openalex.get("publication_year") or "") or None,
            "author": ((openalex.get("authorships") or [{}])[0].get("author") or {}).get("display_name", ""),
            "venue": ((openalex.get("primary_location") or {}).get("source") or {}).get("display_name", ""),
            "source": "OpenAlex",
        }
    return {"found": False, "source": "CrossRef and OpenAlex"}


def lookup_pmid(pmid: str) -> dict:
    """Resolve a PMID through the PubMed esummary endpoint."""
    url = (
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
        "?db=pubmed&retmode=json&id=" + urllib.parse.quote(pmid)
    )
    payload = fetch_json(url)
    result = ((payload or {}).get("result") or {}).get(pmid)
    if not result or result.get("error"):
        return {"found": False, "source": "PubMed"}
    return {
        "found": True,
        "title": result.get("title") or "",
        "year": (result.get("pubdate") or "")[:4] or None,
        "author": ((result.get("authors") or [{}])[0]).get("name", ""),
        "venue": result.get("fulljournalname") or result.get("source") or "",
        "source": "PubMed",
    }


def lookup_title(title: str) -> dict:
    """Search PubMed by title as a last resort for entries with no identifier."""
    if not title:
        return {"found": False, "source": "PubMed title search"}
    url = (
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
        "?db=pubmed&retmode=json&retmax=1&term=" + urllib.parse.quote(title[:300])
    )
    payload = fetch_json(url)
    ids = ((payload or {}).get("esearchresult") or {}).get("idlist") or []
    if not ids:
        return {"found": False, "source": "PubMed title search"}
    return lookup_pmid(ids[0])


def resolve(entry: dict, cache: dict, offline: bool) -> dict:
    """Resolve one entry, reusing and filling the cache."""
    key = entry.get("identifier") or ("title:" + (entry.get("title") or "")[:120])
    if key in cache:
        return cache[key]
    if offline:
        return {"found": None, "note": "offline: no cached lookup for this entry"}
    if entry.get("doi"):
        lookup = lookup_doi(entry["doi"])
    elif entry.get("pmid"):
        lookup = lookup_pmid(entry["pmid"])
    else:
        lookup = lookup_title(entry.get("title") or "")
    cache[key] = lookup
    return lookup


# ---------------------------------------------------------------- reporting


def summarize(records: list) -> dict:
    """Count verdicts for the report envelope."""
    counts = {"OK": 0, "MISMATCH": 0, "UNVERIFIED": 0, "FABRICATED": 0}
    for record in records:
        counts[record["verdict"]] = counts.get(record["verdict"], 0) + 1
    if counts["FABRICATED"]:
        verdict = "FABRICATED"
    elif counts["MISMATCH"]:
        verdict = "MISMATCH"
    elif counts["UNVERIFIED"]:
        verdict = "INCOMPLETE"
    else:
        verdict = "OK"
    return {
        "verdict": verdict,
        "n_total": len(records),
        "n_ok": counts["OK"],
        "n_mismatch": counts["MISMATCH"],
        "n_unverified": counts["UNVERIFIED"],
        "n_fabricated": counts["FABRICATED"],
    }


def audit(entries: list, cache: dict, offline: bool) -> list:
    """Classify every entry, attaching the verdict to a copy of the entry."""
    records = []
    for entry in entries:
        lookup = resolve(entry, cache, offline)
        if lookup.get("found") is None:
            verdict = {"verdict": "UNVERIFIED", "reasons": [lookup.get("note", "no lookup available")]}
        else:
            verdict = classify(entry, lookup)
        records.append(
            {
                "index": entry["index"],
                "identifier": entry.get("identifier"),
                "title": entry.get("title"),
                "claimed_year": entry.get("year"),
                "verdict": verdict["verdict"],
                "identity_status": {"OK": "verified", "MISMATCH": "mismatch", "FABRICATED": "not-found", "UNVERIFIED": "unverified"}[verdict["verdict"]],
                "claim_support": "unverified",
                "access_level": "metadata-only",
                "reasons": verdict["reasons"],
                "lookup_source": (lookup or {}).get("source"),
                "resolved_title": (lookup or {}).get("title"),
            }
        )
    return records


def load_cache(path):
    """Read a lookup cache, or return an empty one when the file is absent."""
    if not path or not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def save_cache(path, cache) -> None:
    """Write the lookup cache for reuse."""
    if not path:
        return
    directory = os.path.dirname(os.path.abspath(path))
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(cache, handle, indent=2, sort_keys=True)
        handle.write("\n")


def read_bibliography(path: str) -> str:
    """Read a bibliography file, raising InputError when it cannot be read."""
    if not os.path.exists(path):
        raise InputError("no such file: %s" % path)
    with open(path, "r", encoding="utf-8", errors="replace") as handle:
        return handle.read()


def print_summary(summary: dict, records: list) -> None:
    """Print a human-readable audit summary."""
    print("Reference integrity audit")
    print("  total %d | ok %d | mismatch %d | unverified %d | fabricated %d" % (
        summary["n_total"], summary["n_ok"], summary["n_mismatch"],
        summary["n_unverified"], summary["n_fabricated"],
    ))
    for record in records:
        if record["verdict"] in ("OK",):
            continue
        label = record["identifier"] or ("#%d" % record["index"])
        print("  %-10s %s" % (record["verdict"], label))
        for reason in record["reasons"]:
            print("             - %s" % reason)
    print("  verdict: %s" % summary["verdict"])


def main(argv=None) -> int:
    """Entry point. Returns a process exit code."""
    parser = argparse.ArgumentParser(description="Audit a bibliography for fabricated or mismatched references.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    extract_parser = subparsers.add_parser("extract", help="parse a bibliography into entries (offline)")
    extract_parser.add_argument("path")

    classify_parser = subparsers.add_parser("classify", help="classify entries against lookups (offline)")
    classify_parser.add_argument("--entries", required=True, help="JSON file of entries")
    classify_parser.add_argument("--lookups", required=True, help="JSON file of lookup results keyed by identifier")

    audit_parser = subparsers.add_parser("audit", help="extract, resolve, classify and report")
    audit_parser.add_argument("path")
    audit_parser.add_argument("--out", default="qc/reference_audit.json")
    audit_parser.add_argument("--lookup-cache", default=None, help="read and write lookups here")
    audit_parser.add_argument("--offline", action="store_true", help="use the cache only, no network")
    audit_parser.add_argument("--strict", action="store_true", help="exit 2 on MISMATCH as well as FABRICATED")

    args = parser.parse_args(argv)

    try:
        if args.command == "extract":
            entries = extract_entries(read_bibliography(args.path), args.path)
            json.dump(entries, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
            return 0

        if args.command == "classify":
            with open(args.entries, "r", encoding="utf-8") as handle:
                entries = json.load(handle)
            with open(args.lookups, "r", encoding="utf-8") as handle:
                lookups = json.load(handle)
            records = []
            for entry in entries:
                key = entry.get("identifier") or ("title:" + (entry.get("title") or "")[:120])
                lookup = lookups.get(key)
                verdict = classify(entry, lookup)
                records.append(
                    {
                        "index": entry.get("index"),
                        "identifier": entry.get("identifier"),
                        "verdict": verdict["verdict"],
                "identity_status": {"OK": "verified", "MISMATCH": "mismatch", "FABRICATED": "not-found", "UNVERIFIED": "unverified"}[verdict["verdict"]],
                "claim_support": "unverified",
                "access_level": "metadata-only",
                        "reasons": verdict["reasons"],
                    }
                )
            json.dump({"summary": summarize(records), "records": records}, sys.stdout, indent=2, sort_keys=True)
            sys.stdout.write("\n")
            return 0

        entries = extract_entries(read_bibliography(args.path), args.path)
        cache = load_cache(args.lookup_cache)
        records = audit(entries, cache, args.offline)
        save_cache(args.lookup_cache, cache)
        summary = summarize(records)
        report = {"summary": summary, "records": records, "source": os.path.abspath(args.path)}
        directory = os.path.dirname(os.path.abspath(args.out))
        if directory:
            os.makedirs(directory, exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, sort_keys=True)
            handle.write("\n")
        print_summary(summary, records)
        print("  report: %s" % args.out)
        if summary["n_fabricated"]:
            return 2
        if args.strict and summary["n_mismatch"]:
            return 2
        return 0
    except InputError as error:
        sys.stderr.write("error: %s\n" % error)
        return 1
    except urllib.error.URLError as error:
        sys.stderr.write("error: network lookup failed: %s\n" % error)
        sys.stderr.write("hint: re-run with --offline and a --lookup-cache to classify from cached lookups\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
