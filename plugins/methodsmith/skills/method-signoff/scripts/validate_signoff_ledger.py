#!/usr/bin/env python3
"""Validate a methodsmith multi-analyst signoff ledger."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

REQUIRED_LEDGER_FIELDS = ["ledger_id", "study_id", "entries"]
REQUIRED_ENTRY_FIELDS = ["entry_id", "reviewer", "artifact", "decision", "timestamp"]
ALLOWED_DECISIONS = {"approved", "approved-with-conditions", "changes-requested", "rejected"}


def safe_relative(value: str) -> bool:
    path = Path(value)
    return not path.is_absolute() and ".." not in path.parts


def stable_hash(entry: dict, previous_hash: str, version: int = 1) -> str:
    payload = {
        key: entry.get(key)
        for key in REQUIRED_ENTRY_FIELDS
    }
    if version == 2:
        payload.update({key: entry.get(key) for key in ("artifact_path", "artifact_sha256")})
    payload["previous_hash"] = previous_hash
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ledger", default="analysis/signoff/signoff-ledger.json")
    parser.add_argument("--project-root", default=".")
    args = parser.parse_args(argv[1:])

    if not safe_relative(args.ledger):
        print("Error: --ledger must be project-relative without '..'", file=sys.stderr)
        return 2

    root = Path(args.project_root).resolve()
    ledger_path = root / args.ledger
    if not ledger_path.resolve().is_relative_to(root) or ledger_path.is_symlink():
        print("Error: unsafe ledger path", file=sys.stderr)
        return 2
    blockers: list[str] = []
    warnings: list[str] = []

    loaded = False
    if not ledger_path.exists():
        blockers.append(f"Signoff ledger not found: {args.ledger}")
        ledger = {"entries": []}
    else:
        try:
            ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
            loaded = True
        except Exception as exc:
            blockers.append(f"Signoff ledger is not valid JSON: {exc}")
            ledger = {"entries": []}

    if not isinstance(ledger, dict):
        blockers.append("Signoff ledger must be a JSON object.")
        ledger = {"entries": []}
        loaded = False

    if loaded:
        for field in REQUIRED_LEDGER_FIELDS:
            if field not in ledger:
                blockers.append(f"Ledger missing required field '{field}' (see signoff-ledger-schema.yaml).")
            elif field != "entries" and not str(ledger.get(field) or "").strip():
                blockers.append(f"Ledger required field '{field}' is empty.")

    entries = ledger.get("entries", [])
    if not isinstance(entries, list):
        blockers.append("Ledger field 'entries' must be a list.")
        entries = []

    version = ledger.get("version", 1)
    if version not in (1, 2):
        blockers.append("Unsupported signoff ledger version.")
    if version == 1:
        warnings.append("Legacy ledger: approval is not bound to current artifact bytes.")
    warnings.append("Recorded reviewer names are not authenticated signatures; scientific review remains human-owned.")
    seen_ids: set[str] = set()
    previous_hash = ""
    for index, entry in enumerate(entries, start=1):
        if not isinstance(entry, dict):
            blockers.append(f"Entry {index} must be an object.")
            continue
        entry_id = str(entry.get("entry_id", f"entry-{index}")).strip()
        if entry_id in seen_ids:
            blockers.append(f"Duplicate entry_id: {entry_id}")
        seen_ids.add(entry_id)
        for field in REQUIRED_ENTRY_FIELDS:
            if not str(entry.get(field, "")).strip():
                blockers.append(f"{entry_id}: missing required field '{field}'")
        if entry.get("decision") and entry.get("decision") not in ALLOWED_DECISIONS:
            blockers.append(f"{entry_id}: unsupported decision '{entry.get('decision')}'")
        if version == 2:
            relative = entry.get("artifact_path")
            expected = entry.get("artifact_sha256")
            if not isinstance(relative, str) or not safe_relative(relative) or not relative:
                blockers.append(f"{entry_id}: invalid artifact path.")
            else:
                artifact = root / relative
                if not artifact.resolve().is_relative_to(root) or artifact.is_symlink() or not artifact.is_file():
                    blockers.append(f"{entry_id}: artifact unavailable or outside project.")
                elif hashlib.sha256(artifact.read_bytes()).hexdigest() != expected:
                    blockers.append(f"{entry_id}: artifact digest changed or missing; approval is stale.")
        expected_hash = stable_hash(entry, previous_hash, version)
        if entry.get("entry_hash") and entry.get("entry_hash") != expected_hash:
            blockers.append(f"{entry_id}: entry_hash does not match append-only content.")
        previous_hash = entry.get("entry_hash") or expected_hash

    if not entries:
        warnings.append("No signoff entries recorded.")

    report_path = ledger_path.with_name("signoff-validation-report.md")
    if report_path.is_symlink():
        print("Error: unsafe report path", file=sys.stderr)
        return 2
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        "\n".join([
            "# Signoff Ledger Validation Report",
            "",
            f"Result: {'BLOCKED' if blockers else 'READY-WITH-REVIEW'}",
            "",
            "## Blockers",
            *([f"- {item}" for item in blockers] or ["- None"]),
            "",
            "## Warnings",
            *([f"- {item}" for item in warnings] or ["- None"]),
        ]) + "\n",
        encoding="utf-8",
    )

    if blockers:
        for blocker in blockers:
            print(f"BLOCK: {blocker}", file=sys.stderr)
        return 1
    print(f"Signoff ledger ready with review: {args.ledger}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
