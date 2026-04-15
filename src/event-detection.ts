import { isRateLimitError } from "./rate-limiter"

const STRONG_STREAM_RATE_LIMIT_PATTERNS = [
  /retrying in\s+\d+/i,
  /attempt\s*#\d+/i,
  /too many requests/i,
  /quota exceeded/i,
  /usage limit has been reached/i,
  /\b429\b/,
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function hasStrongStreamRateLimitText(text: string | undefined): boolean {
  if (typeof text !== "string" || text.trim().length === 0) return false
  return STRONG_STREAM_RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(text))
}

function hasStructuredErrorSignal(event: unknown): boolean {
  if (!isRecord(event)) return false

  const type = typeof event.type === "string" ? event.type.toLowerCase() : ""
  if (type.includes("error") || type.includes("retry")) return true

  if (typeof event.statusCode === "number" && event.statusCode === 429) return true
  if (typeof event.status === "number" && event.status === 429) return true

  const properties = isRecord(event.properties) ? event.properties : undefined
  if (!properties) return false

  if (isRecord(properties.error)) return true

  const status = isRecord(properties.status) ? properties.status : undefined
  if (status) {
    const statusType = typeof status.type === "string" ? status.type.toLowerCase() : ""
    if (statusType === "retry" || statusType === "error") return true

    const statusCode = status.statusCode
    if (typeof statusCode === "number" && statusCode === 429) return true
    if (typeof status.status === "number" && status.status === 429) return true

    const response = isRecord(status.response) ? status.response : undefined
    if (response) {
      if (typeof response.status === "number" && response.status === 429) return true
      const headers = isRecord(response.headers) ? response.headers : undefined
      if (headers) {
        const headerKeys = Object.keys(headers).map((key) => key.toLowerCase())
        if (headerKeys.some((key) => key.includes("retry-after") || key.includes("x-ratelimit"))) {
          return true
        }
      }
    }
  }

  return false
}

export function detectRateLimitFromEvent(
  event: unknown,
  partText: string | undefined,
  extractedMessage: string,
): boolean {
  const hasStructuredSignal = hasStructuredErrorSignal(event)
  const hasStrongTextSignal = hasStrongStreamRateLimitText(partText)

  if (hasStructuredSignal && isRateLimitError(event)) return true
  if (hasStructuredSignal) {
    const structuredMessage = [partText, extractedMessage]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" | ")
    if (isRateLimitError(structuredMessage)) return true
  }

  return hasStrongTextSignal
}

export function hasStrongStreamRateLimitTextOnly(text: string | undefined): boolean {
  return hasStrongStreamRateLimitText(text)
}
