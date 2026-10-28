import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { load } from "js-yaml"

test("release creation requires the same-commit CI workflow without bypass", async () => {
 const release = load(await readFile(".github/workflows/release-pr.yml", "utf8")) as any
 const ci = load(await readFile(".github/workflows/ci.yml", "utf8")) as any
 expect(release.jobs["validate-candidate"].uses).toBe("./.github/workflows/ci.yml")
 expect(release.jobs["validate-candidate"].if).toBeUndefined()
 expect(release.jobs["release-pr"].needs).toBe("validate-candidate")
 expect(release.jobs["release-pr"].if).toBeUndefined()
 expect(Object.hasOwn(ci.on, "workflow_call")).toBe(true)
 expect(ci.jobs.test.if).toBeUndefined()
 for (const required of ["bun run typecheck", "bun run release:validate", "bun run eval:validate", "bun test"]) {
  const step = ci.jobs.test.steps.find((item: any) => item.run === required)
  expect(step).toBeDefined()
  expect(step.if).toBeUndefined()
  expect(step["continue-on-error"]).toBeUndefined()
 }
 expect(ci.concurrency.group).toContain("github.workflow")
})

import { bindTag, resolvedTag, type TagApi } from "../scripts/release/tag-binding"
import { createValidatedReleases, confirmedRelease } from "../scripts/release/create-validated-releases"

test("new passing commit cannot release an older pending candidate", async () => {
 const tags = tagApi("a".repeat(40))
 let mutations = 0
 const manifest = {
  buildReleases: async () => [{ sha: "a".repeat(40) }],
  createReleases: async () => { mutations++; return [] },
 }
 await expect(createValidatedReleases(manifest as any,"b".repeat(40),tags)).rejects.toThrow("differs from validated")
 expect(mutations).toBe(0)
})

test("release creation uses only the validated candidate set even if discovery changes", async () => {
 let discoveries = 0
 const tags = tagApi("a".repeat(40))
 const validated = { sha: "a".repeat(40), tag: "cli-v1.0.0" }
 const manifest = {
  buildReleases: async () => (++discoveries === 1 ? [validated] : [{sha:"b".repeat(40)}]),
  createReleases: async () => { expect(await manifest.buildReleases()).toEqual([validated]); return [] },
 }
 const original = manifest.buildReleases
 expect(await createValidatedReleases(manifest as any,"a".repeat(40),tags)).toEqual([])
 expect(discoveries).toBe(1)
 expect(manifest.buildReleases).toBe(original)
})

test("unrestricted action release creation is disabled", async () => {
 const workflow = load(await readFile(".github/workflows/release-pr.yml","utf8")) as any
 const steps = workflow.jobs["release-pr"].steps
 const action = steps.find((s: any) => s.uses?.startsWith("googleapis/release-please-action@"))
 expect(action.with["skip-github-release"]).toBe(true)
 const creator = steps.find((s: any) => s.id === "release")
 expect(creator.run).toBe("bun run scripts/release/create-validated-releases.ts")
 expect(creator.if).toBeUndefined()
})

function tagApi(sha: string): TagApi {
 return {readRef:async()=>({type:"commit",sha}),readTag:async()=>({type:"commit",sha}),createRef:async()=>{}}
}

test("existing lightweight and annotated tags must resolve to validated commit",async()=>{
 const expected="a".repeat(40), other="b".repeat(40)
 await expect(bindTag(tagApi(other),"v1",expected)).rejects.toThrow("differs")
 const annotated={...tagApi(expected),readRef:async()=>({type:"tag",sha:other})}
 expect(await resolvedTag(annotated,"v1")).toBe(expected)
 await bindTag(annotated,"v1",expected)
 await expect(bindTag({...annotated,readTag:async()=>({type:"commit",sha:other})},"v1",expected)).rejects.toThrow("differs")
})

test("conflicting tag creation race cannot pass the readback",async()=>{
 let created=false
 const api={...tagApi("a".repeat(40)),readRef:async()=>created?{type:"commit",sha:"b".repeat(40)}:null,createRef:async()=>{created=true}}
 await expect(bindTag(api,"v1","a".repeat(40))).rejects.toThrow("differs")
})


test("publish signal recovers durable release after retry but rejects wrong commit or draft",async()=>{
 const sha="a".repeat(40), tags=tagApi(sha)
 expect(await confirmedRelease(tags,async()=>({draft:false}),"cli-v1.0.0",sha)).toBe(true)
 expect(await confirmedRelease(tags,async()=>({draft:false}),"cli-v1.0.0","b".repeat(40))).toBe(false)
 expect(await confirmedRelease(tags,async()=>({draft:true}),"cli-v1.0.0",sha)).toBe(false)
 expect(await confirmedRelease(tags,async()=>null,"cli-v1.0.0",sha)).toBe(false)
})
