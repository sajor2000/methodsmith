import { expect, test } from "bun:test"
import { mkdtemp, writeFile, readFile, rm } from "fs/promises"
import path from "path"
import os from "os"
const script=path.resolve("plugins/methodsmith/skills/method-study/scripts/share_study.py")
test("shared projection contains statuses, never protected paths, comments or output", async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"study-share-"))
 try {
 const input=path.join(root,"status.json"), output=path.join(root,"status.html")
 await writeFile(input,JSON.stringify({study_id:"demo",revision:1,record_digest:"a".repeat(64),coverage:"incomplete",artifacts:{figure:{freshness:"stale",provenance:"unknown",execution:"unrun",human_approval:"unapproved",coverage:"incomplete",path:"SENSITIVE_CANARY",output:"SENSITIVE_CANARY",comment:"<script>SENSITIVE_CANARY</script>"}}}))
 const p=Bun.spawn(["python3",script,"--status",input,"--output",output,"--reviewed-for-sharing"],{stdout:"pipe",stderr:"pipe"})
 expect(await p.exited).toBe(0)
 const html=await readFile(output,"utf8")
 expect(html).toContain("stale"); expect(html).not.toContain("SENSITIVE_CANARY")
 expect(html).toContain("Snapshot"); expect(html).toContain("incomplete")
 const q=Bun.spawn(["python3",script,"--status",input,"--output",output],{stdout:"pipe",stderr:"pipe"})
 expect(await q.exited).toBe(1)
 } finally {await rm(root,{recursive:true,force:true})}
})
test("Git disclosure review binds staged bytes and outgoing history",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"disclosure-"))
 const helper=path.resolve("plugins/methodsmith/skills/method-study/scripts/git_disclosure.py")
 const git=(...args:string[])=>Bun.spawnSync(["git","-C",root,...args])
 try {
 git("init");git("config","user.email","synthetic@example.invalid");git("config","user.name","Synthetic")
 await writeFile(path.join(root,"file.md"),"SENSITIVE_CANARY");git("add","file.md");git("commit","-m","fixture")
 const run=(...args:string[])=>Bun.spawnSync(["python3",helper,"--repo",root,"--base","HEAD",...args])
 const first=run();expect(first.exitCode).toBe(1);expect(first.stdout.toString()).not.toContain("SENSITIVE_CANARY")
 const value=JSON.parse(first.stdout.toString()),approval=path.join(root,"approval.json")
 await writeFile(approval,JSON.stringify({inventory_digest:value.inventory_digest,reviewer:"PI",timestamp:"2026-10-27"}))
 expect(run("--approval",approval).exitCode).toBe(0)
 await writeFile(path.join(root,"file.md"),"changed staged bytes");git("add","file.md")
 expect(run("--approval",approval).exitCode).toBe(1)
 }finally{await rm(root,{recursive:true,force:true})}
})
