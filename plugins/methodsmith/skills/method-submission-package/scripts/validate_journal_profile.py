#!/usr/bin/env python3
"""Check a dated journal profile. This does not fetch instructions or assess meaning."""
import datetime
import hashlib
import json
from pathlib import Path
import sys
from urllib.parse import urlparse


def validate(data: dict, root: Path) -> list[str]:
    if data.get("schema_version") != 1:
        raise ValueError("unsupported schema")
    if not data.get("journal") or not data.get("article_type"):
        raise ValueError("missing journal or article type")
    url = urlparse(data["source_url"])
    if url.scheme != "https" or not url.hostname:
        raise ValueError("invalid official source URL")
    date = datetime.date.fromisoformat(data["retrieved_at"])
    if date > datetime.datetime.now(datetime.timezone.utc).date():
        raise ValueError("future retrieval date")
    rules = data["rules"]
    if not isinstance(rules, list) or not rules:
        raise ValueError("missing rules")
    ids = set()
    unresolved = []
    for rule in rules:
        if rule["id"] in ids or not rule["requirement"] or not rule["source_location"]:
            raise ValueError("invalid rule")
        ids.add(rule["id"])
        if type(rule["required"]) is not bool or rule["check_kind"] not in ("automated", "human"):
            raise ValueError("invalid rule classification")
        if rule["status"] not in ("passed", "failed", "unresolved", "not-applicable"):
            raise ValueError("invalid rule status")
        if rule["status"] == "not-applicable" and not rule.get("rationale"):
            raise ValueError("unexplained exclusion")
        if rule["status"] == "passed":
            evidence = rule["evidence"]
            path = Path(evidence["path"])
            file = root / path
            if path.is_absolute() or ".." in path.parts or not file.resolve().is_relative_to(root) or file.is_symlink():
                raise ValueError("unsafe evidence")
            if hashlib.sha256(file.read_bytes()).hexdigest() != evidence["sha256"]:
                raise ValueError("changed evidence")
            if rule["check_kind"] == "human" and not evidence.get("reviewer"):
                raise ValueError("missing human review")
        elif rule["required"] and rule["status"] != "not-applicable":
            unresolved.append(rule["id"])
    return unresolved


def main() -> int:
    try:
        path = Path(sys.argv[1]).resolve()
        unresolved = validate(json.loads(path.read_text(encoding="utf-8")), path.parent)
        print(json.dumps({"status": "blocked" if unresolved else "ready-with-review", "unresolved_required_count": len(unresolved),
                          "limitations": "source authenticity, completeness and scientific meaning require review; no submission authorized"}))
        return 1 if unresolved else 0
    except (OSError, ValueError, TypeError, KeyError, IndexError, AttributeError):
        print(json.dumps({"status": "blocked", "reason": "invalid journal profile or missing evidence"}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
