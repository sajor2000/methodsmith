---
name: method-grill
description: "Interviews the user one question at a time to stress-test a study's goal, hypothesis, data, analysis, and journal, recommending answers. Use when the user says grill me."
argument-hint: "[project idea, or path to a brief, research-question.yaml, draft SAP, or abstract]"
---

# Grill a Research Project

## Skill Value

- **Problem it solves:** Studies fail at review because the goal, hypothesis, data, analysis, and journal fit were never challenged together before the SAP was written.
- **Use when:** The user says grill me, or wants a study idea, hypothesis, or analysis plan stress-tested before planning or submission.
- **Output:** Standalone: `docs/brainstorms/<YYYY-MM-DD>-<slug>-grill.md` with decisions and risks. In planning integration: confirmed decisions and unresolved risks returned to `method-plan`.
- **Ask only if:** The answer is a decision only the researcher can make; look up every fact yourself first.
- **Do not do:** Do not write the SAP, run analyses, open patient-level data, or act on the decisions before the user confirms a shared understanding.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

## How the grill works

Treat the project as a **decision tree** with seven branches. Every decision unlocks the decisions that depend on it; the **frontier** is the set of open decisions whose prerequisites are already settled.

| Branch | The decision it forces |
|---|---|
| Goal | What decision, practice, or policy changes if the study succeeds, and for whom |
| Task and deliverable | What to produce, for whom, under which constraints, and how success will be judged |
| Hypothesis | The falsifiable question: population, exposure or intervention, comparator, outcome, time zero, and expected direction |
| Data | Whether this source can answer it: provenance, grain, access and approvals, coverage, missingness, and measurement validity |
| Proposed analysis | Design, estimand, confounding or causal assumptions, missing-data plan, multiplicity, sensitivity analyses, and sample size |
| Target journal | Scope fit, article type, reporting checklist, word and display limits, and data-sharing policy |
| Audience | Who must believe the result, what they already believe, and what a hostile reviewer will attack first |

Read `references/question-bank.md` for the probes, strong-answer criteria, and red flags for each branch.

## Evidence access

Before any literature lookup, read `references/evidence-access.md` (PubMed and Paperclip MCP tools, fallbacks, and evidence rules); never invent a citation, effect size, or guideline item.

- **Look up here:** the facts the interview must never ask the user for: prior studies on the hypothesis, published event rates, validated exposure and outcome definitions (with their PPV or sensitivity), and the target journal's recent similar papers (search with the journal name). Journal author guidelines (scope, article types, limits, required checklists) come from web search, not PubMed.

## Workflow

### Planning integration

When `method-plan` invokes this skill, use the decision tree and question bank for decisions that affect the requested plan. First establish the user's goal, task and deliverable, question or hypothesis when applicable, data, and proposed methods from existing evidence. Check settled choices for consequential weaknesses, not just missing fields; explain the specific concern before asking a decision-changing question. Do not re-ask settled choices without a reason. For descriptive or exploratory work, clarify the aim without requiring a directional hypothesis. Journal and audience questions are conditional on their relevance to the task.

Resolve the sensitive-data boundary as in standalone step 2 before data access; use schema-only when unset in non-interactive mode. Look up accessible facts within that boundary; ask the researcher only for decisions or facts unavailable to you. Ask one question at a time with a recommended answer and rationale, and recompute dependent questions after each answer. Stop when the planning-critical decisions are clear or the user stops. Summarize choices and risks, ask the user to confirm the shared understanding, then return confirmed choices and unresolved risks to `method-plan`. If the user stops, carry unconfirmed choices as gaps. Do not create a separate grill record or route back to `method-plan` as a new invocation. The user may request a standalone grill record separately. In non-interactive mode return unresolved choices as gaps without inventing answers.

When comparing methods, state how each changes the population, time zero, estimand, and assumptions where relevant. Do not treat a landmark design as interchangeable with a baseline target-trial strategy or promise that a method eliminates bias. Aligning eligibility and time zero alone does not resolve treatment assignment over a grace period. Until the drug, comparator, treatment window, and relevant data are known, recommend clarifying those decisions rather than selecting a specific causal estimator. If the facts do not support a responsible recommendation, explain the uncertainty and ask for the information needed rather than inventing one.

Preserve the outcome as stated: do not add all-cause, in-hospital, or other qualifiers unless supported or confirmed. An active comparator can improve comparability when clinically appropriate, but does not inherently reduce confounding; explain the assumptions and remaining confounding rather than promising an advantage.

### Standalone interview

1. **Gather facts before asking.** Read whatever exists: `analysis/research-question.yaml`, `docs/brainstorms/`, any SAP (`analysis/sap.md` or a file with `sap_version` frontmatter), `reports/data-qa/` or `analysis/data-qa-report.md`, and `.methodsmith/config.local.yaml`. Look up journal scope, article types, word limits, and required checklists from the journal's author guidelines with available search tools instead of asking. Look up literature facts (prior studies, event rates, validated definitions, the journal's recent similar papers) with the Evidence access tools above, reading each source before citing it. Use parallel subagents for independent lookups when the platform supports them. Never ask the user for something you can find.
2. **Sensitive-data boundary.** Resolve `phi_environment.mode` in `.methodsmith/config.local.yaml` (worktree, then main checkout; legacy `compliant: true` = `approved`, `compliant: false` = `schema-only`, `sensitive_data: false` = `no-sensitive-data`; any schema-only signal wins; unreadable = `schema-only`). `approved` or `no-sensitive-data`: proceed silently and never mention the boundary again. `schema-only`: headings, types, counts, and aggregates only; never open, print, or paste data values; run data-reading scripts as `method-safe-run -- <command>` (path in the guard's deny message); save results as aggregate tables (counts under 11 suppressed) in `output/` or a `phi_environment.aggregate_dirs` entry. Unset, interactive: ask once with the blocking question tool (else a numbered list) offering `Approved endpoint: full access`, `Not approved or unsure: schema-only`, and `No sensitive data: public or synthetic`; save the answer as `phi_environment.mode` there once `git check-ignore -q .methodsmith/config.local.yaml` passes (else first add `.methodsmith/*.local.yaml` to `.gitignore`) so the guard hook sees it. Unset, headless: schema-only. In `schema-only`, ask about data by schema, counts, and definitions, never for pasted rows.
3. **Ask the frontier, one question at a time.** Pick the frontier question whose answer would change the most downstream decisions. Ask it with the blocking question UI:
   - one line on why it matters;
   - up to 4 options, the recommended answer first and labeled "(Recommended)";
   - word the question so choosing the recommendation accepts it, and keep free-form answers welcome.

   Recompute the frontier after every answer. A question that depends on another open answer waits.
4. **Push on weak answers.** When an answer hits a red flag in the question bank, name the flag and ask the follow-up that resolves it, or record it as an open risk if the user accepts it.
5. **Stop when the frontier is empty**, every branch visited and nothing silently assumed, or when the user says stop. Summarize the decisions in five lines or fewer and ask the user to confirm the shared understanding before saving anything.
6. **Save the grill record** using `references/grill-record-template.md`, then name the next skill:

| Situation after the grill | Next skill |
|---|---|
| Hypothesis settled but not yet structured | `method-question` |
| Data fitness unproven | `method-data-qa` |
| Reporting checklist not yet chosen for the target journal | `method-checklist` |
| Effect size or sample size unresolved | `method-meta-analysis`, then `method-power` |
| Ready to write the plan | `method-plan` (SAP mode) |

## Rules

- One question per turn, always with a recommended answer and the reason it is recommended.
- Decisions belong to the user; facts belong to you. Cite each verified literature fact by PMID with the level read; mark any fact you could not verify as unverified rather than asking the user to guess (`unverified` is a record status, not an evidence label).
- Grill the plan, not the person: be direct about weaknesses, and name the specific reviewer objection each one invites.
- Do not invent effect sizes, sample sizes, journal policies, or citations. Leave the field open and record it as a risk.
