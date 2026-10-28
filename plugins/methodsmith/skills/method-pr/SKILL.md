---
name: method-pr
description: "Commits, pushes, and opens or updates a pull request with a value-first body, keeping data and PHI out. Use when the user asks to ship or open a PR."
---

# Git Commit, Push, and PR


## Skill Value

- **Problem it solves:** Shipping needs a clean commit, pushed branch, and PR body that explains value rather than restating the diff.
- **Use when:** The user asks to commit and PR, push and open PR, ship this, create a PR, or refresh a PR description.
- **Output:** A pushed branch and open or updated PR, or a PR description when requested description-only.
- **Ask only if:** Only when applying a PR description update, capturing evidence, or resolving branch/PR ambiguity requires user choice.
- **Do not do:** Do not push default branches, fabricate evidence, or overwrite an existing PR body without confirmation when required.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

Go from working changes to an open pull request, rewrite an existing PR description, or generate a description without touching git state. Every user-facing question below follows the Skill Value interaction rule.

## Mode detection

Pick one path; default to the full workflow.

- **Description-only.** The user wants *just* a PR description, with no commit or push intent ("write a PR description", "describe this PR", or a pasted PR URL/number alone). Skip Step 1's decision tree and Steps 3-5. Gather only the Context needed to resolve the range, then go to Step 6. Pass a pasted PR ref to Step 6 so Pre-A resolves that PR's range. Print the result; apply with `gh pr edit` or `gh pr create` only if the user asks.
- **Description update.** The user wants to update, refresh, or rewrite an existing PR description, with no mention of committing or pushing. Read `references/description-update.md` and follow it, using `references/pr-description-writing.md` at its DU-3 step. Note any focus the user gives (for example, "add the sensitivity-analysis results") for DU-3.
- **Full workflow.** Otherwise, follow the Full workflow.

## Context

Gather context at runtime. Run each command below as its **own** shell call (program and arguments only), in order; the PR check needs the branch name. Do not join commands with `;`, `&&`, `||`, pipes, `$(...)`, or redirects such as `2>/dev/null`: that syntax fails under some shells. Read each exit status directly. A non-zero exit is a state to interpret, not a failure to suppress.

| Command | Purpose | Non-zero exit / empty output means |
| --- | --- | --- |
| `git rev-parse --show-toplevel` | Repo root | Not a git repository: report and stop |
| `git status` | Working-tree state | (fails only outside a repo) |
| `git diff HEAD` | Uncommitted changes | Unborn repo (no commits yet): every file is new; rely on `git status` |
| `git branch --show-current` | Current branch `<branch>` | Empty output = detached HEAD |
| `git log --oneline -10` | Recent commit and title style | Unborn repo: no history to match |
| `git rev-parse --abbrev-ref origin/HEAD` | Remote default branch | No `origin/HEAD` (it may still print `origin/HEAD`; ignore that output): resolve in Step 1 |
| `gh pr list --head <branch> --state open --json number,url,title,state,headRefName,headRepositoryOwner` | Open PR for this branch | See "PR check rules" |

### PR check rules

- **Exit 0 with `[]`** is the only result that means "no open PR".
- **Non-zero exit** means `gh` is missing, unauthenticated, or offline: PR state is **unknown**, never "no PR". Run `gh auth status` and re-run the check once auth or connectivity is fixed. Never create a PR while state is unknown; if it stays unknown, stop before Step 7 and report it.
- **Detached HEAD (empty `<branch>`):** skip the check. `gh pr list` with an empty `--head` drops the filter and lists unrelated PRs. Run it after a branch exists.
- **Branch name only.** Never pass `<owner>:<branch>`; `--head` does not accept it and silently returns `[]`, which opens a duplicate PR. On a fork checkout, target the base repo with `-R <base-owner>/<repo>`.
- **Non-empty result:** do not take index 0. Select the entry whose `headRefName` and `headRepositoryOwner` match the head this workflow pushes. If several entries share the branch name from different owners and none is confirmed as the current head, stop and show the candidates.

**Snapshot rule.** Context output is a hint, not ground truth. Re-run `git branch --show-current` immediately before committing (Step 4) and pushing (Step 5), and re-run the PR check immediately before `gh pr create` (Step 7).

## Writing the PR body file

Whenever this skill applies a body, write it to a temp file and pass `--body-file <path>`. Never use `--body-file -`, stdin pipes, heredoc-to-stdin, or `--body "$(cat ...)"`: wrappers and stdin handling can silently produce an empty PR body while `gh` still exits 0 and returns a URL.

```bash
BODY_FILE=$(mktemp "${TMPDIR:-/tmp}/method-pr-body.XXXXXX") && cat >> "$BODY_FILE" <<'__CE_PR_BODY_END__'
<the composed body markdown goes here, verbatim>
__CE_PR_BODY_END__
```

- Append with `>>`; a truncating `>` fails under zsh `noclobber` and leaves the body empty. Keep the sentinel quoted.
- Substitute `<TITLE>` verbatim in `gh` commands; if it contains `"`, `` ` ``, `$`, or `\`, escape them or switch to single quotes.

---

## Full workflow

### Step 1: Resolve branch and state

Run every Context command.

**Default branch:** strip a leading `origin/` from the `origin/HEAD` result. If that command exited non-zero or returned bare `HEAD`, run `gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'`. If both fail, use `main`. Compare bare names only.

**Detached HEAD:** a branch is required. Ask whether to create a feature branch now. If yes, derive a name from the change content, run `git checkout -b <branch-name>`, re-read `git branch --show-current`, then run the PR check. If no, stop.

**Clean working tree** (no staged, modified, or untracked files): determine whether there is unpushed work.

1. Run `git rev-parse --abbrev-ref --symbolic-full-name "@{u}"`. Non-zero means no upstream.
2. If an upstream exists, run `git log <upstream>..HEAD --oneline` for unpushed commits.

Decision tree:

- **Default branch with work** (uncommitted, unpushed, or no upstream): create a feature branch in Step 4 without asking; pushing the default branch is not an option here.
- **Default branch, all pushed:** report that there is no feature-branch work and stop.
- **Feature branch, no upstream or unpushed commits:** skip Step 4; continue from Step 5.
- **Feature branch, all pushed, no open PR (exit 0 `[]`):** skip Steps 4-5; continue from Step 6.
- **Feature branch, all pushed, open PR:** report that the PR is up to date and stop.
- **Feature branch, all pushed, PR state unknown:** resolve per "PR check rules"; if still unknown, stop and report.

### Step 2: Determine conventions

For commit messages and PR titles, in priority order:

1. **Repo conventions in context:** follow loaded project instructions. Do not re-read them.
2. **Recent history:** match the pattern in the last 10 commits.
3. **Default:** conventional commits, `type(scope): description`.

Choose the type by intent. Where `fix:` and `feat:` both fit, default to `fix:`: remedying broken or missing behavior is `fix:` even when it adds code. Reserve `feat:` for capabilities the user could not previously accomplish. Other types (`chore:`, `refactor:`, `docs:`, `perf:`, `test:`, `ci:`, `build:`, `style:`) remain primary when they fit better. The user may override.

Commit subjects are imperative and name the outcome (what is now possible or fixed), not the file list.

### Step 3: Route on the PR check

- **Matching open PR:** existing-PR flow. Run Steps 4-5 (commit pending work and push), then go to Step 7, which asks whether to rewrite the description. Run Step 6 only if the user confirms the rewrite.
- **Exit 0 `[]`:** new-PR flow. Run Steps 4 through 8 in order.
- **Unknown (non-zero):** committing and pushing are still safe. Run Steps 4-6, but Step 7 must re-check before creating anything.

### Step 4: Branch, stage, and commit

1. **Default branch:** read `references/branch-creation.md` and follow its decision flow. It handles a stale local base, unpushed commits on the local base, and branch switches that would overwrite uncommitted or gitignored files (raw data, PHI extracts). Then re-run the PR check for the new branch.
2. **Data, PHI, and large-output check.** Review every file named for a commit. Leave out, and report as left out: patient-level or raw data files (`.csv`, `.tsv`, `.parquet`, `.feather`, `.rds`, `.RData`, `.sas7bdat`, `.dta`, `.sav`, `.xlsx`, and similar) unless clearly synthetic fixtures or aggregate outputs the repo already tracks; anything that may hold PHI or identifiers, credentials, or `.env` files; large or regenerable outputs (model objects, caches, untracked rendered reports, files over roughly 50 MB). Never `git add -f` an ignored path. If the user explicitly asks to commit such a file, confirm it is synthetic or de-identified first.
3. **Group.** If files clearly split into separate logical changes, make separate commits (2-3 max). Group at the file level only (no `git add -p`). When ambiguous, make one commit.
4. **Re-read the branch.** Run `git branch --show-current` immediately before committing. If it is empty, the default branch, or not the branch resolved above, stop and re-resolve per Step 1.
5. **Commit.** Commit each named group through a temporary index so the user's real index remains untouched until success. Copy a named file's existing staged snapshot when present; otherwise add its working-tree content only to the temporary index. Avoid `git add -A`, `git add .`, shell interpolation, and pathspec commits. Write the message to a file outside the repository with the file-write tool, then run the bundled script once per group:
   ```bash
   SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
   if [ ! -f "$SKILL_DIR/scripts/commit-group.sh" ]; then echo "method-pr: scripts/commit-group.sh not found under SKILL_DIR=$SKILL_DIR" >&2; exit 1; fi;
   bash "$SKILL_DIR/scripts/commit-group.sh" <message-file> file1 file2 file3
   ```
   The script copies each file's staged snapshot when present (otherwise its working-tree content), commits the temporary index with `git commit -F`, then aligns only the committed paths in the real index with the new `HEAD`. It handles unborn repos and exits non-zero, leaving the real index untouched, if any step fails; stop and report the error.

### Step 5: Push

**Project publishing gate.** Before pushing, discover any additional path-scoped instructions governing the committed files, then satisfy every applicable pre-push or review-ready requirement from those and the project's active instructions for the exact final commit state. If required evidence is missing or failing, keep the local commit, stop before the external write, and report it.

Then run `git branch --show-current` immediately before pushing. Push only when it is a non-empty feature branch, not the default branch. Push the live `HEAD` so a stale branch name from Context cannot be pushed:

```bash
git push -u origin HEAD
```

### Step 6: Generate the PR title and body

The PR description must cover **all commits** in the PR, not just the working-tree diff from Step 1.

Read `references/pr-description-writing.md` once now and walk it in order (Pre-A through H), with one interruption for the evidence decision below. Do not re-read it later.

**Resolve the range.** Run Pre-A: current-branch mode by default; PR mode with the matching PR URL from the PR check, or with a PR ref passed in from description-only mode. Use Pre-A's commit list and diff (not Step 1's working-tree diff or `git log -10`) for everything that follows.

**Evidence decision (before composition).** Read `references/evidence-decision.md` and follow it. Capture uses the core Compound Engineering `ce-demo-reel` skill only when installed; do not pretend methodsmith ships its own demo-capture skill. Never put PHI, patient-level rows, or small cells in captured evidence.

**Compose.** Continue with Steps A through H (classification, evidence, narrative, sizing, writing principles, visuals, title, body with the Methodsmith badge, compression). For an existing PR, Pre-A already read the current body.

### Step 7: Create or update the PR

Write the body file per "Writing the PR body file".

#### New PR (no matching PR from Step 3, or state unknown)

Immediately before creating, re-run the PR check (`gh pr list --head <branch> --state open --json number,url,title,state,headRefName,headRepositoryOwner`, branch name only; `-R` on a fork):

- **Matching entry:** a PR appeared or was missed; switch to the existing-PR path below.
- **Non-zero exit:** stop. Do not create a PR. Report that PR state is unknown and what `gh auth status` showed; the commits are already pushed.
- **Exit 0 with `[]`:** create it:

```bash
gh pr create --title "<TITLE>" --body-file "$BODY_FILE"
```

Keep the title under 72 characters.

#### Existing PR

The new commits are already on the PR from Step 5. Report the PR URL, then ask whether to rewrite the description.

- **No:** skip Step 6 and finish. Do not run composition or evidence capture.
- **Yes:** do these three actions in order without stopping between them:
  1. Run Step 6 to compose the new title and body.
  2. **Preview and confirm.** Ask: "New title: `<title>` (`<N>` chars). Summary leads with: `<first two sentences>`. Total body: `<L>` lines. Apply?" If declined, the user may pass focus text back for a regenerate; do not apply.
  3. If confirmed, write the body file and apply:

     ```bash
     gh pr edit <PR-URL> --title "<TITLE>" --body-file "$BODY_FILE"
     ```

### Step 8: Report

Output the PR URL, plus any files left out in Step 4 and any unverified base freshness from `references/branch-creation.md`.

## Study disclosure gate

When a study record is active, load `method-study` and run its Git disclosure workflow before staging/publishing study artifacts. Review exact staged bytes and all newly exposed history against the actual destination ref, including notebook outputs, attachments, document metadata and paths. Require a matching reviewed inventory immediately before the operation; changes invalidate it. Preserve unrelated staged changes and protected originals. No scanner, ignore file or private repository alone establishes absence of sensitive data; unknown classification blocks disclosure. Do not rewrite history automatically.
