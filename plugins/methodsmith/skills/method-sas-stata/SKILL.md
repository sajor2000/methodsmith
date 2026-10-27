---
name: method-sas-stata
description: "Assesses SAS and Stata code (.sas, .do, .ado, .dta) for reproducibility, review risk, and porting feasibility. Use when a repo has SAS or Stata work to review or port."
argument-hint: "[optional: --scan-dir analysis --report analysis/sas-stata-assessment.md]"
---

# SAS/Stata Project Assessment

> **Run the script from the user's project root.** `$SKILL_DIR` anchors the script path; `--scan-dir` and `--report` resolve against `--project-root` and must stay project-relative.


## Skill Value

- **Problem it solves:** Legacy SAS/Stata analyses need review and migration planning before automated rewrites are safe.
- **Use when:** The repo contains .sas, .do, .ado, .dta, PROC statements, or Stata commands and the user asks what can be reviewed or ported.
- **Output:** Assessment of reproducibility risks, migration readiness, and recommended next steps.
- **Ask only if:** Only when target outcome, validation standard, or migration destination is unclear.
- **Do not do:** Do not claim full SAS/Stata equivalence or scaffold unsupported workflows.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

This skill is intentionally assessment-first. The plugin does not yet provide first-class SAS or Stata scaffolding. It can identify the surface area, likely statistical procedures, portability risks, and a safe handoff path to R/Python/Quarto workflows.

## Workflow

1. Scan the project for `.sas`, `.do`, and `.ado` files.
2. Identify common procedure/model families and IO patterns.
3. Write a concise assessment report:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/assess_sas_stata.py" --project-root . --scan-dir analysis --report analysis/sas-stata-assessment.md
```

4. Use the report to decide whether to:
   - keep the legacy code and add reproducibility wrappers,
   - port a bounded analysis to R/Python,
   - ask a human SAS/Stata analyst to validate model equivalence.

## Guardrails

- Do not generate new SAS/Stata project scaffolds automatically.
- Do not claim statistical equivalence after a port without paired output comparison.
- Never commit `.dta`, `.sas7bdat`, or other patient-level files to Git.
- **Sensitive-data boundary.** Resolve `phi_environment.mode` in `.methodsmith/config.local.yaml` (worktree, then main checkout; legacy `compliant: true` = `approved`, `compliant: false` = `schema-only`, `sensitive_data: false` = `no-sensitive-data`; any schema-only signal wins; unreadable = `schema-only`). `approved` or `no-sensitive-data`: proceed silently and never mention the boundary again. `schema-only`: headings, types, counts, and aggregates only; never open, print, or paste data values; run data-reading scripts as `method-safe-run -- <command>` (path in the guard's deny message); save results as aggregate tables (counts under 11 suppressed) in `output/` or a `phi_environment.aggregate_dirs` entry. Unset, interactive: ask once with the blocking question tool (else a numbered list) offering `Approved endpoint: full access`, `Not approved or unsure: schema-only`, and `No sensitive data: public or synthetic`; save the answer as `phi_environment.mode` there once `git check-ignore -q .methodsmith/config.local.yaml` passes (else first add `.methodsmith/*.local.yaml` to `.gitignore`) so the guard hook sees it. Unset, headless: schema-only.

## References

@./references/assessment-checklist.md
