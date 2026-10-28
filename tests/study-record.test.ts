import { afterEach, expect, test } from "bun:test"
import { mkdtemp, readFile, writeFile, mkdir, rm, symlink } from "fs/promises"
import os from "os"
import path from "path"
const script = path.resolve("plugins/methodsmith/skills/method-study/scripts/study_record.py")
const roots: string[] = []
afterEach(async () => { for (const p of roots.splice(0)) await rm(p, {recursive:true, force:true}) })
async function setup() {
 const root = await mkdtemp(path.join(os.tmpdir(),"study-")); roots.push(root)
 const state = path.join(root,"state")
 async function run(...args:string[]) {
  const p = Bun.spawn(["python3",script,"--root",state,"--study-id","demo",...args],{stdout:"pipe",stderr:"pipe"})
  return {code:await p.exited, out:await new Response(p.stdout).text(), err:await new Response(p.stderr).text()}
 }
 expect((await run("init","--approved-local-root")).code).toBe(0)
 return {root,state,run}
}
test("intake preserves originals and records unknown provenance without execution",async()=>{
 const {root,state,run}=await setup(); const source=path.join(root,"analysis.py")
 await writeFile(source,"print('synthetic')\n")
 expect((await run("add","--expected-revision","0","--id","code","--path",source,"--kind","code")).code).toBe(0)
 const record=JSON.parse(await readFile(path.join(state,"study.json"),"utf8"))
 expect(record.artifacts.code.provenance).toBe("unknown")
 expect(record.artifacts.code.execution).toBe("unrun")
 expect(await readFile(source,"utf8")).toBe("print('synthetic')\n")
 expect((await run("add","--expected-revision","0","--id","other","--path",source,"--kind","code")).code).toBe(1)
 expect(JSON.parse(await readFile(path.join(state,"study.json"),"utf8")).revision).toBe(1)
})
test("stale code invalidates dependent results and approval without changing originals",async()=>{
 const {root,run}=await setup(); const code=path.join(root,"code.py"), table=path.join(root,"table.md")
 await writeFile(code,"x=1"); await writeFile(table,"N=10")
 await run("add","--expected-revision","0","--id","code","--path",code,"--kind","code")
 await run("add","--expected-revision","1","--id","table","--path",table,"--kind","table","--depends-on","code")
 await writeFile(code,"x=2")
 const status=JSON.parse((await run("status")).out)
 expect(status.artifacts.code.freshness).toBe("stale")
 expect(status.artifacts.table.freshness).toBe("stale")
 expect(status.coverage).toBe("incomplete")
 expect((await run("refresh","--expected-revision","2","--id","code")).code).toBe(0)
 expect(JSON.parse((await run("status")).out).artifacts.table.freshness).toBe("stale")
})
test("unknown schema, symlink state files, and conflicting locks fail closed",async()=>{
 const {root,state,run}=await setup(); const file=path.join(state,"study.json")
 const saved=await readFile(file,"utf8")
 await writeFile(file,saved.replace('"schema_version": 1','"schema_version": 99'))
 expect((await run("status")).code).toBe(1)
 await writeFile(file,saved); await mkdir(path.join(state,".write-lock"))
 const source=path.join(root,"a.md"); await writeFile(source,"safe")
 expect((await run("add","--expected-revision","0","--id","a","--path",source,"--kind","code")).code).toBe(1)
 expect(await readFile(file,"utf8")).toBe(saved)
 await rm(path.join(state,".write-lock"),{recursive:true}); await rm(file); await symlink(source,file)
 expect((await run("status")).code).toBe(1)
 expect(await readFile(source,"utf8")).toBe("safe")
})
test("submission snapshots preserve bytes and cannot overwrite prior rounds",async()=>{
 const {root,state,run}=await setup(); const source=path.join(root,"paper.md")
 await writeFile(source,"original submission")
 await run("add","--expected-revision","0","--id","paper","--path",source,"--kind","manuscript")
 expect((await run("snapshot","--expected-revision","1","--id","round1")).code).toBe(0)
 await writeFile(source,"revised paper")
 expect(await readFile(path.join(state,"snapshots/round1/paper"),"utf8")).toBe("original submission")
 expect((await run("snapshot","--expected-revision","2","--id","round1")).code).toBe(1)
})
test("approvals expire after dependency changes and refresh cannot invent execution",async()=>{
 const {root,run}=await setup(); const source=path.join(root,"plan.md")
 await writeFile(source,"approved analysis plan")
 await run("add","--expected-revision","0","--id","plan","--path",source,"--kind","plan","--dependencies-complete")
 expect((await run("approve","--expected-revision","1","--id","plan","--reviewer","PI","--human-confirmed")).code).toBe(0)
 expect(JSON.parse((await run("status")).out).artifacts.plan.human_approval).toBe("recorded-current")
 await writeFile(source,"changed analysis plan")
 expect(JSON.parse((await run("status")).out).artifacts.plan.human_approval).toBe("unapproved")
 expect((await run("refresh","--expected-revision","2","--id","plan")).code).toBe(0)
 const result=JSON.parse((await run("status")).out)
 expect(result.artifacts.plan.execution).toBe("unrun")
 expect(result.artifacts.plan.human_approval).toBe("unapproved")
})


test("incomplete ancestor coverage blocks downstream approval",async()=>{
 const {root,run}=await setup()
 for(const [revision,id,dependency] of [[0,"input",null],[1,"code","input"],[2,"table","code"]] as const){
  const file=path.join(root,id+".txt"); await writeFile(file,"synthetic")
  const args=["add","--expected-revision",String(revision),"--id",id,"--path",file,"--kind",id==="input"?"data":id==="code"?"code":"table"]
  if(dependency) args.push("--depends-on",dependency,"--dependencies-complete")
  expect((await run(...args)).code).toBe(0)
 }
 const status=JSON.parse((await run("status")).out)
 expect(status.artifacts.code.coverage).toBe("incomplete")
 expect(status.artifacts.table.coverage).toBe("incomplete")
 expect((await run("approve","--expected-revision","3","--id","table","--reviewer","PI","--human-confirmed")).code).toBe(1)
})
test("hand-written records with an invalid artifact kind fail closed",async()=>{
 const {root,state,run}=await setup(); const source=path.join(root,"table.md")
 await writeFile(source,"N=10")
 expect((await run("add","--expected-revision","0","--id","table","--path",source,"--kind","table")).code).toBe(0)
 const file=path.join(state,"study.json")
 await writeFile(file,(await readFile(file,"utf8")).replace('"kind": "table"','"kind": "dataset"'))
 const status=await run("status")
 expect(status.code).toBe(1)
 expect(status.out).toContain("invalid artifact kind")
})
