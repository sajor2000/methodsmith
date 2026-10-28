#!/usr/bin/env python3
"""Protected local study records. No network calls or automatic code execution."""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from typing import Any


class RecordError(ValueError):
    """A safe, non-content-bearing diagnostic."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RecordError(message)


def identifier(value: str) -> str:
    require(isinstance(value, str) and bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}", value)), "invalid identifier")
    return value


def local_path(value: str | Path) -> Path:
    path = Path(value).expanduser().resolve()
    require(not any("dropbox" in p.lower() for p in path.parts), "Dropbox is not approved study storage")
    return path


def digest(path: Path) -> str:
    require(path.is_file(), "artifact unavailable")
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def canonical_hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def owned(root: Path, name: str) -> Path:
    path = root / name
    require(not path.is_symlink() and path.resolve().is_relative_to(root), "unsafe state path")
    return path


def atomic_json(path: Path, value: Any) -> None:
    fd, name = tempfile.mkstemp(prefix=".record-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump(value, stream, indent=2, sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


@contextlib.contextmanager
def lock(root: Path):
    target = owned(root, ".write-lock")
    try:
        target.mkdir(mode=0o700)
    except FileExistsError:
        raise RecordError("write conflict; inspect existing writer before retrying") from None
    try:
        yield
    finally:
        target.rmdir()


def validate(record: dict, study_id: str) -> None:
    require(isinstance(record, dict), "invalid record")
    require(record.get("schema_version") == 1, "unsupported schema version")
    require(record.get("study_id") == study_id, "study identity mismatch")
    require(type(record.get("revision")) is int and record["revision"] >= 0, "invalid revision")
    artifacts = record.get("artifacts")
    require(isinstance(artifacts, dict), "invalid artifacts")
    for key, item in artifacts.items():
        identifier(key)
        require(isinstance(item, dict), "invalid artifact")
        require(item.get("provenance") in ("verified", "inferred", "unknown"), "invalid provenance")
        require(item.get("execution") in ("unrun", "success", "failed", "unavailable"), "invalid execution state")
        require(isinstance(item.get("path"), str) and Path(item["path"]).is_absolute(), "invalid protected locator")
        require(isinstance(item.get("digest"), str) and bool(re.fullmatch(r"[a-f0-9]{64}", item["digest"])), "invalid digest")
        require(isinstance(item.get("dependencies"), list) and all(isinstance(d, str) for d in item["dependencies"]), "invalid dependencies")
        require(all(d in artifacts and d != key for d in item["dependencies"]), "dangling dependency")
    def visit(key: str, trail: set[str]) -> None:
        require(key not in trail, "dependency cycle")
        for dep in artifacts[key]["dependencies"]:
            visit(dep, trail | {key})
    for key in artifacts:
        visit(key, set())


def load(root: Path, study_id: str) -> dict:
    with owned(root, "study.json").open() as stream:
        record = json.load(stream)
    validate(record, study_id)
    require(record.get("root") == str(root), "study root moved; explicit migration required")
    return record


def execution_inputs(record: dict, key: str) -> dict:
    """Bind declared inputs before execution, never reconstruct them at attachment."""
    item = record["artifacts"][key]
    require(status(record)["artifacts"][key]["freshness"] == "current", "execution inputs need reconciliation")
    return {"study_id": record["study_id"], "artifact_id": key,
            "source_digest": item["digest"],
            "dependencies_complete": status(record)["artifacts"][key]["coverage"] == "declared",
            "dependencies": {d: evidence_binding(record, d) for d in item["dependencies"]}}


QUARTO_PROJECT = "project:\n  type: default\nexecute:\n  cache: false\n  freeze: false\n  daemon: false\n"


def require_standalone_quarto(source: Path, run: Path) -> None:
    for start in (source.parent, run.parent):
        for directory in (start, *start.parents):
            require(not any((directory / name).exists() for name in ("_quarto.yml", "_quarto.yaml")),
                    "inherited Quarto project settings require separate verification")
    require(not os.environ.get("QUARTO_PROFILE") and not os.environ.get("QUARTO_PROJECT_DIR"),
            "Quarto profile or project environment requires separate verification")


def execution_options_enabled(value: Any, ancestors: frozenset[int] = frozenset()) -> bool:
    """Conservative coverage for all YAML branches, including format overrides.

    External metadata is not resolved by this verifier. Even an inactive branch
    with disabled execution requires review rather than a success assertion.
    """
    if isinstance(value, (dict, list)):
        require(id(value) not in ancestors, "cyclic notebook options")
        ancestors = ancestors | {id(value)}
    if isinstance(value, dict):
        require("metadata-files" not in value and "metadata-file" not in value,
                "external execution metadata requires separate verification")
        if "tags" in value:
            tags = value["tags"]
            require(isinstance(tags, list) and all(isinstance(tag, str) for tag in tags), "invalid execution tags")
            if "skip-execution" in tags:
                return False
        if "eval" in value and value["eval"] is not True:
            return False
        if "execute" in value and not isinstance(value["execute"], dict):
            return False
        return all(execution_options_enabled(child, ancestors) for child in value.values())
    if isinstance(value, list):
        return all(execution_options_enabled(child, ancestors) for child in value)
    return True


def notebook_execution_complete(path: Path) -> bool:
    notebook = json.loads(path.read_text())
    require(isinstance(notebook, dict) and isinstance(notebook.get("cells"), list), "invalid executed notebook")
    for cell in notebook["cells"]:
        if not execution_options_enabled(cell.get("metadata", {})):
            return False
        source = "".join(cell.get("source", [])).lstrip("\ufeff").replace("\r\n", "\n")
        if cell.get("cell_type") == "code":
            option_text = "\n".join(re.findall(r"(?m)^\s*#\| ?(.*)$", source))
        elif re.match(r"\A---[ \t]*\n", source):
            frontmatter = re.match(r"\A---[ \t]*\n(.*?)(?:\n(?:---|\.\.\.)[ \t]*(?:\n|$)|\Z)", source, re.S)
            require(frontmatter is not None, "invalid notebook frontmatter")
            option_text = frontmatter.group(1)
        else:
            option_text = ""
        if not option_text.strip():
            continue
        try:
            import yaml
            options = yaml.safe_load(option_text)
        except ImportError:
            raise RecordError("PyYAML required to verify notebook execution options") from None
        except Exception:
            raise RecordError("invalid notebook execution options") from None
        require(isinstance(options, dict), "invalid notebook execution options")
        if not execution_options_enabled(options):
            return False
    cells = [c for c in notebook["cells"] if c.get("cell_type") == "code" and "".join(c.get("source", [])).strip()]
    return bool(cells) and all(type(c.get("execution_count")) is int and c["execution_count"] > 0 and
                              not any(o.get("output_type") == "error" for o in c.get("outputs", [])) for c in cells)


def validate_run_outputs(evidence_path: Path, evidence: dict) -> None:
    require(evidence.get("schema_version") == 1, "unsupported run evidence version")
    outcome = evidence.get("status")
    require(outcome in ("success", "failed", "unavailable"), "invalid run outcome")
    require(evidence.get("format") in (".ipynb", ".py", ".rmd", ".qmd"), "invalid run format")
    environment = evidence.get("environment")
    require(isinstance(environment, dict) and bool(environment) and
            all(isinstance(k, str) and isinstance(v, str) and v.strip() for k, v in environment.items()),
            "invalid run environment")
    timestamps = []
    for field in ("started_at", "completed_at"):
        value = evidence.get(field)
        require(isinstance(value, str), "invalid run timestamp")
        try:
            stamp = datetime.fromisoformat(value)
        except ValueError:
            raise RecordError("invalid run timestamp") from None
        require(stamp.tzinfo is not None, "run timestamp needs timezone")
        timestamps.append(stamp)
    require(timestamps[1] >= timestamps[0], "invalid run time order")
    inputs = evidence.get("execution_inputs")
    complete = isinstance(inputs, dict) and inputs.get("dependencies_complete") is True
    require(evidence.get("dependency_coverage") == ("declared" if complete else "incomplete"), "inconsistent run coverage")
    if outcome == "success":
        require(type(evidence.get("exit_code")) is int and evidence["exit_code"] == 0, "success requires zero exit code")
        if evidence["format"] == ".ipynb":
            coverage = evidence.get("execution_coverage")
            require(isinstance(coverage, dict) and coverage.get("skipped_code_cells") == [], "success cannot include skipped cells")
    outputs = evidence.get("outputs")
    require(isinstance(outputs, dict) and bool(outputs), "retained run outputs missing")
    primary = evidence.get("primary_output")
    if outcome == "success":
        require(isinstance(primary, str) and primary in outputs, "primary execution output missing")
        allowed = (".ipynb",) if evidence["format"] == ".ipynb" else (".html", ".pdf", ".docx", ".tex", ".md")
        require(Path(primary).suffix.lower() in allowed, "invalid primary execution output format")
        require(evidence.get("output_digest") == outputs[primary], "primary execution output digest mismatch")
    for name, expected in outputs.items():
        require(isinstance(name, str) and not Path(name).is_absolute() and ".." not in Path(name).parts,
                "unsafe run output path")
        output = owned(evidence_path.parent, name)
        require(digest(output) == expected, "retained run output changed")
    if outcome == "success" and evidence["format"] == ".qmd":
        require(evidence.get("quarto_project_mode") == "isolated-standalone", "unbound Quarto project settings")
        require("_quarto.yml" in outputs, "isolated Quarto project evidence missing")
        require(owned(evidence_path.parent, "_quarto.yml").read_text() == QUARTO_PROJECT, "Quarto project settings changed")
    if outcome == "success" and evidence["format"] in (".ipynb", ".qmd"):
        notebook = primary if evidence["format"] == ".ipynb" else evidence.get("execution_notebook")
        require(isinstance(notebook, str) and notebook in outputs, "executed notebook evidence missing")
        require(notebook_execution_complete(owned(evidence_path.parent, notebook)), "notebook execution incomplete or failed")


def status(record: dict) -> dict:
    artifacts = record["artifacts"]
    states: dict[str, dict] = {}
    def inspect(key: str) -> dict:
        if key in states:
            return states[key]
        item = artifacts[key]
        try:
            current = digest(local_path(item["path"]))
            freshness = "current" if current == item["digest"] else "stale"
        except (OSError, RecordError):
            freshness = "unavailable"
        if item.get("run"):
            try:
                run_path = local_path(item["run"]["path"])
                if digest(run_path) != item["run"]["digest"]:
                    freshness = "stale"
                validate_run_outputs(run_path, json.loads(run_path.read_text()))
            except (OSError, RecordError):
                freshness = "unavailable"
        dependencies = [inspect(dep) for dep in item["dependencies"]]
        bound = item.get("dependency_bindings", {})
        if bound != {d: evidence_binding(record, d) for d in item["dependencies"]} or any(d["freshness"] != "current" for d in dependencies):
            freshness = "stale" if freshness != "unavailable" else freshness
        approval = item.get("approval")
        binding = evidence_binding(record, key)
        approved = bool(approval and approval.get("binding") == binding and freshness == "current")
        states[key] = {"freshness": freshness, "provenance": item["provenance"],
                       "execution": item["execution"], "human_approval": "recorded-current" if approved else "unapproved",
                       "coverage": "declared" if item.get("dependencies_complete") and all(d["coverage"] == "declared" for d in dependencies) else "incomplete",
                       "dependencies": item["dependencies"]}
        return states[key]
    for key in artifacts:
        inspect(key)
    handoffs = []
    for index, handoff in enumerate(record.get("handoffs", []), start=1):
        try:
            unchanged = digest(local_path(handoff["output"])) == handoff["output_digest"]
            state = "unchanged" if unchanged else "reconciliation-required"
        except (OSError, RecordError):
            state = "unavailable"
        handoffs.append({"handoff_id": index, "state": state})
    return {"study_id": record["study_id"], "revision": record["revision"], "handoffs": handoffs,
            "record_digest": canonical_hash(record), "coverage": "declared" if artifacts and all(a.get("dependencies_complete") for a in artifacts.values()) else "incomplete",
            "artifacts": states}


def evidence_binding(record: dict, key: str) -> str:
    item = record["artifacts"][key]
    return canonical_hash({"digest": item["digest"], "execution": item["execution"],
                           "run": item.get("run"), "dependencies_complete": item.get("dependencies_complete", False),
                           "dependencies": {d: evidence_binding(record, d) for d in item["dependencies"]}})


def snapshot(root: Path, record: dict, snapshot_id: str) -> dict:
    identifier(snapshot_id)
    target = owned(root, "snapshots")
    target.mkdir(mode=0o700, exist_ok=True)
    destination = owned(target, snapshot_id)
    require(not destination.exists(), "snapshot already exists")
    current = status(record)
    require(all(x["freshness"] == "current" for x in current["artifacts"].values()), "snapshot sources changed or unavailable; reconcile first")
    scratch = Path(tempfile.mkdtemp(prefix=".snapshot-", dir=target))
    try:
        manifest = {"study_id": record["study_id"], "revision": record["revision"], "record_digest": canonical_hash(record), "artifacts": {}}
        for key, item in record["artifacts"].items():
            if item["kind"] == "data":
                # Source data remain protected in place; caller retains the corresponding immutable version.
                manifest["artifacts"][key] = {"digest": item["digest"], "preservation": "reference-only", "provenance": item["provenance"]}
                continue
            out = scratch / key
            shutil.copyfile(local_path(item["path"]), out)
            os.chmod(out, 0o600)
            require(digest(out) == item["digest"], "source changed during snapshot")
            manifest["artifacts"][key] = {"digest": item["digest"], "preservation": "copied", "provenance": item["provenance"]}
        atomic_json(scratch / "manifest.json", manifest)
        os.rename(scratch, destination)
        return {"snapshot_id": snapshot_id, "manifest_digest": canonical_hash(manifest)}
    finally:
        if scratch.exists():
            shutil.rmtree(scratch)


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", required=True)
    p.add_argument("--study-id", required=True)
    sub = p.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init")
    init.add_argument("--approved-local-root", action="store_true")
    for name in ("status", "validate"):
        sub.add_parser(name)
    add = sub.add_parser("add")
    add.add_argument("--expected-revision", type=int, required=True)
    add.add_argument("--id", required=True)
    add.add_argument("--path", required=True)
    add.add_argument("--kind", choices=["code", "notebook", "data", "plan", "table", "figure", "manuscript", "evidence"], required=True)
    add.add_argument("--depends-on", nargs="*", default=[])
    add.add_argument("--provenance", choices=["unknown", "inferred", "verified"], default="unknown")
    add.add_argument("--dependencies-complete", action="store_true")
    snap = sub.add_parser("snapshot")
    snap.add_argument("--expected-revision", type=int, required=True)
    snap.add_argument("--id", required=True)
    for name in ("refresh", "approve", "record-run", "master", "export-manuscript"):
        command = sub.add_parser(name)
        command.add_argument("--expected-revision", type=int, required=True)
        command.add_argument("--id", required=True)
        if name == "approve":
            command.add_argument("--reviewer", required=True)
            command.add_argument("--human-confirmed", action="store_true")
        if name == "record-run":
            command.add_argument("--evidence", required=True)
        if name == "master":
            command.add_argument("--human-confirmed", action="store_true")
        if name == "export-manuscript":
            command.add_argument("--output", required=True)
    return p


def main() -> int:
    args = parser().parse_args()
    try:
        root = local_path(args.root)
        identifier(args.study_id)
        if args.command == "init":
            require(args.approved_local_root, "approved local storage required")
            root.mkdir(mode=0o700, parents=True, exist_ok=True)
            require(not Path(args.root).expanduser().is_symlink(), "unsafe study root")
            with lock(root):
                require(not owned(root, "study.json").exists(), "study already exists")
                atomic_json(owned(root, "study.json"), {"schema_version": 1, "study_id": args.study_id,
                            "root": str(root), "revision": 0, "artifacts": {}, "snapshots": {}})
            result = {"study_id": args.study_id, "revision": 0}
        elif args.command in ("status", "validate"):
            result = status(load(root, args.study_id))
        else:
            with lock(root):
                record = load(root, args.study_id)
                require(record["revision"] == args.expected_revision, "revision conflict; reload before retry")
                identifier(args.id)
                if args.command == "add":
                    require(args.id not in record["artifacts"], "artifact already exists")
                    source = local_path(args.path)
                    record["artifacts"][args.id] = {"path": str(source), "kind": args.kind,
                        "digest": digest(source), "provenance": args.provenance, "execution": "unrun",
                        "dependencies": args.depends_on, "dependencies_complete": args.dependencies_complete}
                    validate(record, args.study_id)
                    record["artifacts"][args.id]["dependency_bindings"] = {d: evidence_binding(record, d) for d in args.depends_on}
                    result = {"artifact_id": args.id}
                elif args.command in ("refresh", "approve", "record-run", "master", "export-manuscript"):
                    require(args.id in record["artifacts"], "unknown artifact")
                    item = record["artifacts"][args.id]
                    current = status(record)["artifacts"][args.id]
                    if args.command == "refresh":
                        item["digest"] = digest(local_path(item["path"]))
                        item["dependency_bindings"] = {d: evidence_binding(record, d) for d in item["dependencies"]}
                        item["execution"] = "unrun"
                        item.pop("approval", None)
                        item.pop("run", None)
                    elif args.command == "approve":
                        require(args.human_confirmed and bool(args.reviewer.strip()), "named human confirmation required")
                        require(current["freshness"] == "current", "stale evidence cannot be approved")
                        require(current["coverage"] == "declared", "dependency coverage must be reviewed")
                        item["approval"] = {"reviewer": args.reviewer, "binding": evidence_binding(record, args.id),
                                            "timestamp": datetime.now(timezone.utc).isoformat()}
                    elif args.command == "record-run":
                        evidence_path = local_path(args.evidence)
                        evidence = json.loads(evidence_path.read_text())
                        require(evidence.get("source_digest") == item["digest"] and current["freshness"] == "current", "run source mismatch")
                        require(evidence.get("status") in ("success", "failed", "unavailable"), "invalid run outcome")
                        require(evidence.get("completed_at") and evidence.get("environment"), "incomplete run evidence")
                        require(evidence.get("execution_inputs") == execution_inputs(record, args.id), "run input binding mismatch; execute against current study inputs")
                        validate_run_outputs(evidence_path, evidence)
                        item["execution"] = evidence["status"]
                        item["run"] = {"path": str(evidence_path), "digest": digest(evidence_path)}
                        item.pop("approval", None)
                    elif args.command == "master":
                        require(args.human_confirmed, "manuscript authority confirmation required")
                        require(item["kind"] == "manuscript", "master must be a manuscript")
                        require(current["freshness"] == "current", "master content needs reconciliation")
                        record.setdefault("master_history", []).append(record.get("master"))
                        record["master"] = {"artifact_id": args.id, "digest": item["digest"]}
                    else:
                        require(record.get("master", {}).get("artifact_id") == args.id, "not the manuscript master")
                        require(current["freshness"] == "current" and record["master"]["digest"] == item["digest"], "master content needs reconciliation")
                        output = local_path(args.output)
                        require(output != local_path(item["path"]), "cannot overwrite master")
                        # No overwrite, even if an earlier export is unchanged. Every handoff gets a new file.
                        with output.open("xb") as stream:
                            os.chmod(output, 0o600)
                            with local_path(item["path"]).open("rb") as source:
                                shutil.copyfileobj(source, stream)
                        require(digest(output) == item["digest"], "master changed during handoff")
                        record.setdefault("handoffs", []).append({"source_id": args.id, "source_digest": item["digest"],
                            "output": str(output), "output_digest": digest(output), "reconciliation": "not-required"})
                    result = {"artifact_id": args.id}
                else:
                    result = snapshot(root, record, args.id)
                    record["snapshots"][args.id] = result
                record["revision"] += 1
                atomic_json(owned(root, "study.json"), record)
                result["revision"] = record["revision"]
        print(json.dumps(result, sort_keys=True))
        return 0
    except RecordError as exc:
        print(json.dumps({"status": "blocked", "reason": str(exc)}))
    except (OSError, ValueError, TypeError, KeyError, RecursionError, AttributeError):
        print(json.dumps({"status": "blocked", "reason": "invalid or unavailable protected record; inspect locally"}))
    return 1


if __name__ == "__main__":
    sys.exit(main())
