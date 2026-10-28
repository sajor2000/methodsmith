import { expect, test } from "bun:test"
import { mkdtemp, writeFile, rm } from "fs/promises"
import path from "path"
import os from "os"
const script=path.resolve("plugins/methodsmith/skills/method-submission-package/scripts/validate_journal_profile.py")
test("journal requirements need dated sources and unresolved mandatory checks block readiness",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"journal-profile-")),file=path.join(root,"profile.json")
 const profile={schema_version:1,journal:"Synthetic Journal",article_type:"Original Research",source_url:"https://example.org/authors",retrieved_at:"2026-10-27",rules:[{id:"abstract",requirement:"Structured abstract",source_location:"Abstract section",required:true,check_kind:"human",status:"unresolved",evidence:null}]}
 async function run(){await writeFile(file,JSON.stringify(profile));const p=Bun.spawn(["python3",script,file],{stdout:"pipe",stderr:"pipe"});return {code:await p.exited,out:await new Response(p.stdout).text()}}
 try {
 expect((await run()).code).toBe(1)
 profile.rules[0]!.status="passed"
 expect((await run()).code).toBe(1) // no evidence
 }finally{await rm(root,{recursive:true,force:true})}
})
test("dated journal profile binds passing checks to retained evidence",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"journal-evidence-")),file=path.join(root,"profile.json")
 try {
 const evidence="Synthetic journal transfer review: claims and numbers unchanged."
 await writeFile(path.join(root,"review.md"),evidence)
 await writeFile(file,JSON.stringify({schema_version:1,journal:"Synthetic Journal",article_type:"Original Research",source_url:"https://example.org/authors",retrieved_at:"2026-10-27",rules:[{id:"meaning",requirement:"Preserve scientific meaning",source_location:"Author review",required:true,check_kind:"human",status:"passed",evidence:{path:"review.md",sha256:new Bun.CryptoHasher("sha256").update(evidence).digest("hex"),reviewer:"PI"}}]}))
 const run=()=>Bun.spawnSync(["python3",script,file])
 expect(run().exitCode).toBe(0)
 await writeFile(path.join(root,"review.md"),"changed review")
 expect(run().exitCode).toBe(1)
 }finally{await rm(root,{recursive:true,force:true})}
})
