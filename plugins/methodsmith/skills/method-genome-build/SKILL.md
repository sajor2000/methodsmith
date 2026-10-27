---
name: method-genome-build
description: "Pins genome build, annotation release, contig naming, and liftover for genomics data. Use when the user mentions GRCh37/38, hg19/hg38, T2T, GENCODE/Ensembl versions, or liftover."
argument-hint: "[--ref-fasta path, --annotation-gtf path, --check]"
---

# Genome Build Traceability


## Skill Value

- **Problem it solves:** Genomics analyses silently break when build, annotation, or contig conventions drift.
- **Use when:** The user mentions genome build, GRCh37/38, hg19/hg38, annotation versions, liftover, or VCF/BAM compatibility.
- **Output:** Genome-build decision record with reference sources and downstream constraints.
- **Ask only if:** Only when build, annotation source, or target assay cannot be inferred.
- **Do not do:** Do not run variant analysis or liftover without explicit workflow scope.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Pins the reference genome and annotation versions used in a bioinformatics study, and audits every output for build consistency. Without this, a paper claiming "we used GRCh38" can have outputs silently aligned to GRCh37 because a single tool defaulted to its bundled reference.

## When this skill activates

- Start of a new bioinformatics study (declare the build)
- After a reference update (re-declare and audit)
- Manual: `method-genome-build --check` to audit; `method-genome-build --ref-fasta refs/GRCh38.fa --annotation-gtf refs/gencode.v44.gtf` to declare

## Prerequisites

- Reference FASTA file (or path to a reference manifest if using shared references)
- Annotation file (GTF / GFF / BED)
- Tools to inspect BAM headers: `samtools view -H`
- Tools to inspect VCF headers: `bcftools view -h`

## Core workflow

### Step 1: Declare the build (`--ref-fasta` / `--annotation-gtf`)

Hash the reference FASTA and establish the assembly from source provenance, diagnostic contig lengths and available sequence checksums. A first contig name or `chr` prefix does not identify a genome build.

The values below are an illustrative example (GENCODE 44, equivalent to Ensembl release 110); resolve the current release, URLs, md5s, and counts for the build you actually declare rather than copying these.

```yaml
genome_build:
  build: GRCh38
  patch: GRCh38.p14
  source: https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_44/GRCh38.primary_assembly.genome.fa.gz
  fasta_md5: <md5 of unzipped FASTA>
  contigs:
    primary: ["chr1", "chr2", ..., "chrX", "chrY", "chrM"]   # GENCODE/UCSC naming; Ensembl FASTAs use 1..22, X, Y, MT
    alt_count: 0   # primary_assembly FASTA; the full GRCh38 assembly adds 261 ALT loci
  annotation:
    name: GENCODE
    version: 44
    source_url: https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human/release_44/gencode.v44.annotation.gtf.gz
    md5: <md5>
    gene_count: 62700
    transcript_count: 252835   # GENCODE 44 statistics page
declared_at: <ISO8601>
declared_by: <user>
```

Write to `analysis/genome-build/manifest.yaml`. Commit this; it is the build-truth for the study.

### Step 2: Audit mode (--check)

Walk the project for build artifacts. When a build or naming is not declared in a header, infer it with `references/build-detection-rules.md` (contig lengths, naming, annotation file names).

| Artifact | Inspect | Expect |
|----------|---------|--------|
| BAM / CRAM | `@SQ` lines (reference contig names + LN lengths) | Match manifest contigs and lengths |
| BAM / CRAM | `@PG` lines | Tool used to align, version |
| VCF | `##contig=<ID=...,length=...,assembly=...>` | Match manifest |
| VCF | `##reference=` | URL or path matches manifest source |
| BED / Interval list | First contig name format (chr1 vs 1) | Consistent with manifest contig style |
| Counts matrix (RNA-seq) | rownames or `gene_id` column format | Match annotation gene_ids (e.g., ENSG00000... if Ensembl) |
| Variant call output | `INFO/CSQ` annotation source if VEP | VEP cache version matches manifest |

For each file, determine its build (often inferable from contig naming + checksums). Flag mismatches:

- **P0:** Different build between BAM and VCF (alignment in GRCh38, called against GRCh37 reference)
- **P0:** Annotation version drift (Counts matrix uses GENCODE 36 but manifest says GENCODE 44)
- **P1:** Contig naming inconsistency (chr1 vs 1) -- usually fixable but breaks tools
- **P1:** Tool version not recorded in `@PG` lines

### Step 3: Per-output traceability table

Produce `analysis/genome-build/traceability.csv`:

| output_file | build | annotation | tool | tool_version | match_manifest |
|-------------|-------|------------|------|--------------|----------------|
| variants/cohort.vcf.gz | GRCh38 | -- | GATK | 4.5.0 | yes |
| counts/gene-counts.tsv | -- | GENCODE 44 | featureCounts | 2.0.6 | yes |
| methylation/beta.csv | -- | EPIC v1 | sesame | 1.20 | yes |

This table goes into the manuscript as a supplementary file -- it answers "what build did you use?" verifiably.

### Step 4: Surface mismatches

If `--check` found any P0 → exit non-zero, print a clear report. The user resolves before proceeding.

## What this skill does NOT do

- Does not re-align or re-call (that's a pipeline run)
- Does not download references (user supplies paths)
- Does not validate reference correctness against external truth -- only internal consistency

## References

`scripts/audit_build.py` supports Step 2 with build declarations, diagnostic chromosome-1/8 lengths, available chromosome-1 MD5s, and naming consistency. `--declared` accepts `GRCh37`, `GRCh38` and `T2T` (requires an explicit CHM13/T2T v2.0 declaration; diagnostic lengths support that version only). Each file is `verified` for compatible header evidence, `incompatible`, `unknown`, or `uninspected`; this does not establish complete sequence identity or annotation-release parity. Missing tools, absent evidence, unsupported T2T versions, or no inspected files block a clean result. It writes YAML (JSON for a `.json` destination), a Markdown report, and `__CE_GENOME_BUILD__ declared=<build> files=<n> issues=<n> manifest=<path> report=<path>`. Exit 2 requires resolution, including P1 naming issues; a prefix difference alone is not a build mismatch. Complete the other Step 2 manual checks before declaring the audit complete. `--manifest` is overwritten, so never point it at `analysis/genome-build/manifest.yaml`:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/audit_build.py" <project-dir> --declared GRCh38 --manifest analysis/genome-build/audit-findings.yaml --report analysis/genome-build/audit-report.md
```

`references/build-detection-rules.md` — build inference rules used in Step 2.
