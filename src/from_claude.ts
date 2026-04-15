// ============================================================
// OpenCode Multi-Account Manager Plugin — Entry Point
// ============================================================
//
// Plugin ini mengelola beberapa akun API untuk OpenCode dan
// secara otomatis berpindah ke akun berikutnya (berdasarkan
// priority) ketika rate limit tercapai.
//
// File konfigurasi akun: ~/.config/opencode/multi-account/accounts.json
// Runtime state:         ~/.config/opencode/multi-account/state.json
//
// Cara install:
//   Salin folder ini ke ~/.config/opencode/plugins/multi-account/
//   atau taruh di .opencode/plugins/multi-account/ di project Anda.
// ============================================================

import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { AccountManager } from "./account-manager"
import { isRateLimitError } from "./rate-limiter"
import { detectRateLimitFromEvent } from "./event-detection"
import { AUTH_JSON_CANDIDATES, CONFIG_FILE } from "./storage"
import type { Account, AuthType } from "./types"
import { resolveAccountEnv } from "./provider-credentials"

const DEBUG_DIR = path.join(os.homedir(), ".config", "opencode", "multi-account")
const DEBUG_LAST_ANY = path.join(DEBUG_DIR, "last-any-event.json")
const DEBUG_LAST_RATE = path.join(DEBUG_DIR, "last-rate-event.json")

const GLOBAL_PLUGIN_FLAG = "__opencode_multi_account_plugin_loaded__"

export const MultiAccountPlugin: Plugin = async ({ client }) => {
  const globalState = globalThis as typeof globalThis & Record<string, boolean | undefined>
  if (globalState[GLOBAL_PLUGIN_FLAG]) {
    await client.app.log({
      body: {
        service: "multi-account-plugin",
        level: "warn",
        message: "Plugin multi-account sudah aktif. Melewati inisialisasi duplikat.",
      },
    })
    return {}
  }
  globalState[GLOBAL_PLUGIN_FLAG] = true

  // Inisialisasi manager saat plugin di-load
  const manager = new AccountManager()

  // ─── Auto-sync: Watch auth.json untuk perubahan ───────────────────────
  let authWatchers: fs.FSWatcher[] = []
  for (const authPath of AUTH_JSON_CANDIDATES) {
    if (!fs.existsSync(authPath)) continue
    try {
      const dir = path.dirname(authPath)
      const watcher = fs.watch(dir, (eventType, filename) => {
        if (filename === "auth.json" || authPath.endsWith("auth.json")) {
          // Debounce: reload setelah ada perubahan
          setTimeout(() => {
            manager.reload()
            client.app.log({
              body: {
                service: "multi-account-plugin",
                level: "info",
                message: `🔄 auth.json berubah. Auto-sync ke accounts.json.`,
              },
            })
          }, 500)
        }
      })
      authWatchers.push(watcher)
    } catch {
      // Abaikan jika watch gagal
    }
  }

  // ─── Helper: log ke OpenCode ─────────────────────────────
  async function log(level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) {
    await client.app.log({
      body: {
        service: "multi-account-plugin",
        level,
        message,
        extra: extra ?? {},
      },
    })
  }

  function persistDebugEvent(label: string, payload: unknown, target: string = DEBUG_LAST_ANY) {
    try {
      const dir = path.dirname(target)
      fs.mkdirSync(dir, { recursive: true })
      const body = { label, timestamp: new Date().toISOString(), event: payload }
      fs.writeFileSync(target, JSON.stringify(body, null, 2), "utf8")
    } catch {
      // best-effort only
    }
  }

  function extractEventMessage(eventPayload: unknown): string {
    if (typeof eventPayload === "string") {
      return eventPayload
    }

    if (typeof eventPayload === "object" && eventPayload !== null) {
      const candidate = eventPayload as {
        error?: { message?: string }
        message?: string
        properties?: {
          status?: { message?: string }
          error?: { message?: string }
        }
      }

      const errorMessage = candidate.error?.message
      if (typeof errorMessage === "string" && errorMessage.length > 0) {
        return errorMessage
      }

      if (typeof candidate.message === "string" && candidate.message.length > 0) {
        return candidate.message
      }

      const statusMessage = candidate.properties?.status && typeof candidate.properties.status === "object"
        ? (candidate.properties.status as { message?: string }).message
        : undefined

      if (typeof statusMessage === "string" && statusMessage.length > 0) {
        return statusMessage
      }

      const propertiesErrorMessage = candidate.properties?.error?.message
      if (typeof propertiesErrorMessage === "string" && propertiesErrorMessage.length > 0) {
        return propertiesErrorMessage
      }
    }

    try {
      return JSON.stringify(eventPayload)
    } catch {
      return String(eventPayload)
    }
  }

  // ─── Logging startup ─────────────────────────────────────
  const currentAccount = manager.getCurrentAccount()
  if (currentAccount) {
    await log("info", `Plugin aktif. Menggunakan: [P${currentAccount.priority}] ${currentAccount.name} (${currentAccount.provider})`)
  } else {
    await log("warn", `Tidak ada akun tersedia. Tambahkan akun di: ${CONFIG_FILE}`)
  }

  // ─── Diagnostic: catat tipe event yang pernah masuk ──────────────────────
  // Berguna untuk debug apakah event hook aktif di web mode.
  // Setelah pakai opencode web, cek: ~/.config/opencode/multi-account/seen-event-types.json
  const DEBUG_EVENT_TYPES = path.join(DEBUG_DIR, "seen-event-types.json")
  const seenTypes: Set<string> = new Set<string>()
  try {
    if (fs.existsSync(DEBUG_EVENT_TYPES)) {
      const existing = JSON.parse(fs.readFileSync(DEBUG_EVENT_TYPES, "utf8")) as string[]
      existing.forEach((t) => seenTypes.add(t))
    }
  } catch { /* ignore */ }

  return {
    // ─── Inject API key aktif ke shell environment ──────────
    "shell.env": async (_input, output) => {
      // Refresh expired cooldowns setiap kali shell env di-inject
      manager.reload()
      const account = manager.getCurrentAccount()
      if (account) {
        const env = resolveAccountEnv(account)
        for (const [key, value] of Object.entries(env)) {
          output.env[key] = value
        }
        // Jika akun memiliki model override, set juga
        if (account.model) {
          output.env["OPENCODE_MODEL"] = account.model
        }
      }
    },

    // ─── Deteksi rate limit dari event error sesi ───────────
    event: async ({ event }) => {
      // Simpan semua event untuk debugging, agar pasti ada jejak
      persistDebugEvent("any-event", event, DEBUG_LAST_ANY)

      // Track tipe event yang pernah masuk (untuk debug web mode)
      const evtType = (event as { type?: string }).type ?? "unknown"
      if (!seenTypes.has(evtType)) {
        seenTypes.add(evtType)
        try {
          fs.mkdirSync(DEBUG_DIR, { recursive: true })
          fs.writeFileSync(DEBUG_EVENT_TYPES, JSON.stringify([...seenTypes], null, 2), "utf8")
        } catch { /* ignore */ }
      }

      // ── Ekstrak teks dari message.part.updated ─────────────────────────────
      // Ini adalah event server-side yang bekerja di TUI *dan* opencode web.
      // OpenCode meng-emit teks seperti "retrying in 2h 45m" lewat sini,
      // bukan lewat TUI toast, sehingga deteksi rate limit bisa bekerja di web.
      let partText: string | undefined
      if ((event as { type?: string }).type === "message.part.updated") {
        const props = (event as { properties?: unknown }).properties
        // Part bisa berupa text, error, atau step — coba semua field teks
        if (props && typeof props === "object") {
          const p = props as Record<string, unknown>
          // text content langsung
          if (typeof p["content"] === "string") partText = p["content"]
          // atau nested di dalam part.content
          const part = p["part"]
          if (part && typeof part === "object") {
            const partObj = part as Record<string, unknown>
            if (typeof partObj["content"] === "string") partText = partObj["content"]
            if (typeof partObj["text"] === "string") partText = partObj["text"]
          }
          // atau di field text langsung
          if (typeof p["text"] === "string") partText = p["text"]
        }
      }

      const extractedMessage = extractEventMessage(event)
      const eventMessage = [partText, extractedMessage]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join(" | ")
      const rateLimitDetected = detectRateLimitFromEvent(event, partText, extractedMessage)

      if (!rateLimitDetected) {
        // Jika ada indikasi "limit" tapi belum terdeteksi, simpan untuk debugging
        if (/limit|quota|retry/i.test(eventMessage)) {
          persistDebugEvent("unmatched-limit-event", event, DEBUG_LAST_RATE)
        }
        return
      }

      // Pastikan state paling baru sebelum memproses rate limit
      manager.reload()

      const currentId = manager.getCurrentAccountId()
      if (!currentId) return

      const current = manager.getCurrentAccount()
      const currentProvider = current?.provider ?? "<unknown>"
      const poolSummaryBefore = currentProvider && currentProvider !== "<unknown>"
        ? manager.describeProviderPool(currentProvider, currentId)
        : undefined
      await log("warn", `Rate limit terdeteksi pada akun: ${current?.name ?? currentId}`)

      const result = manager.handleRateLimit(currentId)
      const stateSummary = manager.getStatusSummary()
      const poolSummaryAfter = currentProvider && currentProvider !== "<unknown>"
        ? manager.describeProviderPool(currentProvider, result.nextAccount?.id ?? currentId)
        : undefined

      persistDebugEvent(
        "rate-limit-event",
        {
          event,
          extractedMessage: eventMessage,
          currentAccountId: currentId,
          currentProvider,
          result,
          poolSummaryBefore,
          poolSummaryAfter,
          stateSummary,
        },
        DEBUG_LAST_RATE,
      )

      const providerForLog = currentProvider === "<unknown>" ? undefined : currentProvider
      const poolSummary = providerForLog ? manager.describeProviderPool(providerForLog, currentId) : ""

      if (result.allExhausted) {
        // 🔴 Semua akun pada provider saat ini habis — tampilkan notifikasi dengan konteks provider
        await log(
          "error",
          `🚨 SEMUA AKUN PADA PROVIDER ${currentProvider} (${stateSummary}) TELAH MENCAPAI RATE LIMIT! Tidak ada akun cadangan yang tersedia. Pool detail:\n${poolSummary}`,
        )
        // Kirim toast notifikasi ke TUI
        await client.app.log({
          body: {
            service: "multi-account-plugin",
            level: "error",
            message:
              "🚨 Semua akun API telah rate-limited. Tunggu cooldown atau tambah akun baru.",
          },
        })
      } else if (result.switched && result.nextAccount) {
        // ✅ Berhasil switch ke akun berikutnya
        await log(
          "info",
          `✅ Auto-switch berhasil → [P${result.nextAccount.priority}] ${result.nextAccount.name} (${result.nextAccount.provider})`
        )
      } else {
        await log(
          "warn",
          `⚠️ Rate limit terdeteksi tetapi tidak ada switch yang terjadi. Pool detail untuk provider ${currentProvider}:\n${poolSummary}`,
        )
      }
    },

    // ─── Custom Tools untuk manajemen akun via TUI ──────────
    tool: {
      /** Lihat status semua akun */
      account_status: tool({
        description:
          "Tampilkan status semua akun API yang terdaftar di Multi-Account Manager plugin, termasuk akun mana yang sedang aktif, rate-limited, atau disabled.",
        args: {},
        async execute(_args, _ctx) {
          manager.reload()
          return manager.getStatusSummary()
        },
      }),

      /** List semua akun */
      account_list: tool({
        description: "Tampilkan daftar semua akun API yang terdaftar beserta prioritas dan provider-nya.",
        args: {},
        async execute(_args, _ctx) {
          manager.reload()
          const accounts = manager.getAllAccounts()
          if (accounts.length === 0) {
            return `Tidak ada akun terdaftar.\nEdit file: ${CONFIG_FILE}`
          }
          const lines = accounts.map(
            (a) =>
              `[P${a.priority}] id="${a.id}" | ${a.name} | Provider: ${a.provider} | Auth: ${a.credentials?.authType ?? "api_key"} | Env: ${Object.keys(resolveAccountEnv(a)).join(", ") || "-"}`
          )
          return `Daftar Akun (${accounts.length} akun):\n\n` + lines.join("\n")
        },
      }),

      /** Switch manual ke akun tertentu */
      account_switch: tool({
        description: "Ganti akun yang sedang aktif ke akun lain berdasarkan ID akun.",
        args: {
          account_id: tool.schema.string(),
        },
        async execute(args, _ctx) {
          manager.reload()
          const result = manager.switchToAccount(args.account_id)
          if (!result.account) {
            if (result.reason === "disabled") {
              return `❌ Akun "${args.account_id}" sedang disabled dan tidak bisa diaktifkan.`
            }
            if (result.reason === "rate_limited") {
              return `❌ Akun "${args.account_id}" masih dalam cooldown rate limit.`
            }
            return `❌ Akun dengan ID "${args.account_id}" tidak ditemukan.`
          }
          return `✅ Berhasil switch ke: [P${result.account.priority}] ${result.account.name} (${result.account.provider})`
        },
      }),

      /** Tambah akun baru */
      account_add: tool({
        description: "Tambah akun API baru ke Multi-Account Manager.",
        args: {
          id: tool.schema.string(),
          name: tool.schema.string(),
          provider: tool.schema.string(),
          authType: tool.schema.string().optional(),
          apiKey: tool.schema.string().optional(),
          envVarName: tool.schema.string().optional(),
          envJson: tool.schema.string().optional(),
          providerConfigJson: tool.schema.string().optional(),
          priority: tool.schema.number(),
          cooldownMinutes: tool.schema.number().optional(),
          model: tool.schema.string().optional()
        },
        async execute(args, _ctx) {
          manager.reload()

          const env: Record<string, string> = {}
          if (args.envJson) {
            try {
              const parsed = JSON.parse(args.envJson) as Record<string, string>
              for (const [key, value] of Object.entries(parsed)) {
                if (typeof value === "string") env[key] = value
              }
            } catch {
              return "❌ envJson tidak valid. Gunakan JSON object string, contoh: {\"OPENAI_API_KEY\":\"sk-...\"}"
            }
          }
          if (args.apiKey && args.envVarName) {
            env[args.envVarName] = args.apiKey
          }
          if (Object.keys(env).length === 0) {
            return "❌ Credential kosong. Isi apiKey+envVarName atau envJson."
          }

          let providerConfig: Record<string, string> | undefined
          if (args.providerConfigJson) {
            try {
              const parsed = JSON.parse(args.providerConfigJson) as Record<string, string>
              providerConfig = {}
              for (const [key, value] of Object.entries(parsed)) {
                if (typeof value === "string") providerConfig[key] = value
              }
            } catch {
              return "❌ providerConfigJson tidak valid. Gunakan JSON object string."
            }
          }

          const account: Account = {
            id: args.id,
            name: args.name,
            provider: args.provider,
            priority: args.priority,
            cooldownMinutes: args.cooldownMinutes,
            model: args.model,
            credentials: {
              authType: (args.authType as AuthType | undefined) ?? "api_key",
              env,
              providerConfig,
            },
          }

          const result = manager.addAccount(account)
          return result.success ? `✅ ${result.message}` : `❌ ${result.message}`
        },
      }),

      /** Update akun */
      account_update: tool({
        description: "Perbarui informasi akun yang sudah ada berdasarkan ID.",
        args: {
          account_id: tool.schema.string(),
          name: tool.schema.string().optional(),
          provider: tool.schema.string().optional(),
          authType: tool.schema.string().optional(),
          apiKey: tool.schema.string().optional(),
          envVarName: tool.schema.string().optional(),
          envJson: tool.schema.string().optional(),
          providerConfigJson: tool.schema.string().optional(),
          priority: tool.schema.number().optional(),
          cooldownMinutes: tool.schema.number().optional(),
          model: tool.schema.string().optional()
        },
        async execute(args, _ctx) {
          manager.reload()
          const updates: Partial<Omit<Account, "id">> = {}
          if (args.name !== undefined) updates.name = args.name
          if (args.provider !== undefined) updates.provider = args.provider
          if (args.priority !== undefined) updates.priority = args.priority
          if (args.cooldownMinutes !== undefined) updates.cooldownMinutes = args.cooldownMinutes
          if (args.model !== undefined) updates.model = args.model

          let envPatch: Record<string, string> | undefined
          if (args.envJson) {
            try {
              const parsed = JSON.parse(args.envJson) as Record<string, string>
              envPatch = {}
              for (const [key, value] of Object.entries(parsed)) {
                if (typeof value === "string") envPatch[key] = value
              }
            } catch {
              return "❌ envJson tidak valid. Gunakan JSON object string."
            }
          }

          let providerConfigPatch: Record<string, string> | undefined
          if (args.providerConfigJson) {
            try {
              const parsed = JSON.parse(args.providerConfigJson) as Record<string, string>
              providerConfigPatch = {}
              for (const [key, value] of Object.entries(parsed)) {
                if (typeof value === "string") providerConfigPatch[key] = value
              }
            } catch {
              return "❌ providerConfigJson tidak valid. Gunakan JSON object string."
            }
          }

          if (
            args.authType !== undefined ||
            args.apiKey !== undefined ||
            args.envVarName !== undefined ||
            envPatch !== undefined ||
            providerConfigPatch !== undefined
          ) {
            const current = manager.getAllAccounts().find((acc) => acc.id === args.account_id)
            if (!current) {
              return `❌ Akun dengan ID "${args.account_id}" tidak ditemukan.`
            }

            const nextCredentials = {
              authType: (args.authType as AuthType | undefined) ?? current.credentials?.authType ?? "api_key",
              env: { ...(current.credentials?.env ?? resolveAccountEnv(current)) },
              providerConfig: { ...(current.credentials?.providerConfig ?? {}) },
            }

            if (args.apiKey !== undefined && args.envVarName !== undefined) {
              nextCredentials.env[args.envVarName] = args.apiKey
            }
            if (envPatch) {
              nextCredentials.env = envPatch
            }
            if (providerConfigPatch) {
              nextCredentials.providerConfig = providerConfigPatch
            }

            updates.credentials = nextCredentials
          }

          if (Object.keys(updates).length === 0) return "⚠️ Tidak ada data yang diperbarui."

          const result = manager.updateAccount(args.account_id, updates)
          return result.success ? `✅ ${result.message}` : `❌ ${result.message}`
        },
      }),

      /** Hapus akun */
      account_remove: tool({
        description: "Hapus akun dari Multi-Account Manager berdasarkan ID.",
        args: {
          account_id: tool.schema.string(),
        },
        async execute(args, _ctx) {
          manager.reload()
          const result = manager.removeAccount(args.account_id)
          return result.success ? `✅ ${result.message}` : `❌ ${result.message}`
        },
      }),

      /** Info file konfigurasi */
      account_config_path: tool({
        description: "Tampilkan path file konfigurasi akun jika ingin mengedit manual.",
        args: {},
        async execute(_args, _ctx) {
          return (
            `📁 File konfigurasi Multi-Account Plugin:\n\n` +
            `  ${CONFIG_FILE}\n\n` +
            `Edit file tersebut untuk konfigurasi manual, atau gunakan tool account_add / account_update / account_remove.`
          )
        },
      }),
    },
  }
}
