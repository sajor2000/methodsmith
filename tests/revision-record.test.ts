import { expect, test } from "bun:test"
import { mkdtemp, writeFile, rm } from "fs/promises"
import path from "path"
import os from "os"
const script=path.resolve("plugins/methodsmith/skills/method-revision/scripts/validate_revision.py")
test("shared reanalysis keeps separate comments and blocks unsupported completion claims",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"revision-")); const file=path.join(root,"round.json")
 const record={schema_version:1,round_id:"round1",baseline:{snapshot_id:"submission1",provenance:"unknown"},changes:{analysis1:{kind:"reanalysis",post_submission:true,state:"implemented",authorization:"decision1",evidence:[]}},comments:[{id:"R1-C2",verbatim:"Please test sensitivity",disposition:"address",rationale:"Relevant",changes:["analysis1"],response_claim:"completed",manuscript_location:"Results paragraph 2"},{id:"R2-C4",verbatim:"Please test sensitivity too",disposition:"address",rationale:"Same analysis",changes:["analysis1"],response_claim:"partial",manuscript_location:"Results paragraph 2"}]}
 async function run(){ await writeFile(file,JSON.stringify(record));const p=Bun.spawn(["python3",script,file],{stdout:"pipe",stderr:"pipe"});return {code:await p.exited,out:await new Response(p.stdout).text()} }
 try {
 expect((await run()).code).toBe(1)
 record.comments[0]!.response_claim="partial"
 const result=await run(); expect(result.code).toBe(0); expect(result.out).toContain("draft-only"); expect(result.out).not.toContain("Please test")
 record.changes.analysis1.post_submission=false
 expect((await run()).code).toBe(1)
 }finally{await rm(root,{recursive:true,force:true})}
})
