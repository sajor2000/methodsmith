import { expect, test } from "bun:test"
import { mkdtemp, writeFile, readFile, rm } from "fs/promises"
import path from "path"
import os from "os"
const script=path.resolve("plugins/methodsmith/skills/method-study/scripts/study_record.py")
test("manuscript handoff never replaces external edits",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"handoff-")),state=path.join(root,"state"),source=path.join(root,"master.docx"),out=path.join(root,"export.docx")
 const run=async(...args:string[])=>{const p=Bun.spawn(["python3",script,"--root",state,"--study-id","demo",...args],{stdout:"pipe",stderr:"pipe"});return p.exited}
 try {
 await writeFile(source,"synthetic field-bearing bytes")
 expect(await run("init","--approved-local-root")).toBe(0)
 expect(await run("add","--expected-revision","0","--id","paper","--path",source,"--kind","manuscript")).toBe(0)
 expect(await run("master","--expected-revision","1","--id","paper","--human-confirmed")).toBe(0)
 expect(await run("export-manuscript","--expected-revision","2","--id","paper","--output",out)).toBe(0)
 await writeFile(out,"coauthor edits")
 expect(await run("export-manuscript","--expected-revision","3","--id","paper","--output",out)).toBe(1)
 const check=Bun.spawnSync(["python3",script,"--root",state,"--study-id","demo","status"])
 expect(JSON.parse(check.stdout.toString()).handoffs[0].state).toBe("reconciliation-required")
 expect(await readFile(out,"utf8")).toBe("coauthor edits")
 expect(await readFile(source,"utf8")).toBe("synthetic field-bearing bytes")
 }finally{await rm(root,{recursive:true,force:true})}
})
