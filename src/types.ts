// ============================================================
// Types & Interfaces untuk OpenCode Multi-Account Manager Plugin
// ============================================================

export type AccountStatus = "active" | "rate_limited" | "disabled" | "invalid"

export type RotationStrategy = "priority"
export const CONFIG_SCHEMA_VERSION = 2

export type AuthType =
  | "api_key"
  | "oauth_access_token"
  | "azure_openai"
  | "aws_bedrock"
  | "custom_env"

/** Credential lintas-provider: core schema + providerConfig khusus */
export interface AccountCredentials {
  authType: AuthType
  /** Env vars yang akan di-inject saat akun aktif */
  env: Record<string, string>
  /** Data spesifik provider (endpoint, deployment, region, dsb.) */
  providerConfig?: Record<string, string>
}

/** Konfigurasi satu akun API */
export interface Account {
  /** ID unik akun, bisa bebas */
  id: string
  /** Nama tampilan untuk akun ini */
  name: string
  /** Provider yang digunakan, sesuai dengan ID provider di OpenCode */
  provider: string
  /** Credential schema baru (disarankan) */
  credentials?: AccountCredentials
  /** API key (legacy compatibility) */
  apiKey?: string
  /** Nama env var API key (legacy compatibility) */
  envVarName?: string
  /** Raw entry from auth source (preserved for provider-grouped model) */
  rawEntry?: unknown
  /** Prioritas akun (semakin kecil = semakin diprioritaskan, mulai dari 1) */
  priority: number
  /** Durasi cooldown dalam menit setelah rate limit (default 60) */
  cooldownMinutes?: number
  /** Status akun saat ini (dikelola runtime, tidak perlu diisi manual) */
  status?: AccountStatus
  /** Timestamp kapan rate limit berakhir (ISO string, dikelola runtime) */
  rateLimitUntil?: string
  /** Model opsional yang ingin dipaksakan saat menggunakan akun ini */
  model?: string
}

/** File konfigurasi utama plugin */
export interface PluginConfig {
  /** Versi schema konfigurasi accounts.json */
  schemaVersion: number
  /** Daftar akun (diurutkan berdasarkan priority) */
  accounts: Account[]
  /** Provider-scoped raw entries map (new model) */
  providerAccounts?: Record<string, unknown[]>
  /** Providers managed by auth.json sync (used for safe pruning) */
  authSyncProviders?: string[]
  /** Snapshot status akun untuk visibilitas lintas sesi di accounts.json */
  accountMarkers?: Record<
    string,
    {
      status: AccountStatus
      rateLimitUntil?: string
      updatedAt: string
    }
  >
  /** Strategi rotasi: "priority" = utamakan akun dengan priority lebih kecil */
  rotationStrategy: RotationStrategy
  /** Auto-switch ke akun berikutnya ketika rate limited (default true) */
  autoSwitch: boolean
  /** Cooldown global dalam menit jika tidak diset per-akun (default 60) */
  defaultCooldownMinutes: number
}

export function createDefaultConfig(): PluginConfig {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    accounts: [],
    providerAccounts: undefined,
    authSyncProviders: undefined,
    accountMarkers: undefined,
    rotationStrategy: "priority",
    autoSwitch: true,
    defaultCooldownMinutes: 1,
  }
}

/** State runtime yang disimpan ke disk */
export interface RuntimeState {
  /** ID akun yang sedang aktif */
  currentAccountId: string | null
  /** Map: accountId -> status runtime */
  accountStates: Record<
    string,
    {
      status: AccountStatus
      rateLimitUntil?: string
    }
  >
  /** Timestamp terakhir diupdate */
  lastUpdated: string
}

export interface AuthJsonOauthEntry {
  type: "oauth"
  access?: string
  refresh?: string
  expires?: number
  accountId?: string
  email?: string
  projectId?: string
  [key: string]: unknown
}

export interface AuthJsonApiEntry {
  type: "api"
  key?: string
  [key: string]: unknown
}

export type AuthJsonEntry = AuthJsonOauthEntry | AuthJsonApiEntry | Record<string, unknown>
export type AuthJsonMap = Record<string, AuthJsonEntry | AuthJsonEntry[]>

/** Daftar env var per provider yang didukung OpenCode */
export const PROVIDER_ENV_VARS: Record<string, string[]> = {
  // Tier 1 — Major providers
  anthropic: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  google: ["GOOGLE_GENERATIVE_AI_API_KEY"],
  "google-vertex": ["GOOGLE_VERTEX_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS"],
  groq: ["GROQ_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  xai: ["XAI_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],

  // Tier 2 — Cloud providers
  "amazon-bedrock": ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_BEARER_TOKEN_BEDROCK"],
  "azure-openai": ["AZURE_OPENAI_API_KEY"],
  "azure-cognitive": ["AZURE_COGNITIVE_SERVICES_API_KEY"],

  // Tier 3 — Specialized providers
  cerebras: ["CEREBRAS_API_KEY"],
  fireworks: ["FIREWORKS_API_KEY"],
  together: ["TOGETHER_API_KEY"],
  "cloudflare-workers-ai": ["CLOUDFLARE_API_KEY", "CLOUDFLARE_ACCOUNT_ID"],
  "cloudflare-ai-gateway": ["CLOUDFLARE_AI_GATEWAY_API_KEY"],
  "hugging-face": ["HUGGINGFACE_API_KEY"],
  "deep-infra": ["DEEPINFRA_API_KEY"],
  moonshot: ["MOONSHOT_API_KEY"],
  minimax: ["MINIMAX_API_KEY"],
  nebius: ["NEBIUS_API_KEY"],
  baseten: ["BASETEN_API_KEY"],
  helicone: ["HELICONE_API_KEY"],
  "io-net": ["IO_NET_API_KEY"],
  ovhcloud: ["OVH_AI_ENDPOINTS_ACCESS_TOKEN"],
  scaleway: ["SCALEWAY_API_KEY"],
  "venice-ai": ["VENICE_API_KEY"],
  "vercel-ai-gateway": ["VERCEL_AI_GATEWAY_API_KEY"],
  stackit: ["STACKIT_API_KEY"],
  "sap-ai-core": ["SAP_AI_CORE_API_KEY"],
  "302ai": ["AI302_API_KEY"],
  "z-ai": ["ZAI_API_KEY"],
  zenmux: ["ZENMUX_API_KEY"],
  cortecs: ["CORTECS_API_KEY"],
  "ollama-cloud": ["OLLAMA_CLOUD_API_KEY"],
  "opencode-zen": ["OPENCODE_API_KEY"],
  firmware: ["FIRMWARE_API_KEY"],
}
