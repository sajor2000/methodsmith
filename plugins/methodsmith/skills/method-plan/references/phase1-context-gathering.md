# Phase 1: Gather Context

Detail for `method-plan` Phase 1. Linked from `SKILL.md` § Phase 1. Covers local research dispatch, execution-posture detection, the external-research decision rubric, consolidation, depth reclassification, and flow analysis.

## Contents

1. Phase 1.0 — Data-column and QA preflight for analysis projects.
2. Phase 1.1 — Local research (always runs).
3. Phase 1.1b — Detect execution-posture signals.
4. Phase 1.2 — Decide on external research.
5. Phase 1.3 — External research (conditional).
6. Phase 1.4 — Consolidate research.
7. Phase 1.4b — Reclassify depth when research reveals external contract surfaces.
8. Phase 1.5 — Flow and edge-case analysis (conditional).

---

## 0. Phase 1.0 Data-Column and QA Preflight

Run this before local research whenever the plan is in SAP mode, prediction/ML mode, clinical-trial analysis mode, bioinformatics/omics mode, dashboard/reporting mode, or any implementation mode that touches datasets, tables, model features, experiments, or downstream analytics.

The rule is strict: **actual columns and QA evidence come before SAP finalization, coding, or modeling**.

1. Scan the input, chat context, stack profile, and project tree for inspectable data evidence:
   - explicit data file or table paths
   - `.methodsmith/data-state.yaml` registered waves
   - `analysis/cohort/` extracts, waterfall files, or concept-set outputs
   - `data/`, `input/`, `extracts/`, `analysis/data/`, Parquet/CSV/Feather files, notebooks with data reads, or query files
   - existing `__CE_DATA_PROFILE__`, `__CE_DATA_QA__`, `__CE_COHORT__`, or `__CE_CLIF__` handoff signals, and `method-data-qa` reports at `reports/data-qa/<extract_id>.md` (legacy fallback: `analysis/data-qa-report.md`)
2. If an inspectable tabular dataset, extract, schema, or query result exists, run or load `method-data-qa` in pre-SAP column profile mode before structuring the SAP. Minimum evidence to carry forward:
   - row count and column count
   - exact column names and observed types
   - intended or candidate grain
   - primary keys or candidate keys
   - important date columns and timezone assumptions
   - null rates, duplicate rates, and distinct counts for likely categorical fields
   - basic numeric ranges and sentinel missing values
   - freshness/provenance when load or event timestamps exist
3. If this is omics data, load the `method-omics-qc` skill first and treat its sample/QC summary as the data profile. Do not write differential-expression, EWAS, variant, or pathway-analysis plans until sample identity, QC, genome build, and batch-risk evidence are recorded.
4. If data exists but QA blockers are present, plan remediation or re-extraction before SAP finalization. Do not recommend modeling or coding beyond QA/remediation work.
5. If no data is available yet, continue planning only with an explicit prerequisite:
   - Add `<!-- GAP: missing method-data-qa column profile; SAP variable/model sections provisional -->` to the SAP sections that depend on actual columns.
   - State that `method-data-qa` must run before finalizing the SAP, opening `method-sprint`, or load the `method-work` skill modeling.
   - Do not invent column names, keys, time windows, or feature availability. Use conceptual variable names only and label them as provisional.

## 1. Phase 1.1 Local Research (Always Runs)

Prepare a concise planning context summary (a paragraph or two) to pass as input to the research agents:
- If an origin document exists, summarize the problem frame, requirements, and key decisions from that document.
- Otherwise use the feature description directly.

Run these agents in parallel:

- Task method-repo-research-analyst(Scope: technology, architecture, patterns. {planning context summary})
- Task method-learnings-researcher(planning context summary)

Collect:
- Technology stack and versions (used in section 1.2 to make sharper external research decisions)
- Architectural patterns and conventions to follow
- Implementation patterns, relevant files, modules, and tests
- AGENTS.md guidance that materially affects the plan, with CLAUDE.md used only as compatibility fallback when present
- Institutional learnings from `docs/solutions/`

**Slack context** (opt-in) — never auto-dispatch. Route by condition:

- **Tools available + user asked**: Dispatch `method-slack-researcher` with the planning context summary in parallel with other Phase 1.1 agents. If the origin document has a Slack context section, pass it verbatim so the researcher focuses on gaps. Include findings in consolidation.
- **Tools available + user didn't ask**: Note in output: "Slack tools detected. Ask me to search Slack for organizational context at any point, or include it in your next prompt."
- **No tools + user asked**: Note in output: "Slack context was requested but no Slack tools are available. Install and authenticate the Slack plugin to enable organizational context search."

## 2. Phase 1.1b Detect Execution Posture Signals

Decide whether the plan should carry a lightweight execution posture signal.

Look for signals such as:
- The user explicitly asks for TDD, test-first, or characterization-first work.
- The origin document calls for test-first implementation or exploratory hardening of legacy code.
- Local research shows the target area is legacy, weakly tested, or historically fragile, suggesting characterization coverage before changing behavior.

When the signal is clear, carry it forward silently in the relevant implementation units. Ask the user only if the posture would materially change sequencing or risk and cannot be responsibly inferred.

## 3. Phase 1.2 Decide on External Research

Based on the origin document, user signals, and local findings, decide whether external research adds value.

**Read between the lines.** Pay attention to signals from the conversation so far:
- **User familiarity** — Are they pointing to specific files or patterns? They likely know the codebase well.
- **User intent** — Do they want speed or thoroughness? Exploration or execution?
- **Topic risk** — Security, payments, external APIs warrant more caution regardless of user signals.
- **Uncertainty level** — Is the approach clear or still open-ended?

**Leverage method-repo-research-analyst's technology context:**

The method-repo-research-analyst output includes a structured Technology & Infrastructure summary. Use it to make sharper external research decisions:

- If specific frameworks and versions were detected (e.g., Rails 7.2, Next.js 14, Go 1.22), pass those exact identifiers to method-framework-docs-researcher so it fetches version-specific documentation.
- If the feature touches a technology layer the scan found well-established in the repo (e.g., existing Sidekiq jobs when planning a new background job), lean toward skipping external research -- local patterns are likely sufficient.
- If the feature touches a technology layer the scan found absent or thin (e.g., no existing proto files when planning a new gRPC service), lean toward external research -- there are no local patterns to follow.
- If the scan detected deployment infrastructure (Docker, K8s, serverless), note it in the planning context passed to downstream agents so they can account for deployment constraints.
- If the scan detected a monorepo and scoped to a specific service, pass that service's tech context to downstream research agents -- not the aggregate of all services. If the scan surfaced the workspace map without scoping, use the feature description to identify the relevant service before proceeding with research.

**Always lean toward external research when:**
- The topic is high-risk: security, payments, privacy, external APIs, migrations, compliance.
- The codebase lacks relevant local patterns -- fewer than 3 direct examples of the pattern this plan needs.
- Local patterns exist for an adjacent domain but not the exact one — e.g., the codebase has HTTP clients but not webhook receivers, or has background jobs but not event-driven pub/sub. Adjacent patterns suggest the team is comfortable with the technology layer but may not know domain-specific pitfalls. When this signal is present, frame the external research query around the domain gap specifically, not the general technology.
- The user is exploring unfamiliar territory.
- The technology scan found the relevant layer absent or thin in the codebase.

**Skip external research when:**
- The codebase already shows a strong local pattern — multiple direct examples (not adjacent-domain), recently touched, following current conventions.
- The user already knows the intended shape.
- Additional external context would add little practical value.
- The technology scan found the relevant layer well-established with existing examples to follow.

Announce the decision briefly before continuing. Examples:
- "Your codebase has solid patterns for this. Proceeding without external research."
- "This involves payment processing, so I'll research current best practices first."

## 4. Phase 1.3 External Research (Conditional)

If Step 1.2 indicates external research is useful, run these agents in parallel:

- Task method-best-practices-researcher(planning context summary)
- Task method-framework-docs-researcher(planning context summary)

## 5. Phase 1.4 Consolidate Research

Summarize:
- Relevant codebase patterns and file paths
- Relevant institutional learnings
- Organizational context from Slack conversations, if gathered (prior discussions, decisions, or domain knowledge relevant to the feature)
- External references and best practices, if gathered
- Related issues, PRs, or prior art
- Any constraints that should materially shape the plan

## 6. Phase 1.4b Reclassify Depth When Research Reveals External Contract Surfaces

If the current classification is **Lightweight** and Phase 1 research found that the work touches any of these external contract surfaces, reclassify to **Standard**:

- Environment variables consumed by external systems, CI, or other repositories
- Exported public APIs, CLI flags, or command-line interface contracts
- CI/CD configuration files (`.github/workflows/`, `Dockerfile`, deployment scripts)
- Shared types or interfaces imported by downstream consumers
- Documentation referenced by external URLs or linked from other systems

This ensures flow analysis (Phase 1.5) runs and the confidence check (Phase 5.3) applies critical-section bonuses. Announce the reclassification briefly: "Reclassifying to Standard — this change touches [environment variables / exported APIs / CI config] with external consumers."

## 7. Phase 1.5 Flow and Edge-Case Analysis (Conditional)

For **Standard** or **Deep** plans, or when user flow completeness is still unclear, run:

- Task method-spec-flow-analyzer(planning context summary, research findings)

Use the output to:
- Identify missing edge cases, state transitions, or handoff gaps.
- Tighten requirements trace or verification strategy.
- Add only the flow details that materially improve the plan.
