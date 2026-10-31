import fs from "fs/promises"
import path from "path"
import {
  assertSafeArtifactName,
  backupFile,
  copySkillDir,
  directWriter,
  ensureDir,
  injectManualInvocationGuard,
  isSafeManagedPath,
  pathExists,
  readText,
  sanitizePathName,
  writeJson,
  writeJsonSecure,
  writeText,
} from "../utils/files"
import { warnServersWithPotentialSecrets } from "../utils/secrets"
import { transformContentForPi } from "../converters/claude-to-pi"
import type { PiBundle } from "../types/pi"
import { getLegacyPiArtifacts } from "../data/plugin-legacy-artifacts"
import { cleanupStaleAgents, cleanupStaleSkillDirs, isKnownPluginArtifact, noticeKeptUserArtifact } from "../utils/legacy-cleanup"
import { resolveLegacyManagedDir, resolveManagedSegment } from "./managed-artifacts"
import { InstallOwnership } from "./install-ownership"
import { rewriteMcpServerPaths } from "./mcp-paths"

const PI_AGENTS_BLOCK_START = "<!-- BEGIN METHODSMITH PI TOOL MAP -->"
const PI_AGENTS_BLOCK_END = "<!-- END METHODSMITH PI TOOL MAP -->"
const PI_AGENTS_BLOCK_START_PREV = "<!-- BEGIN COMPOUND PI TOOL MAP -->"
const PI_AGENTS_BLOCK_END_PREV = "<!-- END COMPOUND PI TOOL MAP -->"
const PI_INSTALL_MANIFEST = "install-manifest.json"

const PI_AGENTS_BLOCK_BODY = `## Methodsmith (Pi compatibility)

This block is managed by methodsmith.

When using \`ask_user\` for multiple questions, pass a \`questions\` array and put
\`context\`, \`options\`, \`allowMultiple\`, and \`allowFreeform\` inside each question
entry. Do not also pass those fields at the top level. Top-level fields apply to
the whole batch only when supported by the tool.

Pi extensions used by this plugin:
- Required: \`pi-subagents\` (by nicobailon) provides the \`subagent\` tool used by skills that dispatch parallel agents
- Recommended: \`pi-ask-user\` (by edlsh) provides the \`ask_user\` tool; skills fall back to numbered options in chat when it is missing

Install with:
  pi install npm:pi-subagents
  pi install npm:pi-ask-user
`

export type PiInstallManifest = {
  version: 1
  pluginName: string
  skills: string[]
  prompts: string[]
  extensions: string[]
  // Added in v2.69+. Older manifests omit this; reads default to [].
  agents: string[]
}

type PiPaths = {
  managedDir: string
  skillsDir: string
  promptsDir: string
  extensionsDir: string
  agentsDir: string
  mcporterConfigPath: string
  agentsPath: string
}

export async function writePiBundle(outputRoot: string, bundle: PiBundle): Promise<void> {
  const pluginName = bundle.pluginName ? sanitizeCodexPathComponent(bundle.pluginName) : undefined
  const paths = resolvePiPaths(outputRoot, pluginName)
  const manifest = pluginName
    ? await readInstallManifestWithLegacyFallback(paths, pluginName)
    : null
  const currentPrompts = bundle.prompts.map((prompt) => `${sanitizePathName(prompt.name)}.md`)
  const currentSkills = [
    ...bundle.skillDirs.map((skill) => sanitizePathName(skill.name)),
    ...bundle.generatedSkills.map((skill) => sanitizePathName(skill.name)),
  ]
  const currentAgents = bundle.agents.map((agent) => `${sanitizePathName(agent.name)}.md`)
  const currentExtensions = bundle.extensions.map((extension) => sanitizePathName(extension.name))

  await ensureDir(paths.skillsDir)
  await ensureDir(paths.promptsDir)
  await ensureDir(paths.extensionsDir)
  await ensureDir(paths.agentsDir)
  const ownership = pluginName
    ? await InstallOwnership.open(path.dirname(paths.managedDir), paths.managedDir, pluginName)
    : null
  const writer = ownership ?? directWriter
  const claim = (targetPath: string, manifestListed: boolean) =>
    ownership ? ownership.claim(targetPath, manifestListed) : Promise.resolve(true)

  await cleanupStaleAgents(paths.skillsDir, null, "", pluginName ? paths.managedDir : undefined)
  // TODO(cleanup): Remove after v3 transition (circa Q3 2026)
  await cleanupStaleSkillDirs(paths.skillsDir, pluginName ? paths.managedDir : undefined)
  await cleanupRemovedPrompts(ownership, paths.promptsDir, manifest, currentPrompts)
  await cleanupRemovedSkills(ownership, paths.skillsDir, manifest, currentSkills)
  await cleanupRemovedAgents(ownership, paths.agentsDir, manifest, currentAgents)
  await cleanupRemovedExtensions(ownership, paths.extensionsDir, manifest, currentExtensions)

  for (const prompt of bundle.prompts) {
    assertSafeArtifactName(sanitizePathName(prompt.name), "prompt")
    const promptFile = `${sanitizePathName(prompt.name)}.md`
    const promptPath = path.join(paths.promptsDir, promptFile)
    if (!(await claim(promptPath, manifest?.prompts.includes(promptFile) ?? false))) continue
    await writer.writeFile(promptPath, prompt.content + "\n")
  }

  for (const skill of bundle.skillDirs) {
    const skillName = sanitizePathName(skill.name)
    assertSafeArtifactName(skillName, "skill")
    const targetDir = path.join(paths.skillsDir, skillName)
    if (!(await claim(targetDir, manifest?.skills.includes(skillName) ?? false))) continue
    await copySkillDir(skill.sourceDir, targetDir, transformContentForPi, false, writer)
    if (skill.disableModelInvocation) {
      await injectManualInvocationGuard(path.join(targetDir, "SKILL.md"))
    }
  }

  for (const skill of bundle.generatedSkills) {
    const skillName = sanitizePathName(skill.name)
    assertSafeArtifactName(skillName, "skill")
    const targetDir = path.join(paths.skillsDir, skillName)
    if (!(await claim(targetDir, manifest?.skills.includes(skillName) ?? false))) continue
    await writer.writeFile(path.join(targetDir, "SKILL.md"), skill.content + "\n")
  }

  for (const agent of bundle.agents) {
    assertSafeArtifactName(sanitizePathName(agent.name), "agent")
    const agentFileName = `${sanitizePathName(agent.name)}.md`
    const targetPath = path.join(paths.agentsDir, agentFileName)
    if (!(await claim(targetPath, manifest?.agents.includes(agentFileName) ?? false))) continue
    await writer.writeFile(targetPath, agent.content + "\n")
  }

  for (const extension of bundle.extensions) {
    const extensionName = sanitizePathName(extension.name)
    assertSafeArtifactName(extensionName, "extension")
    const extensionPath = path.join(paths.extensionsDir, extensionName)
    if (!(await claim(extensionPath, manifest?.extensions.includes(extensionName) ?? false))) continue
    await writer.writeFile(extensionPath, extension.content + "\n")
  }

  const mcporterConfig = bundle.mcporterConfig
    ? {
        ...bundle.mcporterConfig,
        mcpServers: rewriteMcpServerPaths(
          bundle.mcporterConfig.mcpServers,
          bundle.skillDirs,
          paths.skillsDir,
        ) ?? bundle.mcporterConfig.mcpServers,
      }
    : undefined

  if (mcporterConfig) {
    const backupPath = await backupFile(paths.mcporterConfigPath)
    if (backupPath) {
      console.log(`Backed up existing MCPorter config to ${backupPath}`)
    }
    warnServersWithPotentialSecrets(mcporterConfig.mcpServers, paths.mcporterConfigPath)
    await writeJsonSecure(paths.mcporterConfigPath, mcporterConfig)
  }

  await ensurePiAgentsBlock(paths.agentsPath)

  if (pluginName) {
    await writeInstallManifest(paths.managedDir, {
      version: 1,
      pluginName,
      skills: currentSkills,
      prompts: currentPrompts,
      extensions: currentExtensions,
      agents: currentAgents,
    })
    await archiveLegacyInstallManifestIfOwned(paths.managedDir, pluginName)
    await cleanupKnownLegacyPiArtifacts(paths, bundle)
  }
  await ownership?.finish()
}

function resolvePiPaths(outputRoot: string, pluginName?: string): PiPaths {
  // Namespace the managed install directory per plugin so multiple plugins
  // installed into the same Pi root do not share (and overwrite) each other's
  // install manifests. `resolveManagedSegment` falls back to the legacy
  // "compound-engineering" segment when no plugin name is supplied
  // (backward compat: old installs used this segment; methodsmith is the
  // current name, but resolveManagedSegment preserves the old path as
  // LEGACY_MANAGED_SEGMENT).
  const managedSegment = resolveManagedSegment(pluginName)
  const base = path.basename(outputRoot)

  if (base === "agent") {
    return {
      managedDir: path.join(outputRoot, managedSegment),
      skillsDir: path.join(outputRoot, "skills"),
      promptsDir: path.join(outputRoot, "prompts"),
      extensionsDir: path.join(outputRoot, "extensions"),
      agentsDir: path.join(outputRoot, "agents"),
      mcporterConfigPath: path.join(outputRoot, managedSegment, "mcporter.json"),
      agentsPath: path.join(outputRoot, "AGENTS.md"),
    }
  }

  if (base === ".pi") {
    return {
      managedDir: path.join(outputRoot, managedSegment),
      skillsDir: path.join(outputRoot, "skills"),
      promptsDir: path.join(outputRoot, "prompts"),
      extensionsDir: path.join(outputRoot, "extensions"),
      agentsDir: path.join(outputRoot, "agents"),
      mcporterConfigPath: path.join(outputRoot, managedSegment, "mcporter.json"),
      agentsPath: path.join(outputRoot, "AGENTS.md"),
    }
  }

  return {
    managedDir: path.join(outputRoot, ".pi", managedSegment),
    skillsDir: path.join(outputRoot, ".pi", "skills"),
    promptsDir: path.join(outputRoot, ".pi", "prompts"),
    extensionsDir: path.join(outputRoot, ".pi", "extensions"),
    agentsDir: path.join(outputRoot, ".pi", "agents"),
    mcporterConfigPath: path.join(outputRoot, ".pi", managedSegment, "mcporter.json"),
    agentsPath: path.join(outputRoot, "AGENTS.md"),
  }
}

async function ensurePiAgentsBlock(filePath: string): Promise<void> {
  const block = buildPiAgentsBlock()

  if (!(await pathExists(filePath))) {
    await writeText(filePath, block + "\n")
    return
  }

  const existing = await readText(filePath)
  const updated = upsertBlock(existing, block)
  if (updated !== existing) {
    await writeText(filePath, updated)
  }
}

function buildPiAgentsBlock(): string {
  return [PI_AGENTS_BLOCK_START, PI_AGENTS_BLOCK_BODY.trim(), PI_AGENTS_BLOCK_END].join("\n")
}

function upsertBlock(existing: string, block: string): string {
  // Check for both new and legacy markers
  const startIdx = existing.indexOf(PI_AGENTS_BLOCK_START)
  const endIdx = existing.indexOf(PI_AGENTS_BLOCK_END)
  const prevStartIdx = existing.indexOf(PI_AGENTS_BLOCK_START_PREV)
  const prevEndIdx = existing.indexOf(PI_AGENTS_BLOCK_END_PREV)

  // Prefer new markers, fall back to legacy markers
  const startIndex = startIdx !== -1 ? startIdx : prevStartIdx
  const endMarker = startIdx !== -1 ? PI_AGENTS_BLOCK_END : PI_AGENTS_BLOCK_END_PREV
  const endIndex = startIdx !== -1 ? endIdx : prevEndIdx

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = existing.slice(0, startIndex).trimEnd()
    const after = existing.slice(endIndex + endMarker.length).trimStart()
    return [before, block, after].filter(Boolean).join("\n\n") + "\n"
  }

  if (existing.trim().length === 0) {
    return block + "\n"
  }

  return existing.trimEnd() + "\n\n" + block + "\n"
}

function sanitizeCodexPathComponent(name: string): string {
  return sanitizePathName(name).replace(/[\\/]/g, "-")
}

export async function readPiInstallManifest(
  managedDir: string,
  pluginName: string,
  paths?: PiPaths,
): Promise<PiInstallManifest | null> {
  return readInstallManifest(managedDir, pluginName, paths)
}

async function readInstallManifestWithLegacyFallback(
  paths: PiPaths,
  pluginName: string,
): Promise<PiInstallManifest | null> {
  const current = await readInstallManifest(paths.managedDir, pluginName, paths)
  if (current) return current
  const legacyDir = resolveLegacyManagedDir(paths.managedDir, pluginName)
  if (!legacyDir) return null
  return readInstallManifest(legacyDir, pluginName, paths)
}

/**
 * After the plugin-scoped Pi manifest is written, archive the legacy
 * shared Pi manifest if it belongs to the current plugin so the legacy
 * path doesn't keep shadowing a future install. No-op when the legacy
 * manifest is missing or owned by a different plugin (that plugin's
 * own next install will migrate it).
 */
async function archiveLegacyInstallManifestIfOwned(
  managedDir: string,
  pluginName: string,
): Promise<void> {
  const legacyDir = resolveLegacyManagedDir(managedDir, pluginName)
  if (!legacyDir) return
  const legacyManifestPath = path.join(legacyDir, PI_INSTALL_MANIFEST)
  if (!(await pathExists(legacyManifestPath))) return

  const owned = await readInstallManifest(legacyDir, pluginName)
  if (!owned) return

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupPath = path.join(managedDir, "legacy-backup", timestamp, PI_INSTALL_MANIFEST)
  await ensureDir(path.dirname(backupPath))
  await fs.rename(legacyManifestPath, backupPath)
  console.warn(`Moved legacy Pi install manifest to ${backupPath}`)
}

async function readInstallManifest(
  managedDir: string,
  pluginName: string,
  paths?: PiPaths,
): Promise<PiInstallManifest | null> {
  const manifestPath = path.join(managedDir, PI_INSTALL_MANIFEST)
  try {
    const raw = await readText(manifestPath)
    const parsed = JSON.parse(raw) as Partial<PiInstallManifest>
    if (
      parsed.version === 1 &&
      parsed.pluginName === pluginName &&
      Array.isArray(parsed.skills) &&
      Array.isArray(parsed.prompts) &&
      Array.isArray(parsed.extensions)
    ) {
      // Filter manifest entries at read time. Cleanup functions join these
      // strings into `fs.rm` paths against the Pi skills/prompts/extensions/agents
      // directories, so a tampered or corrupted `install-manifest.json` with
      // entries like `../../config.toml` or `/etc/passwd` would otherwise
      // delete outside the Pi managed tree. Validate each group against the
      // specific cleanup root it will be joined with; fall back to
      // `managedDir` when no `PiPaths` context is supplied (e.g. an
      // ownership-only read), which still rejects absolute paths and `..`
      // segments and provides containment against *some* root.
      const skillsRoot = paths?.skillsDir ?? managedDir
      const promptsRoot = paths?.promptsDir ?? managedDir
      const extensionsRoot = paths?.extensionsDir ?? managedDir
      const agentsRoot = paths?.agentsDir ?? managedDir
      // `agents` was added in v2.69+; accept missing/omitted to stay
      // backward-compatible with v2.x manifests that only tracked skills,
      // prompts, and extensions. Drop non-array values defensively.
      const rawAgents = Array.isArray(parsed.agents) ? parsed.agents : []
      return {
        version: 1,
        pluginName,
        skills: filterSafePiManifestEntries(parsed.skills, skillsRoot, manifestPath, "skills"),
        prompts: filterSafePiManifestEntries(parsed.prompts, promptsRoot, manifestPath, "prompts"),
        extensions: filterSafePiManifestEntries(parsed.extensions, extensionsRoot, manifestPath, "extensions"),
        agents: filterSafePiManifestEntries(rawAgents, agentsRoot, manifestPath, "agents"),
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`Ignoring unreadable Pi install manifest at ${manifestPath}.`)
    }
  }
  return null
}

function filterSafePiManifestEntries(
  entries: unknown[],
  rootDir: string,
  manifestPath: string,
  group: string,
): string[] {
  const safe: string[] = []
  for (const entry of entries) {
    if (isSafeManagedPath(rootDir, entry)) {
      safe.push(entry)
    } else {
      console.warn(
        `Dropping unsafe Pi install-manifest entry in ${manifestPath} (group "${group}"): ${JSON.stringify(entry)}`,
      )
    }
  }
  return safe
}

async function writeInstallManifest(managedDir: string, manifest: PiInstallManifest): Promise<void> {
  await writeJson(path.join(managedDir, PI_INSTALL_MANIFEST), manifest)
}

// Pre-ledger installs recorded only names. A dropped name-manifest entry is
// moved to backups; once a ledger exists these are no-ops and
// InstallOwnership.finish() removes dropped files by hash.
async function cleanupRemovedSkills(
  ownership: InstallOwnership | null,
  skillsDir: string,
  manifest: PiInstallManifest | null,
  currentEntries: string[],
): Promise<void> {
  if (!manifest || !ownership) return
  const current = new Set(currentEntries)
  for (const entry of manifest.skills) {
    if (current.has(entry)) continue
    // Defense in depth: `readInstallManifest` already drops unsafe entries.
    if (!isSafeManagedPath(skillsDir, entry)) continue
    await ownership.removeLegacyUnit(path.join(skillsDir, entry))
  }
}

async function cleanupRemovedPrompts(
  ownership: InstallOwnership | null,
  promptsDir: string,
  manifest: PiInstallManifest | null,
  currentEntries: string[],
): Promise<void> {
  if (!manifest || !ownership) return
  const current = new Set(currentEntries)
  for (const entry of manifest.prompts) {
    if (current.has(entry)) continue
    // Defense in depth: `readInstallManifest` already drops unsafe entries.
    if (!isSafeManagedPath(promptsDir, entry)) continue
    await ownership.removeLegacyUnit(path.join(promptsDir, entry))
  }
}

async function cleanupRemovedExtensions(
  ownership: InstallOwnership | null,
  extensionsDir: string,
  manifest: PiInstallManifest | null,
  currentEntries: string[],
): Promise<void> {
  if (!manifest || !ownership) return
  const current = new Set(currentEntries)
  for (const entry of manifest.extensions) {
    if (current.has(entry)) continue
    // Defense in depth: `readInstallManifest` already drops unsafe entries.
    if (!isSafeManagedPath(extensionsDir, entry)) continue
    await ownership.removeLegacyUnit(path.join(extensionsDir, entry))
  }
}

async function cleanupRemovedAgents(
  ownership: InstallOwnership | null,
  agentsDir: string,
  manifest: PiInstallManifest | null,
  currentEntries: string[],
): Promise<void> {
  if (!manifest || !ownership) return
  const current = new Set(currentEntries)
  for (const entry of manifest.agents) {
    if (current.has(entry)) continue
    // Defense in depth: `readInstallManifest` already drops unsafe entries.
    if (!isSafeManagedPath(agentsDir, entry)) continue
    await ownership.removeLegacyUnit(path.join(agentsDir, entry))
  }
}

// Explicit legacy Pi extension names this plugin has historically shipped and
// no longer does. The manifest-diff cleanup in cleanupRemovedExtensions handles
// post-manifest installs automatically, but pre-manifest installs return null
// from readInstallManifestWithLegacyFallback and would otherwise leak the file
// on upgrade. This list is the safety net for that case.
const LEGACY_PI_EXTENSIONS_BY_PLUGIN: Record<string, string[]> = {
  "compound-engineering": ["compound-engineering-compat.ts"],
  "methodsmith": ["compound-engineering-compat.ts"],
}

// Plugins that historically shipped an mcporter.json (via the now-removed
// compat extension) but no longer do when `bundle.mcporterConfig` is absent.
// The per-plugin guard keeps us from touching mcporter configs owned by
// plugins that still legitimately emit one.
const LEGACY_PI_MCPORTER_PLUGINS = new Set<string>(["compound-engineering", "methodsmith"])

type LegacyArtifactKind = "skills" | "prompts" | "extensions" | "mcporter"

// Display label used in the "Moved legacy Pi <label> artifact ..." log line.
// Most kinds are a simple plural→singular trim, but "mcporter" isn't a plural,
// so we special-case it instead of slicing off a character and logging
// "mcporte".
const LEGACY_ARTIFACT_LABELS: Record<LegacyArtifactKind, string> = {
  skills: "skill",
  prompts: "prompt",
  extensions: "extension",
  mcporter: "mcporter config",
}

async function cleanupKnownLegacyPiArtifacts(paths: PiPaths, bundle: PiBundle): Promise<void> {
  const pluginName = bundle.pluginName
  if (!pluginName) return

  const legacyArtifacts = getLegacyPiArtifacts(bundle)
  for (const skillName of legacyArtifacts.skills) {
    const legacySkillPath = path.join(paths.skillsDir, skillName)
    await moveLegacyArtifactToBackup(paths.managedDir, "skills", legacySkillPath)
  }

  for (const promptFile of legacyArtifacts.prompts) {
    const legacyPromptPath = path.join(paths.promptsDir, promptFile)
    await moveLegacyArtifactToBackup(paths.managedDir, "prompts", legacyPromptPath)
  }

  // Only sweep legacy extensions the current bundle is not actively writing.
  // A caller that explicitly ships an extension (e.g., tests or a future
  // bundle that reintroduces one) must not have its write undone.
  const currentExtensionNames = new Set(bundle.extensions.map((extension) => extension.name))
  for (const extensionFile of LEGACY_PI_EXTENSIONS_BY_PLUGIN[pluginName] ?? []) {
    if (currentExtensionNames.has(extensionFile)) continue
    const legacyExtensionPath = path.join(paths.extensionsDir, extensionFile)
    await moveLegacyArtifactToBackup(paths.managedDir, "extensions", legacyExtensionPath)
  }

  // Sweep the stale mcporter.json left behind by the removed compat extension.
  // Only runs when the current bundle is NOT writing a fresh mcporter config —
  // if it IS (e.g. a plugin with `mcpServers`), the existing write path backs
  // up and overwrites the file and this sweep would undo that write.
  if (!bundle.mcporterConfig && LEGACY_PI_MCPORTER_PLUGINS.has(pluginName)) {
    await moveLegacyArtifactToBackup(paths.managedDir, "mcporter", paths.mcporterConfigPath)
  }
}

async function moveLegacyArtifactToBackup(
  managedDir: string,
  kind: LegacyArtifactKind,
  artifactPath: string,
): Promise<void> {
  if (!(await pathExists(artifactPath))) return
  // Skills and prompts share directories with user content, so a legacy name
  // match also needs a content fingerprint. Extensions and mcporter.json are
  // plugin-branded or live inside the plugin's own managed directory.
  if ((kind === "skills" || kind === "prompts") && !(await isKnownPluginArtifact(artifactPath))) {
    noticeKeptUserArtifact(artifactPath)
    return
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupDir = path.join(managedDir, "legacy-backup", timestamp, kind)
  const backupPath = path.join(backupDir, path.basename(artifactPath))
  await ensureDir(backupDir)
  await fs.rename(artifactPath, backupPath)
  console.warn(`Moved legacy Pi ${LEGACY_ARTIFACT_LABELS[kind]} artifact to ${backupPath}`)
}

export {
  cleanupRemovedSkills as cleanupRemovedPiSkills,
  cleanupRemovedPrompts as cleanupRemovedPiPrompts,
  cleanupRemovedExtensions as cleanupRemovedPiExtensions,
  cleanupRemovedAgents as cleanupRemovedPiAgents,
}
