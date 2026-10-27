---
name: method-clif-audit
description: "Audits a CLIF project repo read-only: template, pins, config, clifpy usage, timezones, export safety, reproducibility. Use when auditing a CLIF repo."
argument-hint: "[project-directory] [--version 2.1.0|3.0.0] [--scope structure|code|outputs|all]"
---

# CLIF Project Audit

## Skill Value

- **Problem it solves:** CLIF project repos drift from consortium conventions in ways that run cleanly but return wrong numbers or leak small cells: stale `clifpy` pins, reimplemented helpers, stripped timezones, 2.1/3.0 vocabulary mismatches, and unsuppressed shared outputs.
- **Use when:** Checking a CLIF analysis repository before a buddy test, before release to sites, after a `clifpy` upgrade, or when inheriting a consortium project.
- **Output:** A per-check pass, warning, or block report with `file:line` evidence, a reimplementation inventory, and a prioritized fix list. No file in the audited repo changes.
- **Ask only if:** The audited directory, the CLIF version family, or the project's declared small-cell rule is ambiguous and would change a verdict.
- **Do not do:** Do not edit the audited repo, run its pipeline on real data, open or quote row-level data, or certify data quality, cohort validity, or disclosure safety.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

`https://clif-icu.com/` is authoritative for the data dictionary, mCIDE, and
consortium rules; `CLIF-Project-Template` is authoritative for layout; current
`clifpy` source is authoritative for API behavior.

## Workflow

1. **Resolve the target and CLIF family.** Audit the named directory, else the
   current repository. Load the `method-clif` skill (or consume `__CE_CLIF__`)
   for the version family. An undeclared family is itself a finding (CA-02),
   not a reason to guess.
2. **Respect the data boundary.** Read code, configs, lockfiles, docs, and file
   listings. Never open Parquet, CSV, RDS, `.RData`, or notebook outputs that may
   hold patient data; for committed data files and executed notebooks, report
   the path, size, and the presence of identifier-named columns from headers
   only. Saved findings contain paths and patterns, never values.
3. **Inventory.** List languages, entry points (`run_*.sh`, numbered `code/`
   scripts, notebooks), configs, lockfiles, CI, tests, and output folders. Use
   `git ls-files` so ignored local data is never listed as committed.
4. **Run the checklist.** Work through `references/audit-checklist.md` section
   by section, using the search patterns in `references/detection-patterns.md`.
   Grade each check pass, warning, block, or not applicable, with evidence.
   Verify every `clifpy` finding against `clifpy` source or `inspect.signature`
   for the version the project pins, not from memory.
5. **Inventory reimplementations.** For each hand-written capability that
   `clifpy` ships (SOFA, outlier handling, waterfall, unit conversion,
   stitching, wide/hourly, ASE, comorbidity, MDRO, tz helpers, loading), record
   the file, the `clifpy` replacement, and whether a documented gap justifies it.
   Vendored copies of `clifpy` modules are a warning; copies that diverge from
   upstream or from each other are a block for distribution.
6. **Report.** Use the report shape below. Rank blocks first, then warnings by
   how likely they are to change a shared number. For each fix, name the
   `clifpy` call or template convention to use; route code rewrites to
   `method-clifpy` and structure fixes to `method-clif-template`.

## Verdict rules

- **Block** when the issue can leak patient data, ship an unsuppressed small cell,
  silently change a shared estimate, or stop another site from running the code.
- **Warning** when the issue weakens reproducibility or maintainability without a
  known wrong-number path.
- The CLIF small-cell rule is the stricter of the project's declared rule, the
  site or DUA rule, and the clif-icu.com FAQ ("more than 10 patients per cell",
  so suppress any count of 10 or fewer). The template README's `n >= 10` is one
  looser; report a project that follows it as a warning, not a pass.
- Distribution readiness requires zero blocks and a passing
  `BUDDY_TEST_REPORT.md` (or the template's buddy-test report) from an
  independent site.

## Report shape

```markdown
# CLIF audit: <repo> (<date>, CLIF <family>, clifpy <pinned or unknown>)

Verdict: <ready | not ready: N blocks, M warnings>

| ID | Check | Verdict | Evidence | Fix |
| --- | --- | --- | --- | --- |

## Reimplemented clifpy capabilities
| Capability | File | clifpy replacement | Justified gap? |

## Prioritized fixes
1. ...

Not certified: data quality, cohort validity, disclosure safety, consortium approval.
```

Write the report to chat, or to a path the user names. When saved inside the
audited repo, keep it outside `output/final_no_phi/`.

## Boundaries and routing

- Structural template conformance alone: `method-clif-template audit`.
- Writing or fixing `clifpy` calls: `method-clifpy`.
- Data-quality evidence on real tables: `method-data-qa` under the approved boundary.
- Disclosure review of outputs: the `method-phi-leak-reviewer` agent.
- Sign-off before sharing: `method-signoff`; schema changes: the table POC via `method-clif`.

## References

- `references/audit-checklist.md` — check IDs CA-01 to CA-95 across version, structure, environment, config, clifpy usage, timezone, outputs and disclosure, reproducibility, and code health, with block/warning rules. Read at step 4.
- `references/detection-patterns.md` — `rg` and `git` patterns for each check, including reimplementation and anti-pattern signatures seen across consortium repos. Read at steps 3-5.
