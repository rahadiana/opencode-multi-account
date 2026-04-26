// ============================================================
// Account Manager — Logika rotasi & manajemen akun
// ============================================================

import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import type { Account, AccountStatus, PluginConfig, RuntimeState } from "./types.js"
import { loadConfig, loadState, saveState, saveConfig, loadAuthJson, overwriteAuthJsonProvider, getActiveAuthJsonPath } from "./storage.js"
import { normalizeAccount, validateAccountCredentials } from "./provider-credentials.js"
import { createDefaultConfig } from "./types.js"
import {
  buildAutoAccountFromAuthEntry,
  dedupeRawEntries,
  normalizeAuthProviderEntries,
  stableEntryFingerprint,
} from "./auth-schema.js"
import {
  isAccountRateLimited,
  calcRateLimitExpiry,
  formatCooldownRemaining,
} from "./rate-limiter.js"
import { buildAuthJsonEntry } from "./auth-json.js"

export class AccountManager {
  // In-memory provider-scoped pools derived from config/accounts
  private providerPools: Record<string, Account[]> = {}
  private config: PluginConfig = createDefaultConfig()
  private state: RuntimeState = {
    currentAccountId: null,
    accountStates: {},
    lastUpdated: new Date().toISOString(),
  }

  // Tracking untuk deteksi "Rapid Retry" (Heuristic Rate Limit Detection)
  private lastRequestMetadata = new Map<string, { time: number; id: string }>()

  /** 
   * Melacak frekuensi request secara agresif. Jika akun yang sama dipanggil kembali 
   * dalam jendela waktu 120 detik, kita asumsikan request sebelumnya GAGAL (karena limit).
   * Ini adalah kunci penyelamatan utama untuk Web UI.
   */
  trackRequestAndFix(provider: string, accountId: string): Account | null {
    const now = Date.now()
    const key = `global:${provider}:${accountId}`
    const last = this.lastRequestMetadata.get(key)
    this.lastRequestMetadata.set(key, { time: now, id: accountId })

    // Jika kita melihat request yang SAMA dalam 120 detik, 
    // kita asumsikan ini adalah retry otomatis dari Web UI karena kegagalan.
    if (last && (now - last.time) < 120000) {
      // 🚨 DETEKSI KEGAGALAN (RETURNING REQUEST): Paksa rotasi fisik sekarang juga!
      const result = this.handleRateLimit(accountId)
      return result.nextAccount
    }
    
    return this._findAccountById(accountId)
  }

  public getState(): RuntimeState {
    return this.state
  }

  /** Build in-memory provider-scoped pools from current accounts OR providerAccounts */
  private _buildProviderPools(): void {
    const pools: Record<string, Account[]> = {}

    if (this.config.providerAccounts) {
      for (const [provider, rawList] of Object.entries(this.config.providerAccounts)) {
        const providerEntries: Account[] = []
        const list = normalizeAuthProviderEntries(rawList)
        for (let idx = 0; idx < list.length; idx++) {
          const raw = list[idx]
          const synthetic = buildAutoAccountFromAuthEntry(provider, raw)
          if (!synthetic) continue

          synthetic.id = `${provider}::${idx + 1}`
          synthetic.name = `OpenCode ${provider} Entry ${idx + 1}`
          synthetic.priority = idx + 1
          synthetic.rawEntry = raw
          providerEntries.push(synthetic)
        }
        pools[provider] = providerEntries
      }
    }

    for (const acc of this.config.accounts) {
      const list = pools[acc.provider] ?? []
      list.push(acc)
      pools[acc.provider] = list
    }

    for (const prov of Object.keys(pools)) {
      pools[prov].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        return a.id.localeCompare(b.id)
      })
    }

    this.providerPools = pools
  }

  constructor() {
    this.reload()
  }

  private _parseProviderScopedId(accountId: string): { provider: string; index: number } | null {
    const [provider, rawIndex] = accountId.split("::")
    if (!provider || !rawIndex) return null
    const index = Number(rawIndex)
    if (!Number.isInteger(index) || index <= 0) return null
    return { provider, index }
  }

  private _findAccountById(accountId: string): Account | null {
    for (const pool of Object.values(this.providerPools)) {
      const found = pool.find((acc) => acc.id === accountId)
      if (found) return found
    }
    return this.config.accounts.find((acc) => acc.id === accountId) ?? null
  }

  private _pickFirstAvailableFromPool(pool: Account[], excludeId?: string, startAfterId?: string): Account | null {
    const startIndex = startAfterId ? pool.findIndex((acc) => acc.id === startAfterId) + 1 : 0
    const begin = Math.max(0, startIndex)

    for (let count = 0; count < pool.length; count += 1) {
      const i = (begin + count) % pool.length
      const candidate = pool[i]
      if (candidate.id === excludeId) continue

      const accState = this.state.accountStates[candidate.id]
      const validation = validateAccountCredentials(candidate)
      if (!validation.valid) continue
      if (!accState) return candidate
      if (accState.status === "disabled") continue
      if (!isAccountRateLimited(candidate, accState.rateLimitUntil)) return candidate
    }

    return null
  }

  /** Jelaskan status semua akun dalam pool provider (untuk debugging rotasi) */
  describeProviderPool(provider: string, excludeId?: string, startAfterId?: string): string {
    const pool = this.providerPools[provider] ?? []
    if (pool.length === 0) return `Pool kosong untuk provider ${provider}`

    const lines: string[] = []
    const startIndex = startAfterId ? pool.findIndex((acc) => acc.id === startAfterId) + 1 : 0
    const begin = Math.max(0, startIndex)

    for (let i = 0; i < pool.length; i += 1) {
      const acc = pool[i]
      const accState = this.state.accountStates[acc.id]
      const validation = validateAccountCredentials(acc)
      const rateLimited = accState?.status === "rate_limited" && isAccountRateLimited(acc, accState.rateLimitUntil)
      const disabled = accState?.status === "disabled"
      const skippedByPosition = i < begin
      const skippedByExclude = excludeId && acc.id === excludeId

      const reasons: string[] = []
      if (!validation.valid) reasons.push(`invalid_credentials: ${validation.reason ?? "unknown"}`)
      if (rateLimited) reasons.push(`rate_limited${accState?.rateLimitUntil ? ` until ${accState.rateLimitUntil}` : ""}`)
      if (disabled) reasons.push("disabled")
      if (skippedByPosition) reasons.push("before-current")
      if (skippedByExclude) reasons.push("excludeId")

      const eligible = reasons.length === 0 ? "eligible" : reasons.join("; ")
      const marker = this.state.currentAccountId === acc.id ? "(current)" : ""
      lines.push(`[P${acc.priority}] ${acc.id} ${marker} :: ${eligible}`)
    }

    return lines.join("\n")
  }

  private _buildAccountMarkersSnapshot(
    previous?: NonNullable<PluginConfig["accountMarkers"]>,
  ): NonNullable<PluginConfig["accountMarkers"]> | undefined {
    const now = new Date().toISOString()
    const accounts = this.getAllAccounts()
    if (accounts.length === 0) return undefined

    const markers: NonNullable<PluginConfig["accountMarkers"]> = {}

    for (const account of accounts) {
      const runtime = this.state.accountStates[account.id]
      const validation = validateAccountCredentials(account)
      const status: AccountStatus = !validation.valid
        ? "invalid"
        : runtime?.status === "rate_limited" || runtime?.status === "disabled"
          ? runtime.status
          : "active"
      const rateLimitUntil = status === "rate_limited" ? runtime?.rateLimitUntil : undefined
      const prev = previous?.[account.id]
      const unchanged =
        prev && prev.status === status && (prev.rateLimitUntil ?? undefined) === (rateLimitUntil ?? undefined)

      const marker = {
        status,
        rateLimitUntil,
        updatedAt: unchanged ? prev.updatedAt : now,
      }

      markers[account.id] = marker
    }

    return Object.keys(markers).length > 0 ? markers : undefined
  }

  private _syncAccountMarkersToConfig(): void {
    this._resetExpiredRateLimits()

    const latestConfig = loadConfig()
    const prevMarkers = latestConfig.accountMarkers
    const nextMarkers = this._buildAccountMarkersSnapshot(prevMarkers)

    const prevFingerprint = JSON.stringify(prevMarkers ?? {})
    const nextFingerprint = JSON.stringify(nextMarkers ?? {})
    if (prevFingerprint === nextFingerprint) return

    latestConfig.accountMarkers = nextMarkers
    this.config.accountMarkers = nextMarkers
    saveConfig(latestConfig)
  }

  /** Reload config & state dari disk (berguna setelah user edit accounts.json atau auth update) */
  private _createDefaultAccountsJsonIfMissing(): void {
    const defaultFilePath = path.resolve(os.homedir(), ".config", "opencode", "multi-account", "accounts.json")

    // Cek apakah file sudah ada
    if (!fs.existsSync(defaultFilePath)) {
      const defaultConfig = createDefaultConfig()

      // Buat direktori dan file default
      fs.mkdirSync(path.dirname(defaultFilePath), { recursive: true })
      fs.writeFileSync(defaultFilePath, JSON.stringify(defaultConfig, null, 2), "utf8")

      try {
        fs.chmodSync(defaultFilePath, 0o600)
      } catch {
        // best effort only; Windows may not support POSIX chmod semantics fully
      }
    }
  }

  reload(): void {
    this._createDefaultAccountsJsonIfMissing()
    this.config = loadConfig()
    this._mergeAuthJson()
    this._buildProviderPools()
    this.state = loadState()
    this._reconcileStateWithConfig()
    this._resetExpiredRateLimits()
    this._ensureCurrentAccount()
    this._syncAccountMarkersToConfig()
  }

  private _reconcileStateWithConfig(): void {
    // Build a set of valid IDs from provider-synthesized accounts if available, else legacy accounts
    const validIds = new Set<string>()
    if (Object.keys(this.providerPools).length > 0) {
      for (const prov of Object.keys(this.providerPools)) {
        for (const acc of this.providerPools[prov]) validIds.add(acc.id)
      }
    } else {
      for (const account of this.config.accounts) validIds.add(account.id)
    }
    let changed = false

    for (const stateId of Object.keys(this.state.accountStates)) {
      if (!validIds.has(stateId)) {
        delete this.state.accountStates[stateId]
        changed = true
      }
    }

    if (this.state.currentAccountId && !validIds.has(this.state.currentAccountId)) {
      this.state.currentAccountId = null
      changed = true
    }

    if (changed) {
      saveState(this.state)
    }
  }

  /** Merge akun-akun bawaan OpenCode GUI ke dalam sistem ini agar bisa ikut dirotasi
   * Migration path now targets providerAccounts as primary storage.
   */
  private _mergeAuthJson(): void {
    const authData = loadAuthJson()
    if (!authData) return

    const provMap: Record<string, unknown[]> = { ...(this.config.providerAccounts ?? {}) }
    const nextSynced = new Set<string>()
    let changed = false

    // Process all providers from auth.json in APPEND mode
    for (const [provider, value] of Object.entries(authData)) {
      nextSynced.add(provider)
      const newFromAuth = normalizeAuthProviderEntries(value)
      const incomingDeduped = dedupeRawEntries(newFromAuth)
      const incomingEntries = normalizeAuthProviderEntries(incomingDeduped.entries)

      if (incomingEntries.length === 0) continue

      const currentNormalized = normalizeAuthProviderEntries(provMap[provider])
      const currentDeduped = dedupeRawEntries(currentNormalized)
      const currentEntries = normalizeAuthProviderEntries(currentDeduped.entries)

      const mergedDeduped = dedupeRawEntries([...currentEntries, ...incomingEntries])
      const mergedEntries = normalizeAuthProviderEntries(mergedDeduped.entries)

      const beforeFingerprint = currentEntries.map((entry) => stableEntryFingerprint(entry)).join("|")
      const afterFingerprint = mergedEntries.map((entry) => stableEntryFingerprint(entry)).join("|")

      if (beforeFingerprint !== afterFingerprint || incomingDeduped.changed || currentDeduped.changed) {
        changed = true
      }

      provMap[provider] = mergedEntries
    }

    const nextSyncedList = Array.from(nextSynced).sort((a, b) => a.localeCompare(b))
    const prevSyncedList = [...(this.config.authSyncProviders ?? [])].sort((a, b) => a.localeCompare(b))
    if (nextSyncedList.join("|") !== prevSyncedList.join("|")) {
      changed = true
    }

    if (changed) {
      const finalProviders: Record<string, unknown[]> = {}
      for (const [prov, entries] of Object.entries(provMap)) {
        if (entries.length > 0) {
          finalProviders[prov] = entries
        }
      }
      this.config.providerAccounts = Object.keys(finalProviders).length > 0 ? finalProviders : undefined
      this.config.authSyncProviders = nextSyncedList.length > 0 ? nextSyncedList : undefined
      saveConfig(this.config)
    }
  }

  /** Ambil semua akun (synthesized providerAccounts if present) */
  getAllAccounts(): Account[] {
    const accs: Account[] = []
    for (const prov of Object.keys(this.providerPools)) accs.push(...this.providerPools[prov])
    return accs.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.id.localeCompare(b.id)
    })
  }

  /** Ambil akun yang sedang aktif (synthesized or legacy) */
  getCurrentAccount(): Account | null {
    if (!this.state.currentAccountId) return null
    return this._findAccountById(this.state.currentAccountId)
  }

  /** Ambil ID akun yang sedang aktif */
  getCurrentAccountId(): string | null {
    return this.state.currentAccountId
  }

  /** Ambil akun berikutnya yang tidak sedang rate-limited */
  getNextAvailableAccount(excludeId?: string, providerScope?: string): Account | null {
    if (providerScope) {
      const pool = this.providerPools[providerScope] ?? []
      return this._pickFirstAvailableFromPool(pool, excludeId)
    }

    const current = this.getCurrentAccount()
    if (current) {
      const pool = this.providerPools[current.provider] ?? []
      const candidate = this._pickFirstAvailableFromPool(pool, excludeId, current.id)
      if (candidate) return candidate
    }

    const providers = Object.keys(this.providerPools).sort((a, b) => a.localeCompare(b))
    for (const provider of providers) {
      if (current && provider === current.provider) continue
      const pool = this.providerPools[provider] ?? []
      const candidate = this._pickFirstAvailableFromPool(pool, excludeId)
      if (candidate) return candidate
    }

    return null
  }

  /** Cek apakah semua akun sedang rate-limited atau disabled */
  areAllAccountsExhausted(): boolean {
    const available = this.getNextAvailableAccount()
    return available === null
  }

  /**
   * Tandai akun sebagai rate-limited dan switch ke akun berikutnya.
   * Return { switched: boolean, nextAccount: Account | null, allExhausted: boolean }
   */
  handleRateLimit(accountId: string): {
    switched: boolean
    nextAccount: Account | null
    allExhausted: boolean
  } {
    // Log kegagalan
    const account = this._findAccountById(accountId)
    // Tandai akun saat ini sebagai rate-limited
    const expiry = account
      ? calcRateLimitExpiry(account, this.config.defaultCooldownMinutes)
      : (() => {
          const fallbackExpiry = new Date()
          fallbackExpiry.setMinutes(
            fallbackExpiry.getMinutes() + this.config.defaultCooldownMinutes
          )
          return fallbackExpiry.toISOString()
        })()

    this.state.accountStates[accountId] = {
      status: "rate_limited",
      rateLimitUntil: expiry,
    }

    const providerScope = account?.provider
    const next = providerScope
      ? this.getNextAvailableAccount(accountId, providerScope)
      : this.getNextAvailableAccount(accountId)

    if (next) {
      this.state.currentAccountId = next.id
      this.state.accountStates[next.id] = {
        status: "active",
      }
      
      // ─── OVERWRITE NATIVE AUTH JSON ───
      if (next.provider) {
        const preferred = next.rawEntry ?? buildAuthJsonEntry(next)
        if (preferred) {
          overwriteAuthJsonProvider(next.provider, preferred)
        }
      }

      saveState(this.state)
      this._syncAccountMarkersToConfig()
      return { switched: true, nextAccount: next, allExhausted: false }
    } else {
      // Semua akun habis
      this.state.currentAccountId = null
      saveState(this.state)
      this._syncAccountMarkersToConfig()
      return { switched: false, nextAccount: null, allExhausted: true }
    }
  }

  /** Switch manual ke akun berdasarkan ID */
  switchToAccount(accountId: string): {
    account: Account | null
    reason?: "not_found" | "disabled" | "rate_limited" | "invalid"
  } {
    const account = this._findAccountById(accountId)
    if (!account) return { account: null, reason: "not_found" }

    const validation = validateAccountCredentials(account)
    if (!validation.valid) return { account: null, reason: "invalid" }

    const accState = this.state.accountStates[accountId]
    if (accState?.status === "disabled") {
      return { account: null, reason: "disabled" }
    }

    if (
      accState?.status === "rate_limited" &&
      accState.rateLimitUntil &&
      isAccountRateLimited(account, accState.rateLimitUntil)
    ) {
      return { account: null, reason: "rate_limited" }
    }

    this.state.currentAccountId = accountId
    this.state.accountStates[accountId] = { status: "active" }
    const preferred = account.rawEntry ?? buildAuthJsonEntry(account)
    if (preferred) {
      overwriteAuthJsonProvider(account.provider, preferred)
    }
    saveState(this.state)
    this._syncAccountMarkersToConfig()
    return { account }
  }

  /** Tambah akun baru */
  addAccount(account: Account): { success: boolean; message: string } {
    // Cek duplikat ID
    if (this.config.accounts.find((a) => a.id === account.id)) {
      return { success: false, message: `Akun dengan ID "${account.id}" sudah ada.` }
    }
    const normalized = normalizeAccount(account).account
    const validation = validateAccountCredentials(normalized)
    if (!validation.valid) {
      return { success: false, message: validation.reason ?? "Credential akun tidak valid." }
    }

    this.config.accounts.push(normalized)
    saveConfig(this.config)
    this._buildProviderPools()
    // Jika belum ada akun aktif, set yang baru sebagai aktif
    this._ensureCurrentAccount()
    this._syncAccountMarkersToConfig()
    return { success: true, message: `Akun "${account.name}" berhasil ditambahkan dengan priority P${account.priority}.` }
  }

  /** Hapus akun berdasarkan ID (providerAccounts supported in next phase) */
  removeAccount(accountId: string): { success: boolean; message: string } {
    const scoped = this._parseProviderScopedId(accountId)
    if (scoped && this.config.providerAccounts?.[scoped.provider]) {
      const list = normalizeAuthProviderEntries(this.config.providerAccounts[scoped.provider])
      if (scoped.index <= list.length) {
        list.splice(scoped.index - 1, 1)
        this.config.providerAccounts[scoped.provider] = list
        if (list.length === 0) {
          delete this.config.providerAccounts[scoped.provider]
        }
        if (this.config.providerAccounts && Object.keys(this.config.providerAccounts).length === 0) {
          this.config.providerAccounts = undefined
        }
        delete this.state.accountStates[accountId]
        if (this.state.currentAccountId === accountId) {
          this.state.currentAccountId = null
        }
        this._buildProviderPools()
        this._ensureCurrentAccount()
        saveConfig(this.config)
        saveState(this.state)
        this._syncAccountMarkersToConfig()
        return { success: true, message: `Akun scoped "${accountId}" berhasil dihapus.` }
      }
    }

    const idx = this.config.accounts.findIndex((a) => a.id === accountId)
    if (idx !== -1) {
      const removed = this.config.accounts.splice(idx, 1)[0]
      delete this.state.accountStates[accountId]
      if (this.state.currentAccountId === accountId) {
        this.state.currentAccountId = null
        this._ensureCurrentAccount()
      }
      saveConfig(this.config)
      saveState(this.state)
      this._syncAccountMarkersToConfig()
      return { success: true, message: `Akun "${removed.name}" (${removed.provider}) berhasil dihapus.` }
    }

    return { success: false, message: `Akun dengan ID "${accountId}" tidak ditemukan.` }
  }

  /** Update akun — partial update berdasarkan ID */
  updateAccount(accountId: string, updates: Partial<Omit<Account, "id">>): { success: boolean; message: string } {
    if (this._parseProviderScopedId(accountId)) {
      return {
        success: false,
        message:
          "Akun dari auth/providerAccounts tidak dapat diupdate langsung. Ubah sumber auth.json atau gunakan akun manual (legacy accounts).",
      }
    }

    const account = this.config.accounts.find((a) => a.id === accountId)
    if (!account) {
      return { success: false, message: `Akun dengan ID "${accountId}" tidak ditemukan.` }
    }
    const snapshot = JSON.stringify(account)
    Object.assign(account, updates)

    const normalized = normalizeAccount(account).account
    const validation = validateAccountCredentials(normalized)
    if (!validation.valid) {
      Object.assign(account, JSON.parse(snapshot) as Account)
      return { success: false, message: validation.reason ?? "Credential akun tidak valid." }
    }

    saveConfig(this.config)
    this._buildProviderPools()
    return { success: true, message: `Akun "${account.name}" berhasil diperbarui.` }
  }

  /** Reset rate limit untuk akun yang sudah melewati cooldown */
  private _resetExpiredRateLimits(): void {
    let changed = false
    for (const [id, accState] of Object.entries(this.state.accountStates)) {
      if (
        accState.status === "rate_limited" &&
        accState.rateLimitUntil &&
        new Date() >= new Date(accState.rateLimitUntil)
      ) {
        this.state.accountStates[id] = { status: "active" }
        changed = true
      }
    }
    if (changed) saveState(this.state)
  }

  /** Pastikan ada akun aktif saat startup */
  private _ensureCurrentAccount(): void {
    if (!this.state.currentAccountId || !this._findAccountById(this.state.currentAccountId)) {
      const first = this.getNextAvailableAccount()
      if (first) {
        this.state.currentAccountId = first.id
        this.state.accountStates[first.id] = { status: "active" }
        const preferred = first.rawEntry ?? buildAuthJsonEntry(first)
        if (preferred) overwriteAuthJsonProvider(first.provider, preferred)
        saveState(this.state)
      }
    }
  }

  /** Ambil ringkasan status semua akun */
  getStatusSummary(): string {
    const accounts = this.getAllAccounts()
    if (accounts.length === 0) {
      return "⚠️  Tidak ada akun terdaftar. Edit: ~/.config/opencode/multi-account/accounts.json"
    }

    const lines: string[] = ["📋 Status Multi-Account Manager\n"]
    for (const account of accounts) {
      const accState = this.state.accountStates[account.id]
      const validation = validateAccountCredentials(account)
      const current = this.state.currentAccountId === account.id
      let statusIcon = "✅"
      let statusText = "aktif"

      if (!validation.valid) {
        statusIcon = "❌"
        statusText = `invalid credentials (${validation.reason ?? "cek konfigurasi akun"})`
      } else if (accState?.status === "rate_limited" && accState.rateLimitUntil) {
        if (isAccountRateLimited(account, accState.rateLimitUntil)) {
          statusIcon = "⏳"
          statusText = `rate-limited (${formatCooldownRemaining(accState.rateLimitUntil)})`
        } else {
          statusIcon = "✅"
          statusText = "aktif (cooldown selesai)"
        }
      } else if (accState?.status === "disabled") {
        statusIcon = "🚫"
        statusText = "disabled"
      }

      const currentMarker = current ? " ← AKTIF SEKARANG" : ""
      lines.push(
        `${statusIcon} [P${account.priority}] ${account.name} (${account.provider})${currentMarker}\n   Status: ${statusText}`
      )
    }
    return lines.join("\n")
  }

  /** Mencari akun berdasarkan provider dan secret (apiKey/accessToken) */
  private _findAccountBySecret(provider: string, secret: string): Account | null {
    const pool = this.providerPools[provider] ?? []
    for (const acc of pool) {
      if (!acc.rawEntry) continue
      const logicalToken = (acc.rawEntry as any)?.access || (acc.rawEntry as any)?.apiKey
      if (logicalToken === secret) return acc
    }
    return null
  }

  private lastAuthMtime: number = 0
  private lastStateUpdated: string = ""

  /**
   * Universal Sync (Polite Smart Sync): Memastikan auth.json sehat tanpa memaksakan kehendak.
   * Hanya akan menimpa auth.json jika kunci yang sedang digunakan terdeteksi RATE LIMIT.
   */
  universalSyncAuthJson(): { synced: boolean; providers: string[] } {
    const activePath = getActiveAuthJsonPath()
    if (!activePath) return { synced: false, providers: [] }

    try {
      const stat = fs.statSync(activePath)
      const mtime = stat.mtimeMs
      
      this.reload()
      const authData = loadAuthJson()
      if (!authData) return { synced: false, providers: [] }

      const syncedProviders: string[] = []
      let anyStateChanged = false

      for (const provider of Object.keys(authData)) {
        const pool = this.providerPools[provider]
        if (!pool || pool.length === 0) continue

        const physicalEntry = authData[provider] as any
        const physicalToken = physicalEntry?.access || physicalEntry?.apiKey
        if (!physicalToken) continue

        const physicalAccount = this._findAccountBySecret(provider, physicalToken)
        const best = this.getNextAvailableAccount(undefined, provider)
        if (!best || !best.rawEntry) continue

        const logicalToken = (best.rawEntry as any)?.access || (best.rawEntry as any)?.apiKey
        const isDifferent = physicalToken !== logicalToken
        
        const accState = physicalAccount ? this.state.accountStates[physicalAccount.id] : null
        const knownLimited = physicalAccount && accState?.status === "rate_limited" && 
                             isAccountRateLimited(physicalAccount, accState.rateLimitUntil)

        const ageSeconds = (Date.now() - mtime) / 1000

        if (knownLimited) {
          // ─── CASE 1: Kunci fisik LIMIT → Timpa Segera ──────────────
          const entryToSync = best.rawEntry || (best as any).apiKey
          if (entryToSync) {
            overwriteAuthJsonProvider(provider, entryToSync)
            syncedProviders.push(provider)
            anyStateChanged = true
            
            const nextStat = fs.statSync(activePath)
            this.lastAuthMtime = nextStat.mtimeMs
            this.state.currentAccountId = best.id
          }
        } else if (isDifferent) {
          if (physicalAccount) {
            // ─── CASE 2: Kunci fisik SEHAT tapi beda (Managed) → Adopsi ───
            // Ini terjadi jika user ganti akun manual ke akun lain yang ada di list.
            if (this.state.currentAccountId !== physicalAccount.id) {
              this.state.currentAccountId = physicalAccount.id
              anyStateChanged = true
              
              const nextStat = fs.statSync(activePath)
              this.lastAuthMtime = nextStat.mtimeMs
            }
          } else if (ageSeconds > 2) {
            // ─── CASE 3: Kunci tdk dikenal & sudah lewat 2 detik → Reclaim ──
            const entryToSync = best.rawEntry || (best as any).apiKey
            if (entryToSync) {
              overwriteAuthJsonProvider(provider, entryToSync)
              syncedProviders.push(provider)
              anyStateChanged = true
              
              const nextStat = fs.statSync(activePath)
              this.lastAuthMtime = nextStat.mtimeMs
              this.state.currentAccountId = best.id
            }
          }
        }
      }

      if (anyStateChanged) {
        saveState(this.state)
        this._syncAccountMarkersToConfig()
      }

      return { synced: syncedProviders.length > 0, providers: syncedProviders }
    } catch {
      return { synced: false, providers: [] }
    }
  }
}
