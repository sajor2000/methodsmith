---
name: method-work
description: "Executes a data-science implementation or analysis plan with task tracking, tests, SAP traceability, and a real-data gate. Use when the user asks to execute a plan."
argument-hint: "[Plan doc path or description of work. Blank to auto use latest plan doc]"
---

# Work Execution Command


## Skill Value

- **Problem it solves:** Plans need disciplined execution that respects scope, tests behavior, and finishes complete work.
- **Use when:** The user asks to work, implement, execute a plan, or continue from the latest plan document.
- **Output:** Implemented changes, passing validation, updated task status, and shipping-ready summary.
- **Ask only if:** Only when plan scope, branch choice, or execution-blocking ambiguity cannot be resolved from the plan and repo, when the sensitive-data boundary is unset in interactive mode, or at the shipping residual-work gate.
- **Do not do:** Do not edit plan progress state, skip tests for behavior changes, or commit to default branch without permission.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

## Stack Profile

The repository root is pre-resolved at skill load:
!`git rev-parse --show-toplevel 2>/dev/null || true`

Use it as `<repo-root>` if absolute, else run `git rev-parse --show-toplevel`. Read `<repo-root>/.methodsmith/config.local.yaml` with the native file-read tool (in a linked worktree without it, try the main checkout from the absolute common Git directory). Parse `language`, `ide`, `libraries`, and `notebook_format` to drive `references/scaffolding-templates.md` (without config, infer the stack from project files), and `phi_environment` for the boundary gate below; do not open data files before that gate.

## Input Document

<input_document> #$ARGUMENTS </input_document>

## Phase 0: Input Triage

**Parse a leading mode token first.** If `<input_document>` begins with `mode:return-to-caller` (or legacy aliases `mode:caller-owned-tail` / `caller:lfg`), strip it; the remainder must be a plan path. A mode token without a following path is an error, not a bare prompt. The run is now in **Return-to-Caller Mode** (see that section).

**Plan document** (a file path) → Phase 1.

**Bare prompt:** scan files likely to change, their tests, and local conventions, then route:

| Complexity | Signals | Action |
|-----------|---------|--------|
| **Trivial** | 1-2 files, no behavioral change | Phase 1 step 2, then implement directly; no task list |
| **Small / Medium** | Clear scope, under ~10 files | Build a task list from discovery; Phase 1 step 2 |
| **Large** | Cross-cutting, 10+ files, auth/payments/migrations | Recommend `method-brainstorm` or `method-plan`; if the user proceeds, build a task list; Phase 1 step 2 |

## Phase 1: Quick Start

### 1. Read Plan and Clarify _(skip for bare prompts)_

- Read the plan completely as a decision artifact, not an execution script. Note each unit's `Execution note`, deferred implementation-time questions, and `Scope Boundaries` (non-goals).
- If the plan creates or materially extends a Marimo, Jupyter, R Markdown, or Quarto notebook, load the `method-notebook-standards` skill before creating executable cells or chunks.
- If the user explicitly asks for TDD, test-first, or characterization-first execution in this session, honor it even without an `Execution note`. For TDD, first agree the public behavior and seam under test; do not test private implementation details or unconfirmed internal boundaries.
- Ask clarifying questions now if anything is ambiguous; otherwise proceed without renegotiating scope.
- **Do not edit the plan body during execution.** Progress lives in commits and the task tracker; the only plan mutation is the `status: active → completed` flip at shipping. Ignore legacy `- [ ]` marks; derive completion from current file state.

**Discovery gates** (before building tasks):

- **SAP discovery:** search for `**/sap.md` or any markdown file with `sap_version` in its YAML frontmatter. If found, read `references/sap-tracking.md` and display its SAP coverage summary before creating tasks; otherwise skip SAP tracking.
- **Data QA gate before coding/modeling:** If a SAP file is found, inspect it for `<!-- GAP: missing method-data-qa column profile` or any missing data-profile/QA prerequisite. If present, stop execution and route to the `method-data-qa` skill before opening `method-sprint`, scaffolding code, or running models. Otherwise still require a `reports/data-qa/*.md`, `analysis/data-qa-report.md`, `__CE_DATA_PROFILE__`, or `__CE_DATA_QA__` signal before any task that reads data, fits models, generates tables/figures, or computes study results. If no data exists yet, restrict work to data acquisition/profile tasks and refuse modeling until QA evidence exists.
- **Real-data execution gate:** Before any notebook, script, or interactive run that reads, creates, transforms, validates, or renders analytical data or output, resolve the declared restricted data root for file-backed data (or the registered verified data connection) and confirm its provenance against the QA evidence. Do not generate or substitute synthetic, mock, sample, or fake-study data unless the user explicitly requests a clearly labeled test or demonstration. If the real source is unavailable or provenance cannot be confirmed, do not run the analytical work and do not persist output; report the run as blocked. Persisted study artifacts must identify their real source location or registered extract ID/hash and the validation evidence used. An explicitly requested synthetic test/demo may persist only as a clearly labeled non-study artifact with synthetic fixture or generator provenance, never in a study-output location or as a study result.
- **Tabular catalog / open sprint:** if `analysis/sap-tables/02-outputs.csv` or `analysis/sprint-log.yaml` exists, read `references/catalog-and-sprint-scope.md` (catalog rows seed tasks; an open sprint's `scope` hard-filters edits and tasks).
- **CLIF discovery:** activate when chat context contains `__CE_CLIF__ active=true` or the repo has strong CLIF signals (`CLIF_CLAUDE.md` at root, or a git remote containing `clif-icu`, `clif-consortium`, or `Common-Longitudinal-ICU-data-Format`; never from `mCIDE/` or `WORKFLOW.md` alone). When active, read `references/clif-guardrails.md` (protected paths need `POC: @<handle> approved`; load the `method-language-detect` skill when `__CE_LANG__` is absent). Print one banner before the task list: `[method-clif] CLIF profile active; protected paths read-only without POC sign-off.`
- **Sensitive-data boundary (all projects):** before opening data files or patient-level outputs, read `references/phi-environment.md` and apply its gate. Never commit patient-level data to Git.

### 2. Setup Environment

Determine the current and default branch (`git branch --show-current`; `git symbolic-ref refs/remotes/origin/HEAD`, else `main`/`master`).

- **On a feature branch:** if the name is opaque or auto-generated, recommend `git branch -m <meaningful-name>`. Ask whether to continue on it or create a new branch.
- **On the default branch:** offer (A) a new meaningful branch (`git pull`, then `git checkout -b <type>/<name>`), (B) a worktree via the `method-worktree` skill, or (C) the default branch — only after the user explicitly says "yes, commit to [default_branch]". Never commit directly to the default branch without explicit permission.

### 3. Create Task List _(skip if Phase 0 built one or routed Trivial)_

Use the platform's task tracker (`TaskCreate`/`TaskUpdate`/`TaskList` in Claude Code, `update_plan` in Codex). Derive tasks from units, dependencies, files, and test targets; prefix subjects with the U-ID ("U3: Add parser coverage"). Carry each unit's `Execution note`, read its `Patterns to follow` before implementing, and use its `Verification` as the done signal.

### 4. Choose Execution Strategy

| Strategy | When to use |
|----------|-------------|
| **Inline** | 1-2 small tasks or user interaction mid-flight; default for bare prompts |
| **Serial subagents** | 3+ dependent tasks with plan-unit metadata; fresh context per unit |
| **Parallel subagents** | 3+ tasks that pass the Parallel Safety Check; dependent units run after prerequisites |

**Parallel Safety Check** — required before parallel dispatch:

1. Map every candidate unit's `Files:` (Create, Modify, Test) to units.
2. Any path in 2+ units is overlap.
3. Check semantic dependencies beyond paths — shared contracts, generated artifacts, lockfiles, runtime resources — and serialize contending units; isolation prevents write races, not contract conflicts.
4. **SAP-section ownership check** (only when a SAP was discovered): map SAP-N.M references in each unit's `Approach:` and `Files:`. Each SAP section must be owned by exactly one unit per batch; otherwise downgrade to serial and log why.
5. Parallelize the remaining independent units and log any safe file overlap.

Give each parallel subagent its own worktree when the platform supports it. Dispatch with the intended base commit SHA; before editing, the worker verifies its `HEAD` equals that SHA and stops on mismatch. Run a unit that depends on uncommitted state inline or serially in the shared checkout, or commit its prerequisite first and dispatch from that verified commit; never send it to an isolated stale snapshot.

For serial or parallel subagents, read `references/subagent-execution.md` for dispatch payloads, isolation, permission mode, and post-unit/post-batch review, merge, and commit steps.

## Phase 2: Execute

### 1. Task Execution Loop

For each task in priority order: mark it in-progress, read referenced files and similar code, find existing tests, implement following conventions, update tests, run them, mark it complete, and evaluate an incremental commit.

- If any part depends on out-of-repo state (console setting, DNS record, CMS object, live-system row), it has no git-derived completion signal; decide completion from the observed deliverable state.
- If a repository-derived unit's work already exists and meets its Verification, verify, mark complete, and do not reimplement.
- If behavior changed and no tests were added, the exception must be deliberate.
- Honor each `Execution note`: test-first writes the failing test first; characterization-first captures existing behavior before changing it.

Guardrails for execution posture:
- For a test-first unit, name the public behavior and test seam before writing the first test. If the seam is unclear, resolve it with the user or the plan rather than testing internals by default.
- Work in vertical slices: one failing behavior test, the minimal implementation that makes it pass, then the next behavior slice. Verify each new test fails first; never batch all tests before implementation or over-implement.
- Skip test-first discipline for trivial renames, pure configuration, pure styling work, and analytical workflows unless the user or plan explicitly requests it

**Fail-loud analytical execution:** For generated analytical transformations, do not swallow exceptions with bare catch-all handlers, do not invent fallback data, do not silently coerce values, and do not replace failed inputs with synthetic data. Synthetic data are allowed only when the user explicitly requests a clearly labeled test or demonstration; never produce a synthetic study result. Assert validation at critical input, join, transformation, and output boundaries; surface failures for diagnosis rather than masking them, without expanding the requested analysis scope. When a required statistical or test library is missing, stop and report it; do not hand-roll estimators or stand in for the test runner.

**Test Discovery:** find tests that import, reference, or share a name with each changed file, starting from plan-specified tests. Add, update, or remove tests to match new, changed, or deleted behavior.

**Test checks:** before writing tests for the first feature-bearing unit, read `references/testing-checks.md` and apply its Test Scenario Completeness and System-Wide Test Check to every feature-bearing unit.

### 2. Incremental Commits

Commit when a logical unit is complete and tests pass, or before a context switch or risky change; never commit failing tests or anything needing a "WIP" message. Stage only the unit's files (never `git add .`) with a conventional message from the unit's Goal and no attribution footer (the shipping commit/PR carries it). In parallel mode, commit ownership follows `references/subagent-execution.md`.

### 3. Patterns, Testing, and Progress

- Match plan-referenced patterns and naming; reuse existing components; follow the project's AGENTS.md (or CLAUDE.md shim). Test after each significant change and fix failures immediately.
- **Simplify as you go** (skip in Return-to-Caller Mode): every 2-3 related units, consolidate duplication and shared helpers (use `/simplify` if available).
- Keep the task list current, add tasks if scope expands, and report milestones. Cite the plan's U-IDs and R/A/F/AE IDs in blockers, deferred-work notes, and final verification; never invent IDs.

## Phase 3-4: Quality Check and Ship It

If Return-to-Caller Mode is active, skip this phase and use the Return-to-Caller contract below.

Before shipping, review changed files proportionally: remove accidental duplication, confirm every plan requirement remains in scope, and route material behavioral or safety changes through `method-review` (no tangential cleanup). Then read `references/shipping-workflow.md` for quality checks, code review, final validation, PR creation, and notification. For R projects needing CI set up or repaired, also read `references/r-ci-patterns.md`.

## Return-to-Caller Mode

`mode:return-to-caller <plan-path>` is for an orchestrator that owns simplification, code review, PR creation, and CI watching. Implement and locally verify only; do not run the standalone shipping tail or emit a manual-paste workflow prompt.

Return one structured envelope containing:

- `status`: `complete`, `blocked`, or `failed`
- `plan_path`
- `changed_files`
- `u_ids_attempted`
- `u_ids_completed`
- `verification_results`
- `verification_evidence`: one entry per attempted behavior-bearing unit, plus any non-behavioral unit where tests were intentionally skipped; include whether behavior changed, existing tests inspected, tests added or changed, unchanged tests used, red failure or characterization observed when applicable, commands/results, and any exception reason
- `blockers`
- `behavior_change`
- `standalone_shipping_skipped: true`

Return `status: complete` only when behavior-bearing work has verification evidence or a deliberate exception. For subagent work, assemble evidence from each worker's return instead of reconstructing red-before-implementation observations from the final diff. On a repeated invocation, inspect existing work and complete missing evidence without reimplementing completed units.

## Pitfalls

- Finish every task; do not stop at 80%.
- Do not re-scope the plan into human-time phases, estimate hours, or ask the user to pick units for "this session"; use subagents for context pressure. If a plan is genuinely too large, say so and suggest `method-plan` to reduce scope.
