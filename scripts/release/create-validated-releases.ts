import { appendFile, readFile } from "node:fs/promises"
import { GitHub, Manifest } from "release-please"
import { DuplicateReleaseError } from "release-please/build/src/errors"
import { bindTag, resolvedTag, type TagApi, type GitObject } from "./tag-binding"

// Freeze the discovered candidate set before any release mutation. A later
// successful push must never release an older, unvalidated pending commit.
export async function createValidatedReleases(
  manifest: Pick<Manifest, "buildReleases" | "createReleases">,
  validatedSha: string,
  tags: TagApi,
) {
  if (!/^[a-f0-9]{40}$/.test(validatedSha)) throw new Error("Invalid validated commit SHA")
  const candidates = await manifest.buildReleases()
  if (candidates.some(candidate => candidate.sha !== validatedSha)) {
    throw new Error("Pending release differs from validated commit; validate its exact commit before retrying")
  }
  for (const candidate of candidates) {
    await bindTag(tags, candidate.tag.toString(), validatedSha)
  }
  const discover = manifest.buildReleases
  manifest.buildReleases = async () => candidates
  try {
    let releases: Awaited<ReturnType<Manifest["createReleases"]>>
    try {
      releases = await manifest.createReleases()
    } catch (error) {
      // The pinned library throws after finalizing labels when all releases
      // already exist. Reconcile durable releases below instead of losing outputs.
      if (!(error instanceof DuplicateReleaseError)) throw error
      releases = []
    }
    for (const candidate of candidates) {
      if (await resolvedTag(tags, candidate.tag.toString()) !== validatedSha) {
        throw new Error("Release tag changed during creation")
      }
    }
    return releases
  } finally {
    manifest.buildReleases = discover
  }
}

export async function confirmedRelease(
  tags: TagApi, readRelease: () => Promise<{draft: boolean} | null>, tag: string, sha: string,
): Promise<boolean> {
  const release = await readRelease()
  return Boolean(release && !release.draft && await resolvedTag(tags, tag) === sha)
}

if (import.meta.main) {
  const { GITHUB_REPOSITORY, GITHUB_TOKEN, GITHUB_SHA, GITHUB_REF, GITHUB_OUTPUT } = process.env
  if (GITHUB_REF !== "refs/heads/main" || !GITHUB_REPOSITORY || !GITHUB_TOKEN || !GITHUB_SHA || !GITHUB_OUTPUT) {
    throw new Error("Release creation requires the validated main workflow environment")
  }
  const [owner, repo] = GITHUB_REPOSITORY.split("/")
  if (!owner || !repo) throw new Error("Invalid repository")
  const github = await GitHub.create({ owner, repo, token: GITHUB_TOKEN, defaultBranch: "main" })
  const manifest = await Manifest.fromManifest(github, "main", ".github/release-please-config.json", ".github/.release-please-manifest.json")
  async function api(endpoint: string, method = "GET", body?: unknown): Promise<any> {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/${endpoint}`, {
      method, headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (method === "GET" && response.status === 404) return null
    if (method === "POST" && response.status === 422) return null
    if (!response.ok) throw new Error(`Release API request failed (${response.status})`)
    return response.json()
  }
  const tags: TagApi = {
    readRef: async tag => (await api(`git/ref/tags/${encodeURIComponent(tag)}`))?.object ?? null,
    readTag: async sha => {
      const result = await api(`git/tags/${sha}`)
      if (!result?.object) throw new Error("Annotated tag unavailable")
      return result.object as GitObject
    },
    createRef: async (tag, sha) => { await api("git/refs", "POST", { ref: `refs/tags/${tag}`, sha }) },
  }
  await createValidatedReleases(manifest, GITHUB_SHA, tags)
  // Reconcile the root release from durable GitHub state, including a previous
  // partial/cancelled run. Local version is from the validated checkout.
  const pkg = JSON.parse(await readFile("package.json", "utf8"))
  const tag = `cli-v${pkg.version}`
  if (!/^cli-v[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/.test(tag)) throw new Error("Invalid CLI tag")
  const exists = await confirmedRelease(tags, () => api(`releases/tags/${encodeURIComponent(tag)}`), tag, GITHUB_SHA)
  await appendFile(GITHUB_OUTPUT, `release_created=${exists}\n`)
  if (exists) await appendFile(GITHUB_OUTPUT, `tag_name=${tag}\nvalidated_sha=${GITHUB_SHA}\n`)
}
