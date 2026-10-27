# Output Mode Resolution (Phase 0.0)

`OUTPUT_FORMAT` is exclusive: the plan is written as markdown (`.md`) OR HTML (`.html`), never both. Precedence: CLI arg > config > default (`md`), with a hard pipeline override. `SKILL.md` resolves `<repo-root>` and reads `.methodsmith/config.local.yaml`; apply these steps to the result.

1. **CLI arg.** Scan `$ARGUMENTS` for a token starting with the literal prefix `output:`. If found, strip it before treating the remainder as the feature description, and match its value case-insensitively against `md` and `html`.
   - `output:` alone (no value) -> no-op; fall through to step 2.
   - `output:<unknown>` (e.g., `output:pdf`) -> drop the token, fall through to step 2, and after final resolution emit one line above the post-generation menu: `Ignored unknown output: value '<value>' -- using <resolved_format> instead.`
2. **Config.** If step 1 did not resolve and the config has an active, non-commented `plan_output:` key whose value matches `md` or `html` (case-insensitive), use it. Missing, invalid, or commented values fall through silently.
3. **Default.** Otherwise `OUTPUT_FORMAT=md`.
4. **Pipeline override.** When invoked from LFG or any `disable-model-invocation` context, force `OUTPUT_FORMAT=md` regardless of steps 1-3.

Only literal-prefix flag tokens (`output:`, `mode:`, `delegate:` where applicable) are consumed and stripped. Other `<word>:<word>` tokens — including conventional commit prefixes like `feat:` or `fix:` inside a feature description — pass through verbatim.

When resuming an existing plan, `references/resume-and-deepen.md` governs format preservation.
