import test from "node:test"
import assert from "node:assert/strict"
import { buildAuthJsonEntry } from "./auth-json"
import type { Account } from "./types"

const baseAccount: Account = {
  id: "openai-1",
  name: "OpenAI Primary",
  provider: "openai",
  priority: 1,
  credentials: {
    authType: "api_key",
    env: { OPENAI_API_KEY: "sk-test" },
  },
}

test("builds api entry for standard api_key account", () => {
  const entry = buildAuthJsonEntry(baseAccount)
  assert.ok(entry)
  assert.equal((entry as any).type, "api")
  assert.equal((entry as any).access, "sk-test")
})

test("builds azure_openai entry with endpoint & deployment", () => {
  const account: Account = {
    id: "azure-1",
    name: "Azure",
    provider: "azure-openai",
    priority: 1,
    credentials: {
      authType: "azure_openai",
      env: { AZURE_OPENAI_API_KEY: "az-key" },
      providerConfig: {
        endpoint: "https://example-endpoint",
        deployment: "gpt4o",
      },
    },
  }

  const entry = buildAuthJsonEntry(account)
  assert.ok(entry)
  assert.equal((entry as any).type, "azure_openai")
  assert.equal((entry as any).key, "az-key")
  assert.equal((entry as any).endpoint, "https://example-endpoint")
  assert.equal((entry as any).deployment, "gpt4o")
})

test("builds aws_bedrock entry with available fields", () => {
  const account: Account = {
    id: "bedrock-1",
    name: "Bedrock",
    provider: "amazon-bedrock",
    priority: 1,
    credentials: {
      authType: "aws_bedrock",
      env: {
        AWS_BEARER_TOKEN_BEDROCK: "bedrock-bearer",
        AWS_ACCESS_KEY_ID: "key-id",
        AWS_SECRET_ACCESS_KEY: "secret",
      },
      providerConfig: {
        region: "us-east-1",
      },
    },
  }

  const entry = buildAuthJsonEntry(account)
  assert.ok(entry)
  assert.equal((entry as any).type, "aws_bedrock")
  assert.equal((entry as any).access, "bedrock-bearer")
  assert.equal((entry as any).region, "us-east-1")
})
