---
name: method-sprint
description: "Opens, closes, and reports scoped analysis sprints with a named reviewer, planned SAP outputs, and data-lock checks. Use when the user opens, closes, or checks a sprint."
argument-hint: "<start|close|status>, optional name and reviewer, e.g. start sprint-01 reviewer=jcr scope=SAP-5.1,SAP-5.2"
---

# Sprint Cadence with Human Audit Gates


## Skill Value

- **Problem it solves:** Analysis work becomes unbounded without explicit scope, reviewer, planned outputs, and closure checks.
- **Use when:** The user wants an auditable analysis sprint, human signoff, scoped SAP execution, or sprint closeout.
- **Output:** Sprint log/status with scope, reviewer, planned-vs-actual outputs, and closeout findings.
- **Ask only if:** Only when sprint name, reviewer, scope, or planned output rows are missing.
- **Do not do:** Do not open a sprint without entry criteria or close one without checking planned outputs.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Wraps `method-work` in bounded sprints with explicit entry/exit criteria and human reviewer sign-off. The frictionless feel of `method-work` is preserved; the sprint adds structure around it so analyses can be audited unit-by-unit.

## When this skill activates

- Before starting analysis work that needs human sign-off (most academic / regulated work)
- After `method-plan` SAP and `method-sap-workbook` are done and the SAP is locked
- Manual: `method-sprint start sprint-02 reviewer=jcr scope=SAP-5.1,SAP-5.2`
- Closing a sprint: `method-sprint close`

## Prerequisites

- A locked SAP exists (`analysis/sap.md` with `sap_version` frontmatter)
- `analysis/sap-tables/02-outputs.csv` exists (from `method-sap-workbook`)
- A locked data wave exists in `analysis/data-waves.md` (and `.methodsmith/data-state.yaml` when that optional state file is used)

## Core workflow

### `method-sprint start <name>`

1. Check that no other sprint is currently `open` in `analysis/sprint-log.yaml` (the canonical top-level audit-trail file written by `scripts/sprint.py`). Refuse to open a second concurrent sprint -- one in flight at a time. Use `method-sprint close` first.

2. Resolve the scope. The user passes `scope=SAP-5.1,SAP-5.2` (SAP section ids) or `scope=table:T1,T2` (table ids from sap-tables). Resolve to a list of rows from `02-outputs.csv` whose `Script Section` or legacy `analysis_section` matches. Ignore section banner rows where only the first cell is populated.

3. Resolve the reviewer. The user passes `reviewer=<name>` or, if absent, prompt for one. The named human is the person who will sign the sprint summary. Their name lands in `sprint-log.yaml` -- this is the audit-trail anchor.

4. Check entry criteria:
   - Prior sprint (if any) has status `signed_off`
   - Data wave is `locked`
   - SAP `sap_version` is committed (no uncommitted SAP edits)
   - Stack profile is set

   If any fails, refuse to open the sprint and report what's blocking.

5. Append the new sprint entry to `analysis/sprint-log.yaml` (top-level, one file per project — every sprint becomes a list item under `sprints:`). Set `SKILL_DIR="<absolute path of the directory containing this SKILL.md>";`, then run `python3 "$SKILL_DIR/scripts/sprint.py" open <name> --scope <SAP-section-csv> --reviewer <reviewer>`; it refuses if a sprint is open or the name exists, writes `name`, `status: open`, `scope`, `reviewer`, `opened_at`, `commit_open`, and empty `outputs_planned`/`outputs_actual`, and prints `__CE_SPRINT__ action=open ...`. Then fill `outputs_planned` from step 2 and add `entry_criteria` to that entry:

```yaml
sprints:
  - name: sprint-02
    status: open
    scope: [SAP-5.1, SAP-5.2]
    reviewer: jcr
    opened_at: 2025-04-28T09:00:00Z
    commit_open: <sha>
    outputs_planned:
      - { id: T3, output_file: table-mortality-by-arm.csv, subfolder: tables/, sap_section: SAP-5.1 }
      - { id: F2, output_file: km-curve-overall.png, subfolder: figures/, sap_section: SAP-5.2 }
    outputs_actual: []
    entry_criteria:
      sap_version: 2
      data_wave_id: wave_2025_03_15
      prior_sprint: sprint-01 (signed off 2025-04-20)
```

6. Print a one-line summary and hand off to `method-work` with the planned-outputs list as the task seed. The user works inside the sprint as they would inside `method-work` normally; the sprint just bounds what's in scope.

### `method-sprint close`

Status flow in `analysis/sprint-log.yaml`: `open` -> `pending_review` (script, awaiting audit) -> `closed_pending_signoff` (audit passed) -> `signed_off` (human reviewer). A failing audit returns the sprint to `open`.

1. Set `SKILL_DIR="<absolute path of the directory containing this SKILL.md>";` (the shell starts in the project root, not the skill directory), then run `python3 "$SKILL_DIR/scripts/sprint.py" close <name>` (`<name>` defaults to the currently open sprint). The script flips status to `pending_review`, captures `closed_at` and `commit_close`, and prints a human-readable `__CE_SPRINT__ action=close ...` line, a machine-parseable dispatch hint, and a `next:` reminder:

   ```
   __CE_SPRINT_AUDIT_DISPATCH__ sprint=<name> reviewer=method-sprint-audit-reviewer human_reviewer=<name> scope=<csv> commit_open=<sha> commit_close=<sha>
   ```

2. Parse the `__CE_SPRINT_AUDIT_DISPATCH__` line into its key=value fields and dispatch `method-sprint-audit-reviewer` through the platform's subagent primitive (`Agent`/`Task` in Claude Code, `spawn_agent` in Codex, or `subagent` in Pi). Omit permission-mode overrides. If no subagent primitive exists, run the audit sequentially in the current agent. Use this prompt contract:

   ```
   Agent: method-sprint-audit-reviewer
   Description: Audit sprint <name>
   Prompt:
       Sprint name:   <name>
       Human reviewer: <human_reviewer>
       Scope (SAP sections in this sprint): <scope>
       Commit range: <commit_open>..<commit_close>

       Verify, in order:
       1. Every row in analysis/sap-tables/02-outputs.csv whose
          `Script Section` or legacy `analysis_section` is in <scope> has a
          corresponding artifact at the expected `Output File (SITE_ID_ prefix
          added automatically)` or legacy `output_file` under the expected
          `Subfolder` or legacy `subfolder`.
       2. No files outside <scope>'s SAP-section ownership were edited
          between <commit_open> and <commit_close>
          (use `git diff --name-only <commit_open> <commit_close>`).
       3. Outputs produced that are NOT in 02-outputs.csv: list them
          (warn-level, not blocking).
       4. All planned Quarto/notebook chunks in scope ran without errors
          (look for `Error in ...` in any *.log captured during the sprint).
       5. Reproducibility re-check: hash each declared output and compare to
          the hash captured at last execution if available.

       Return JSON:
         {
           "verdict": "pass" | "fail",
           "p0_count": <int>,
           "p1_count": <int>,
           "p2_count": <int>,
           "blocking_findings": [ {file, line, severity, title}, ... ],
           "advisory_findings": [ ... ]
         }
   ```

3. On a passing audit verdict, write the sprint summary to `analysis/sprints/<name>/summary.md`. On a failing verdict, flip the sprint back to `status: open` so the user can address findings; do not write a summary.

```
# Sprint <name> Summary

Reviewer: <name>
Opened: ... Closed: ...
Scope: SAP-5.1, SAP-5.2

## Outputs produced
| ID | File | Hash | Status |
| T3 | tables/table-mortality-by-arm.csv | abc123 | ok |
| F2 | figures/km-curve-overall.png      | def456 | ok |

## Out-of-scope edits detected
None

## Audit reviewer findings
- 0 P0, 1 P1 (minor table-1 column-order drift), 0 P2

## Sign-off
Reviewer (<name>): ☐
Date: ____________
```

4. Update `sprint-log.yaml`:

```yaml
status: closed_pending_signoff
audit_reviewer_findings: { P0: 0, P1: 1, P2: 0 }
```

5. If the project uses publication review packs, append or update an entry in the `method-signoff` signoff ledger that points to `analysis/sprints/<name>/summary.md`, the audit verdict, and the named reviewer. Do not mark it approved until the human reviewer has signed.

6. Print `__CE_SPRINT_CLOSED__ name=<name> findings_p0=<n> awaiting_signoff=true` and prompt the user to share the summary with the reviewer. For manuscript-facing projects, suggest `method-signoff` to build the PI-facing package and validate the signoff ledger.

7. After the named reviewer signs off, record it with `python3 "$SKILL_DIR/scripts/sprint.py" signoff <name> --by <reviewer>` (same `SKILL_DIR` anchor as step 1). The script refuses unless the sprint is `closed_pending_signoff` and `<reviewer>` is the sprint's named reviewer, then writes `status: signed_off`, `signed_off_by`, and `signed_off_at`. Never hand-edit these fields; confirm the `__CE_SPRINT__ action=signoff` line with the user.

### `method-sprint status`

With `SKILL_DIR` set as above, run `python3 "$SKILL_DIR/scripts/sprint.py" status [--name <name>]` and print the current sprint state plus the audit-reviewer findings if closed-pending. Useful for "where am I?".

## What this skill does NOT do

- Does not run analysis itself (that's `method-work`)
- Does not pick the scope -- the user picks SAP sections
- Does not bypass `method-review` -- code review still runs as normal during the sprint; the sprint audit is at close time only
- Does not enforce sprint duration -- a sprint can be 1 hour or 3 weeks; what matters is the bounded scope and the named reviewer

## References

@./references/sprint-log-schema.yaml

@./references/audit-checklist.md
