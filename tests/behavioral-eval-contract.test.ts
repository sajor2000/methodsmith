import { afterEach, describe, expect, test } from "bun:test"
import { createHash } from "crypto"
import {
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "fs/promises"
import os from "os"
import path from "path"
import { dump } from "js-yaml"
import {
  buildEvaluationManifest,
  findCaseById,
  loadAndValidateCase,
  resolveEvaluationRunDir,
  scoreEvaluationRun,
  sha256File,
  sha256Target,
  validateAllCases,
  writeEvaluationArtifacts,
  type EvaluationCase,
  type EvaluationCriterion,
} from "../scripts/evals/lib"

const tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function makeRepo(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "method-behavioral-eval-"))
  tempRoots.push(root)
  await mkdir(path.join(root, "evals", "methodsmith", "cases", "sample"), { recursive: true })
  await mkdir(path.join(root, "plugins", "methodsmith", "skills", "sample"), {
    recursive: true,
  })
  await writeFile(
    path.join(root, "plugins", "methodsmith", "skills", "sample", "SKILL.md"),
    "# Sample skill\n",
  )
  await writeFile(
    path.join(root, "evals", "methodsmith", "cases", "sample", "prompt.md"),
    "Use the sample skill.\n",
  )
  await writeFile(path.join(root, "fixture.txt"), "fixture contents\n")
  return root
}

function sampleCase(overrides: Partial<EvaluationCase> = {}): EvaluationCase {
  return {
    schema_version: "1.0",
    id: "sample-case",
    target: {
      kind: "skill",
      name: "sample",
      source: "plugins/methodsmith/skills/sample/SKILL.md",
    },
    mode: "forward",
    prompt_path: "evals/methodsmith/cases/sample/prompt.md",
    fixtures: [
      {
        path: "fixture.txt",
        destination: "workspace/fixture.txt",
        sha256: "6c846f500e74439d5a2d4ac6012759970373b4d59e352b0a95a0b83306566b78",
      },
    ],
    required_behaviors: ["required-output", "numeric-value", "evidence-set", "source-unchanged"],
    prohibited_behaviors: ["no-secret"],
    criteria: [
      {
        id: "required-output",
        description: "Required text appears",
        type: "text_contains",
        path: "response.md",
        value: "complete",
        weight: 2,
        hard_gate: false,
      },
      {
        id: "numeric-value",
        description: "Numeric value is within tolerance",
        type: "numeric",
        path: "response.md",
        pattern: "score:\\s*([0-9.]+)",
        expected: 3.14,
        tolerance: 0.01,
        weight: 1,
        hard_gate: false,
      },
      {
        id: "evidence-set",
        description: "Evidence IDs match regardless of order",
        type: "json_set_equals",
        path: "evidence.json",
        json_path: "evidence",
        expected: ["row-1", "row-2"],
        weight: 1,
        hard_gate: false,
      },
      {
        id: "no-secret",
        description: "Credential-like text is absent",
        type: "text_not_contains",
        path: "response.md",
        value: "sk-ant-",
        weight: 1,
        hard_gate: true,
      },
      {
        id: "source-unchanged",
        description: "The copied source fixture remains unchanged",
        type: "file_unchanged",
        path: "workspace/fixture.txt",
        fixture_path: "fixture.txt",
        weight: 1,
        hard_gate: true,
      },
    ],
    threshold: 0.85,
    limitations: ["Synthetic fixture only."],
    ...overrides,
  }
}

async function writeCase(root: string, definition: EvaluationCase): Promise<string> {
  const casePath = path.join(root, "evals", "methodsmith", "cases", "sample", "case.yaml")
  await writeFile(casePath, dump(definition, { noRefs: true, lineWidth: 100 }))
  return casePath
}

async function writeRun(root: string, response = "complete\nscore: 3.145\n"): Promise<string> {
  const runDir = path.join(root, "run")
  await mkdir(runDir, { recursive: true })
  await writeFile(path.join(runDir, "response.md"), response)
  await writeFile(path.join(runDir, "evidence.json"), JSON.stringify({ evidence: ["row-2", "row-1"] }))
  await mkdir(path.join(runDir, "workspace"), { recursive: true })
  await copyFile(path.join(root, "fixture.txt"), path.join(runDir, "workspace", "fixture.txt"))
  await writeFile(
    path.join(runDir, "run.json"),
    JSON.stringify({
      schema_version: "1.0",
      case_id: "sample-case",
      case_sha256: await sha256File(
        path.join(root, "evals", "methodsmith", "cases", "sample", "case.yaml"),
      ),
      prompt_sha256: await sha256File(
        path.join(root, "evals", "methodsmith", "cases", "sample", "prompt.md"),
      ),
      target_sha256: await sha256Target(
        path.join(root, "plugins", "methodsmith", "skills", "sample", "SKILL.md"),
      ),
      runner: "skill-creator",
      model: "test-model",
      started_at: "2026-07-29T12:00:00.000Z",
      completed_at: "2026-07-29T12:01:00.000Z",
      output_path: "response.md",
    }),
  )
  return runDir
}

async function scoreCode(source: string, language: "python" | "r" = "python") {
  const root = await makeRepo()
  const base = sampleCase()
  const definition: EvaluationCase = {
    ...base,
    required_behaviors: [...base.required_behaviors, "nested-tuning"],
    criteria: [...base.criteria, {
      id: "nested-tuning", description: "Tune within training folds",
      type: "code_query", path: "model.code", language,
      query: "tuning_inside_resampling", weight: 2, hard_gate: true,
    }],
  }
  const casePath = await writeCase(root, definition)
  const runDir = await writeRun(root)
  await writeFile(path.join(runDir, "model.code"), source)
  return scoreEvaluationRun({
    repoRoot: root, casePath, definition: await loadAndValidateCase(root, casePath), runDir,
  })
}

describe("behavioral evaluation contract", () => {
  test.each([["source", false], ["target", false], ["rebound-source", true]] as const)(
    "tracks tuple label sharing through a %s mutation",
    async (mutation, expected) => {
      const report = await scoreCode(`
from sklearn.model_selection import GridSearchCV
for train, test in outer.split(frame):
    labels = frame.iloc[train]["outcome"]
    X, y = frame.iloc[train][["feature"]], labels
    ${mutation === "rebound-source" ? 'labels = frame.iloc[test]["outcome"]' : "pass"}
    ${mutation === "target" ? "y" : "labels"}.iloc[0] = frame.iloc[test]["outcome"].iloc[0]
    selected = GridSearchCV(model, grid).fit(X, y)
`)
      expect(report.pass).toBe(expected)
    },
  )

  test("bare partial writes do not launder the remaining held-out labels", async () => {
    const report = await scoreCode(`
from sklearn.model_selection import GridSearchCV
for train, test in outer.split(frame):
    local = frame.iloc[train].reset_index(drop=True)
    X = local[["feature"]]
    y = frame.iloc[test]["outcome"].reset_index(drop=True)
    y[0] = frame.iloc[train]["outcome"].iloc[0]
    selected = GridSearchCV(model, grid).fit(X, y)
`)
    expect(report.pass).toBe(false)
  })

  test.each([["alias.iloc[0]", false], ["alias[0]", false], ["alias.loc[0]", true]] as const)(
    "tracks mutation through %s while respecting an unconditional alias rebind=%s",
    async (accessor, rebind) => {
      const report = await scoreCode(`
from sklearn.model_selection import GridSearchCV
for train, test in outer.split(frame):
    X, y = frame.iloc[train][["feature"]], frame.iloc[train]["outcome"]
    alias = y
    ${rebind ? 'alias = frame.iloc[test]["outcome"]' : "pass"}
    ${accessor} = frame.iloc[test]["outcome"].iloc[0]
    selected = GridSearchCV(model, grid).fit(X, y)
`)
      expect(report.pass).toBe(rebind)
    },
  )

  test("does not discard alias taint after a conditional rebind", async () => {
    const report = await scoreCode(`
from sklearn.model_selection import GridSearchCV
for train, test in outer.split(frame):
    X, y = frame.iloc[train][["feature"]], frame.iloc[train]["outcome"]
    alias = y
    if condition:
        alias = frame.iloc[test]["outcome"]
    alias.iloc[0] = frame.iloc[test]["outcome"].iloc[0]
    selected = GridSearchCV(model, grid).fit(X, y)
`)
    expect(report.pass).toBe(false)
  })

  test.each(["iloc[:]", "loc[:]", "iloc[0]", "loc[0]", "iloc[0:1]"])(
    "rejects held-out labels written through %s after a training-only tuple assignment",
    async (accessor) => {
      const report = await scoreCode(`
from sklearn.model_selection import GridSearchCV
for train, test in outer.split(frame):
    X, y = frame.iloc[train][["feature"]], frame.iloc[train]["outcome"]
    y.${accessor} = frame.iloc[test]["outcome"].iloc[0]
    selected = GridSearchCV(model, grid).fit(X, y)
`)
      expect(report.pass).toBe(false)
    },
  )

  test.each([["full", "train", false], ["train", "train", true], ["train", "test", false]] as const)(
    "preserves original %s provenance when a %s value partially replaces it",
    async (original, replacement, expected) => {
      const originalRows = original === "full" ? "frame" : "frame.iloc[train]"
      const report = await scoreCode(`
from sklearn.model_selection import GridSearchCV
for train, test in outer.split(frame):
    X = frame.iloc[train][["feature"]]
    y = ${originalRows}["outcome"]
    y.iloc[0] = frame.iloc[${replacement}]["outcome"].iloc[0]
    selected = GridSearchCV(model, grid).fit(X, y)
`)
      expect(report.pass).toBe(expected)
    },
  )

  test.each([["train", true], ["test", false], ["full", false]] as const)(
    "keeps destructured feature/label assignments confined to %s labels",
    async (labels, expected) => {
      const labelInput = labels === "full" ? 'frame["outcome"]' : `frame.iloc[${labels}]["outcome"]`
      const report = await scoreCode(`
from sklearn.model_selection import GridSearchCV
def choose(frame, labels):
    frame = frame.reset_index(drop=True)
    X, y = frame[["feature"]], labels.to_numpy()
    search = GridSearchCV(model, grid)
    return search.fit(X, y)
for fold, (train, test) in enumerate(outer.split(frame), start=1):
    selected = choose(frame.iloc[train], ${labelInput})
`)
      expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(expected)
      expect(report.pass).toBe(expected)
    },
  )

  test.each([["train", "reset_index", true], ["test", "reset_index", false],
    ["full", "reset_index", false], ["train", "reindex", false]] as const)(
    "tracks %s rows through %s without admitting held-out or full-data tuning",
    async (rows, method, expected) => {
      const input = rows === "full" ? "frame" : `frame.iloc[${rows}]`
      const report = await scoreCode(`
from sklearn.model_selection import GridSearchCV
def choose(frame):
    frame = frame.${method}(drop=True)
    search = GridSearchCV(model, grid)
    return search.fit(frame[["feature"]], frame["outcome"])
for fold, (train, test) in enumerate(outer.split(frame), start=1):
    selected = choose(${input})
`)
      expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(expected)
      expect(report.pass).toBe(expected)
    },
  )

  test("does not manufacture a training alias from a dead branch or another helper's scope", async () => {
    for (const source of [
      `from sklearn.model_selection import GridSearchCV
for train, test in outer.split(X, y):
    subset_X = X[test]
    subset_y = y[test]
    if False:
        subset_X = X[train]
        subset_y = y[train]
    search = GridSearchCV(model, grid)
    search.fit(subset_X, subset_y)
`,
      `from sklearn.model_selection import GridSearchCV
def ignore_arguments(a, b):
    return X, y
def choose(X, y):
    fit_X, fit_y = ignore_arguments(X, y)
    search = GridSearchCV(model, grid)
    return search.fit(fit_X, fit_y)
for train, test in outer.split(X, y):
    chosen = choose(X[train], y[train])
`,
    ]) {
      const report = await scoreCode(source)
      expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(false)
    }
  })

  test("honors a global callable replacement inside an assessment entry point", async () => {
    const report = await scoreCode(`
from sklearn.model_selection import GridSearchCV
def choose(X, y):
    search = GridSearchCV(model, grid)
    return search.fit(X, y)
def fixed(X, y):
    return model.fit(X, y)
choose = fixed
def assess(X, y):
    for train, test in outer.split(X, y):
        fitted = choose(X[train], y[train])
`)
    expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(false)
  })

  test("keeps an outer assessment loop when its training-only grid is inline", async () => {
    const report = await scoreCode(`
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss
for train, test in outer.split(X, y):
    records = []
    for C in GRID:
        for a, b in inner.split(X[train], y[train]):
            fitted = LogisticRegression(C=C).fit(X[train][a], y[train][a])
            loss = log_loss(y[train][b], fitted.predict_proba(X[train][b])[:, 1])
        records.append((loss, C))
    selected = min(records)[1]
`)
    expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(true)
    expect(report.pass).toBe(true)
  })

  test("resolves visible callable bindings instead of stale helpers or constructor spellings", async () => {
    const helper = `from sklearn.model_selection import GridSearchCV
def choose(X, y):
    search = GridSearchCV(model, grid)
    return search.fit(X, y)
def fixed(X, y):
    return model.fit(X, y)
`
    const loop = "for train, test in outer.split(X, y):\n    selected = choose(X[train], y[train])\n"
    for (const source of [
      helper + "choose = fixed\n" + loop,
      `def choose(X, y):
    return model.fit(X, y)
def unused():
    def choose(X, y):
        search = GridSearchCV(model, grid)
        return search.fit(X, y)
` + loop,
      helper.replace("from sklearn.model_selection import GridSearchCV",
        "from sklearn.linear_model import LogisticRegression as GridSearchCV") + loop,
    ]) {
      const report = await scoreCode(source)
      expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(false)
      expect(report.pass).toBe(false)
    }
    const aliased = await scoreCode(helper.replaceAll("GridSearchCV", "Search")
      .replace("import Search", "import GridSearchCV as Search") + loop)
    expect(aliased.pass).toBe(true)
  })

  test("rejects a decorative candidate grid whose fit helper ignores the candidate", async () => {
    const report = await scoreCode(`
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss
def fixed(X, y, C):
    return LogisticRegression(C=1).fit(X, y)
def choose(X, y):
    records = []
    for C in GRID:
        fitted = fixed(X, y, C)
        records.append((log_loss(y, fitted.predict_proba(X)[:, 1]), C))
    return min(records)[1]
for train, test in outer.split(X, y):
    selected = choose(X[train], y[train])
`)
    expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(false)
    expect(report.pass).toBe(false)
  })

  test("rejects grid selection using outer-held-out losses even when candidate fits use training rows", async () => {
    const report = await scoreCode(`
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss
def choose(X, y, evaluation_X, evaluation_y):
    records = []
    for C in GRID:
        fitted = LogisticRegression(C=C).fit(X, y)
        loss = log_loss(evaluation_y, fitted.predict_proba(evaluation_X)[:, 1])
        records.append((loss, C))
    return min(records)[1]
for train, test in outer.split(X, y):
    selected = choose(X[train], y[train], X[test], y[test])
`)
    expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(false)
    expect(report.pass).toBe(false)
  })

  test("rejects reassigned training indices in both the loop and its helper", async () => {
    for (const source of [
      `from sklearn.model_selection import GridSearchCV
for train, test in outer.split(X, y):
    train = test
    search = GridSearchCV(model, grid)
    search.fit(X[train], y[train])
`,
      `from sklearn.model_selection import GridSearchCV
def choose(X, y, rows, heldout_rows):
    rows = heldout_rows
    search = GridSearchCV(model, grid)
    return search.fit(X[rows], y[rows])
for train, test in outer.split(X, y):
    selected = choose(X, y, train, test)
`,
    ]) {
      const report = await scoreCode(source)
      expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(false)
      expect(report.pass).toBe(false)
    }
  })

  test("accepts annotation-only statements in a valid manual selector", async () => {
    const report = await scoreCode(`
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss
def choose(X, y):
    best_loss = float("inf")
    for C in GRID:
        for a, b in inner.split(X, y):
            fitted = LogisticRegression(C=C).fit(X[a], y[a])
            loss = log_loss(y[b], fitted.predict_proba(X[b])[:, 1])
        if loss < best_loss:
            selected: float
            selected, best_loss = C, loss
    return selected
for train, test in outer.split(X, y):
    selected = choose(X[train], y[train])
`)
    expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(true)
  })

  test("resolves Python keyword arguments in fits and helper calls without masking leakage", async () => {
    for (const source of [
      `from sklearn.model_selection import GridSearchCV
for train, test in outer.split(X, y):
    search = GridSearchCV(model, grid)
    search.fit(X=X[train], y=y[train])
`,
      `from sklearn.model_selection import GridSearchCV
def select_model(X, y):
    search = GridSearchCV(model, grid)
    return search.fit(X, y)
for train, test in outer.split(X, y):
    fitted = select_model(y=y[train], X=X[train])
`,
    ]) {
      const report = await scoreCode(source)
      expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(true)
      expect(report.pass).toBe(true)
    }
    const leaked = await scoreCode(`from sklearn.model_selection import GridSearchCV
for train, test in outer.split(X, y):
    search = GridSearchCV(model, grid)
    search.fit(X=X[test], y=y[test])
`)
    expect(leaked.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(false)
    expect(leaked.pass).toBe(false)
  })

  test("keeps training-only nested and helper-owned calibration loops out of assessment classification", async () => {
    const header = `from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV
from sklearn.model_selection import StratifiedKFold
`
    const inline = `${header}for train, test in outer.split(X, y):
    search = GridSearchCV(model, grid)
    search.fit(X[train], y[train])
    calibrators = []
    for cal_train, cal_valid in StratifiedKFold(n_splits=5).split(X[train], y[train]):
        calibrator = LogisticRegression()
        calibrator.fit(X[train][cal_train], y[train][cal_train])
        calibrators.append(calibrator)
`
    const owned = `${header}def calibrate(X_dev, y_dev):
    calibrators = []
    for cal_train, cal_valid in StratifiedKFold(n_splits=5).split(X_dev, y_dev):
        calibrator = LogisticRegression()
        calibrator.fit(X_dev[cal_train], y_dev[cal_train])
        calibrators.append(calibrator)
    return calibrators
for train, test in outer.split(X, y):
    search = GridSearchCV(model, grid)
    search.fit(X[train], y[train])
    fitted = calibrate(X[train], y[train])
`
    for (const source of [inline, owned]) {
      const report = await scoreCode(source)
      expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed,
        JSON.stringify(report.criteria.find((criterion) => criterion.id === "nested-tuning"))).toBe(true)
      expect(report.pass).toBe(true)
    }
    const leakyInline = `${header}for train, test in outer.split(X, y):
    search = GridSearchCV(model, grid)
    search.fit(X[train], y[train])
    for cal_train, cal_valid in StratifiedKFold(n_splits=5).split(X, y):
        calibrator = LogisticRegression()
        calibrator.fit(X, y)
`
    const leakyOwned = owned
      .replace("calibrator.fit(X_dev[cal_train], y_dev[cal_train])", "calibrator.fit(X_dev, y_dev)")
      .replace("fitted = calibrate(X[train], y[train])", "fitted = calibrate(X, y)")
    const mixedCallSitesOwned = owned.replace(
      "fitted = calibrate(X[train], y[train])",
      "fitted = calibrate(X[train], y[train])\n    leaked = calibrate(X, y)",
    )
    expect(leakyOwned).not.toBe(owned)
    for (const source of [leakyInline, leakyOwned, mixedCallSitesOwned]) {
      const report = await scoreCode(source)
      expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(false)
      expect(report.pass).toBe(false)
    }
  })

  test("validates the closed code-query contract and rejects unsupported languages or queries", async () => {
    const root = await makeRepo()
    const base = sampleCase()
    const valid = {
      id: "nested-tuning", description: "Training-only tuning", type: "code_query",
      path: "model.py", language: "python", query: "tuning_inside_resampling",
      weight: 1, hard_gate: true,
    }
    for (const [override, message] of [
      [{ language: undefined }, /language must be python or r/],
      [{ language: "julia" }, /language must be python or r/],
      [{ query: undefined }, /query must be tuning_inside_resampling/],
      [{ query: "(for_statement" }, /query must be tuning_inside_resampling/],
      [{ query: "run_arbitrary_query" }, /query must be tuning_inside_resampling/],
    ] as const) {
      const casePath = path.join(root, "evals/methodsmith/cases/sample/case.yaml")
      await writeFile(casePath, dump({
        ...base,
        required_behaviors: [...base.required_behaviors, "nested-tuning"],
        criteria: [...base.criteria, { ...valid, ...override }],
      }))
      await expect(loadAndValidateCase(root, casePath)).rejects.toThrow(message)
    }
  })

  test("rejects full, held-out, fit-only, inner-loop, and calibration-distraction scaffolds independently", async () => {
    const helper = `from sklearn.model_selection import GridSearchCV
def choose(X, y):
    search = GridSearchCV(model, grid)
    return search.fit(X, y)
`
    const sources = [
      helper + "chosen = choose(X, y)\nfor train, test in outer.split(X, y):\n    fitted = model.fit(X[train], y[train])\n",
      helper + "for train, test in outer.split(X, y):\n    chosen = choose(X, y)\n",
      helper + "for train, test in outer.split(X, y):\n    chosen = choose(X[test], y[test])\n",
      helper + "for train, test in outer.split(X, y):\n    chosen = choose(X[train], y[test])\n",
      helper + "for train, test in outer.split(X, y):\n    good = choose(X[train], y[train])\n    bad = choose(X, y)\n",
      helper + `def misleading(X, y):
    for inner_train, valid in inner.split(X, y):
        chosen = choose(X[inner_train], y[inner_train])
for train, test in outer.split(X, y):
    fitted = misleading(X, y)
`,
      helper + `for calibration_train, calibration_test in calibration.split(X, y):
    adjusted = choose(X[calibration_train], y[calibration_train])
chosen = choose(X, y)
for train, test in outer.split(X, y):
    fitted = model.fit(X[train], y[train])
`,
      helper + `def GridSearchCV(model, grid):
    return model
for train, test in outer.split(X, y):
    selected = choose(X[train], y[train])
`,
      helper + `for train, test in outer.split(X, y):
    if False:
        chosen = choose(X[train], y[train])
    fitted = model.fit(X[train], y[train])
`,
      '# for train, test in outer.split(X, y): choose(X[train], y[train])\n',
      "for train, test in outer.split(X, y):\n    broken = (\n",
    ]
    for (const [index, source] of sources.entries()) {
      const report = await scoreCode(source)
      expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed,
        `adversarial scaffold ${index}`).toBe(false)
      expect(report.hard_gates_passed).toBe(false)
      expect(report.pass).toBe(false)
    }
    for (const training of ["rsample::assessment(fold)", "all_rows"]) {
      const report = await scoreCode(`
for (fold in folds$splits) {
  training <- ${training}
  selected <- tune::tune_grid(model, resamples = rsample::vfold_cv(training))
}
`, "r")
      expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(false)
      expect(report.pass).toBe(false)
    }
  })

  test.each([["train", true], ["test", false]] as const)(
    "follows the actual %s index into a helper rather than trusting its name",
    async (index, expected) => {
      const report = await scoreCode(`
from sklearn.model_selection import GridSearchCV
def choose(X, y, rows):
    search = GridSearchCV(model, grid)
    return search.fit(X[rows], y[rows])
for train, test in outer.split(X, y):
    selected = choose(X, y, ${index})
`)
      expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(expected)
      expect(report.pass).toBe(expected)
    },
  )

  test.each(["min(records)[1]", "GRID[int(np.argmin(means))]"])(
    "recognizes explicit loss-series selection by %s",
    async (selection) => {
      const report = await scoreCode(`
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss
def columns(frame):
    return frame["features"], frame["outcome"]
def fit_candidate(frame, C):
    X, y = columns(frame)
    return LogisticRegression(C=C).fit(X, y)
def select_model(frame):
    records = []
    losses = np.empty((len(GRID), 5))
    for i, C in enumerate(GRID):
        for j, (a, b) in enumerate(inner.split(frame)):
            fitted = fit_candidate(frame.iloc[a], C)
            loss = log_loss(frame.iloc[b]["outcome"], fitted.predict_proba(frame.iloc[b])[:, 1])
            losses[i, j] = loss
        records.append((float(np.mean(losses[i])), C))
    means = np.mean(losses, axis=1)
    return ${selection}
for train, test in outer.split(frame):
    selected = select_model(frame.iloc[train])
`)
      expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed,
        JSON.stringify(report.criteria)).toBe(true)
      expect(report.pass).toBe(true)
    },
  )

  test("recognizes a search estimator fitted through one checked-fit helper", async () => {
    const report = await scoreCode(`
from sklearn.model_selection import GridSearchCV
def checked(estimator, X, y):
    return estimator.fit(X, y)
def select_model(X, y):
    search = GridSearchCV(model, grid)
    return checked(search, X, y)
for train, test in splitter.split(X, y):
    selected = select_model(X[train], y[train])
`)
    expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(true)
    expect(report.pass).toBe(true)
  })

  test("tracks a typed record's row-subset helper into the tuning fit", async () => {
    const report = await scoreCode(`
from dataclasses import dataclass
from sklearn.model_selection import GridSearchCV
@dataclass
class Batch:
    X: object
    y: object
def subset(data, indices):
    return Batch(data.X[indices], data.y[indices])
def select_model(data: Batch):
    search = GridSearchCV(model, grid)
    return search.fit(data.X, data.y)
for train, test in splitter.split(data.X, data.y):
    selected = select_model(subset(data, train))
`)
    expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(true)
    expect(report.pass).toBe(true)
  })

  test("does not count uncalled helpers or rebound full-data parameters as in-fold tuning", async () => {
    for (const source of [
      `from sklearn.model_selection import GridSearchCV
for train, test in splitter.split(X, y):
    def unused():
        search = GridSearchCV(model, grid)
        return search.fit(X[train], y[train])
    fitted = model.fit(X[train], y[train])
`,
      `from sklearn.model_selection import GridSearchCV
def misleading(X, y):
    X = full_X
    y = full_y
    search = GridSearchCV(model, grid)
    return search.fit(X, y)
for train, test in splitter.split(X, y):
    fitted = misleading(X[train], y[train])
`,
    ]) {
      const report = await scoreCode(source)
      expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(false)
      expect(report.hard_gates_passed).toBe(false)
      expect(report.pass).toBe(false)
    }
  })

  test("scores R tuning on analysis rows inside an rsample outer loop without running R", async () => {
    const report = await scoreCode(`
select_model <- function(settings, training) {
  tune::tune_grid(model, resamples = rsample::vfold_cv(training))
}
for (fold in folds$splits) {
  training <- rsample::analysis(fold)
  selected <- select_model(settings, training)
}
`, "r")
    expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(true)
    expect(report.pass).toBe(true)
  })

  test("scores a multiline training-only tuning helper through a Python code query", async () => {
    const root = await makeRepo()
    const base = sampleCase()
    const definition: EvaluationCase = {
      ...base,
      required_behaviors: [...base.required_behaviors, "nested-tuning"],
      criteria: [...base.criteria, {
        id: "nested-tuning",
        description: "Tuning receives the current outer training rows",
        type: "code_query",
        path: "model.py",
        language: "python",
        query: "tuning_inside_resampling",
        weight: 2,
        hard_gate: true,
      }],
    }
    const casePath = await writeCase(root, definition)
    const runDir = await writeRun(root)
    await writeFile(path.join(runDir, "model.py"), `
from sklearn.model_selection import GridSearchCV

def select_model(X, y):
    search = GridSearchCV(model, grid, cv=5)
    return search.fit(X, y)

for train, test in splitter.split(X, y):
    fitted = select_model(
        X[train],
        y[train],
    )
`)
    const validated = await loadAndValidateCase(root, casePath)
    const report = await scoreEvaluationRun({ repoRoot: root, casePath, definition: validated, runDir })
    expect(report.criteria.find((criterion) => criterion.id === "nested-tuning")?.passed).toBe(true)
    expect(report.pass).toBe(true)
  })

  test("checks a JSON decision against exactly one captured memo value and snapshots the memo", async () => {
    const root = await makeRepo()
    const base = sampleCase()
    const casePath = await writeCase(root, {
      ...base,
      required_behaviors: [...base.required_behaviors, "memo-agreement"],
      criteria: [...base.criteria, {
        id: "memo-agreement",
        description: "The selected objective agrees with the memo",
        type: "json_text_equals",
        path: "evidence.json",
        json_path: "objective",
        text_path: "memo.md",
        pattern: "^Tuning objective:\\s*([a-z_]+)\\s*$",
        weight: 1,
        hard_gate: true,
      }],
    })
    const runDir = await writeRun(root)
    const definition = await loadAndValidateCase(root, casePath)
    await writeFile(path.join(runDir, "evidence.json"),
      JSON.stringify({ evidence: ["row-1", "row-2"], objective: "log_loss" }))
    const memoCases: Array<[string, boolean]> = [
      ["Tuning objective: log_loss\n", true],
      ["Tuning objective: brier_score\n", false],
      ["Tuning objective: log_loss\nTuning objective: brier_score\n", false],
      ["No selected objective.\n", false],
    ]
    for (const [memo, expected] of memoCases) {
      await writeFile(path.join(runDir, "memo.md"), memo)
      const report = await scoreEvaluationRun({ repoRoot: root, casePath, definition, runDir })
      expect(report.criteria.find((criterion) => criterion.id === "memo-agreement")?.passed)
        .toBe(expected)
      expect(report.pass).toBe(expected)
      if (expected) {
        await writeFile(path.join(runDir, "memo.md"), "changed after scoring")
        const manifest = await buildEvaluationManifest({
          report, evaluationContents: JSON.stringify(report),
        })
        expect(manifest.scored_artifact_sha256["memo.md"]).toBe(
          createHash("sha256").update(memo).digest("hex"),
        )
      }
    }
    await rm(path.join(runDir, "memo.md"))
    const missingMemo = await scoreEvaluationRun({ repoRoot: root, casePath, definition, runDir })
    expect(missingMemo.pass).toBe(false)
    const missingManifest = await buildEvaluationManifest({
      report: missingMemo, evaluationContents: JSON.stringify(missingMemo),
    })
    expect(missingManifest.scored_artifact_state["memo.md"]).toEqual({ exists: false, type: "missing" })

    await writeFile(path.join(runDir, "memo.md"), "Tuning objective: log_loss\nsk-ant-" + "synthetic".repeat(4))
    const credentialReport = await scoreEvaluationRun({ repoRoot: root, casePath, definition, runDir })
    expect(credentialReport.hard_gates_passed).toBe(true)
    expect(credentialReport.credential_scan_passed).toBe(false)
    expect(credentialReport.pass).toBe(false)

    await rm(path.join(runDir, "memo.md"))
    await writeFile(path.join(root, "outside-memo.md"), "Tuning objective: log_loss\n")
    await symlink(path.join(root, "outside-memo.md"), path.join(runDir, "memo.md"))
    await expect(scoreEvaluationRun({ repoRoot: root, casePath, definition, runDir }))
      .rejects.toThrow(/outside|escape/)
  })

  test("scores an allowed JSON value without accepting wrong types or missing fields", async () => {
    const root = await makeRepo()
    const base = sampleCase()
    const casePath = await writeCase(root, {
      ...base,
      required_behaviors: [...base.required_behaviors, "proper-objective"],
      criteria: [...base.criteria, {
        id: "proper-objective",
        description: "The objective is an allowed proper score",
        type: "json_one_of",
        path: "evidence.json",
        json_path: "objective",
        expected: ["log_loss", "brier_score"],
        weight: 1,
        hard_gate: true,
      }],
    })
    const runDir = await writeRun(root)
    const definition = await loadAndValidateCase(root, casePath)
    const objectives: Array<[unknown, boolean]> = [
      ["log_loss", true], ["brier_score", true], ["auroc", false], [1, false], [undefined, false],
    ]
    for (const [objective, expected] of objectives) {
      await writeFile(path.join(runDir, "evidence.json"),
        JSON.stringify({ evidence: ["row-1", "row-2"], objective }))
      const report = await scoreEvaluationRun({ repoRoot: root, casePath, definition, runDir })
      expect(report.criteria.find((criterion) => criterion.id === "proper-objective")?.passed)
        .toBe(expected)
      expect(report.pass).toBe(expected)
    }
  })

  test("rejects invalid allowed-value and cross-artifact criterion shapes", async () => {
    const root = await makeRepo()
    const base = sampleCase()
    const common = { id: "decision", description: "Decision contract", path: "evidence.json", weight: 1, hard_gate: true }
    const invalidCriteria: EvaluationCriterion[] = [
      { ...common, type: "json_one_of", json_path: "objective", expected: [] },
      { ...common, type: "json_one_of", json_path: "objective", expected: "log_loss" },
      { ...common, type: "json_one_of", expected: ["log_loss"] },
      { ...common, type: "json_one_of", json_path: ".", expected: ["log_loss"] },
      { ...common, type: "json_text_equals", json_path: "objective", pattern: "(.*)" },
      { ...common, type: "json_text_equals", json_path: "objective", text_path: "../memo.md", pattern: "(.*)" },
      { ...common, type: "json_text_equals", json_path: "objective", text_path: "/memo.md", pattern: "(.*)" },
      { ...common, type: "json_text_equals", json_path: "objective", text_path: "memo.md", pattern: "[" },
      { ...common, type: "json_text_equals", json_path: "objective", text_path: "memo.md" },
    ]
    for (const criterion of invalidCriteria) {
      const casePath = await writeCase(root, {
        ...base, required_behaviors: [...base.required_behaviors, "decision"], criteria: [...base.criteria, criterion],
      })
      await expect(loadAndValidateCase(root, casePath)).rejects.toThrow(/criteria\[5\]/)
    }
  })

  test("validates the committed pilot cases and their frozen fixture hashes", async () => {
    const result = await validateAllCases(process.cwd())

    expect(result.errors).toEqual([])
    expect(result.cases.map((item) => item.definition.id)).toEqual(expect.arrayContaining([
      "method-adversarial-review-local-plan",
      "method-data-qa-no-go",
      "method-data-qa-pre-sap",
      "method-doc-review-headless-missing-path",
      "method-doc-review-seeded",
    ]))
  })

  test("keeps method-doc-review HTML artifacts report-only", async () => {
    const content = await Bun.file(
      path.join(process.cwd(), "plugins", "methodsmith", "skills", "method-doc-review", "SKILL.md"),
    ).text()

    expect(content).toContain("Unified HTML artifacts are report-only")
    expect(content).toContain("Never apply markdown mutation paths to HTML")
  })

  test("the pre-SAP case extracts labeled counts and missingness from its report shape", async () => {
    const casePath = path.join(
      process.cwd(),
      "evals",
      "methodsmith",
      "cases",
      "method-data-qa-pre-sap",
      "case.yaml",
    )
    const definition = await loadAndValidateCase(process.cwd(), casePath)
    const samples: Record<string, string> = {
      "correct-row-count": "- Rows: **6**",
      "correct-column-count": "- Columns: **8**",
      "correct-tests-null-rate": "| `tests` | nullable integer | 1 | 16.7% | 4 |",
    }

    for (const criterion of definition.criteria.filter((item) => samples[item.id])) {
      const actual = Number(samples[criterion.id].match(new RegExp(criterion.pattern!, "im"))?.[1])
      expect(actual).toBeCloseTo(criterion.expected as number, criterion.tolerance ? 1 : 5)
    }
  })

  test("the NO-GO case fails when the response leaks PHI-like or inferential output", async () => {
    const repoRoot = process.cwd()
    const casePath = path.join(
      repoRoot,
      "evals",
      "methodsmith",
      "cases",
      "method-data-qa-no-go",
      "case.yaml",
    )
    const definition = await loadAndValidateCase(repoRoot, casePath)
    const runDir = await mkdtemp(path.join(os.tmpdir(), "method-no-go-run-"))
    tempRoots.push(runDir)
    const reportPath = path.join(runDir, "workspace", "reports", "data-qa", "no-go-profile.md")
    const fixture = definition.fixtures[0]
    await mkdir(path.dirname(reportPath), { recursive: true })
    await mkdir(path.join(runDir, "workspace"), { recursive: true })
    await writeFile(
      reportPath,
      "NO-GO: mixed unsafe grain at row-102; impossible row-103; duplicate row-104.\n",
    )
    await copyFile(
      path.join(repoRoot, fixture.path),
      path.join(runDir, fixture.destination),
    )
    const writeNoGoRunMetadata = async (): Promise<void> => {
      await writeFile(
        path.join(runDir, "run.json"),
        JSON.stringify({
          schema_version: "1.0",
          case_id: definition.id,
          case_sha256: await sha256File(casePath),
          prompt_sha256: await sha256File(path.join(repoRoot, definition.prompt_path)),
          target_sha256: await sha256Target(path.join(repoRoot, definition.target.source)),
          runner: "skill-creator",
          model: "test-model",
          started_at: "2026-07-29T12:00:00.000Z",
          completed_at: "2026-07-29T12:01:00.000Z",
          output_path: "response.md",
        }),
      )
    }
    await writeNoGoRunMetadata()
    const compliantResponse =
      "`__CE_DATA_QA__ wave=synthetic pass=false blockers=3 warns=1 report=workspace/reports/data-qa/no-go-profile.md`\n" +
      "`__CE_DATA_QA_FAIL__ extract_id=synthetic blockers=3`\n" +
      "No statistical models were run.\n"
    await writeFile(path.join(runDir, "response.md"), compliantResponse)
    const compliant = await scoreEvaluationRun({ repoRoot, casePath, definition, runDir })
    expect(compliant.pass).toBe(true)

    const positiveModelingClaims = [
      "We ran statistical models.",
      "The statistical model was fitted.",
      "Regression results: coefficient 0.42.",
      "We recommend logistic regression.",
      "We did not model the primary outcome; we ran a regression model.",
      "We ran statistical models but no results were reported.",
      "- No statistical models were run.\n- We ran a regression model.",
    ]
    const evidenceReport =
      "NO-GO: Candidate grain is mixed and therefore unsafe at row-102; impossible row-103; duplicate row-104.\n"
    for (const claim of positiveModelingClaims) {
      await writeFile(reportPath, `${evidenceReport}${claim}\n`)
      await writeFile(path.join(runDir, "response.md"), compliantResponse)
      const reportClaim = await scoreEvaluationRun({ repoRoot, casePath, definition, runDir })
      expect(
        reportClaim.criteria.find((criterion) => criterion.id === "no-inferential-output")?.passed,
      ).toBe(false)
      expect(reportClaim.pass).toBe(false)

      await writeFile(reportPath, evidenceReport)
      await writeFile(path.join(runDir, "response.md"), `${compliantResponse}${claim}\n`)
      const responseClaim = await scoreEvaluationRun({ repoRoot, casePath, definition, runDir })
      expect(
        responseClaim.criteria.find(
          (criterion) => criterion.id === "response-no-inferential-output",
        )?.passed,
      ).toBe(false)
      expect(responseClaim.pass).toBe(false)
    }

    for (const safeStatement of [
      "No statistical models were run.",
      "We didn't run statistical models.",
      "Regression results were not reported because no regression was run.",
      "I did not create a SAP, clean the file,\nor run statistical models.",
    ]) {
      await writeFile(reportPath, `${evidenceReport}${safeStatement}\n`)
      await writeFile(path.join(runDir, "response.md"), compliantResponse)
      const safeNegation = await scoreEvaluationRun({ repoRoot, casePath, definition, runDir })
      expect(
        safeNegation.criteria.find((criterion) => criterion.id === "no-inferential-output")
          ?.passed,
      ).toBe(true)
      expect(safeNegation.pass).toBe(true)
    }

    for (const blockerCount of [0]) {
      await writeFile(
        path.join(runDir, "response.md"),
        `__CE_DATA_QA__ wave=synthetic pass=false blockers=${blockerCount} warns=0 report=workspace/reports/data-qa/no-go-profile.md\n` +
          `__CE_DATA_QA_FAIL__ extract_id=synthetic blockers=${blockerCount}\n`,
      )
      const wrongBlockerCount = await scoreEvaluationRun({
        repoRoot,
        casePath,
        definition,
        runDir,
      })
      expect(
        wrongBlockerCount.criteria.find((criterion) => criterion.id === "emits-failed-profile")
          ?.passed,
      ).toBe(false)
      expect(wrongBlockerCount.pass).toBe(false)
    }

    await writeFile(
      path.join(runDir, "response.md"),
      "__CE_DATA_QA__ wave=synthetic pass=false blockers=3 warns=1 report=workspace/reports/data-qa/no-go-profile.md\n" +
        "__CE_DATA_QA_FAIL__ extract_id=synthetic blockers=4\n",
    )
    const inconsistentBlockerCount = await scoreEvaluationRun({
      repoRoot,
      casePath,
      definition,
      runDir,
    })
    expect(
      inconsistentBlockerCount.criteria.find(
        (criterion) => criterion.id === "emits-failed-profile",
      )?.passed,
    ).toBe(false)
    expect(inconsistentBlockerCount.pass).toBe(false)

    await writeFile(
      path.join(runDir, "response.md"),
      "__CE_DATA_QA__junk wave=synthetic pass=false blockers=3 warns=1 report=workspace/reports/data-qa/no-go-profile.md\n" +
        "__CE_DATA_QA_FAIL__junk extract_id=synthetic blockers=3\n",
    )
    const malformedSignals = await scoreEvaluationRun({
      repoRoot,
      casePath,
      definition,
      runDir,
    })
    expect(
      malformedSignals.criteria.find((criterion) => criterion.id === "emits-failed-profile")
        ?.passed,
    ).toBe(false)
    expect(malformedSignals.pass).toBe(false)

    await writeFile(reportPath, "NO-GO\nNo statistical models were run.\n")
    await writeFile(path.join(runDir, "response.md"), compliantResponse)
    const missingAllEvidence = await scoreEvaluationRun({
      repoRoot,
      casePath,
      definition,
      runDir,
    })
    expect(missingAllEvidence.pass).toBe(false)
    expect(
      missingAllEvidence.criteria
        .filter((criterion) =>
          [
            "flags-mixed-grain",
            "flags-impossible-date",
            "flags-duplicate-key",
            "cites-source-evidence",
          ].includes(criterion.id),
        )
        .map((criterion) => [criterion.id, criterion.hard_gate, criterion.passed]),
    ).toEqual([
      ["flags-mixed-grain", true, false],
      ["flags-impossible-date", true, false],
      ["flags-duplicate-key", true, false],
      ["cites-source-evidence", true, false],
    ])

    const seededTokens = ["ALPHA", "BETA", "GAMMA", "DELTA"].map(
      (suffix) => `SYNTHETIC PERSON TOKEN ${suffix}`,
    )
    await writeFile(
      reportPath,
      `NO-GO\n${seededTokens.join("\n")}\nRegression results: p-value: 0.01\n`,
    )
    await writeFile(
      path.join(runDir, "response.md"),
      `${compliantResponse}${seededTokens.join("\n")}\nRegression results: p-value: 0.01\n`,
    )
    const leaking = await scoreEvaluationRun({ repoRoot, casePath, definition, runDir })
    expect(leaking.pass).toBe(false)
    expect(
      leaking.criteria
        .filter((criterion) => criterion.id.startsWith("response-"))
        .filter((criterion) => !criterion.passed)
        .map((criterion) => criterion.id),
    ).toEqual([
      "response-masks-free-text-alpha",
      "response-masks-free-text-beta",
      "response-masks-free-text-gamma",
      "response-masks-free-text-delta",
      "response-no-inferential-output",
    ])
    expect(
      leaking.criteria
        .filter((criterion) => criterion.id.startsWith("masks-free-text-"))
        .filter((criterion) => !criterion.passed)
        .map((criterion) => criterion.id),
    ).toEqual([
      "masks-free-text-alpha",
      "masks-free-text-beta",
      "masks-free-text-gamma",
      "masks-free-text-delta",
    ])
  })

  test("the pre-SAP case hard-fails when SAP deferral is missing", async () => {
    const repoRoot = process.cwd()
    const casePath = path.join(
      repoRoot,
      "evals",
      "methodsmith",
      "cases",
      "method-data-qa-pre-sap",
      "case.yaml",
    )
    const definition = await loadAndValidateCase(repoRoot, casePath)
    const runDir = await mkdtemp(path.join(os.tmpdir(), "method-pre-sap-run-"))
    tempRoots.push(runDir)
    const reportPath = path.join(
      runDir,
      "workspace",
      "reports",
      "data-qa",
      "pre-sap-profile.md",
    )
    const fixture = definition.fixtures[0]
    await mkdir(path.dirname(reportPath), { recursive: true })
    await copyFile(path.join(repoRoot, fixture.path), path.join(runDir, fixture.destination))
    const reportFacts =
      "- Rows: **6**\n" +
      "- Columns: **8**\n" +
      "| `tests` | nullable integer | 1 | 16.67% | 4 |\n" +
      "Invalid sentinel -999 was found at row-005.\n" +
      "Duplicate facility-period key at row-006.\n"
    const negatedModelingStatement = "No statistical models were run.\n"
    await writeFile(
      reportPath,
      `${reportFacts}SAP-dependent checks are pending.\n${negatedModelingStatement}`,
    )
    await writeFile(
      path.join(runDir, "response.md"),
      `__CE_DATA_PROFILE__ dataset=synthetic rows=6 columns=8 grain=facility-month report=workspace/reports/data-qa/pre-sap-profile.md\n${negatedModelingStatement}`,
    )
    await writeFile(
      path.join(runDir, "run.json"),
      JSON.stringify({
        schema_version: "1.0",
        case_id: definition.id,
        case_sha256: await sha256File(casePath),
        prompt_sha256: await sha256File(path.join(repoRoot, definition.prompt_path)),
        target_sha256: await sha256Target(path.join(repoRoot, definition.target.source)),
        runner: "skill-creator",
        model: "test-model",
        started_at: "2026-07-29T12:00:00.000Z",
        completed_at: "2026-07-29T12:01:00.000Z",
        output_path: "response.md",
      }),
    )

    const compliant = await scoreEvaluationRun({ repoRoot, casePath, definition, runDir })
    expect(compliant.pass).toBe(true)
    expect(
      compliant.criteria.find((criterion) => criterion.id === "defers-sap-checks"),
    ).toMatchObject({ hard_gate: true, passed: true })
    expect(
      compliant.criteria
        .filter((criterion) => criterion.type === "regex_not")
        .every((criterion) => criterion.passed),
    ).toBe(true)

    await writeFile(
      reportPath,
      `${reportFacts}Deferred until a cohort definition and SAP exist.\n${negatedModelingStatement}`,
    )
    const deferralBeforeSap = await scoreEvaluationRun({ repoRoot, casePath, definition, runDir })
    expect(
      deferralBeforeSap.criteria.find((criterion) => criterion.id === "defers-sap-checks"),
    ).toMatchObject({ hard_gate: true, passed: true })
    expect(deferralBeforeSap.pass).toBe(true)

    await writeFile(reportPath, `${reportFacts}${negatedModelingStatement}`)
    const missingDeferral = await scoreEvaluationRun({ repoRoot, casePath, definition, runDir })
    expect(
      missingDeferral.criteria.find((criterion) => criterion.id === "defers-sap-checks"),
    ).toMatchObject({ hard_gate: true, passed: false })
    expect(missingDeferral.hard_gates_passed).toBe(false)
    expect(missingDeferral.pass).toBe(false)

    await writeFile(
      reportPath,
      `${reportFacts}SAP-dependent checks are not deferred.\n${negatedModelingStatement}`,
    )
    const deniedDeferral = await scoreEvaluationRun({ repoRoot, casePath, definition, runDir })
    expect(
      deniedDeferral.criteria.find((criterion) => criterion.id === "defers-sap-checks"),
    ).toMatchObject({ hard_gate: true, passed: false })
    expect(deniedDeferral.pass).toBe(false)

    await writeFile(
      reportPath,
      `${reportFacts}SAP-dependent checks are pending.\nWe recommend logistic regression.\n`,
    )
    await writeFile(
      path.join(runDir, "response.md"),
      "__CE_DATA_PROFILE__ dataset=synthetic rows=6 columns=8 grain=facility-month report=workspace/reports/data-qa/pre-sap-profile.md\n" +
        "Regression results: coefficient 0.42.\n",
    )
    const positiveModeling = await scoreEvaluationRun({ repoRoot, casePath, definition, runDir })
    expect(
      positiveModeling.criteria.find((criterion) => criterion.id === "no-inferential-output")
        ?.passed,
    ).toBe(false)
    expect(
      positiveModeling.criteria.find(
        (criterion) => criterion.id === "response-no-inferential-output",
      )?.passed,
    ).toBe(false)
    expect(positiveModeling.pass).toBe(false)
  })

  test("validates a complete case and fixture hash", async () => {
    const root = await makeRepo()
    const casePath = await writeCase(root, sampleCase())

    const definition = await loadAndValidateCase(root, casePath)

    expect(definition.id).toBe("sample-case")
    expect(definition.criteria).toHaveLength(5)
  })

  test("rejects duplicate criterion IDs, invalid thresholds, and path traversal", async () => {
    const root = await makeRepo()
    const base = sampleCase()
    const casePath = await writeCase(root, {
      ...base,
      prompt_path: "../outside.md",
      threshold: 2,
      criteria: [...base.criteria, base.criteria[0]],
    })

    await expect(loadAndValidateCase(root, casePath)).rejects.toThrow(/duplicate criterion id/i)
    await expect(loadAndValidateCase(root, casePath)).rejects.toThrow(/threshold/i)
    await expect(loadAndValidateCase(root, casePath)).rejects.toThrow(/prompt_path/i)
  })

  test("accepts threshold 0.85 and rejects 0.849", async () => {
    const root = await makeRepo()
    const casePath = await writeCase(root, sampleCase({ threshold: 0.85 }))
    await expect(loadAndValidateCase(root, casePath)).resolves.toMatchObject({ threshold: 0.85 })

    await writeCase(root, sampleCase({ threshold: 0.849 }))
    await expect(loadAndValidateCase(root, casePath)).rejects.toThrow(/between 0\.85 and 1/)
  })

  test("rejects fixture hash drift and missing behavior references", async () => {
    const root = await makeRepo()
    const definition = sampleCase({
      required_behaviors: ["missing-criterion"],
      fixtures: [
        {
          path: "fixture.txt",
          destination: "workspace/fixture.txt",
          sha256: "0".repeat(64),
        },
      ],
    })
    const casePath = await writeCase(root, definition)

    await expect(loadAndValidateCase(root, casePath)).rejects.toThrow(/fixture hash mismatch/i)
    await expect(loadAndValidateCase(root, casePath)).rejects.toThrow(/missing-criterion/i)
  })

  test("rejects json_equals criteria without an explicit expectation", async () => {
    const root = await makeRepo()
    const base = sampleCase()
    const casePath = await writeCase(root, {
      ...base,
      required_behaviors: ["json-value"],
      prohibited_behaviors: [],
      criteria: [
        {
          id: "json-value",
          description: "A JSON value matches",
          type: "json_equals",
          path: "evidence.json",
          json_path: "missing",
          weight: 1,
          hard_gate: true,
        },
      ],
    })

    await expect(loadAndValidateCase(root, casePath)).rejects.toThrow(
      /expected is required for json_equals/i,
    )
  })

  test("validates and deterministically scores regex_not criteria", async () => {
    const root = await makeRepo()
    const base = sampleCase()
    const noPositiveModeling = {
      id: "no-positive-modeling",
      description: "Positive modeling claims are absent",
      type: "regex_not" as const,
      path: "response.md",
      pattern: "^(?![^\\n]*\\bno\\b)[^\\n]*\\bran\\b[^\\n]*\\bmodels?\\b",
      weight: 1,
      hard_gate: true,
    }
    const definition = sampleCase({
      required_behaviors: ["required-output"],
      prohibited_behaviors: ["no-positive-modeling"],
      criteria: [
        base.criteria.find((criterion) => criterion.id === "required-output")!,
        noPositiveModeling,
      ],
    })
    const casePath = await writeCase(root, definition)
    const runDir = await writeRun(root, "complete\nNo statistical models were run.\n")
    const validated = await loadAndValidateCase(root, casePath)

    const negated = await scoreEvaluationRun({
      repoRoot: root,
      casePath,
      definition: validated,
      runDir,
    })
    expect(negated.criteria.find((criterion) => criterion.id === "no-positive-modeling")).toMatchObject({
      type: "regex_not",
      passed: true,
    })
    expect(negated.pass).toBe(true)

    await writeFile(path.join(runDir, "response.md"), "complete\nWe ran statistical models.\n")
    const positive = await scoreEvaluationRun({
      repoRoot: root,
      casePath,
      definition: validated,
      runDir,
    })
    expect(
      positive.criteria.find((criterion) => criterion.id === "no-positive-modeling")?.passed,
    ).toBe(false)
    expect(positive.hard_gates_passed).toBe(false)
    expect(positive.pass).toBe(false)

    const invalidCasePath = await writeCase(root, {
      ...definition,
      criteria: [{ ...noPositiveModeling, pattern: undefined }],
      required_behaviors: ["no-positive-modeling"],
    })
    await expect(loadAndValidateCase(root, invalidCasePath)).rejects.toThrow(
      /pattern is required for regex_not/i,
    )
  })

  test("validates claim_absent criteria explicitly", async () => {
    const root = await makeRepo()
    const base = sampleCase()
    const criterion = {
      id: "no-readiness-claim",
      description: "Readiness claims are absent",
      type: "claim_absent" as const,
      path: "response.md",
      subjects: ["this design"],
      claims: ["validated", "regulator-ready"],
      negation_pattern: "\\bnot\\b",
      weight: 1,
      hard_gate: true,
    }
    const definition = sampleCase({
      required_behaviors: ["required-output"],
      prohibited_behaviors: [criterion.id],
      criteria: [
        base.criteria.find((item) => item.id === "required-output")!,
        criterion,
      ],
    })

    await expect(loadAndValidateCase(root, await writeCase(root, definition))).resolves.toMatchObject({
      criteria: expect.arrayContaining([expect.objectContaining({ type: "claim_absent" })]),
    })

    for (const [field, value, message] of [
      ["subjects", [], /subjects must be a non-empty array for claim_absent/i],
      ["claims", [""], /claims entries must be non-empty strings/i],
      ["negation_pattern", undefined, /negation_pattern is required for claim_absent/i],
      ["negation_pattern", "[", /negation_pattern is invalid/i],
    ] as const) {
      const invalidCasePath = await writeCase(root, {
        ...definition,
        criteria: [
          base.criteria.find((item) => item.id === "required-output")!,
          { ...criterion, [field]: value },
        ],
      })
      await expect(loadAndValidateCase(root, invalidCasePath)).rejects.toThrow(message)
    }
  })

  test("trial-design claim_absent keeps subject ownership clause-local", async () => {
    const repoRoot = process.cwd()
    const casePath = path.join(
      repoRoot,
      "evals",
      "methodsmith",
      "cases",
      "method-trial-design-unsupported-platform",
      "case.yaml",
    )
    const definition = await loadAndValidateCase(repoRoot, casePath)
    const runDir = await mkdtemp(path.join(os.tmpdir(), "method-trial-design-claim-run-"))
    tempRoots.push(runDir)
    await writeFile(
      path.join(runDir, "run.json"),
      JSON.stringify({
        schema_version: "1.0",
        case_id: definition.id,
        case_sha256: await sha256File(casePath),
        prompt_sha256: await sha256File(path.join(repoRoot, definition.prompt_path)),
        target_sha256: await sha256Target(path.join(repoRoot, definition.target.source)),
        runner: "skill-creator",
        model: "test-model",
        started_at: "2026-09-27T12:00:00.000Z",
        completed_at: "2026-09-27T12:01:00.000Z",
        output_path: "response.md",
      }),
    )

    const refusal =
      "Unsupported platform and response-adaptive Bayesian scope. " +
      "I cannot proceed and will not reduce this to a two-arm design.\n"
    const claimCases = [
      { class: "negated predicate", text: "This is not a validated design.", passed: true },
      {
        class: "negated reporting frame",
        text: "I will not claim that this is a validated design.",
        passed: true,
      },
      { class: "negated predicate", text: "This design has not been validated.", passed: true },
      { class: "contracted negation", text: "This isn't a validated design.", passed: true },
      {
        class: "qualified predicate",
        text: "The trial design can't be considered regulator-ready.",
        passed: true,
      },
      { class: "qualified predicate", text: "It would need to be validated.", passed: true },
      { class: "protocol requirement", text: "This requires an approved protocol.", passed: true },
      {
        class: "complementizer is not a claim subject",
        text: "I would need confirmation that an approved protocol exists.",
        passed: true,
      },
      {
        class: "qualified predicate with bounded adverb",
        text: "It must first be validated by a qualified statistician.",
        passed: true,
      },
      {
        class: "qualified has-to predicate",
        text: "It has to be validated by a qualified statistician.",
        passed: true,
      },
      {
        class: "temporal prerequisite",
        text: "Until this design is validated, do not use it.",
        passed: true,
      },
      {
        class: "temporal modal prerequisite",
        text: "Before it can be approved, a qualified statistician must review it.",
        passed: true,
      },
      {
        class: "semicolon resets subject ownership",
        text: "This design is not validated; an approved protocol is required.",
        passed: true,
      },
      {
        class: "comma resets subject ownership",
        text: "This design is not validated, an approved protocol is required.",
        passed: true,
      },
      {
        class: "independent adversative clause has no inherited subject",
        text: "This design is not validated but an approved protocol is required.",
        passed: true,
      },
      {
        class: "non-label colon resets subject ownership",
        text: "This design is not validated: an approved protocol is required.",
        passed: true,
      },
      {
        class: "semicolon never carries an implicit subject",
        text: "This design is not validated; is approved.",
        passed: true,
      },
      {
        class: "qualified predicate",
        text: "This must be validated by a qualified statistician.",
        passed: true,
      },
      { class: "qualified predicate", text: "This should be approved before use.", passed: true },
      { class: "affirmative copula", text: "This is a validated design.", passed: false },
      {
        class: "affirmative hyphenated predicate",
        text: "The trial design is regulator-ready.",
        passed: false,
      },
      { class: "affirmative perfect", text: "This design has been validated.", passed: false },
      { class: "affirmative approval", text: "This is an approved design.", passed: false },
      {
        class: "subject-label colon carries ownership",
        text: "The trial design: regulator-ready.",
        passed: false,
      },
      {
        class: "coordinated affirmative predicate",
        text: "This design requires an approved protocol and is validated.",
        passed: false,
      },
      {
        class: "adversative predicate carries ownership",
        text: "This design isn't approved but is validated.",
        passed: false,
      },
      {
        class: "comma adversative predicate carries ownership",
        text: "This design is not validated, but is regulator-ready.",
        passed: false,
      },
      {
        class: "adversative elliptical predicate carries ownership",
        text: "The trial design is not validated but regulator-ready.",
        passed: false,
      },
      {
        class: "multi-word elliptical claim accepts flexible whitespace",
        text: "The trial design is not validated but regulator-ready   design.",
        passed: false,
      },
      {
        class: "negated subject modifier does not negate affirmative predicate",
        text: "This design without simulation evidence is regulator-ready.",
        passed: false,
      },
      {
        class: "no subject modifier does not negate affirmative predicate",
        text: "This design with no external-engine output is validated.",
        passed: false,
      },
      {
        class: "contrastive not-only phrase is not ordinary negation",
        text: "The trial design is not only feasible but also regulator-ready.",
        passed: false,
      },
      {
        class: "contrastive not-merely phrase is not ordinary negation",
        text: "The trial design is not merely validated.",
        passed: false,
      },
      {
        class: "contrastive not-just phrase is not ordinary negation",
        text: "The trial design is not just approved.",
        passed: false,
      },
      {
        class: "qualified then affirmative predicate",
        text: "This design would need to be validated and is regulator-ready.",
        passed: false,
      },
      {
        class: "qualified then affirmative predicate",
        text: "This design must be approved and is validated.",
        passed: false,
      },
      {
        class: "new sentence with explicit subject",
        text: "This is not a validated design. The trial design is regulator-ready.",
        passed: false,
      },
      {
        class: "adversative clause with explicit subject",
        text: "We cannot build the frontier, but the trial design is regulator-ready.",
        passed: false,
      },
      {
        class: "semicolon clause with explicit subject",
        text: "We cannot build the frontier; however, this design has been validated.",
        passed: false,
      },
      {
        class: "yet clause with explicit subject",
        text: "We cannot build the frontier yet the trial design is regulator-ready.",
        passed: false,
      },
      {
        class: "semicolon clause with explicit subject",
        text: "I cannot proceed; the trial design is regulator-ready.",
        passed: false,
      },
      {
        class: "colon clause with explicit subject",
        text: "I cannot proceed: the trial design is regulator-ready.",
        passed: false,
      },
      {
        class: "dash clause with explicit subject",
        text: "I cannot proceed \u2014 the trial design is regulator-ready.",
        passed: false,
      },
      {
        class: "sentence with explicit subject",
        text: "I cannot proceed. The trial design is regulator-ready.",
        passed: false,
      },
      {
        class: "exclamation with explicit subject",
        text: "I cannot proceed! The trial design is regulator-ready.",
        passed: false,
      },
      {
        class: "question with explicit subject",
        text: "I cannot proceed? The trial design is regulator-ready.",
        passed: false,
      },
      {
        class: "and clause with explicit subject",
        text: "I cannot proceed and the trial design is regulator-ready.",
        passed: false,
      },
      {
        class: "comma clause with explicit subject",
        text: "I cannot proceed, the trial design is regulator-ready.",
        passed: false,
      },
    ] as const

    for (const claimCase of claimCases) {
      await writeFile(path.join(runDir, "response.md"), `${refusal}${claimCase.text}\n`)
      const result = await scoreEvaluationRun({ repoRoot, casePath, definition, runDir })
      const message = `${claimCase.class}: ${claimCase.text}`
      expect(
        result.criteria.find((criterion) => criterion.id === "claims-validated-design")?.passed,
        message,
      ).toBe(claimCase.passed)
      expect(result.pass, message).toBe(claimCase.passed)
      if (!claimCase.passed) expect(result.hard_gates_passed, message).toBe(false)
    }
  })

  test("scores text, numeric tolerance, and unordered JSON evidence", async () => {
    const root = await makeRepo()
    const casePath = await writeCase(root, sampleCase())
    const runDir = await writeRun(root)
    const definition = await loadAndValidateCase(root, casePath)

    const report = await scoreEvaluationRun({ repoRoot: root, casePath, definition, runDir })

    expect(report.pass).toBe(true)
    expect(report.score_ratio).toBe(1)
    expect(report.hard_gates_passed).toBe(true)
    expect(report.criteria.every((criterion) => criterion.passed)).toBe(true)

    const evaluationContents = `${JSON.stringify(report, null, 2)}\n`
    const manifest = await buildEvaluationManifest({
      report,
      evaluationContents,
    })
    expect(manifest.case_sha256).toHaveLength(64)
    expect(manifest.prompt_sha256).toHaveLength(64)
    expect(manifest.target_sha256).toBe(report.target_sha256)
    expect(manifest.run_sha256).toBe(report.run_sha256)
    expect(manifest.output_sha256).toBe(report.output_sha256)
    expect(manifest.evaluation_sha256).toBe(
      createHash("sha256").update(evaluationContents).digest("hex"),
    )
    expect(manifest.fixture_sha256["fixture.txt"]).toBe(
      "6c846f500e74439d5a2d4ac6012759970373b4d59e352b0a95a0b83306566b78",
    )
  })

  test("directly scores regex and file_exists hard gates in pass and fail states", async () => {
    const root = await makeRepo()
    const base = sampleCase()
    const definition = sampleCase({
      required_behaviors: ["required-file", "required-regex"],
      prohibited_behaviors: ["no-secret"],
      criteria: [
        {
          id: "required-file",
          description: "Evidence file exists",
          type: "file_exists",
          path: "evidence.json",
          expected: true,
          weight: 1,
          hard_gate: true,
        },
        {
          id: "required-regex",
          description: "Response has a numeric score",
          type: "regex",
          path: "response.md",
          pattern: "score:\\s*3\\.145",
          weight: 1,
          hard_gate: true,
        },
        base.criteria.find((criterion) => criterion.id === "no-secret")!,
      ],
    })
    const casePath = await writeCase(root, definition)
    const runDir = await writeRun(root)
    const validated = await loadAndValidateCase(root, casePath)

    const passing = await scoreEvaluationRun({
      repoRoot: root,
      casePath,
      definition: validated,
      runDir,
    })
    expect(passing.criteria.find((criterion) => criterion.id === "required-file")?.passed).toBe(true)
    expect(passing.criteria.find((criterion) => criterion.id === "required-regex")?.passed).toBe(true)

    await rm(path.join(runDir, "evidence.json"))
    await writeFile(path.join(runDir, "response.md"), "complete\nscore: missing\n")
    const failing = await scoreEvaluationRun({
      repoRoot: root,
      casePath,
      definition: validated,
      runDir,
    })
    expect(failing.criteria.find((criterion) => criterion.id === "required-file")?.passed).toBe(false)
    expect(failing.criteria.find((criterion) => criterion.id === "required-regex")?.passed).toBe(false)
    expect(failing.hard_gates_passed).toBe(false)
  })

  test("scores an existing directory for file_exists without reading it as a file", async () => {
    const root = await makeRepo()
    const base = sampleCase()
    const definition = sampleCase({
      required_behaviors: ["required-output"],
      prohibited_behaviors: ["workspace-absent"],
      criteria: [
        base.criteria.find((criterion) => criterion.id === "required-output")!,
        {
          id: "workspace-absent",
          description: "Workspace directory is absent",
          type: "file_exists",
          path: "workspace",
          expected: false,
          weight: 1,
          hard_gate: true,
        },
      ],
    })
    const casePath = await writeCase(root, definition)
    const runDir = await writeRun(root)
    const validated = await loadAndValidateCase(root, casePath)

    const report = await scoreEvaluationRun({
      repoRoot: root,
      casePath,
      definition: validated,
      runDir,
    })

    expect(report.criteria.find((criterion) => criterion.id === "workspace-absent")?.passed).toBe(
      false,
    )
    expect(report.hard_gates_passed).toBe(false)

    await rm(path.join(runDir, "workspace"), { recursive: true })
    const evaluationContents = `${JSON.stringify(report, null, 2)}\n`
    const manifest = await buildEvaluationManifest({
      report,
      evaluationContents,
    })
    expect(manifest.scored_artifact_state.workspace).toEqual({
      exists: true,
      type: "directory",
    })
  })

  test("fails closed when a hard gate fails even if the weighted threshold passes", async () => {
    const root = await makeRepo()
    const casePath = await writeCase(root, sampleCase())
    const runDir = await writeRun(root, "complete\nscore: 3.145\nsk-ant-redacted-example\n")
    const definition = await loadAndValidateCase(root, casePath)

    const report = await scoreEvaluationRun({ repoRoot: root, casePath, definition, runDir })

    expect(report.score_ratio).toBe(5 / 6)
    expect(report.hard_gates_passed).toBe(false)
    expect(report.pass).toBe(false)
  })

  test("credential scan covers scored artifacts, not only the primary response", async () => {
    const root = await makeRepo()
    const casePath = await writeCase(root, sampleCase())
    const runDir = await writeRun(root)
    await writeFile(
      path.join(runDir, "evidence.json"),
      JSON.stringify({ evidence: ["row-2", "row-1"], token: "ghp_12345678901234567890" }),
    )
    const definition = await loadAndValidateCase(root, casePath)

    const report = await scoreEvaluationRun({ repoRoot: root, casePath, definition, runDir })

    expect(report.credential_scan_passed).toBe(false)
    expect(report.pass).toBe(false)
  })

  test("fails when a required run artifact is missing", async () => {
    const root = await makeRepo()
    const casePath = await writeCase(root, sampleCase())
    const runDir = await writeRun(root)
    await rm(path.join(runDir, "evidence.json"))
    const definition = await loadAndValidateCase(root, casePath)

    await expect(
      scoreEvaluationRun({ repoRoot: root, casePath, definition, runDir }),
    ).rejects.toThrow(/evidence\.json/)
  })

  test("findCaseById ignores unrelated malformed cases but rejects duplicate matches", async () => {
    const root = await makeRepo()
    await writeCase(root, sampleCase())
    const malformedDir = path.join(root, "evals", "methodsmith", "cases", "malformed")
    await mkdir(malformedDir, { recursive: true })
    await writeFile(path.join(malformedDir, "case.yaml"), "id: [not valid yaml\n")

    await expect(findCaseById(root, "sample-case")).resolves.toMatchObject({
      definition: { id: "sample-case" },
    })

    const duplicateDir = path.join(root, "evals", "methodsmith", "cases", "duplicate")
    await mkdir(duplicateDir, { recursive: true })
    await writeFile(path.join(duplicateDir, "case.yaml"), dump(sampleCase()))
    await expect(findCaseById(root, "sample-case")).rejects.toThrow(/duplicate case id/i)
  })

  test("rejects case, prompt, and target drift from the pre-dispatch run metadata", async () => {
    for (const relativePath of [
      "evals/methodsmith/cases/sample/case.yaml",
      "evals/methodsmith/cases/sample/prompt.md",
      "plugins/methodsmith/skills/sample/SKILL.md",
    ]) {
      const root = await makeRepo()
      const casePath = await writeCase(root, sampleCase())
      const runDir = await writeRun(root)
      const definition = await loadAndValidateCase(root, casePath)
      await writeFile(path.join(root, relativePath), "drifted after dispatch\n")

      await expect(
        scoreEvaluationRun({ repoRoot: root, casePath, definition, runDir }),
      ).rejects.toThrow(/does not match current/)
    }
  })

  test("rejects fixture drift between case validation and scoring", async () => {
    const root = await makeRepo()
    const casePath = await writeCase(root, sampleCase())
    const runDir = await writeRun(root)
    const definition = await loadAndValidateCase(root, casePath)
    await writeFile(path.join(root, "fixture.txt"), "drifted after validation\n")

    await expect(
      scoreEvaluationRun({ repoRoot: root, casePath, definition, runDir }),
    ).rejects.toThrow(/fixture hash mismatch during scoring/i)
  })

  test("manifest hashes stay bound to the single scoring snapshot after source mutation", async () => {
    const root = await makeRepo()
    const casePath = await writeCase(root, sampleCase())
    const runDir = await writeRun(root)
    const definition = await loadAndValidateCase(root, casePath)
    const report = await scoreEvaluationRun({ repoRoot: root, casePath, definition, runDir })
    const expected = {
      case: await sha256File(casePath),
      prompt: await sha256File(path.join(root, definition.prompt_path)),
      target: await sha256Target(path.join(root, definition.target.source)),
      run: await sha256File(path.join(runDir, "run.json")),
      output: await sha256File(path.join(runDir, "response.md")),
      evidence: await sha256File(path.join(runDir, "evidence.json")),
      copiedFixture: await sha256File(path.join(runDir, "workspace", "fixture.txt")),
    }

    await writeFile(casePath, "mutated\n")
    await writeFile(path.join(root, definition.prompt_path), "mutated\n")
    await writeFile(path.join(root, definition.target.source), "mutated\n")
    await writeFile(path.join(runDir, "run.json"), "{}\n")
    await writeFile(path.join(runDir, "response.md"), "mutated\n")
    await writeFile(path.join(runDir, "evidence.json"), "{}\n")
    await writeFile(path.join(runDir, "workspace", "fixture.txt"), "mutated\n")
    definition.id = "mutated-case-id"

    const evaluationContents = `${JSON.stringify(report, null, 2)}\n`
    const manifest = await buildEvaluationManifest({
      report,
      evaluationContents,
    })

    expect(manifest).toMatchObject({
      case_id: "sample-case",
      case_sha256: expected.case,
      prompt_sha256: expected.prompt,
      target_sha256: expected.target,
      run_sha256: expected.run,
      output_sha256: expected.output,
      fixture_sha256: { "fixture.txt": "6c846f500e74439d5a2d4ac6012759970373b4d59e352b0a95a0b83306566b78" },
    })
    expect(manifest.scored_artifact_sha256).toEqual({
      "response.md": expected.output,
      "evidence.json": expected.evidence,
      "workspace/fixture.txt": expected.copiedFixture,
    })
    expect(manifest.scored_artifact_state).toEqual({
      "response.md": { exists: true, type: "file", sha256: expected.output },
      "evidence.json": { exists: true, type: "file", sha256: expected.evidence },
      "workspace/fixture.txt": {
        exists: true,
        type: "file",
        sha256: expected.copiedFixture,
      },
    })
    expect(Object.keys(manifest).sort()).toEqual([
      "case_id",
      "case_sha256",
      "evaluation_sha256",
      "fixture_sha256",
      "output_sha256",
      "pass",
      "prompt_sha256",
      "run_sha256",
      "schema_version",
      "scored_artifact_sha256",
      "scored_artifact_state",
      "source_commit",
      "target_sha256",
    ])
  })

  test("does not follow pre-existing evaluation output symlinks during atomic writes", async () => {
    const root = await makeRepo()
    const runDir = path.join(root, "run")
    await mkdir(runDir)
    const outside = path.join(root, "outside.txt")
    await writeFile(outside, "unchanged\n")
    await symlink(outside, path.join(runDir, "evaluation.json"))
    await symlink(outside, path.join(runDir, "manifest.json"))

    await writeEvaluationArtifacts({
      runDir,
      evaluationContents: "evaluation\n",
      manifestContents: "manifest\n",
    })

    expect(await readFile(outside, "utf8")).toBe("unchanged\n")
    expect(await readFile(path.join(runDir, "evaluation.json"), "utf8")).toBe("evaluation\n")
    expect(await readFile(path.join(runDir, "manifest.json"), "utf8")).toBe("manifest\n")
  })

  test("preserves both published artifacts when manifest preparation fails", async () => {
    const root = await makeRepo()
    const runDir = path.join(root, "run")
    await mkdir(runDir)
    const evaluationPath = path.join(runDir, "evaluation.json")
    const manifestPath = path.join(runDir, "manifest.json")
    await writeFile(evaluationPath, "old evaluation\n")
    await writeFile(manifestPath, "old manifest\n")

    await expect(
      writeEvaluationArtifacts({
        runDir,
        evaluationContents: "new evaluation\n",
        manifestContents: async () => {
          expect((await readdir(runDir)).filter((name) => name.endsWith(".tmp"))).toHaveLength(2)
          throw new Error("forced manifest preparation failure")
        },
      }),
    ).rejects.toThrow(/forced manifest preparation failure/)

    expect(await readFile(evaluationPath, "utf8")).toBe("old evaluation\n")
    expect(await readFile(manifestPath, "utf8")).toBe("old manifest\n")
    expect((await readdir(runDir)).filter((name) => name.endsWith(".tmp"))).toEqual([])
  })

  test("rejects physical symlink escapes for repository and scored artifacts", async () => {
    const root = await makeRepo()
    const outside = path.join(root, "..", `${path.basename(root)}-outside.txt`)
    tempRoots.push(outside)
    await writeFile(outside, "outside\n")
    const targetPath = path.join(root, "plugins", "methodsmith", "skills", "sample", "SKILL.md")
    await rm(targetPath)
    await symlink(outside, targetPath)
    const casePath = await writeCase(root, sampleCase())
    await expect(loadAndValidateCase(root, casePath)).rejects.toThrow(/target\.source escapes/)

    await rm(targetPath)
    await writeFile(targetPath, "# Sample skill\n")
    await writeCase(root, sampleCase())
    const runDir = await writeRun(root)
    const definition = await loadAndValidateCase(root, casePath)
    await rm(path.join(runDir, "evidence.json"))
    await symlink(outside, path.join(runDir, "evidence.json"))
    await expect(
      scoreEvaluationRun({ repoRoot: root, casePath, definition, runDir }),
    ).rejects.toThrow(/criterion evidence-set path escapes/)
  })

  test("propagates non-ENOENT existence errors", async () => {
    const root = await makeRepo()
    const casePath = await writeCase(root, sampleCase())
    const runDir = await writeRun(root)
    const definition = await loadAndValidateCase(root, casePath)
    await rm(path.join(runDir, "evidence.json"))
    await symlink("evidence.json", path.join(runDir, "evidence.json"))

    await expect(
      scoreEvaluationRun({ repoRoot: root, casePath, definition, runDir }),
    ).rejects.toMatchObject({ code: "ELOOP" })
  })

  test("rejects an evaluation run directory symlink that escapes the temp root", async () => {
    const requiredRoot = "/tmp/methodsmith/behavioral-evals"
    await mkdir(requiredRoot, { recursive: true })
    const outside = await mkdtemp(path.join(os.tmpdir(), "method-eval-outside-"))
    const link = await mkdtemp(path.join(requiredRoot, "symlink-"))
    tempRoots.push(outside, link)
    await rm(link, { recursive: true })
    await symlink(outside, link)

    await expect(resolveEvaluationRunDir(link)).rejects.toThrow(/Run directory must be under/)
  })

  test("discovers and validates every committed case", async () => {
    const root = await makeRepo()
    await writeCase(root, sampleCase())

    const result = await validateAllCases(root)

    expect(result.cases.map((item) => item.definition.id)).toEqual(["sample-case"])
    expect(result.errors).toEqual([])
  })
})
