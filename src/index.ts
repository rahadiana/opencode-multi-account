// OpenCode Multi-Account Manager Plugin — Universal Edition

import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { AccountManager } from "./account-manager.js"
import { isRateLimitError, isAccountRateLimited } from "./rate-limiter.js"
import { CONFIG_FILE, AUTH_JSON_CANDIDATES } from "./storage.js"
import { resolveAccountEnv } from "./provider-credentials.js"
import { buildAuthJsonEntry } from "./auth-json.js"
import { overwriteAuthJsonProvider } from "./storage.js"
import { detectRateLimitFromEvent } from "./event-detection.js"

const DEBUG_DIR = path.join(os.homedir(), ".config", "opencode", "multi-account")
const MASTER_DEBUG_LOG = path.join(DEBUG_DIR, "multi-account-debug.log")
const DEBUG_LAST_EVENT = path.join(DEBUG_DIR, "last-any-event.json")
const DEBUG_LAST_STATUS = path.join(DEBUG_DIR, "last-session-status.json")
const DEBUG_LAST_ERROR = path.join(DEBUG_DIR, "last-session-error.json")
const DEBUG_LAST_RATE_EVENT = path.join(DEBUG_DIR, "last-rate-event.json")
const DEBUG_LAST_HTTP_RESPONSE = path.join(DEBUG_DIR, "last-http-response.json")
const DEBUG_LAST_HTTP_ERROR = path.join(DEBUG_DIR, "last-http-error.json")
const DEBUG_HOOK_INVOKE = path.join(DEBUG_DIR, "hook-invocations.json")
const DEBUG_FETCH_LOG = path.join(DEBUG_DIR, "fetch-log.json")
const DEBUG_STATUS_HISTORY = path.join(DEBUG_DIR, "last-session-statuses.json")
const DEBUG_ERROR_HISTORY = path.join(DEBUG_DIR, "last-session-errors.json")
const DEBUG_SEEN_EVENT_TYPES = path.join(DEBUG_DIR, "seen-event-types.json")

function debugLog(msg: string) {
  try {
    if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true })
    fs.appendFileSync(MASTER_DEBUG_LOG, `[${new Date().toISOString()}] ${msg}\n`)
  } catch (e) {}
}

function writeAuthAndEnv(account: any) {
  if (!account) return
  const authEntry = account.rawEntry ?? buildAuthJsonEntry(account)
  if (authEntry) {
    try { overwriteAuthJsonProvider(account.provider, authEntry) } catch {}
  }
  try {
    const env = resolveAccountEnv(account)
    for (const [k, v] of Object.entries(env)) {
      process.env[k] = v
    }
  } catch {}
}

function rotateOnHttp429(manager: AccountManager, source: string, providerHint?: string, sessionID?: string | null) {
  manager.reload()
  // Jika tidak ada sessionID dan tidak ada current account, gunakan providerHint untuk mendapatkan akun
  let current = sessionID
    ? manager.getOrAssignAccountForSession(sessionID)
    : manager.getCurrentAccount()
  
  // FIX: Jika current null tapi ada providerHint, gunakan providerHint untuk mendapatkan akun
  if (!current && providerHint) {
    current = manager.getNextAvailableAccount(undefined, providerHint)
    debugLog(`[rotateOnHttp429] Using providerHint fallback: ${providerHint} -> ${current?.id ?? 'none'}`)
  }
  
  const provider = providerHint || current?.provider
  if (!current) return false

const result = manager.handleRateLimit(current.id, sessionID ?? undefined)
  const target = result.nextAccount ?? (sessionID
    ? manager.getOrAssignAccountForSession(sessionID)
    : manager.getCurrentAccount())
  if (target) {
    writeAuthAndEnv(target)
    debugLog(`🚨 [HTTP429] ${source}: rotate ${current.id} -> ${target.id} (provider=${provider})`)
    return true
  } else {
    // Debug: log why rotation failed
    debugLog(`🚨 [HTTP429] ${source}: rotation FAILED for ${current.id} (provider=${provider}) - no next account found`)
    // Log provider pool status for debugging
    if (current?.provider) {
      const poolDescription = manager.describeProviderPool(current.provider, current.id)
      debugLog(`🚨 [HTTP429] Pool status for ${current.provider}: ${poolDescription}`)
    }
    return false
  }
}

function persistDebug(label: string, payload: unknown, target: string) {
  try {
    if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true })
    const body = { label, timestamp: new Date().toISOString(), event: payload }
    fs.writeFileSync(target, JSON.stringify(body, null, 2), "utf8")
  } catch {}
}

function persistHistory(payload: unknown, target: string, maxEntries: number = 50) {
  try {
    if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true })
    const entry = { timestamp: new Date().toISOString(), event: payload }
    let arr: unknown[] = []
    if (fs.existsSync(target)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(target, "utf8"))
        if (Array.isArray(parsed)) arr = parsed
      } catch {}
    }
    arr.push(entry)
    if (arr.length > maxEntries) {
      arr = arr.slice(arr.length - maxEntries)
    }
    fs.writeFileSync(target, JSON.stringify(arr, null, 2), "utf8")
  } catch {}
}

function persistHookInvoke(name: string, extra?: Record<string, unknown>) {
  try {
    if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true })
    const entry = { timestamp: new Date().toISOString(), name, extra }
    let arr: unknown[] = []
    if (fs.existsSync(DEBUG_HOOK_INVOKE)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(DEBUG_HOOK_INVOKE, "utf8"))
        if (Array.isArray(parsed)) arr = parsed
      } catch {}
    }
    arr.push(entry)
    if (arr.length > 200) arr = arr.slice(arr.length - 200)
    fs.writeFileSync(DEBUG_HOOK_INVOKE, JSON.stringify(arr, null, 2), "utf8")
  } catch {}
}

function persistFetchLog(entry: Record<string, unknown>) {
  try {
    if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true })
    let arr: unknown[] = []
    if (fs.existsSync(DEBUG_FETCH_LOG)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(DEBUG_FETCH_LOG, "utf8"))
        if (Array.isArray(parsed)) arr = parsed
      } catch {}
    }
    arr.push({ timestamp: new Date().toISOString(), ...entry })
    if (arr.length > 200) arr = arr.slice(arr.length - 200)
    fs.writeFileSync(DEBUG_FETCH_LOG, JSON.stringify(arr, null, 2), "utf8")
  } catch {}
}

function persistEventType(eventType: string | undefined) {
  if (!eventType || eventType.trim().length === 0) return
  try {
    if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true })
    let arr: string[] = []
    if (fs.existsSync(DEBUG_SEEN_EVENT_TYPES)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(DEBUG_SEEN_EVENT_TYPES, "utf8"))
        if (Array.isArray(parsed)) arr = parsed.filter((v) => typeof v === "string")
      } catch {}
    }
    if (!arr.includes(eventType)) arr.push(eventType)
    if (arr.length > 100) arr = arr.slice(arr.length - 100)
    fs.writeFileSync(DEBUG_SEEN_EVENT_TYPES, JSON.stringify(arr, null, 2), "utf8")
  } catch {}
}

const GLOBAL_PLUGIN_FLAG = "__opencode_multi_account_plugin_loaded__"

export const MultiAccountPlugin: Plugin = async ({ client }) => {
  debugLog("🚀 MultiAccountPlugin Restoration Started (Universal Edition)")
  
  const globalState = globalThis as typeof globalThis & Record<string, boolean | undefined>
  if (globalState[GLOBAL_PLUGIN_FLAG]) {
    debugLog("⚠️ MultiAccountPlugin already loaded, skipping duplicate")
    return {}
  }
  globalState[GLOBAL_PLUGIN_FLAG] = true

  const manager = new AccountManager()
  
  // ─── DETERMINISTIC STATE MACHINE ────────────────────────
  enum PluginState {
    IDLE = "IDLE",
    STREAMING = "STREAMING",
    ROTATING = "ROTATING"
  }

  type SessionRuntimeState = {
    state: PluginState
    lastActivity: number
  }

  const sessionStates = new Map<string, SessionRuntimeState>()
  let defaultPluginState: PluginState = PluginState.IDLE
  let defaultLastActivity = Date.now()

  const getSessionState = (sessionID: string): SessionRuntimeState => {
    const existing = sessionStates.get(sessionID)
    if (existing) return existing

    const initialState = {
      state: PluginState.IDLE,
      lastActivity: Date.now(),
    }
    sessionStates.set(sessionID, initialState)
    return initialState
  }

  const setSessionState = (sessionID: string, state: PluginState, activityTime: number = Date.now()) => {
    const nextState = getSessionState(sessionID)
    nextState.state = state
    nextState.lastActivity = activityTime
    return nextState
  }

  const touchSessionActivity = (sessionID: string, activityTime: number = Date.now()) => {
    const nextState = getSessionState(sessionID)
    nextState.lastActivity = activityTime
    return nextState
  }

  const setDefaultState = (state: PluginState, activityTime: number = Date.now()) => {
    defaultPluginState = state
    defaultLastActivity = activityTime
  }

  const touchDefaultActivity = (activityTime: number = Date.now()) => {
    defaultLastActivity = activityTime
  }

  const getSessionIdFromRequestOptions = (options: any): string | null => {
    return options?.path?.id || options?.path?.sessionID || null
  }

  const getEventSessionID = (payload: any): string | null => {
    return payload?.properties?.sessionID || payload?.sessionID || null
  }

  const getProviderHint = (payload: any): string | undefined => {
    return payload?.properties?.model?.providerID ||
      payload?.properties?.provider?.id ||
      payload?.model?.providerID ||
      payload?.provider?.id ||
      undefined
  }

  const getManagedAccount = (sessionID?: string | null, requestedProvider?: string) => {
    manager.reload()

    let account = sessionID
      ? manager.getOrAssignAccountForSession(sessionID, requestedProvider)
      : manager.getCurrentAccount()

    if (requestedProvider && account?.provider !== requestedProvider) {
      const candidate = manager.getNextAvailableAccount(undefined, requestedProvider)
      if (candidate) {
        manager.switchToAccount(candidate.id, sessionID ?? undefined)
        account = candidate
      }
    }

    if (account) {
      const accState = manager.getState().accountStates[account.id]
      if (accState?.status === "rate_limited" && accState.rateLimitUntil && isAccountRateLimited(account, accState.rateLimitUntil)) {
        const rotated = manager.handleRateLimit(account.id, sessionID ?? undefined).nextAccount
        if (rotated) account = rotated
      }
    }

    return account
  }

  // ─── HARD RESET HELPER (The "Brutal" Fix) ────────────────
  const forceRotateAndAbort = async (source: string, sessionID: string | null) => {
    // ⚠️ Fungsi ini HANYA abort sesi + toast.
    // Rotasi sudah dilakukan oleh rotateOnHttp429() SEBELUM fungsi ini dipanggil.
    // Jangan panggil handleRateLimit di sini — itu akan membakar akun kedua (double rotation).
    const current = manager.getCurrentAccount()
    debugLog(`🚨 [HARD RESET] Source: ${source} triggered abort for session: ${sessionID}, active: ${current?.id ?? "none"}`)
    
    // 💥 Pemutusan sesi paksa agar Web UI keluar dari retry loop "attempt #N"
    if (sessionID) {
      try {
        await (client as any).session.abort({ path: { id: sessionID } }).catch(() => {})
        const toastMsg = current
          ? `Limit tercapai. Sesi dihentikan & akun diputar ke: ${current.name}. Silakan coba lagi.`
          : `Semua akun habis. Sesi dihentikan. Tunggu cooldown selesai.`
        await (client as any).tui.showToast({
          body: {
            title: "🔄 Rotasi Akun Otomatis",
            message: toastMsg,
            type: "info"
          }
        }).catch(() => {})
      } catch (e) {}
    }
    
    await log("warn", `🚨 Peluncur Otomatis (${source}): Sesi dimutus, akun aktif: ${current?.name ?? "none"}.`, {
      currentAccount: current?.id,
      defaultLastActivityAgeMs: sessionID ? undefined : Date.now() - defaultLastActivity,
    })
    if (sessionID) {
      setSessionState(sessionID, PluginState.IDLE)
    } else {
      setDefaultState(PluginState.IDLE)
    }
  }

  // ─── INTERCEPTOR PRIME (The God-Mode Patch) ──────────────
  // Kita menimpa metode request internal SDK karena Web UI sering membypass 
  // interceptor standar dan event bus untuk streaming.
  const coreClient = (client as any)._client
  if (coreClient && typeof coreClient.request === "function") {
    const originalRequest = coreClient.request.bind(coreClient)
    
    coreClient.request = async (options: any) => {
      const sessionID = getSessionIdFromRequestOptions(options)

      // 💓 THE PULSE (Start)
      if (sessionID) {
        setSessionState(sessionID, PluginState.STREAMING)
        manager.getOrAssignAccountForSession(
          sessionID,
          options?.provider?.id || options?.model?.providerID,
        )
      } else {
        setDefaultState(PluginState.STREAMING)
      }
      
      try {
        const result = await originalRequest(options)
        
        // 🕵️ Analisis Respons (Low-level HTTP Visibility)
        const response = result.response
        if (response) {
          persistDebug("http.response", {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            url: response.url,
          }, DEBUG_LAST_HTTP_RESPONSE)
        }
        if (response && (response.status === 429 || response.status === 401 || response.status === 403)) {
          debugLog(`🚨 [INTERCEPTOR PRIME] HTTP ${response.status} DETECTED! Status: ${response.status}`)
          if (sessionID) {
            setSessionState(sessionID, PluginState.ROTATING)
          } else {
            setDefaultState(PluginState.ROTATING)
          }
          // Treat 401/403 similar to 429 for rotation purposes so accounts are rotated
          // when authentication/authorization errors are observed.
          rotateOnHttp429(manager, "interceptor-prime", options?.provider?.id || options?.model?.providerID, sessionID)
          await forceRotateAndAbort("interceptor-prime", sessionID)
        }
        
        return result
      } catch (error: any) {
        // 🕵️ Analisis Error
        persistDebug("http.error", error, DEBUG_LAST_HTTP_ERROR)
        const errMsg = extractEventMessage(error)
        if (isRateLimitError(error) || isRateLimitError(errMsg)) {
          debugLog(`🚨 [INTERCEPTOR PRIME] RATE LIMIT ERROR DETECTED!`)
          if (sessionID) {
            setSessionState(sessionID, PluginState.ROTATING)
          } else {
            setDefaultState(PluginState.ROTATING)
          }
          rotateOnHttp429(manager, "interceptor-prime-error", options?.provider?.id || options?.model?.providerID, sessionID)
          await forceRotateAndAbort("interceptor-prime-error", sessionID)
        }
        throw error
      }
    }
  }

  // ─── FETCH MONKEYPATCH (Web fallback) ─────────────
  const globalAny = globalThis as any
  if (!globalAny.__opencode_multi_account_fetch_patched__ && typeof globalAny.fetch === "function") {
    globalAny.__opencode_multi_account_fetch_patched__ = true
    const originalFetch = globalAny.fetch.bind(globalAny)
    globalAny.fetch = async (...args: any[]) => {
      const started = Date.now()
      try {
        const res = await originalFetch(...args)
        const url = (() => {
          try { return args[0]?.url || args[0] } catch { return undefined }
        })()
        const status = (res as any)?.status
        const headers = (res as any)?.headers
        persistFetchLog({ kind: "response", url, status, ms: Date.now() - started })
        persistDebug("fetch.response", { url, status, headers: headers ? Object.fromEntries((headers as any).entries?.() ?? []) : undefined }, DEBUG_LAST_HTTP_RESPONSE)
        if (status === 429 || status === 401 || status === 403) {
          debugLog(`🚨 [FETCH PATCH] HTTP ${status} DETECTED! URL=${url}`)
          setDefaultState(PluginState.ROTATING)
          rotateOnHttp429(manager, "fetch-429")
          await forceRotateAndAbort("fetch-429", null)
        }
        return res
      } catch (error: any) {
        const url = (() => {
          try { return args[0]?.url || args[0] } catch { return undefined }
        })()
        persistFetchLog({ kind: "error", url, error: String(error), ms: Date.now() - started })
        persistDebug("fetch.error", error, DEBUG_LAST_HTTP_ERROR)
        const errMsg = extractEventMessage(error)
        if (isRateLimitError(error) || isRateLimitError(errMsg)) {
          debugLog(`🚨 [FETCH PATCH] Rate limit detected from fetch error`)
          setDefaultState(PluginState.ROTATING)
          rotateOnHttp429(manager, "fetch-error")
          await forceRotateAndAbort("fetch-error", null)
        }
        throw error
      }
    }
  }

  // ─── STATE-AWARE WATCHDOG (Detect Silent Stalls) ─────────
  setInterval(async () => {
    const now = Date.now()
    for (const [sessionID, runtimeState] of sessionStates.entries()) {
      if (runtimeState.state !== PluginState.STREAMING) continue

      const diff = now - runtimeState.lastActivity

      // 1. Silent Failure detection (8s threshold)
      if (diff > 8000 && runtimeState.state === PluginState.STREAMING) {
        debugLog(`⚠️ [WATCHDOG] STREAM STALL! (State: ${runtimeState.state}, Session: ${sessionID}, Stalled for ${Math.round(diff/1000)}s)`)
        setSessionState(sessionID, PluginState.ROTATING, now)
        rotateOnHttp429(manager, "watchdog-stall", undefined, sessionID)
        await forceRotateAndAbort("watchdog-stall", sessionID)
        continue
      }

      // 2. Safety Fallback (60s threshold) - prevent getting stuck in STREAMING
      if (diff > 60000) {
        debugLog(`🏥 [SAFETY] Resetting stuck STREAMING state to IDLE for session ${sessionID}`)
        setSessionState(sessionID, PluginState.IDLE, now)
      }
    }
  }, 3000)

  // ─── MASTER SYNC HEARTBEAT (The "Paku Bumi" Mode) ──────────
  setInterval(async () => {
    try {
      manager.reload()
      const result = manager.universalSyncAuthJson()
      if (result.synced) {
        debugLog(`🔄 Master Sync: auth.json forced to healthy state for ${result.providers.join(", ")}`)
      }
    } catch (e) {}
  }, 10000)

  // ─── Helper: log ke OpenCode ─────────────────────────────
  async function log(level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) {
    try {
      await (client as any).app.log({
        body: {
          service: "multi-account",
          level,
          message,
          extra: extra ?? {},
        },
      })
    } catch (e) {}
  }

  function extractEventMessage(eventPayload: unknown): string {
    if (typeof eventPayload === "string") return eventPayload
    if (typeof eventPayload === "object" && eventPayload !== null) {
      const p = eventPayload as any
      return p.properties?.status?.message || p.properties?.error?.message || p.properties?.error || p.error?.message || p.message || p.properties?.message || JSON.stringify(eventPayload)
    }
    return String(eventPayload)
  }

  // ─── AUTO-SYNC: Watch auth.json untuk perubahan manual ─────
  const disableFileWatchers = process.env.OPENCODE_PLUGIN_DISABLE_WATCHERS === "1" || process.env.NODE_ENV === "test"
  if (!disableFileWatchers) {
    for (const authPath of AUTH_JSON_CANDIDATES) {
      if (!fs.existsSync(authPath)) continue
      try {
        const dir = path.dirname(authPath)
        fs.watch(dir, (_eventType, filename) => {
          if (filename === "auth.json" || authPath.endsWith("auth.json")) {
            // Debounce: reload setelah ada perubahan
            setTimeout(() => {
              manager.reload()
              debugLog(`🔄 auth.json berubah (fs.watch), auto-sync aktif.`)
            }, 500)
          }
        })
      } catch {}
    }
  }

  // ─── Proactive Error Handler (The Rescuer) ─────────────
  const onPossibleError = async (payload: any, source: string, sessionID?: string | null) => {
    // 🕵️ Analisis Teks Stream (Claude Insight)
    let extraText: string | undefined
    if (payload?.type === "message.part.updated") {
      const p = payload.properties || {}
      if (typeof p.content === "string") extraText = p.content
      const part = p.part || {}
      if (typeof part.content === "string") extraText = part.content
      if (typeof part.text === "string") extraText = part.text
      if (typeof p.text === "string") extraText = p.text
    }

    const rawMsg = extractEventMessage(payload)
    const isLimit = detectRateLimitFromEvent(payload, extraText, rawMsg)
    
    if (isLimit) {
      persistDebug(`rate-limit-detected:${source}`, payload, DEBUG_LAST_RATE_EVENT)
      if (extraText && isRateLimitError(extraText)) {
        debugLog(`🎯 [DEEP PARSE] Pesan retry ditemukan di stream: "${extraText.substring(0, 50)}..."`)
      }
      if (sessionID) {
        setSessionState(sessionID, PluginState.ROTATING)
      } else {
        setDefaultState(PluginState.ROTATING)
      }
      const providerHint = getProviderHint(payload)
      const rotated = rotateOnHttp429(manager, `event-${source}`, providerHint, sessionID ?? null)
      if (rotated) {
        await forceRotateAndAbort(source, sessionID ?? null)
      } else {
        debugLog(`⚠️ [EVENT] ${source}: rate-limit detected but no account rotation occurred`)
      }
    }
  }

    return {
      // ─── Inject API key aktif ke shell environment ──────────
      "shell.env": async (input, output) => {
        try {
          const sessionID = (input as any)?.sessionID
          persistHookInvoke("shell.env", { sessionID })
          if (!output.env) output.env = {}
          if (sessionID) {
            setSessionState(sessionID, PluginState.STREAMING)
          } else {
            setDefaultState(PluginState.STREAMING)
          }
          const requestedProvider = (input as any)?.model?.providerID || (input as any)?.provider?.id
          const account = getManagedAccount(sessionID, requestedProvider)

          if (account) {
            const authEntry = account.rawEntry ?? buildAuthJsonEntry(account)
            if (authEntry) { try { overwriteAuthJsonProvider(account.provider, authEntry) } catch {} }

            const env = resolveAccountEnv(account)
            for (const [key, value] of Object.entries(env)) {
              output.env[key] = value
              process.env[key] = value // HOT PATCH
            }
          }
        } catch (err) {}
      },

      // ─── Inject Authentication ke HTTP Header (Full Provider Support) ──
      "chat.headers": async (input: any, output: any) => {
        try {
          const sessionID = (input as any)?.sessionID
          persistHookInvoke("chat.headers", { sessionID })
          if (!output.headers) output.headers = {}
          if (sessionID) {
            setSessionState(sessionID, PluginState.STREAMING)
          } else {
            setDefaultState(PluginState.STREAMING)
          }

          const requestedProvider = (input as any)?.model?.providerID || (input as any)?.provider?.id
          let account = getManagedAccount(sessionID, requestedProvider)

          if (!account) return

          // 🚨 AGGRESSIVE AUTOPILOT (Retry loop detection)
          const rescued = manager.trackRequestAndFix(requestedProvider || account.provider, account.id)
          if (rescued && rescued.id !== account.id) {
            const switched = manager.switchToAccount(rescued.id, sessionID)
            if (switched.account) {
              await log("info", `🔄 Autopilot: Deteksi retry loop, memutar kunci ke ${rescued.name}`)
              account = switched.account
            }
          }

          const env = resolveAccountEnv(account)
          const prov = account.provider.toLowerCase()

          const authEntry = account.rawEntry ?? buildAuthJsonEntry(account)
          if (authEntry) { try { overwriteAuthJsonProvider(account.provider, authEntry) } catch {} }

          for (const [key, value] of Object.entries(env)) {
            process.env[key] = value 
            
            // Injeksi Header Cerdas Berdasarkan Provider
            if (prov === "anthropic") {
              output.headers["x-api-key"] = value
              output.headers["anthropic-version"] = "2023-06-01"
            } else if (prov === "google" || prov === "gemini") {
              output.headers["x-goog-api-key"] = value
            } else if (prov === "azure-openai") {
              output.headers["api-key"] = value
            } else {
              // Default Bearer Header (OpenAI, Groq, DeepSeek, OpenRouter, dll)
              if (key.toUpperCase().includes("API_KEY") || key.toUpperCase().includes("TOKEN")) {
                output.headers["Authorization"] = `Bearer ${value}`
              }
            }
          }
        } catch (err) {}
      },

    // ─── Deteksi rate limit (Failsafe) ─────────────
    event: async ({ event }) => {
      const sessionID = getEventSessionID(event)
      const providerHint = getProviderHint(event)
      if (sessionID) {
        touchSessionActivity(sessionID)
        manager.getOrAssignAccountForSession(sessionID, providerHint)
      } else {
        touchDefaultActivity()
      }
      persistDebug("any.event", event, DEBUG_LAST_EVENT)
      persistEventType((event as any)?.type)
      persistHookInvoke("event", { type: (event as any)?.type, sessionID: (event as any)?.properties?.sessionID })
      
      const properties = (event as any)?.properties
      
      // 🏥 Deterministic State Transition
      if (event?.type === "session.status") {
        const s = properties?.status
        persistDebug("session.status", event, DEBUG_LAST_STATUS)
        persistHistory(event, DEBUG_STATUS_HISTORY, 100)
        if (sessionID && s?.type === "busy") setSessionState(sessionID, PluginState.STREAMING)
        if (sessionID && s?.type === "idle") setSessionState(sessionID, PluginState.IDLE)
        debugLog(`🏥 State Transition: ${sessionID ? getSessionState(sessionID).state : defaultPluginState} | Session: ${sessionID ?? "none"}`)
      }

      if (event?.type === "session.error") {
        persistDebug("session.error", event, DEBUG_LAST_ERROR)
        persistHistory(event, DEBUG_ERROR_HISTORY, 100)
      }

      await onPossibleError(event, "event", sessionID)
    },

    tool: {
      account_status: tool({
        description: "Tampilkan status semua akun API (aktif, rate-limited, disabled, atau invalid).",
        args: {},
        async execute() {
          manager.reload()
          return manager.getStatusSummary()
        },
      }),

      account_list: tool({
        description: "Tampilkan daftar semua akun API yang terdaftar.",
        args: {},
        async execute() {
          manager.reload()
          const accounts = manager.getAllAccounts()
          if (accounts.length === 0) return "Tidak ada akun terdaftar."
          return "Daftar Akun:\n\n" + accounts.map(a => `[P${a.priority}] id="${a.id}" | ${a.name} | Provider: ${a.provider}`).join("\n")
        },
      }),

      account_switch: tool({
        description: "Ganti akun manual berdasarkan ID.",
        args: { account_id: tool.schema.string() },
        async execute(args) {
          manager.reload()
          const result = manager.switchToAccount(args.account_id)
          if (result.account) {
            return `✅ Berhasil switch ke: ${result.account.name}`
          }
          if (result.reason === "invalid") {
            return `❌ Akun \"${args.account_id}\" memiliki credential tidak valid. Periksa accounts.json.`
          }
          if (result.reason === "rate_limited") {
            return `❌ Akun \"${args.account_id}\" masih dalam cooldown rate limit.`
          }
          if (result.reason === "disabled") {
            return `❌ Akun \"${args.account_id}\" sedang disabled dan tidak bisa diaktifkan.`
          }
          return `❌ Akun dengan ID \"${args.account_id}\" tidak ditemukan.`
        },
      }),

      account_config_path: tool({
        description: "Tampilkan path file konfigurasi accounts.json.",
        args: {},
        async execute() {
          return `📁 File konfigurasi: ${CONFIG_FILE}`
        },
      }),
    },
  }
}
