# Planning Foundations

## General planning principles

1. **Requirements first; decisions, not code** — build from an existing requirements document. Capture approach, boundaries, files, dependencies, risks, and test scenarios; pseudo-code only as explicitly directional guidance.
2. **Research before structuring; right-size the artifact** — compact for small work, more structure for large work.
3. **Separate planning from execution discovery** — explicitly defer execution-time unknowns. Keep the plan portable (no tool-specific executor instructions) and carry implied test-first or characterization-first posture as a lightweight signal.
4. **Honor user-named resources** — a named CLI, MCP server, URL, file, or artifact is authoritative. Discover it (`command -v`, fetch, read) before assuming it is unavailable; if it fails, say so instead of substituting.

## Research decision interview

For a study or analysis, check the brief and relevant `docs/brainstorms/*-grill.md` records for the goal, research question or hypothesis (when applicable), data, proposed methods, and intended task and deliverable. Treat unconfirmed choices as open. If a material decision is unclear or an apparent design weakness could change the plan, load `method-grill` in its planning-integration mode before structuring the plan. Carry confirmed decisions and unresolved risks forward; do not invent decisions or force a hypothesis for descriptive or exploratory work. Reassess SAP versus implementation mode after the interview; if the appropriate mode changes, announce the switch and follow its gates.

If the user stops the interview, continue only if they still want a plan; mark unresolved decisions as gaps and never finalize an SAP over open methodological choices. In pipeline or other non-interactive mode, do not interview or fabricate answers: record the gaps and keep affected sections provisional.

In interactive and non-interactive modes preserve the outcome exactly as supplied until its definition is confirmed; a proposed option is not a chosen endpoint. Do not assign a specific design, estimator, or `study_type` to an unresolved choice, including in frontmatter, headings, or prose; use the supported broad `observational` or `other` study type when justified until a narrower design is settled: describe target-trial framing only as an unselected option when it has not been chosen. An active comparator does not inherently reduce confounding; describe the conditions and remaining uncertainties instead of asserting a benefit. These rules apply throughout the SAP, including its tables and secondary analyses.
