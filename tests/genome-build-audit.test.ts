import { afterEach, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const roots: string[] = []
const script = path.join(process.cwd(), "plugins/methodsmith/skills/method-genome-build/scripts/audit_build.py")
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

function audit(files: Record<string, string>, declared = "GRCh38", noTools = false) {
  const root = mkdtempSync(path.join(tmpdir(), "genome-audit-")); roots.push(root)
  for (const [name, contents] of Object.entries(files)) writeFileSync(path.join(root, name), contents)
  const result = Bun.spawnSync([Bun.which("python3")!, script, root, "--declared", declared,
    "--manifest", path.join(root, "audit.json"), "--report", path.join(root, "audit.md")], {
    env: noTools ? { ...process.env, PATH: "" } : process.env,
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
