---
name: method-fabric
description: "Routes Microsoft Fabric work (OneLake, Lakehouse, Warehouse, PySpark, Data Factory, Direct Lake, Fabric ML, KQL) with research guardrails. Use when a project uses Fabric."
argument-hint: "[coding|pipelines|semantic-models|ml|kql]"
---

# Microsoft Fabric Router

## Skill Value

- **Problem it solves:** Fabric combines several execution engines; treating it as generic Spark, SQL Server, or Power BI can produce invalid code or unsafe data handling.
- **Use when:** The user mentions Fabric, OneLake, Lakehouse, Warehouse, Data Factory, Direct Lake, Eventhouse, or KQL.
- **Output:** A selected Fabric route, the applicable Methodsmith guardrails, and a bounded next action.
- **Ask only if:** The requested outcome could be implemented by more than one Fabric engine.
- **Do not do:** Do not guess a workspace, capacity, identity, or write permission; do not move data or create cloud resources without authorization.
- **Interaction:** Check repo/config/chat evidence first. Ask one decision-changing question at a time with the blocking tool: `AskUserQuestion` in Claude Code, `request_user_input` in Codex, `AskUser` in Droid, `question` in OpenCode, or `ask_user` in Gemini and Pi via `pi-ask-user`. In Claude Code, if the schema is not loaded, first call `ToolSearch` with `select:AskUserQuestion`; a pending schema load is not a fallback reason. Only when no blocking tool exists or the call errors, present numbered choices in chat and wait.

## Route

Choose the narrowest route and read its reference file before writing code. Each file holds that engine's scope, steps, and guardrails:

| Task | Route |
|---|---|
| Lakehouse/OneLake, PySpark, Spark SQL, Python notebook, Warehouse T-SQL, Delta tables | Read `references/coding.md` |
| Data Factory pipelines, Copy activity/job, Dataflows Gen2, gateway, scheduling, alerts | Read `references/pipelines.md` |
| Direct Lake, DAX, RLS/OLS, semantic-link/sempy, model refresh | Read `references/semantic-models.md` |
| MLflow, experiments, registered models, batch scoring, AI functions | Read `references/ml.md` |
| Eventhouse, KQL, Eventstreams, Real-Time Dashboards, Activator | Read `references/kql.md` |

For new or materially extended Fabric Python notebooks, load the `method-notebook-standards` skill before following the route's reference file.

If the route is unclear, follow the Skill Value interaction rule. Because there are five distinct destinations, present the numbered options below in chat when the blocking-question UI cannot show all five, accept free-form input, and wait for the user's response:

1. Lakehouse/Warehouse code
2. Pipeline orchestration
3. Semantic model
4. ML
5. Eventhouse/KQL

## Shared research workflow

1. Inspect the existing stack profile (`.methodsmith/config.local.yaml`). If none exists, ask the user to run the `method-setup` command — it is manual-invocation-only and cannot be loaded by the model. Record `data_layer: fabric` only when repository or user evidence supports it.
2. State the analytical grain, source item, read/write boundary, and intended artifact before generating transformations.
3. Load the `method-data-qa` skill at data boundaries. Reconcile source and target row counts, keys, joins, types, and missing-data handling.
4. Load `method-plan` for the canonical study plan; add `method-sap` only when complex claims work needs the deeper claim-to-dataset schema before scope-expanding analysis code.
5. Load the `method-work` skill to execute the selected route and preserve the fail-loud rule: no fabricated inputs, silent coercions, or hidden fallback datasets.
6. Load the `method-review` skill before relying on outputs for a scientific or operational decision.

## Non-negotiable boundaries

- Treat workspace, lakehouse, warehouse, and semantic-model names as environment-specific evidence, never as defaults.
- Keep credentials, tenant IDs, connection strings, and patient-level exports out of generated code and artifacts.
- Treat the Lakehouse SQL analytics endpoint as a read-only query surface over generated tables. Use the authorized write path for modifications.
- Do not claim RLS, OLS, or OneLake security is effective without checking the user's effective identity and workspace role.

## Handoff

When a route is chosen, state it in one line:

```
[method-fabric] route=<coding|pipelines|semantic-models|ml|kql> data_layer=fabric write_boundary=<declared|unknown>
```
