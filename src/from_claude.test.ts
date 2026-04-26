import test from "node:test"
import assert from "node:assert/strict"
import { detectRateLimitFromEvent } from "./event-detection"

test("does not rotate on normal streamed discussion about rate limits", () => {
  const event = {
    type: "message.part.updated",
    properties: {
      part: {
        text: "Let me explain what a rate limit means in APIs.",
      },
    },
  }

  assert.equal(
    detectRateLimitFromEvent(event, "Let me explain what a rate limit means in APIs.", ""),
    false,
  )
})

test("detects strong stream retry text in web mode", () => {
  const event = {
    type: "message.part.updated",
    properties: {
      part: {
        text: "The usage limit has been reached retrying in 16s - attempt #4",
      },
    },
  }

  assert.equal(
    detectRateLimitFromEvent(
      event,
      "The usage limit has been reached retrying in 16s - attempt #4",
      "",
    ),
    true,
  )
})

test("detects structured session retry payload", () => {
  const event = {
    type: "session.status",
    properties: {
      status: {
        type: "retry",
        message: "The usage limit has been reached",
      },
    },
  }

  assert.equal(
    detectRateLimitFromEvent(event, undefined, "The usage limit has been reached"),
    true,
  )
})
