import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8")
}

const pkg = JSON.parse(read("package.json")) as {
  name?: string
  license?: string
  keywords?: string[]
  engines?: Record<string, string>
  files?: string[]
  bin?: Record<string, string>
}

// Trusted publishing requires npm 11.5.1 or newer; the publish job must pin at
// least that version or the OIDC exchange fails.
const NPM_TRUSTED_PUBLISHING_FLOOR = [11, 5, 1]

describe("npm publish readiness", () => {
  test("the package declares the metadata npm needs for a public release", () => {
    expect(pkg.name).toBe("methodsmith")
    expect(pkg.license).toBe("MIT")
    expect(Array.isArray(pkg.keywords)).toBe(true)
    expect((pkg.keywords ?? []).length).toBeGreaterThanOrEqual(5)
    expect(pkg.engines?.bun).toBeTruthy()
  })

  test("every bin target exists on disk", () => {
    const targets = Object.values(pkg.bin ?? {})
    expect(targets.length).toBeGreaterThan(0)
    for (const target of targets) {
      expect(existsSync(resolve(root, target))).toBe(true)
    }
  })

  test("files covers every directory the CLI resolves relative to the package root", () => {
    // install.ts and cleanup.ts resolve bundled plugins as
    // `new URL("../../plugins/", import.meta.url)`, so those directories must
    // ship in the tarball or the installed CLI finds no plugins.
    const required = new Set<string>()
    for (const source of ["src/commands/install.ts", "src/commands/cleanup.ts"]) {
      for (const match of read(source).matchAll(/new URL\("\.\.\/\.\.\/([A-Za-z0-9_-]+)\//g)) {
        required.add(match[1]!)
      }
    }
    expect(required.size).toBeGreaterThan(0)
    const files = pkg.files ?? []
    for (const dir of required) {
      expect(files).toContain(dir)
    }
  })

  test("the publish job keeps OIDC and uses an npm new enough for trusted publishing", () => {
    const workflow = read(".github/workflows/release-pr.yml")
    expect(workflow).toContain("id-token: write")
    expect(workflow).toContain("npm publish")
    const pin = workflow.match(/npm install -g npm@\^?(\d+)\.(\d+)\.(\d+)/)
    expect(pin).not.toBeNull()
    const version = [Number(pin![1]), Number(pin![2]), Number(pin![3])]
    const floor = NPM_TRUSTED_PUBLISHING_FLOOR
    const atLeastFloor =
      version[0]! > floor[0]! ||
      (version[0] === floor[0] && version[1]! > floor[1]!) ||
      (version[0] === floor[0] && version[1] === floor[1] && version[2]! >= floor[2]!)
    expect(atLeastFloor).toBe(true)
  })
})
