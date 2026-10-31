# Sensitive-Data Boundary

Load this file in Phase 0a when `phi_environment` has no saved answer, or when the user asks to change the boundary.

<!-- ask-and-save:start -->
## Ask once and save

Ask exactly one question with the platform's blocking question tool (`AskUserQuestion` in Claude Code, loaded first with `ToolSearch` and `select:AskUserQuestion` when its schema is not loaded; `request_user_input` in Codex; `AskUser` in Droid; `question` in OpenCode; `ask_user` in Gemini and Pi). If no blocking tool exists or the call errors, show the three options as a numbered list and wait.

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

## Identifier index

Build or refresh the identifier index whenever `data_root` is set, in every mode (the guard uses it to keep patient names and IDs out of MCP tools and NCBI queries even with an approved endpoint). `scripts/method-identifier-index` in this skill's directory hashes values from identifier-like columns (names, MRN and other IDs, SSN, date of birth, address, phone, email) under `data_root` with a fresh salt and writes `.methodsmith/identifier-index.local.json`, gitignored, with no plaintext. It prints counts only. Check that the file exists, then run it with the first interpreter found among `python3`, then `python`, then `py`:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/method-identifier-index"
```

Report the counts line it prints. If no Python interpreter exists, say the index was not built and that MCP calls are then checked by identifier patterns only.

## Schema helper

`scripts/schema-peek.py` in this skill's directory prints headings, inferred types, row count, non-null counts, and % missing for CSV/TSV (Parquet/Feather with pyarrow, XLSX header with openpyxl). It never prints a cell value, prints `col_1..col_n` when the first row looks like data, and suppresses counts below 11. Check that the file exists, then run it with the first interpreter found among `python3`, then `python`, then `py`:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/schema-peek.py" <data-file>
```

If no Python interpreter exists, ask the user to paste only the header row, and state that types and counts are unknown.
