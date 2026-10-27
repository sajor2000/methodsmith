# SAP Tracking Overlay

## Contents

- SAP Discovery
- Coverage Assessment
- Coverage Summary Table
- Exploratory Analysis Labeling
- Per-Invocation Refresh
- Integration with Task Execution
- Guidelines Classification Check
- Metadata Completeness Check
- Compliance Report Integration
- Publication Readiness Integration

This reference defines how `method-work` discovers and tracks SAP (Statistical Analysis Plan) implementation coverage per invocation. Load it during Phase 1 when a SAP file is detected in the project.

---

## SAP Discovery

At the start of Phase 1 (after reading the plan/prompt but before creating the task list), search for a SAP file in the project:

1. Use the native file-search/glob tool (e.g., Glob in Claude Code) to find files matching `**/sap.md`
2. If no `sap.md` found, search for markdown files and check YAML frontmatter for `sap_version` field
3. If no SAP file is found by either method, skip SAP tracking entirely -- proceed with normal execution

When a SAP file is found, read it and extract all `SAP-N.M` section identifiers (e.g., SAP-1, SAP-1.1, SAP-2.3, SAP-5.1).

---

## Coverage Assessment

For each `SAP-N.M` section in the SAP, determine implementation status by checking the current codebase:

### Detection Signals

Use three complementary signals to match SAP sections to analysis code. Any one signal is sufficient for a match:

1. **File naming** -- analysis files named with SAP identifiers (e.g., `sap-5-1-primary-analysis.qmd`, `sap_3_1_primary_endpoint.R`)
2. **SAP ID references in comments** -- code files containing comments like `# SAP-5.1`, `<!-- SAP-3.1 -->`, or `## SAP-5.1: Primary Analysis`
3. **Content matching** -- analysis code whose content corresponds to a SAP section's description (e.g., a logistic regression model matching SAP-5.1's specified primary analysis method)

### Status Categories

| Status | Meaning |
|--------|---------|
| **Implemented** | At least one code file maps to this SAP section via any of the three detection signals |
| **Not implemented** | No code file maps to this SAP section |
| **Partial** | A code file references the SAP section but the analysis is visibly incomplete (stub, TODO, or placeholder) |

---

## Coverage Summary Table

After assessment, display a coverage summary table in this format:

```
SAP Coverage Summary (from: path/to/sap.md)

| SAP Section | Description | Status | File(s) |
|-------------|-------------|--------|---------|
| SAP-1 | Study Objectives | N/A | -- |
| SAP-3.1 | Primary Endpoint | Implemented | analysis/primary-endpoint.qmd |
| SAP-5.1 | Primary Analysis | Not implemented | -- |
| SAP-5.2 | Secondary Analyses | Partial | analysis/secondary.R (stub) |
| SAP-8 | Missing Data | Not implemented | -- |
```

Sections that are purely descriptive (SAP-1: Study Objectives, SAP-2: Study Design) are marked `N/A` -- they define the study, not an analysis to implement. The actionable sections are typically SAP-3 through SAP-10.

---

## Exploratory Analysis Labeling

Code files that contain statistical analysis but do not map to any SAP section are labeled as exploratory. When implementing or encountering such files during execution:

1. Add a comment header to the file identifying it as non-SAP work:

   **R/Quarto:**
   ```r
   # Exploratory -- not in SAP
   # Description: [brief description of what this analysis does]
   ```

   **Python:**
   ```python
   # Exploratory -- not in SAP
   # Description: [brief description of what this analysis does]
   ```

2. These analyses are **not blocked** -- exploratory work is a normal part of research. The label exists for transparency and audit trail, not gatekeeping.

3. In the coverage summary, exploratory analyses appear in a separate section below the SAP table:

   ```
   Exploratory Analyses (not in SAP):
   - analysis/ad-hoc-subgroup.qmd -- Subgroup analysis by insurance type
   - analysis/sensitivity-alt-model.R -- Alternative model specification
   ```

---

## Per-Invocation Refresh

SAP tracking is a snapshot assessment -- it runs once at the start of each `method-work` invocation, not continuously. The coverage summary reflects the state of the codebase at the moment the skill reads it. If tasks during execution implement SAP sections, the summary is not automatically updated mid-run.

At the end of execution (before Phase 3), re-scan and display an updated coverage summary showing what changed during this invocation.

---

## Integration with Task Execution

During Phase 2 task execution, before implementing each task:

1. Check if the task maps to a SAP section (by matching the task description or target file against SAP-N.M identifiers)
2. If it does: note the SAP section in the task status (e.g., "Implementing SAP-5.1: Primary Analysis")
3. If the task produces analysis code that does not map to any SAP section: add the "Exploratory -- not in SAP" comment header to the output file
4. Never block or reject work because it is not in the SAP -- flag and proceed

---

## Guidelines Classification Check

After reading the SAP, check the frontmatter for classification completeness:

- If `study_type` is set and canonical reporting checklist fields are empty or absent: add a note in the coverage summary: "Note: reporting checklist is empty — reporting guideline will be auto-routed from `study_type` by `method-reporting-checklist-reviewer`."
- If `study_type` is absent or `other`: add a warning: "WARN: `study_type` not set — reporting guideline cannot be auto-routed. Set `study_type` in SAP frontmatter or specify `stack_profile.reporting_checklist` explicitly."
- If `ai_involvement` is not `none` but `study_type` is absent: add a warning: "WARN: `ai_involvement` is set but `study_type` is absent — AI extension routing requires a `study_type`."

These are informational, not blockers. Never stop task execution based on missing guideline metadata.

---

## Metadata Completeness Check

After computing the SAP coverage summary, check for `.methodsmith/study-metadata.yaml` in the project root. If the file exists, read it. If the SAP frontmatter has `ai_involvement` set to any value other than `none`, check for the following and emit warnings as additional rows in the coverage summary table:

| Condition | Warning |
|-----------|---------|
| `ai_involvement` is `ai-primary` or `ai-assisted` and `dataset_split` is empty or missing | WARN: dataset_split not documented (recommended for ML studies) |
| `ai_involvement` is `llm-based` and `llm_provenance` is empty or missing | WARN: llm_provenance not documented (required for LLM studies) |
| `ai_involvement` is not `none` and `software_provenance.random_seeds` is empty or missing | WARN: random_seeds not documented (recommended for reproducibility) |
| `ai_involvement` is not `none` and `.methodsmith/study-metadata.yaml` does not exist | WARN: study-metadata.yaml not found (recommended when ai_involvement is not none) |

Display these warnings below the SAP coverage table under a `Metadata Completeness` heading. Example:

```
Metadata Completeness (from: .methodsmith/study-metadata.yaml)

| Check | Status |
|-------|--------|
| dataset_split documented | OK |
| llm_provenance documented | WARN: empty |
| random_seeds documented | OK |
```

If the SAP has `ai_involvement: none` or the field is omitted, skip the metadata completeness check entirely.

---

## Compliance Report Integration

After the Metadata Completeness check, check for `.methodsmith/compliance-report.md`. If it exists, read the header summary and display it alongside the SAP coverage table:

```
Reporting Compliance (from: .methodsmith/compliance-report.md)

| Guideline | Complete | Incomplete | Waived | Last updated |
|-----------|----------|------------|--------|--------------|
| STROBE    | 18/22    | 3          | 1      | 2026-04-28   |
```

If no compliance report exists and `stack_profile.reporting_checklist` is set to a non-null guideline string in `.methodsmith/config.local.yaml`, add this note below the coverage summary: "No compliance report found. Load the `method-review` skill with reporting checklist enabled to generate the initial report."

See `references/compliance-report.md` for the full report format and update instructions.

---

## Publication Readiness Integration

After the Compliance Report Integration check, look for publication workflow artifacts:

- `analysis/publication/package/package-manifest.json`
- `analysis/publication/package/package-readiness-report.md`
- `analysis/signoff/signoff-ledger.json`
- `analysis/signoff/signoff-validation-report.md`

If any exist, show a compact `Publication Readiness` block next to SAP coverage. Flag unresolved reviewer decisions as `WARN` and missing package readiness reports as `INFO`. Do not block `method-work` solely because a manuscript package has not been created; the publication block is a handoff summary for `method-submission-package` and `method-signoff`.
