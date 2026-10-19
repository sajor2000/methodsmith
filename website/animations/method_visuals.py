"""Shared design system and content for the README diagrams and the site video.

Type follows the Methodsmith brand (docs/brand/brand.md): Source Serif 4 for
titles, IBM Plex Sans for prose, IBM Plex Mono for skill names. The render
scripts download the OFL fonts with fetch-brand-fonts.sh and this module
registers them for the render process only. Without them it falls back to
Avenir Next and Menlo on macOS, or the system faces elsewhere.
"""

import os
from pathlib import Path

from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    Circle,
    Line,
    Polygon,
    RoundedRectangle,
    Text,
    VGroup,
)

# Editorial palette: warm paper, ink text, six muted phase hues that stay
# distinguishable in print and for common color-vision deficiencies.
PAPER = "#F7F5F0"
CARD = "#FFFFFF"
INK = "#1B1F27"
MUTED = "#5B6370"
FAINT = "#9AA1AB"
RULE = "#DCD8CF"
SHADOW = "#1B1F27"
EMBER = "#C2502A"  # brand accent: graphics only
EMBER_DEEP = "#A63F1C"  # brand accent for text on paper


def _register_brand_fonts():
    font_dir = Path(os.environ.get("BRAND_FONT_DIR", "/tmp/methodsmith/brand/manim-fonts"))
    files = sorted(font_dir.glob("*.[ot]tf")) if font_dir.is_dir() else []
    if not files:
        return False
    import manimpango

    return all(manimpango.register_font(str(f)) for f in files)


if _register_brand_fonts():
    SANS, MONO, SERIF = "IBM Plex Sans", "IBM Plex Mono", "Source Serif 4"
else:
    SANS, MONO, SERIF = "Avenir Next", "Menlo", "Avenir Next"

# (phase, purpose, color, [(skill, what it does)])
PHASES = (
    (
        "Frame",
        "ask a sharp question",
        "#1D4E89",
        (
            ("method-brainstorm", "compare designs, scope it"),
            ("method-question", "PICO, FINER, hypothesis"),
            ("method-pubmed", "MeSH-aware search"),
            ("method-evidence-map", "cited evidence map"),
            ("method-extract", "methods from prior papers"),
        ),
    ),
    (
        "Design",
        "size it and register it",
        "#2A7F7A",
        (
            ("method-checklist", "pick the EQUATOR guideline"),
            ("method-meta-analysis", "pool effects: REML + HKSJ"),
            ("method-power", "sample size and power"),
            ("method-trial-design", "group-sequential frontiers"),
            ("method-prereg", "OSF, CT.gov, PROSPERO"),
        ),
    ),
    (
        "Data",
        "build and trust the cohort",
        "#7A5C1E",
        (
            ("method-cohort", "index event, waterfall, SQL"),
            ("method-data-qa", "GO / NO-GO quality gate"),
            ("method-phenotype", "PPV, NPV, weighted Se/Sp"),
            ("method-clif", "ICU data-format rules"),
            ("method-omics-qc", "omics QC, batch checks"),
        ),
    ),
    (
        "Plan",
        "lock the analysis first",
        "#A61B2B",
        (
            ("method-model-choice", "justify the model choice"),
            ("method-plan", "SAP with E9(R1) estimands"),
            ("method-grill", "stress-test the plan"),
            ("method-sap-workbook", "SAP workbook companion"),
            ("method-sprint", "scoped sprints, data lock"),
        ),
    ),
    (
        "Execute",
        "run it reproducibly",
        "#5B3F8C",
        (
            ("method-work", "SAP-traceable analysis"),
            ("method-r", "R, targets, testthat"),
            ("method-marimo", "reactive Python notebooks"),
            ("method-ml-track", "hashes, splits, metrics"),
            ("method-verify", "leakage, direction, PHI gate"),
        ),
    ),
    (
        "Review",
        "check it, then publish",
        "#2F6B3B",
        (
            ("method-review", "55 specialist reviewers"),
            ("method-table1", "Table 1 by study design"),
            ("method-figure", "publication figures"),
            ("method-model-card", "calibration, fairness, limits"),
            ("method-submission-package", "submission package"),
        ),
    ),
)

GUARDRAILS = (
    ("ICH E9(R1)", "estimands in every SAP"),
    ("49", "reporting checklists"),
    ("55", "specialist reviewers"),
    ("PHI-safe", "aggregate-only outputs"),
)


def text(value, size, color=INK, weight="NORMAL", font=SANS):
    return Text(value, font=font, font_size=size, color=color, weight=weight)


def fit(mobject, max_width):
    if mobject.width > max_width:
        mobject.scale_to_fit_width(max_width)
    return mobject


def shadowed(box, offset=0.045, opacity=0.08):
    """A soft drop shadow: the same shape, offset and faintly filled."""
    shadow = box.copy().set_fill(SHADOW, opacity=opacity).set_stroke(width=0)
    shadow.shift(RIGHT * offset + DOWN * offset * 1.6)
    return VGroup(shadow, box)


def brand_mark(height=0.62, ink=INK, accent=EMBER, ground=PAPER):
    """The Methodsmith hallmark: an ink M struck into an ember plate with
    chamfered corners. Rebuilt from filled shapes on the brand's 64-unit grid
    (see docs/brand/scripts/build_brand.py); `ground` fills the plate's inside
    so the stroke reads as a ring on any background."""

    def pt(x, y):
        return [x, -y, 0]

    def plate(inset):
        x0, y0, x1, y1, c = 7 + inset, 12 + inset, 57 - inset, 52 - inset, 4 - inset * 0.414
        return Polygon(*(pt(x, y) for x, y in (
            (x0 + c, y0), (x1 - c, y0), (x1, y0 + c), (x1, y1 - c),
            (x1 - c, y1), (x0 + c, y1), (x0, y1 - c), (x0, y0 + c))))

    outer = plate(-1.7).set_fill(accent, 1).set_stroke(width=0)
    inner = plate(1.7).set_fill(ground, 1).set_stroke(width=0)
    stem, dv = 6.2, 6.2 * 1.35
    l0, l1, r0, r1, top, base, v = 18, 18 + stem, 46 - stem, 46, 20.5, 43.5, 37
    m = Polygon(*(pt(x, y) for x, y in (
        (l0, base), (l0, top), (l1, top), (32, v - dv), (r0, top), (r1, top), (r1, base),
        (r0, base), (r0, top + dv * 1.05), (32, v), (l1, top + dv * 1.05), (l1, base))))
    m.set_fill(ink, 1).set_stroke(width=0)
    return VGroup(outer, inner, m).set_height(height)


def heading(title, subtitle, width=12.6, top_buff=0.38, mark=False):
    head = text(title, 42, weight="SEMIBOLD", font=SERIF)
    if mark:
        head = VGroup(brand_mark(head.height * 1.2), head).arrange(RIGHT, buff=0.26)
    sub = text(subtitle, 20, color=MUTED)
    group = VGroup(head, sub).arrange(DOWN, buff=0.18)
    fit(group, width)
    return group


def number_badge(number, color, radius=0.2):
    disc = Circle(radius=radius, stroke_width=0).set_fill(color, opacity=1)
    label = text(str(number), 17, color="#FFFFFF", weight="BOLD").move_to(disc)
    return VGroup(disc, label)


def skill_row(name, detail, color, name_scale=1.0, detail_scale=1.0):
    dot = Circle(radius=0.045, stroke_width=0).set_fill(color, opacity=1)
    skill = text(name, 15, color=color, weight="BOLD", font=MONO).scale(name_scale)
    what = text(detail, 14, color=MUTED).scale(detail_scale)
    words = VGroup(skill, what).arrange(DOWN, aligned_edge=LEFT, buff=0.07)
    dot.next_to(skill, LEFT, buff=0.12)
    return VGroup(dot, words)


def _uniform_scales(phases, room):
    """One scale for every skill name and one for every description, so type
    stays consistent across columns instead of shrinking per item."""
    names = [text(n, 15, weight="BOLD", font=MONO).width for *_, skills in phases for n, _ in skills]
    details = [text(d, 14).width for *_, skills in phases for _, d in skills]
    return min(1.0, room / max(names)), min(1.0, room / max(details))


def phase_column(index, phase, purpose, color, skills, width=2.12, scales=(1.0, 1.0)):
    band = RoundedRectangle(
        corner_radius=0.12, width=width, height=0.16, stroke_width=0
    ).set_fill(color, opacity=1)
    badge = number_badge(index, color)
    title = fit(text(phase, 20, weight="BOLD"), width - 0.75)
    head = VGroup(badge, title).arrange(RIGHT, buff=0.12)
    sub = fit(text(purpose, 13, color=color, weight="BOLD"), width - 0.32)
    rule = Line(LEFT, RIGHT, stroke_width=1, color=RULE).set_width(width - 0.32)
    rows = VGroup(*(skill_row(n, w, color, *scales) for n, w in skills))
    rows.arrange(DOWN, aligned_edge=LEFT, buff=0.22)
    inner = VGroup(head, sub, rule, rows)
    sub.next_to(head, DOWN, buff=0.1).align_to(head, LEFT)
    rule.next_to(sub, DOWN, buff=0.16).align_to(sub, LEFT)
    rows.next_to(rule, DOWN, buff=0.22).align_to(rule, LEFT).shift(RIGHT * 0.14)
    panel = RoundedRectangle(
        corner_radius=0.12,
        width=width,
        height=inner.height + 0.78,
        stroke_color=RULE,
        stroke_width=1,
        fill_color=CARD,
        fill_opacity=1,
    )
    inner.align_to(panel, UP).shift(DOWN * 0.42)
    inner.align_to(panel, LEFT).shift(RIGHT * 0.16)
    band.align_to(panel, UP)
    return VGroup(shadowed(panel), band, inner)


def skill_map(width=2.12):
    scales = _uniform_scales(PHASES, width - 0.66)
    columns = VGroup(
        *(phase_column(i + 1, *phase, width=width, scales=scales) for i, phase in enumerate(PHASES))
    ).arrange(RIGHT, buff=0.16, aligned_edge=UP)
    tallest = max(column[0][1].height for column in columns)
    for column in columns:
        panel, shadow = column[0][1], column[0][0]
        top = panel.get_top()
        for shape in (panel, shadow):
            shape.stretch_to_fit_height(tallest)
        shift = top - panel.get_top()
        panel.shift(shift)
        shadow.shift(shift)
    return columns


def guardrail_strip(width):
    items = VGroup()
    for value, label in GUARDRAILS:
        big = text(value, 22, weight="BOLD")
        small = text(label, 13, color=MUTED)
        items.add(VGroup(big, small).arrange(DOWN, buff=0.04))
    items.arrange(RIGHT, buff=0.75)
    caption = text("Guardrails across every phase", 13, color=FAINT, weight="BOLD")
    content = VGroup(caption, items).arrange(RIGHT, buff=0.7)
    fit(content, width - 0.6)
    panel = RoundedRectangle(
        corner_radius=0.12,
        width=width,
        height=content.height + 0.42,
        stroke_color=RULE,
        stroke_width=1,
        fill_color=CARD,
        fill_opacity=1,
    ).move_to(content)
    return VGroup(shadowed(panel), content)


def _is_code(line):
    return all(tok.startswith(("/", "method-", "--")) for tok in line.replace(",", " ").split())


def step_card(index, title, detail, color, width=2.5, height=2.7):
    panel = RoundedRectangle(
        corner_radius=0.12,
        width=width,
        height=height,
        stroke_color=RULE,
        stroke_width=1,
        fill_color=CARD,
        fill_opacity=1,
    )
    band = RoundedRectangle(
        corner_radius=0.12, width=width, height=0.16, stroke_width=0
    ).set_fill(color, opacity=1)
    band.align_to(panel, UP)
    badge = number_badge(index, color, radius=0.26)
    head = fit(text(title, 21, weight="BOLD"), width - 0.3)
    lines = VGroup(
        *(
            text(line, 15, color=color, weight="BOLD", font=MONO)
            if _is_code(line)
            else text(line, 15, color=MUTED)
            for line in detail
        )
    )
    for kind in (True, False):  # scale code and prose separately so neither shrinks the other
        group = [line for line, raw in zip(lines, detail) if _is_code(raw) is kind]
        widest = max((line.width for line in group), default=0)
        if widest > width - 0.3:
            for line in group:
                line.scale((width - 0.3) / widest)
    lines.arrange(DOWN, buff=0.1)
    content = VGroup(badge, head, lines).arrange(DOWN, buff=0.2)
    content.set_x(panel.get_x()).align_to(panel, UP).shift(DOWN * 0.48)
    return VGroup(shadowed(panel), band, content)


def note_panel(title, items, width):
    """A quiet footnote panel: bold label, then items as code-or-prose chips."""
    label = text(title, 15, color=FAINT, weight="BOLD")
    chips = VGroup()
    for name, what in items:
        parts = [text(name, 15, weight="BOLD", font=MONO if _is_code(name) else SANS,
                      color=INK)]
        if what:
            parts.append(text(what, 14, color=MUTED))
        chips.add(VGroup(*parts).arrange(DOWN, buff=0.05))
    chips.arrange(RIGHT, buff=0.55)
    content = VGroup(label, chips).arrange(RIGHT, buff=0.6)
    fit(content, width - 0.6)
    panel = RoundedRectangle(
        corner_radius=0.12,
        width=width,
        height=content.height + 0.45,
        stroke_color=RULE,
        stroke_width=1,
        fill_color=CARD,
        fill_opacity=1,
    ).move_to(content)
    return VGroup(shadowed(panel), content)


def connectors(cards, color=FAINT):
    links = VGroup()
    for left, right in zip(cards[:-1], cards[1:]):
        start = left.get_right() + RIGHT * 0.03
        end = right.get_left() + LEFT * 0.03
        links.add(Line(start, end, stroke_width=2, color=color))
        links.add(Circle(radius=0.035, stroke_width=0).set_fill(color, 1).move_to(end))
    return links
