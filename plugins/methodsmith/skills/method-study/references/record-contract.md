# Record and helper contract

The Python standard-library helper owns `study.json`, schema version 1, in the selected protected root. Read the matching `study-record-schema.json` when composing records. It rejects unknown versions, identity/root mismatches, dangling dependencies, cycles and conflicting writes. Do not manually bypass a lock; first establish that no writer remains. No automatic migration or reset is provided: preserve the old root and report unsupported versions for a deliberate migration.

All mutations after initialization require the last observed `--expected-revision N`; conflict means reload and reconcile, never blindly retry. IDs are ASCII letters, digits, underscores or hyphens, starting with a letter or digit, at most 64 characters. Roots and artifact locators remain local. Standard output contains safe IDs and statuses, never source content.

Use `scripts/study_record.py` from the skill directory with `--root ROOT --study-id ID` before the command:

| Command | Arguments | Evidence/result |
| --- | --- | --- |
| `init` | `--approved-local-root` | Explicit storage acknowledgement; does not authorize data execution |
| `add` | `--expected-revision N --id ID --path PATH --kind KIND [--depends-on ID ...] [--provenance unknown\|inferred\|verified] [--dependencies-complete]` | Preserves original; initial execution is unrun |
| `status`, `validate` | none | Rehashes current inputs; propagates stale state; reports unknown coverage |
| `refresh` | `--expected-revision N --id ID` | Accepts new bytes; clears execution and approval |
| `record-run` | `--expected-revision N --id ID --evidence RUN_JSON` | Requires matching source digest and outcome; record is not authenticated |
| `approve` | `--expected-revision N --id ID --reviewer NAME --human-confirmed` | Records actual human approval against content and dependencies |
| `master` | `--expected-revision N --id ID --human-confirmed` | Sets a manuscript master and retains authority history |
| `export-manuscript` | `--expected-revision N --id ID --output NEW_PATH` | Copies bytes, never overwrites a coauthor's file; not a format converter |
| `snapshot` | `--expected-revision N --id ROUND_ID` | Copies current non-data artifacts, keeps data references, refuses reused IDs |

Kinds: code, notebook, data, plan, table, figure, manuscript, evidence. Dependencies must already be registered. Record incomplete coverage until someone has reviewed all material inputs. A current digest means bytes match, not that a result is correct. `provenance: verified` requires supplied historical evidence; the helper cannot reconstruct it.

For execution use `scripts/notebook_evidence.py --source PATH --run-dir NEW_PROTECTED_DIR --authorized-execution [--timeout SECONDS] [--kernel KERNEL]`. Anchor the script to the loaded skill directory as in SKILL.md. It supports `.ipynb`, marimo `.py`, `.Rmd` and `.qmd`; missing engines return unavailable. It writes protected `run.json`, a notebook copy and `execution.log`. Runtime output can contain sensitive values. Never print the log into chat. Execution is not sandboxed; source-relative resources and render error policies require review.

For a reviewed status projection use `scripts/share_study.py --status PROTECTED_STATUS_JSON --output NEW_HTML_OR_JSON --reviewed-for-sharing`. Never pass a raw record as if it were a safe projection. The output is an explicitly dated-by-revision snapshot, not a live dashboard.
