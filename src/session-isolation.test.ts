import test from "node:test"
import assert from "node:assert/strict"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

const pluginLoadedFlag = "__opencode_multi_account_plugin_loaded__"
const fetchPatchedFlag = "__opencode_multi_account_fetch_patched__"

type IntervalCapture = {
  id: ReturnType<typeof setInterval>
  handler: (...args: any[]) => any
  ms: number | undefined
}

type TestContext = {
  hooks: Record<string, any>
  client: Record<string, any>
  abortCalls: Array<{ path: { id: string } }>
  toastCalls: unknown[]
  intervals: IntervalCapture[]
  tempHome: string
  loadState: () => {
    currentAccountId: string | null
    accountStates: Record<string, { status: string; rateLimitUntil?: string }>
  }
  restore: () => void
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8")
}

async function createPluginContext(options?: {
  accounts?: unknown[]
  fetchImpl?: typeof globalThis.fetch
  now?: () => number
  requestImpl?: (options: any) => Promise<any>
}): Promise<TestContext> {
  const originalHome = process.env.HOME
  const originalUserProfile = process.env.USERPROFILE
  const originalAppData = process.env.APPDATA
  const originalLocalAppData = process.env.LOCALAPPDATA
  const originalDisableWatchers = process.env.OPENCODE_PLUGIN_DISABLE_WATCHERS
  const originalCwd = process.cwd()
  const originalSetInterval = globalThis.setInterval.bind(globalThis)
  const originalFetch = globalThis.fetch
  const originalDateNow = Date.now

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "session-isolation-test-"))
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
    accounts: options?.accounts ?? [
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

  const intervals: IntervalCapture[] = []
  ;(globalThis as any).setInterval = function (handler: (...args: any[]) => any, ms?: number, ...rest: any[]) {
    const id = originalSetInterval(handler, ms, ...rest)
    intervals.push({ id, handler, ms })
    return id
  }

  if (options?.fetchImpl) {
    ;(globalThis as any).fetch = options.fetchImpl
  }

  if (options?.now) {
    Date.now = options.now
  }

  const abortCalls: Array<{ path: { id: string } }> = []
  const toastCalls: unknown[] = []
  const client: Record<string, any> = {
    _client: {
      request: options?.requestImpl ?? (async () => ({ response: { status: 200 } })),
    },
    app: { log: async () => {} },
    session: {
      abort: async (payload: { path: { id: string } }) => {
        abortCalls.push(payload)
      },
    },
    tui: {
      showToast: async (payload: unknown) => {
        toastCalls.push(payload)
      },
    },
  }

  delete (globalThis as Record<string, unknown>)[pluginLoadedFlag]
  delete (globalThis as Record<string, unknown>)[fetchPatchedFlag]

  const modUrl = new URL(`./index.ts?cachebust=${Date.now()}-${Math.random()}`, import.meta.url)
  const { MultiAccountPlugin } = await import(modUrl.href)
  const hooks = await MultiAccountPlugin({ client } as any)

  return {
    hooks,
    client,
    abortCalls,
    toastCalls,
    intervals,
    tempHome,
    loadState: () => JSON.parse(fs.readFileSync(statePath, "utf8")),
    restore: () => {
      for (const interval of intervals) {
        try {
          clearInterval(interval.id)
        } catch {}
      }

      ;(globalThis as any).setInterval = originalSetInterval
      if (originalFetch === undefined) delete (globalThis as any).fetch
      else (globalThis as any).fetch = originalFetch
      Date.now = originalDateNow

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

      process.chdir(originalCwd)
      delete (globalThis as Record<string, unknown>)[pluginLoadedFlag]
      delete (globalThis as Record<string, unknown>)[fetchPatchedFlag]
      fs.rmSync(tempRoot, { recursive: true, force: true })
    },
  }
}

async function runShellEnv(
  hooks: Record<string, any>,
  input: Record<string, unknown>,
): Promise<Record<string, string>> {
  const output: { env?: Record<string, string> } = {}
  await hooks["shell.env"](input, output)
  return output.env ?? {}
}

async function runChatHeaders(
  hooks: Record<string, any>,
  input: Record<string, unknown>,
): Promise<Record<string, string>> {
  const output: { headers?: Record<string, string> } = {}
  await hooks["chat.headers"](input, output)
  return output.headers ?? {}
}

test("session isolation scenarios", async () => {
  let fakeNow = 1_000
  let fetchStatus = 200
  const ctx = await createPluginContext({
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
      {
        id: "openai-3",
        name: "OpenAI 3",
        provider: "openai",
        credentials: {
          authType: "api_key",
          env: { OPENAI_API_KEY: "sk-openai-3" },
        },
        priority: 3,
        cooldownMinutes: 60,
      },
      {
        id: "openai-4",
        name: "OpenAI 4",
        provider: "openai",
        credentials: {
          authType: "api_key",
          env: { OPENAI_API_KEY: "sk-openai-4" },
        },
        priority: 4,
        cooldownMinutes: 60,
      },
      {
        id: "anthropic-1",
        name: "Anthropic 1",
        provider: "anthropic",
        credentials: {
          authType: "api_key",
          env: { ANTHROPIC_API_KEY: "sk-ant-1" },
        },
        priority: 1,
        cooldownMinutes: 60,
      },
      {
        id: "anthropic-2",
        name: "Anthropic 2",
        provider: "anthropic",
        credentials: {
          authType: "api_key",
          env: { ANTHROPIC_API_KEY: "sk-ant-2" },
        },
        priority: 2,
        cooldownMinutes: 60,
      },
    ],
    fetchImpl: async () => ({
      status: fetchStatus,
      headers: { entries: () => [] },
      url: "https://example.invalid/default-fallback",
    }) as any,
    now: () => fakeNow,
  })

  try {
    assert.equal(typeof ctx.hooks.event, "function")
    assert.equal(typeof ctx.hooks["shell.env"], "function")
    assert.equal(typeof ctx.hooks["chat.headers"], "function")

    const defaultEnvBeforeFetch = await runShellEnv(ctx.hooks, {
      model: { providerID: "openai" },
    })
    assert.equal(defaultEnvBeforeFetch.OPENAI_API_KEY, "sk-openai-1")

    fetchStatus = 429
    await (globalThis as any).fetch("https://example.invalid/default-fallback")
    assert.equal(ctx.abortCalls.length, 0, "fetch fallback should not abort a named session")

    const defaultFallbackEnv = await runShellEnv(ctx.hooks, {
      model: { providerID: "openai" },
    })
    assert.equal(defaultFallbackEnv.OPENAI_API_KEY, "sk-openai-2")

    const fetchLogPath = path.join(ctx.tempHome, ".config", "opencode", "multi-account", "fetch-log.json")
    assert.ok(fs.existsSync(fetchLogPath), "fetch patch should persist debug entries for the fallback path")
    const fetchLog = JSON.parse(fs.readFileSync(fetchLogPath, "utf8")) as Array<Record<string, unknown>>
    assert.ok(fetchLog.some((entry) => entry.kind === "response" && entry.status === 429))

    const openAiSessionBefore = await runShellEnv(ctx.hooks, {
      sessionID: "openai-session",
      model: { providerID: "openai" },
    })
    const anthropicSessionBefore = await runShellEnv(ctx.hooks, {
      sessionID: "anthropic-session",
      model: { providerID: "anthropic" },
    })

    assert.equal(openAiSessionBefore.OPENAI_API_KEY, "sk-openai-2")
    assert.equal(anthropicSessionBefore.ANTHROPIC_API_KEY, "sk-ant-1")

    await ctx.hooks.event({
      event: {
        type: "session.status",
        properties: {
          sessionID: "event-first-anthropic-session",
          status: { type: "busy" },
          model: { providerID: "anthropic" },
        },
      },
    })

    const eventFirstAnthropicBefore = await runShellEnv(ctx.hooks, {
      sessionID: "event-first-anthropic-session",
      model: { providerID: "anthropic" },
    })

    assert.equal(eventFirstAnthropicBefore.ANTHROPIC_API_KEY, "sk-ant-1")

    await ctx.hooks.event({
      event: {
        type: "session.error",
        properties: {
          sessionID: "event-first-anthropic-session",
          model: { providerID: "anthropic" },
          error: {
            message: 'Unauthorized: {"detail":"Could not parse your authentication token. Please try signing in again."}',
          },
        },
      },
    })

    const eventFirstAnthropicAfter = await runShellEnv(ctx.hooks, {
      sessionID: "event-first-anthropic-session",
      model: { providerID: "anthropic" },
    })

    assert.equal(eventFirstAnthropicAfter.ANTHROPIC_API_KEY, "sk-ant-2")

    await ctx.hooks.event({
      event: {
        type: "session.error",
        properties: {
          sessionID: "openai-session",
          model: { providerID: "openai" },
          error: {
            message: 'Unauthorized: {"detail":"Could not parse your authentication token. Please try signing in again."}',
          },
        },
      },
    })

    const openAiSessionAfter = await runShellEnv(ctx.hooks, {
      sessionID: "openai-session",
      model: { providerID: "openai" },
    })
    const anthropicSessionAfter = await runShellEnv(ctx.hooks, {
      sessionID: "anthropic-session",
      model: { providerID: "anthropic" },
    })

    assert.equal(openAiSessionAfter.OPENAI_API_KEY, "sk-openai-3")
    assert.equal(anthropicSessionAfter.ANTHROPIC_API_KEY, "sk-ant-2")
    assert.deepEqual(ctx.abortCalls, [
      { path: { id: "event-first-anthropic-session" } },
      { path: { id: "openai-session" } },
    ])
    assert.equal(ctx.toastCalls.length, 2)

    fakeNow = 20_000
    await runShellEnv(ctx.hooks, {
      sessionID: "stalled-openai-session",
      model: { providerID: "openai" },
    })

    fakeNow = 24_000
    await runShellEnv(ctx.hooks, {
      sessionID: "fresh-anthropic-session",
      model: { providerID: "anthropic" },
    })
    await runShellEnv(ctx.hooks, {
      sessionID: "anthropic-session",
      model: { providerID: "anthropic" },
    })
    await runShellEnv(ctx.hooks, {
      sessionID: "event-first-anthropic-session",
      model: { providerID: "anthropic" },
    })
    await runShellEnv(ctx.hooks, {
      sessionID: "openai-session",
      model: { providerID: "openai" },
    })

    fakeNow = 29_100
    const watchdog = ctx.intervals.find((interval) => interval.ms === 3000)
    assert.ok(watchdog, "watchdog interval should be registered")
    await watchdog.handler()

    const stalledOpenAiSessionAfter = await runShellEnv(ctx.hooks, {
      sessionID: "stalled-openai-session",
      model: { providerID: "openai" },
    })
    const freshAnthropicSessionAfter = await runShellEnv(ctx.hooks, {
      sessionID: "fresh-anthropic-session",
      model: { providerID: "anthropic" },
    })

    assert.equal(stalledOpenAiSessionAfter.OPENAI_API_KEY, "sk-openai-4")
    assert.equal(freshAnthropicSessionAfter.ANTHROPIC_API_KEY, "sk-ant-2")
    assert.deepEqual(ctx.abortCalls, [
      { path: { id: "event-first-anthropic-session" } },
      { path: { id: "openai-session" } },
      { path: { id: "stalled-openai-session" } },
    ])

    const runtime = ctx.loadState()
    assert.equal(runtime.currentAccountId, "openai-4")
    assert.equal(runtime.accountStates["openai-1"]?.status, "rate_limited")
    assert.equal(runtime.accountStates["openai-2"]?.status, "rate_limited")
    assert.equal(runtime.accountStates["openai-3"]?.status, "rate_limited")
    assert.equal(runtime.accountStates["openai-4"]?.status, "active")
    assert.equal(runtime.accountStates["anthropic-1"]?.status, "rate_limited")
    assert.equal(runtime.accountStates["anthropic-2"]?.status, "active")
    assert.ok(typeof runtime.accountStates["openai-1"]?.rateLimitUntil === "string")
    assert.ok(typeof runtime.accountStates["openai-2"]?.rateLimitUntil === "string")
    assert.ok(typeof runtime.accountStates["openai-3"]?.rateLimitUntil === "string")
    assert.ok(typeof runtime.accountStates["anthropic-1"]?.rateLimitUntil === "string")
  } finally {
    ctx.restore()
  }
})
