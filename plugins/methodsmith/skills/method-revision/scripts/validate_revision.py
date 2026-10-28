#!/usr/bin/env python3
"""Validate protected reviewer-round records; success means structurally valid draft only."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import re
import sys


def check(condition: bool) -> None:
    if not condition:
        raise ValueError("invalid or unsupported revision evidence")


def safe_id(value: str) -> None:
    check(isinstance(value, str) and bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}", value)))


def evidence_current(item: dict, root: Path) -> bool:
    relative = Path(item.get("path", ""))
    check(not relative.is_absolute() and ".." not in relative.parts)
    path = root / relative
    check(path.resolve().is_relative_to(root) and path.is_file() and not path.is_symlink())
    return hashlib.sha256(path.read_bytes()).hexdigest() == item.get("sha256")


def validate(record: dict, root: Path) -> dict:
    check(record.get("schema_version") == 1)
    safe_id(record["round_id"])
    baseline = record["baseline"]
    check(baseline["provenance"] in ("verified", "inferred", "unknown"))
    if baseline.get("snapshot_id"):
        safe_id(baseline["snapshot_id"])
    if baseline["provenance"] == "verified":
        check(evidence_current(baseline["evidence"], root))
    changes = record["changes"]
    check(isinstance(changes, dict))
    for key, change in changes.items():
        safe_id(key)
        check(change["kind"] in ("clarification", "reanalysis", "new-question"))
        check(change["state"] in ("proposed", "implemented", "verified", "human-approved"))
        if change["kind"] != "clarification":
            check(change.get("post_submission") is True)
            if change["state"] != "proposed":
                check(bool(change.get("authorization")))
        if change["state"] in ("verified", "human-approved"):
            check(bool(change.get("evidence")))
            check(all(evidence_current(e, root) for e in change["evidence"]))
        if change["state"] == "human-approved":
            approval = change.get("approval", {})
            check(bool(approval.get("reviewer")) and bool(approval.get("timestamp")))
            bound = {k: v for k, v in change.items() if k != "approval"}
            check(approval.get("change_digest") == hashlib.sha256(json.dumps(bound, sort_keys=True, separators=(",", ":")).encode()).hexdigest())
    comments = record["comments"]
    check(isinstance(comments, list) and bool(comments))
    seen: set[str] = set()
    for comment in comments:
        safe_id(comment["id"])
        check(comment["id"] not in seen)
        seen.add(comment["id"])
        check(bool(comment["verbatim"].strip()) and bool(comment["rationale"].strip()))
        check(comment["disposition"] in ("address", "partial", "disagree", "clarify", "pending"))
        check(comment["response_claim"] in ("proposed", "partial", "completed", "disagree"))
        check(isinstance(comment["changes"], list) and all(c in changes for c in comment["changes"]))
        if comment["response_claim"] == "completed":
            check(bool(comment["changes"]) and bool(comment.get("manuscript_location")))
            check(all(changes[c]["state"] in ("verified", "human-approved") for c in comment["changes"]))
        if comment["response_claim"] == "disagree":
            check(comment["disposition"] == "disagree")
    return {"status": "draft-only", "round_id": record["round_id"], "comments": len(comments),
            "changes": len(changes), "baseline_provenance": baseline["provenance"],
            "limitation": "structure and file digests checked; scientific claims and signatory identity require human review"}


def main() -> int:
    try:
        path = Path(sys.argv[1]).resolve()
        print(json.dumps(validate(json.loads(path.read_text(encoding="utf-8")), path.parent)))
        return 0
    except (OSError, ValueError, KeyError, TypeError, IndexError, AttributeError):
        print(json.dumps({"status": "blocked", "reason": "invalid or unsupported revision evidence; inspect protected record locally"}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
