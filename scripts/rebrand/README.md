# Methodsmith rebrand tooling

Renames ce-datascience to Methodsmith (plugin `methodsmith`, prefix `method-`).

- `mapping.json` is the only source of truth: every skill, agent, and plugin
  script, plus extra ids, names that must stay `ce-*` (`keep`), and upstream
  Compound Engineering names. Runtime code (legacy cleanup, the Claude alias
  installer, `method-update`) reads the same file.
- `rename.ts` applies it: it moves paths and rewrites the text of every tracked
  file. It is idempotent.
- `tests/rebrand.test.ts` checks that the mapping is total, injective, and
  collision-free. It also runs the rename on a temp copy of the checkout and
  asserts that no unaccounted `ce-` reference remains and that a second run
  changes nothing.

## What it rewrites beyond names

- The repo slug `sajor2000/ce-datascience` -> `sajor2000/methodsmith` and the
  Pages URL -> `sajor2000.github.io/methodsmith`. GitHub redirects the old URLs.
- Paths in `keepOldCopies` are copied, not moved, for one release, because old
  links still point at them. The list is empty now that the overview video it
  held has been retired.

## What it keeps on purpose

- `CHANGELOG.md` files, dated records in `docs/brainstorms|plans|ideation/`,
  and this folder.
- Old release tags (`ce-datascience-v*`).
- The per-project state folder `.ce-datascience/`. It holds the PHI-boundary
  config, so renaming it would silently drop the boundary on upgrade.
- Lines containing `rebrand:keep`, and regions between `rebrand:keep-start` and
  `rebrand:keep-end`. The legacy-cleanup registries use these regions to keep
  every historical `ce-*` name.

## Re-run on a newer main

```bash
git rebase origin/main          # drop the "apply rename" commit if it conflicts
bun run scripts/rebrand/rename.ts --dry-run   # preview counts and residue
bun run scripts/rebrand/rename.ts             # apply (stages moved paths)
bun test tests/rebrand.test.ts                # mapping, residue, idempotency
bun run scripts/rebrand/rename.ts --check     # exit 0 = nothing left to do
```

The script reads `git ls-files`, so `git add` new files before a dry run or
`--check`; untracked files are neither rewritten nor scanned for residue.

If a newly merged branch adds a `ce-*` skill or agent, the mapping test fails
and names it. Add it to `mapping.json` and re-run. If the residue test reports
a new token, decide which kind it is: one of ours (add it to `extra`), a retired
or upstream name (add it to `keep.tokens`), or a placeholder in a test (add it
to `keep.foreign`).
