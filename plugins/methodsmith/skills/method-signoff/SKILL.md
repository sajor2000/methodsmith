---
name: method-signoff
description: "Records named scientific review decisions. Use when approving study artifacts or checking signoff."
argument-hint: "[optional: --ledger analysis/signoff/signoff-ledger.json]"
---

# Review Pack and Signoff

> **Script paths are anchored on `SKILL_DIR`.** Run the command below from the user's project root so `--project-root .` and the project-relative `--ledger` path resolve to the project, not the skill directory.


## Skill Value

- **Problem it solves:** Study leads need concise, auditable review packets rather than scattered outputs and informal approvals.
- **Use when:** The user needs PI review, statistician signoff, coordinating-center handoff, or approval workflow packaging.
- **Output:** Review pack with artifact inventory, decisions, deviations, readiness status, and signoff ledger.
- **Ask only if:** Only when reviewer names, scope, or required artifacts are unclear.
- **Do not do:** Do not sign off on behalf of humans or hide unresolved blockers.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Create a concise study-team handoff and validate named human approvals. This skill never marks scientific content approved without a named reviewer.

## Workflow

1. Collect ready outputs from Table 1, figure, manuscript, registry, sprint, data-QA, and code-review reports.
2. Summarize blockers, unresolved SAP drift, and requested signoffs in a PI-facing markdown file.
3. Validate the signoff ledger:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/validate_signoff_ledger.py" --ledger analysis/signoff/signoff-ledger.json --project-root .
```

4. If the ledger is missing or invalid (including a missing or empty top-level `ledger_id` or `study_id`, or a missing `entries` list), the validator reports BLOCKED; keep readiness at blocked, never approved. A valid ledger reports READY-WITH-REVIEW, which is still not an approval.

## Signoff Principles

- Every approval has a named reviewer.
- Prior entries are append-only and hash-checkable.
- Data locks, SAP locks, Table 1 readiness, figure readiness, registry packages, and manuscript packages are separate signoff scopes.
- CLIF projects include aggregate-only and protected-path signoff checks.

## References

@./references/review-pack-template.md

@./references/signoff-ledger-schema.yaml

## Content-bound study approvals

For new ledgers use schema version 2 with each entry's project-relative `artifact_path` and SHA-256 `artifact_sha256`. The validator checks current bytes; version 1 remains readable but is explicitly legacy evidence, not current content-bound approval. Use `method-study` for transitive dependency bindings and stale approvals. A hash chain or typed reviewer name does not authenticate identity or replace the actual human review. Preserve original ledgers before deliberate migration.
