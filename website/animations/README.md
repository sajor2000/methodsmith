# Site animation source

`methodsmith_overview.py` is the source for the retired silent overview video.
Its MP4 is no longer committed or published; the docs home page embeds the
90-second tour (`website/static/media/methodsmith-tour.mp4`) instead. To render
the old overview locally from the repository root:

```bash
bash website/animations/render-overview-video.sh
```

The renderer uses an isolated Python 3.12 environment through `uv`; it does
not modify the repository's application dependencies. It writes
`website/static/media/methodsmith-overview.mp4` and a poster frame
(`methodsmith-overview-poster.jpg`, which needs `ffmpeg`); do not commit them.

## README diagrams

`readme_diagrams.py` is the editable source for the three README diagrams,
including the skill map (`docs/workflow-diagram.png`). The overview video and
the diagrams share one design system and one content list in `method_visuals.py`:
edit `PHASES` or `GUARDRAILS` there and re-render both so they stay in sync.

Type and colour follow the brand guide (`docs/brand/brand.md`): Source Serif 4
titles, IBM Plex Sans prose, IBM Plex Mono skill names, and the Methodsmith
mark beside the skill-map title. Both render scripts download the OFL fonts to
`/tmp` with `fetch-brand-fonts.sh` and register them for the render process
only; nothing is installed system-wide. Render the complete set after an
inventory or workflow change:

```bash
bash website/animations/render-readme-diagrams.sh
```

The script replaces only these checked-in README assets:

- `docs/workflow-diagram.png`
- `docs/methodsmith-package-workflow.png`
- `docs/methodsmith-skill-commands.png`
