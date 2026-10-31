import { expect, test } from "bun:test"
import { mkdtemp, writeFile, readFile, rm, access } from "fs/promises"
import path from "path"
import os from "os"
function runtimeAvailable(args:string[]):boolean {
 try { return Bun.spawnSync(args,{stdout:"pipe",stderr:"pipe"}).exitCode===0 }
 catch { return false }
}
const script=path.resolve("plugins/methodsmith/skills/method-study/scripts/notebook_evidence.py")
test("all formats refuse execution without authorization and retain native inputs",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"study-engine-"))
 try { for (const ext of ["ipynb","py","Rmd","qmd"]) {
  const source=path.join(root,`source.${ext}`); await writeFile(source,"synthetic original")
  const p=Bun.spawn(["python3",script,"--source",source,"--run-dir",path.join(root,ext)],{stdout:"pipe",stderr:"pipe"})
  expect(await p.exited).toBe(1)
  expect(await new Response(p.stdout).text()).toContain("authorization")
  expect(await readFile(source,"utf8")).toBe("synthetic original")
 }} finally {await rm(root,{recursive:true,force:true})}
})
const hasNotebookRuntime=Bun.spawnSync(["python3","-c","import nbformat,nbclient,ipykernel"]).exitCode===0
test.skipIf(!hasNotebookRuntime)("fresh Jupyter execution records success and cell errors never pass",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"study-jupyter-"))
 try {for(const fail of [false,true]){
 const source=path.join(root,fail?"error.ipynb":"ok.ipynb")
 const notebook={nbformat:4,nbformat_minor:5,metadata:{kernelspec:{name:"python3",display_name:"Python 3",language:"python"}},cells:[{id:"narrative",cell_type:"markdown",metadata:{},source:"Synthetic execution test"},{id:"calculation",cell_type:"code",metadata:{tags:["raises-exception"]},source:fail?"raise ValueError('SENSITIVE_CANARY')":"assert 2 + 2 == 4",outputs:[],execution_count:null}]}
 await writeFile(source,JSON.stringify(notebook))
 const run=path.join(root,fail?"fail-run":"ok-run")
 const p=Bun.spawn(["python3",script,"--source",source,"--run-dir",run,"--authorized-execution","--timeout","30"],{stdout:"pipe",stderr:"pipe"})
 expect(await p.exited).toBe(fail?1:0)
 const out=await new Response(p.stdout).text()
 expect(out).not.toContain("SENSITIVE_CANARY")
 expect(JSON.parse(await readFile(path.join(run,"run.json"),"utf8")).status).toBe(fail?"failed":"success")
 expect(JSON.parse(await readFile(source,"utf8")).cells[1].execution_count).toBeNull()
 }}finally{await rm(root,{recursive:true,force:true})}
})
const hasRMarkdown=runtimeAvailable(["Rscript","--vanilla","-e","quit(status=if(requireNamespace('rmarkdown',quietly=TRUE)) 0 else 1)"])
test.skipIf(!hasRMarkdown)("R Markdown allowed-error chunks fail verification",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"study-rmd-"))
 try{
 const source=path.join(root,"error.Rmd")
 await writeFile(source,'---\ntitle: Synthetic failure test\noutput: html_document\n---\n\n```{r deliberate, error=TRUE}\nstop("SENSITIVE_CANARY")\n```\n')
 const p=Bun.spawn(["python3",script,"--source",source,"--run-dir",path.join(root,"run"),"--authorized-execution"],{stdout:"pipe",stderr:"pipe"})
 expect(await p.exited).toBe(1)
 const output=await new Response(p.stdout).text()
 expect(JSON.parse(output).status).toBe("failed")
 expect(output).not.toContain("SENSITIVE_CANARY")
 }finally{await rm(root,{recursive:true,force:true})}
})

test.skipIf(!hasNotebookRuntime)("skipped cells cannot retain historical results or pass execution",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"study-skipped-"))
 try {
  const source=path.join(root,"skip.ipynb"), run=path.join(root,"run")
  const notebook={nbformat:4,nbformat_minor:5,metadata:{},cells:[{id:"skip",cell_type:"code",metadata:{tags:["skip-execution"]},source:"raise RuntimeError('must not execute')",execution_count:17,outputs:[{output_type:"stream",name:"stdout",text:"historical value"}]}]}
  await writeFile(source,JSON.stringify(notebook))
  const p=Bun.spawn(["python3",script,"--source",source,"--run-dir",run,"--authorized-execution"],{stdout:"pipe",stderr:"pipe"})
  expect(await p.exited).toBe(1)
  const executed=JSON.parse(await readFile(path.join(run,"skip.ipynb"),"utf8"))
  expect(executed.cells[0].outputs).toEqual([])
  expect(executed.cells[0].execution_count).toBeNull()
  const evidence=JSON.parse(await readFile(path.join(run,"run.json"),"utf8"))
  expect(evidence.status).toBe("failed")
  expect(evidence.execution_coverage.skipped_code_cells).toEqual([0])
  expect(JSON.parse(await readFile(source,"utf8")).cells[0].execution_count).toBe(17)
 } finally {await rm(root,{recursive:true,force:true})}
})

test.skipIf(!hasNotebookRuntime)("run attachment binds declared inputs and retained execution outputs",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"study-run-binding-"))
 try {
  const source=path.join(root,"analysis.ipynb"), input=path.join(root,"input.txt"), study=path.join(root,"study"), run=path.join(root,"run")
  await writeFile(input,"1")
  await writeFile(source,JSON.stringify({nbformat:4,nbformat_minor:5,metadata:{},cells:[{id:"calculation",cell_type:"code",metadata:{},source:"print(int(open('input.txt').read()) * 2)",outputs:[],execution_count:null}]}))
  const record=path.join(path.dirname(script),"study_record.py")
  async function command(args:string[],expected=0){
   const p=Bun.spawn(["python3",record,"--root",study,"--study-id","test",...args],{stdout:"pipe",stderr:"pipe"})
   const out=await new Response(p.stdout).text(); expect(await p.exited).toBe(expected); return JSON.parse(out)
  }
  await command(["init","--approved-local-root"])
  await command(["add","--expected-revision","0","--id","input","--path",input,"--kind","data","--dependencies-complete"])
  await command(["add","--expected-revision","1","--id","analysis","--path",source,"--kind","notebook","--depends-on","input","--dependencies-complete"])
  const p=Bun.spawn(["python3",script,"--source",source,"--run-dir",run,"--authorized-execution","--study-root",study,"--study-id","test","--artifact-id","analysis"],{stdout:"pipe",stderr:"pipe"})
  expect(await p.exited).toBe(0)
  const attach=(rev:string)=>["record-run","--expected-revision",rev,"--id","analysis","--evidence",path.join(run,"run.json")]
  const evidencePath=path.join(run,"run.json")
  const genuine=JSON.parse(await readFile(evidencePath,"utf8"))
  const malformed=[
   {...genuine,exit_code:99},
   {...genuine,execution_coverage:{skipped_code_cells:[0]}},
   {...genuine,dependency_coverage:"incomplete"},
   {...genuine,completed_at:true},
   {...genuine,environment:["not a mapping"]},
   {...genuine,schema_version:99},
   {...genuine,outputs:{"execution.log":genuine.outputs["execution.log"]}},
   {...genuine,output_digest:"0".repeat(64)},
  ]
  for(const invalid of malformed){
   await writeFile(evidencePath,JSON.stringify(invalid))
   await command(attach("2"),1)
  }
  await writeFile(evidencePath,JSON.stringify(genuine))
  await command(attach("2"))
  expect((await command(["status"])).artifacts.analysis.freshness).toBe("current")
  const output=path.join(run,"analysis.ipynb"), bytes=await readFile(output)
  await writeFile(output,"altered output")
  expect((await command(["status"])).artifacts.analysis.freshness).not.toBe("current")
  await rm(output)
  expect((await command(["status"])).artifacts.analysis.freshness).not.toBe("current")
  await writeFile(output,bytes)
  await writeFile(input,"100")
  await command(["refresh","--expected-revision","3","--id","input"])
  await command(["refresh","--expected-revision","4","--id","analysis"])
  expect((await command(attach("5"),1)).reason).toContain("input binding mismatch")
  expect((await command(["status"])).artifacts.analysis.execution).toBe("unrun")
 } finally {await rm(root,{recursive:true,force:true})}
})

const hasQuarto=runtimeAvailable(["quarto","--version"])
test.skipIf(!hasQuarto || !hasNotebookRuntime)("Quarto render success cannot hide allowed errors or unexecuted chunks",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"study-quarto-"))
 try {
  for(const mode of ["success","error","skip","flow-skip","alias-skip","format-skip","tag-skip"]){
   const source=path.join(root,mode+".qmd"),run=path.join(root,mode+"-run")
   const code=mode==="tag-skip"?"#| tags: [skip-execution]\nraise ValueError('must not execute')":mode.endsWith("-skip")?"raise ValueError('must not execute')":mode==="error"?"raise ValueError('SYNTHETIC_CANARY')":mode==="skip"?"#| eval: false\nprint('historical')":"assert 2+2 == 4"
   const options=mode==="format-skip"?"format: {html: {execute: {eval: false}}}":mode==="flow-skip"?"execute: {eval: false}":mode==="alias-skip"?"settings: &disabled {eval: false}\nexecute: *disabled":"execute:\n  error: true"
   await writeFile(source,`---\ntitle: Synthetic---probe\n${mode==="format-skip"?"":"format: html\n"}jupyter: python3\n${options}\n---\n\n\`\`\`{python}\n${code}\n\`\`\`\n`)
   const p=Bun.spawn(["python3",script,"--source",source,"--run-dir",run,"--authorized-execution"],{stdout:"pipe",stderr:"pipe"})
   expect(await p.exited).toBe(mode==="success"?0:1)
   const out=await new Response(p.stdout).text()
   expect(out).not.toContain("SYNTHETIC_CANARY")
   expect(JSON.parse(await readFile(path.join(run,"run.json"),"utf8")).status).toBe(mode==="success"?"success":"failed")
  }
 }finally{await rm(root,{recursive:true,force:true})}
},60000)

test("execution options reject nested disables, external metadata and cycles",async()=>{
 const code=`import sys
sys.path.insert(0,sys.argv[1])
from study_record import execution_options_enabled,notebook_execution_complete,RecordError
import tempfile,json
from pathlib import Path
assert execution_options_enabled({'format':{'html':{'execute':{'eval':True}}}})
for options in [{'format':{'html':{'execute':{'eval':False}}}}, {'formats':[{'execute':{'eval':False}}]}, {'execute':False}, {'execute':{'eval':'true'}}, {'tags':['skip-execution']}, {'jupyter':{'tags':['skip-execution']}}]:
 assert not execution_options_enabled(options)
with tempfile.TemporaryDirectory() as root:
 p=Path(root)/'executed.ipynb'
 p.write_text(json.dumps({'cells':[{'cell_type':'code','metadata':{'tags':['skip-execution']},'source':'raise ValueError()', 'execution_count':1,'outputs':[]}]}))
 assert not notebook_execution_complete(p)
cycle={}; cycle['child']=cycle
for options in [cycle, {'metadata-files':['external.yml']}, {'format':{'html':{'metadata-file':'external.yml'}}}]:
 try: execution_options_enabled(options)
 except RecordError: pass
 else: raise AssertionError('unsupported execution options accepted')
`
 const p=Bun.spawn(["python3","-c",code,path.dirname(script)],{stdout:"pipe",stderr:"pipe"})
 expect(await p.exited).toBe(0)
})

test("inherited Quarto projects block before execution rather than override exclusions",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"study-quarto-project-"))
 try{
  const source=path.join(root,"analysis.qmd")
  await writeFile(source,"---\njupyter: python3\n---\n```{python}\nraise ValueError('must not execute')\n```\n")
  await writeFile(path.join(root,"_quarto.yml"),"project:\n  type: default\nexecute: {eval: false}\n")
  const p=Bun.spawn(["python3",script,"--source",source,"--run-dir",path.join(root,"run"),"--authorized-execution"],{stdout:"pipe",stderr:"pipe"})
  expect(await p.exited).toBe(1)
  const response=JSON.parse(await new Response(p.stdout).text())
  expect(response.status).toBe("blocked")
  expect(response.reason).toContain("inherited Quarto project")
 }finally{await rm(root,{recursive:true,force:true})}
})

test("uppercase .PY routes to the marimo adapter instead of Quarto",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"study-py-case-"))
 try{
  const source=path.join(root,"source.PY"); await writeFile(source,"import marimo as mo\n")
  const run=path.join(root,"run")
  const p=Bun.spawn(["python3",script,"--source",source,"--run-dir",run,"--authorized-execution"],{stdout:"pipe",stderr:"pipe"})
  await p.exited
  const evidence=JSON.parse(await readFile(path.join(run,"run.json"),"utf8"))
  expect(evidence.format).toBe(".py")
  expect(evidence.quarto_project_mode).toBeUndefined()
  expect(await access(path.join(run,"_quarto.yml")).then(()=>true,()=>false)).toBe(false)
 }finally{await rm(root,{recursive:true,force:true})}
})

test("timeout kills stay portable: killpg when present, process.kill otherwise",async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"study-timeout-"))
 try{
  await writeFile(path.join(root,"slow.py"),"import marimo as mo\n")
  const harness=[
   "import json, os, shutil, subprocess, sys",
   "skill_dir, root = sys.argv[1], sys.argv[2]",
   "sys.path.insert(0, skill_dir)",
   "import notebook_evidence",
   "real_popen, real_which = subprocess.Popen, shutil.which",
   "def fake_popen(command, **kwargs):",
   "    return real_popen([sys.executable, '-c', 'import time; time.sleep(60)'], **kwargs)",
   "subprocess.Popen = fake_popen",
   "shutil.which = lambda name: '/usr/bin/marimo' if name == 'marimo' else real_which(name)",
   "expected = (1, 'failed', 'timeout')",
   "for label, keep_killpg in (('posix', True), ('fallback', False)):",
   "    saved = getattr(os, 'killpg', None)",
   "    if keep_killpg and saved is None:",
   "        continue",
   "    if not keep_killpg and saved is not None:",
   "        del os.killpg",
   "    try:",
   "        sys.argv = ['notebook_evidence.py', '--source', os.path.join(root, 'slow.py'),",
   "                    '--run-dir', os.path.join(root, 'run-' + label), '--authorized-execution', '--timeout', '2']",
   "        code = notebook_evidence.main()",
   "        evidence = json.load(open(os.path.join(root, 'run-' + label, 'run.json')))",
   "        assert (code, evidence['status'], evidence['reason']) == expected, (label, code, evidence)",
   "    finally:",
   "        if saved is not None and not hasattr(os, 'killpg'):",
   "            os.killpg = saved",
   "subprocess.Popen, shutil.which = real_popen, real_which",
   "print('portable')",
  ].join("\n")
  const p=Bun.spawn(["python3","-c",harness,path.dirname(script),root],{stdout:"pipe",stderr:"pipe"})
  expect(await p.exited).toBe(0)
 }finally{await rm(root,{recursive:true,force:true})}
},30000)
