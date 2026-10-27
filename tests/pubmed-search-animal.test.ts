import { describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "fs/promises"
import os from "os"
import path from "path"

const script = path.join(process.cwd(), "plugins", "methodsmith", "skills", "method-pubmed", "scripts", "pubmed_search.py")
const HUMAN_FILTER = "NOT (animals[mh] NOT humans[mh])"

// Offline Bio.Entrez stub: esearch logs the query term and reports zero hits,
// so the script never fetches and never touches the network.
const STUB = `
import contextlib, json, os
email = None
api_key = None

class _H(contextlib.AbstractContextManager):
    def __init__(self, payload): self.payload = payload
    def __exit__(self, *a): return False

def esearch(**kw):
    with open(os.environ["ENTREZ_STUB_LOG"], "a") as fh: fh.write(json.dumps({"term": kw.get("term")}) + "\\n")
    return _H({"Count": "0", "WebEnv": "W", "QueryKey": "1", "IdList": []})

def read(handle): return handle.payload
`

describe("method-pubmed --include-animal", () => {
  test("default query excludes animal-only records; --include-animal omits the filter", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "pubmed-animal-"))
    try {
      await mkdir(path.join(root, "Bio"))
      await writeFile(path.join(root, "Bio", "__init__.py"), "")
      await writeFile(path.join(root, "Bio", "Entrez.py"), STUB)
      const runs: { term: string; stderr: string }[] = []
      for (const extra of [[], ["--include-animal"]]) {
        const log = path.join(root, `calls-${extra.length}.jsonl`)
        const proc = Bun.spawn(["python3", script, "sepsis mouse model", "--max", "1", "--out", path.join(root, "out.csv"), ...extra], {
          env: { ...process.env, PYTHONPATH: root, ENTREZ_STUB_LOG: log },
          stdout: "pipe",
          stderr: "pipe",
        })
        expect(await proc.exited).toBe(0)
        const stderr = await new Response(proc.stderr).text()
        const term = JSON.parse((await readFile(log, "utf8")).trim().split("\n")[0]).term
        runs.push({ term, stderr })
      }
      expect(runs[0].term).toEndWith(HUMAN_FILTER)
      expect(runs[0].stderr).toContain(`[query] ${runs[0].term}`)
      expect(runs[1].term).not.toContain("animals[mh]")
      expect(runs[1].term).toContain("(sepsis mouse model)")
      expect(runs[1].stderr).toContain(`[query] ${runs[1].term}`)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
