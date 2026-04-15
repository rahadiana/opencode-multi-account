// OpenCode Multi-Account Manager Plugin — Universal Edition

import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { AccountManager } from "./account-manager"
import { isRateLimitError, isAccountRateLimited } from "./rate-limiter"
import { CONFIG_FILE, AUTH_JSON_CANDIDATES } from "./storage"
import { resolveAccountEnv } from "./provider-credentials"
import { buildAuthJsonEntry } from "./auth-json"
import { overwriteAuthJsonProvider } from "./storage"
import { detectRateLimitFromEvent } from "./event-detection"

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

function rotateOnHttp429(manager: AccountManager, source: string, providerHint?: string) {
  manager.reload()
  const current = manager.getCurrentAccount()
  const provider = providerHint || current?.provider
  if (!current) return false

  const result = manager.handleRateLimit(current.id)
  const target = result.nextAccount ?? manager.getCurrentAccount()
  if (target) {
    writeAuthAndEnv(target)
    debugLog(`🚨 [HTTP429] ${source}: rotate ${current.id} -> ${target.id} (provider=${provider})`)
    return true
  }
  return false
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
  
  let currentState: PluginState = PluginState.IDLE
  let lastActivity = Date.now()
  let lastSessionID: string | null = null

  // ─── HARD RESET HELPER (The "Brutal" Fix) ────────────────
  const forceRotateAndAbort = async (source: string, sessionID: string | null) => {
    manager.reload()
    const currentId = manager.getCurrentAccountId()
    if (!currentId) return

    const result = manager.handleRateLimit(currentId)
    if (result.switched) {
      debugLog(`🚨 [HARD RESET] Source: ${source} triggered rotate + abort for session: ${sessionID}`)
      
      // 💥 Pemutusan sesi paksa agar Web UI keluar dari retry loop "attempt #N"
      if (sessionID) {
        try {
          await (client as any).session.abort({ path: { id: sessionID } }).catch(() => {})
          await (client as any).tui.showToast({
            body: {
              title: "🔄 Rotasi Akun Otomatis",
              message: `Limit tercapai. Sesi dihentikan & akun diputar ke: ${result.nextAccount?.name}. Silakan coba lagi.`,
              type: "info"
            }
          }).catch(() => {})
        } catch (e) {}
      }
      
      await log("warn", `🚨 Peluncur Otomatis (${source}): Memutar akun ke ${result.nextAccount?.name} dan memutus sesi macet.`, {
        from: currentId,
        to: result.nextAccount?.id
      })
      lastActivity = Date.now()
    }
  }

  // ─── INTERCEPTOR PRIME (The God-Mode Patch) ──────────────
  // Kita menimpa metode request internal SDK karena Web UI sering membypass 
  // interceptor standar dan event bus untuk streaming.
  const coreClient = (client as any)._client
  if (coreClient && typeof coreClient.request === "function") {
    const originalRequest = coreClient.request.bind(coreClient)
    
    coreClient.request = async (options: any) => {
      // 💓 THE PULSE (Start)
      currentState = PluginState.STREAMING
      lastActivity = Date.now()
      
      const sessionID = options.path?.id || options.path?.sessionID || lastSessionID
      if (sessionID) lastSessionID = sessionID
      
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
          currentState = PluginState.ROTATING
          // Treat 401/403 similar to 429 for rotation purposes so accounts are rotated
          // when authentication/authorization errors are observed.
          rotateOnHttp429(manager, "interceptor-prime", options?.provider?.id || options?.model?.providerID)
          await forceRotateAndAbort("interceptor-prime", lastSessionID)
          currentState = PluginState.IDLE
        }
        
        return result
      } catch (error: any) {
        // 🕵️ Analisis Error
        persistDebug("http.error", error, DEBUG_LAST_HTTP_ERROR)
        const errMsg = extractEventMessage(error)
        if (isRateLimitError(error) || isRateLimitError(errMsg)) {
          debugLog(`🚨 [INTERCEPTOR PRIME] RATE LIMIT ERROR DETECTED!`)
          currentState = PluginState.ROTATING
          rotateOnHttp429(manager, "interceptor-prime-error", options?.provider?.id || options?.model?.providerID)
          await forceRotateAndAbort("interceptor-prime-error", lastSessionID)
          currentState = PluginState.IDLE
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
          currentState = PluginState.ROTATING
          rotateOnHttp429(manager, "fetch-429")
          await forceRotateAndAbort("fetch-429", lastSessionID)
          currentState = PluginState.IDLE
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
          currentState = PluginState.ROTATING
          rotateOnHttp429(manager, "fetch-error")
          await forceRotateAndAbort("fetch-error", lastSessionID)
          currentState = PluginState.IDLE
        }
        throw error
      }
    }
  }

  // ─── STATE-AWARE WATCHDOG (Detect Silent Stalls) ─────────
  setInterval(async () => {
    if (currentState !== PluginState.STREAMING) return
    
    const now = Date.now()
    const diff = now - lastActivity
    
    // 1. Silent Failure detection (8s threshold)
    if (diff > 8000 && currentState === PluginState.STREAMING) {
      debugLog(`⚠️ [WATCHDOG] STREAM STALL! (State: ${currentState}, Stalled for ${Math.round(diff/1000)}s)`)
      currentState = PluginState.ROTATING
      await forceRotateAndAbort("watchdog-stall", lastSessionID)
      currentState = PluginState.IDLE
    }
    
    // 2. Safety Fallback (60s threshold) - prevent getting stuck in STREAMING
    if (diff > 60000) {
      debugLog(`🏥 [SAFETY] Resetting stuck STREAMING state to IDLE`)
      currentState = PluginState.IDLE
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
  for (const authPath of AUTH_JSON_CANDIDATES) {
    if (!fs.existsSync(authPath)) continue
    try {
      const dir = path.dirname(authPath)
      fs.watch(dir, (eventType, filename) => {
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

  // ─── Proactive Error Handler (The Rescuer) ─────────────
  const onPossibleError = async (payload: any, source: string) => {
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
      currentState = PluginState.ROTATING
      await forceRotateAndAbort(source, lastSessionID)
      currentState = PluginState.IDLE
    }
  }

    return {
      // ─── Inject API key aktif ke shell environment ──────────
      "shell.env": async (input, output) => {
        try {
          persistHookInvoke("shell.env", { sessionID: (input as any)?.sessionID })
          if (!output.env) output.env = {}
        if (input.sessionID) lastSessionID = input.sessionID
        currentState = PluginState.STREAMING // Mulai monitoring
        lastActivity = Date.now()
        manager.reload()
        const requestedProvider = (input as any)?.model?.providerID || (input as any)?.provider?.id
        let account = manager.getCurrentAccount()
        
        if (requestedProvider && account?.provider !== requestedProvider) {
           const candidate = manager.getNextAvailableAccount(undefined, requestedProvider)
           if (candidate) {
               manager.switchToAccount(candidate.id)
               account = candidate
           }
        }

        // Skip akun yang sudah ditandai rate-limited di state
        if (account) {
          const accState = manager.getState().accountStates[account.id]
          if (accState?.status === "rate_limited" && accState.rateLimitUntil && isAccountRateLimited(account, accState.rateLimitUntil)) {
            const rotated = manager.handleRateLimit(account.id).nextAccount
            if (rotated) account = rotated
          }
        }

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
          persistHookInvoke("chat.headers", { sessionID: (input as any)?.sessionID })
          if (!output.headers) output.headers = {}
        if (input.sessionID) lastSessionID = input.sessionID
        currentState = PluginState.STREAMING // Mulai monitoring
        lastActivity = Date.now()
        manager.reload()
        
        const requestedProvider = (input as any)?.model?.providerID || (input as any)?.provider?.id
        let account = manager.getCurrentAccount()
        
        if (requestedProvider && account?.provider !== requestedProvider) {
           const candidate = manager.getNextAvailableAccount(undefined, requestedProvider)
           if (candidate) {
               manager.switchToAccount(candidate.id)
               account = candidate
           }
        }

        if (!account) return

        // Skip akun yang sudah ditandai rate-limited di state
        {
          const accState = manager.getState().accountStates[account.id]
          if (accState?.status === "rate_limited" && accState.rateLimitUntil && isAccountRateLimited(account, accState.rateLimitUntil)) {
            const rotated = manager.handleRateLimit(account.id).nextAccount
            if (rotated) account = rotated
          }
        }

        // 🚨 AGGRESSIVE AUTOPILOT (Retry loop detection)
        const rescued = manager.trackRequestAndFix(requestedProvider || account.provider, account.id)
        if (rescued && rescued.id !== account.id) {
           await log("info", `🔄 Autopilot: Deteksi retry loop, memutar kunci ke ${rescued.name}`)
           account = rescued
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
      lastActivity = Date.now() // Reset activity timer on ANY event (Heartbeat)
      persistDebug("any.event", event, DEBUG_LAST_EVENT)
      persistEventType((event as any)?.type)
      persistHookInvoke("event", { type: (event as any)?.type, sessionID: (event as any)?.properties?.sessionID })
      
      const properties = (event as any)?.properties
      if (properties?.sessionID) lastSessionID = properties.sessionID
      
      // 🏥 Deterministic State Transition
      if (event?.type === "session.status") {
        const s = properties?.status
        persistDebug("session.status", event, DEBUG_LAST_STATUS)
        persistHistory(event, DEBUG_STATUS_HISTORY, 100)
        if (s?.type === "busy") currentState = PluginState.STREAMING
        if (s?.type === "idle") currentState = PluginState.IDLE
        debugLog(`🏥 State Transition: ${currentState} | Session: ${lastSessionID}`)
      }

      if (event?.type === "session.error") {
        persistDebug("session.error", event, DEBUG_LAST_ERROR)
        persistHistory(event, DEBUG_ERROR_HISTORY, 100)
      }

      await onPossibleError(event, "event")
    },

    tool: {
      account_status: tool({
        description: "Tampilkan status semua akun API (aktif, rate-limited, atau disabled).",
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
          return result.account ? `✅ Berhasil switch ke: ${result.account.name}` : "❌ Akun tidak ditemukan atau sedang disabled."
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
