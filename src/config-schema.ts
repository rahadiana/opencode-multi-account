import { normalizeAccount } from "./provider-credentials.js"
import { dedupeRawEntries, normalizeAuthProviderEntries } from "./auth-schema.js"
import {
  CONFIG_SCHEMA_VERSION,
  createDefaultConfig,
  type Account,
  type AccountStatus,
  type AccountCredentials,
  type AuthType,
  type PluginConfig,
  type RotationStrategy,
} from "./types.js"

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function toRotationStrategy(value: unknown): RotationStrategy {
  if (value === "priority") return value
  return "priority"
}

function toAuthType(value: unknown): AuthType {
  if (
    value === "api_key" ||
    value === "oauth_access_token" ||
    value === "azure_openai" ||
    value === "aws_bedrock" ||
    value === "custom_env"
  ) {
    return value
  }
  return "api_key"
}

function sanitizeNumber(value: unknown, fallback: number, min = 1): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.floor(n))
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const list: string[] = []
  for (const item of value) {
    if (typeof item !== "string") continue
    const trimmed = item.trim()
    if (trimmed.length > 0) list.push(trimmed)
  }
  return list
}

function toAccountStatus(value: unknown): AccountStatus | null {
  if (value === "active" || value === "rate_limited" || value === "disabled" || value === "invalid") {
    return value
  }
  return null
}

function sanitizeAccountMarkers(
  value: unknown,
): {
  markers: PluginConfig["accountMarkers"]
  changed: boolean
} {
  if (!isObject(value)) {
    return { markers: undefined, changed: value !== undefined }
  }

  const markers: NonNullable<PluginConfig["accountMarkers"]> = {}
  let changed = false

  for (const [accountId, marker] of Object.entries(value)) {
    if (!isObject(marker)) {
      changed = true
      continue
    }

    const status = toAccountStatus(marker.status)
    if (!status) {
      changed = true
      continue
    }

    const rateLimitUntil =
      typeof marker.rateLimitUntil === "string" && marker.rateLimitUntil.trim().length > 0
        ? marker.rateLimitUntil
        : undefined
    const updatedAt =
      typeof marker.updatedAt === "string" && marker.updatedAt.trim().length > 0
        ? marker.updatedAt
        : new Date().toISOString()

    if (marker.rateLimitUntil !== undefined && rateLimitUntil === undefined) {
      changed = true
    }
    if (marker.updatedAt !== updatedAt) {
      changed = true
    }

    markers[accountId] = {
      status,
      rateLimitUntil,
      updatedAt,
    }
  }

  return {
    markers: Object.keys(markers).length > 0 ? markers : undefined,
    changed,
  }
}

function sanitizeAccount(raw: unknown, index: number): { account: Account | null; changed: boolean } {
  if (!isObject(raw)) return { account: null, changed: true }

  const input = raw as Record<string, unknown>
  const id = typeof input.id === "string" && input.id.trim() ? input.id : `migrated-${index + 1}`
  const name = typeof input.name === "string" && input.name.trim() ? input.name : `Account ${index + 1}`
  const provider =
    typeof input.provider === "string" && input.provider.trim() ? input.provider : "openai"

  const account: Account = {
    id,
    name,
    provider,
    priority: sanitizeNumber(input.priority, index + 1),
    cooldownMinutes:
      input.cooldownMinutes === undefined
        ? undefined
        : sanitizeNumber(input.cooldownMinutes, 60, 0),
    model: typeof input.model === "string" ? input.model : undefined,
    credentials: undefined,
    apiKey: typeof input.apiKey === "string" ? input.apiKey : undefined,
    envVarName: typeof input.envVarName === "string" ? input.envVarName : undefined,
  }

  if (isObject(input.credentials)) {
    const credentials: AccountCredentials = {
      authType: toAuthType(input.credentials.authType),
      env: {},
    }

    if (isObject(input.credentials.env)) {
      for (const [key, value] of Object.entries(input.credentials.env)) {
        if (typeof value === "string") credentials.env[key] = value
      }
    }

    const providerConfig: Record<string, string> = {}
    if (isObject(input.credentials.providerConfig)) {
      for (const [key, value] of Object.entries(input.credentials.providerConfig)) {
        if (typeof value === "string") providerConfig[key] = value
      }
    }
    if (Object.keys(providerConfig).length > 0) {
      credentials.providerConfig = providerConfig
    }

    account.credentials = credentials
  }

  const normalized = normalizeAccount(account)
  return { account: normalized.account, changed: normalized.changed || id !== input.id || name !== input.name || provider !== input.provider }
}

export function migrateConfig(rawConfig: unknown): { config: PluginConfig; changed: boolean } {
  const defaults = createDefaultConfig()
  if (!isObject(rawConfig)) {
    // No valid config: return defaults with a non-breaking change flag
    return { config: defaults, changed: true }
  }

  const raw = rawConfig as Record<string, unknown>
  const accounts: Account[] = []
  let changed = false

  if (Array.isArray(raw.accounts)) {
    for (let i = 0; i < raw.accounts.length; i += 1) {
      const sanitized = sanitizeAccount(raw.accounts[i], i)
      if (sanitized.account) accounts.push(sanitized.account)
      if (sanitized.changed) changed = true
    }
    accounts.sort((a, b) => a.priority - b.priority)
  } else if (raw.accounts !== undefined) {
    changed = true
  }

  const providerAccounts: Record<string, unknown[]> = {}
  const incomingProviderAccounts = raw.providerAccounts
  if (isObject(incomingProviderAccounts)) {
    for (const [provider, value] of Object.entries(incomingProviderAccounts)) {
      const normalizedEntries = normalizeAuthProviderEntries(value)
      const deduped = dedupeRawEntries(normalizedEntries)
      providerAccounts[provider] = deduped.entries
      if (deduped.changed || normalizedEntries.length !== deduped.entries.length) {
        changed = true
      }
      if (normalizedEntries.length === 0 && value !== undefined) {
        changed = true
      }
    }
  } else if (incomingProviderAccounts !== undefined) {
    changed = true
  }

  if (Object.keys(providerAccounts).length === 0 && accounts.length > 0) {
    for (const account of accounts) {
      const list = providerAccounts[account.provider] ?? []
      list.push(account.rawEntry ?? account)
      providerAccounts[account.provider] = list
    }
    changed = true
  }

  const config: PluginConfig = {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    accounts,
    providerAccounts: Object.keys(providerAccounts).length > 0 ? providerAccounts : undefined,
    authSyncProviders: undefined,
    accountMarkers: undefined,
    rotationStrategy: toRotationStrategy(raw.rotationStrategy),
    autoSwitch: typeof raw.autoSwitch === "boolean" ? raw.autoSwitch : true,
    defaultCooldownMinutes: sanitizeNumber(raw.defaultCooldownMinutes, 60, 0),
  }

  const syncProviders = sanitizeStringArray(raw.authSyncProviders)
  if (syncProviders.length > 0) {
    const unique = Array.from(new Set(syncProviders)).sort((a, b) => a.localeCompare(b))
    config.authSyncProviders = unique
    if (unique.length !== syncProviders.length) changed = true
  } else if (raw.authSyncProviders !== undefined) {
    changed = true
  }

  const sanitizedMarkers = sanitizeAccountMarkers(raw.accountMarkers)
  config.accountMarkers = sanitizedMarkers.markers
  if (sanitizedMarkers.changed) {
    changed = true
  }

  const schemaVersion = typeof raw.schemaVersion === "number" ? raw.schemaVersion : Number.NaN
  if (!Number.isFinite(schemaVersion) || schemaVersion !== CONFIG_SCHEMA_VERSION) {
    changed = true
  }

  return { config, changed }
}
