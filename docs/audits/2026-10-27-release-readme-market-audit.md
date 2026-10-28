---
title: Release readiness, README, and market audit
date: 2026-10-27
status: complete
base: 5912331814a747824776bbf60208e6633e53d7e2
---

# Release readiness, README, and market audit

## Decision

**Conditional go for a research-use release; hold the release until its exact candidate is gated.** The repository has substantial engineering safeguards and useful scientific workflow differentiation. Its main weaknesses are release gating, prominent claims that exceed their qualifications, and an onboarding page that hides the strongest evidence. This is an audit, not release approval or scientific certification.

Audit scope: clean local `main` at `5912331814a747824776bbf60208e6633e53d7e2`, the root/plugin READMEs, setup guide, release workflows, manifests, test coverage, committed scientific-review evidence, and public competitor documentation retrieved on 2026-10-27. Latest published plugin release observed: `methodsmith-v5.4.1`, 2026-10-22. Current main contains subsequent scientific corrections and data-boundary hardening. Findings apply to this commit, not every installation identified as 5.4.1.

No implementation files, versions, installed plugins, remote configuration, or releases were changed. Only this audit was added on `docs/release-market-audit-20261027`. Website dependencies were installed from the frozen lockfile with lifecycle scripts disabled to run its build.

## Prioritized findings

### R1 — High: release creation is not gated on the release commit's passing CI

Evidence: `.github/workflows/ci.yml:46` skips the test job for `release-please--branches--main`; the PR-title job also skips that branch. `.github/workflows/release-pr.yml:50` skips metadata validation when it detects a release merge. Release Please runs on main pushes independently of CI, and its release step has no dependency on the CI result. The optional npm publishing job has additional checks, but they happen after GitHub release creation.

Impact: a release PR can satisfy a skipped required check, merge, and create a GitHub tag/release before CI detects a defect in the resulting release tree. The workflow comments document the workaround for #165; that explains the choice but does not supply an equivalent gate. CI on the audited main commit is green, which is encouraging but does not test a future version-bump commit.

Action: restore a functioning required check for release PRs, or add an explicit exact-SHA validation dependency before release creation. Test metadata and packaging on the actual release candidate. Preserve release automation ownership of version numbers.

### R2 — High for launch messaging: hook protection is presented too broadly near the top

Evidence: `README.md:139` advertises a PHI guard in the main proof section; the comparison table simply says “Yes.” The detailed limits at `README.md:738` explain that enforcement is Claude Code only, Codex/OpenCode entries exit immediately, other listed hosts rely on instructions, and missing Python disables the guard. `plugins/methodsmith/hooks/hooks.json` confirms a successful exit when Python is absent. The README also says external tools “never receive” data values before explaining heuristic coverage and exceptions.

Impact: a reader installing the prominently advertised Codex route can reasonably infer equivalent technical enforcement. The detailed disclosure is candid, but approximately 600 lines separate the main claim from that disclosure. This is a messaging/enforcement-scope mismatch, not a newly demonstrated exfiltration exploit.

Action: qualify the first claim and comparison cell: “Claude Code tool hook; other hosts use workflow instructions.” State the Python prerequisite adjacent to it. Replace universal outcome promises with descriptions of intended policy and checked paths. Add a small platform-by-platform safeguards table to the setup guide.

### R3 — Medium: incorrect inventory survives the inventory test

Evidence: `README.md:1224` says `| Skills | 67 |`; the opening says 70 and `bun run release:validate` counts 70. `tests/displayed-counts.test.ts:47` matches phrases such as “70 skills,” not label-first Markdown table rows.

Action: correct the table and extend that existing test to cover inventory-table cells. This is a deterministic documentation defect and a precise test blind spot.

### R4 — Medium: current documentation and the published version are easy to conflate

Evidence: both main and the latest plugin tag declare 5.4.1, but the tag's README advertises 68 skills and main advertises 70. `git log methodsmith-v5.4.1..HEAD` contains the subsequent scientific and boundary changes. The version badge reads main's manifest; setup links point at the continuously deployed site.

Impact: version alone does not identify which source or safeguards a user installed. This is normal between automated releases, but unusually consequential when the intervening changes affect scientific checks and data handling.

Action: finish the next automated release after candidate verification. Identify tag plus commit in release acceptance evidence, demonstrate a pinned installation, and make clear whether the site describes stable or main. Do not hand-bump versions as a shortcut.

### R5 — Medium: the README hides the most persuasive adoption evidence

Evidence: root README is 1,270 lines / 9,010 whitespace-delimited words; plugin README is 1,039 lines / 9,232 words; setup guide is 1,198 lines / 7,712 words. The root README contains no link to `demo/bcg-meta-analysis/`. Its prominent tour is explicitly a scripted illustration, which is honest but weaker evidence than a rerunnable artifact. The BCG demo already contains code, outputs, and explicit limitations.

Action: lead with one concrete input-to-artifact example and link the demo beside the quick start. Keep one primary installation route per headline host; move migration inventories, exhaustive commands, and contributor detail into linked guides. Retain the accurate “scripted illustration” labels.

### R6 — Medium: scientific evidence needs a concise public summary

Evidence: `docs/audits/2026-10-27-pr173-feedback.md` records 18 accepted fresh-context runs across nine cases, including grader limitations, preserved failed runs, and a soft false-positive warning. This is useful evidence and must not be replaced with “no behavioral testing exists.” Conversely, `eval:validate` checks case definitions; it does not execute those 39 cases. Independent biostatistician review remains open as [#124](https://github.com/sajor2000/methodsmith/issues/124).

Action: add a short “What has been tested” section linking code tests, bounded behavioral acceptance, and pending independent scientific review. Describe results as scoped engineering/behavioral evidence, never a general accuracy rate or clinical validation. Keep the research-use disclaimer.

### R7 — Low: reviewer and comparison language can be more exact

Evidence: the opening accurately says 55 specialist agents, but the proof section calls all 55 “specialist reviewers.” The agent inventory also includes researchers and workflow roles. `method-review` dispatches selected reviewers, not the whole inventory. The competitor table mixes capabilities, categories, and bare negative claims with a single 2026-10-19 date.

Action: use “55 specialist agents, including reviewers and researchers; relevant reviewers are selected for each task.” Cite competitor feature rows individually, distinguish “not documented in reviewed sources” from verified absence, and avoid implying equal runtime safeguards across hosts.

## Verification actually performed

| Check | Result |
|---|---|
| `bun run release:validate` | Pass: 70 skills, 55 agents, 0 MCP servers; metadata synchronized |
| `bun run typecheck` | Pass |
| `bun run eval:validate` | Pass: 39 case definitions; no new live behavioral runs |
| `bun run plugin:validate` | Marketplace and plugin schema pass; CLI explicitly excludes directory policy/safety review |
| `bun test`, local Bun 1.3.13 | 1,934 pass, 12 skip, 9 fail; 14,638 assertions across 125 files |
| Nine failures | All in `tests/number-registry-docx.test.ts`; default Homebrew Python 3.14 cannot load `pyexpat` because `_XML_SetAllocTrackerActivationThreshold` is absent from the loaded system Expat library |
| Interpreter diagnostic | Direct import also fails with installed Homebrew Python 3.13; system Python 3.9 imports Expat, but was not used to claim supported runtime acceptance |
| Website build | Passed after frozen-lockfile dependency installation; initial attempt lacked local Docusaurus |
| GitHub CI on audited SHA | Successful run [40509406488](https://github.com/sajor2000/methodsmith/actions/runs/40509406488); documentation deployment and Release PR workflow also succeeded |

The local failures demonstrate a broken local XML runtime, not nine independently established product defects. They still prevent a claim that the full local suite passed. Skips include seven R pooling integration cases and optional website-serving, trial-engine, Parquet, workbook, and Python numerical coverage. A successful site build does not retroactively turn the skipped browser/link check into a pass. CI uses Bun 1.3.14 rather than the local 1.3.13.

Logs: `/tmp/methodsmith-release-audit-tests.log` and `/tmp/methodsmith-release-audit-site.log`. No fresh user-profile installation, exhaustive security review, numerical demo rerun, or competitor execution benchmark was performed.

Jev screened the substantive external sources with `pass`. Its final claim cross-check automatically supported the platform-qualification and bounded-evidence findings. The release-gating claim returned `review` (supports 0.59, contradicts 0.39, says_nothing 0.02); that advisory remains unresolved and is not counted as a passing gate. R1 rests on direct inspection of the workflow dependency graph, distinguishing GitHub release creation from the later optional npm publishing checks.

## Market comparison

This is a documentation-based competitive assessment, not a market-size estimate. GitHub stars indicate visibility, not active users, revenue, scientific correctness, or customer demand. Public pages observed approximately 352 stars for MedSci, 54.9k for Scientific Agent Skills, 25.7k for Compound Engineering, and 306k for Superpowers; Methodsmith's GitHub API returned 5 stars and 0 forks. Counts are transient and audiences differ substantially.

| Project | Competitive role | Documented strength | Implication for Methodsmith |
|---|---|---|---|
| [MedSci Skills](https://github.com/Aperivue/medsci-skills) | Closest direct competitor | Physician-researcher workflow; 54 skills, 49 guidelines/appraisal tools, simple install, reference verification, five public-data demos, DOI and preprint | Compete on reviewable analysis contracts and provenance; close onboarding and citation gaps rather than adding inventory |
| [Scientific Agent Skills](https://github.com/K-Dense-AI/scientific-agent-skills) | Broad scientific toolkit and adjacent substitute | 177 skills, many scientific domains/databases, illustrated guides, associated BYOK desktop workspace | Position Methodsmith as a focused methods workflow; test coexistence before promising interoperability |
| [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin) | Upstream workflow and engineering alternative | Brainstorm/plan/build/review/learning loop; 36 skills, 14 hosts; native Codex install described as self-contained | Credit upstream and explain the research-specific additions; investigate reducing Methodsmith's separate Codex agent-bridge setup |
| [Superpowers](https://github.com/obra/superpowers) | General engineering substitute for agent discipline | Design-first workflow, TDD, subagent execution, distribution through official marketplaces | Learn from distribution and a clear workflow story; do not treat it as a statistical-methods benchmark |

Sources above were retrieved on 2026-10-27; feature descriptions are project claims, not independently measured performance. Raw primary README sources: [MedSci](https://raw.githubusercontent.com/Aperivue/medsci-skills/main/README.md), [Scientific Agent Skills](https://raw.githubusercontent.com/K-Dense-AI/scientific-agent-skills/main/README.md), [Compound Engineering](https://raw.githubusercontent.com/EveryInc/compound-engineering-plugin/main/README.md), [Superpowers](https://raw.githubusercontent.com/obra/superpowers/main/README.md).

### Positioning recommendation

**“Reviewable research workflows for R and Python: from an approved analysis plan to traceable results.”**

The likely initial audience is quantitative clinical researchers and methods leads already using coding agents. Their problem is not access to another generic skill catalog; it is preserving decisions, assumptions, provenance, and review findings across a study. This is a positioning hypothesis, not validated customer research.

Lead with three demonstrated workflows: prespecified analysis planning; review that identifies a consequential methodological problem; and a number traced back to its producing analysis. Scope safety claims to the host and configuration actually demonstrated. Broad scientific tool coverage and “more agents” are weak differentiators against larger libraries.

The prior October 19 audit should not be treated as an unchanged backlog: current source already has reference auditing, statistic recomputation, journal selection, COI collection, the BCG demo, locale support, and generated third-party notices. Zenodo remains open as [#141](https://github.com/sajor2000/methodsmith/issues/141). A DOI would improve version citation, not establish scientific validity.

### Launch sequence and success measures

1. **Before tagging:** close R1, fix inventory and safety-scope copy, and record exact candidate SHA plus check results. Resolve or clearly isolate the local Python failure before claiming local acceptance.
2. **Before wider promotion:** shorten the README, expose the runnable demo, publish the scoped evaluation summary, and finish the versioned citation/archive path.
3. **Pilot with a small methods-focused group:** observe installation, first-plan completion, interpretation of a seeded review finding, and successful number tracing. Record time to first artifact, setup failures, consequential false assurances, and reviewer corrections. Obtain consent; use synthetic/public examples.
4. **After pilot evidence:** decide whether to expand packaging, integrations, or domains. No present evidence supports a revenue forecast, market-share claim, or scientific superiority claim.

Suggested README order: outcome and audience -> install -> one worked artifact -> three workflows -> what is enforced on each host -> evidence and limits -> concise comparison -> documentation and citation links. Keep detailed setup authoritative in `docs/setup.md` and synchronize the plugin README's shorter entry point.
