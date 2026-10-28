# Planning foundations

## General principles

1. **Requirements first; decisions, not code** — build from an existing requirements document. Capture approach, boundaries, files, dependencies, risks, and test scenarios; pseudo-code only as explicitly directional guidance.
2. **Research before structuring; right-size the artifact** — compact for small work, more structure for large work.
3. **Separate planning from execution discovery** — explicitly defer execution-time unknowns. Keep the plan portable (no tool-specific executor instructions) and carry implied test-first or characterization-first posture as a lightweight signal.
4. **Honor user-named resources** — a named CLI, MCP server, URL, file, or artifact is authoritative. Discover it (`command -v`, fetch, read) before assuming it is unavailable; if it fails, say so instead of substituting.
## Output-mode resolution

Use it as `<repo-root>` if absolute, else run `git rev-parse --show-toplevel`. Read `<repo-root>/.methodsmith/config.local.yaml` with the native file-read tool (in a linked worktree without it, try the main checkout from the absolute common Git directory). Read `references/output-mode.md` to resolve CLI `output:` > config `plan_output:` > default `md` (pipeline forces `md`). Then read `references/markdown-rendering.md` (md) or `references/html-rendering.md` plus `references/html-visuals.md` (html); both pair with `references/plan-sections.md`.
