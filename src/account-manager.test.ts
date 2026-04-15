import { test } from "node:test"
import assert from "node:assert/strict"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import type { Account } from "./types"

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8")
}

test("auth sync append mode dedupes and keeps previous provider entries", async () => {
  const originalCwd = process.cwd()
  const originalHome = process.env.HOME
  const originalUserProfile = process.env.USERPROFILE

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "multi-account-test-"))
  const tempHome = path.join(tempRoot, "home")
  const tempProject = path.join(tempRoot, "project")
  fs.mkdirSync(tempHome, { recursive: true })
  fs.mkdirSync(tempProject, { recursive: true })

  try {
    process.env.HOME = tempHome
    process.env.USERPROFILE = tempHome
    process.chdir(tempProject)

    writeJson(path.join(tempProject, "auth.json"), {
      openai: [
        { type: "api", key: "sk-openai-a", team: "alpha" },
        { type: "api", key: "sk-openai-a", team: "alpha" },
        { type: "api", key: "sk-openai-b", team: "beta" },
      ],
    })

    const modUrl = new URL(`./account-manager.ts?cachebust=${Date.now()}`, import.meta.url)
    const { AccountManager } = await import(modUrl.href)
    const manager: {
      getAllAccounts(): Account[]
      getCurrentAccountId(): string | null
      handleRateLimit(accountId: string): { switched: boolean; allExhausted: boolean }
      reload(): void
    } = new AccountManager()

    const firstOpenAiPool = manager.getAllAccounts().filter((acc: Account) => acc.provider === "openai")
    assert.equal(firstOpenAiPool.length, 2, "duplicate auth entries should be deduped")

    writeJson(path.join(tempProject, "auth.json"), {
      anthropic: [
        { type: "api", key: "sk-ant-1", workspace: "main" },
      ],
    })

    manager.reload()

    const openAiAfterSync = manager.getAllAccounts().filter((acc: Account) => acc.provider === "openai")
    const anthropicAfterSync = manager.getAllAccounts().filter((acc: Account) => acc.provider === "anthropic")

    // Append mode: openai entries STAY (not pruned when auth.json changes), anthropic IS ADDED
    assert.equal(openAiAfterSync.length, 2, "openai entries should persist (append mode)")
    assert.equal(anthropicAfterSync.length, 1)

    const configPath = path.join(tempHome, ".config", "opencode", "multi-account", "accounts.json")
    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      providerAccounts?: Record<string, unknown[]>
      authSyncProviders?: string[]
      accountMarkers?: Record<string, { status: string; rateLimitUntil?: string }>
    }

    // Both providers now in accounts.json (append mode keeps old + adds new)
    assert.ok((config.providerAccounts?.openai?.length ?? 0) >= 2)
    assert.ok(config.providerAccounts?.anthropic?.length === 1)

    const current = manager.getCurrentAccountId()
    assert.ok(typeof current === "string" && current.length > 0)
    const rateResult = manager.handleRateLimit(current)
    assert.ok(rateResult.switched || rateResult.allExhausted)

    const configAfterLimit = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      accountMarkers?: Record<string, { status: string; rateLimitUntil?: string }>
    }
    const markers = configAfterLimit.accountMarkers ?? {}
    const limitedMarker = markers[current]
    assert.ok(limitedMarker, "rate-limited account should be marked in accounts.json")
    assert.equal(limitedMarker.status, "rate_limited")
    assert.ok(
      typeof limitedMarker.rateLimitUntil === "string" && limitedMarker.rateLimitUntil.length > 0,
      "rateLimitUntil should be persisted in accounts.json marker",
    )
  } finally {
    process.chdir(originalCwd)
    if (originalHome === undefined) delete process.env.HOME
    else process.env.HOME = originalHome
    if (originalUserProfile === undefined) delete process.env.USERPROFILE
    else process.env.USERPROFILE = originalUserProfile
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
})
