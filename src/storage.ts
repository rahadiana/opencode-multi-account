// ============================================================
// Storage — Persistensi konfigurasi & state ke disk
// ============================================================

import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import type { AuthJsonMap, PluginConfig, RuntimeState } from "./types"
import { createDefaultConfig } from "./types"
import { migrateConfig } from "./config-schema"

// Lokasi file konfigurasi akun di ~/.config/opencode/multi-account/
const CONFIG_DIR = path.join(os.homedir(), ".config", "opencode", "multi-account")
export const CONFIG_FILE = path.join(CONFIG_DIR, "accounts.json")
export const STATE_FILE = path.join(CONFIG_DIR, "state.json")

/** Kandidat lokasi auth.json lintas platform */
export const AUTH_JSON_CANDIDATES: string[] = (() => {
  const candidates = [
    path.join(os.homedir(), ".local", "share", "opencode", "auth.json"),
    path.join(os.homedir(), ".config", "opencode", "auth.json"),
    path.join(process.cwd(), "auth.json"),
  ]

  const appData = process.env.APPDATA
  const localAppData = process.env.LOCALAPPDATA

  if (appData) candidates.push(path.join(appData, "opencode", "auth.json"))
  if (localAppData) candidates.push(path.join(localAppData, "opencode", "auth.json"))

  // Filter out duplicates while preserving order
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    if (seen.has(candidate)) return false
    seen.add(candidate)
    return true
  })
})()

/** Buat direktori jika belum ada */
function ensureDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

/** Baca konfigurasi akun dari disk */
export function loadConfig(): PluginConfig {
  ensureDir()

  if (!fs.existsSync(CONFIG_FILE)) {
    // Buat file contoh jika belum ada
    const defaultConfig: PluginConfig = createDefaultConfig()
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), "utf8")
    return defaultConfig
  }

  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8")
    const parsed = JSON.parse(raw) as unknown
    const migrated = migrateConfig(parsed)

    if (migrated.changed) {
      saveConfig(migrated.config)
    }

    return migrated.config
  } catch {
    throw new Error(`[multi-account] Gagal membaca ${CONFIG_FILE}. Pastikan format JSON valid.`)
  }
}

/** Baca runtime state dari disk */
export function loadState(): RuntimeState {
  ensureDir()

  if (!fs.existsSync(STATE_FILE)) {
    return {
      currentAccountId: null,
      accountStates: {},
      lastUpdated: new Date().toISOString(),
    }
  }

  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8")
    return JSON.parse(raw) as RuntimeState
  } catch {
    // State korup, reset
    return {
      currentAccountId: null,
      accountStates: {},
      lastUpdated: new Date().toISOString(),
    }
  }
}

/** Simpan runtime state ke disk */
export function saveState(state: RuntimeState): void {
  ensureDir()
  state.lastUpdated = new Date().toISOString()
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8")
}

/** Simpan konfigurasi akun ke disk (untuk CRUD dari TUI/Web) */
export function saveConfig(config: PluginConfig): void {
  ensureDir()
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8")
}

/** Ambil path auth.json yang aktif */
export function getActiveAuthJsonPath(): string | null {
  for (const authFile of AUTH_JSON_CANDIDATES) {
    if (fs.existsSync(authFile)) return authFile
  }
  return null
}

/** Baca dan parse ~/.local/share/opencode/auth.json jika ada */
export function loadAuthJson(): AuthJsonMap | null {
  const activePath = getActiveAuthJsonPath()
  if (!activePath) return null

  try {
    const raw = fs.readFileSync(activePath, "utf8")
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null
    return parsed as AuthJsonMap
  } catch {
    return null
  }
}

/** Update auth.json file agar OpenCode NATIVE proxy langsung sinkron */
export function overwriteAuthJsonProvider(provider: string, rawEntry: unknown): void {
  const activePath = getActiveAuthJsonPath()
  if (!activePath || !rawEntry) return

  try {
    const raw = fs.readFileSync(activePath, "utf8")
    const parsed = JSON.parse(raw) as AuthJsonMap
    if (typeof parsed === "object" && parsed !== null) {
      // 🚨 PERFECT FORMAT FIX: Web UI butuh objek { type, access }, bukan string plain.
      if (typeof rawEntry === "string") {
        parsed[provider] = {
          type: "api_key",
          access: rawEntry
        } as any
      } else {
        parsed[provider] = rawEntry as any
      }
      
      fs.writeFileSync(activePath, JSON.stringify(parsed, null, 2), "utf8")
    }
  } catch {
    // Abaikan jika gagal
  }
}
