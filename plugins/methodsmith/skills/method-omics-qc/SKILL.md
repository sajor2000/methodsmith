---
name: method-omics-qc
description: "Runs sequencing and omics QA: FASTQ, BAM/CRAM, VCF, count matrices, methylation arrays, sample swaps, batch confounding. Use when omics data needs QC before analysis."
argument-hint: "<data dir or sample sheet>, optional: --modality wgs|wes|rnaseq|chipseq|methyl|atac"
---

# Bioinformatics Data QA Gate


## Skill Value

- **Problem it solves:** Sequencing and omics projects can move into analysis before raw data quality, sample identity, and batch confounding are checked.
- **Use when:** The user mentions FASTQ, BAM/CRAM, VCF, RNA-seq, WGS/WES, ATAC-seq, methylation arrays, FastQC, MultiQC, sample swaps, or omics batch effects.
- **Output:** A GO/NO-GO omics QA summary with modality-specific checks and blockers for downstream analysis.
- **Ask only if:** Only when modality, sample sheet, batch variable, or case/control grouping cannot be inferred.
- **Do not do:** Do not run differential expression, association testing, or clinical interpretation.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

The omics counterpart to `method-data-qa`. Sequencing and array data fail in domain-specific ways (low base quality, adapter contamination, sample swaps, batch confounds with condition); this skill runs the right QC for the modality.

## When this skill activates

- A new sequencing run / array batch was just registered as a data wave
- Before differential expression / variant calling / methylation analysis
- After a re-sequence following a sample-quality-fail
- Before sharing data to a collaborator (sanity check)
- Manual: `method-omics-qc /data/runs/run_2025_04 --modality rnaseq`

## Prerequisites

- A sample sheet (CSV/TSV) listing samples, files, and at minimum a `condition` and `batch` column
- Tools available locally OR via Conda: `fastqc`, `multiqc`, `samtools`, `picard`, `mosdepth`, `somalier` (sample swap), `picard CrosscheckFingerprints`
- For methylation: `minfi` / `sesame` (R)
- For RNA-seq: `salmon` or `STAR` outputs (or raw FASTQ)

## Evidence access

When this run needs literature, read `references/evidence-access.md` first; never invent a citation, effect size, or guideline item.

- **Look up here:** modality-specific QC benchmarks (depth, mapping and duplicate rates, contamination, rRNA and intergenic fractions, detection p-values, FRiP/TSS enrichment, mitochondrial fraction, Ti/Tv) and batch-effect test conventions; every threshold the report applies is either cited by PMID (tool manuals count as `documentation`) or marked `project default`.

## Core workflow

### Step 1: Modality detection

If `--modality` not passed, sniff the file extensions and tool outputs:
- `*.fastq.gz` only → fastq stage
- `*.bam` / `*.cram` → alignment stage
- counts matrix (`counts.tsv`, `salmon.sf`) → quantification stage
- `.idat` / `_Methylation_*.csv` → methylation array
- VCF → variant calling stage

Different modality → different checks. Refuse to proceed if conflicting signals (mixed FASTQ + count matrix without explicit modality).

### Step 2: Run modality-specific checks

| Modality | Tool | Check |
|----------|------|-------|
| FASTQ (any) | FastQC | per-base quality, adapter content, GC distribution, kmer content |
| FASTQ (any) | MultiQC | aggregate report; sample-to-sample outliers |
| BAM (WGS/WES) | samtools flagstat | mapping rate, duplicate rate, paired-properly rate |
| BAM (WGS/WES) | mosdepth | coverage uniformity, mean depth, % on-target |
| BAM (RNA-seq) | RSeQC / Picard CollectRnaSeqMetrics | strand specificity, intronic/intergenic % |
| BAM (any) | somalier extract + relate | sample swap detection (genotype concordance to expected sex / pedigree) |
| BAM (any) | Picard CrosscheckFingerprints | sample swap via fingerprint VCF if available |
| Counts matrix | DESeq2 `vst()`/`rlog()` or edgeR `cpm(log = TRUE)`, then PCA (not raw counts) | sample clustering vs declared condition / batch |
| Counts matrix | `sva::num.sv` / `svaseq`, `RUVSeq::RUVg` diagnostics | surrogate-variable / unwanted-variation detection (report only; correction is a downstream choice) |
| Methylation IDAT | minfi qcReport | bisulfite conversion efficiency, detection p-value |
| Methylation array | sesame | sex-prediction discordance |
| VCF | bcftools stats | Ti/Tv ratio, het/hom ratio, novel variant fraction |

### Step 3: Batch-effect screening (no removal)

Always inspect the sample-design cross-tabulation, rank of `~ batch + condition`, and estimability of the intended contrast before expression PCA. Complete aliasing is a P0 blocker even when PC1/PC2 show no batch separation; larger unrelated variation can hide it in later PCs. Then run PCA on variance-stabilized/log-CPM counts or the appropriate transformed assay matrix, colored by batch and condition. Grade partial association with Cramér's V (equivalent to |phi| for two-level factors), using the project-default thresholds in `references/batch-confound-rules.md`: V above 0.5 is a P0 review flag; 0.3-0.5 is a P1 warning. V and PCA cannot establish identifiability; distinguish a full-rank but unbalanced design from a non-estimable contrast. For full aliasing, report:

> Batch is confounded with condition. No correction, matching, or stable result after deleting a batch identifies this contrast under full aliasing. Re-block/recollect, or restrict to a different contrast that actually has within-batch support. For an identifiable partially confounded design, model batch in the differential-analysis design (`~ batch + condition`) rather than testing a batch-corrected matrix.

### Step 4: Sample swap screening

For BAM data, run somalier `relate` against the expected pedigree (or against declared sample sex). For each sample where the predicted sex / kinship doesn't match the sample sheet → P0 finding `sample-swap-suspected`.

### Step 5: Report

Write `reports/bioinfo-qa/<wave_id>.html` (MultiQC-rendered) and `reports/bioinfo-qa/<wave_id>.md` summary:

1. Modality and N samples
2. Per-sample pass/warn/fail table, naming each threshold's source (PMID or `project default`)
3. Batch confound assessment
4. Sample swap assessment
5. Aggregate metrics (mean coverage, mean Q score, % aligned, etc.)
6. Sign-off block

### Step 6: Emit GO/NO-GO

`__CE_BIOINFO_QC_PASS__` or `__CE_BIOINFO_QC_FAIL__ wave=<id> blockers=<count>`

Completion check: every fail row names its threshold source (PMID or `project default`); a missing tool is reported as "check not run", never as pass.

## What this skill does NOT do

- Does not modify the data (read-only)
- Does not remove batch effects (only flags; removal is a downstream choice)
- Does not call variants or quantify expression (use a pipeline reviewed by `method-bioinfo-pipeline-reviewer`)
- Does not de-identify (genomic data has its own re-identification rules; consult IRB)

## References

@./references/modality-checks.md

@./references/batch-confound-rules.md
