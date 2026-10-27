# Sensitive-Data Boundary Gate

The `method-setup` skill normally records the boundary. Apply this gate before opening data files or patient-level outputs.

## Gate

**Sensitive-data boundary.** Resolve `phi_environment.mode` in `.methodsmith/config.local.yaml` (worktree, then main checkout; legacy `compliant: true` = `approved`, `compliant: false` = `schema-only`, `sensitive_data: false` = `no-sensitive-data`; any schema-only signal wins; unreadable = `schema-only`). `approved` or `no-sensitive-data`: proceed silently and never mention the boundary again. `schema-only`: headings, types, counts, and aggregates only; never open, print, or paste data values; run data-reading scripts as `method-safe-run -- <command>` (path in the guard's deny message); save results as aggregate tables (counts under 11 suppressed) in `output/` or a `phi_environment.aggregate_dirs` entry. Unset, interactive: ask once with the blocking question tool (else a numbered list) offering `Approved endpoint: full access`, `Not approved or unsure: schema-only`, and `No sensitive data: public or synthetic`; save the answer as `phi_environment.mode` there once `git check-ignore -q .methodsmith/config.local.yaml` passes (else first add `.methodsmith/*.local.yaml` to `.gitignore`) so the guard hook sees it. Unset, headless: schema-only. In agent, autofix, report-only, or headless mode, retain `PHI authorization: not confirmed` for sub-agents; with `approved` or `no-sensitive-data`, pass `PHI authorization: confirmed`.

<!-- ask-and-save:start -->
## Ask once and save

Ask exactly one question with the platform's blocking question tool (`AskUserQuestion` in Claude Code, loaded first with `ToolSearch` and `select:AskUserQuestion` when its schema is not loaded; `request_user_input` in Codex; `ask_user` in Gemini and Pi). If no blocking tool exists or the call errors, show the three options as a numbered list and wait.

- Stem: "Will this project use sensitive data (PHI, PII, or other restricted records)? If so, is the model endpoint the agent runs on approved for it, for example HIPAA-compliant under a BAA or approved by your institution?"
- Options, in this order:
  1. `Approved endpoint: full access` - the endpoint is approved for this project's sensitive data.
  2. `Not approved or unsure: schema-only` - the data is sensitive and the endpoint is not approved, or the user does not know.
  3. `No sensitive data: public or synthetic` - nothing in the project is restricted.

| Answer | Write to `phi_environment` | Show the user |
|---|---|---|
| `Approved endpoint: full access` | `mode: approved`, `confirmed_on: <today>` | One line: `Saved: approved endpoint, no data restrictions. Confirming that approval (BAA or institutional sign-off) is your responsibility.` Never mention the boundary again. |
| `Not approved or unsure: schema-only` | `mode: schema-only`, `confirmed_on: <today>` | The schema-only explainer below, once. |
| `No sensitive data: public or synthetic` | `mode: no-sensitive-data`, `confirmed_on: <today>` | One line: `Saved: no sensitive data, no restrictions.` Never mention the boundary again. |

Resolve `<today>` at runtime, then save:

1. Run `git check-ignore -q .methodsmith/config.local.yaml`. Exit 0 means ignored. Outside a git repository, skip to step 3.
2. If it is not ignored, add `.methodsmith/*.local.yaml` to `.gitignore` and say so in the confirmation line.
3. Merge the block into `.methodsmith/config.local.yaml`, creating the file if needed. Keep every other key, and drop any legacy `compliant` or `sensitive_data` key from the block so it cannot conflict with `mode`. Never write data values, identifiers, or credentials to the config.

In headless or non-interactive runs, do not ask or save. Work in schema-only mode for the run.

### Schema-only explainer (show once after that answer)

```text
Schema-only mode is on. The model endpoint is not approved for this data, so no
data values (names, MRNs, claim numbers, dates, notes, or any other cell) go to
the agent.

The agent CAN see:  column headings, column types, row counts, % missing, and
                    aggregate results your own runs produce.
The agent CANNOT:   look at example rows; debug value-level parsing, recoding,
                    or join mismatches by example; read free text or notes;
                    spot individual data-entry errors.

How work proceeds:  the agent writes the code; scripts print only aggregates,
                    with counts under 11 suppressed. For structure, the agent
                    runs the schema helper, which prints headings, types,
                    counts, and % missing only.

In Claude Code a guard hook blocks tool calls that would read data files, and
runs scripts that read data only through method-safe-run, which keeps their output
in a local log and shows the agent the exit code, files written, and a masked
error tail. Aggregate tables under output/ print through method-aggregate-read,
which checks the same bytes it shows (no identifier columns, no counts from
1 to 10).
To change this later, re-run the method-setup skill or edit phi_environment.mode
in .methodsmith/config.local.yaml.
```
<!-- ask-and-save:end -->

## Schema-only mode

- Never read, grep, print, or paste data-file contents (names, MRNs, claim numbers, dates, notes, or any cell value) into the conversation. Use file names and column headings only.
- Write analysis code as script files. Run any script that reads data as `method-safe-run -- <command>`, using the path the guard's deny message gives. The runner keeps stdout and stderr in `.methodsmith/runs/` (gitignored, and unreadable to the agent in this mode) and prints only the exit code, duration, files written with row counts, and a stderr summary of traceback frames and error types. Workflow runners (`make`, `snakemake`, `pytest`, `npm run`, and similar) go through it too.
- Save results as aggregate tables (counts, rates, model estimates; cells under 11 suppressed) in `.csv`, `.tsv`, or `.md` under `output/`, `results/`, `analysis/publication/`, `analysis/sap-tables/`, or the directories in `phi_environment.aggregate_dirs`. Print such a table with `method-aggregate-read <file>`, using the path the guard's deny message gives: it reads the file once and prints it only if those bytes pass the aggregate check (no identifier-like column headings, no cell in the identifier index, no count from 1 to 10, at most 500 rows). Scripts that read these tables run through method-safe-run like any data-reading script, and files a method-safe-run run writes count as data until printed through method-aggregate-read.
- When a task needs value-level inspection (debugging a parse, a recode, or a join mismatch by example), say so, and give the user a script to run and summarize instead.

## Schema helper

`scripts/schema-peek.py` in this skill's directory prints headings, inferred types, row count, non-null counts, and % missing for CSV/TSV (Parquet/Feather with pyarrow, XLSX header with openpyxl). It never prints a cell value, prints `col_1..col_n` when the first row looks like data, and suppresses counts below 11. Check that the file exists, then run it with the first interpreter found among `python3`, then `python`, then `py`:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/schema-peek.py" <data-file>
```

If no Python interpreter exists, ask the user to paste only the header row, and state that types and counts are unknown.

## Always

In every mode, never commit patient-level data to Git, issues, or public exports.
