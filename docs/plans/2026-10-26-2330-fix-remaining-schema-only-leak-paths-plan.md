---
title: Close Remaining Schema-Only Leak Paths - Plan
type: fix
date: 2026-10-26
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# Close Remaining Schema-Only Leak Paths - Plan

## Goal Capsule

- **Objective:** In a schema-only methodsmith project, data values cannot reach the model context through a recognized database MCP tool, through files a `method-safe-run` run writes inside the project or to its own temp directory (including while it is still running or after it crashed), or through a script whose sourced path is computed at run time. The remaining limits are the ones listed under Scope Boundaries.
- **Means:** Four targeted guard and runner changes (KTD1-KTD4) that close the three leak paths, each landed with a synthetic-data test that fails first.
- **Authority:** This plan's Requirements and KTDs, then `AGENTS.md`, then the guard docstring, which U5 updates.
- **Stop conditions:** Stop and report if a fix would change access in `approved` or `no-sensitive-data` projects, would block literature tools (PubMed, Paperclip, web search), or would push a guard decision past the latency budget in R9.
- **Execution profile:** Test-first per leak path, on a new branch from `main`.
- **Tail ownership:** The calling pipeline (LFG) owns review, commit, push, and the PR.

---

## Product Contract

### Summary

Close the three schema-only leak paths PR #171 left as residuals: database MCP tools that return rows, `method-safe-run` output that lands in the run's temp directory or before the run finishes, and scripts that `source()` or `exec()` a path built at run time. Every fix ships with a test that fails before the change.

### Problem Frame

PR #171 hardened the PHI data-boundary guard but left three documented gaps. A database MCP server (Postgres, DuckDB, Snowflake, and similar) answers `SELECT * FROM patients` straight into the model's context because the guard only checks MCP arguments for file paths and code that names data files. `method-safe-run` records only files written inside the project, after the run exits, so a script that writes rows to a temp file, or writes anything while running in the background or after being killed, leaves a copy the model can read. And a script that sources another script through a variable (`source(f)`, `runpy.run_path(p)`, `exec(open(p).read())`) is never scanned. Each gap lets row-level values into the model context in exactly the mode meant to prevent it.

### Key Decisions

- **No `!` or `BREAKING CHANGE:` marker.** (session-settled: user-directed — chosen over marking the change breaking: release-version decisions belong to the maintainer.) Governs R12.
- **The guard file is not split in this PR.** (session-settled: user-approved — chosen over splitting `data-boundary-guard.py` here: mixing a refactor into security fixes makes them harder to review.) Governs R13.
- **Unresolvable dynamic source paths are denied in schema-only.** (session-settled: user-approved — chosen over leaving them as a documented heuristic limit: closes a known leak at the cost of routing such scripts through `method-safe-run`.) Governs R7, R8.

### Requirements

**Database MCP tools**

- R1. In schema-only, an MCP call to a database tool that carries a row-returning query is denied, with a reason that points to running the query in a script through `method-safe-run`, writing an aggregate table, and reading it with `method-aggregate-read`.
- R2. Schema inspection stays allowed, and nothing else: a database tool with no query text whose name has an inspection word (`list`, `describe`, `schema`, `tables`, `columns`, `info`, `metadata`, `indexes`); or one single statement that is `DESCRIBE <name>`, `SHOW TABLES|COLUMNS ...`, `PRAGMA table_info(<name>)`, or a select whose projection is `*` or bare column names, whose FROM is exactly one `information_schema.tables` or `information_schema.columns`, and whose WHERE uses only column-to-literal comparisons (`=`, `LIKE`, `IN` over literals, `AND`/`OR`). Any function call, join, comma-separated source, CTE, subquery, or `UNION` denies.
- R3. Literature and search tools (PubMed, Paperclip including its `sql` tool, Exa, Tavily, Notion, web search) are unaffected, and approved / no-sensitive-data access to database tools is unchanged (egress identifier checks still apply).

**method-safe-run**

- R4. Files a run writes to its temp directory are data: the child's `TMPDIR`, `TMP`, and `TEMP` point at a per-run owner-only directory the guard treats as data; the runner deletes it when the run finishes normally.
- R5. While a run or any process it started is still alive, or after it died without finishing, project files created, modified, or renamed in at or after that run's start are data until the run is reconciled.
- R6. A stale run (runner and its whole process group gone, outputs never recorded) is reconciled by the next `method-safe-run` invocation or by `method-safe-run --reconcile`, which records only files changed between the run's start and its last heartbeat, then clears the marker. The guard's boundary state (`runs/active/`, `runs/temp-roots.txt`) cannot be removed or edited by other commands in schema-only.

**Dynamic source paths**

- R7. In schema-only, code that runs another file or module whose target cannot be statically resolved is denied, inline (`-e`/`-c`, every occurrence) and inside scanned script files, unless run through `method-safe-run`. This covers R `source`, `sys.source`, `eval(parse(...))`, and `source` passed to a higher-order function; Python `runpy.run_path`, `runpy.run_module`, `exec`/`eval` of anything other than a string literal (including `compile(...)` and `open(...).read()`), `importlib.import_module`, `__import__`, and `spec_from_file_location`.
- R8. Statically resolvable targets are followed and scanned rather than denied: string literals, including inside `file.path`, `paste0`, `paste(..., sep=)`, `here::here`/`here()`, and named `file=`/`path=` arguments, and literal module names for `runpy.run_module` / `importlib.import_module`. A resolved file that does not exist, or a call preceded by `setwd(`/`os.chdir(` or given `chdir=`, counts as unresolvable.

**Contract**

- R9. One guard decision stays under 1 second on the test fixtures; marker and temp-root checks never walk a directory tree at hook time.
- R10. Every fix has a synthetic-data test that fails before the change, and deny reasons never echo data values.
- R11. The guard docstring and the shared sensitive-data boundary section in `README.md`, `plugins/methodsmith/README.md`, and `docs/setup.md` describe the new coverage and the remaining limits identically.
- R12. No `!` or `BREAKING CHANGE:` marker.
- R13. `data-boundary-guard.py` is not split.

### Scope Boundaries

- Writes to absolute paths outside both the project and the run's temp directory (for example a hard-coded `/tmp/x.csv`, Java `java.io.tmpdir`, Spark `spark.local.dir`) are not tracked; they are documented as a limit.
- The guard does not inspect MCP results (only `PreToolUse` is registered); routing MCP calls through `method-aggregate-read` is not possible and is not attempted.
- Files the model itself edits during a background run count as data until the run ends and may be recorded as run outputs; this is documented, not fixed.
- A database tool is recognized by its server or tool name (KTD1 vocabulary) or by SQL- or Cypher-shaped text under a query key; an unrecognized server whose tools return rows without either signal is not detected.
- MCP resources read through `ReadMcpResourceTool` are not matched by the hook.
- A run marker written on another machine (a synced project folder) stays in force and is never reconciled from here.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Database tools fail closed; inspection is an allowlist.** Split MCP server and tool names on `_`, `-`, and `__`. A call is a database call when a whole word matches the vocabulary (`postgres`, `postgresql`, `pg`, `mysql`, `mariadb`, `sqlite`, `duckdb`, `motherduck`, `bigquery`, `snowflake`, `databricks`, `mssql`, `sqlserver`, `oracle`, `redshift`, `athena`, `clickhouse`, `trino`, `presto`, `neo4j`, `kusto`, `cosmos`, `supabase`, `mongodb`, `mongo`, `elasticsearch`, `opensearch`, `redis`, `dynamodb`, `firestore`, `cassandra`, `influxdb`, `airtable`, `sql`, `database`, `db`), or when a query key (`sql`, `query`, `statement`, `cypher`, `kql`, `filter`, `pipeline`, found anywhere in the arguments via `_strings`) holds SQL- or Cypher-shaped text (`SELECT|WITH|MATCH|FROM|PRAGMA|SHOW|DESCRIBE` as the first keyword), unless the server is exempt (`pubmed`, `paperclip`, `exa`, `tavily`, `notion`, `granola`, `vercel`, and the `claude_ai_*` literature connectors). `command` is a router sub-command name, not query text: a router call is allowed only when that name is an inspection word, and any nested query is checked like any other. A database call with query text passes only the R2 statement shape; a database call without query text passes only when a name segment is an inspection word. Everything else denies in schema-only. Implements R1-R3.
- KTD2. **Short temp dir outside the project, registered as a data root.** `method-safe-run` creates the child's temp dir with `tempfile.mkdtemp(prefix="msr-")` (mode 0700) in the system temp root (short path: avoids the ~104-byte Unix-socket limit, spaces, and cloud-synced folders), sets `TMPDIR`/`TMP`/`TEMP` for the child, and appends it to `.methodsmith/runs/temp-roots.txt` before the child starts. The guard adds each listed dir and its realpath to `data_roots`. The runner removes the temp dir after a normal finish and prunes listed dirs that no longer exist on its next start. Appends to `temp-roots.txt` and `outputs.txt` use `O_APPEND` under an `fcntl` lock. Implements R4.
- KTD3. **Process-group marker with heartbeat; stale means the whole group is gone.** The runner starts the child with `start_new_session=True` and, before the child runs, writes `.methodsmith/runs/active/<pid>.json` holding the runner pid, its process start time, the child process-group id, hostname, and the filesystem-clock start (the existing sentinel ctime). It touches the marker every 10 s while the child runs (heartbeat). On SIGTERM/SIGINT it forwards the signal to the child's process group, waits up to 10 s, escalates to SIGKILL, and finalizes only once the group is gone; normal exit also waits for the group. A marker is stale when the runner pid is gone or its start time no longer matches, and the process group has no live member, on the same host; a marker from another host is never stale here. Reconcile (next run start, or `--reconcile`) records project files whose `max(mtime, ctime)` lies between the marker start and its last heartbeat plus 2 s, then removes the marker. The guard lists `runs/active/` only (no tree walk): a referenced path counts as data when it, or its parent directory, changed at or after the start of any marker. Schema-only Bash, Write, and Edit calls that would remove, move, truncate, or write `runs/active/*` or `runs/temp-roots.txt` are denied. Implements R5, R6.
- KTD4. **Run-a-file sinks: resolve literals, deny the rest.** Generalize `SOURCED` into a sink table (R7's list) whose patterns capture the first argument the way `READ_CALL` does. A target is resolvable when it is a string literal, a named `file=`/`path=` literal, or `file.path`/`paste0`/`paste`/`here`/`here::here` over literals only (relative to the effective directory; `here` relative to the project root). Literal module names (`run_module`, `import_module`) resolve with the existing `module_files(module, cwd, env)`. Resolvable targets are scanned with `script_reads_data` (recursion capped by `_SCANNING`). A target denies when it is not resolvable, when the resolved file does not exist, or when `setwd(`, `os.chdir(`, or a `chdir=` argument appears before the call. `source`/`sys.source` as a function value is detected only as an argument of `lapply`, `sapply`, `vapply`, `Map`, `mapply`, `Reduce`, `Filter`, `do.call`, or `purrr`/bare `walk*`/`map*`, so a data column named `source` is not misread. Apply in `judge` for every `-e`/`-c` argument and in `script_reads_data` for scanned files. Implements R7, R8.

### Assumptions

- Schema inspection uses the strict allowlist in R2; anything outside it denies. A user who needs more schema detail runs a script through `method-safe-run`.
- Editing a file during a live background run makes that file data until the run ends (accepted friction; the deny reason says to wait or run the edit through the run's completion).
- A dead run's marker fails closed until reconciled, which may deny reads of files the user edited after the crash; the deny reason names `method-safe-run --reconcile`.

### Risks

| Risk | Mitigation |
|---|---|
| Blocking legitimate MCP tools that use `query` or `sql` keys | Whole-word name matching plus the exemption list; tests keep `NORMAL_QUERIES`, PubMed, Paperclip `sql`, and Notion query tools allowed. |
| A stale marker blocks work indefinitely | Reconcile on the next run and via `--reconcile`; deny reason names the command. |
| Reconcile records files edited long after a crash | The reconcile window ends at the run's last heartbeat. |
| PID reuse makes a dead run look alive | The marker stores the runner's process start time and the child process group. |
| Edits during a live run become data until it ends | Documented; test pins the behavior. |
| Temp redirect breaks tools that ignore or dislike `TMPDIR` | Short system-temp path; tests run Python `tempfile` and R `tempdir()` under the runner. |
| Guard latency from marker checks | Only `runs/active/` is listed and only referenced paths are stat'd; latency test. |

---

## Implementation Units

### U1. Deny row-returning database MCP calls in schema-only

- **Goal:** R1-R3.
- **Requirements:** R1, R2, R3, R9, R10. KTD1.
- **Dependencies:** None.
- **Files:** `plugins/methodsmith/hooks/data-boundary-guard.py`, `tests/data-boundary-guard.test.ts`.
- **Approach:**
  1. Add failing tests next to the existing MCP access tests.
  2. Add the DB vocabulary, exemption list, query keys, and row-tool segments as module constants near `MCP_CODE_KEYS`.
  3. Add a database check to `mcp_access_violation` returning an access reason that names `method-safe-run` and `method-aggregate-read`.
- **Patterns to follow:** `UPLOADISH_TOOL`, `mcp_access_violation`, `aggregate_hint` deny text.
- **Test scenarios:** schema-only unless noted:
  - `mcp__postgres__query {sql: "SELECT * FROM patients"}` -> deny.
  - `mcp__postgres__query {sql: "select column_name from information_schema.columns where table_name='x'"}` -> allow.
  - `information_schema` select with `UNION SELECT ssn FROM p` -> deny.
  - `mcp__pg__q {sql: "SELECT * FROM pg_stats"}` -> deny.
  - `mcp__duckdb__run {query: "SUMMARIZE t"}` -> deny.
  - `mcp__duckdb__list_tables {}` -> allow; `mcp__duckdb__describe_table {table: "t"}` -> allow.
  - `mcp__sqlite__read_rows {table: "t"}` -> deny; `mcp__duckdb__preview_table {table: "t"}` -> deny; `mcp__postgres__get_table_data {table: "t"}` -> deny.
  - `mcp__postgres__query {sql: "SELECT pg_read_file('data/cohort.csv') AS column_name FROM information_schema.tables"}` -> deny.
  - `mcp__duckdb__run {query: "SELECT * FROM information_schema.tables, read_csv('data/cohort.csv')"}` -> deny.
  - `mcp__mongodb__find {collection: "patients", filter: {}}` -> deny.
  - `mcp__Azure_MCP_Server__cosmos {command: "database_list", parameters: {}}` -> allow; the same tool with `parameters: {query: "SELECT * FROM c"}` -> deny.
  - `mcp__mydb__exec {params: {statement: "SELECT * FROM t"}}` (no DB word in the name) -> deny via SQL-shaped text.
  - `mcp__neo4j__run {query: "MATCH (p:Patient) RETURN p"}` -> deny.
  - `mcp__claude_ai_Paperclip__sql {query: "SELECT title FROM papers"}` -> allow.
  - `mcp__pubmed__pubmed_search_articles {query: "select sepsis outcomes ICU"}` -> allow.
  - `mcp__claude_ai_Notion__notion-query-data-sources {query: "x"}` -> allow.
  - Approved project: `mcp__postgres__query {sql: "SELECT * FROM patients"}` -> allow.
  - The deny reason contains no query text.
- **Verification:** New tests pass; `NORMAL_QUERIES` and all existing MCP tests pass.

### U2. Temp directory and in-progress runs in method-safe-run

- **Goal:** R4-R6 on the runner side.
- **Requirements:** R4, R5, R6, R10. KTD2, KTD3.
- **Dependencies:** None.
- **Files:** `plugins/methodsmith/scripts/method-safe-run`, `tests/data-boundary-limits.test.ts`.
- **Approach:**
  1. Add failing tests in the "limit 1b" block.
  2. Create the short temp dir, register it in `runs/temp-roots.txt`, and pass the env to the child.
  3. Start the child in its own session; write `runs/active/<pid>.json` (KTD3 fields) before it runs; heartbeat every 10 s; on exit or SIGTERM/SIGINT forward to the process group, wait for it, then record outputs, remove the temp dir, and remove the marker.
  4. At startup, and for `--reconcile`, reconcile stale markers whose pid is gone.
  5. Append to `outputs.txt` and `temp-roots.txt` with `O_APPEND` under an `fcntl` lock.
- **Patterns to follow:** existing sentinel/`since_ns`, `record_outputs`, `legacy_refusal` exit style.
- **Test scenarios:**
  - Child Python `tempfile.mkstemp()` writes a file; it lies under a dir listed in `runs/temp-roots.txt`.
  - `Rscript -e 'cat(tempdir())'` under the runner prints a path under a registered temp root (skip when Rscript is absent).
  - A run killed with SIGTERM forwards it to the child, records its outputs, and removes its marker.
  - The child starts a background writer that writes after the runner gets SIGTERM: the marker stays until the writer exits, and the late file is recorded.
  - After a SIGKILL of the runner, a file edited after the last heartbeat is not added to `outputs.txt` by `--reconcile`.
  - A marker whose recorded process start time does not match the live process with that pid is treated as stale.
  - The temp dir is created with mode 0700 and removed after a normal finish.
  - A marker whose pid is dead remains after a SIGKILL; the next run (or `--reconcile`) records the dead run's written file in `outputs.txt` and removes the marker.
  - Two concurrent runs each writing a file: both paths end up in `outputs.txt`, and both temp dirs in `temp-roots.txt`.
- **Verification:** New tests pass; existing limit 1b tests pass.

### U3. Guard consumes temp roots and active-run markers

- **Goal:** R4, R5 on the guard side.
- **Requirements:** R4, R5, R9, R10. KTD2, KTD3.
- **Dependencies:** U2 (file formats).
- **Files:** `plugins/methodsmith/hooks/data-boundary-guard.py`, `tests/data-boundary-limits.test.ts`.
- **Approach:**
  1. Read `runs/temp-roots.txt` in `_project_mode` (and the legacy runs dir) and add each entry and its realpath to `data_roots`.
  2. Load `runs/active/*.json` markers; in `is_data_path`, a referenced path under the project counts as data when it or its parent directory changed at or after any marker's start.
  3. Deny reasons for marker hits name `method-safe-run --reconcile` when the marker is stale.
  4. Deny schema-only Bash/Write/Edit mutations of `runs/active/*` and `runs/temp-roots.txt` (rm, mv, cp over, redirects, truncation) outside the plugin's `method-safe-run`.
- **Patterns to follow:** `run_outputs` / `output_lists`, `_project_mode` data_roots.
- **Test scenarios:**
  - After a run, `Read <tempdir>/rows.txt` and `cat <tempdir>/rows.txt` -> deny (schema-only); approved -> allow.
  - With a live marker (written by the test), `Read results/out.csv` modified after the marker start -> deny; a file last modified before the start -> allow.
  - Stale marker (dead pid) -> deny with a reason naming `--reconcile`.
  - A file renamed into the project during a live run (`mv /tmp/r.csv results/`) -> deny.
  - Editing `R/x.R` during a live run, then reading it -> deny (documented friction).
  - `rm .methodsmith/runs/active/123.json` and `echo > .methodsmith/runs/temp-roots.txt` -> deny.
  - Latency: a decision with 20 markers present stays under 1 s.
- **Verification:** New tests pass; existing guard tests pass.

### U4. Deny unresolvable dynamic source targets

- **Goal:** R7, R8.
- **Requirements:** R7, R8, R10. KTD4.
- **Dependencies:** None.
- **Files:** `plugins/methodsmith/hooks/data-boundary-guard.py`, `tests/data-boundary-limits.test.ts`.
- **Approach:**
  1. Add failing tests in the "limit 1a" block.
  2. Extend `SOURCED` with first-argument capture and the resolvable-literal forms; add the function-value forms.
  3. In `judge`, scan every `-e`/`-c` argument; in `script_reads_data`, follow resolvable sourced scripts and deny unresolvable ones.
- **Patterns to follow:** `READ_CALL` variable-argument rule, `_SCANNING` recursion cap.
- **Test scenarios:** schema-only, where `R/x.R` is clean and `R/bad.R` reads `data/cohort.csv`:
  - `Rscript -e 'source(file.path("R","x.R"))'` -> allow; with `"bad.R"` -> deny.
  - `Rscript -e 'source(file="R/x.R")'` -> allow.
  - `Rscript -e 'source(here::here("R","x.R"))'` -> allow.
  - `Rscript -e 'source(paste0("R/", step, ".R"))'` -> deny; reason names `method-safe-run`.
  - `Rscript -e 'invisible(lapply(list.files("R", full.names=TRUE), source))'` -> deny.
  - `Rscript -e 'f<-"R/x.R"' -e 'source(f)'` -> deny.
  - `python3 -c "exec(open(p).read())"` -> deny; `python3 -c "import runpy; runpy.run_path('s.py')"` with clean `s.py` -> allow.
  - `Rscript -e 'sys.source(f)'`, `Rscript -e 'eval(parse(f))'`, `Rscript -e 'eval(parse(file = f))'` -> deny.
  - `python3 -c "exec(compile(open(p).read(), p, 'exec'))"`, `python3 -c "import importlib; importlib.import_module(m)"`, `python3 -c "exec(Path(p).read_text())"` -> deny.
  - `python3 -c "import runpy; runpy.run_module(name)"` -> deny; `runpy.run_module('pkg.bad')` where `pkg/bad.py` reads data -> deny; `runpy.run_module('pkg.ok')` (clean) -> allow.
  - `Rscript -e 'source("R/missing.R")'` -> deny (resolved file absent).
  - `Rscript -e 'setwd("sub"); source("R/x.R")'` -> deny.
  - Script file with `dplyr::count(df, source)` -> allow.
  - Script file `analysis/main.R` containing `for (f in fs) source(f)` run as `Rscript analysis/main.R` -> deny.
  - Script file containing `source("R/bad.R")` -> deny (followed); `source("R/x.R")` -> allow.
  - The plugin's `method-safe-run -- Rscript -e 'source(f)'` -> allow.
  - Approved project: the unresolvable forms -> allow.
- **Verification:** New tests pass; existing launch-shape tests pass.

### U5. Docs and docstring

- **Goal:** R11.
- **Requirements:** R11.
- **Dependencies:** U1-U4.
- **Files:** `plugins/methodsmith/hooks/data-boundary-guard.py` (docstring), `README.md`, `plugins/methodsmith/README.md`, `docs/setup.md`.
- **Approach:** Update the coverage and Safe runner paragraphs and the Limits paragraph identically in the three docs: database MCP tools, temp-dir and in-progress handling with `--reconcile`, unresolvable sources, and the remaining limits from Scope Boundaries.
- **Test expectation:** none -- documentation; `tests/phi-environment-gate.test.ts` enforces identical sections and required phrases.
- **Verification:** `tests/phi-environment-gate.test.ts` and `tests/migration-docs.test.ts` pass.

---

## Verification Contract

| Gate | Command | Applies to |
|---|---|---|
| Dependencies | `bun install` | Before the first test run |
| Baseline | Record failing test names on the starting tree | Before edits |
| Tests | `bun test` | All units; no failures beyond the 9 known DOCX/number-registry failures on this machine |
| Types | `bun run typecheck` | All units |
| Release metadata | `bun run release:validate` | U5 |
| Eval cases | `bun run eval:validate` | All units |
| Rebrand residue | `bun run scripts/rebrand/rename.ts --check` | All units |

---

## Definition of Done

- Every deny scenario in U1-U4 that reproduces an open leak has a test that failed before the change and passes after it.
- Allow scenarios and latency checks pass before and after.
- All Verification Contract gates pass.
- The guard docstring and the three setup docs describe the new coverage and limits identically.
- No abandoned-attempt code or scratch fixtures remain in the diff.
