---
name: method-trial-design
description: "Builds auditable two-arm group-sequential design frontiers from version-pinned rpact or gsDesign output. Use when comparing group-sequential designs across effect or spending scenarios."
argument-hint: "<endpoint and estimand>, optional: --engine rpact|gsDesign --alpha <value> --power <value>"
---

# External-Engine Trial Design Frontier

## Skill Value

- **Problem it solves:** Group-sequential choices are often compared through disconnected scripts, screenshots, and undocumented assumptions.
- **Use when:** A statistician needs to compare two-arm group-sequential superiority designs across effect, information-time, spending-rule, or futility scenarios.
- **Output:** A locked design specification, exact external-engine script and log, normalized operating-characteristic table, feasible/Pareto frontier, provenance receipt, and SAP handoff.
- **Ask only if:** The endpoint/estimand, hypothesis, effect scale, sidedness, alpha, target power, information times, or intended external engine cannot be established from the repository and conversation.
- **Interaction:** Ask required questions with `AskUserQuestion` in Claude Code, `request_user_input` in Codex, `AskUser` in Droid, `question` in OpenCode, or `ask_user` in Gemini and Pi via `pi-ask-user`. For Pi batch questions, put `context`, `options`, `allowMultiple`, and `allowFreeform` on each `questions` entry; do not also pass them at the top level. In Claude Code, first call `ToolSearch` with `select:AskUserQuestion` when the schema is not loaded. Only when no blocking tool exists or the call errors, present numbered options in chat and wait. Never silently skip the question.
- **Do not do:** Do not reimplement boundary or operating-characteristic mathematics, call Methodsmith output a validated design, choose a clinically acceptable design, or imply regulatory acceptance.

This skill owns the auditable workflow around the calculation. `rpact` or `gsDesign` owns boundaries, sample size/information, error spending, stopping probabilities, power, and expected information.

## Supported first release

Proceed only for a two-arm group-sequential superiority design with a prespecified endpoint and estimand. The external engine may analyze continuous, binary, or time-to-event endpoints only when its documented function supports the requested assumptions.

Stop and name the unsupported scope for platform/multi-arm trials, response-adaptive randomization, enrichment, seamless phase transitions, Bayesian decision rules, sample-size re-estimation, custom combination tests, or unblinded operational execution. Do not silently reduce those requests to a simpler design. For Bayesian decision rules, also state that FDA's January 2026 draft guidance *Use of Bayesian Methodology in Clinical Trials of Drug and Biological Products* expects simulated operating characteristics, and stop.

## Evidence access

Read `references/evidence-access.md` before the first literature lookup (PubMed and Paperclip MCP tool names, fallbacks, and evidence rules); never invent a citation, effect size, or guideline item.

- **Look up here:** prior trials of the comparator, control-arm event rates or standard deviations, and the MCID or alternative-effect source behind each scenario; write the PMID/DOI and the level read into the scenario's `provenance` field, or leave the scenario in `unresolved` rather than assuming a rate.

## Workflow

### 1. Establish the design contract

Read `references/design-contract.md` in full. Resolve evidence from the protocol, SAP, `method-meta-analysis`, and `method-power`, then from the Evidence access tools for any scenario assumption still missing, before asking the user. Write `analysis/trial-design/<design-id>/design-spec.json` from `references/design-spec.example.json` (read it now) and preserve the endpoint, estimand, effect scale, scenarios, decision rules, and review owner.

When every scenario re-solves for N, meeting the power target is automatic. Add the robustness candidates described in `references/design-contract.md` (N fixed from the base scenario, power evaluated under each other scenario) unless the user declines.

Completion evidence: every required contract field is explicit, scenario IDs are unique, and unresolved assumptions are marked as unresolved rather than guessed.

### 2. Pin and verify the engine

Read `references/engine-adapters.md` in full. Use either `rpact` or `gsDesign`, not a mixture within one run. Record the expected package version in the design spec. Before calculation, obtain `R.version.string` and `packageVersion(<engine>)`; stop if the installed package does not exactly match the pin.

Do not install or upgrade R packages without the user's approval. A lockfile may establish the version, but the runtime check still has to match it.

Completion evidence: the engine script contains a fail-closed version assertion and writes the R/package versions to its log or session-info artifact.

### 3. Run the external engine

Author a project-local R script at `analysis/trial-design/<design-id>/engine-run.R`, starting from `references/engine-run.example.R` (rpact, continuous endpoint) and adapting it for the endpoint. Use only documented engine functions named in `references/engine-adapters.md`. Run every declared scenario and candidate through the same pinned engine and write one normalized row per result to `engine-results.csv` using the exact column contract in `references/design-contract.md`.

Values for achieved power, type I error, maximum information, and expected information must be read from engine results, using the accessors in `references/engine-adapters.md`. With non-binding futility, type I error is computed ignoring the futility bound; the null-scenario rejection probability with futility applied understates it. Never reconstruct, approximate, or back-fill them in Methodsmith code. If the engine does not provide a required value for the chosen design, stop and report the missing operating characteristic.

Capture stdout/stderr in `engine-run.log`, save `sessionInfo()` output, and have the same R process write `runtime-provenance.json` using the contract in `references/engine-adapters.md`. If simulation is used, record the algorithm, iteration count, seed, Monte Carlo uncertainty, and failure count. Do not treat a simulated point estimate as proof that an error-rate constraint is satisfied when its Monte Carlo interval crosses the declared limit.

Completion evidence: the script exits successfully, the pinned version is visible, every declared scenario has output, and no required normalized value is missing or non-finite.

### 4. Build the CE-owned frontier and receipt

Keep the project root as the working directory so the project-relative inputs and outputs remain in the user's workspace. Invoke the co-located `scripts/build_frontier.py` through the absolute `SKILL_DIR` anchor, because the shell does not start in the skill directory:

```bash
SKILL_DIR="<absolute path of the directory containing this SKILL.md>";
python3 "$SKILL_DIR/scripts/build_frontier.py" \
  --spec analysis/trial-design/<design-id>/design-spec.json \
  --results analysis/trial-design/<design-id>/engine-results.csv \
  --engine-script analysis/trial-design/<design-id>/engine-run.R \
  --engine-log analysis/trial-design/<design-id>/engine-run.log \
  --session-info analysis/trial-design/<design-id>/session-info.txt \
  --runtime-provenance analysis/trial-design/<design-id>/runtime-provenance.json \
  --output-dir analysis/trial-design/<design-id>/frontier
```

The script validates scenario/candidate coverage and the pinned engine identity against machine-readable runtime provenance, applies only the declared power and type I error thresholds, computes a per-scenario Pareto frontier that minimizes maximum information, expected information under the null, and expected information under the alternative, and hashes the exact engine script, log, session information, and runtime provenance into the receipt. It does not recalculate statistical quantities.

Completion evidence: `evaluated-results.csv`, `frontier.csv`, `receipt.json`, and `sap-handoff.md` exist; the receipt hashes match the exact design spec and normalized engine output. An empty frontier is a valid negative result and must not be replaced by the "closest" candidate.

### 5. Review and hand off

Present the full feasible frontier. Do not select one candidate unless the user supplies the clinical, operational, and statistical preference rule. Require a named qualified statistician to review the exact spec, engine script, operating characteristics, stopping rules, multiplicity/error control, and SAP language.

The SAP handoff must preserve endpoint and estimand, sidedness, alpha, target power, information times, efficacy/futility rules and binding status, engine/version, scenario assumptions, simulation controls when used, selected candidate rationale, and review status. Check reporting against CONSORT 2025 (Hopewell et al., BMJ 2025;389:e081123, PMID 40228833) plus the ACE adaptive extension (Dimairo et al., BMJ 2020;369:m115, PMID 32554564; built on CONSORT 2010, which CONSORT 2025 supersedes, so map its items to the 2025 numbering), and the protocol against SPIRIT 2025 (Chan et al., BMJ 2025;389:e081477, PMID 40294953). Cite FDA *Adaptive Designs for Clinical Trials of Drugs and Biologics* (final, November 2019) and ICH E9(R1) for the estimand as regulatory context; cite ICH E20 (adaptive designs) only after confirming its current Step on ich.org, and label it a draft until it reaches Step 4.

Completion evidence: the handoff distinguishes engine-derived quantities, CE-derived feasibility/frontier labels, unresolved clinical or operational choices, and the named human review gate.

### 6. Emit the handoff signal

After all artifacts pass the checks above, emit one line:

```text
__CE_TRIAL_DESIGN__ design_id=<id> engine=<name>@<version> frontier=<path> receipt=<path> sap=<path> status=<feasible|no-feasible-candidate|review-pending>
```

Use `review-pending` whenever a candidate is presented but the required statistical review is not recorded.

## Data boundary

Use aggregate design assumptions and operating characteristics. Do not place patient-level or row-level clinical data in the design package. Follow the project's approved restricted-data location if a specialized engine genuinely requires patient-level inputs; the frontier artifacts remain aggregate.

## References

@./references/design-contract.md

`references/engine-adapters.md` (read in Step 2 before writing `engine-run.R`)

`references/engine-run.example.R` (starting point for Step 3)

`references/design-spec.example.json` (template for Step 1)

`references/evidence-access.md`

Example normalized output, generated by `references/engine-run.example.R` with rpact 4.4.0 from the example spec (an illustration of the format, never a magnitude anchor for another design):

@./references/engine-results.example.csv
