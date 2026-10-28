---
name: method-plan
description: "Creates the durable plan for data-science work: an implementation plan or, for studies, a statistical analysis plan (SAP). Use when the user asks to plan work or write a SAP."
argument-hint: "[optional: feature description, study design doc, requirements doc path, plan path to deepen, or any task to plan] [output:html]"
---

# Create Plan (Dual-Mode: SAP or Implementation)

## Skill Value

- **Problem it solves:** Execution fails when scope, decisions, dependencies, tests, or SAP assumptions are not explicit before work starts.
- **Use when:** The user asks to plan a feature, analysis, SAP, study, implementation, or to deepen an existing plan.
- **Output:** A durable plan under docs/plans/ or a versioned SAP (default analysis/sap.md) with stable requirements and implementation/SAP identifiers.
- **Ask only if:** Only when planning-critical scope, mode, source document, or decision points cannot be inferred from input and repo context.
- **Do not do:** Do not implement code, run analysis, or treat execution-time unknowns as settled.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

**Resolve the current year at runtime** (`date +%Y`); use it when dating plans and searching for recent documentation.

`method-brainstorm` defines **WHAT**; `method-plan` defines **HOW** (SAP or implementation plan); `method-work` executes. A prior brainstorm is never required.

`method-plan` owns the canonical versioned SAP. For complex clinical, validation, benchmarking, or observational studies, load `method-sap` to develop the claim-to-dataset schema and decision evidence inside that SAP; do not create a second competing plan. Use `method-model-choice` after data QA when the primary model, random-effects structure, or implementation path requires a traceable decision. `method-sap-workbook` owns the workbook companion; manuscript skills own final prose and citations.

**When directly invoked, always plan.** If input is unclear, ask or use the Phase 0.4 bootstrap; never exit the workflow. Anything that depends on changing code and seeing what happens belongs in `method-work`.

When the plan includes new or materially extended Marimo, Jupyter, R Markdown, or Quarto work, load the `method-notebook-standards` skill and record its topology decision and notebook responsibilities in the plan.

## Interaction Method

Apply the Skill Value interaction rule to every question below; never silently skip a required question.

## Feature Description

<feature_description> #$ARGUMENTS </feature_description>

**If the feature description above is empty, ask:** "What would you like to plan? Describe the task, goal, or project you have in mind." Then wait.

**All file references in the plan must be repo-relative (e.g., `src/models/user.rb`), never absolute** — in unit file lists, pattern references, origin links, and prose.

## Dual-Mode: SAP vs Implementation

**SAP mode** — input contains study design keywords: study population, exposure, intervention, outcome, hypothesis, research question, PICO, primary endpoint, cohort, case-control, randomized, observational study, clinical trial, inclusion criteria, exclusion criteria. Produces a versioned SAP using `references/sap-template.md`, requires the biostatistics-style tabular SAP workbook contract (`Overview`, `Outputs`, `Master Variables`), and runs `references/sap-gap-checklist.md`.

**Implementation mode** — all other inputs; uses Phases 0-5 below.

**Detection** (Phase 0, before Phase 1): an explicit request to write an SAP or 2+ keywords → announce "Entering SAP mode"; otherwise "Entering implementation mode". The user may override ("use SAP mode" / "use implementation mode") at any point; confirm if detection seems wrong. If the input also names code files, tests, or a repo feature, ask which mode to use.

### SAP Mode Workflow

When SAP mode is active, Phases 0-2 (resume, source, scope, research, questions) run as normal; then read `references/sap-mode-workflow.md` and follow it in place of Phases 3-5. Read `references/sap-template.md` when that workflow reaches SAP Phase 3 (structure) and `references/sap-gap-checklist.md` at SAP Phase 5 (gap check). For the SAP Phase 5 post-generation menu, load `references/plan-handoff.md` and run 5.3.8 (document review) and 5.4 with the SAP path in place of the plan path.

### Evidence access

Before SAP-1 background or SAP-5 methods, read `references/evidence-access.md` (PubMed/Paperclip MCP tools and rules). **Look up here:** background evidence for SAP-1 and method precedents for SAP-5.

SAP-mode gates that hold regardless of what the reference says:
- **Data profile before SAP structure (SAP Phase 2.5).** Read the `method-data-qa` profile/QA report before filling variable, missingness, cohort-size, or model sections. Inspectable data with no profile -> load `method-data-qa` in pre-SAP column profile mode first. No inspectable data -> keep `status: draft` with a GAP comment. QA blockers -> do not write a final SAP.
- **No finalization over open methodological choices.** Unresolved estimand (SAP-1.4), comparator, outcome, follow-up, adjustment, or missing-data choices keep the SAP in `status: draft`.
- **Tabular companion required (SAP Phase 4.5).** A new SAP without the `method-sap-workbook` companion and no explicit blocker is incomplete.
- **Human checkpoint on finalization.** Report critical/important/advisory gaps and set `status: final` only when the user accepts it and no critical gap remains.
- **SAP versioning.** Increment `sap_version`; never renumber SAP-N.M IDs.

## Core Principles

Read `references/planning-foundations.md` for principles 1-4; principles 5-7 follow.

5. **Data shape before SAP, coding, or modeling** - With data available, inspect actual columns, grain, keys, dates, missingness, duplicates, and validity before SAP finalization or implementation planning (`method-data-qa` for tabular, `method-omics-qc` for omics). Without data, write an explicit data-profile prerequisite and keep SAP variable/model sections provisional.
6. **Every new SAP gets a tabular workbook contract** - Not execution-ready without `analysis/sap-tables/01-overview.csv`, `02-outputs.csv`, `03-variables.csv`, and the rendered `<slug>-tabular-sap.xlsx` when `openpyxl` is available. If data QA is missing, keep the SAP in draft and list `method-data-qa` before `method-sap-workbook`.
7. **Causal/observational analysis guardrail** - Make the estimand, causal assumptions, unit/grain, key fields, time zero, and success criteria explicit. Record an analyst-approved assumption only when the choice can be responsibly deferred; unresolved methodological choices block finalization rather than being silently inferred.

A plan is ready when an implementer can start confidently without the plan writing the code.

## Phase 0: Resume, Source, and Scope

### 0.0 Resolve Output Mode

`OUTPUT_FORMAT` is `md` or `html`, never both. The repository root is pre-resolved at skill load:
!`git rev-parse --show-toplevel 2>/dev/null || true`

Use it as `<repo-root>` if absolute, else run `git rev-parse --show-toplevel`. Read `<repo-root>/.methodsmith/config.local.yaml` with the native file-read tool (in a linked worktree without it, try the main checkout from the absolute common Git directory). Read `references/output-mode.md` to resolve CLI `output:` > config `plan_output:` > default `md` (pipeline forces `md`). Then read `references/markdown-rendering.md` (md) or `references/html-rendering.md` plus `references/html-visuals.md` (html); both pair with `references/plan-sections.md`.

### 0.1 Resume Existing Plan Work When Appropriate

If the user references an existing plan or an obvious recent match exists in `docs/plans/`, read `references/resume-and-deepen.md` for resume, deepen-intent detection, and format preservation. Key rules:
- A unified artifact (`artifact_contract: ce-unified-plan/v1`, `artifact_readiness: requirements-only`) is updated in place; do not offer to create a sibling plan.
- "Deepen" a complete plan → Phase 5.3 in interactive mode, or `references/universal-planning.md` for `.md` without frontmatter. Section-specific edits follow normal resume.

### 0.1b Classify Task Domain and Detect Mode

Detect the mode (Dual-Mode rule); SAP mode continues to 0.2. A study, research question, or analysis plan also continues to 0.2, even without SAP keywords or code, so its research decisions reach 0.5b. Otherwise software or analysis code (repos, APIs, databases, pipelines, notebooks) → 0.2 in implementation mode; genuinely ambiguous ("plan a migration") → ask; anything else → read `references/universal-planning.md`, follow it, and skip all later phases. Named tools or links do not change this routing.

### 0.2 Find Upstream Requirements Document

Prefer a matching unified artifact in `docs/plans/` (`artifact_contract: ce-unified-plan/v1`, `artifact_readiness: requirements-only`): enrich it in place, change readiness to `implementation-ready`, and preserve its Product Contract and stable IDs. Otherwise search `docs/brainstorms/` for `*-requirements.md|html`; these become a new plan with `origin:` provenance. Relevant = same topic and problem, roughly within 30 days. If several match, ask which to use.

### 0.3-0.5 Origin Intake, Bootstrap, and Blockers

- **Relevant origin found:** read `references/origin-document.md` and apply 0.3 (carry everything forward; drop nothing silently) and 0.5 (do not plan over true product blockers).
- **No relevant origin, or unclear input:** read `references/planning-bootstrap.md` (0.4); it may recommend `method-brainstorm` or route a symptom without a root cause to the `method-debug` skill.

### 0.5b Clarify the Research Decision

Read `references/planning-foundations.md` and apply its research-decision interview before structuring a study or analysis plan.

### 0.6 Assess Plan Depth

**Lightweight** (small, bounded, low ambiguity), **Standard** (normal feature or bounded refactor), or **Deep** (cross-cutting, strategic, high-risk, or highly ambiguous). If unclear, ask one targeted question.

## Phase 1: Gather Context

Read `references/phase1-context-gathering.md` now and run its sub-phases 1.0-1.5 in order (data/QA preflight, local and conditional external research, consolidation, depth reclassification, flow analysis).

Phase 1.0 is a gate for any study or analysis work with data: inspect the actual columns and consume `method-data-qa` (tabular) or `method-omics-qc` (omics) evidence before writing variable, cohort, or model content. When no data is inspectable yet, record the data-profile prerequisite as a GAP and keep those sections provisional.

## Phase 2: Resolve Planning Questions

Mark each open question (origin deferrals, research gaps, required decisions) **resolved during planning** or **deferred to implementation** (depends on code changes or runtime behavior). Ask only when the answer materially affects architecture, scope, sequencing, or risk and cannot be inferred. Do not run tests, build, or probe runtime behavior.

## Phase 3: Structure the Plan

### 3.1 Title and File Naming

Title: conventional and searchable (`feat: Add user authentication`; type `feat`/`fix`/`refactor`). File: `docs/plans/YYYY-MM-DD-NNN-<type>-<descriptive-name>-plan.<md|html>`, where NNN is today's next zero-padded sequence (from 001) and the name is 3-5 kebab-case words.

### 3.2-3.7 Units, Design Sketches, and Unknowns

Read `references/plan-structure.md` now and apply 3.2 through 3.7: unit granularity, optional High-Level Technical Design and Output Structure, the per-unit field list, deferred unknowns, and tangential cleanup under `Deferred to Follow-Up Work`.

Non-negotiables: stable U-IDs on unit headings (`- U1. **[Name]**`), never renumbered (splits take the next unused number; deletions leave gaps) and no `- [ ]` checkboxes; every feature-bearing unit lists its test file in `**Files:**` with concrete scenarios (`Test expectation: none -- [reason]` only for non-feature-bearing units); execution-time unknowns stay deferred.

## Phase 4: Write the Plan

**NEVER CODE during this skill.** Change the amount of detail by depth, not the boundary between planning and execution.

- **4.1** Apply depth guidance (Lightweight 2-4 units, Standard 3-6, Deep 4-8) and the 4.3 Planning Rules from `references/plan-structure.md` (no implementation code, git commands, test command recipes, or `RED/GREEN/REFACTOR` micro-steps).
- **4.2** Read `references/plan-sections.md` (section contract) and `references/plan-template.md` (markdown shape); present per the Phase 0.0 rendering reference. Omit clearly inapplicable optional sections.
- **4.4** For 4+ units with non-linear dependencies or 3+ interacting surfaces, behavioral modes, or decisions, read `references/visual-communication.md`.

## Phase 5: Final Review, Write File, and Handoff

### 5.0 Scoping Synthesis Checkpoint

Before writing, present the scoping synthesis. Read `references/synthesis-summary.md` and `references/synthesis-discipline.md` for what belongs at synthesis altitude versus plan-write output.

### 5.1 Review Before Writing

Read `references/pre-write-review.md` and fix every failed plan check and origin-document check before writing.

### 5.2 Write Plan File

**REQUIRED: Write the plan file to disk before presenting any options.**

For a current-CE unified requirements artifact (`artifact_contract: ce-unified-plan/v1`, `artifact_readiness: requirements-only`), update that same canonical file in place, set `artifact_readiness: implementation-ready`, and preserve the Product Contract and stable R/A/F/AE identifiers. Do not create a sibling `*-plan` file. Otherwise write `docs/plans/YYYY-MM-DD-NNN-<type>-<descriptive-name>-plan.<md|html>` and confirm `Plan written to docs/plans/[filename]`. **Pipeline mode** (LFG, SLFG, or any `disable-model-invocation` context): make routine choices automatically without questions; leave unresolved research and methodological decisions as gaps.

### 5.3 Confidence Check and Deepening

1. Read `references/confidence-check.md` and run 5.3.1-5.3.2 (auto mode by default; interactive mode from the Phase 0.1 deepen fast path; always auto in pipeline mode).
2. If deepening is warranted, read `references/deepening-workflow.md` and execute 5.3.3-5.3.7.
3. Then **load `references/plan-handoff.md`** and execute 5.3.8 (document review) → 5.3.9 (final checks) → 5.4 (handoff). Document review is mandatory even when the confidence check passed.

**Post-generation menu** — a human checkpoint; never auto-select outside pipeline mode. Ask "Plan ready at `<plan path>`. What would you like to do next?" (actual `.md`/`.html` path; in SAP mode, the SAP path) with:
1. **load the `method-work` skill** (recommended) - Begin implementing this plan in the current session
2. **Create Issue** - Create a tracked issue (GitHub or Linear)
3. **Open in Proof (web app) — review and comment to iterate with the agent** - show only when the core Compound Engineering `ce-proof` skill is available (methodsmith does not ship it); otherwise omit it.
4. **Done for now** - Pause; the plan file is saved and can be resumed later

Route every selection per `references/plan-handoff.md`.

**Completion check:** not complete until the menu is presented and the user selects an action.

**Pipeline mode exception:** skip the menu and return control to the caller after the plan is written, the confidence check has run, and `method-doc-review` has run in headless mode.
