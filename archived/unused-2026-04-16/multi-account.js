"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  MultiAccountPlugin: () => MultiAccountPlugin
});
module.exports = __toCommonJS(index_exports);
var fs3 = __toESM(require("fs"), 1);
var path2 = __toESM(require("path"), 1);
var os2 = __toESM(require("os"), 1);
var import_plugin = require("@opencode-ai/plugin");

// src/account-manager.ts
var fs2 = __toESM(require("fs"), 1);

// src/storage.ts
var fs = __toESM(require("fs"), 1);
var path = __toESM(require("path"), 1);
var os = __toESM(require("os"), 1);

// src/types.ts
var CONFIG_SCHEMA_VERSION = 2;
function createDefaultConfig() {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    accounts: [],
    providerAccounts: void 0,
    authSyncProviders: void 0,
    accountMarkers: void 0,
    rotationStrategy: "priority",
    autoSwitch: true,
    defaultCooldownMinutes: 1
  };
}
var PROVIDER_ENV_VARS = {
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
  firmware: ["FIRMWARE_API_KEY"]
};

// src/provider-credentials.ts
function inferDefaultEnvVar(provider) {
  const known = PROVIDER_ENV_VARS[provider]?.[0];
  if (known) return known;
  return `${provider.toUpperCase().replace(/-/g, "_")}_API_KEY`;
}
function detectAuthType(provider, env) {
  if (provider === "azure-openai") return "azure_openai";
  if (provider === "amazon-bedrock") return "aws_bedrock";
  if (Object.keys(env).length > 1) return "custom_env";
  return "api_key";
}
function normalizeAccount(account) {
  let changed = false;
  if (!account.credentials) {
    const env = {};
    if (account.apiKey && account.envVarName) {
      env[account.envVarName] = account.apiKey;
    } else if (account.apiKey) {
      const inferred = inferDefaultEnvVar(account.provider);
      env[inferred] = account.apiKey;
      changed = true;
    }
    account.credentials = {
      authType: detectAuthType(account.provider, env),
      env
    };
    changed = true;
  }
  if (!account.credentials.env || typeof account.credentials.env !== "object") {
    account.credentials.env = {};
    changed = true;
  }
  if (!account.credentials.authType) {
    account.credentials.authType = detectAuthType(account.provider, account.credentials.env);
    changed = true;
  }
  return { account, changed };
}
function resolveAccountEnv(account) {
  if (account.credentials?.env) return account.credentials.env;
  if (account.apiKey && account.envVarName) {
    return { [account.envVarName]: account.apiKey };
  }
  if (account.apiKey) {
    const inferred = inferDefaultEnvVar(account.provider);
    return { [inferred]: account.apiKey };
  }
  return {};
}
function validateAccountCredentials(account) {
  const env = resolveAccountEnv(account);
  const authType = account.credentials?.authType ?? detectAuthType(account.provider, env);
  const hasAnySecret = Object.values(env).some((value) => value.trim().length > 0);
  if (!hasAnySecret) {
    return { valid: false, reason: `Akun "${account.id}" tidak punya credential/env value.` };
  }
  if (authType === "azure_openai") {
    const cfg = account.credentials?.providerConfig ?? {};
    if (!cfg.endpoint || !cfg.deployment) {
      return {
        valid: false,
        reason: `Akun "${account.id}" (azure-openai) wajib providerConfig.endpoint dan providerConfig.deployment.`
      };
    }
  }
  if (authType === "aws_bedrock") {
    const hasBearer = Boolean(env.AWS_BEARER_TOKEN_BEDROCK);
    const hasKeyPair = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
    if (!hasBearer && !hasKeyPair) {
      return {
        valid: false,
        reason: `Akun "${account.id}" (amazon-bedrock) butuh AWS_BEARER_TOKEN_BEDROCK atau pasangan AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY.`
      };
    }
  }
  return { valid: true };
}

// src/auth-schema.ts
function isObject(value) {
  return typeof value === "object" && value !== null;
}
function readString(input, key) {
  const value = input[key];
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : void 0;
}
function inferEntryType(entry) {
  const explicitType = readString(entry, "type");
  if (explicitType === "oauth") return "oauth";
  if (explicitType === "api") return "api";
  const hasAccess = Boolean(readString(entry, "access"));
  const hasKey = Boolean(readString(entry, "key"));
  if (hasAccess) return "oauth";
  if (hasKey) return "api";
  return null;
}
function resolveProviderEnvVar(provider) {
  const known = PROVIDER_ENV_VARS[provider]?.[0];
  if (known) return known;
  const customMap = {
    "github-copilot": "GITHUB_COPILOT_API_KEY"
  };
  return customMap[provider] ?? `${provider.toUpperCase().replace(/-/g, "_")}_API_KEY`;
}
function extractSecretFromAuthEntry(entry) {
  if (!isObject(entry)) return null;
  const type = inferEntryType(entry);
  if (type === "oauth") {
    return readString(entry, "access") ?? null;
  }
  if (type === "api") {
    return readString(entry, "key") ?? null;
  }
  return null;
}
function extractProviderConfig(entry) {
  if (!isObject(entry)) return void 0;
  const providerConfig = {};
  for (const [key, value] of Object.entries(entry)) {
    if (key === "type" || key === "access" || key === "key") continue;
    if (typeof value === "string" && value.trim().length > 0) {
      providerConfig[key] = value;
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      providerConfig[key] = String(value);
    }
  }
  return Object.keys(providerConfig).length > 0 ? providerConfig : void 0;
}
function buildAutoAccountFromAuthEntry(provider, entry) {
  const secret = extractSecretFromAuthEntry(entry);
  if (!secret) return null;
  const envVarName = resolveProviderEnvVar(provider);
  const type = isObject(entry) ? inferEntryType(entry) : null;
  return {
    id: `auto-${provider}`,
    name: `OpenCode ${provider} (Auto-Sync)`,
    provider,
    credentials: {
      authType: type === "oauth" ? "oauth_access_token" : "api_key",
      env: {
        [envVarName]: secret
      },
      providerConfig: extractProviderConfig(entry)
    },
    priority: 99
  };
}
function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (isObject(value)) {
    const keys = Object.keys(value).sort();
    const serialized = keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`);
    return `{${serialized.join(",")}}`;
  }
  return JSON.stringify(value);
}
function normalizeAuthProviderEntries(input) {
  if (Array.isArray(input)) {
    return input.filter((entry) => isObject(entry));
  }
  if (isObject(input)) return [input];
  return [];
}
function getIdentityFingerprint(entry) {
  if (entry.type !== "oauth") {
    return stableSerialize(entry);
  }
  const identity = { ...entry };
  delete identity.access;
  delete identity.expires;
  delete identity.iat;
  delete identity.exp;
  delete identity.token_type;
  const keys = Object.keys(identity);
  if (keys.length === 1 && keys[0] === "type") {
    return stableSerialize(entry);
  }
  return stableSerialize(identity);
}
function dedupeRawEntries(entries) {
  const identityMap = /* @__PURE__ */ new Map();
  let changed = false;
  let initialCount = entries.length;
  for (const entry of entries) {
    if (!isObject(entry)) {
      changed = true;
      continue;
    }
    const id = getIdentityFingerprint(entry);
    identityMap.set(id, entry);
  }
  const unique = Array.from(identityMap.values());
  if (unique.length !== initialCount) changed = true;
  return { entries: unique, changed };
}
function stableEntryFingerprint(entry) {
  if (isObject(entry)) {
    return getIdentityFingerprint(entry);
  }
  return stableSerialize(entry);
}

// src/config-schema.ts
function isObject2(value) {
  return typeof value === "object" && value !== null;
}
function toRotationStrategy(value) {
  if (value === "priority") return value;
  return "priority";
}
function toAuthType(value) {
  if (value === "api_key" || value === "oauth_access_token" || value === "azure_openai" || value === "aws_bedrock" || value === "custom_env") {
    return value;
  }
  return "api_key";
}
function sanitizeNumber(value, fallback, min = 1) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}
function sanitizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  const list = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed.length > 0) list.push(trimmed);
  }
  return list;
}
function toAccountStatus(value) {
  if (value === "active" || value === "rate_limited" || value === "disabled") {
    return value;
  }
  return null;
}
function sanitizeAccountMarkers(value) {
  if (!isObject2(value)) {
    return { markers: void 0, changed: value !== void 0 };
  }
  const markers = {};
  let changed = false;
  for (const [accountId, marker] of Object.entries(value)) {
    if (!isObject2(marker)) {
      changed = true;
      continue;
    }
    const status = toAccountStatus(marker.status);
    if (!status) {
      changed = true;
      continue;
    }
    const rateLimitUntil = typeof marker.rateLimitUntil === "string" && marker.rateLimitUntil.trim().length > 0 ? marker.rateLimitUntil : void 0;
    const updatedAt = typeof marker.updatedAt === "string" && marker.updatedAt.trim().length > 0 ? marker.updatedAt : (/* @__PURE__ */ new Date()).toISOString();
    if (marker.rateLimitUntil !== void 0 && rateLimitUntil === void 0) {
      changed = true;
    }
    if (marker.updatedAt !== updatedAt) {
      changed = true;
    }
    markers[accountId] = {
      status,
      rateLimitUntil,
      updatedAt
    };
  }
  return {
    markers: Object.keys(markers).length > 0 ? markers : void 0,
    changed
  };
}
function sanitizeAccount(raw, index) {
  if (!isObject2(raw)) return { account: null, changed: true };
  const input = raw;
  const id = typeof input.id === "string" && input.id.trim() ? input.id : `migrated-${index + 1}`;
  const name = typeof input.name === "string" && input.name.trim() ? input.name : `Account ${index + 1}`;
  const provider = typeof input.provider === "string" && input.provider.trim() ? input.provider : "openai";
  const account = {
    id,
    name,
    provider,
    priority: sanitizeNumber(input.priority, index + 1),
    cooldownMinutes: input.cooldownMinutes === void 0 ? void 0 : sanitizeNumber(input.cooldownMinutes, 60, 0),
    model: typeof input.model === "string" ? input.model : void 0,
    credentials: void 0,
    apiKey: typeof input.apiKey === "string" ? input.apiKey : void 0,
    envVarName: typeof input.envVarName === "string" ? input.envVarName : void 0
  };
  if (isObject2(input.credentials)) {
    const credentials = {
      authType: toAuthType(input.credentials.authType),
      env: {}
    };
    if (isObject2(input.credentials.env)) {
      for (const [key, value] of Object.entries(input.credentials.env)) {
        if (typeof value === "string") credentials.env[key] = value;
      }
    }
    const providerConfig = {};
    if (isObject2(input.credentials.providerConfig)) {
      for (const [key, value] of Object.entries(input.credentials.providerConfig)) {
        if (typeof value === "string") providerConfig[key] = value;
      }
    }
    if (Object.keys(providerConfig).length > 0) {
      credentials.providerConfig = providerConfig;
    }
    account.credentials = credentials;
  }
  const normalized = normalizeAccount(account);
  return { account: normalized.account, changed: normalized.changed || id !== input.id || name !== input.name || provider !== input.provider };
}
function migrateConfig(rawConfig) {
  const defaults = createDefaultConfig();
  if (!isObject2(rawConfig)) {
    return { config: defaults, changed: true };
  }
  const raw = rawConfig;
  const accounts = [];
  let changed = false;
  if (Array.isArray(raw.accounts)) {
    for (let i = 0; i < raw.accounts.length; i += 1) {
      const sanitized = sanitizeAccount(raw.accounts[i], i);
      if (sanitized.account) accounts.push(sanitized.account);
      if (sanitized.changed) changed = true;
    }
    accounts.sort((a, b) => a.priority - b.priority);
  } else if (raw.accounts !== void 0) {
    changed = true;
  }
  const providerAccounts = {};
  const incomingProviderAccounts = raw.providerAccounts;
  if (isObject2(incomingProviderAccounts)) {
    for (const [provider, value] of Object.entries(incomingProviderAccounts)) {
      const normalizedEntries = normalizeAuthProviderEntries(value);
      const deduped = dedupeRawEntries(normalizedEntries);
      providerAccounts[provider] = deduped.entries;
      if (deduped.changed || normalizedEntries.length !== deduped.entries.length) {
        changed = true;
      }
      if (normalizedEntries.length === 0 && value !== void 0) {
        changed = true;
      }
    }
  } else if (incomingProviderAccounts !== void 0) {
    changed = true;
  }
  if (Object.keys(providerAccounts).length === 0 && accounts.length > 0) {
    for (const account of accounts) {
      const list = providerAccounts[account.provider] ?? [];
      list.push(account.rawEntry ?? account);
      providerAccounts[account.provider] = list;
    }
    changed = true;
  }
  const config = {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    accounts,
    providerAccounts: Object.keys(providerAccounts).length > 0 ? providerAccounts : void 0,
    authSyncProviders: void 0,
    accountMarkers: void 0,
    rotationStrategy: toRotationStrategy(raw.rotationStrategy),
    autoSwitch: typeof raw.autoSwitch === "boolean" ? raw.autoSwitch : true,
    defaultCooldownMinutes: sanitizeNumber(raw.defaultCooldownMinutes, 60, 0)
  };
  const syncProviders = sanitizeStringArray(raw.authSyncProviders);
  if (syncProviders.length > 0) {
    const unique = Array.from(new Set(syncProviders)).sort((a, b) => a.localeCompare(b));
    config.authSyncProviders = unique;
    if (unique.length !== syncProviders.length) changed = true;
  } else if (raw.authSyncProviders !== void 0) {
    changed = true;
  }
  const sanitizedMarkers = sanitizeAccountMarkers(raw.accountMarkers);
  config.accountMarkers = sanitizedMarkers.markers;
  if (sanitizedMarkers.changed) {
    changed = true;
  }
  const schemaVersion = typeof raw.schemaVersion === "number" ? raw.schemaVersion : Number.NaN;
  if (!Number.isFinite(schemaVersion) || schemaVersion !== CONFIG_SCHEMA_VERSION) {
    changed = true;
  }
  return { config, changed };
}

// src/storage.ts
var CONFIG_DIR = path.join(os.homedir(), ".config", "opencode", "multi-account");
var CONFIG_FILE = path.join(CONFIG_DIR, "accounts.json");
var STATE_FILE = path.join(CONFIG_DIR, "state.json");
var AUTH_JSON_CANDIDATES = (() => {
  const candidates = [
    path.join(os.homedir(), ".local", "share", "opencode", "auth.json"),
    path.join(os.homedir(), ".config", "opencode", "auth.json"),
    path.join(process.cwd(), "auth.json")
  ];
  const appData = process.env.APPDATA;
  const localAppData = process.env.LOCALAPPDATA;
  if (appData) candidates.push(path.join(appData, "opencode", "auth.json"));
  if (localAppData) candidates.push(path.join(localAppData, "opencode", "auth.json"));
  const seen = /* @__PURE__ */ new Set();
  return candidates.filter((candidate) => {
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    return true;
  });
})();
function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}
function loadConfig() {
  ensureDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = createDefaultConfig();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), "utf8");
    return defaultConfig;
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const migrated = migrateConfig(parsed);
    if (migrated.changed) {
      saveConfig(migrated.config);
    }
    return migrated.config;
  } catch {
    throw new Error(`[multi-account] Gagal membaca ${CONFIG_FILE}. Pastikan format JSON valid.`);
  }
}
function loadState() {
  ensureDir();
  if (!fs.existsSync(STATE_FILE)) {
    return {
      currentAccountId: null,
      accountStates: {},
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      currentAccountId: null,
      accountStates: {},
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
function saveState(state) {
  ensureDir();
  state.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}
function saveConfig(config) {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
}
function getActiveAuthJsonPath() {
  for (const authFile of AUTH_JSON_CANDIDATES) {
    if (fs.existsSync(authFile)) return authFile;
  }
  return null;
}
function loadAuthJson() {
  const activePath = getActiveAuthJsonPath();
  if (!activePath) return null;
  try {
    const raw = fs.readFileSync(activePath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
function overwriteAuthJsonProvider(provider, rawEntry) {
  const activePath = getActiveAuthJsonPath();
  if (!activePath || !rawEntry) return;
  try {
    const raw = fs.readFileSync(activePath, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      if (typeof rawEntry === "string") {
        parsed[provider] = {
          type: "api_key",
          access: rawEntry
        };
      } else {
        parsed[provider] = rawEntry;
      }
      fs.writeFileSync(activePath, JSON.stringify(parsed, null, 2), "utf8");
    }
  } catch {
  }
}

// src/rate-limiter.ts
var RATE_LIMIT_PATTERNS = [
  /429/,
  // status code in JSON/string
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
  /ratelimit/i
];
function toLower(value) {
  return typeof value === "string" ? value.toLowerCase() : "";
}
function readCodeOrType(obj, key) {
  const val = obj[key];
  if (typeof val === "string" && val.trim().length > 0) return val.toLowerCase();
  return void 0;
}
function hasRateLimitHeaders(headers) {
  if (typeof headers !== "object" || headers === null) return false;
  const h = headers;
  const headerKeys = Object.keys(h).map((k) => k.toLowerCase());
  if (headerKeys.some((k) => k.includes("x-ratelimit-exceeded") || k.includes("retry-after"))) return true;
  const remaining = toLower(h["x-ratelimit-remaining"]) || toLower(h["x-ratelimit-user-remaining"]);
  if (remaining === "0" || remaining === "0.0") return true;
  return false;
}
function hasStatus429(obj) {
  if (typeof obj !== "object" || obj === null) return false;
  const statusCode = obj.statusCode;
  if (typeof statusCode === "number" && statusCode === 429) return true;
  if (typeof statusCode === "string" && statusCode.trim() === "429") return true;
  const status = obj.status;
  if (typeof status === "number" && status === 429) return true;
  if (typeof status === "string" && status.trim() === "429") return true;
  return false;
}
function hasRateLimitCode(obj) {
  if (typeof obj !== "object" || obj === null) return false;
  const rec = obj;
  const codeCandidates = [
    readCodeOrType(rec, "code"),
    readCodeOrType(rec, "type"),
    readCodeOrType(rec, "status"),
    readCodeOrType(rec, "error")
  ].filter(Boolean);
  const nestedError = rec.error;
  if (typeof nestedError === "object" && nestedError !== null) {
    const nested = nestedError;
    codeCandidates.push(
      readCodeOrType(nested, "code") ?? "",
      readCodeOrType(nested, "type") ?? "",
      readCodeOrType(nested, "status") ?? ""
    );
  }
  const normalized = codeCandidates.filter((c) => c.length > 0);
  if (normalized.length === 0) return false;
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
    "tokens_per_minute_limit"
  ];
  return normalized.some((code) => known.some((k) => code.includes(k)));
}
function extractStrings(err) {
  const strings = [];
  if (typeof err === "string") strings.push(err);
  if (typeof err === "object" && err !== null) {
    try {
      strings.push(JSON.stringify(err));
    } catch {
    }
    const maybeBody = err.responseBody ?? err.body;
    if (typeof maybeBody === "string") strings.push(maybeBody);
  }
  return strings;
}
function isRateLimitError(error) {
  if (hasStatus429(error)) return true;
  if (typeof error === "object" && error !== null) {
    const headers = error.responseHeaders ?? error.headers;
    if (hasRateLimitHeaders(headers)) return true;
    if (hasRateLimitCode(error)) return true;
  }
  const candidates = extractStrings(error);
  for (const candidate of candidates) {
    if (RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(candidate))) return true;
  }
  return false;
}
function isAccountRateLimited(account, rateLimitUntil) {
  if (!rateLimitUntil) return false;
  return /* @__PURE__ */ new Date() < new Date(rateLimitUntil);
}
function calcRateLimitExpiry(account, defaultCooldownMinutes) {
  const cooldown = account.cooldownMinutes ?? defaultCooldownMinutes;
  const expiry = /* @__PURE__ */ new Date();
  expiry.setMinutes(expiry.getMinutes() + cooldown);
  return expiry.toISOString();
}
function formatCooldownRemaining(rateLimitUntil) {
  const remaining = new Date(rateLimitUntil).getTime() - Date.now();
  if (remaining <= 0) return "expired";
  const minutes = Math.floor(remaining / 6e4);
  const seconds = Math.floor(remaining % 6e4 / 1e3);
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// src/account-manager.ts
var AccountManager = class {
  // In-memory provider-scoped pools derived from config/accounts
  providerPools = {};
  config = createDefaultConfig();
  state = {
    currentAccountId: null,
    accountStates: {},
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
  };
  // Tracking untuk deteksi "Rapid Retry" (Heuristic Rate Limit Detection)
  lastRequestMetadata = /* @__PURE__ */ new Map();
  /** 
   * Melacak frekuensi request secara agresif. Jika akun yang sama dipanggil kembali 
   * dalam jendela waktu 120 detik, kita asumsikan request sebelumnya GAGAL (karena limit).
   * Ini adalah kunci penyelamatan utama untuk Web UI.
   */
  trackRequestAndFix(provider, accountId) {
    const now = Date.now();
    const key = `global:${provider}:${accountId}`;
    const last = this.lastRequestMetadata.get(key);
    this.lastRequestMetadata.set(key, { time: now, id: accountId });
    if (last && now - last.time < 12e4) {
      const result = this.handleRateLimit(accountId);
      return result.nextAccount;
    }
    return this._findAccountById(accountId);
  }
  getState() {
    return this.state;
  }
  /** Build in-memory provider-scoped pools from current accounts OR providerAccounts */
  _buildProviderPools() {
    const pools = {};
    if (this.config.providerAccounts) {
      for (const [provider, rawList] of Object.entries(this.config.providerAccounts)) {
        const providerEntries = [];
        const list = normalizeAuthProviderEntries(rawList);
        for (let idx = 0; idx < list.length; idx++) {
          const raw = list[idx];
          const synthetic = buildAutoAccountFromAuthEntry(provider, raw);
          if (!synthetic) continue;
          synthetic.id = `${provider}::${idx + 1}`;
          synthetic.name = `OpenCode ${provider} Entry ${idx + 1}`;
          synthetic.priority = idx + 1;
          synthetic.rawEntry = raw;
          providerEntries.push(synthetic);
        }
        pools[provider] = providerEntries;
      }
    }
    for (const acc of this.config.accounts) {
      const list = pools[acc.provider] ?? [];
      list.push(acc);
      pools[acc.provider] = list;
    }
    for (const prov of Object.keys(pools)) {
      pools[prov].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.id.localeCompare(b.id);
      });
    }
    this.providerPools = pools;
  }
  constructor() {
    this.reload();
  }
  _parseProviderScopedId(accountId) {
    const [provider, rawIndex] = accountId.split("::");
    if (!provider || !rawIndex) return null;
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index <= 0) return null;
    return { provider, index };
  }
  _findAccountById(accountId) {
    for (const pool of Object.values(this.providerPools)) {
      const found = pool.find((acc) => acc.id === accountId);
      if (found) return found;
    }
    return this.config.accounts.find((acc) => acc.id === accountId) ?? null;
  }
  _pickFirstAvailableFromPool(pool, excludeId, startAfterId) {
    const startIndex = startAfterId ? pool.findIndex((acc) => acc.id === startAfterId) + 1 : 0;
    const begin = Math.max(0, startIndex);
    for (let count = 0; count < pool.length; count += 1) {
      const i = (begin + count) % pool.length;
      const candidate = pool[i];
      if (candidate.id === excludeId) continue;
      const accState = this.state.accountStates[candidate.id];
      const validation = validateAccountCredentials(candidate);
      if (!validation.valid) continue;
      if (!accState) return candidate;
      if (accState.status === "disabled") continue;
      if (!isAccountRateLimited(candidate, accState.rateLimitUntil)) return candidate;
    }
    return null;
  }
  /** Jelaskan status semua akun dalam pool provider (untuk debugging rotasi) */
  describeProviderPool(provider, excludeId, startAfterId) {
    const pool = this.providerPools[provider] ?? [];
    if (pool.length === 0) return `Pool kosong untuk provider ${provider}`;
    const lines = [];
    const startIndex = startAfterId ? pool.findIndex((acc) => acc.id === startAfterId) + 1 : 0;
    const begin = Math.max(0, startIndex);
    for (let i = 0; i < pool.length; i += 1) {
      const acc = pool[i];
      const accState = this.state.accountStates[acc.id];
      const validation = validateAccountCredentials(acc);
      const rateLimited = accState?.status === "rate_limited" && isAccountRateLimited(acc, accState.rateLimitUntil);
      const disabled = accState?.status === "disabled";
      const skippedByPosition = i < begin;
      const skippedByExclude = excludeId && acc.id === excludeId;
      const reasons = [];
      if (!validation.valid) reasons.push(`invalid_credentials: ${validation.reason ?? "unknown"}`);
      if (rateLimited) reasons.push(`rate_limited${accState?.rateLimitUntil ? ` until ${accState.rateLimitUntil}` : ""}`);
      if (disabled) reasons.push("disabled");
      if (skippedByPosition) reasons.push("before-current");
      if (skippedByExclude) reasons.push("excludeId");
      const eligible = reasons.length === 0 ? "eligible" : reasons.join("; ");
      const marker = this.state.currentAccountId === acc.id ? "(current)" : "";
      lines.push(`[P${acc.priority}] ${acc.id} ${marker} :: ${eligible}`);
    }
    return lines.join("\n");
  }
  _buildAccountMarkersSnapshot(previous) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const accounts = this.getAllAccounts();
    if (accounts.length === 0) return void 0;
    const markers = {};
    for (const account of accounts) {
      const runtime = this.state.accountStates[account.id];
      const status = runtime?.status ?? "active";
      const rateLimitUntil = runtime?.rateLimitUntil;
      const prev = previous?.[account.id];
      const unchanged = prev && prev.status === status && (prev.rateLimitUntil ?? void 0) === (rateLimitUntil ?? void 0);
      const marker = {
        status,
        rateLimitUntil,
        updatedAt: unchanged ? prev.updatedAt : now
      };
      markers[account.id] = marker;
    }
    return Object.keys(markers).length > 0 ? markers : void 0;
  }
  _syncAccountMarkersToConfig() {
    this._resetExpiredRateLimits();
    const latestConfig = loadConfig();
    const prevMarkers = latestConfig.accountMarkers;
    const nextMarkers = this._buildAccountMarkersSnapshot(prevMarkers);
    const prevFingerprint = JSON.stringify(prevMarkers ?? {});
    const nextFingerprint = JSON.stringify(nextMarkers ?? {});
    if (prevFingerprint === nextFingerprint) return;
    latestConfig.accountMarkers = nextMarkers;
    this.config.accountMarkers = nextMarkers;
    saveConfig(latestConfig);
  }
  /** Reload config & state dari disk (berguna setelah user edit accounts.json atau auth update) */
  reload() {
    this.config = loadConfig();
    this._mergeAuthJson();
    this._buildProviderPools();
    this.state = loadState();
    this._reconcileStateWithConfig();
    this._resetExpiredRateLimits();
    this._ensureCurrentAccount();
    this._syncAccountMarkersToConfig();
  }
  _reconcileStateWithConfig() {
    const validIds = /* @__PURE__ */ new Set();
    if (Object.keys(this.providerPools).length > 0) {
      for (const prov of Object.keys(this.providerPools)) {
        for (const acc of this.providerPools[prov]) validIds.add(acc.id);
      }
    } else {
      for (const account of this.config.accounts) validIds.add(account.id);
    }
    let changed = false;
    for (const stateId of Object.keys(this.state.accountStates)) {
      if (!validIds.has(stateId)) {
        delete this.state.accountStates[stateId];
        changed = true;
      }
    }
    if (this.state.currentAccountId && !validIds.has(this.state.currentAccountId)) {
      this.state.currentAccountId = null;
      changed = true;
    }
    if (changed) {
      saveState(this.state);
    }
  }
  /** Merge akun-akun bawaan OpenCode GUI ke dalam sistem ini agar bisa ikut dirotasi
   * Migration path now targets providerAccounts as primary storage.
   */
  _mergeAuthJson() {
    const authData = loadAuthJson();
    if (!authData) return;
    const provMap = { ...this.config.providerAccounts ?? {} };
    const nextSynced = /* @__PURE__ */ new Set();
    let changed = false;
    for (const [provider, value] of Object.entries(authData)) {
      nextSynced.add(provider);
      const newFromAuth = normalizeAuthProviderEntries(value);
      const incomingDeduped = dedupeRawEntries(newFromAuth);
      const incomingEntries = normalizeAuthProviderEntries(incomingDeduped.entries);
      if (incomingEntries.length === 0) continue;
      const currentNormalized = normalizeAuthProviderEntries(provMap[provider]);
      const currentDeduped = dedupeRawEntries(currentNormalized);
      const currentEntries = normalizeAuthProviderEntries(currentDeduped.entries);
      const mergedDeduped = dedupeRawEntries([...currentEntries, ...incomingEntries]);
      const mergedEntries = normalizeAuthProviderEntries(mergedDeduped.entries);
      const beforeFingerprint = currentEntries.map((entry) => stableEntryFingerprint(entry)).join("|");
      const afterFingerprint = mergedEntries.map((entry) => stableEntryFingerprint(entry)).join("|");
      if (beforeFingerprint !== afterFingerprint || incomingDeduped.changed || currentDeduped.changed) {
        changed = true;
      }
      provMap[provider] = mergedEntries;
    }
    const nextSyncedList = Array.from(nextSynced).sort((a, b) => a.localeCompare(b));
    const prevSyncedList = [...this.config.authSyncProviders ?? []].sort((a, b) => a.localeCompare(b));
    if (nextSyncedList.join("|") !== prevSyncedList.join("|")) {
      changed = true;
    }
    if (changed) {
      const finalProviders = {};
      for (const [prov, entries] of Object.entries(provMap)) {
        if (entries.length > 0) {
          finalProviders[prov] = entries;
        }
      }
      this.config.providerAccounts = Object.keys(finalProviders).length > 0 ? finalProviders : void 0;
      this.config.authSyncProviders = nextSyncedList.length > 0 ? nextSyncedList : void 0;
      saveConfig(this.config);
    }
  }
  /** Ambil semua akun (synthesized providerAccounts if present) */
  getAllAccounts() {
    const accs = [];
    for (const prov of Object.keys(this.providerPools)) accs.push(...this.providerPools[prov]);
    return accs.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.id.localeCompare(b.id);
    });
  }
  /** Ambil akun yang sedang aktif (synthesized or legacy) */
  getCurrentAccount() {
    if (!this.state.currentAccountId) return null;
    return this._findAccountById(this.state.currentAccountId);
  }
  /** Ambil ID akun yang sedang aktif */
  getCurrentAccountId() {
    return this.state.currentAccountId;
  }
  /** Ambil akun berikutnya yang tidak sedang rate-limited */
  getNextAvailableAccount(excludeId, providerScope) {
    if (providerScope) {
      const pool = this.providerPools[providerScope] ?? [];
      return this._pickFirstAvailableFromPool(pool, excludeId);
    }
    const current = this.getCurrentAccount();
    if (current) {
      const pool = this.providerPools[current.provider] ?? [];
      const candidate = this._pickFirstAvailableFromPool(pool, excludeId, current.id);
      if (candidate) return candidate;
    }
    const providers = Object.keys(this.providerPools).sort((a, b) => a.localeCompare(b));
    for (const provider of providers) {
      if (current && provider === current.provider) continue;
      const pool = this.providerPools[provider] ?? [];
      const candidate = this._pickFirstAvailableFromPool(pool, excludeId);
      if (candidate) return candidate;
    }
    return null;
  }
  /** Cek apakah semua akun sedang rate-limited atau disabled */
  areAllAccountsExhausted() {
    const available = this.getNextAvailableAccount();
    return available === null;
  }
  /**
   * Tandai akun sebagai rate-limited dan switch ke akun berikutnya.
   * Return { switched: boolean, nextAccount: Account | null, allExhausted: boolean }
   */
  handleRateLimit(accountId) {
    const account = this._findAccountById(accountId);
    const expiry = account ? calcRateLimitExpiry(account, this.config.defaultCooldownMinutes) : (() => {
      const fallbackExpiry = /* @__PURE__ */ new Date();
      fallbackExpiry.setMinutes(
        fallbackExpiry.getMinutes() + this.config.defaultCooldownMinutes
      );
      return fallbackExpiry.toISOString();
    })();
    this.state.accountStates[accountId] = {
      status: "rate_limited",
      rateLimitUntil: expiry
    };
    const providerScope = account?.provider;
    const next = providerScope ? this.getNextAvailableAccount(accountId, providerScope) : this.getNextAvailableAccount(accountId);
    if (next) {
      this.state.currentAccountId = next.id;
      this.state.accountStates[next.id] = {
        status: "active"
      };
      if (next.rawEntry && next.provider) {
        overwriteAuthJsonProvider(next.provider, next.rawEntry);
      }
      saveState(this.state);
      this._syncAccountMarkersToConfig();
      return { switched: true, nextAccount: next, allExhausted: false };
    } else {
      this.state.currentAccountId = null;
      saveState(this.state);
      this._syncAccountMarkersToConfig();
      return { switched: false, nextAccount: null, allExhausted: true };
    }
  }
  /** Switch manual ke akun berdasarkan ID */
  switchToAccount(accountId) {
    const account = this._findAccountById(accountId);
    if (!account) return { account: null, reason: "not_found" };
    const validation = validateAccountCredentials(account);
    if (!validation.valid) return { account: null, reason: "disabled" };
    const accState = this.state.accountStates[accountId];
    if (accState?.status === "disabled") {
      return { account: null, reason: "disabled" };
    }
    if (accState?.status === "rate_limited" && accState.rateLimitUntil && isAccountRateLimited(account, accState.rateLimitUntil)) {
      return { account: null, reason: "rate_limited" };
    }
    this.state.currentAccountId = accountId;
    this.state.accountStates[accountId] = { status: "active" };
    saveState(this.state);
    this._syncAccountMarkersToConfig();
    return { account };
  }
  /** Tambah akun baru */
  addAccount(account) {
    if (this.config.accounts.find((a) => a.id === account.id)) {
      return { success: false, message: `Akun dengan ID "${account.id}" sudah ada.` };
    }
    const normalized = normalizeAccount(account).account;
    const validation = validateAccountCredentials(normalized);
    if (!validation.valid) {
      return { success: false, message: validation.reason ?? "Credential akun tidak valid." };
    }
    this.config.accounts.push(normalized);
    saveConfig(this.config);
    this._buildProviderPools();
    this._ensureCurrentAccount();
    this._syncAccountMarkersToConfig();
    return { success: true, message: `Akun "${account.name}" berhasil ditambahkan dengan priority P${account.priority}.` };
  }
  /** Hapus akun berdasarkan ID (providerAccounts supported in next phase) */
  removeAccount(accountId) {
    const scoped = this._parseProviderScopedId(accountId);
    if (scoped && this.config.providerAccounts?.[scoped.provider]) {
      const list = normalizeAuthProviderEntries(this.config.providerAccounts[scoped.provider]);
      if (scoped.index <= list.length) {
        list.splice(scoped.index - 1, 1);
        this.config.providerAccounts[scoped.provider] = list;
        if (list.length === 0) {
          delete this.config.providerAccounts[scoped.provider];
        }
        if (this.config.providerAccounts && Object.keys(this.config.providerAccounts).length === 0) {
          this.config.providerAccounts = void 0;
        }
        delete this.state.accountStates[accountId];
        if (this.state.currentAccountId === accountId) {
          this.state.currentAccountId = null;
        }
        this._buildProviderPools();
        this._ensureCurrentAccount();
        saveConfig(this.config);
        saveState(this.state);
        this._syncAccountMarkersToConfig();
        return { success: true, message: `Akun scoped "${accountId}" berhasil dihapus.` };
      }
    }
    const idx = this.config.accounts.findIndex((a) => a.id === accountId);
    if (idx !== -1) {
      const removed = this.config.accounts.splice(idx, 1)[0];
      delete this.state.accountStates[accountId];
      if (this.state.currentAccountId === accountId) {
        this.state.currentAccountId = null;
        this._ensureCurrentAccount();
      }
      saveConfig(this.config);
      saveState(this.state);
      this._syncAccountMarkersToConfig();
      return { success: true, message: `Akun "${removed.name}" (${removed.provider}) berhasil dihapus.` };
    }
    return { success: false, message: `Akun dengan ID "${accountId}" tidak ditemukan.` };
  }
  /** Update akun — partial update berdasarkan ID */
  updateAccount(accountId, updates) {
    if (this._parseProviderScopedId(accountId)) {
      return {
        success: false,
        message: "Akun dari auth/providerAccounts tidak dapat diupdate langsung. Ubah sumber auth.json atau gunakan akun manual (legacy accounts)."
      };
    }
    const account = this.config.accounts.find((a) => a.id === accountId);
    if (!account) {
      return { success: false, message: `Akun dengan ID "${accountId}" tidak ditemukan.` };
    }
    const snapshot = JSON.stringify(account);
    Object.assign(account, updates);
    const normalized = normalizeAccount(account).account;
    const validation = validateAccountCredentials(normalized);
    if (!validation.valid) {
      Object.assign(account, JSON.parse(snapshot));
      return { success: false, message: validation.reason ?? "Credential akun tidak valid." };
    }
    saveConfig(this.config);
    this._buildProviderPools();
    return { success: true, message: `Akun "${account.name}" berhasil diperbarui.` };
  }
  /** Reset rate limit untuk akun yang sudah melewati cooldown */
  _resetExpiredRateLimits() {
    let changed = false;
    for (const [id, accState] of Object.entries(this.state.accountStates)) {
      if (accState.status === "rate_limited" && accState.rateLimitUntil && /* @__PURE__ */ new Date() >= new Date(accState.rateLimitUntil)) {
        this.state.accountStates[id] = { status: "active" };
        changed = true;
      }
    }
    if (changed) saveState(this.state);
  }
  /** Pastikan ada akun aktif saat startup */
  _ensureCurrentAccount() {
    if (!this.state.currentAccountId || !this._findAccountById(this.state.currentAccountId)) {
      const first = this.getNextAvailableAccount();
      if (first) {
        this.state.currentAccountId = first.id;
        this.state.accountStates[first.id] = { status: "active" };
        saveState(this.state);
      }
    }
  }
  /** Ambil ringkasan status semua akun */
  getStatusSummary() {
    const accounts = this.getAllAccounts();
    if (accounts.length === 0) {
      return "\u26A0\uFE0F  Tidak ada akun terdaftar. Edit: ~/.config/opencode/multi-account/accounts.json";
    }
    const lines = ["\u{1F4CB} Status Multi-Account Manager\n"];
    for (const account of accounts) {
      const accState = this.state.accountStates[account.id];
      const current = this.state.currentAccountId === account.id;
      let statusIcon = "\u2705";
      let statusText = "aktif";
      if (accState?.status === "rate_limited" && accState.rateLimitUntil) {
        if (isAccountRateLimited(account, accState.rateLimitUntil)) {
          statusIcon = "\u23F3";
          statusText = `rate-limited (${formatCooldownRemaining(accState.rateLimitUntil)})`;
        } else {
          statusIcon = "\u2705";
          statusText = "aktif (cooldown selesai)";
        }
      } else if (accState?.status === "disabled") {
        statusIcon = "\u{1F6AB}";
        statusText = "disabled";
      }
      const currentMarker = current ? " \u2190 AKTIF SEKARANG" : "";
      lines.push(
        `${statusIcon} [P${account.priority}] ${account.name} (${account.provider})${currentMarker}
   Status: ${statusText}`
      );
    }
    return lines.join("\n");
  }
  /** Mencari akun berdasarkan provider dan secret (apiKey/accessToken) */
  _findAccountBySecret(provider, secret) {
    const pool = this.providerPools[provider] ?? [];
    for (const acc of pool) {
      if (!acc.rawEntry) continue;
      const logicalToken = acc.rawEntry?.access || acc.rawEntry?.apiKey;
      if (logicalToken === secret) return acc;
    }
    return null;
  }
  lastAuthMtime = 0;
  lastStateUpdated = "";
  /**
   * Universal Sync (Polite Smart Sync): Memastikan auth.json sehat tanpa memaksakan kehendak.
   * Hanya akan menimpa auth.json jika kunci yang sedang digunakan terdeteksi RATE LIMIT.
   */
  universalSyncAuthJson() {
    const activePath = getActiveAuthJsonPath();
    if (!activePath) return { synced: false, providers: [] };
    try {
      const stat = fs2.statSync(activePath);
      const mtime = stat.mtimeMs;
      this.reload();
      const authData = loadAuthJson();
      if (!authData) return { synced: false, providers: [] };
      const syncedProviders = [];
      let anyStateChanged = false;
      for (const provider of Object.keys(authData)) {
        const pool = this.providerPools[provider];
        if (!pool || pool.length === 0) continue;
        const physicalEntry = authData[provider];
        const physicalToken = physicalEntry?.access || physicalEntry?.apiKey;
        if (!physicalToken) continue;
        const physicalAccount = this._findAccountBySecret(provider, physicalToken);
        const best = this.getNextAvailableAccount(void 0, provider);
        if (!best || !best.rawEntry) continue;
        const logicalToken = best.rawEntry?.access || best.rawEntry?.apiKey;
        const isDifferent = physicalToken !== logicalToken;
        const accState = physicalAccount ? this.state.accountStates[physicalAccount.id] : null;
        const knownLimited = physicalAccount && accState?.status === "rate_limited" && isAccountRateLimited(physicalAccount, accState.rateLimitUntil);
        const ageSeconds = (Date.now() - mtime) / 1e3;
        if (knownLimited) {
          const entryToSync = best.rawEntry || best.apiKey;
          if (entryToSync) {
            overwriteAuthJsonProvider(provider, entryToSync);
            syncedProviders.push(provider);
            anyStateChanged = true;
            const nextStat = fs2.statSync(activePath);
            this.lastAuthMtime = nextStat.mtimeMs;
            this.state.currentAccountId = best.id;
          }
        } else if (isDifferent) {
          if (physicalAccount) {
            if (this.state.currentAccountId !== physicalAccount.id) {
              this.state.currentAccountId = physicalAccount.id;
              anyStateChanged = true;
              const nextStat = fs2.statSync(activePath);
              this.lastAuthMtime = nextStat.mtimeMs;
            }
          } else if (ageSeconds > 2) {
            const entryToSync = best.rawEntry || best.apiKey;
            if (entryToSync) {
              overwriteAuthJsonProvider(provider, entryToSync);
              syncedProviders.push(provider);
              anyStateChanged = true;
              const nextStat = fs2.statSync(activePath);
              this.lastAuthMtime = nextStat.mtimeMs;
              this.state.currentAccountId = best.id;
            }
          }
        }
      }
      if (anyStateChanged) {
        saveState(this.state);
        this._syncAccountMarkersToConfig();
      }
      return { synced: syncedProviders.length > 0, providers: syncedProviders };
    } catch {
      return { synced: false, providers: [] };
    }
  }
};

// src/index.ts
var DEBUG_DIR = path2.join(os2.homedir(), ".config", "opencode", "multi-account");
var MASTER_DEBUG_LOG = path2.join(DEBUG_DIR, "multi-account-debug.log");
function debugLog(msg) {
  try {
    if (!fs3.existsSync(DEBUG_DIR)) fs3.mkdirSync(DEBUG_DIR, { recursive: true });
    fs3.appendFileSync(MASTER_DEBUG_LOG, `[${(/* @__PURE__ */ new Date()).toISOString()}] ${msg}
`);
  } catch (e) {
  }
}
var GLOBAL_PLUGIN_FLAG = "__opencode_multi_account_plugin_loaded__";
var MultiAccountPlugin = async ({ client }) => {
  debugLog("\u{1F680} MultiAccountPlugin Restoration Started (Universal Edition)");
  const globalState = globalThis;
  if (globalState[GLOBAL_PLUGIN_FLAG]) {
    debugLog("\u26A0\uFE0F MultiAccountPlugin already loaded, skipping duplicate");
    return {};
  }
  globalState[GLOBAL_PLUGIN_FLAG] = true;
  const manager = new AccountManager();
  let PluginState;
  ((PluginState2) => {
    PluginState2["IDLE"] = "IDLE";
    PluginState2["STREAMING"] = "STREAMING";
    PluginState2["ROTATING"] = "ROTATING";
  })(PluginState || (PluginState = {}));
  let currentState = "IDLE" /* IDLE */;
  let lastActivity = Date.now();
  let lastSessionID = null;
  const forceRotateAndAbort = async (source, sessionID) => {
    manager.reload();
    const currentId = manager.getCurrentAccountId();
    if (!currentId) return;
    const result = manager.handleRateLimit(currentId);
    if (result.switched) {
      debugLog(`\u{1F6A8} [HARD RESET] Source: ${source} triggered rotate + abort for session: ${sessionID}`);
      if (sessionID) {
        try {
          await client.session.abort({ path: { id: sessionID } }).catch(() => {
          });
          await client.tui.showToast({
            body: {
              title: "\u{1F504} Rotasi Akun Otomatis",
              message: `Limit tercapai. Sesi dihentikan & akun diputar ke: ${result.nextAccount?.name}. Silakan coba lagi.`,
              type: "info"
            }
          }).catch(() => {
          });
        } catch (e) {
        }
      }
      await log("warn", `\u{1F6A8} Peluncur Otomatis (${source}): Memutar akun ke ${result.nextAccount?.name} dan memutus sesi macet.`, {
        from: currentId,
        to: result.nextAccount?.id
      });
      lastActivity = Date.now();
    }
  };
  const coreClient = client._client;
  if (coreClient && typeof coreClient.request === "function") {
    const originalRequest = coreClient.request.bind(coreClient);
    coreClient.request = async (options) => {
      currentState = "STREAMING" /* STREAMING */;
      lastActivity = Date.now();
      const sessionID = options.path?.id || options.path?.sessionID || lastSessionID;
      if (sessionID) lastSessionID = sessionID;
      try {
        const result = await originalRequest(options);
        const response = result.response;
        if (response && response.status === 429) {
          debugLog(`\u{1F6A8} [INTERCEPTOR PRIME] HTTP 429 DETECTED! Status: ${response.status}`);
          currentState = "ROTATING" /* ROTATING */;
          await forceRotateAndAbort("interceptor-prime", lastSessionID);
          currentState = "IDLE" /* IDLE */;
        }
        return result;
      } catch (error) {
        const errMsg = extractEventMessage(error);
        if (isRateLimitError(error) || isRateLimitError(errMsg)) {
          debugLog(`\u{1F6A8} [INTERCEPTOR PRIME] RATE LIMIT ERROR DETECTED!`);
          currentState = "ROTATING" /* ROTATING */;
          await forceRotateAndAbort("interceptor-prime-error", lastSessionID);
          currentState = "IDLE" /* IDLE */;
        }
        throw error;
      }
    };
  }
  setInterval(async () => {
    if (currentState !== "STREAMING" /* STREAMING */) return;
    const now = Date.now();
    const diff = now - lastActivity;
    if (diff > 8e3 && currentState === "STREAMING" /* STREAMING */) {
      debugLog(`\u26A0\uFE0F [WATCHDOG] STREAM STALL! (State: ${currentState}, Stalled for ${Math.round(diff / 1e3)}s)`);
      currentState = "ROTATING" /* ROTATING */;
      await forceRotateAndAbort("watchdog-stall", lastSessionID);
      currentState = "IDLE" /* IDLE */;
    }
    if (diff > 6e4) {
      debugLog(`\u{1F3E5} [SAFETY] Resetting stuck STREAMING state to IDLE`);
      currentState = "IDLE" /* IDLE */;
    }
  }, 3e3);
  setInterval(async () => {
    try {
      manager.reload();
      const result = manager.universalSyncAuthJson();
      if (result.synced) {
        debugLog(`\u{1F504} Master Sync: auth.json forced to healthy state for ${result.providers.join(", ")}`);
      }
    } catch (e) {
    }
  }, 1e4);
  async function log(level, message, extra) {
    try {
      await client.app.log({
        body: {
          service: "multi-account",
          level,
          message,
          extra: extra ?? {}
        }
      });
    } catch (e) {
    }
  }
  function extractEventMessage(eventPayload) {
    if (typeof eventPayload === "string") return eventPayload;
    if (typeof eventPayload === "object" && eventPayload !== null) {
      const p = eventPayload;
      return p.properties?.status?.message || p.properties?.error?.message || p.properties?.error || p.error?.message || p.message || p.properties?.message || JSON.stringify(eventPayload);
    }
    return String(eventPayload);
  }
  for (const authPath of AUTH_JSON_CANDIDATES) {
    if (!fs3.existsSync(authPath)) continue;
    try {
      const dir = path2.dirname(authPath);
      fs3.watch(dir, (eventType, filename) => {
        if (filename === "auth.json" || authPath.endsWith("auth.json")) {
          setTimeout(() => {
            manager.reload();
            debugLog(`\u{1F504} auth.json berubah (fs.watch), auto-sync aktif.`);
          }, 500);
        }
      });
    } catch {
    }
  }
  const onPossibleError = async (payload, source) => {
    let extraText;
    if (payload?.type === "message.part.updated") {
      const p = payload.properties || {};
      if (typeof p.content === "string") extraText = p.content;
      const part = p.part || {};
      if (typeof part.content === "string") extraText = part.content;
      if (typeof part.text === "string") extraText = part.text;
      if (typeof p.text === "string") extraText = p.text;
    }
    const rawMsg = extractEventMessage(payload);
    const isLimit = isRateLimitError(payload) || isRateLimitError(rawMsg) || extraText && isRateLimitError(extraText);
    if (isLimit) {
      if (extraText && isRateLimitError(extraText)) {
        debugLog(`\u{1F3AF} [DEEP PARSE] Pesan retry ditemukan di stream: "${extraText.substring(0, 50)}..."`);
      }
      currentState = "ROTATING" /* ROTATING */;
      await forceRotateAndAbort(source, lastSessionID);
      currentState = "IDLE" /* IDLE */;
    }
  };
  return {
    // ─── Inject API key aktif ke shell environment ──────────
    "shell.env": async (input, output) => {
      try {
        if (!output.env) output.env = {};
        if (input.sessionID) lastSessionID = input.sessionID;
        currentState = "STREAMING" /* STREAMING */;
        lastActivity = Date.now();
        manager.reload();
        const requestedProvider = input?.model?.providerID || input?.provider?.id;
        let account = manager.getCurrentAccount();
        if (requestedProvider && account?.provider !== requestedProvider) {
          const candidate = manager.getNextAvailableAccount(void 0, requestedProvider);
          if (candidate) {
            manager.switchToAccount(candidate.id);
            account = candidate;
          }
        }
        if (account) {
          const env = resolveAccountEnv(account);
          for (const [key, value] of Object.entries(env)) {
            output.env[key] = value;
            process.env[key] = value;
          }
        }
      } catch (err) {
      }
    },
    // ─── Inject Authentication ke HTTP Header (Full Provider Support) ──
    "chat.headers": async (input, output) => {
      try {
        if (!output.headers) output.headers = {};
        if (input.sessionID) lastSessionID = input.sessionID;
        currentState = "STREAMING" /* STREAMING */;
        lastActivity = Date.now();
        manager.reload();
        const requestedProvider = input?.model?.providerID || input?.provider?.id;
        let account = manager.getCurrentAccount();
        if (requestedProvider && account?.provider !== requestedProvider) {
          const candidate = manager.getNextAvailableAccount(void 0, requestedProvider);
          if (candidate) {
            manager.switchToAccount(candidate.id);
            account = candidate;
          }
        }
        if (!account) return;
        const rescued = manager.trackRequestAndFix(requestedProvider || account.provider, account.id);
        if (rescued && rescued.id !== account.id) {
          await log("info", `\u{1F504} Autopilot: Deteksi retry loop, memutar kunci ke ${rescued.name}`);
          account = rescued;
        }
        const env = resolveAccountEnv(account);
        const prov = account.provider.toLowerCase();
        for (const [key, value] of Object.entries(env)) {
          process.env[key] = value;
          if (prov === "anthropic") {
            output.headers["x-api-key"] = value;
            output.headers["anthropic-version"] = "2023-06-01";
          } else if (prov === "google" || prov === "gemini") {
            output.headers["x-goog-api-key"] = value;
          } else if (prov === "azure-openai") {
            output.headers["api-key"] = value;
          } else {
            if (key.toUpperCase().includes("API_KEY") || key.toUpperCase().includes("TOKEN")) {
              output.headers["Authorization"] = `Bearer ${value}`;
            }
          }
        }
      } catch (err) {
      }
    },
    // ─── Deteksi rate limit (Failsafe) ─────────────
    event: async ({ event }) => {
      lastActivity = Date.now();
      const properties = event?.properties;
      if (properties?.sessionID) lastSessionID = properties.sessionID;
      if (event?.type === "session.status") {
        const s = properties?.status;
        if (s?.type === "busy") currentState = "STREAMING" /* STREAMING */;
        if (s?.type === "idle") currentState = "IDLE" /* IDLE */;
        debugLog(`\u{1F3E5} State Transition: ${currentState} | Session: ${lastSessionID}`);
      }
      await onPossibleError(event, "event");
    },
    tool: {
      account_status: (0, import_plugin.tool)({
        description: "Tampilkan status semua akun API (aktif, rate-limited, atau disabled).",
        args: {},
        async execute() {
          manager.reload();
          return manager.getStatusSummary();
        }
      }),
      account_list: (0, import_plugin.tool)({
        description: "Tampilkan daftar semua akun API yang terdaftar.",
        args: {},
        async execute() {
          manager.reload();
          const accounts = manager.getAllAccounts();
          if (accounts.length === 0) return "Tidak ada akun terdaftar.";
          return "Daftar Akun:\n\n" + accounts.map((a) => `[P${a.priority}] id="${a.id}" | ${a.name} | Provider: ${a.provider}`).join("\n");
        }
      }),
      account_switch: (0, import_plugin.tool)({
        description: "Ganti akun manual berdasarkan ID.",
        args: { account_id: import_plugin.tool.schema.string() },
        async execute(args) {
          manager.reload();
          const result = manager.switchToAccount(args.account_id);
          return result.account ? `\u2705 Berhasil switch ke: ${result.account.name}` : "\u274C Akun tidak ditemukan atau sedang disabled.";
        }
      }),
      account_config_path: (0, import_plugin.tool)({
        description: "Tampilkan path file konfigurasi accounts.json.",
        args: {},
        async execute() {
          return `\u{1F4C1} File konfigurasi: ${CONFIG_FILE}`;
        }
      })
    }
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MultiAccountPlugin
});
