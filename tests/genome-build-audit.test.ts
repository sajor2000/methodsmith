import { afterEach, expect, test } from "bun:test"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const roots: string[] = []
const script = path.join(process.cwd(), "plugins/methodsmith/skills/method-genome-build/scripts/audit_build.py")
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

function audit(files: Record<string, string>, declared = "GRCh38", noTools = false, samHeader?: string) {
  const root = mkdtempSync(path.join(tmpdir(), "genome-audit-")); roots.push(root)
  for (const [name, contents] of Object.entries(files)) writeFileSync(path.join(root, name), contents)
  const bin = path.join(root, "bin")
  if (samHeader !== undefined) {
    mkdirSync(bin)
    const samtools = path.join(bin, "samtools")
    writeFileSync(samtools, '#!/bin/sh\n/bin/cat "$0.header"\n')
    writeFileSync(samtools + ".header", samHeader)
    chmodSync(samtools, 0o700)
  }
  const result = Bun.spawnSync([Bun.which("python3")!, script, root, "--declared", declared,
    "--manifest", path.join(root, "audit.json"), "--report", path.join(root, "audit.md")], {
    env: samHeader !== undefined ? { ...process.env, PATH: bin } : noTools ? { ...process.env, PATH: "" } : process.env,
  })
  return { code: result.exitCode, report: readFileSync(path.join(root, "audit.md"), "utf8"),
    manifest: JSON.parse(readFileSync(path.join(root, "audit.json"), "utf8")) }
}

test("explicit VCF build and contig length mismatches fail even without MD5", () => {
  for (const header of ["##reference=GRCh37\n", "##contig=<ID=1,length=249250621>\n",
    "##contig=<ID=1,assembly=GRCh37>\n"]) {
    const result = audit({ "input.vcf": "##fileformat=VCFv4.2\n" + header })
    expect(result.code).toBe(2)
    expect(result.manifest.files[0].status).toBe("incompatible")
  }
})

test("matching declarations and lengths provide header evidence with an explicit scope", () => {
  const result = audit({ "input.vcf": "##reference=GRCh38\n##contig=<ID=1,length=248956422,assembly=GRCh38>\n" })
  expect(result.code).toBe(0)
  expect(result.manifest.files[0].status).toBe("verified")
  expect(result.report).toContain("header")
})

test("repeated VCF and BAM build declarations yield unique evidence in first-seen order", () => {
  const results = [
    audit({ "input.vcf": "##reference=GRCh38\n##contig=<ID=1,length=248956422,assembly=GRCh38>\n##contig=<ID=8,length=145138636,assembly=GRCh38>\n" }),
    audit({ "input.bam": "synthetic BAM placeholder" }, "GRCh38", false,
      "@SQ\tSN:1\tLN:248956422\tAS:GRCh38\tUR:GRCh38.fa\n@SQ\tSN:8\tLN:145138636\tAS:GRCh38\tUR:GRCh38.fa\n"),
  ]
  for (const result of results) {
    expect(result.code).toBe(0)
    expect(result.manifest.files[0].status).toBe("verified")
    expect(result.manifest.files[0].evidence).toEqual([
      "matching build declaration", "matching chromosome 1 length", "matching chromosome 8 length",
    ])
    expect(result.report).toContain("Issues found: **0**")
  }
})

test("repeated build mismatches count once while distinct chromosome length issues remain", () => {
  const results = [
    audit({ "input.vcf": "##reference=GRCh37\n##contig=<ID=1,length=249250621,assembly=GRCh37>\n##contig=<ID=8,length=146364022,assembly=GRCh37>\n" }),
    audit({ "input.bam": "synthetic BAM placeholder" }, "GRCh38", false,
      "@SQ\tSN:1\tLN:249250621\tAS:GRCh37\tUR:GRCh37.fa\n@SQ\tSN:8\tLN:146364022\tAS:GRCh37\tUR:GRCh37.fa\n"),
  ]
  for (const result of results) {
    expect(result.code).toBe(2)
    expect(result.manifest.files[0].status).toBe("incompatible")
    expect(result.report).toContain("Issues found: **3**")
    const issues = result.report.split("\n").filter((line: string) => line.startsWith("- "))
      .map((line: string) => line.slice(line.indexOf(": ") + 2))
    expect(issues).toEqual([
      "header declares GRCh37, expected GRCh38",
      "chromosome 1 length 249250621 differs from GRCh38 length 248956422",
      "chromosome 8 length 146364022 differs from GRCh38 length 145138636",
    ])
  }
})

test("absent build evidence and failed inspection never produce a clean audit", () => {
  const inputs: Record<string, string>[] = [{ "input.vcf": "##contig=<ID=1>\n" }, { "input.bam": "synthetic placeholder" }]
  for (const files of inputs) {
    const result = audit(files, "GRCh38", true)
    expect(result.code).toBe(2)
    expect(["unknown", "uninspected"]).toContain(result.manifest.files[0].status)
    expect(result.report).not.toContain("No build mismatches detected.")
  }
  expect(audit({}).code).toBe(2)
})

test("contradictory tokens and diagnostic lengths cannot be overridden by a matching declaration", () => {
  const result = audit({ "input.vcf": "##reference=GRCh38\n##contig=<ID=1,length=249250621,assembly=GRCh38>\n" })
  expect(result.code).toBe(2)
  expect(result.manifest.files[0].status).toBe("incompatible")
})

test("GTF build metadata is checked and T2T requires supported evidence", () => {
  expect(audit({ "genes.gtf": "#!genome-build GRCh37\n1\tsource\tgene\t1\t2\t.\t+\t.\tgene_id x;\n" }).code).toBe(2)
  expect(audit({ "input.vcf": "##contig=<ID=1,length=248387328,assembly=T2T-CHM13v2.0>\n" }, "T2T").code).toBe(0)
  expect(audit({ "input.vcf": "##contig=<ID=1,length=248956422>\n" }, "T2T").code).toBe(2)
})

test("unknown references and unsupported CHM13 versions remain unresolved", () => {
  for (const [header, declared] of [
    ["##reference=unidentified-reference.fa\n", "GRCh38"],
    ["##reference=T2T-CHM13v1.1\n##contig=<ID=1,length=248387328>\n", "T2T"],
  ]) {
    const result = audit({ "input.vcf": header! }, declared!)
    expect(result.code).toBe(2)
    expect(result.manifest.files[0].status).toBe("unknown")
  }
})

test("same-build chromosome naming differences are reported as naming incompatibility", () => {
  const result = audit({
    "one.vcf": "##contig=<ID=chr1,length=248956422>\n",
    "two.vcf": "##contig=<ID=1,length=248956422>\n",
  })
  expect(result.code).toBe(2)
  expect(result.manifest.files.map((file: { status: string }) => file.status)).toEqual(["verified", "verified"])
  expect(result.report).toContain("naming differs, which alone does not identify a build")
})

test("unsupported CHM13 versions cannot evade version checks through separators or suffixes", () => {
  for (const reference of ["T2T-CHM13 v1.1", "T2T-CHM13v2.0.1", "CHM13 version 1.1", "CHM13_version_1.1", "CHM13-v1.1", "T2T-CHM13"]) {
    const result = audit({ "input.vcf": `##reference=${reference}\n##contig=<ID=1,length=248387328>\n` }, "T2T")
    expect(result.code).toBe(2)
    expect(result.manifest.files[0].status).toBe("unknown")
  }
  for (const reference of ["CHM13 v2.0", "CHM13_version_2.0", "CHM13-v2.0"]) {
    expect(audit({ "input.vcf": `##reference=${reference}\n##contig=<ID=1,length=248387328>\n` }, "T2T").code).toBe(0)
  }
})

test("CHM13 prereleases stay unresolved while supported release filenames and URLs remain valid", () => {
  for (const reference of ["CHM13 v2.0-rc1", "CHM13 v2.0_rc1", "CHM13 v2.0-beta", "CHM13v2.0-rc1.fa.gz"]) {
    const result = audit({ "input.vcf": `##reference=${reference}\n##contig=<ID=1,length=248387328>\n` }, "T2T")
    expect(result.code).toBe(2)
    expect(result.manifest.files[0].status).toBe("unknown")
  }
  for (const reference of ["chm13v2.0.fa.gz", "https://example.org/references/chm13v2.0.fasta?download=1"]) {
    expect(audit({ "input.vcf": `##reference=${reference}\n##contig=<ID=1,length=248387328>\n` }, "T2T").code).toBe(0)
  }
})

test("BAM assembly/reference tags and standard GFF3 build directives are inspected", () => {
  const matching = audit({ "input.bam": "synthetic BAM placeholder" }, "GRCh38", false,
    "@SQ\tSN:2\tLN:242193529\tAS:GRCh38\n")
  expect(matching.code).toBe(0)
  expect(matching.manifest.files[0].status).toBe("verified")
  for (const tag of ["AS:GRCh37", "UR:file:///references/GRCh37.fa"]) {
    const result = audit({ "input.bam": "synthetic BAM placeholder" }, "GRCh38", false,
      `@SQ\tSN:1\tLN:248956422\t${tag}\n`)
    expect(result.code).toBe(2)
    expect(result.manifest.files[0].status).toBe("incompatible")
  }
  expect(audit({ "genes.gff3": "##genome-build NCBI GRCh38.p14\n1\tsource\tgene\t1\t2\t.\t+\t.\tID=x\n" }).code).toBe(0)
  expect(audit({ "genes.gff3": "##genome-build NCBI GRCh37.p13\n1\tsource\tgene\t1\t2\t.\t+\t.\tID=x\n" }).code).toBe(2)
})

test("GENCODE description headers supply build evidence without fabricating absent declarations", () => {
  for (const prefix of ["##description:", "#description:"]) {
    const result = audit({ "gencode.gtf": `${prefix} evidence-based annotation of the human genome (GRCh38), version 44\n##provider: GENCODE\nchr1\tsource\tgene\t1\t2\t.\t+\t.\tgene_id x;\n` })
    expect(result.code).toBe(0)
    expect(result.manifest.files[0].status).toBe("verified")
  }
  const mismatch = audit({ "gencode.gtf": "##description: evidence-based annotation of the human genome (GRCh37), version 19\n" })
  expect(mismatch.code).toBe(2)
  expect(mismatch.manifest.files[0].status).toBe("incompatible")
  const unknown = audit({ "gencode.gtf": "##description: annotation without a declared build\n##provider: GENCODE\n" })
  expect(unknown.code).toBe(2)
  expect(unknown.manifest.files[0].status).toBe("unknown")
})
