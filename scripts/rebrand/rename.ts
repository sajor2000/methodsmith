#!/usr/bin/env bun
/**
 * Idempotent ce-datascience -> Methodsmith rename.
 *
 *   bun run scripts/rebrand/rename.ts            # apply to the git checkout
 *   bun run scripts/rebrand/rename.ts --dry-run  # report what would change
 *   bun run scripts/rebrand/rename.ts --check    # exit 1 if anything would change or residue remains
 *
 * Rules (all driven by mapping.json):
 * - ce-<skill|agent|script> -> its mapped method-* name, including ids that
 *   extend a mapped name (eval case ids such as ce-plan-rct-estimand-sap).
 * - ce-datascience / CE DataScience / CE_DATASCIENCE / CeDatascience -> methodsmith forms.
 * - The GitHub repo slug and Pages URL move to the renamed repo (old URLs redirect).
 * - The per-project state folder .ce-datascience/ -> .methodsmith/ (6.0 hard rename).
 * - Kept on purpose: old release tags (ce-datascience-v*), upstream Compound Engineering names, legacy names in
 *   mapping.json "keep", lines containing `rebrand:keep`, and regions between
 *   `rebrand:keep-start` and `rebrand:keep-end`.
 * - Files in EXCLUDED_PATHS (history, the rename tooling itself) keep their content;
 *   their names still follow the rename so links to them stay valid.
 *
 * Every output form is outside every input pattern, so a second run is a no-op.
 */
import { execFileSync } from "child_process"
import { createHash } from "crypto"
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "fs"
import path from "path"
import raw from "./mapping.json"
import { loadRenameMap } from "./mapping"

const map = loadRenameMap()

/** Paths never rewritten or renamed: release history, dated planning records, and this tool. */
export const EXCLUDED_PATHS: RegExp[] = [
  /(^|\/)CHANGELOG\.md$/,
  /^docs\/(brainstorms|plans|ideation)\//,
  /^scripts\/rebrand\//,
  /^tests\/rebrand\.test\.ts$/,
  // Seeds pre-rebrand installs; resolves current plugin paths through rewritePath.
  /^tests\/legacy-cleanup\.test\.ts$/,
  /^src\/data\/shipped-description-fingerprints\.json$/,
  /(^|\/)bun\.lock$/,
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
}

const PROTECTED: RegExp[] = [
  /ce-datascience-v\d[\w.]*/g,
]

const IDENTITY: Array<[RegExp, string]> = [
  [new RegExp(escapeRegExp(raw.plugin.repo.old), "g"), raw.plugin.repo.new],
  [new RegExp(escapeRegExp(raw.plugin.pages.old), "g"), raw.plugin.pages.new],
  [/ce-datascience-plugin/g, raw.plugin.marketplace.new],
  [/ce[-_]datascience/g, raw.plugin.new],
  [/CE_DATASCIENCE/g, "METHODSMITH"],
  [/CE[ -]Data ?Science/g, raw.plugin.displayName],
  [/CE DATASCIENCE/g, "METHODSMITH"],
  [/C[Ee]Data[Ss]cience/g, raw.plugin.displayName],
]

/** The bare prefix in prose (`ce-` prefix, `ce-<name>`), globs (ce-*), and code ("ce-", `ce-${x}`, /^ce-/, (ce-[a-z]). */
const GENERIC_PREFIX = /(?<![A-Za-z0-9_.-])ce-(?=[*<[$"'`]|\/)/g

const OLD_TO_NEW = new Map([...map.allPairs(), ...Object.entries(raw.extra.tokens)])
// Longest first so ce-clif-project-template wins over ce-clif.
const OLD_NAMES_BY_LENGTH = [...OLD_TO_NEW.keys()].sort((a, b) => b.length - a.length)
const KEEP_TOKENS = new Set([...map.upstream.skills, ...map.upstream.agents, ...raw.keep.tokens])

function renameToken(token: string): string {
  const exact = OLD_TO_NEW.get(token)
  if (exact) return exact
  if (KEEP_TOKENS.has(token)) return token
  for (const oldName of OLD_NAMES_BY_LENGTH) {
    if (token.startsWith(`${oldName}-`)) return OLD_TO_NEW.get(oldName)! + token.slice(oldName.length)
  }
  return token
}

function rewriteLine(line: string): string {
  const saved: string[] = []
  let out = line
  for (const pattern of PROTECTED) {
    out = out.replace(pattern, (match) => {
      saved.push(match)
      return `\u0000${saved.length - 1}\u0000`
    })
  }
  for (const [pattern, replacement] of IDENTITY) out = out.replace(pattern, replacement)
  out = out.replace(GENERIC_PREFIX, "method-")
  out = out.replace(/(?<![A-Za-z0-9_.])ce-[a-z0-9]+(?:-[a-z0-9]+)*/g, renameToken)
  out = out.replace(/(?<![A-Za-z0-9])ce_[a-z0-9]+(?:_[a-z0-9]+)*/g, (token) =>
    renameToken(token.replace(/_/g, "-")).replace(/-/g, "_"),
  )
  return out.replace(/\u0000(\d+)\u0000/g, (_, index) => saved[Number(index)])
}

export function rewriteText(text: string): string {
  let keeping = false
  return text
    .split("\n")
    .map((line) => {
      if (line.includes("rebrand:keep-start")) keeping = true
      if (line.includes("rebrand:keep-end")) {
        keeping = false
        return line
      }
      if (keeping || line.includes("rebrand:keep")) return line
      return rewriteLine(line)
    })
    .join("\n")
}

const BLOCK_START = "<!-- rebrand:keep-start renamed-commands -->"
const BLOCK_END = "<!-- rebrand:keep-end -->"

/** Old -> new command table for migration docs, straight from the mapping. */
export function renamedCommandsTable(): string {
  const rows = Object.entries(map.skills).map(([oldName, newName]) => `| \`/${oldName}\` | \`/${newName}\` |`)
  return ["| Before 5.0 | Methodsmith |", "|---|---|", ...rows].join("\n")
}

/** Replace the body of every renamed-commands block with the current table. */
export function fillGeneratedBlocks(text: string): string {
  let out = ""
  let rest = text
  for (;;) {
    const start = rest.indexOf(BLOCK_START)
    if (start === -1) return out + rest
    const end = rest.indexOf(BLOCK_END, start)
    if (end === -1) return out + rest
    out += `${rest.slice(0, start)}${BLOCK_START}\n${renamedCommandsTable()}\n`
    rest = rest.slice(end)
  }
}

export function isExcluded(relPath: string): boolean {
  return EXCLUDED_PATHS.some((pattern) => pattern.test(relPath))
}

/** Paths the rename never moves: the tooling itself. */
const NEVER_MOVED: RegExp[] = [/^scripts\/rebrand\//, /^tests\/rebrand\.test\.ts$/]

/**
 * New repo-relative path for a tracked file (unchanged when nothing applies).
 * Excluded history files keep their content, but their names still follow the
 * rename, so the rewritten links that point at them stay valid.
 */
export function rewritePath(relPath: string): string {
  if (NEVER_MOVED.some((pattern) => pattern.test(relPath))) return relPath
  return relPath.split("/").map(rewriteLine).join("/")
}

function isBinary(buffer: Buffer): boolean {
  return buffer.subarray(0, 8000).includes(0)
}

export type RenameResult = { moved: Array<[string, string]>; rewritten: string[] }

/** Apply the rename to the files listed (repo-relative) under root. */
export function applyRename(root: string, files: string[], options: { dryRun?: boolean } = {}): RenameResult {
  const result: RenameResult = { moved: [], rewritten: [] }
  for (const file of files) {
    const source = path.join(root, file)
    if (!existsSync(source) || !statSync(source).isFile()) continue
    const target = rewritePath(file)
    if (!isExcluded(file)) {
      const buffer = readFileSync(source)
      if (!isBinary(buffer)) {
        const before = buffer.toString("utf8")
        const after = fillGeneratedBlocks(rewriteText(before))
        if (after !== before) {
          result.rewritten.push(target)
          if (!options.dryRun) writeFileSync(source, after)
        }
      }
    }
    if (target !== file && map.keepOldCopies.includes(file)) {
      // Old links still point here: copy for one release instead of moving.
      const targetPath = path.join(root, target)
      if (existsSync(targetPath) && readFileSync(targetPath).equals(readFileSync(source))) continue
      result.moved.push([file, target])
      if (!options.dryRun) {
        mkdirSync(path.dirname(targetPath), { recursive: true })
        copyFileSync(source, targetPath)
      }
      continue
    }
    if (target !== file) {
      result.moved.push([file, target])
      if (!options.dryRun) {
        mkdirSync(path.dirname(path.join(root, target)), { recursive: true })
        renameSync(source, path.join(root, target))
      }
    }
  }
  if (!options.dryRun) refreshPinnedHashes(root, files.map(rewritePath), result)
  return result
}

/**
 * Eval case.yaml files pin the sha256 of each fixture (`path:` then `sha256:`).
 * Renaming rewrites some fixtures, so re-pin those hashes to the new content.
 */
function refreshPinnedHashes(root: string, files: string[], result: RenameResult): void {
  for (const file of files.filter((name) => /(^|\/)case\.ya?ml$/.test(name))) {
    const full = path.join(root, file)
    if (!existsSync(full)) continue
    const before = readFileSync(full, "utf8")
    let fixture: string | null = null
    const after = before
      .split("\n")
      .map((line) => {
        const pathMatch = line.match(/^\s*-?\s*path:\s*(\S+)\s*$/)
        if (pathMatch) fixture = pathMatch[1]
        const hashMatch = line.match(/^(\s*sha256:\s*)[0-9a-f]{64}\s*$/)
        if (!hashMatch || !fixture || !existsSync(path.join(root, fixture))) return line
        const digest = createHash("sha256").update(readFileSync(path.join(root, fixture))).digest("hex")
        return `${hashMatch[1]}${digest}`
      })
      .join("\n")
    if (after !== before) {
      writeFileSync(full, after)
      if (!result.rewritten.includes(file)) result.rewritten.push(file)
    }
  }
}

const RESIDUE_PATTERNS: RegExp[] = [
  /(?<![A-Za-z0-9_.])ce-[a-z0-9]+(?:-[a-z0-9]+)*/g,
  /CE[ -_]?DATA ?SCIENCE|CE[ -]Data ?Science|C[Ee]Data[Ss]cience/g,
  GENERIC_PREFIX,
]

/**
 * ce- references that are not explicitly accounted for. Upstream names, legacy
 * names in mapping.json "keep", fixture names in "keep.foreign", protected
 * forms, keep-marked lines, and excluded files are accounted for.
 */
export function findResidue(text: string): string[] {
  const allowed = new Set([...KEEP_TOKENS, ...raw.keep.foreign])
  const found: string[] = []
  let keeping = false
  for (const line of text.split("\n")) {
    if (line.includes("rebrand:keep-start")) keeping = true
    if (line.includes("rebrand:keep-end")) {
      keeping = false
      continue
    }
    if (keeping || line.includes("rebrand:keep")) continue
    let scrubbed = line
    for (const pattern of PROTECTED) scrubbed = scrubbed.replace(pattern, "")
    for (const pattern of RESIDUE_PATTERNS) {
      for (const match of scrubbed.matchAll(pattern)) {
        if (!allowed.has(match[0])) found.push(match[0])
      }
    }
  }
  return found
}

export function trackedFiles(root: string): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
}

export function residueReport(root: string, files: string[]): Record<string, string[]> {
  const report: Record<string, string[]> = {}
  for (const file of files) {
    const target = rewritePath(file)
    const full = path.join(root, target)
    if (isExcluded(target) || !existsSync(full) || !statSync(full).isFile()) continue
    const buffer = readFileSync(full)
    if (isBinary(buffer)) continue
    const hits = [...findResidue(target), ...findResidue(buffer.toString("utf8"))]
    if (hits.length > 0) report[target] = [...new Set(hits)]
  }
  return report
}

if (import.meta.main) {
  const args = new Set(process.argv.slice(2))
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim()
  const files = trackedFiles(root)
  const dryRun = args.has("--dry-run") || args.has("--check")
  const result = applyRename(root, files, { dryRun })
  const residue = residueReport(root, dryRun ? files : files.map(rewritePath))
  console.log(`${dryRun ? "Would move" : "Moved"} ${result.moved.length} file(s); ${dryRun ? "would rewrite" : "rewrote"} ${result.rewritten.length} file(s).`)
  for (const file of result.rewritten) console.log(`${dryRun ? "would rewrite" : "rewrote"} ${file}`)
  for (const [file, hits] of Object.entries(residue)) console.log(`residue ${file}: ${hits.join(", ")}`)
  if (!dryRun) {
    // git add -A on the moved paths so `git status` shows renames, not delete + untracked.
    execFileSync("git", ["add", "-A", "--", ...new Set(result.moved.flat())], { cwd: root })
  }
  if (args.has("--check") && (result.moved.length > 0 || result.rewritten.length > 0 || Object.keys(residue).length > 0)) {
    process.exit(1)
  }
}
