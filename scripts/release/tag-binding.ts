export type GitObject = { type: string; sha: string }
export interface TagApi {
  readRef(tag: string): Promise<GitObject | null>
  readTag(sha: string): Promise<GitObject>
  createRef(tag: string, sha: string): Promise<void>
}

/**
 * Resolve a tag through annotated tag chains to its commit SHA, or null when
 * the tag does not exist.
 */
export async function resolvedTag(api: TagApi, tag: string): Promise<string | null> {
  let object = await api.readRef(tag)
  if (!object) return null
  const seen = new Set<string>()
  while (object.type === "tag") {
    if (seen.has(object.sha) || seen.size >= 16) throw new Error("Invalid annotated tag chain")
    seen.add(object.sha)
    object = await api.readTag(object.sha)
  }
  if (object.type !== "commit" || !/^[a-f0-9]{40}$/.test(object.sha)) throw new Error("Tag does not resolve to a commit")
  return object.sha
}

/** Create or verify a release tag so it points at exactly the validated commit. */
export async function bindTag(api: TagApi, tag: string, sha: string): Promise<void> {
  const existing = await resolvedTag(api, tag)
  if (existing === null) {
    // A conflicting creation is not success: read back and compare below.
    await api.createRef(tag, sha)
  }
  if (await resolvedTag(api, tag) !== sha) throw new Error("Release tag differs from validated commit")
}
