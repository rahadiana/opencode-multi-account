import type { Account, AuthJsonEntry } from "./types"
import { PROVIDER_ENV_VARS } from "./types"

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key]
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function inferEntryType(entry: Record<string, unknown>): "oauth" | "api" | null {
  const explicitType = readString(entry, "type")
  if (explicitType === "oauth") return "oauth"
  if (explicitType === "api") return "api"

  const hasAccess = Boolean(readString(entry, "access"))
  const hasKey = Boolean(readString(entry, "key"))

  if (hasAccess) return "oauth"
  if (hasKey) return "api"
  return null
}

function resolveProviderEnvVar(provider: string): string {
  const known = PROVIDER_ENV_VARS[provider]?.[0]
  if (known) return known

  const customMap: Record<string, string> = {
    "github-copilot": "GITHUB_COPILOT_API_KEY",
  }
  return customMap[provider] ?? `${provider.toUpperCase().replace(/-/g, "_")}_API_KEY`
}

export function extractSecretFromAuthEntry(entry: AuthJsonEntry): string | null {
  if (!isObject(entry)) return null
  const type = inferEntryType(entry)

  if (type === "oauth") {
    return readString(entry, "access") ?? null
  }

  if (type === "api") {
    return readString(entry, "key") ?? null
  }

  return null
}

function extractProviderConfig(entry: AuthJsonEntry): Record<string, string> | undefined {
  if (!isObject(entry)) return undefined

  const providerConfig: Record<string, string> = {}
  for (const [key, value] of Object.entries(entry)) {
    if (key === "type" || key === "access" || key === "key") continue
    if (typeof value === "string" && value.trim().length > 0) {
      providerConfig[key] = value
      continue
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      providerConfig[key] = String(value)
    }
  }

  return Object.keys(providerConfig).length > 0 ? providerConfig : undefined
}

export function buildAutoAccountFromAuthEntry(provider: string, entry: AuthJsonEntry): Account | null {
  const secret = extractSecretFromAuthEntry(entry)
  if (!secret) return null

  const envVarName = resolveProviderEnvVar(provider)
  const type = isObject(entry) ? inferEntryType(entry) : null

  return {
    id: `auto-${provider}`,
    name: `OpenCode ${provider} (Auto-Sync)`,
    provider,
    credentials: {
      authType: type === "oauth" ? "oauth_access_token" : "api_key",
      env: {
        [envVarName]: secret,
      },
      providerConfig: extractProviderConfig(entry),
    },
    priority: 99,
  }
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`
  }
  if (isObject(value)) {
    const keys = Object.keys(value).sort()
    const serialized = keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
    return `{${serialized.join(",")}}`
  }
  return JSON.stringify(value)
}

export function normalizeAuthProviderEntries(input: unknown): AuthJsonEntry[] {
  if (Array.isArray(input)) {
    return input.filter((entry): entry is AuthJsonEntry => isObject(entry))
  }
  if (isObject(input)) return [input as AuthJsonEntry]
  return []
}

function getIdentityFingerprint(entry: Record<string, unknown>): string {
  if (entry.type !== "oauth") {
    return stableSerialize(entry)
  }

  // Untuk OAuth, kita kloning dan hapus field transient (access, expires, dll)
  // agar indentitas akun tetap STABIL meskipun token di-refresh.
  const identity: Record<string, unknown> = { ...entry }
  delete identity.access
  delete identity.expires
  delete identity.iat
  delete identity.exp
  delete identity.token_type

  // Jika setelah dihapus tidak ada lagi yang tersisa (misal hanya {type:oauth, access:xxx}),
  // fallback ke serialization asli agar tidak bentrok antar provider.
  const keys = Object.keys(identity)
  if (keys.length === 1 && keys[0] === "type") {
    return stableSerialize(entry)
  }

  return stableSerialize(identity)
}

export function dedupeRawEntries(entries: unknown[]): { entries: unknown[]; changed: boolean } {
  // Gunakan Map (Identity -> Entry) dengan strategi "LAST ONE WINS"
  // Ini memastikan token terbaru (dari incoming) menimpa token lama (dari current).
  const identityMap = new Map<string, unknown>()
  let changed = false
  let initialCount = entries.length

  for (const entry of entries) {
    if (!isObject(entry)) {
      changed = true
      continue
    }
    const id = getIdentityFingerprint(entry)
    identityMap.set(id, entry)
  }

  const unique = Array.from(identityMap.values())
  if (unique.length !== initialCount) changed = true
  
  return { entries: unique, changed }
}

export function stableEntryFingerprint(entry: unknown): string {
  if (isObject(entry)) {
    return getIdentityFingerprint(entry)
  }
  return stableSerialize(entry)
}
