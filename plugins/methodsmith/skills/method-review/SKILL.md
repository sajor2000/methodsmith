---
name: method-review
description: "Reviews data-science code changes with statistical, methods, PHI, and engineering personas and confidence-gated findings. Use when the user asks for code or PR review."
argument-hint: "[mode:agent] [blank to review current branch, or provide PR link]"
---

# Code Review

## Skill Value

- **Problem it solves:** Data science code review needs correctness, testing, reproducibility, SAP drift, PHI, methods, and platform checks in one pass.
- **Use when:** The user asks for code review, PR review, review before merge, or fixable findings on current changes.
- **Output:** Prioritized P0-P3 findings, applied safe fixes when allowed, residual work, and verification summary.
- **Ask only if:** Only in interactive mode when a routing decision materially changes whether to apply, defer, file, or ignore findings.
- **Do not do:** Do not invent findings without evidence, mutate in report-only mode, or merge/push without explicit workflow routing.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

## Mode Detection and Arguments

Strip recognized tokens from `$ARGUMENTS`; the remainder is the PR number, GitHub URL, or branch name.

| Token | Mode or effect |
|-------|----------------|
| (none) | **Interactive** (default): review, apply `safe_auto` fixes, present findings, ask policy decisions on gated/manual findings (once per decision point, via the Skill Value interaction rule), optionally continue to fix/push/PR |
| `mode:agent` | **Agent**: read-only JSON handoff, also written to `review.json` |
| `mode:autofix` | **Autofix**: `safe_auto` fixes with bounded re-review rounds; run artifact with residual work |
| `mode:report-only` | **Report-only**: read-only; report and stop |
| `mode:headless` | **Headless** (skill-to-skill): single-pass `safe_auto` fixes, structured text output, run artifact, ends with "Review complete". `mode:non-interactive` is its alias; normalize before conflict checks (both together are one mode) |
| `depth:auto` / `depth:full` | Default risk-aware roster (trivial low-risk code-only diffs may use the lite roster) / force the complete roster. They conflict only with each other |
| `base:<sha-or-ref>` | Skip scope detection; use this diff base directly |
| `plan:<path>` | Load this plan for requirements verification |

**Conflicting mode flags:** If multiple distinct mode tokens appear, stop without dispatching agents. In `mode:agent`, emit `{"status":"failed","reason":"conflicting mode flags"}`. If `mode:headless` is one of them, emit `Review failed (headless mode). Reason: conflicting mode flags — <mode_a> and <mode_b> cannot be combined.` Otherwise emit the generic form: `Review failed. Reason: conflicting mode flags — <mode_a> and <mode_b> cannot be combined.`

## Blinding-state awareness

Resolve the repository root before reading config:
!`git rev-parse --show-toplevel 2>/dev/null || true`

Read `<repo-root>/.methodsmith/config.local.yaml` with the native file-read tool (resolve the root at runtime if the line above is empty; in a linked worktree, fall back to the main checkout). When `stack_profile.blinding_state` is `blinded`, the diff is blinded EDA: skip `method-methods-reviewer` and `method-multiplicity-reviewer`, and emit a P0 finding "Inferential code on assignment variable during blinded EDA" if the diff runs regression, hypothesis-test, survival, or chi-square code on the assignment/treatment/arm variable.

## Non-interactive mode rules

These hold from Stage 1 on in agent, autofix, report-only, and headless modes; full per-mode policy is in `references/post-review.md` Step 2.

- **Skip all user questions.** Infer scope and intent conservatively from arguments, Git metadata, the diff, and caller context; record uncertainty in the output.
- **Headless requires a determinable diff scope.** Otherwise emit `Review failed (headless mode). Reason: no diff scope detected. Re-invoke with a branch name, PR number, or base:<ref>.` and stop without dispatching agents.
- **Mutation limits.** Agent and report-only modes never edit, fix, file tickets, or take PR actions (report-only also writes no artifacts). Autofix and headless apply only `safe_auto -> review-fixer` fixes, never file tickets, and never run alongside other mutating work on a shared checkout. No mode here commits, pushes, or creates a PR.

## Quick Review Short-Circuit

Interactive only: when the user asks for a quick, fast, or light review, announce the chosen path (Quick review vs Multi-agent review), then run the harness's built-in code review on any remaining target (Claude Code: `/review [target]`). Without one, continue here. Programmatic modes never short-circuit or announce.

## Severity Scale

- **P0:** critical breakage, exploitable vulnerability, data loss/corruption. Must fix before merge.
- **P1:** high-impact defect likely hit in normal usage, breaking contract. Should fix.
- **P2:** moderate downside (edge case, perf regression, maintainability trap). Fix if straightforward.
- **P3:** low-impact, narrow scope, minor improvement. User's discretion.

Routing (`autofix_class`, owner) is defined in `references/merge-findings.md`; only `safe_auto -> review-fixer` findings reach the in-skill fixer.

## Protected Artifacts

Discard any finding that recommends deleting, removing, or gitignoring these pipeline artifacts: `docs/brainstorms/*`, `docs/plans/*.md`, `docs/solutions/*.md`, and `analysis/model-strategy/*` (including `analysis/model-strategy/*-model-strategy.md` memos and their scaffolds).

## Evidence access

Reviewers citing a guideline item or methods paper read `references/evidence-access.md`. **Look up here:** reporting-guideline statements and methods references reviewers cite.

## PHI Safety Boundary

These rules govern every stage, sub-agent prompt, and artifact.

**PHI-safe scope preflight.** Before any command prints a path name, diff body, file content, notebook output, PR title, or PR body, complete in order:

1. **Classify the context** from already-available signals: the stack profile and CLIF signals (`__CE_CLIF__ active=true` in chat context, `CLIF_CLAUDE.md` at the root, or a git remote containing clif-icu, clif-consortium, or Common-Longitudinal-ICU-data-Format). Clinical, health-data, case-report, CLIF, or otherwise uncertain contexts are PHI-risk before path discovery.
2. **Capture paths privately.** For a clearly non-clinical context, write changed and untracked path names under `$REVIEW_SCOPE_DIR` (`references/scope.md`) without echoing them. Never print a raw basename before this decision because a filename can itself contain an identifier.
3. **Run a deterministic risk check** that returns only a risk boolean, counts, and extensions. Treat data files, codebooks, notebooks, manuscripts, figures, clinical notes, imaging, patient/MRN/case-like names, and any unclassified text file in a PHI-risk repository as PHI-risk. If local classification cannot establish a clearly non-PHI scope, treat it as PHI-risk.
4. **Resolve the authorization marker** when PHI risk is present. **Sensitive-data boundary.** Resolve `phi_environment.mode` in `.methodsmith/config.local.yaml` (worktree, then main checkout; legacy `compliant: true` = `approved`, `compliant: false` = `schema-only`, `sensitive_data: false` = `no-sensitive-data`; any schema-only signal wins; unreadable = `schema-only`). `approved` or `no-sensitive-data`: proceed silently and never mention the boundary again. `schema-only`: headings, types, counts, and aggregates only; never open, print, or paste data values; run data-reading scripts as `method-safe-run -- <command>` (path in the guard's deny message); save results as aggregate tables (counts under 11 suppressed) in `output/` or a `phi_environment.aggregate_dirs` entry. Unset, interactive: ask once with the blocking question tool (else a numbered list) offering `Approved endpoint: full access`, `Not approved or unsure: schema-only`, and `No sensitive data: public or synthetic`; save the answer as `phi_environment.mode` there once `git check-ignore -q .methodsmith/config.local.yaml` passes (else first add `.methodsmith/*.local.yaml` to `.gitignore`) so the guard hook sees it. Unset, headless: schema-only. Record exactly `PHI authorization: confirmed` for `approved` or `no-sensitive-data`, and `PHI authorization: not confirmed` for `schema-only`.

- With confirmed authorization, reviewers have no content limits; any reviewer that reads PHI-risk content must inherit the active session model with no model override.
- Without it, do not run a broad content diff or open PHI-risk files; scope to path names, metadata, and files established as code, schemas, or reviewed aggregates, and report excluded content as a coverage gap.

When no PHI risk is present, continue normally without asking.

**Safe display metadata.** After preflight, set `SAFE_BRANCH` and other display metadata to their raw values only when each value is established as PHI-free. Otherwise use an opaque label such as `[redacted-phi-risk-branch]`. All prompts, reports, and persistent run artifacts use the safe values; raw metadata never leaves `$REVIEW_SCOPE_DIR`.

**Reviewer access.** Pass `method-phi-leak-reviewer` the marker from Stage 1. With `PHI authorization: confirmed`, no reviewer has content limits. Without it: General
reviewer sub-agents may inspect only the preflight-approved paths and PHI-free orchestrator context, and their prompts must prohibit broad
checkout-reading commands (`git diff`, `git show`, `git blame`, `git log`, `gh pr view`); `method-phi-leak-reviewer` gets paths, code, schemas, metadata, and reviewed aggregates; Stage 5b validators inherit these limits.

## How to Run

Run the stages in order, reading each stage's references on entry.

### Stage 1: Determine scope

Read `references/scope.md` and follow its path for the invocation (`base:`, PR, branch, or standalone; the last two run `references/resolve-base.sh`). It captures path names privately in `$REVIEW_SCOPE_DIR`, never printing them.

- If `mode:agent`, `mode:report-only`, or `mode:headless` is active, do **not** run `gh pr checkout` or `git checkout <branch>` on the shared checkout; unless already in an isolated checkout/worktree, emit that mode's stop message from `references/scope.md`.
- Apply the PHI-safe scope preflight before reading any captured path, title, or body; then collect `git diff -U10 $BASE` only for the permitted paths.
- Fail closed: when the base cannot be resolved, stop instead of falling back to `git diff HEAD`.

### Stage 2: Intent and plan discovery

Read `references/intent-and-plan.md`: write the reviewer intent summary (one intent question only in interactive mode) and locate a plan tagged `plan_source: explicit` or `inferred`. A missing plan never blocks the review.

### Stage 3: Select reviewers

Read `references/select-reviewers.md` (authoritative roster, standards mapping, fail-closed lite-roster gate) and `references/persona-catalog.md` (reviewer focus). Pass reviewers the resolved skill-local paths the roster names: `references/study-metadata-schema.md`, `references/guideline-registry.yaml`, `references/guideline-routing.md`, and the selected checklist files. Announce the team; do not wait for confirmation.

### Stage 4: Spawn sub-agents

Read `references/dispatch-reviewers.md`, `references/subagent-template.md` (slot sources in `references/subagent-template-variables.md`), `references/diff-scope.md`, and `references/findings-schema.json`. Dispatch every selected reviewer in parallel with the platform's sub-agent primitive (`Agent`/`Task` in Claude Code, `spawn_agent` in Codex), or sequentially if parallel dispatch is unsupported. Omit the `mode` parameter. Reviewers are read-only; their only permitted write is their artifact under `/tmp/methodsmith/method-review/<run-id>/`.

### Stage 5: Merge findings

Read `references/merge-findings.md` (Action Routing and Stage 5): validate, deduplicate, promote agreement, route conservatively, demote, then suppress findings below anchor 75 except P0 findings at anchor 50+, and partition into fixer, residual actionable, and report-only queues.

### Stage 5b: Validation pass

Run one independent validator per surviving finding (budget: 15) using `references/merge-findings.md` (Stage 5b) and `references/validator-template.md`, only where this table says so:

| Mode | Runs Stage 5b? | Where |
|------|---------------|-------|
| `agent` | Yes, eagerly and read-only | Before Stage 6 |
| `headless` | Yes, eagerly | Before Stage 6 |
| `autofix` | Yes, eagerly | Before Stage 6 |
| `interactive`, walk-through routing (option A) — per-finding phase | No -- the user is the per-finding validator | n/a |
| `interactive`, walk-through routing (option A) — best-judgment-the-rest handoff | No -- the fixer's outcome validates | n/a |
| `interactive`, best-judgment routing (option B) | No -- the fixer's outcome validates | n/a |
| `interactive`, File-tickets routing (option C) | Yes, on all pending findings | Before tracker dispatch |
| `interactive`, Report-only routing (option D) | No -- nothing is being externalized | n/a |
| `report-only` | No -- read-only mode externalizes nothing | n/a |

### Stage 6: Synthesize and present

Read `references/synthesis-and-output.md` and `references/review-output-template.md`, apply their quality gates, and render: pipe-delimited severity tables (interactive, autofix, report-only), the structured text envelope (headless), or only the JSON contract below (`mode:agent`). No time estimates.

### JSON output format (`mode:agent` only)

Emit one raw JSON object as the entire response, without a markdown fence or trailing prose. Write the identical payload to `/tmp/methodsmith/method-review/<run-id>/review.json`.

Minimum shape:

```json
{
  "status": "complete",
  "verdict": "Ready to merge | Ready with fixes | Not ready",
  "scope": {"base": "<merge-base sha, pr:NNN marker, or base ref>", "branch": "<SAFE_BRANCH>",
            "head_sha": "<git rev-parse HEAD>", "pr_url": null, "files_changed": 0},
  "intent": "<summary>",
  "intent_confidence": "explicit | inferred | uncertain",
  "reviewers": [], "findings": [], "actionable_findings": [], "pre_existing_findings": [],
  "requirements_completeness": null, "learnings": [], "deployment_notes": [],
  "residual_risks": [], "testing_gaps": [], "coverage": {},
  "artifact_path": "/tmp/methodsmith/method-review/<run-id>/",
  "run_id": "<run-id>"
}
```

Each `findings` object carries stable `#`, title, severity, file, line, confidence, autofix_class, owner, requires_verification, pre_existing, suggested_fix, why_it_matters, evidence, and reviewers. `actionable_findings` is the `gated_auto` or `manual` subset owned by `downstream-resolver`. Agent mode never includes applied fixes because it never mutates. On failure return `{"status":"failed","reason":"<one sentence>"}`; use `degraded` when all reviewers fail and `skipped` when a review skip rule fires.

## After Review

- **Interactive, autofix, and headless modes:** read `references/post-review.md` and follow Steps 1-5. Interactive routing also reads, when each path is taken, `references/tracker-defer.md` (tracker pre-detection, option C, and Defer), `references/walkthrough.md` (option A and the unified completion report), and `references/bulk-preview.md` (option C preview).
- **Agent mode:** perform no fixes, tickets, commits, pushes, PRs, or checkout switches. Write `review.json` plus the Step 4 run artifact from `references/post-review.md` (synthesized findings and `metadata.json` with `SAFE_BRANCH`), then emit nothing after the single JSON object.
- **Report-only mode:** stop after Stage 6. Do not write run artifacts.

Never commit, push, or create a PR outside interactive mode's Step 5, and only after fixes were applied in this run.
