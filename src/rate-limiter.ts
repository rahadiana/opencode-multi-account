// ============================================================
// Rate Limiter — Deteksi & tracking rate limit per akun
// ============================================================

import type { Account } from "./types.js"

/** Pattern error yang mengindikasikan rate limit */
const RATE_LIMIT_PATTERNS = [
  /429/, // status code in JSON/string
  /rate.?limit/i,
  /too many requests/i,
  /quota exceeded/i,
  /quota_exceeded/i,
  /usage limit has been reached/i,
  /retrying in \d+\s*\w*/i,
  /daily.?limit/i,
  /credits.?exhausted/i,
  /plan.?limit/i,
  /insufficient.?funds/i,
  /balance.?low/i,
  /key.?expired/i,
  /invalid.?api.?key/i,
  /unauthorized/i,
  /forbidden/i,
  /401/,
  /403/,
  /x-ratelimit-exceeded/i,
  /x-ratelimit-user-retry-after/i,
  /retry-after/i,
  /context_length_exceeded/i,
  /overloaded/i,
  /capacity/i,
  /throttl/i,
  /resource.?exhausted/i,
  /limit.?reached/i,
  /exceeded.?limit/i,
  /tokens per minute/i,
  /requests per minute/i,
  /ratelimit/i,
]

function toLower(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : ""
}

function collectRecordNodes(input: unknown, maxDepth: number = 6): Record<string, unknown>[] {
  if (typeof input !== "object" || input === null) return []

  const queue: Array<{ value: unknown; depth: number }> = [{ value: input, depth: 0 }]
  const visited = new Set<unknown>()
  const records: Record<string, unknown>[] = []

  while (queue.length > 0) {
    const node = queue.shift()
    if (!node) continue

    const { value, depth } = node
    if (typeof value !== "object" || value === null) continue
    if (visited.has(value)) continue
    visited.add(value)

    if (Array.isArray(value)) {
      if (depth < maxDepth) {
        for (const item of value) queue.push({ value: item, depth: depth + 1 })
      }
      continue
    }

    const rec = value as Record<string, unknown>
    records.push(rec)

    if (depth >= maxDepth) continue

    for (const child of Object.values(rec)) {
      if (typeof child === "object" && child !== null) {
        queue.push({ value: child, depth: depth + 1 })
      }
    }
  }

  return records
}

function readCodeOrType(obj: Record<string, unknown>, key: string): string | undefined {
  const val = obj[key]
  if (typeof val === "string" && val.trim().length > 0) return val.toLowerCase()
  return undefined
}

function hasRateLimitHeaders(headers: unknown): boolean {
  if (typeof headers !== "object" || headers === null) return false
  const h = headers as Record<string, unknown>
  const headerKeys = Object.keys(h).map((k) => k.toLowerCase())
  if (headerKeys.some((k) => k.includes("x-ratelimit-exceeded") || k.includes("retry-after"))) return true
  const remaining = toLower(h["x-ratelimit-remaining"]) || toLower(h["x-ratelimit-user-remaining"])
  if (remaining === "0" || remaining === "0.0") return true
  return false
}

function hasStatus429(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) return false
  const statusCode = (obj as Record<string, unknown>).statusCode
  if (typeof statusCode === "number" && statusCode === 429) return true
  if (typeof statusCode === "string" && statusCode.trim() === "429") return true
  const status = (obj as Record<string, unknown>).status
  if (typeof status === "number" && status === 429) return true
  if (typeof status === "string" && status.trim() === "429") return true
  return false
}

function hasRateLimitCode(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) return false
  const rec = obj as Record<string, unknown>

  const codeCandidates = [
    readCodeOrType(rec, "code"),
    readCodeOrType(rec, "type"),
    readCodeOrType(rec, "status"),
    readCodeOrType(rec, "error"),
  ].filter(Boolean) as string[]

  const nestedError = rec.error
  if (typeof nestedError === "object" && nestedError !== null) {
    const nested = nestedError as Record<string, unknown>
    codeCandidates.push(
      readCodeOrType(nested, "code") ?? "",
      readCodeOrType(nested, "type") ?? "",
      readCodeOrType(nested, "status") ?? "",
    )
  }

  const normalized = codeCandidates.filter((c) => c.length > 0)
  if (normalized.length === 0) return false

  const known = [
    "rate_limit",
    "rate_limit_error",
    "rate_limit_exceeded",
    "rate_limit_reached",
    "insufficient_quota",
    "quota_exceeded",
    "billing_hard_limit",
    "billing_hard_limit_reached",
    "requests_per_minute_limit",
    "tokens_per_minute_limit",
  ]

  return normalized.some((code) => known.some((k) => code.includes(k)))
}

function extractStrings(err: unknown): string[] {
  const strings: string[] = []
  if (typeof err === "string") strings.push(err)
  if (typeof err === "object" && err !== null) {
    try {
      strings.push(JSON.stringify(err))
    } catch {
      // ignore
    }
    const maybeBody = (err as Record<string, unknown>).responseBody ?? (err as Record<string, unknown>).body
    if (typeof maybeBody === "string") strings.push(maybeBody)
  }
  return strings
}

/** Cek apakah error (string atau object) mengindikasikan rate limit */
export function isRateLimitError(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    for (const rec of collectRecordNodes(error)) {
      if (hasStatus429(rec)) return true

      const headers = rec.responseHeaders ?? rec.headers
      if (hasRateLimitHeaders(headers)) return true

      if (hasRateLimitCode(rec)) return true
    }
  }

  const candidates = extractStrings(error)
  for (const candidate of candidates) {
    if (RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(candidate))) return true
  }
  return false
}

/** Cek apakah akun masih dalam masa cooldown rate limit */
export function isAccountRateLimited(
  account: Account,
  rateLimitUntil?: string
): boolean {
  if (!rateLimitUntil) return false
  return new Date() < new Date(rateLimitUntil)
}

/** Hitung kapan cooldown berakhir */
export function calcRateLimitExpiry(account: Account, defaultCooldownMinutes: number): string {
  const cooldown = account.cooldownMinutes ?? defaultCooldownMinutes
  const expiry = new Date()
  expiry.setMinutes(expiry.getMinutes() + cooldown)
  return expiry.toISOString()
}

/** Format sisa waktu cooldown menjadi string yang readable */
export function formatCooldownRemaining(rateLimitUntil: string): string {
  const remaining = new Date(rateLimitUntil).getTime() - Date.now()
  if (remaining <= 0) return "expired"
  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}
