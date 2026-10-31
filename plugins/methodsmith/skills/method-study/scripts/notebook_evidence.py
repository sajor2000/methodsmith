#!/usr/bin/env python3
"""Execute an explicitly authorized notebook into a new protected run directory."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
from datetime import datetime, timezone
from study_record import RecordError, require, local_path, digest, atomic_json, load, execution_inputs, notebook_execution_complete, require_standalone_quarto, QUARTO_PROJECT


def main() -> int:
    """Run one authorized execution into a new run directory and record run evidence."""
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", required=True)
    p.add_argument("--run-dir", required=True)
    p.add_argument("--authorized-execution", action="store_true")
    p.add_argument("--timeout", type=int, default=600)
    p.add_argument("--kernel", default="python3")
    p.add_argument("--study-root")
    p.add_argument("--study-id")
    p.add_argument("--artifact-id")
    args = p.parse_args()
    try:
        require(args.authorized_execution, "execution authorization required")
        require(1 <= args.timeout <= 86400, "invalid timeout")
        source = local_path(args.source)
        run = local_path(args.run_dir)
        require(not run.exists(), "run directory already exists")
        require(source.suffix.lower() in (".ipynb", ".py", ".rmd", ".qmd"), "unsupported notebook format")
        if source.suffix.lower() == ".qmd":
            require_standalone_quarto(source, run)
        original = digest(source)
        study_args = (args.study_root, args.study_id, args.artifact_id)
        require(not any(study_args) or all(study_args), "all study binding arguments are required")
        inputs = None
        if all(study_args):
            record = load(local_path(args.study_root), args.study_id)
            require(args.artifact_id in record["artifacts"], "unknown execution artifact")
            require(local_path(record["artifacts"][args.artifact_id]["path"]) == source, "execution source locator mismatch")
            inputs = execution_inputs(record, args.artifact_id)
        run.mkdir(mode=0o700, parents=True)
        copy = run / source.name
        shutil.copyfile(source, copy)
        os.chmod(copy, 0o600)
        evidence = {"schema_version": 1, "source_digest": original, "format": source.suffix.lower(), "status": "unrun",
                    "working_directory": str(source.parent), "started_at": datetime.now(timezone.utc).isoformat(),
                    "environment": {"python": sys.version.split()[0]}, "dependency_coverage": "incomplete"}
        evidence["execution_inputs"] = inputs
        evidence["dependency_coverage"] = "declared" if inputs and inputs["dependencies_complete"] else "incomplete"
        if source.suffix.lower() == ".ipynb":
            # A separate interpreter creates a fresh kernel. Ignore no error cells, even allowed-error tags.
            code = '''import nbformat,sys
from nbclient import NotebookClient
n=nbformat.read(sys.argv[1],as_version=4)
skipped=[]
for i,cell in enumerate(n.cells):
 if cell.cell_type == "code":
  cell.outputs=[]
  cell.execution_count=None
  if cell.source.strip() and "skip-execution" in cell.metadata.get("tags",[]): skipped.append(i)
n.metadata["methodsmith_execution"]={"skipped_code_cells":skipped}
nbformat.write(n,sys.argv[1])
if skipped: raise RuntimeError("execution exclusions require review")
c=NotebookClient(n,timeout=int(sys.argv[3]),kernel_name=sys.argv[4],allow_errors=False,force_raise_errors=True,resources={"metadata":{"path":sys.argv[2]}})
try:
 c.execute()
finally:
 nbformat.write(n,sys.argv[1])
if any(o.get("output_type")=="error" for cell in n.cells for o in cell.get("outputs",[])): raise RuntimeError("error output")
'''
            command = [sys.executable, "-c", code, str(copy), str(source.parent), str(args.timeout), args.kernel]
            available = subprocess.run([sys.executable, "-c", "import nbformat, nbclient"], capture_output=True).returncode == 0
        elif source.suffix.lower() == ".py":
            command = ["marimo", "export", "html", str(copy), "-o", str(run / "notebook.html")]
            available = bool(shutil.which("marimo"))
        elif source.suffix.lower() == ".rmd":
            command = ["Rscript", "--vanilla", "-e", 'a<-commandArgs(TRUE); knitr::opts_hooks$set(error=function(options) { options$error <- FALSE; options }); rmarkdown::render(a[1], output_dir=a[2], intermediates_dir=a[2], knit_root_dir=a[3], envir=new.env(), quiet=TRUE)', str(copy), str(run), str(source.parent)]
            available = bool(shutil.which("Rscript"))
        else:
            (run / "_quarto.yml").write_text(QUARTO_PROJECT)
            os.chmod(run / "_quarto.yml", 0o600)
            evidence["quarto_project_mode"] = "isolated-standalone"
            command = ["quarto", "render", str(copy), "--execute", "--no-cache", "--execute-daemon", "0", "--metadata", "keep-ipynb:true", "--execute-dir", str(source.parent)]
            available = bool(shutil.which("quarto"))
        if not available:
            evidence["status"] = "unavailable"
        else:
            # Logs may contain sensitive values: never echo them or include them in shared projections.
            with (run / "execution.log").open("xb") as log:
                os.chmod(log.name, 0o600)
                try:
                    process = subprocess.Popen(command, cwd=source.parent, stdout=log, stderr=log, start_new_session=True)
                    returncode = process.wait(timeout=args.timeout)
                    evidence["status"] = "success" if returncode == 0 else "failed"
                    evidence["exit_code"] = returncode
                except subprocess.TimeoutExpired:
                    try:
                        if hasattr(os, "killpg"):
                            os.killpg(process.pid, signal.SIGKILL)
                        else:
                            process.kill()
                    except ProcessLookupError:
                        pass
                    process.wait()
                    evidence["status"] = "failed"
                    evidence["reason"] = "timeout"
            if digest(source) != original:
                evidence["status"] = "failed"
                evidence["reason"] = "source changed during execution"
        if evidence["status"] == "success" and source.suffix.lower() in (".ipynb", ".qmd"):
            execution_notebook = copy if source.suffix.lower() == ".ipynb" else run / (source.stem + ".quarto_ipynb")
            if not execution_notebook.is_file():
                evidence["status"] = "unavailable"
                evidence["reason"] = "retained execution notebook unavailable; render alone cannot verify this engine"
            elif not notebook_execution_complete(execution_notebook):
                evidence["status"] = "failed"
                evidence["reason"] = "notebook execution incomplete or contains errors"
            else:
                evidence["execution_notebook"] = execution_notebook.name
        if inputs is not None:
            try:
                current_inputs = execution_inputs(load(local_path(args.study_root), args.study_id), args.artifact_id)
                require(current_inputs == inputs, "execution inputs changed")
            except (RecordError, OSError):
                evidence["status"] = "failed"
                evidence["reason"] = "declared inputs changed during execution"
        if source.suffix.lower() == ".ipynb":
            evidence["execution_coverage"] = json.loads(copy.read_text()).get("metadata", {}).get("methodsmith_execution", {})
        evidence["outputs"] = {}
        for output in sorted(run.rglob("*")):
            require(not output.is_symlink(), "unsafe retained output")
            if output.is_file():
                os.chmod(output, 0o600)
                evidence["outputs"][str(output.relative_to(run))] = digest(output)
        if source.suffix.lower() == ".ipynb":
            primary = source.name
        else:
            candidates = [name for name in evidence["outputs"] if Path(name).suffix.lower() in (".html", ".pdf", ".docx", ".tex", ".md")]
            primary = candidates[0] if candidates else None
        evidence["primary_output"] = primary
        if evidence["status"] == "success" and primary is None:
            evidence["status"] = "failed"
            evidence["reason"] = "primary execution output missing"
        evidence["completed_at"] = datetime.now(timezone.utc).isoformat()
        evidence["output_digest"] = evidence["outputs"].get(primary)
        atomic_json(run / "run.json", evidence)
        print(json.dumps({"status": evidence["status"], "source_digest": original, "dependency_coverage": evidence["dependency_coverage"]}))
        return 0 if evidence["status"] == "success" else 1
    except RecordError as exc:
        print(json.dumps({"status": "blocked", "reason": str(exc)}))
    except (OSError, ValueError):
        print(json.dumps({"status": "blocked", "reason": "notebook or runtime unavailable; inspect protected run locally"}))
    return 1


if __name__ == "__main__":
    sys.exit(main())
