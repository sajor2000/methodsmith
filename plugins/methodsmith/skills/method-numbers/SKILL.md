---
name: method-numbers
description: "Locks manuscript numbers to an analysis-written registry; a fail-closed gate traces each to its SAP output, script commit, and source hash. Use when reporting or checking results."
argument-hint: "[check|render|trace|ids] [manuscript or table paths]"
---

# Numbers Locked to Raw Data

> **Run every command from the user's project root.** `$SKILL_DIR` anchors the script path; manuscript paths resolve against the current directory and the registry against the project root.

## Skill Value

- **Problem it solves:** Hand-typed results drift from the analysis: a rerun changes an estimate, a Table 1 cell is pasted from an old run, an abstract keeps a superseded P value, and nobody can say which script produced a sentence's number.
- **Use when:** The user reports results in a manuscript, abstract, Table 1, figure caption, or model card, or wants to know whether every number traces to the analysis before submission.
- **Output:** `analysis/numbers/registry.json` (aggregates only), manuscripts that cite numbers as `{{num:<id>}}`, rendered copies, and a gate report of `file:line`, reason, and token that exits non-zero on any untraced, stale, unknown, or small-cell number, or when it found nothing to check.
- **Ask only if:** The SAP output ID for a number is unknown, or a numeric token is a design constant (dose, unit, threshold) the study team has not declared.
- **Do not do:** Do not type a result number into prose, edit the registry by hand, or weaken the gate to make it pass.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

**Sensitive-data boundary.** Resolve `phi_environment.mode` in `.methodsmith/config.local.yaml` (worktree, then main checkout; legacy `compliant: true` = `approved`, `compliant: false` = `schema-only`, `sensitive_data: false` = `no-sensitive-data`; any schema-only signal wins; unreadable = `schema-only`). `approved` or `no-sensitive-data`: proceed silently and never mention the boundary again. `schema-only`: headings, types, counts, and aggregates only; never open, print, or paste data values; run data-reading scripts as `method-safe-run -- <command>` (path in the guard's deny message); save results as aggregate tables (counts under 11 suppressed) in `output/` or a `phi_environment.aggregate_dirs` entry. Unset, interactive: ask once with the blocking question tool (else a numbered list) offering `Approved endpoint: full access`, `Not approved or unsure: schema-only`, and `No sensitive data: public or synthetic`; save the answer as `phi_environment.mode` there once `git check-ignore -q .methodsmith/config.local.yaml` passes (else first add `.methodsmith/*.local.yaml` to `.gitignore`) so the guard hook sees it. Unset, headless: schema-only. In `schema-only`, the registry a method-safe-run run writes counts as data: read it only through `ids`, `trace`, and `check`, which print ids, kinds, SAP output IDs, hashes, and manuscript tokens, never registry values.

## The chain

Every reported number follows one chain, and `trace` prints it:

`sentence {{num:id}} <- registry entry <- script@commit <- source file#sha256 <- SAP output ID`

## Workflow

1. **Install the helpers in the project.** Check that `scripts/method_numbers.py` and `scripts/method_numbers.R` exist in this skill's directory, then copy them into `analysis/numbers/` so the analysis runs without the plugin. Python needs only the standard library; R needs `jsonlite` and either `tools::sha256sum` (R 4.5+) or the platform `sha256sum`/`shasum` utility.
2. **Register numbers where they are computed.** Maintain the SAP output ID catalog at `analysis/sap-tables/02-outputs.csv` (the `Output File` column), and read the IDs from it and pass one per number. Register aggregates only; never register a row-level value.

```python
import sys; sys.path.insert(0, "analysis/numbers")
from method_numbers import register_number, register_table
register_number("primary.hr", hr, kind="estimate", ci=(lo, hi), digits=2,
                sources=["data/analytic.parquet"], sap_output="T2")
register_table("table1", {"female.overall": {"value": 212, "kind": "count", "denominator": 412}},
               sources=["data/analytic.parquet"], sap_output="T1")
```

```r
source("analysis/numbers/method_numbers.R")
register_number("primary.hr", hr, kind = "estimate", ci = c(lo, hi), digits = 2,
                sources = "data/analytic.parquet", sap_output = "T2")
```

   Kinds: `count`, `n`, `percent`, `estimate`, `ci`, `p`. Style profiles: `jama` (default; `P = .03`, `P < .001`, `0.78 (95% CI, 0.66-0.92)`, ` to ` when a bound is negative, thousands commas) and `generic-biomedical` (`p = 0.03`). Counts from 1 to 10 are stored with a `<11` marker and no value. Larger counts with small complements and related table/SAP counts that reveal small differences use the nonnumeric marker `Suppressed`; that marker never mislabels a large count as a small one. Related counts/rates are conservatively suppressed together. A `percent` requires its supporting `denominator`; small event counts or complements suppress the rate too. Pass `disclosure_floor=` for a stricter project floor; it cannot lower the minimum of 11. Relationships not declared by a shared table or SAP/source group still require study-specific disclosure review. The gate requires the SAP catalog (or an explicit `--sap-outputs` catalog) and rejects unmapped IDs. Each entry records the source files' SHA-256 and the calling script's path, SHA-256, and git commit, with typed formatting parameters validated by the gate. Conflicting re-registration fails unless an intentional rerun passes `update=True` (Python) or `update=TRUE` (R). Commit the script before the run that reports numbers; the gate fails entries whose script had uncommitted changes.
3. **Run the analysis.** In `schema-only`, run it as `method-safe-run -- python3 analysis/<script>.py` or `method-safe-run -- Rscript analysis/<script>.R`.
4. **Write with placeholders.** Cite every result as `{{num:<id>}}` in `.md`, `.qmd`, and `.Rmd` sources, and type the same placeholder text into a Word `.docx`. List available ids (kind and SAP output, no values):

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/method_numbers.py" ids
```

   Never type a result, and never compute one inline (`` `r ...` ``, `` `{python} ...` ``); the gate fails both.
5. **Render.** `python3 "$SKILL_DIR/scripts/method_numbers.py" render manuscript/results.qmd --out manuscript/_rendered/results.qmd` substitutes each entry's formatted text and writes an adjacent `.numbers.json` provenance map containing the source, registry and output digests and the occurrence IDs. CSV/TSV cells are parsed and quoted so formatted commas cannot change table columns. Keep that sidecar with rendered text copies; the gate validates them against the unchanged placeholder source. It rejects manually typed matching values and changed rendered copies. For a `.docx`, it writes a new file in which each placeholder (even one Word split across formatting runs) becomes a Word field `{ ADDIN CE_NUM <id> }` whose result is the entry's text, keeping the run's formatting, and it refreshes the results of existing `CE_NUM` fields, so re-render the Word master after every rerun. It never modifies the source, and it writes nothing when an id is unknown or its entry is stale.
6. **Gate.** Run `python3 "$SKILL_DIR/scripts/method_numbers.py" check <files or directories>` on the sources, the rendered copies, and the tables (`.md`, `.qmd`, `.Rmd`, `.csv`, `.tsv`, `.docx`). Word locations read `file.docx:p12` (paragraph 12 of the body, table cells included) or `file.docx:footnotes:p3`. Exit 0 prints `PASS`; exit 1 prints one line per problem and `FAIL`. Table cells are reported by column, and tokens from files a method-safe-run run wrote are hidden, so the report never carries data values. Report the result as the script's exit status and lines, not as a judgement. If `python3` is missing, try `python`, then `py`; if none runs, report the gate as not run, never as passed.
7. **Trace on request.** `python3 "$SKILL_DIR/scripts/method_numbers.py" trace <files>` prints the chain for each placeholder.

## What the gate fails

| Reason | Meaning | Fix |
|---|---|---|
| `untraced number` | A reportable numeric occurrence without a placeholder, valid render map, or matching Word field | Replace it with a placeholder, register it, or declare it if it is a design constant |
| `inline computed value` | Inline R/Python code prints a number outside the registry | Register the value; cite its placeholder |
| `field result differs from registry` | A Word `CE_NUM` field's shown text was hand-edited or predates a rerun | Re-render the Word master; never edit field text |
| `unknown registry id` | A placeholder or Word field names no entry | Fix the id (see `ids`) or register the number |
| `stale` | A source file or the producing script changed (or is gone) since registration | Rerun the producing script |
| `untraceable` | An entry has no source files, no SAP output, or a script that was uncommitted when it ran | Register with `sources` and `sap_output`; commit the script, then rerun it |
| `small cell` | A registered count from 1 to 10 is not suppressed | Rerun through the helper, which suppresses it |
| `refused: data path` | A path in a data directory (`data/`, `raw/`, `phi/`, ...) or the configured `data_root` | Point the gate at manuscripts and aggregate tables, never at data |
| `nothing to check` | No files, no registry entries, or no numbers found | Point the gate at the manuscript; a gate that checks nothing does not pass |
| `unsupported file type` | A file the gate cannot read for numbers | Check its Markdown or table source instead |

Quoted and block-quoted numeric results are checked. Declare any verified quoted methodological constant as an exact fixed phrase, with its justification in the study documentation. Not counted as results: YAML front matter, code blocks, HTML comments, link targets, citation keys/superscripts (`^7^`, `[@key]`); numeric bracket citations require exact `citation: [12]` declarations in the allowlist, heading and list numbers, figure/table/item/section/supplement numbers, dates; years require exact declared phrases such as `phrase: between 2015 and 2023`, `95% CI`, names with letter-prefixed digits (`CD4`, `COVID-19`). Numeric-prefix compounds, ordinals (`1st`, `2nd`) and labels such as `type 2A` are checked; declare exact verified non-result phrases when appropriate. Result-bearing compounds are checked: `7-patient`, `42-site`, `2.4-fold`, and `7patients` are not exemptions. Declare a fixed design compound such as `phrase: 28-day` only when it is a documented design constant; result counts and fold changes require registry placeholders. Declare doses, units, and fixed phrases in `analysis/numbers/allowlist.txt`, one per line: `unit: mg`, `unit: mg/kg`, `phrase: two-sided P < .05`, `citation: [12]`. Bare year-shaped counts and undeclared bracketed results fail. Never add a result to the allowlist. In Word files, the results of recognized Zotero citation/bibliography, cross-reference, `SEQ` and page fields and tracked deletions are not counted.

## Limits

- Typed matching numbers fail. Text render maps bind each output to the placeholder source; Word uses `CE_NUM` fields. Provenance does not establish the scientific validity of an aggregate.
- Images, embedded charts and PDFs require checking their source tables and captions. Word body, tables, headers, footers, comments and notes are checked; unsupported text-bearing XML structures and unclosed fields fail closed. Tracked deletions are excluded from the final-text policy. Numeric results of arbitrary computed or merge fields are checked as typed text.
- Staleness compares file hashes, not semantics: a rerun on unchanged inputs keeps entries fresh.
