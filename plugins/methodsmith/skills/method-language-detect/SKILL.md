---
name: method-language-detect
description: "Detects R, Python, or mixed-language signals in repo files and emits a language handoff. Use when a skill needs language evidence or the user asks the repo's stack."
argument-hint: "[optional: --off]"
---

# Repository Language Detection


## Skill Value

- **Problem it solves:** Setup and workflow routing need repo evidence before asking users about language preference.
- **Use when:** Another skill needs language evidence, or the user asks what stack the repo appears to use.
- **Output:** __CE_LANG__ with primary, secondary, and source fields.
- **Ask only if:** No user question normally; detection is evidence-only.
- **Do not do:** Do not treat detection as final user preference when later IDE or explicit user choices narrow the stack.
- **Interaction:** No user question normally; proceed from the provided inputs and local evidence.

Detects whether the current repository is primarily `python`, `r`, `both`, or `unknown` using file-system and code-pattern signals only. Do not ask the user to choose a language in this skill. SAS/Stata signals do not become `primary` values; when they dominate, emit `primary=unknown` and recommend `method-sas-stata`.

## When this skill activates

- CLIF profile is active (`__CE_CLIF__ active=true`) and downstream skills need language-specific recipes
- `method-setup` is running and needs a language default without asking
- A task requires selecting Python vs R templates and the language is not obvious
- Manual invocation: `method-language-detect`

## Rule source

Read `references/detection-rules.md` and apply the scoring table exactly.

## Core workflow

### Step 1: Collect repository signals

Use repo signals only (files, directories, lockfiles, and source patterns). Do not prompt the user.

### Step 2: Score and classify

Apply the detection rules and produce:

- `primary`: `python` | `r` | `both` | `unknown`
- `secondary`: `python` | `r` | `null`
- `source`: `auto` (normal), `cached` (fallback when repo signals cannot be read), or `manual` (only when the user explicitly forced a language elsewhere)

### Step 3: Emit canonical handoff envelope

Always emit:

```
__CE_LANG__ primary=<python|r|both|unknown> secondary=<python|r|null> source=<auto|cached|manual>
```

Also print one concise banner:

```
[method-language-detect] primary=<...> secondary=<...> source=<...>
```

### Step 4: Fallback behavior

If no reliable signals are found:

- Use `primary=unknown secondary=null source=auto`.
- Resolve the repository root with `git rev-parse --show-toplevel`, read `<repo-root>/.methodsmith/config.local.yaml` with the native file-read tool, and fall back to the main checkout in a linked worktree. If `stack_profile.language` (written by `method-setup`) exists there, reuse it as `source=cached`; otherwise use `stack_profile.inference.language.value` when its confidence is `high`.
- Never ask the user a language question in this skill.

## Consumers

`method-setup`, `method-clif`, `method-cohort`, `method-data-qa`, `method-work`, and `method-plan` can consume `__CE_LANG__` to route language-specific defaults and references.

## References

@./references/detection-rules.md — Signal weights, thresholds, and tie-break rules
