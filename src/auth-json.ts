import type { Account, AuthJsonEntry } from "./types.js"
import { PROVIDER_ENV_VARS } from "./types.js"
import { resolveAccountEnv } from "./provider-credentials.js"

function pickPrimarySecret(provider: string, env: Record<string, string>): string | undefined {
  // Special-case Bedrock: prefer bearer token if available
  if (provider === "amazon-bedrock" && typeof env.AWS_BEARER_TOKEN_BEDROCK === "string") {
    const bearer = env.AWS_BEARER_TOKEN_BEDROCK
    if (bearer.trim().length > 0) return bearer
  }

  const candidates = PROVIDER_ENV_VARS[provider]?.filter(Boolean) ?? []
  for (const key of candidates) {
    const value = env[key]
    if (typeof value === "string" && value.trim().length > 0) return value
  }

  for (const value of Object.values(env)) {
    if (typeof value === "string" && value.trim().length > 0) return value
  }
  return undefined
}

export function buildAuthJsonEntry(account: Account): AuthJsonEntry | null {
  const provider = account.provider.toLowerCase()
  const env = resolveAccountEnv(account)
  const authType = account.credentials?.authType ?? "api_key"
  const primary = pickPrimarySecret(provider, env)

  if (!primary) return null

  // Azure OpenAI needs endpoint + deployment
  if (authType === "azure_openai") {
    return {
      type: "azure_openai",
      key: primary,
      endpoint: account.credentials?.providerConfig?.endpoint,
      deployment: account.credentials?.providerConfig?.deployment,
    } as any
  }

  if (authType === "aws_bedrock") {
    return {
      type: "aws_bedrock",
      access: primary,
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      sessionToken: env.AWS_SESSION_TOKEN,
      bearer: env.AWS_BEARER_TOKEN_BEDROCK,
      region: account.credentials?.providerConfig?.region,
    } as any
  }

  // Default: API key style
  return {
    type: "api",
    access: primary,
  } as any
}
