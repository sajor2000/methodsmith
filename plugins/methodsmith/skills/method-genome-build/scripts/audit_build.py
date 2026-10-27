"""Audit every reference-aware bioinformatics output for genome-build consistency.

Walks an analysis directory and inspects:
  - BAM/CRAM @SQ headers via samtools view -H
  - VCF/VCF.gz ##contig and ##reference lines
  - GTF/GFF3 first non-comment line for chromosome naming convention

Detects:
  - chr-prefix mixing ("chr1" vs "1" -- common GRCh37 vs GRCh38 confusion)
  - GRCh37/hg19 contigs in a GRCh38-declared run
  - Different MD5 sums for the same contig name

Exits non-zero on any mismatch so the skill can gate the next step.

Usage:
    python audit_build.py analysis/bioinfo \\
        --declared GRCh38 \\
        --manifest analysis/genome-build/audit-findings.yaml \\
        --report analysis/genome-build/audit-report.md
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path


KNOWN_BUILDS = {
    "GRCh37": {"chr1_md5_no_chr": "1b22b98cdeb4a9304cb5d48026a85128",  # 1000G GRCh37
               "lengths": {"1": 249250621, "8": 146364022},
               "synonyms":        ("GRCh37", "hg19", "b37")},
    "GRCh38": {"chr1_md5_no_chr": "6aef897c3d6ff0c78aff06ac189178dd",  # GRCh38
               "lengths": {"1": 248956422, "8": 145138636},
               "synonyms":        ("GRCh38", "hg38")},
    "T2T":    {"chr1_md5_no_chr": None,
               "lengths": {"1": 248387328, "8": 146259331},  # CHM13 v2.0 only
               "synonyms":        ("T2T-CHM13", "CHM13", "T2T")},
}


def have(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def inspect_bam(path: Path) -> dict:
    if not have("samtools"):
        return {"path": str(path), "error": "samtools not installed; cannot inspect"}
    try:
        out = subprocess.check_output(["samtools", "view", "-H", str(path)],
                                       stderr=subprocess.DEVNULL).decode()
    except subprocess.CalledProcessError as e:
        return {"path": str(path), "error": f"samtools failed: {e}"}

    contigs = []
    for line in out.splitlines():
        if line.startswith("@SQ"):
            sn = m5 = ln = None
            for tag in line.split("\t")[1:]:
                if   tag.startswith("SN:"): sn = tag[3:]
                elif tag.startswith("M5:"): m5 = tag[3:]
                elif tag.startswith("LN:"): ln = tag[3:]
            contigs.append({"sn": sn, "m5": m5, "ln": ln})
    return {"path": str(path), "kind": "bam", "contigs": contigs}


def inspect_vcf(path: Path) -> dict:
    opener = gzip.open if path.suffix == ".gz" else open
    contigs, ref = [], None
    try:
        with opener(path, "rt") as fh:
            for line in fh:
                if not line.startswith("#"):
                    break
                if line.startswith("##contig="):
                    m_id  = re.search(r"ID=([^,>]+)", line)
                    m_md5 = re.search(r"md5=([^,>]+)", line)
                    m_len = re.search(r"length=([^,>]+)", line)
                    m_assembly = re.search(r"assembly=([^,>]+)", line)
                    contigs.append({"sn": m_id.group(1) if m_id else None,
                                     "ln": m_len.group(1) if m_len else None,
                                     "assembly": m_assembly.group(1).strip('"') if m_assembly else None,
                                     "m5": m_md5.group(1) if m_md5 else None})
                elif line.startswith("##reference="):
                    ref = line.strip().split("=", 1)[1]
    except Exception as e:
        return {"path": str(path), "error": str(e)}
    return {"path": str(path), "kind": "vcf", "contigs": contigs, "reference": ref}


def inspect_gtf(path: Path) -> dict:
    opener = gzip.open if path.suffix == ".gz" else open
    first_chrom = source = None
    try:
        with opener(path, "rt") as fh:
            for line in fh:
                if line.startswith("#!"):
                    if "genome-build" in line or "genome-version" in line:
                        source = (source or "") + line.strip() + "; "
                    continue
                if line.startswith("#"):
                    continue
                first_chrom = line.split("\t", 1)[0]
                break
    except Exception as e:
        return {"path": str(path), "error": str(e)}
    return {"path": str(path), "kind": "gtf",
            "first_chrom": first_chrom, "header_meta": source}


def chr_style(name: str | None) -> str:
    if name is None: return "unknown"
    if name.startswith("chr"): return "chr-prefixed"
    return "unprefixed"


def audit(root: Path, declared: str) -> tuple[list[dict], list[str]]:
    findings: list[dict] = []
    issues: list[str] = []
    if not root.is_dir():
        return findings, ["audit root is not an existing directory; no files inspected"]

    bam_files = list(root.rglob("*.bam")) + list(root.rglob("*.cram"))
    vcf_files = list(root.rglob("*.vcf")) + list(root.rglob("*.vcf.gz"))
    gtf_files = list(root.rglob("*.gtf")) + list(root.rglob("*.gtf.gz")) \
              + list(root.rglob("*.gff3")) + list(root.rglob("*.gff3.gz"))

    for f in bam_files: findings.append(inspect_bam(f))
    for f in vcf_files: findings.append(inspect_vcf(f))
    for f in gtf_files: findings.append(inspect_gtf(f))
    if not findings:
        return findings, ["no supported reference-aware files found; build not verified"]

    # Cross-file consistency checks.
    md5_by_contig: dict[str, set[str]] = defaultdict(set)
    chr_styles_seen: set[str] = set()

    for f in findings:
        if "error" in f:
            f["status"] = "uninspected"
            issues.append(f"{f['path']}: uninspected: {f['error']}")
            continue
        for c in f.get("contigs", []) or []:
            if c.get("m5"): md5_by_contig[c["sn"]].add(c["m5"])
            chr_styles_seen.add(chr_style(c["sn"]))
        if f.get("kind") == "gtf" and f.get("first_chrom"):
            chr_styles_seen.add(chr_style(f["first_chrom"]))

    for contig, md5s in md5_by_contig.items():
        if len(md5s) > 1:
            issues.append(f"contig {contig} has differing MD5 across files: "
                          f"{sorted(md5s)} (likely cross-build mixing)")

    if {"chr-prefixed", "unprefixed"} <= chr_styles_seen:
        issues.append("both chr-prefixed and unprefixed contig naming detected; "
                      "naming differs, which alone does not identify a build")

    # Build-specific MD5 check on chromosome 1.
    spec = KNOWN_BUILDS.get(declared, {})
    expected_md5 = spec.get("chr1_md5_no_chr")
    for f in findings:
        if f.get("status") == "uninspected":
            continue
        evidence, mismatches = [], []
        declarations = [f.get("reference"), f.get("header_meta")]
        declarations += [c.get("assembly") for c in f.get("contigs", [])]
        unsupported_t2t = False
        for declaration in filter(None, declarations):
            for build, known in KNOWN_BUILDS.items():
                if any(re.search(r"(?<![A-Za-z0-9])" + re.escape(alias) + r"(?![0-9])", declaration, re.I)
                       for alias in known["synonyms"]):
                    if build != declared:
                        mismatches.append(f"header declares {build}, expected {declared}")
                    else:
                        evidence.append("matching build declaration")
            if declared == "T2T" and re.search(r"(?:CHM13|T2T)[._-]?v(?!2\.0(?:\D|$))\d", declaration, re.I):
                unsupported_t2t = True
        for c in f.get("contigs", []):
            chrom = re.sub(r"^chr", "", c.get("sn") or "")
            expected_length = spec["lengths"].get(chrom)
            if expected_length and c.get("ln") is not None:
                if str(c["ln"]) != str(expected_length):
                    mismatches.append(f"chromosome {chrom} length {c['ln']} differs from {declared} length {expected_length}")
                else:
                    evidence.append(f"matching chromosome {chrom} length")
            if chrom == "1" and expected_md5 and c.get("m5"):
                if c["m5"].lower() != expected_md5:
                    mismatches.append(f"chromosome 1 MD5 differs from declared build {declared}")
                else:
                    evidence.append("matching chromosome 1 MD5")
        if mismatches:
            f["status"] = "incompatible"
            issues.extend(f"{f['path']}: {message}" for message in mismatches)
        elif unsupported_t2t or not evidence:
            f["status"] = "unknown"
            issues.append(f"{f['path']}: unknown build evidence (T2T length checks support CHM13 v2.0 only)")
        else:
            f["status"] = "verified"
        f["evidence"] = evidence

    return findings, issues


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("root", type=Path)
    ap.add_argument("--declared", required=True, choices=list(KNOWN_BUILDS))
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--report",   type=Path, required=True)
    args = ap.parse_args()

    findings, issues = audit(args.root, args.declared)

    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)

    payload = {"declared_build": args.declared, "verification_scope": "header evidence; not complete sequence identity",
               "files": findings}
    serialized = json.dumps(payload, sort_keys=True, indent=2, ensure_ascii=False) + "\n"
    if args.manifest.suffix != ".json":
        try:
            import yaml
        except ImportError:
            pass  # JSON is valid YAML when PyYAML is unavailable.
        else:
            serialized = yaml.safe_dump(payload, sort_keys=True, allow_unicode=True)
    args.manifest.write_text(serialized)

    # Markdown report
    md = [f"# Genome-build audit", "",
          f"Declared build: **{args.declared}**",
          f"Files inspected: {len(findings)}",
          "Scope: header declarations, diagnostic contig lengths and available MD5s; not complete sequence identity.",
          f"Issues found: **{len(issues)}**", ""]
    if issues:
        md.append("## Issues")
        md.extend(f"- {x}" for x in issues)
    else:
        md.append("All inspected files have compatible build-header evidence; sequence identity was not established.")
    args.report.write_text("\n".join(md) + "\n")

    print(f"__CE_GENOME_BUILD__ declared={args.declared} files={len(findings)} "
          f"issues={len(issues)} manifest={args.manifest} report={args.report}")
    sys.exit(0 if not issues else 2)


if __name__ == "__main__":
    main()
