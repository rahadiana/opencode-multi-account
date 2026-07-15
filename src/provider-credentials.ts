import type { Account, AccountCredentials, AuthType } from "./types.js"
import { PROVIDER_ENV_VARS } from "./types.js"

export function resolveValueRef(value: string): string {
  if (typeof value === "string" && value.startsWith("env:")) {
    const varName = value.slice(4)
    return process.env[varName] ?? value
  }
  return value
}

function inferDefaultEnvVar(provider: string): string {
  const known = PROVIDER_ENV_VARS[provider]?.[0]
  if (known) return known
  return `${provider.toUpperCase().replace(/-/g, "_")}_API_KEY`
}

function detectAuthType(provider: string, env: Record<string, string>): AuthType {
  if (provider === "azure-openai") return "azure_openai"
  if (provider === "amazon-bedrock") return "aws_bedrock"
  if (Object.keys(env).length > 1) return "custom_env"
  return "api_key"
}

export function normalizeAccount(account: Account): { account: Account; changed: boolean } {
  let changed = false

  if (!account.credentials) {
    const env: Record<string, string> = {}
    const resolvedApiKey = account.apiKey ? resolveValueRef(account.apiKey) : undefined
    if (resolvedApiKey && account.envVarName) {
      env[account.envVarName] = resolvedApiKey
    } else if (resolvedApiKey) {
      const inferred = inferDefaultEnvVar(account.provider)
      env[inferred] = resolvedApiKey
      changed = true
    }

    account.credentials = {
      authType: detectAuthType(account.provider, env),
      env,
    }
    changed = true
  }

  if (!account.credentials.env || typeof account.credentials.env !== "object") {
    account.credentials.env = {}
    changed = true
  }

  if (!account.credentials.authType) {
    account.credentials.authType = detectAuthType(account.provider, account.credentials.env)
    changed = true
  }

  return { account, changed }
}

function resolveEnvVars(env: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    resolved[k] = resolveValueRef(v)
  }
  return resolved
}

export function resolveAccountEnv(account: Account): Record<string, string> {
  if (account.credentials?.env) return resolveEnvVars(account.credentials.env)

  if (account.apiKey && account.envVarName) {
    return { [account.envVarName]: resolveValueRef(account.apiKey) }
  }

  if (account.apiKey) {
    const inferred = inferDefaultEnvVar(account.provider)
    return { [inferred]: resolveValueRef(account.apiKey) }
  }

  return {}
}

export function validateAccountCredentials(account: Account): { valid: boolean; reason?: string } {
  const env = resolveAccountEnv(account)
  const authType = account.credentials?.authType ?? detectAuthType(account.provider, env)

  const hasAnySecret = Object.values(env).some((value) => value.trim().length > 0)
  if (!hasAnySecret) {
    return { valid: false, reason: `Akun "${account.id}" tidak punya credential/env value.` }
  }

  if (authType === "azure_openai") {
    const cfg = account.credentials?.providerConfig ?? {}
    if (!cfg.endpoint || !cfg.deployment) {
      return {
        valid: false,
        reason: `Akun "${account.id}" (azure-openai) wajib providerConfig.endpoint dan providerConfig.deployment.`,
      }
    }
  }

  if (authType === "aws_bedrock") {
    const hasBearer = Boolean(env.AWS_BEARER_TOKEN_BEDROCK)
    const hasKeyPair = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY)
    if (!hasBearer && !hasKeyPair) {
      return {
        valid: false,
        reason: `Akun "${account.id}" (amazon-bedrock) butuh AWS_BEARER_TOKEN_BEDROCK atau pasangan AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY.`,
      }
    }
  }

  return { valid: true }
}
