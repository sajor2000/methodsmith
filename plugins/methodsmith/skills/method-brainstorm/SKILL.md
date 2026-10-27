---
name: method-brainstorm
description: "Explores a research or analysis idea, compares study designs, and scopes requirements before planning. Use when the user wants to brainstorm or weigh designs; PICO framing goes to method-question."
argument-hint: "[research question or study idea to explore] [output:html]"
---

# Brainstorm a Research Question or Study


## Skill Value

- **Problem it solves:** Vague study ideas can turn into SAPs or code that silently invent population, endpoint, comparison, or feasibility decisions.
- **Use when:** The user wants to brainstorm, refine a research question, compare study designs, or decide what evidence would be worth generating.
- **Output:** A requirements, protocol, or analysis brief under docs/brainstorms/ that method-plan can use as origin context.
- **Ask only if:** Only for study-shaping decisions that are not clear from the prompt, repo, prior artifacts, or source documents.
- **Do not do:** Do not write the SAP, implement analysis code, or force a long brainstorm when the request is already well scoped.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time; use the current harness's blocking question UI when available, otherwise present numbered choices and wait.

**Resolve the current year at runtime** (`date +%Y`) when dating requirements documents.

Brainstorming answers **WHAT** to study; `method-plan` answers **HOW** to execute the analysis. The durable output is a **requirements document** (a study protocol or analysis brief elsewhere), strong enough that planning need not invent study design, scope boundaries, or success criteria/endpoints. This skill does not implement analysis code.

**IMPORTANT: All file references in generated documents must use repo-relative paths (e.g., `src/models/user.rb`), never absolute paths.**

## Core Principles

1. **Assess scope first** - Match ceremony to the size and ambiguity of the work.
2. **Be a thinking partner** - Suggest alternatives, challenge assumptions, and explore what-ifs instead of only extracting requirements.
3. **Resolve study design decisions here** - Research questions, populations, exposures, outcomes, scope boundaries, and success criteria/endpoints belong here; detailed analysis implementation belongs in planning.
4. **Keep implementation out of the requirements doc by default** - No specific packages, SQL, model specifications, file layouts, or code-level design unless the brainstorm is itself about a methodological or analytical architecture decision.
5. **Right-size the artifact** - Simple work gets a compact document or brief alignment; larger work gets a fuller document.
6. **Apply YAGNI to carrying cost, not coding effort** - Prefer the simplest design that delivers meaningful evidence; include low-cost analytical rigor when its ongoing cost is small.

## Interaction Rules

These apply to every brainstorm, including the universal flow in `references/universal-brainstorming.md`.

1. **Ask one question at a time** - One question per turn, even when sub-questions feel related.
2. **Prefer single-select multiple choice** - For one direction, priority, or next step.
3. **Use multi-select rarely and intentionally** - Only for compatible sets (goals, constraints, non-goals, success criteria); if priority matters, follow up on which is primary.
4. **Use the Skill Value interaction rule** - Ask only decision-changing questions after checking evidence. Use the harness's blocking question UI when available; otherwise present numbered choices and wait.
5. **Use prose only when the question is genuinely open** - Drop the blocking tool only when (a) the answer is inherently narrative, (b) the question is diagnostic or introspective and options would leak priors and bias the answer, or (c) 3-4 genuinely distinct, plausible options cannot be written without padding or strawmen. Rule 1 still applies.

Keep outputs concise: short sections, brief bullets, only enough detail for the next decision.

## Research Question Description

<research_description> #$ARGUMENTS </research_description>

**If the research description above is empty, ask the user:** "What would you like to explore? Please describe the research question, hypothesis, or study idea you're thinking about." Do not proceed without one.

## Execution Flow

### Phase 0: Resume, Assess, and Route

#### 0.0 Resolve Output Mode

Resolve `OUTPUT_FORMAT` before any other phase. Output is **exclusive**: markdown (`.md`) OR HTML (`.html`), never both.

**Read config.** The repository root is pre-resolved at skill load:
!`git rev-parse --show-toplevel 2>/dev/null || true`

If that line is an absolute path, use it as `<repo-root>`; if empty or a literal command string, run `git rev-parse --show-toplevel` at runtime. Read `<repo-root>/.methodsmith/config.local.yaml` with the native file-read tool. In a linked worktree without the file, resolve the absolute common Git directory and try the main checkout's copy. If none is found, use defaults.

Precedence:

1. **CLI arg.** A token with the literal prefix `output:` is stripped from the research description; match its value case-insensitively to `md` or `html`. Bare `output:` falls through. An unknown value (e.g., `output:pdf`) falls through and, above the post-generation menu, emits: `Ignored unknown output: value '<value>' -- using <resolved_format> instead.`
2. **Config.** An active, non-commented `brainstorm_output:` of `md` or `html`; anything else falls through silently.
3. **Default.** `OUTPUT_FORMAT=md`.
4. **Pipeline override.** From LFG or any `disable-model-invocation` context, force `md` regardless of 1-3.

Only literal-prefix flag tokens (`output:`, `mode:`, `delegate:` where applicable) are stripped; other `<word>:<word>` tokens pass through.

Read `references/markdown-rendering.md` when `md`, or `references/html-rendering.md` plus `references/html-visuals.md` when `html`; both pair with `references/brainstorm-sections.md` (same content, different presentation). The choice does not propagate to `method-plan`, which resolves its own `plan_output`.

#### 0.1 Resume Existing Work When Appropriate

If the user references an existing brainstorm, or an obvious recent matching `*-requirements.{md,html}` exists in `docs/brainstorms/`: read it and confirm: "Found an existing requirements doc for [topic]. Should I continue from this, or start fresh?" When resuming, summarize its state, continue from its decisions and open questions, and update it instead of duplicating. Write back in the existing file's format unless `output:` overrides; pipeline mode still forces markdown, writing a parallel `.md` and leaving any `.html` untouched.

#### 0.1b Classify Task Domain

Ask: **does the task involve designing, analyzing, or architecting a research study or data analysis?** (not merely mentioning data or research).

- **Data science / study design** -> continue to 0.2: research questions, hypotheses, datasets, populations, exposures, outcomes, statistical analyses, or designing/executing/interpreting a study.
- **Non-study brainstorming** -> none of those signals AND the user wants to explore, decide, or think through something in another domain. Read `references/universal-brainstorming.md`, follow it, and skip Phases 0.2-4. Core Principles and Interaction Rules still apply.
- **Neither** -> quick help, error message, factual question, or single-step task: respond directly with no brainstorm.

#### 0.2 Assess Whether Brainstorming Is Needed

Requirements are clear when the user gives specific success criteria or endpoints, references a design or prior analysis to follow, describes exact outcomes and populations, and scopes tightly. Then keep it brief: confirm understanding and offer concise next steps; write a short requirements document only when a durable handoff is valuable. Skip Phases 1.1 and 1.2; go to 1.3 or 2.9.

#### 0.3 Assess Scope

Classify from the description plus a light repo scan:

- **Lightweight** - small, bounded, low ambiguity (descriptive analysis, single-table query)
- **Standard** - normal study or bounded analysis with some design decisions
- **Deep** - cross-cutting, multi-dataset, strategic, or highly ambiguous

If unclear, ask one targeted question. For Deep, also pick a sub-mode:

- **Deep — analysis** (default): an existing program anchors investigators, core question, prior work, and workflows; the brainstorm refines within it.
- **Deep — program**: investigators, core questions, literature positioning, or primary workflows are materially unresolved. Existing analyses lower the odds but do not rule it out. Program tier adds Phase 1.2 questions and requirements sections.

### Phase 1: Understand the Idea

#### 1.1 Existing Context Scan

- **Lightweight:** search for the topic, check whether something similar exists, move on.
- **Standard and Deep:** *Constraint check* — read `AGENTS.md` (and `CLAUDE.md` only as compatibility context) for workflow or scope constraints. *Topic scan* — search relevant terms, read the most relevant existing artifact (brainstorm, plan, spec, prior analysis, protocol), and skim adjacent examples.

If nothing obvious appears, say so and continue.

1. **Verify before claiming** — When the brainstorm touches checkable infrastructure (tables, datasets, config, dependencies, variable definitions), read the sources. Verify every claim that something is absent; otherwise label it an unverified assumption.
2. **Defer analysis decisions to planning** — Statistical methods, query optimization, notebook structure, and pipeline architecture belong in planning unless the brainstorm is about that decision.

**Slack context** (opt-in, Standard and Deep; never auto-dispatch):

- Tools available + user asked: dispatch `method-slack-researcher` with a topic summary alongside 1.1 and fold findings into context.
- Tools available + not asked: "Slack tools detected. Ask me to search Slack for organizational context at any point, or include it in your next prompt."
- No tools + asked: "Slack context was requested but no Slack tools are available. Install and authenticate the Slack plugin to enable organizational context search."

#### 1.2 Study Design Pressure Test

Before generating approaches, scan the opening for rigor gaps (internal analysis; raise only gaps that exist, during 1.3).

- **Lightweight:** Is this a real clinical or scientific question? Does an existing analysis already cover it? Is there a clearly better framing at near-zero cost?
- **Standard and Deep:** read `references/study-design-pressure-test.md` for the gap lenses, domain probes, R-specific probes, synthesis questions, Deep/program additions, and probe wording.

#### 1.3 Collaborative Dialogue

Follow the Interaction Rules.

- Ask what the user is already thinking before offering ideas.
- Start broad (question, population, clinical significance), then narrow (inclusion/exclusion, confounders, edge cases).
- **Rigor probes fire before Phase 2 and are prose, not menus** (Rule 5(b)). Each scope-appropriate gap found in 1.2 gets its own direct prose probe; one probe satisfies one gap. Interleave with narrowing, but Phase 1 cannot end with an un-probed gap. When the design appropriateness gap is present, its probe is the final one before Phase 2. Record genuine uncertainty as an explicit assumption rather than skipping the probe.
- Clarify the problem frame, validate assumptions, and ask about success criteria/endpoints.
- Make requirements concrete enough that planning will not invent study design decisions.
- Surface dependencies (IRB, data access, sample size) only when they materially affect scope.
- Bring ideas, alternatives, and challenges instead of only interviewing.

**Exit condition:** the idea is clear OR the user explicitly wants to proceed.

### Phase 2: Explore Study Design Approaches

If multiple plausible directions remain, propose **2-3 concrete study design approaches** from the literature and conversation; otherwise state the recommended direction directly. Before presenting them, read `references/evidence-access.md` and run its literature pulse per option (**Look up here:** prior studies per design option, hit count and 2-3 PMIDs, labelled `abstract`, never a systematic search).

Run this comparison only when at least two options are genuinely viable and the choice could materially affect scientific value, feasibility, or interpretability. Do not add agent fan-out for routine clarification; generate the alternatives in the normal collaborative flow.

- Make alternatives meaningfully different: design (RCT vs. observational vs. quasi-experimental), analysis strategy (regression vs. matching vs. time-series), population or data source (single- vs. multi-center; EHR vs. claims vs. registry), or outcome definition/timeframe.
- Use at least one non-obvious angle: inversion (study the inverse outcome), constraint removal (a linked dataset), or analogy from another clinical domain.
- Include one adversarial or assumption-inverting challenger when a meaningful one exists. Flag any attractive-but-unsuitable option as a **trap** with its concrete reason (infeasible data access, invalid comparison, unmanageable confounding, disproportionate carrying cost). Do not manufacture a trap when every viable option is reasonable.
- When useful, add one higher-upside challenger (the adjacent addition that most raises rigor, compounding evidence, or clinical relevance without disproportionate cost), never as the default; omit it when the study is already over-scoped.
- At program tier, alternatives differ on *what* is studied (question, population, exposure), not *how* the analysis runs.

For each approach: 2-3 sentence description, pros and cons, key risks or unknowns (data availability, bias, confounding), and when it fits best. Present all approaches before recommending, then recommend with reasons: prefer simpler designs when complexity carries real cost, but keep low-cost, high-value rigor. If one approach is clearly best, skip the menu and recommend directly. When relevant, say whether the choice replicates an existing design, extends an existing analysis, or is net new.

### Phase 2.9: Synthesis Checkpoint

Before writing the requirements document, present and confirm the scope synthesis. Read `references/synthesis-summary.md` and `references/synthesis-discipline.md` for the contract; it is the scope checkpoint doc-write consumes, not a draft of the doc.

### Phase 3: Capture the Requirements

Write or update a requirements document only when the conversation produced durable decisions. Read `references/brainstorm-sections.md` for the section contract, use the Phase 0.0 rendering reference for presentation, and use `references/requirements-capture.md` for the health data science template and completeness checks. When a diagram or comparison table would make the requirements much easier to grasp (multi-step study flow, 3+ interacting populations or exposures, competing designs), read `references/visual-communication.md`.

For **Lightweight** work keep the document compact, or skip it when only brief alignment is needed.

### Phase 4: Handoff

Present next-step options and execute the user's selection. Read `references/handoff.md` for the option logic, dispatch instructions, and closing summary format.
