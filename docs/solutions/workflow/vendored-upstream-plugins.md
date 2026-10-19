---
title: Vendored upstream plugins stay out of this repo's marketplaces
module: methodsmith
tags:
  - upstream-sync
  - coding-tutor
  - marketplace
  - documentation
problem_type: convention
status: active
date: 2026-10-19
---

# Vendored Upstream Plugins

## Context

`plugins/coding-tutor/` is an upstream Compound Engineering plugin (author Nityesh Agarwal, MIT, distributed through the upstream `claude-code-essentials` marketplace). This repo carries a vendored, release-managed copy: its version bumps through release-please (`plugins/coding-tutor` is a package in `.github/release-please-config.json` with `extra-files` syncing its three plugin manifests), and the converter test matrix uses it as a second real plugin alongside `methodsmith`.

The public documentation accuracy review (issue #122) flagged that `coding-tutor` is not listed in any of this repo's three marketplaces (`.claude-plugin/`, `.cursor-plugin/`, `.agents/plugins/`) and that only its Cursor manifest carries `homepage`/`repository`, pointing at the upstream EveryInc repository.

## Decision

- **Not distributing `coding-tutor` from this repo is intentional.** Distribution stays upstream, where the plugin is maintained and published; adding it to this repo's marketplace `plugins[]` lists would fork its distribution channel and its update path. Users install it from upstream (`/plugin install coding-tutor@claude-code-essentials`).
- **The upstream attribution in the Cursor manifest is intentional.** `homepage` and `repository` point at the upstream EveryInc repository because that is where the plugin lives. The Claude and Codex manifests for `coding-tutor` carry no such fields, so attribution stays in one manifest plus the plugin's own README rather than being restated three times.

## Consequences

- Do not add `coding-tutor` (or any other vendored upstream plugin) to the three marketplace catalogs as part of routine work; that is a deliberate distribution decision, and if it is ever made, all three marketplaces must list it together so `bun run release:validate` stays in sync.
- Release automation keeps managing the vendored copy's version, and the description-parity check across its three `plugin.json` files still applies.
- A vendored plugin is distributed from this repo only if this document is updated in the same change.
