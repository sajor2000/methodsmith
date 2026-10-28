---
name: method-figure
description: "Creates and validates publication figures (ggplot2, matplotlib) with a journal-neutral clinical style and manifest. Use when the user wants a Kaplan-Meier, forest, calibration, ROC, or multi-panel figure."
argument-hint: "[optional: --manifest analysis/publication/figures/figure-manifest.json --project-root .]"
---

# Publication Figure Workflow

> **Run the commands below from the user's project root.** The `SKILL_DIR` anchor locates the bundled script and assets; `--manifest` and `--project-root` stay project-relative.

## Skill Value

- **Problem it solves:** Figures can look polished in a notebook and still fail journal typography, sizing, axis, legend, caption, or data-traceability standards, and R and Python figures in one manuscript drift apart in style.
- **Use when:** The user asks for a manuscript figure or plot (Kaplan-Meier, forest, dot and CI, box, scatter, line, heat map, ROC, calibration, flow diagram, multi-panel), figure styling in ggplot2 or matplotlib/seaborn, a figure manifest, or figure QA.
- **Output:** Figure exported at final column width from a saved script or notebook, in the `clinical-standard` style (or a journal override), with a manifest entry, validator report, and visual inspection notes.
- **Ask only if:** Figure purpose, source data, figure type, panel structure, target journal, or language (R vs Python) is unclear.
- **Do not do:** Do not invent data, type counts by hand, scale a large figure down to fit, or skip visual inspection when the harness can view images; otherwise report visual inspection as not performed.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

A figure is ready only when its source data, source code, output file, caption, alt text, SAP link, and style profile are visible in the manifest and the validator reports no blockers.

When the requested figure workflow creates or materially extends a Marimo, Jupyter, R Markdown, or Quarto notebook, load the `method-notebook-standards` skill before creating cells or chunks.

## Style System

- `clinical-standard` is the default `style_profile`: a journal-neutral clinical publication style (Arial/Helvetica, 12 pt bold caption title, 10 pt axis titles, 8-9 pt ticks and legends, nothing under 8 pt, open left/bottom axes, no gridlines, Okabe-Ito palette, legend outside the data, 3.5/5/7 in widths, vector PDF with embedded fonts). Rules by topic and figure type: `references/figure-style-guide.md`.
- Journal overrides (`jama`, `generic-biomedical`) change only what that journal specifies (formats, sizes); everything else inherits `clinical-standard`. Settings: `references/figure-style-profiles.yaml`. When the user names a journal, read its live instructions and set `style_profile` to its override name (or to `clinical-standard` with a note when no override exists).
- Language assets: `assets/theme_clinical.R` (`theme_clinical()`, `scale_color_clinical()`, `scale_fill_clinical()`, `save_figure()`) and `assets/clinical_style.py` with `assets/clinical.mplstyle` (`apply_clinical_style()`, `save_figure()`, `add_panel_labels()`, `km_with_risk_table()`, `forest_plot()`, `dot_ci_plot()`, `roc_plot()`, `calibration_plot()`). Call recipes per figure type and per environment (RStudio, Jupyter, Marimo): `references/r-and-python-recipes.md`.

## Workflow

1. Identify the figure type, the source data file, the SAP section, the target journal, and the language. Match the user's existing stack (ggplot2 in R scripts or Quarto; matplotlib/seaborn/lifelines in Jupyter or Marimo).
2. Read the matching figure-type checklist in `references/figure-style-guide.md` and the recipe in `references/r-and-python-recipes.md`. Copy the language asset into the project (recommended, keeps the figure reproducible without the plugin):

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
cp "$SKILL_DIR/assets/theme_clinical.R" analysis/scripts/theme_clinical.R
```

   or `cp "$SKILL_DIR/assets/clinical_style.py" analysis/scripts/clinical_style.py` for Python. Loading in place (`source()` / `sys.path.insert()` with the absolute path) is acceptable when the user prefers it; record the path in the script header.

3. Render from the source data with a saved script or notebook cell group (`analysis/scripts/figN.R`, `figN.py`, or a notebook), applying `theme_clinical()` or `apply_clinical_style()`, the palette scale, axis titles in "Quantity, unit" form, and the figure-type rules (risk table under KM curves, log axis and reference line for ratios, diagonal for ROC/calibration, panel labels A, B, C).
4. Export at final size with `save_figure()`: width 3.5, 5, or 7 in, height <= 9 in, vector PDF (plus a PNG review copy); never render large and shrink. Marimo: return `fig` from the cell or use `mo.mpl.interactive(fig)`; Jupyter: set `%config InlineBackend.figure_format = 'retina'`; neither preview is the export.
5. Write the caption ("Figure n. Title Case Title." then abbreviations, error bar or shading definition, n per group, method, axis notes) and alt text (chart type, variables, main pattern, one key number), citing every reported number in captions and alt text as `{{num:<id>}}` from the number registry (load the `method-numbers` skill; register figure-level numbers such as n per group in the figure script with `register_number`), keeping the caption sources in `analysis/publication/figures/captions.md`, rendering them with its `render`, and running its `check` on both; then add or update the manifest entry in `analysis/publication/figures/figure-manifest.json` with `style_profile: clinical-standard` (or the journal override).
6. Run the validator:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/validate_figure_manifest.py" --manifest analysis/publication/figures/figure-manifest.json --project-root .
```

   If `python3` is missing, try `python`, then `py`; with none available, check the readiness rules below by hand and say so.

7. Resolve blockers before marking any figure manuscript-ready; address warnings or state why they stand.
8. If the harness can view images, open the exported PDF/PNG and inspect for text overlap, clipped labels, legend over data, text under 8 pt, missing units, missing risk table, and panel-label order; run the "Before-export checklist" from the style guide. Otherwise report visual inspection as not performed.

For QA-only requests (existing figures or manifest), start at step 6 and apply steps 7-8 to the existing exports, reporting style deviations against the checklist without re-rendering unless asked.

## Manifest Shape

```json
{
  "figures": [
    {
      "figure_id": "fig1",
      "sap_section": "SAP-5.1",
      "source_data": "analysis/publication/figures/fig1-source.csv",
      "source_code": "analysis/scripts/fig1.R",
      "output_path": "analysis/publication/figures/fig1.pdf",
      "caption": "Figure 1. Kaplan-Meier Estimates of 90-Day Mortality by Treatment Group. Shaded areas indicate 95% CIs. HR indicates hazard ratio.",
      "alt_text": "Two Kaplan-Meier curves of survival probability over 90 days by treatment group; the intervention curve stays above control, 90-day survival 78% vs 71%.",
      "style_profile": "clinical-standard",
      "checklist_items": ["CONSORT-26"]
    }
  ]
}
```

## Readiness Rules

- Block duplicate figure IDs.
- Block absolute or parent-traversal paths.
- Block missing required fields (`figure_id`, `sap_section`, `source_data`, `source_code`, `output_path`, `caption`, `alt_text`, `style_profile`) and source data, source code, or output files that do not exist.
- Warn when no checklist item is linked.
- Warn when the output format is not a common publication format (PDF, EPS, SVG, TIFF, PNG, or JPEG).
- Warn when `style_profile` is not `clinical-standard`, `jama`, or `generic-biomedical`.
- Warn when `caption` does not start with `Figure <n>.` or `alt_text` is shorter than 20 characters.

## References

@./references/figure-spec.md

Loaded on demand: `references/figure-style-guide.md` (style rules and figure-type checklists), `references/r-and-python-recipes.md` (calls per figure type and environment), `references/figure-style-profiles.yaml` (profile settings), `assets/theme_clinical.R`, `assets/clinical_style.py`, `assets/clinical.mplstyle`.

## Study freshness integration

When a study record exists, use `method-study` to register the figure manifest, output and producing code/run dependencies. File existence is not content identity or fresh execution. Keep source locators protected and shared references opaque. A source change marks affected figures and manuscript uses for revalidation; never make a visual preview from sensitive output without disclosure review.
