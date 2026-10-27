import { expect, test } from "bun:test"
import { access, readFile } from "node:fs/promises"
import { resolve } from "node:path"

const repoRoot = resolve(import.meta.dir, "..")
const skill = async (name: string) => readFile(resolve(repoRoot, "plugins/methodsmith/skills", name, "SKILL.md"), "utf8")

test("curated upstream skills keep CE authority and evidence boundaries", async () => {
  const handoff = await skill("method-handoff")
  expect(handoff).toContain("never includes credentials, raw patient data, or private model transcripts")
})

test("doc review keeps the canonical non-interactive compatibility contract and readable-path gate", async () => {
  const documentReview = await skill("method-doc-review")
  expect(documentReview).toContain("mode:non-interactive")
  expect(documentReview).toContain("Both aliases together are not a conflict")
  expect(documentReview).toContain("confirm it is readable on disk before dispatching personas")
})

test("new skill directories are self-contained portable units", async () => {
  await Promise.all(["method-handoff", "method-clif-template"].map((name) => access(resolve(repoRoot, "plugins/methodsmith/skills", name, "SKILL.md"))))
})

test("CLIF project-template support preserves version and PHI safeguards", async () => {
  const template = await skill("method-clif-template")
  expect(template).toContain("method-clif --version")
  expect(template).toContain("non-empty directory")
  expect(template).toContain("output/final_no_phi/")
  expect(template).toContain("output/intermediate_phi/")
  expect(template).toContain("no reported cell smaller than 11")
  expect(template).toContain("clif_demo")
  expect(template).toContain("BUDDY_TEST_REPORT.md")
})
