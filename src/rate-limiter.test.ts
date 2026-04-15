import test from "node:test"
import assert from "node:assert/strict"
import { isRateLimitError } from "./rate-limiter"

const copilot429 = {
  statusCode: 429,
  responseHeaders: {
    "x-ratelimit-exceeded": "quota_exceeded",
    "retry-after": "1512972",
  },
  responseBody: "quota exceeded\n",
}

const generic429 = {
  statusCode: 429,
  message: "Too Many Requests",
}

const usageLimitMessage = "The usage limit has been reached retrying in 16s - attempt #4"

const sessionStatusEvent = {
  type: "session.status",
  properties: {
    status: {
      type: "retry",
      attempt: 6,
      message: "The usage limit has been reached",
      next: Date.now() + 1000,
    },
  },
}

const nestedWebEvent429 = {
  type: "session.status",
  properties: {
    status: {
      type: "error",
      response: {
        status: 429,
        headers: {
          "retry-after": "12",
        },
      },
    },
  },
}

const non429 = {
  statusCode: 400,
  message: "bad request",
}

test("detects GitHub/Copilot quota_exceeded payload", () => {
  assert.equal(isRateLimitError(copilot429), true)
})

test("detects rate limit from code/type without message", () => {
  assert.equal(isRateLimitError({ error: { code: "insufficient_quota", status: "error" } }), true)
  assert.equal(isRateLimitError({ code: "rate_limit_exceeded", details: "no message" }), true)
})

test("detects generic 429 message", () => {
  assert.equal(isRateLimitError(generic429), true)
  assert.equal(isRateLimitError("429 stream error"), true)
  assert.equal(isRateLimitError(usageLimitMessage), true)
  assert.equal(isRateLimitError(sessionStatusEvent), true)
  assert.equal(isRateLimitError(nestedWebEvent429), true)
})

test("ignores non-429 error", () => {
  assert.equal(isRateLimitError(non429), false)
  assert.equal(isRateLimitError("random failure"), false)
})
