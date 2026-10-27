# HTML Rendering

## Contents

- Hard invariants
- Precedence stack for style preferences
- Format principles
- Section anatomy
- Agent-consumability rules
- Post-compose audit

This is a format-rendering reference — it describes how to render any
artifact in HTML, independent of which skill is producing it.

It is paired with a section contract (`plan-sections.md`,
`brainstorm-sections.md`, etc.) that describes *what* the artifact contains.
This reference describes *how* HTML specifically presents it. The same
content rendered by different skills shares the same HTML principles.

The HTML artifact is the *only* artifact the skill produces for that run —
output mode is exclusive (markdown OR HTML, never both). Downstream
consumers that read HTML today (`method-work`, human readers) do so directly;
the agent-consumability rules below make that work. `method-doc-review` reviews
HTML artifacts report-only — its mutation mechanics are markdown-only, so it
reports findings on an HTML artifact but never applies edits to it.

## Hard invariants

These hold regardless of which skill produced the artifact.

- **Single self-contained HTML5 file.** No companion `.css`, `.js`, or
  `.svg` files. CSS lives in `<style>`. SVG lives inline. Images are
  base64 data URIs or inline SVG. The one permitted exception is a
  `<link rel="stylesheet">` to a CDN webfont CSS endpoint (Google Fonts,
  Bunny Fonts, etc.), paired with an offline-readable fallback font stack
  so the doc remains readable if the CDN is unreachable.
- **All metadata appears as visible text — single source of truth.**
  The artifact's metadata (title, type, status, date, etc. — exact
  fields per-skill, defined in the section contract) renders as visible
  HTML elements that downstream agents and humans read. No hidden
  machine-readable copy in any form: no `<script type="application/json">`
  frontmatter block, no `data-*` attribute mirror, and no
  `<meta name="status">` / `<meta name="created">` / `<meta name="origin">`
  in `<head>` duplicating the same values that appear in the visible
  header. One representation for each value — drift across two copies is
  the failure this rule prevents.

  The text-and-attribute redundancy in `<time datetime="2026-05-12">2026-05-12</time>`
  is acceptable because the attribute is a parser hint, not a hidden copy.
- **Editable status renders as `<span class="status">{value}</span>`.**
  Downstream tooling (`method-work` shipping flip, future HTML-aware
  consumers) finds and rewrites status by selector. Embedding the
  status value inside a header `<dl>` cell (`<dt>Status</dt><dd>active</dd>`),
  inside a `<meta>` tag, or as visible text without the `class="status"`
  hook all break the flip mechanic — the consumer either can't locate
  the value or can't disambiguate it from prose. The status span may
  sit anywhere in the doc (inside the header metadata, in a stats
  strip, in a hero banner); placement is a visual choice, the selector
  shape is the contract.
- **Stable IDs as anchor IDs AND visible text.** Every ID-bearing item
  (R-IDs, U-IDs, A-IDs, F-IDs, AE-IDs, KTDs) gets `id="r1"` on its
  element AND appears as visible text inside the element (e.g., the
  text "R1." inside the table cell or heading). Downstream agents find
  the ID in source the same way they find it in markdown.
- **Source / composition signal.** A visible footer at the bottom of
  the doc names the composition timestamp and the source identifier
  (the user prompt context, the upstream brainstorm doc when one
  exists, or just the composing skill name when there's no external
  source). Example shape:
  `<footer class="composition-signal">Composed 2026-05-17T14:23Z by method-plan from <code>docs/brainstorms/...-requirements.md</code></footer>`.
  Under exclusive output mode this signal is the artifact's own
  provenance — there's no markdown sibling to reference. Omitting it
  leaves readers unable to tell how stale the rendering is.
- **ASCII identifiers.** Class names, element IDs, data attribute names
  are ASCII-only.

## Precedence stack for style preferences

Honor user style preferences in this order (highest to lowest):

1. **In-session conversation** — explicit direction the user gave this run.
2. **Preferred stylesheet reference** named in loaded agent-instruction
   context (typically `AGENTS.md` / `CLAUDE.md`, but scan loaded context;
   don't enumerate locations). The reference may be a file path
   (`docs/style.css`), a URL, a named library ("Tailwind"), or a style
   brand ("Stripe docs"). Agent-instruction files carry deliberate
   agent-aware preferences, so this tier sits above DESIGN.md.
3. **DESIGN.md** discovered on the filesystem (see "DESIGN.md discovery"
   below).
4. **Fallback default** — the opinionated palette / typography choices the
   agent makes when no preference exists.

### Active-recall at compose time

Before writing the CSS, scan loaded context for any stylesheet reference
the user has indicated for documents like this. If found and inlinable
(short local file, fetchable URL within budget), inline it into `<style>`.
If found but not inlinable (large framework, paywalled stylesheet, named
system without a fetchable source), compose CSS in its spirit — typography,
color, density cues drawn from the named system. Only fall back to the
default style when no preference signal exists.

The single-file invariant is preserved either way. External
`<link rel="stylesheet">` is permitted only for CDN webfont CSS (with the
offline fallback font stack); never link to an external stylesheet
carrying layout, color, or typography rules the doc cannot read offline.

### DESIGN.md discovery

When tier 3 of the precedence stack applies, look for a DESIGN.md file in
these locations, first match wins:

1. Worktree root (resolve via `git rev-parse --show-toplevel`).
2. `docs/DESIGN.md`.
3. `.methodsmith/DESIGN.md`.

Read once at compose time. Absent → fall through to the fallback default.

Worktree-root only — do not fall through to a main checkout. Users
working from a worktree who want HTML defaults can add DESIGN.md to the
worktree.

**DESIGN.md is a partial override, not all-or-nothing.** Real
DESIGN.md files vary widely: some are token tables, some are CSS
variables, some are prose; most cover a subset of what HTML composition
needs. Apply the tokens that fit a long-form text doc — typography roles,
text colors, contrast targets, border-radius scale, elevation primitives,
muted-vs-accent split. Skip the rest. Three specific failure modes to
defend against:

- **Scope mismatch (product UI vs doc surface).** A DESIGN.md aimed at
  product marketing or app UI may name page-surface colors, button
  states, input borders, or hero backgrounds that are tied to *that*
  surface, not to a generic doc. Page-surface colors are the canonical
  trap — `--surface: #c0f0fb` belongs on the product's marketing page,
  not on every plan or requirements doc the team writes. Extract the
  principle (the design language uses a tinted surface) rather than the
  literal value when the token is product-UI-scoped. Apply literal
  values only when the token is generic enough to transfer (text color,
  type scale ratio, radius scale, contrast ratio).
- **Partial coverage.** When DESIGN.md defines some categories but not
  others (e.g., colors but no spacing scale, typography but no
  elevation), use DESIGN.md for what it covers and the fallback default
  for what it doesn't. Do not require DESIGN.md to be complete before
  honoring it.
- **Named font without a fetchable source.** When DESIGN.md names a
  font (e.g., "Signifier", "Every") without a CDN URL or local
  `@font-face` source the agent can inline, treat the name as a hint
  about the design intent, not a literal directive. Emit a system-font
  stack in the same family (serif vs sans vs mono) and pick a weight
  that matches the intent. The single-file invariant still holds; do
  not link to an external stylesheet to fetch the named font.
- **Typography-scale mismatch.** DESIGN.md typography tokens are often
  sized for product UI — marketing pages, app screens, hero sections —
  with body text at 18-20px and headings at 32-52px. A long-form doc
  surface needs body at ~14-16px and headings at ~1.2-1.6× body. When
  the DESIGN.md size scale looks product-scaled, use the **family**,
  **weight**, and **OpenType feature** assignments (these carry the
  design language) and pick the agent's own **size scale** for the doc
  surface. Apply DESIGN.md sizes literally only when the tokens are
  clearly doc-scaled — body tokens at 14-16px, headings under ~32px.

## Format principles

These shape what "good" HTML looks like; the agent applies them per
artifact based on content.

### Readable measure, not full bleed

Long-form text is unreadable at full viewport width — past ~80 characters
per line the eye loses the return sweep and scanning slows. As a
fallback-default (precedence tier 4, overridden by in-session direction or
DESIGN.md), center the document in a content container and hold prose to a
comfortable measure.

- **Page container.** A centered column with a max-width in the ~820-960px
  band (`margin-inline: auto`) keeps the doc off the far edges of wide
  monitors while leaving room for the format's richer shapes.
- **Prose measure.** Hold running paragraphs to roughly 65-80 characters
  (`max-width: ~70ch` on text blocks). The named test: read a paragraph at
  full window width on a wide display — if the return sweep to the next
  line is effortful, the measure is too wide.
- **Let wide content break out.** Tables, diagrams, and side-by-side
  columns may use the full container width (or wider) when the content
  needs it — the measure constraint is for prose, not for everything.

Express the constraint in `ch`/`rem` rather than a single hardcoded pixel
value so it survives font-size and DESIGN.md overrides. DESIGN.md or an
in-session instruction overrides these values; this is the fallback when no
layout preference exists.

### Markdown source is content, not design

When markdown (or markdown-shaped chat context) is part of the input, use
it for semantic content — what the doc is about, what sections exist,
what facts each section establishes. Do NOT treat its bullet-vs-table
presentation choices as authoritative; re-choose the rendering per
content shape in HTML's richer affordance space. If the markdown rendered
13 requirements as a bulleted list, that does NOT mean HTML must render
them as a list — ask whether 13 items sharing `ID + body` shape deserve
a table.

### Prose is authoritative

When a visualization disagrees with the surrounding prose, the prose
governs. If they diverge, the visualization is wrong.

### Hyperlink the reference index

When the doc has a Sources & References (or equivalent reference-index)
section, hyperlink each entry to its canonical destination so readers
can open it directly. A long bare-text list of paths and ticket IDs is
the format's biggest unforced UX miss — the reader has to copy-paste
every entry into a browser or IDE.

Resolve the repo's GitHub URL once at compose time:

```bash
git remote get-url origin
```

Apply linking to three reference shapes:

- **Repo-relative code/doc paths** (`services/foo.ts`,
  `docs/solutions/bar.md`) → `<repo-url>/blob/main/<path>`.
- **Named GitHub PRs/issues** (`PR #636`, `issue #1048`) →
  `<repo-url>/pull/636` or `<repo-url>/issues/1048`.
- **Named external trackers** (Linear `ESP-1705`, Jira `PROJ-123`) →
  link only when the workspace URL is established in loaded context
  (e.g., a `linear.app/<workspace>/...` URL appeared earlier in the
  session or in `AGENTS.md`); otherwise leave as text.

**Do not invent URLs.** If `origin` isn't a GitHub URL (GitLab,
Bitbucket, internal host) and the equivalent main-tree URL pattern
isn't obvious, leave entries as `<code>` text. If the external
tracker workspace isn't established, leave as text. A broken or
guessed link is worse than no link.

**Scope: reference index only, not inline prose.** Inline `<code>`
mentions of paths or PRs inside paragraph prose stay as code or text.
Linking every mention would clutter; readers expect clickable jumps
where the doc presents itself as a reference index.

### Text contrast is local

Every text-on-background pairing must hold up on its own. A color that
works for prose on the page background does not automatically work for
a small label inside a tinted container. The most common violation:
applying a generic "muted" text variable (calibrated for prose-on-bg) to
secondary text inside an accent-soft / warn-soft / info-soft container.

Test by reading each filled shape's labels at the rendered scale. If the
subtitle or secondary text feels washed-out against the fill, the choice
is wrong for that local context — pick a color from the same family as
the fill (accent-text for accent-soft, etc.) or drop the muting entirely
and rely on font-size and weight for hierarchy.

### Body bold not colored by default

Reserve accent text color for status chips, ID chips, links, and section
borders. Do NOT color `<strong>` in body content by default. Bold weight
already carries emphasis; applying accent color to every `<strong>` in a
long list overwhelms the eye, especially in dark mode. CSS should leave
`strong` at `color: inherit` unless a specific surface (status pill, ID
chip) is being styled.

### No JS framework runtimes

A small inline `<script>` for active-section TOC tracking or anchor-
permalink behavior is acceptable. React, Vue, Svelte, or any framework
runtime is not. The single-file invariant doesn't permit framework
bundles, and the artifact's longevity doesn't warrant a build dependency.

## Section anatomy

How section types commonly render in HTML. These are patterns, not
contracts — the agent picks shapes that fit the content.

- **Summary / Problem Frame** — semantic `<section>` with prose
  paragraphs. Optionally precede with an eyebrow label (small-caps tag
  above the title) for editorial polish.
- **Requirements** — `<table>` is the default at 5+ uniform items;
  bullets at smaller counts. Concern-grouping takes precedence over the
  flat-table default: when requirements span distinct concerns, group them
  under bold inline headers (or per-group sections) first, then apply the
  5+ table default *within* each group rather than flattening the whole
  section into one table. Each row has the R-ID as visible text in
  its own column. Consider adding a "covered by" column for reverse
  traceability when ID-anchored items have downstream references in
  the same doc.
- **Implementation Units** — repeating `<article>` cards with a stable
  ID chip (visible "U1" text), a metadata strip (`<dl>` with field
  labels and values for Goal, Files, Dependencies), and secondary
  content (Approach, Test Scenarios, Verification, Patterns to Follow)
  inside `<details>` collapsibles, **default-closed**. At 3+ units the
  default-closed rule is load-bearing — rendering all units fully
  expanded turns the doc into one continuous scroll where the reader
  can't see the unit list at a glance. The metadata strip is the
  primary always-visible surface; subsection labels (`<summary>`) are
  clickable affordances for readers to expand on demand. A single unit
  with no secondary content can skip `<details>` entirely; the rule
  fires when content exists to hide. The `<dl>` strip is for *descriptive*
  fields (Goal, Files, Dependencies). A *directive* field — `Execution
  note` is the canonical case, carrying a procedural instruction the
  implementer must act on (e.g. "start with a failing integration test") —
  does not belong in the strip, where it renders as a passive pair styled
  like a date and gets skimmed past. Render it as an advisory callout (see
  Tinted callout cards in `references/html-visuals.md`) so its visual weight matches its actionability. The
  test: descriptive value -> metadata pair; something the reader must act
  on -> callout.
- **Key Technical Decisions** — repeating cards with the decision ID,
  bold decision title (often with inline code for technical
  identifiers), and prose rationale. Flat cards (not collapsibles) —
  these are reference material readers scan, not drill into.
- **Risks** — color-coded cards with status eyebrow (e.g., "RISK ·
  MITIGATED" / "OPEN · DEFERRED FOLLOW-UP") and prose body. Color of
  the left-border or accent communicates status at a glance.
- **Scope Boundaries** — callout cards with color-coded left borders
  (in-scope vs deferred vs outside) when the distinction is meaningful.

The agent picks more elaborate or simpler shapes based on what each
specific artifact's content needs.

Diagrams, wireframe mockups, and affordance idioms (sticky TOC, sub-nav, callout cards, collapsibles) live in `references/html-visuals.md`. Read it when the artifact needs any of them.

## Agent-consumability rules

Downstream agents that read HTML today (`method-work`, future consumers) read
the HTML file as text linearly, not via DOM extraction. `method-doc-review` reads
HTML report-only (see opening note). Compose so semantic
understanding is reachable in source:

- **Use semantic HTML over `<div>` soup.** `<article>` per unit card,
  `<dl>` for metadata pairs, `<table>` for tabular content, `<details>`
  / `<summary>` for collapsibles, `<section>` for top-level doc
  sections. Structure markers carry meaning to a text-reading agent.
- **Render field labels as visible text, not as attributes.** Emit
  `<dt>GOAL</dt><dd>...</dd>`, not `<dd data-field="goal">...</dd>`.
  The label is the semantic anchor.
- **Keep U-IDs, R-IDs, and similar as visible text** in headings and
  table cells, not only as `id=""` attributes. The agent finds "U1." in
  source the same way it finds "U1." in markdown.
- **Match section heading vocabulary to what the section contract
  defines.** When the section contract says "Implementation Units," the
  HTML heading is "Implementation Units" — not "How we'll build it,"
  even if the narrative version reads better. Section heading
  vocabulary is the contract downstream consumers grep for. (Editorial
  re-titles can appear as eyebrow labels, sub-headings, or visual
  framing — but the load-bearing section heading matches the contract
  name.)
- **All semantic content lives in actual HTML text.** No CSS `::before
  { content: "..." }` carrying meaning, no background images as
  content, no semantic info that only renders. Whatever the agent sees
  in source is what it knows.
- **Stable structure is the public API.** Element types, the ID and
  label scheme, and the field-label vocabulary do not break across
  versions. Visual styling can change freely.

## Post-compose audit

Before returning the artifact, scan it for common slips:

- **Single self-contained file.** No companion `.css` / `.js` / `.svg`.
- **No hidden machine-readable metadata copy.** No
  `<script type="application/json">` frontmatter block, no `data-*`
  attributes mirroring visible values, **no `<meta name="status">` /
  `<meta name="created">` / `<meta name="origin">` etc. in `<head>`
  duplicating the visible header**. Metadata lives in visible text;
  one source of truth per value.
- **Status renders as `<span class="status">{value}</span>`** so
  downstream tooling can flip `active → completed` by selector.
- **All stable IDs** appear as both `id=""` and visible text.
- **Section heading vocabulary** matches the section contract names
  (downstream agents grep these).
- **Source / composition signal** is present as a visible footer at
  the bottom of the doc (composition timestamp + source identifier).
- **Repeating cards with 3+ instances put secondary content inside
  default-closed `<details>`.** Fully-expanded unit cards in a long
  Implementation Units section is a failure mode — the reader can't see
  the unit list at a glance. Verify by skimming the rendered units:
  each `<article>` should render as its ID + title + metadata strip
  with collapsibles below, not as one long block.
- **Within-section sub-nav** is present for sections with 6+ repeating
  cards.
- **Body `<strong>`** is not colored with accent palette.
- **`<details>`** inside repeating cards have no `open` attribute.
- **Diagram labels** are legible — no arrow paths crossing text,
  halo width appropriate for font size.
- **Diagrams complement prose, not replace it.** Every relationship a
  diagram conveys is also present in the surrounding IDed prose; no
  content lives only in an SVG.
- **No JS framework runtimes** included. Small inline `<script>` for
  active-section TOC tracking or anchor-permalink behavior is the only
  acceptable JS.
- **Each heading level** is visually distinct from others and from
  inline bold.
- **No template placeholders** (`{skill}`, `<value>`, `[plan title]`)
  leaked into output.
- **No process exhaust** callouts in the artifact.
