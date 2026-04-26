import test from "node:test"
import assert from "node:assert/strict"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8")
}

const pluginLoadedFlag = "__opencode_multi_account_plugin_loaded__"

test("session unauthorized event rotates to next account", async () => {
  const originalHome = process.env.HOME
  const originalUserProfile = process.env.USERPROFILE
  const originalAppData = process.env.APPDATA
  const originalLocalAppData = process.env.LOCALAPPDATA
  const originalDisableWatchers = process.env.OPENCODE_PLUGIN_DISABLE_WATCHERS
  const originalCwd = process.cwd()

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "event-rotation-test-"))
  const tempHome = path.join(tempRoot, "home")
  const tempProject = path.join(tempRoot, "project")
  fs.mkdirSync(tempHome, { recursive: true })
  fs.mkdirSync(tempProject, { recursive: true })

  process.env.HOME = tempHome
  process.env.USERPROFILE = tempHome
  process.env.APPDATA = path.join(tempHome, "AppData", "Roaming")
  process.env.LOCALAPPDATA = path.join(tempHome, "AppData", "Local")
  process.env.OPENCODE_PLUGIN_DISABLE_WATCHERS = "1"
  process.chdir(tempProject)

  const configPath = path.join(tempHome, ".config", "opencode", "multi-account", "accounts.json")
  const statePath = path.join(tempHome, ".config", "opencode", "multi-account", "state.json")

  writeJson(configPath, {
    schemaVersion: 2,
    accounts: [
      {
        id: "openai-1",
        name: "OpenAI 1",
        provider: "openai",
        credentials: {
          authType: "api_key",
          env: { OPENAI_API_KEY: "sk-openai-1" },
        },
        priority: 1,
        cooldownMinutes: 60,
      },
      {
        id: "openai-2",
        name: "OpenAI 2",
        provider: "openai",
        credentials: {
          authType: "api_key",
          env: { OPENAI_API_KEY: "sk-openai-2" },
        },
        priority: 2,
        cooldownMinutes: 60,
      },
    ],
    rotationStrategy: "priority",
    autoSwitch: true,
    defaultCooldownMinutes: 60,
  })

  const intervals: Array<ReturnType<typeof setInterval>> = []
  const originalSetInterval = globalThis.setInterval.bind(globalThis)
  ;(globalThis as unknown as { setInterval: typeof setInterval }).setInterval = function (handler, ms, ...rest) {
    const id = originalSetInterval(handler, ms, ...rest)
    intervals.push(id)
    return id
  }

  const client: Record<string, unknown> = {
    _client: { request: async () => ({ response: { status: 200 } }) },
    app: { log: async () => {} },
    session: { abort: async () => {} },
    tui: { showToast: async () => {} },
  }

  try {
    delete (globalThis as Record<string, unknown>)[pluginLoadedFlag]
    const modUrl = new URL(`./index.ts?cachebust=${Date.now()}`, import.meta.url)
    const { MultiAccountPlugin } = await import(modUrl.href)

    const hooks = await MultiAccountPlugin({ client } as unknown as Parameters<typeof MultiAccountPlugin>[0])

    if (typeof hooks["event"] !== "function") {
      throw new Error("event hook not available")
    }

    await hooks["event"]({
      event: {
        type: "session.error",
        properties: {
          sessionID: "test-session-1",
          error: {
            message: 'Unauthorized: {"detail":"Could not parse your authentication token. Please try signing in again."}',
          },
        },
      },
    })

    const runtime = JSON.parse(fs.readFileSync(statePath, "utf8")) as {
      currentAccountId: string | null
      accountStates: Record<string, { status: string; rateLimitUntil?: string }>
    }

    assert.equal(runtime.currentAccountId, "openai-2")
    assert.equal(runtime.accountStates["openai-1"]?.status, "rate_limited")
    assert.ok(
      typeof runtime.accountStates["openai-1"]?.rateLimitUntil === "string" &&
        runtime.accountStates["openai-1"].rateLimitUntil.length > 0,
    )
  } finally {
    for (const intervalHandle of intervals) {
      try { clearInterval(intervalHandle) } catch {}
    }
    ;(globalThis as unknown as { setInterval: typeof setInterval }).setInterval = originalSetInterval

    process.chdir(originalCwd)
    if (originalHome === undefined) delete process.env.HOME
    else process.env.HOME = originalHome
    if (originalUserProfile === undefined) delete process.env.USERPROFILE
    else process.env.USERPROFILE = originalUserProfile
    if (originalAppData === undefined) delete process.env.APPDATA
    else process.env.APPDATA = originalAppData
    if (originalLocalAppData === undefined) delete process.env.LOCALAPPDATA
    else process.env.LOCALAPPDATA = originalLocalAppData
    if (originalDisableWatchers === undefined) delete process.env.OPENCODE_PLUGIN_DISABLE_WATCHERS
    else process.env.OPENCODE_PLUGIN_DISABLE_WATCHERS = originalDisableWatchers

    delete (globalThis as Record<string, unknown>)[pluginLoadedFlag]
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
})
