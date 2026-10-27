# Compliance Report Format

## Contents

- Report Structure
- Header Format
- Checklist Status Format
- Waiver Format
- Changelog Format
- Agent Instructions for Updating the Report
- SAP Tracking Integration

Defines the format for `.methodsmith/compliance-report.md` — the Git-native compliance tracking file maintained by `method-reporting-checklist-reviewer`. This file lives in the user's project and is append-only: existing entries are never deleted or overwritten, only updated and extended.

---

## Report Structure

The compliance report has three sections:

1. **Header** — Study classification snapshot, guidelines applied, and last-updated timestamp
2. **Checklist Status** — Per-guideline, per-item status tracking
3. **Changelog** — Append-only log of all review runs and status changes

---

## Header Format

```markdown
# Compliance Report

**Study type:** {study_type}
**AI involvement:** {ai_involvement}
**Guidelines applied:** {comma-separated list}
**SAP version:** {sap_version}
**Last updated:** {YYYY-MM-DD HH:MM UTC}
**Status:** {IN_PROGRESS | COMPLETE | INCOMPLETE}

## Summary

| Guideline | Total items | Complete | Incomplete | Waived | N/A |
|-----------|-------------|----------|------------|--------|-----|
| STROBE    | 22          | 18       | 3          | 1      | 0   |
```

---

## Checklist Status Format

One section per guideline applied. Each item carries one of four statuses:

| Status | Meaning |
|--------|---------|
| `COMPLETE` | Evidence of this item found in analysis code or outputs |
| `INCOMPLETE` | Item is required but not yet addressed in the codebase |
| `WAIVED(reason)` | Item is not applicable or explicitly waived with justification |
| `NOT_APPLICABLE` | Item does not apply to this study design |

```markdown
## STROBE Compliance

| Item | Title | Status | Evidence/Notes |
|------|-------|--------|----------------|
| STROBE-1a | Title (observational design) | COMPLETE | sap.md line 12: study type declared |
| STROBE-4 | Setting | INCOMPLETE | No data source or setting described in analysis files |
| STROBE-7 | Variables | COMPLETE | analysis/primary.R: all variables defined |
| STROBE-9 | Bias | WAIVED(ecological study; individual-level bias not applicable) | — |
| STROBE-22 | Funding | NOT_APPLICABLE | Outside analysis pipeline scope |
```

---

## Waiver Format

Waivers require an explicit reason and timestamp. The `WAIVED` tag embeds the reason inline:

```
WAIVED(reason — reviewer — YYYY-MM-DD)
```

Example:
```
| STROBE-9 | Bias | WAIVED(ecological study; individual-level bias not applicable — analyst — 2026-04-28) | — |
```

---

## Changelog Format

The changelog is strictly append-only. Each review run appends a new entry at the bottom. Never modify or remove existing changelog entries.

```markdown
## Changelog

### 2026-04-28 14:30 UTC — Initial review

- Guideline: STROBE
- Review run by: method-reporting-checklist-reviewer
- Items assessed: 22
- Status changes: 0 → COMPLETE (18), 0 → INCOMPLETE (4)
- Notes: First review run. Items STROBE-22 (Funding) marked NOT_APPLICABLE.

### 2026-04-30 09:15 UTC — Follow-up review

- Guideline: STROBE
- Review run by: method-reporting-checklist-reviewer
- Status changes: STROBE-4 INCOMPLETE → COMPLETE (data source documented in analysis/setup.R)
- Notes: SAP version unchanged at 1.
```

---

## Agent Instructions for Updating the Report

When `method-reporting-checklist-reviewer` runs:

1. **Check for existing report.** Look for `.methodsmith/compliance-report.md` in the project root.

2. **If no report exists:** Create it with the Header and Checklist Status sections. All items start as `INCOMPLETE`. Append the first changelog entry.

3. **If the report exists:** Read it. For each item in the current review:
   - Update the item's status if it changed (e.g., INCOMPLETE → COMPLETE)
   - Preserve any existing `WAIVED` entries unchanged — do not downgrade a waiver to INCOMPLETE
   - Never remove rows or delete existing status entries
   - Update the Header summary counts and `Last updated` timestamp
   - Append a new changelog entry recording all status changes in this run

4. **Append-only enforcement:** The changelog section grows with each review run. Never overwrite the changelog. Never reorder changelog entries. If the report was manually edited in a way that would require removing entries, add a note in the new changelog entry rather than modifying prior entries.

5. **Waiver handling:** Accept explicit waivers from the user during review. Record them with the format `WAIVED(reason — reviewer — YYYY-MM-DD)`. Do not auto-waive items without user confirmation.

---

## SAP Tracking Integration

When `method-work` runs and a compliance report exists, display its overall status in the coverage summary:

```
Reporting Compliance (from: .methodsmith/compliance-report.md)

| Guideline | Complete | Incomplete | Waived | Last updated |
|-----------|----------|------------|--------|--------------|
| STROBE    | 18/22    | 3          | 1      | 2026-04-28   |
```

If no compliance report exists and `stack_profile.reporting_checklist` is set to a non-null guideline string in config, add a note: "No compliance report found. Run method-review to generate the initial report."
