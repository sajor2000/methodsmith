import { existsSync } from "fs"
import path from "path"
import raw from "./mapping.json"

export type RenameMap = {
  plugin: typeof raw.plugin
  skills: Record<string, string>
  agents: Record<string, string>
  scripts: Record<string, string>
  pending: string[]
  postRebrandSkills: string[]
  /** Paths copied (not moved) so old links keep working for one release. */
  keepOldCopies: string[]
  upstream: { skills: string[]; agents: string[] }
  /** [old, new] for every skill, agent, and plugin script. */
  allPairs(): Array<[string, string]>
  allNewNames(): string[]
}

export function loadRenameMap(): RenameMap {
  const skills: Record<string, string> = raw.skills
  const agents: Record<string, string> = raw.agents
  const scripts: Record<string, string> = raw.scripts
  const allPairs = () => [
    ...Object.entries(skills),
    ...Object.entries(agents),
    ...Object.entries(scripts),
  ] as Array<[string, string]>
  return {
    plugin: raw.plugin,
    skills,
    agents,
    scripts,
    pending: raw.pending.skills,
    postRebrandSkills: raw.postRebrandSkills,
    keepOldCopies: raw.keepOldCopies.paths,
    upstream: raw.upstreamCompoundEngineering,
    allPairs,
    allNewNames: () => allPairs().map(([, newName]) => newName),
  }
}

/** The plugin folder as it exists right now: renamed or not yet renamed. */
export function shippedPluginDir(repoRoot: string): string {
  const renamed = path.join(repoRoot, "plugins", raw.plugin.new)
  return existsSync(path.join(renamed, "skills")) ? renamed : path.join(repoRoot, "plugins", raw.plugin.old)
}
