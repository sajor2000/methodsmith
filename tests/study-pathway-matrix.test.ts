import { expect, test } from "bun:test"
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises"
import path from "node:path"
import os from "node:os"
function runtimeAvailable(args:string[]):boolean {
 try { return Bun.spawnSync(args,{stdout:"pipe",stderr:"pipe"}).exitCode===0 }
 catch { return false }
}
const adapter=path.resolve("plugins/methodsmith/skills/method-study/scripts/notebook_evidence.py")
const pythonReady=Bun.spawnSync(["python3","-c","import nbformat,nbclient,ipykernel"],{stdout:"pipe",stderr:"pipe"}).exitCode===0
const available=(command:string)=>runtimeAvailable([command,"--version"])
const rReady=runtimeAvailable(["Rscript","--vanilla","-e","quit(status=if(requireNamespace('rmarkdown',quietly=TRUE)) 0 else 1)"])
// Tiny seeded arithmetic checks exercise adapter wiring only. They are not
// statistical-method recommendations, model validation, or clinical evidence.
const pathways=[
 {name:"clinical",py:"treated=[1,0,1,0,1]; control=[0,0,1,0,1]\nassert abs(sum(treated)/5-sum(control)/5-0.2)<1e-12",r:"treated<-c(1,0,1,0,1); control<-c(0,0,1,0,1)\nstopifnot(abs(mean(treated)-mean(control)-0.2)<1e-12)"},
 {name:"prediction",py:"x=[0.,1.,2.]; y=[1.,3.,5.]\nmx=sum(x)/3; my=sum(y)/3\nb=sum((a-mx)*(b-my) for a,b in zip(x,y))/sum((a-mx)**2 for a in x)\na=my-b*mx\nassert abs((a+b*3)-7)<1e-12",r:"x<-c(0,1,2); y<-c(1,3,5)\nfit<-lm(y~x)\nstopifnot(abs(predict(fit,data.frame(x=3))-7)<1e-12)"},
 {name:"meta",py:"effects=[0.2,0.4]; variances=[0.01,0.01]\nweights=[1/v for v in variances]\npooled=sum(w*e for w,e in zip(weights,effects))/sum(weights)\nassert abs(pooled-0.3)<1e-12",r:"effects<-c(0.2,0.4); variances<-c(0.01,0.01)\npooled<-sum(effects/variances)/sum(1/variances)\nstopifnot(abs(pooled-0.3)<1e-12)"},
]
for(const format of ["ipynb","py","Rmd","qmd"]){
 const ready=format==="ipynb"?pythonReady:format==="py"?available("marimo"):format==="Rmd"?rReady:pythonReady&&available("quarto")
 for(const pathway of pathways){
  test.skipIf(!ready)(`synthetic ${pathway.name} pathway executes as native ${format}`,async()=>{
   const root=await mkdtemp(path.join(os.tmpdir(),"study-matrix-"))
   try{
    let content:string
    if(format==="ipynb") content=JSON.stringify({nbformat:4,nbformat_minor:5,metadata:{},cells:[{id:"calculation",cell_type:"code",metadata:{},source:pathway.py,outputs:[],execution_count:null}]})
    else if(format==="py") content=`import marimo\napp=marimo.App()\n@app.cell\ndef _():\n${pathway.py.split("\n").map(line=>"    "+line).join("\n")}\n    return\nif __name__ == "__main__":\n    app.run()\n`
    else if(format==="Rmd") content=`---\ntitle: Synthetic ${pathway.name}\noutput: html_document\n---\n\n\`\`\`{r}\n${pathway.r}\n\`\`\`\n`
    else content=`---\ntitle: Synthetic ${pathway.name}\nformat: html\njupyter: python3\n---\n\n\`\`\`{python}\n${pathway.py}\n\`\`\`\n`
    const source=path.join(root,"analysis."+format),run=path.join(root,"run")
    await writeFile(source,content)
    const p=Bun.spawn(["python3",adapter,"--source",source,"--run-dir",run,"--authorized-execution"],{stdout:"pipe",stderr:"pipe"})
    expect(await p.exited).toBe(0)
    const evidence=JSON.parse(await readFile(path.join(run,"run.json"),"utf8"))
    expect(evidence.status).toBe("success")
    expect(evidence.outputs[evidence.primary_output]).toBe(evidence.output_digest)
    expect(await readFile(source,"utf8")).toBe(content)
   }finally{await rm(root,{recursive:true,force:true})}
  },30000)
 }
}
