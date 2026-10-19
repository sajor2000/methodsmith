# Contributing to Methodsmith

Thanks for helping improve Methodsmith. Please open an issue before a
substantial change so its scope can be agreed before implementation.

## Safety and scope

- Use synthetic or seeded data in tests and examples. Never commit patient-level
  data, PHI, credentials, or private research material.
- Keep reporting-guideline source documents out of the repository. Add their
  verified requirements to the appropriate checklist and registry instead.
- Keep the root README, `docs/setup.md`, and plugin README aligned when changing
  install or first-run behavior.
- Follow the repository's `AGENTS.md` instructions, including release and
  versioning policy. Do not hand-bump release-owned versions.

## Local checks

```bash
bun install
bun test
bun run release:validate
bun run eval:validate
```

Run the narrowest relevant checks while developing, then run the full set
before opening a pull request. Add tests or evaluation cases when behavior
changes.

## Pull requests

Use a conventional pull-request title such as `fix(hooks): check web egress`.
Describe the change, the evidence that validates it, and any merge risk. Keep
unrelated changes separate and explain any skipped validation.
