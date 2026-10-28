#!/usr/bin/env python3
"""Bind a human disclosure review to staged Git bytes and outgoing history.

This is a review gate, not a PHI detector. It never prints filenames or blob contents.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys


def git(root: str, *args: str) -> bytes:
    return subprocess.check_output(["git", "-C", root, *args], stderr=subprocess.DEVNULL, timeout=300)


def inventory(root: str, base: str | None) -> dict:
    staged = git(root, "ls-files", "--stage", "-z")
    # Bind paths, modes and exact index blob identities without disclosing their values.
    for line in staged.split(b"\0"):
        if line and line.split(b"\t", 1)[0].split()[-1] != b"0":
            raise ValueError("unmerged index")
    head = git(root, "rev-parse", "--verify", "HEAD").decode().strip()
    base_oid = None
    outgoing = b""
    if base:
        # Resolve first and pass only object IDs into rev-list; never treat caller text as flags.
        base_oid = git(root, "rev-parse", "--verify", "--end-of-options", base + "^{commit}").decode().strip()
        outgoing = git(root, "rev-list", "--objects", "--no-object-names", head, "^" + base_oid)
    value = {"index_digest": hashlib.sha256(staged).hexdigest(), "head": head,
             "base": base_oid, "outgoing_digest": hashlib.sha256(outgoing).hexdigest(),
             "outgoing_review": "required" if base else "not-scoped"}
    value["inventory_digest"] = hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()
    return value


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--repo", required=True)
    p.add_argument("--base", help="actual destination ref; required for a push review")
    p.add_argument("--approval", help="protected JSON recording reviewed inventory_digest, reviewer and timestamp")
    args = p.parse_args()
    try:
        value = inventory(args.repo, args.base)
        if args.approval:
            review = json.loads(Path(args.approval).read_text())
            if review.get("inventory_digest") != value["inventory_digest"] or not review.get("reviewer") or not review.get("timestamp"):
                raise ValueError("missing or stale review")
            value["status"] = "review-record-matches"
        else:
            value["status"] = "awaiting-human-disclosure-review"
        print(json.dumps(value))
        return 0 if args.approval else 1
    except (OSError, ValueError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        print(json.dumps({"status": "blocked", "reason": "Git scope unavailable, unmerged index, or disclosure review missing/stale"}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
