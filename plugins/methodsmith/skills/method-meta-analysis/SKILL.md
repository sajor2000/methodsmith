---
name: method-meta-analysis
description: "Pools literature effects with REML/Hartung-Knapp. Use when power or a SAP needs a cited effect-size assumption and sensitivity range."
argument-hint: "<path/to/methods.csv>, optional: --metric OR|HR|RR|MD|SMD"
---

# Effect-Size Anchor for Power Calculations


## Skill Value

- **Problem it solves:** SAPs often choose effect assumptions without traceable prior evidence.
- **Use when:** The user needs effect-size assumptions, pilot estimates, pooled estimates, or literature-derived values.
- **Output:** Effect-size summary with sources, assumptions, uncertainty, and downstream SAP/power handoff.
- **Ask only if:** Only when outcome scale, comparison, estimand, or source set is ambiguous.
- **Do not do:** Do not overstate causal interpretation or replace formal meta-analysis when one is required.
- **Formal synthesis:** Use `method-clif-meta-analysis` for a complete systematic review or CLIF site-to-lead analysis. The sample-size filter and power-anchor workflow here are not review eligibility rules.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Bridges `method-extract` (which collects what prior studies REPORTED) and `method-power` (which needs a single number to plug in).

## When this skill activates

- After `method-extract` has produced `analysis/pubmed/<query>-methods.csv`
- Before `method-power` so the effect-size assumption is anchored
- Manual: `method-meta-analysis analysis/pubmed/sepsis-bundle-methods.csv --metric HR`

## Prerequisites

- A methods CSV with pmid, year, sample_size and effect_size_reported; pooling additionally needs source-reported uncertainty or a reconstructible declared Wald interval per `references/effect-parser.md`.
- Select a protocol-compatible target: population/comparison, outcome/horizon, effect scale/unit, adjustment specification, study design and independent contribution. A modal metric is not evidence of compatibility; resolve unknowns before fitting.

## Evidence access

Read `references/evidence-access.md` before the first literature lookup (PubMed and Paperclip MCP tool names, fallbacks, and evidence rules); never invent a citation, effect size, or guideline item.

- **Look up here:** prior pooled estimates and their heterogeneity (published meta-analyses on the same question, found with `mcp__pubmed-mcp-server__pubmed_search_articles` (or the connector's `search_articles`) and a `Meta-Analysis[Publication Type]` filter) to compare against the result here, and the paper behind any row whose effect or CI is ambiguous in the methods CSV (PMC full text via `mcp__pubmed-mcp-server__pubmed_fetch_fulltext` or the connector's `get_full_text_article`, or `mcp__paperclip__cat`/`mcp__paperclip__grep`).

## Core workflow

### Step 0: Context inputs (scan chat first)

If no `<path/to/methods.csv>` was passed, scan the most recent ~50 chat turns for `__CE_METHOD_EXTRACT__ csv=<path> n=<int> modal_method=<...>`. If found, use that CSV as the input. Print `[method-extract] using methods table from <path> (n=<N>, modal=<modal_method>)`.

If neither an explicit path nor the signal is present, ask the user to load the `method-extract` skill first or pass a CSV path explicitly. Never substitute an effect size from memory for a missing table.

### Step 1: Load and parse

Read the methods CSV. Parse the `effect_size_reported` field: extract metric type (OR/HR/RR/MD/SMD), point, lo, hi. Use `references/effect-parser.md` patterns, normalise adjusted labels (`aHR` -> `HR`) while keeping the `adjusted` flag (adjusted and unadjusted OR/HR are not interchangeable; see that reference), and write `analysis/effect-size/<query>-parsed.csv` plus the parsing script next to it (the parsed-CSV contract is in that reference; `scripts/pool_effects.R` reads the parsed CSV, not the raw methods table). Drop rows where parsing fails; report count of dropped rows. Where a row's effect, CI, or metric is ambiguous and the paper is lawfully available, read the results section (see Evidence access) rather than guess, and note the row's `evidence_level` (`full_text` or `abstract`) in the included-studies CSV.

Validate each row's uncertainty before selection: use a source-reported SE on the correct analysis scale, or the declared Wald confidence level/method/df and source-rounding tolerance in `references/effect-parser.md`. Do not reconstruct unknown or asymmetric non-Wald intervals as normal 95% intervals. Resolve or explicitly exclude an unsupported row under the protocol, retaining its reason; never silently create its variance or hand off its numeric anchor.

### Step 2: Filter to comparable studies

Filter to the selected scientific target first; read the complete parsed contract in `references/effect-parser.md`. Resolve adjusted/marginal differences, units and overlapping cohorts before any fit. Save the selection code and excluded-study reasons. Write only the selected compatible rows to `analysis/effect-size/<query>-selected.csv`; retain the full parsed CSV and exclusions for audit. Then filter:
- `metric` matches `--metric` (or modal-metric if not specified); `scripts/pool_effects.R` matches the uppercase label exactly, so pass `HR`, not `hr`
- No sample-size cutoff by default: inverse-variance weights already down-weight small studies. Pass `--min-n <n>` to `scripts/pool_effects.R` only as a sensitivity analysis, and then report the unfiltered estimate alongside it
- Year within last `--years` window if passed
- Optional: study type filter (e.g., RCTs only)

Report N studies in the meta-analysis vs N in the input.

### Step 3: Pool

Run the bundled script on the selected CSV from Step 2 (the numerical columns plus the reviewed compatibility declarations in `references/effect-parser.md`; it fails on missing or incompatible declarations, so the raw methods table will not work). It applies the metric and CI filters (plus `--min-n` when passed), prints each dropped count, and writes the Markdown summary, a sibling `-forest.png`, the selected `-contract.csv`, and the Step 6 signal:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
Rscript "$SKILL_DIR/scripts/pool_effects.R" --in analysis/effect-size/<query>-selected.csv --metric HR --out analysis/effect-size/<query>-pooled.md
```

Requires the project's R environment with `meta` and `ggplot2`; report missing packages rather than installing them from this skill.

If N ≥ 3:
- For OR / HR / RR: log-transform → random-effects REML (use an explicitly configured R `meta::metagen` or `metafor::rma`; Python statsmodels Paule-Mandel is a different method)
- For MD: random-effects REML on the raw scale
- For SMD: Hedges g + REML
- The script pins the CI method (Hartung-Knapp-Sidik-Jonkman when tau^2 > 0, Wald when tau^2 = 0) and the prediction interval (t, k-1 df) rather than trusting `meta` defaults; `references/pooling-formulas.md` explains each choice
- Report: pooled estimate, 95% CI (with its method), 95% prediction interval (PI), I^2 heterogeneity, tau^2, and the `meta` version
- If `meta` returns no finite PI bounds, say so and report the CI as the fallback sweep range
- Do not fit a mixed adjusted/unadjusted primary pool. Select the compatible estimand/adjustment set first; separate sensitivity pools get separate files and cannot overwrite the primary contract or handoff.
- If R is unavailable, stop and report it rather than hand-coding REML; `statsmodels.stats.meta_analysis.combine_effects(..., method_re="iterated", use_t=True)` is acceptable only when labelled as Paule-Mandel

If N < 3:
- Report narrative range (min, median, max) -- DO NOT pool
- Highlight the anchor study the script picks: an RCT first when `study_type` is present, then the largest N, then the most recent
- Caveat the user: "single-study or two-study power calc is fragile; consider running with sensitivity sweep"

After pooling, compare the result with any published meta-analysis found under Evidence access (cite its PMID/DOI and the level read). State agreement or disagreement with its pooled estimate and I^2; a large divergence is a flag for the SAP, not a reason to replace the computed value.

### Step 4: Write the output

`analysis/effect-size/<query>-pooled.md`. `scripts/pool_effects.R` writes the pooled-estimate block and the forest-plot line; append the filtering counts, the "Prior pooled estimates" section, and the `method-power` handoff to that same file rather than writing a second one (the numbers below are template placeholders; every value comes from the computation, and the "Prior pooled estimates" line names the PMID/DOI of each comparison or says none was found):

```
# Pooled effect-size: <metric> for <outcome> in <population>

Source: 14 studies extracted via `method-pubmed` and `method-extract` on <date>
Filtered to: <metric>, complete CI, last 10 years -> 9 studies pooled

## Pooled estimate

<metric> = 0.78 (95% CI 0.65-0.93, Hartung-Knapp; 95% PI 0.52-1.17)
I^2 = 42% (may represent moderate heterogeneity; read with tau and the PI)
tau^2 = 0.04

## Prior pooled estimates

<PMID/DOI of each published meta-analysis compared, its pooled estimate and I^2, and the level read; or "none found for <query> on <date>">

## Forest plot

See `analysis/effect-size/<query>-pooled-forest.png`

## For `method-power`

Use point estimate 0.78 with sensitivity sweep across PI bounds (0.52 to 1.17).
Published effects are selected, so the pooled estimate may overstate the benefit
(for a protective HR, the true HR is likely closer to 1). Choose a target HR that
reflects a clinically important and realistic benefit
(DELTA2, Cook et al. BMJ 2018;363:k3750, PMID 30560792). For a two-proportion
calculation, convert with a cited control risk (references/effect-parser.md).
```

Also save a CSV: `analysis/effect-size/<query>-included.csv` (which studies, why included, their PMID/DOI, and `evidence_level`). `method-power` reads this file for the PMIDs it cites in SAP-6, since the signal line carries numbers only.

### Step 5: Generate forest plot

Use R `meta::forest()` or Python `matplotlib`. Each study's point and CI; pooled point and CI at the bottom.

### Step 6: Emit signal

The bundled `scripts/pool_effects.R` prints the canonical envelope. REML (k>=3) form:

```
__CE_EFFECT_SIZE__ metric=<m> n_studies=<n> point=<v> ci=<lo,hi> pi=<lo,hi|NA> i2=<pct> mode=reml contract=<path>
```

`pi=` carries the 95% prediction interval on the reported scale (exponentiated for ratio metrics). It is `pi=NA` when `meta` returns no finite PI bounds for this k and tau^2.

Narrative form (k<3, no pooling):

```
__CE_EFFECT_SIZE__ metric=<m> n_studies=<n> point=null ci=null pi=NA i2=null mode=narrative contract=<path>
```

Both forms carry the selected compatibility artifact in `contract=`. `method-power` must read it and match the planned estimand, outcome/horizon, unit and adjustment set before using the point. Legacy signals without that evidence require reconciliation, not an assumed compatible anchor. `method-power` sweeps over `pi=` when both bounds are finite and falls back to `ci=` otherwise. When `mode=narrative`, `method-power` should fall back to the user-supplied effect size or stop and ask, rather than try to read `point=null` as a number.

## What this skill does NOT do

- Does not do a full systematic-review meta-analysis (no risk-of-bias scoring, no PRISMA flow); that's a separate study type, use the `method-checklist` skill to register it as PRISMA
- Does not invent missing uncertainty; source-reported SEs are usable without a CI, while unresolved SE/CI construction blocks that row's numeric use.
- Does not handle network meta-analysis (use `netmeta` package directly)
- Does not compute power (that's `method-power`)

## References

@./references/effect-parser.md

@./references/pooling-formulas.md
