#!/usr/bin/env python3
"""Render a reviewed status projection; never include source text or protected locators."""
from __future__ import annotations
import argparse
import html
import json
import re
import sys
from pathlib import Path
from study_record import RecordError, require, identifier

FIELDS = {
    "freshness": {"current", "stale", "unavailable"},
    "provenance": {"verified", "inferred", "unknown"},
    "execution": {"unrun", "success", "failed", "unavailable"},
    "human_approval": {"recorded-current", "unapproved"},
    "coverage": {"declared", "incomplete"},
}


def project(data: dict) -> dict:
    """Reduce status data to reviewed, bounded fields and declared dependencies."""
    identifier(data["study_id"])
    require(type(data["revision"]) is int and data["revision"] >= 0, "invalid revision")
    require(bool(re.fullmatch(r"[a-f0-9]{64}", data["record_digest"])), "invalid record digest")
    require(data["coverage"] in FIELDS["coverage"], "invalid coverage")
    result = {key: data[key] for key in ("study_id", "revision", "record_digest", "coverage")}
    result["artifacts"] = {}
    for key, item in data["artifacts"].items():
        identifier(key)
        safe = {}
        for field, values in FIELDS.items():
            require(item.get(field) in values, "invalid status value")
            safe[field] = item[field]
        dependencies = item.get("dependencies", [])
        require(isinstance(dependencies, list), "invalid dependencies")
        for dep in dependencies:
            identifier(dep)
            require(dep in data["artifacts"], "unknown dependency")
        safe["dependencies"] = dependencies
        result["artifacts"][key] = safe
    return result


def render(data: dict) -> str:
    """Render the escaped snapshot table as a static, CSP-locked HTML page."""
    labels = ["Artifact", "Freshness", "Provenance", "Execution", "Human approval", "Coverage", "Depends on"]
    rows = ""
    for key, item in data["artifacts"].items():
        values = [key, *(item[f] for f in FIELDS), ", ".join(item["dependencies"]) or "Not declared"]
        rows += "<tr>" + "".join(
            f'<td data-label="{label}" data-value="{html.escape(str(value), quote=True)}">{html.escape(str(value))}</td>'
            for label, value in zip(labels, values)
        ) + "</tr>"
    return '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Study evidence snapshot</title><style>body{font:16px system-ui;max-width:1100px;margin:0;padding:0;color:var(--foreground,#18302c);background:transparent}h1{font-size:2rem}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:12px;border-bottom:1px solid #bbc9c2}.scroll{overflow:auto}.note{border-left:4px solid #98752c;padding:16px}code{overflow-wrap:anywhere}td[data-value="stale"],td[data-value="unavailable"]{font-weight:700;color:var(--warning-foreground,#986300)}@media(max-width:700px){thead{display:none}table,tbody,tr,td{display:block}caption{display:block;width:100%;text-align:left;margin-bottom:12px}tr{border:1px solid var(--border,#bbc9c2);border-radius:8px;padding:12px;margin-bottom:16px}td{display:grid;grid-template-columns:44% 56%;border:0;padding:6px 0;overflow-wrap:anywhere}td::before{content:attr(data-label);font-weight:600}h1{font-size:1.5rem}}</style><main>
<h1>Study evidence snapshot</h1>''' + f'''<p>Study {html.escape(data['study_id'])} · revision {data['revision']}</p>
<p class="note">Snapshot only. Refresh from the study record to assess current files. A completed check does not establish scientific validity or authenticate human approval. Dependency coverage: {data['coverage']}.</p>
<div class="scroll"><table><caption>Artifact evidence and decisions</caption><thead><tr><th>Artifact</th><th>Freshness</th><th>Provenance</th><th>Execution</th><th>Human approval</th><th>Coverage</th><th>Depends on</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>Next: review stale or unavailable evidence, resolve unknown provenance, then obtain any required human decision. Do not repeat work already authorized and current.</p><p>Record digest: <code>{data['record_digest']}</code></p></main></html>'''


def main() -> int:
    """Write the reviewed projection once, refusing to overwrite existing output."""
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--status", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--reviewed-for-sharing", action="store_true")
    args = p.parse_args()
    try:
        require(args.reviewed_for_sharing, "human disclosure review required, including identifiers")
        data = project(json.loads(Path(args.status).read_text()))
        output = Path(args.output)
        require(not output.is_symlink(), "unsafe output")
        with output.open("x") as stream:
            stream.write(render(data) if output.suffix == ".html" else json.dumps(data, indent=2) + "\n")
        print(json.dumps({"status": "created", "revision": data["revision"]}))
        return 0
    except (OSError, ValueError, KeyError, TypeError):
        print(json.dumps({"status": "blocked", "reason": "invalid projection, missing review or existing output"}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
