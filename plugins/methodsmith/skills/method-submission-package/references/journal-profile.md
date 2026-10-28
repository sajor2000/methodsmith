# Journal profile

Store a protected JSON profile with `schema_version: 1`, journal name, `article_type`, official HTTPS `source_url`, ISO date `retrieved_at`, and a nonempty `rules` list. Refresh source guidance at each adaptation; a valid date does not prove currency or authenticity.

Each rule has a stable `id`, paraphrased `requirement`, `source_location`, boolean `required`, `check_kind` (automated or human), and `status` (passed, failed, unresolved or not-applicable). Not-applicable requires `rationale`. Passed requires `evidence` with a profile-directory-relative `path` and `sha256`; human checks also require the actual `reviewer`. Keep checks about scientific meaning separate from mechanical word counts and styles. Retain style/template identifiers and hashes when applicable as additional profile metadata.

Execute the bundled `scripts/validate_journal_profile.py` with the absolute path to this profile, anchoring the script to this skill's directory. It checks schema, retained evidence digests and unresolved required rules. It does not fetch instructions, infer missing rules, verify the journal's authority or establish scientific equivalence. Missing Python requires an explicit manual check, never an invented validator pass.

A transfer report compares before/after abstract structure, headings, reference associations, registered numbers, figure/table captions and declarations. Preserve the previous submission and a candidate copy. Flag scientific rewrites for author review rather than silently changing meaning to fit a word limit.
