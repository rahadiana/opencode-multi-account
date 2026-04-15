import { test } from "node:test"
import assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8")
}

test("loadAuthJson reads ~/.config/opencode/auth.json as fallback", async () => {
  const originalHome = process.env.HOME
  const originalUserProfile = process.env.USERPROFILE
  const originalCwd = process.cwd()

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "storage-auth-test-"))
  const tempHome = path.join(tempRoot, "home")
  const tempProject = path.join(tempRoot, "project")
  fs.mkdirSync(tempHome, { recursive: true })
  fs.mkdirSync(tempProject, { recursive: true })

  try {
    process.env.HOME = tempHome
    process.env.USERPROFILE = tempHome
    process.chdir(tempProject)

    const configAuthPath = path.join(tempHome, ".config", "opencode", "auth.json")
    writeJson(configAuthPath, {
      openai: { type: "api", key: "sk-from-config" },
    })

    const modUrl = new URL(`./storage.ts?cachebust=${Date.now()}`, import.meta.url)
    const { loadAuthJson, AUTH_JSON_CANDIDATES } = await import(modUrl.href)

    assert.ok(
      AUTH_JSON_CANDIDATES.includes(configAuthPath),
      "~/.config/opencode/auth.json should be included as candidate",
    )

    const auth = loadAuthJson()
    assert.ok(auth, "auth.json should be loaded from ~/.config/opencode")

    const map = auth as Record<string, unknown>
    const openaiEntry = map.openai
    assert.ok(openaiEntry && typeof openaiEntry === "object", "openai entry should be parsed")
    const openaiKey = (openaiEntry as Record<string, unknown>).key
    assert.equal(openaiKey, "sk-from-config")
  } finally {
    process.chdir(originalCwd)
    if (originalHome === undefined) delete process.env.HOME
    else process.env.HOME = originalHome
    if (originalUserProfile === undefined) delete process.env.USERPROFILE
    else process.env.USERPROFILE = originalUserProfile

    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
})
