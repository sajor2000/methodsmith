---
name: method-study
description: "Tracks study provenance and stale outputs. Use when onboarding or handing off a research study."
argument-hint: "[init|intake|status|verify|snapshot|handoff] [study root]"
---

# Collaborative Study Record

## Skill Value

- **Problem it solves:** Study artifacts drift from their producing code and scientific decisions.
- **Use when:** Onboarding a study or checking provenance and handoffs.
- **Output:** Protected study record, stale-evidence status and reviewed handoffs.
- **Ask only if:** A consequential decision or approved storage boundary is missing.
- **Do not do:** Do not infer historical execution, upload sensitive content or replace scientific approval.


Connect the physician investigator's question, biostatistician's design decisions and data scientist's code to inspectable evidence. Preserve the chosen Jupyter, marimo, R Markdown or Quarto format. Do not replace domain methods skills or claim clinical validity from a completed check.

## Establish authority and storage

Read the project instructions, approved data boundary and existing study decision record. Carry existing authorization forward; ask only for a missing consequential choice. Use the current harness's blocking question tool (`AskUserQuestion` in Claude Code, `request_user_input` in Codex, `AskUser` in Droid, `question` in OpenCode, or `ask_user` in Gemini and Pi) when available; otherwise present numbered options and wait. For Pi batch questions, put `context`, `options`, `allowMultiple`, and `allowFreeform` on each `questions` entry; do not also pass them at the top level. Never treat a pending answer as approval.

Use an explicitly approved protected local root. Default to `.methodsmith/study/` only if its project location is approved; otherwise select a protected root outside the checkout. Never put patient-level content in Dropbox, GitHub, ordinary logs or previews. A private repository is not an approved data store. Keep opaque IDs in shared summaries and review even these IDs for disclosure. Do not fall back to a different worktree's study record.

Read `references/record-contract.md` for the record, CLI and evidence contract. Before running helpers, locate this skill's directory and probe a working Python interpreter (`python3`, then `python`, then `py`). If none works, retain a manual inventory with unknown verification; do not pretend the validators ran.

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/study_record.py" --root "<approved protected study root>" --study-id "<opaque ID>" status
```

## Intake

1. Identify the question, pathway (observational, prediction/ML or existing-study revision), current plan and responsible humans. Foundation-model work uses the same protocol, compute-budget and provenance rules; this skill does not launch training.
2. Inventory selected artifacts without executing them or moving originals. Register each artifact with a stable ID, kind and explicitly declared dependencies. Reuse the existing number, figure and ML run registries as artifacts, not duplicate registries.
3. Mark historical provenance `verified`, `inferred` or `unknown` from supplied evidence. An existing file or Git commit does not prove execution, scientific approval or submission.
4. Designate one manuscript master: editable Word/Zotero or Quarto/R Markdown source. Keep original documents, exported copies and external coauthor edits distinguishable.
5. Show gaps and the next responsible role. Intake is complete when the selected inventory and unknowns are recorded; reproduction remains a separate task.

## Work and verify

Load `method-notebook-standards` for narrative and topology, then the relevant notebook/language skill. Explain purpose, assumptions, inputs and expected results before each material analytical step. Preserve notebook metadata and user-selected format; never force conversion.

Read `references/notebook-execution.md` when notebook execution has been explicitly authorized, before invoking `scripts/notebook_evidence.py` and before attaching a run with `record-run`.

Declare all material source/config/environment dependencies before calling coverage complete. Quarto freeze/cache and marimo caches do not establish freshness; external input changes require revalidation. A `refresh` accepts a new content digest but resets execution and approval, never marks the new result verified. Record successful execution only from a matching run record plus scientific/output checks. Keep data hashes and raw evidence protected.

Use `method-signoff` for named human scientific review. The study helper binds a recorded approval to current artifact and dependency evidence; a reviewer name is not authentication. Changes invalidate that binding. Do not label unrun analytical results approved merely because their file digest is current.

## Manuscript and submission handoff

Use `method-citations` to distinguish reference identity from claim support and preserve live Zotero fields. The helper's manuscript export is a byte-preserving copy, not format conversion; use the relevant renderer for conversions, register its source/output digests and reconcile external edits before replacing anything. Require actual Zotero application refresh evidence before claiming live-field compatibility.

Use `method-journal-select` and `method-submission-package` for dated journal instructions and packaging. Preserve an explicit protected snapshot before revision or journal transfer. Snapshots copy non-data artifacts, retain data digest references, and do not constitute submission or scientific approval. Verify that large data sources have retained immutable versions separately. Existing study baselines may remain unknown.

Load `method-revision` for stable reviewer/comment IDs, decisions, shared changes and evidence-bound responses. Never claim a proposed or merely implemented analysis was verified or prespecified.

## Share and explain

Use `status` after changes. Explain stale artifacts, incomplete dependency coverage and pending human decisions. For a shareable card, save status JSON in the protected root and run `scripts/share_study.py` after disclosure review. The helper emits only allowlisted statuses and opaque IDs, with a snapshot digest and freshness warning; it omits paths, output values and reviewer comments. Provide scientific rationale and dependency explanations from a separately reviewed narrative, never raw study data. Do not publish the card automatically.

Before Git operations, review exact staged bytes and newly exposed history using `references/sharing-checks.md`. Hooks differ by host; instructions are not runtime enforcement. Retain originals when preparing sanitized copies. No automatic history rewrite or upload.

## Completion

Report the study revision, covered artifacts, stale/unknown evidence, completed checks, unavailable checks and next named human decision. Distinguish automated verification, scientific interpretation and human signoff. No agent can grant institutional data authorization or manufacture historical evidence.
