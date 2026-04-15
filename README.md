# 🔄 OpenCode Multi-Account Manager Plugin

Plugin untuk [OpenCode](https://opencode.ai) yang mengelola beberapa akun API secara otomatis. Ketika satu akun mencapai rate limit, plugin akan **otomatis berpindah ke akun berikutnya** berdasarkan prioritas.

## ✨ Fitur

- **Rotasi Prioritas** — Akun diurutkan berdasarkan prioritas (P1 → P2 → P3 dst.)
- **Auto-Switch per Provider** — Saat rate limit terdeteksi pada provider X, rotasi hanya di pool akun provider X
- **Semua Provider** — Mendukung 35+ provider yang didukung OpenCode (Anthropic, OpenAI, Google, Groq, DeepSeek, OpenRouter, xAI, dll.)
- **Notifikasi Provider Exhausted** — Memberitahu anda ketika **semua akun pada provider terkait telah habis**
- **Custom Tools** — Kelola akun langsung dari TUI OpenCode
- **Cooldown Tracking** — Akun yang rate-limited otomatis aktif kembali setelah cooldown

## 📦 Instalasi

### Cara 1: Project-level (khusus project ini)

```bash
# Salin seluruh folder ke .opencode/plugins/ di project Anda
cp -r opencode_plugin .opencode/plugins/multi-account
```

### Cara 2: Global (semua project)

```bash
# Salin seluruh folder ke global plugins
# Linux/macOS:
cp -r opencode_plugin ~/.config/opencode/plugins/multi-account

# Windows:
xcopy opencode_plugin %USERPROFILE%\.config\opencode\plugins\multi-account /E /I
```

### Cara 3: Via NPM (jika dipublish)

Tambahkan ke `opencode.json`:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-multi-account"]
}
```

## ⚙️ Konfigurasi

### 1. Buat File Akun

Salin file contoh ke lokasi konfigurasi:

```bash
# Linux/macOS:
mkdir -p ~/.config/opencode/multi-account
cp accounts.example.json ~/.config/opencode/multi-account/accounts.json

# Windows (PowerShell):
New-Item -Path "$env:USERPROFILE\.config\opencode\multi-account" -ItemType Directory -Force
Copy-Item accounts.example.json "$env:USERPROFILE\.config\opencode\multi-account\accounts.json"
```

### 2. Edit Konfigurasi

Edit file `~/.config/opencode/multi-account/accounts.json`:

```json
{
  "schemaVersion": 2,
  "accounts": [
    {
      "id": "anthropic-1",
      "name": "Anthropic Utama",
      "provider": "anthropic",
      "credentials": {
        "authType": "api_key",
        "env": {
          "ANTHROPIC_API_KEY": "sk-ant-YOUR_KEY_HERE"
        }
      },
      "priority": 1,
      "cooldownMinutes": 60
    },
    {
      "id": "anthropic-2",
      "name": "Anthropic Cadangan",
      "provider": "anthropic",
      "credentials": {
        "authType": "api_key",
        "env": {
          "ANTHROPIC_API_KEY": "sk-ant-YOUR_BACKUP_KEY"
        }
      },
      "priority": 2,
      "cooldownMinutes": 60
    },
    {
      "id": "openai-1",
      "name": "OpenAI Fallback",
      "provider": "openai",
      "credentials": {
        "authType": "api_key",
        "env": {
          "OPENAI_API_KEY": "sk-YOUR_OPENAI_KEY"
        }
      },
      "priority": 3,
      "cooldownMinutes": 60
    }
  ],
  "rotationStrategy": "priority",
  "autoSwitch": true,
  "defaultCooldownMinutes": 60
}
```

### 3. Aturan Prioritas

| Priority | Artinya |
|----------|---------|
| P1       | Digunakan pertama kali (akun utama) |
| P2       | Cadangan pertama — digunakan jika P1 rate-limited |
| P3       | Cadangan kedua — digunakan jika P1 dan P2 rate-limited |
| ...      | Dan seterusnya |

## 🔧 Properti Akun

| Field | Wajib | Deskripsi |
|-------|-------|-----------|
| `id` | ✅ | ID unik akun (string bebas) |
| `name` | ✅ | Nama tampilan akun |
| `provider` | ✅ | ID provider OpenCode (lihat daftar di bawah) |
| `credentials.authType` | ✅ | Jenis auth (`api_key`, `oauth_access_token`, `azure_openai`, `aws_bedrock`, `custom_env`) |
| `credentials.env` | ✅ | Map env var → credential (mis. `{"ANTHROPIC_API_KEY":"sk-..."}`) |
| `credentials.providerConfig` | ❌ | Konfigurasi spesifik provider (mis. endpoint/deployment untuk Azure) |
| `priority` | ✅ | Angka prioritas (1 = tertinggi) |
| `cooldownMinutes` | ❌ | Durasi cooldown setelah rate limit (default: 60) |
| `model` | ❌ | Override model saat akun ini aktif |

> Legacy format `apiKey` + `envVarName` masih didukung dan akan dimigrasi otomatis.
> `schemaVersion` akan dinaikkan otomatis saat format config berubah.

## 🌐 Provider & Environment Variable yang Didukung

| Provider | `envVarName` |
|----------|-------------|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Google Gemini | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Google Vertex AI | `GOOGLE_VERTEX_API_KEY` |
| Groq | `GROQ_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| xAI (Grok) | `XAI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` |
| Amazon Bedrock | `AWS_BEARER_TOKEN_BEDROCK` |
| Cerebras | `CEREBRAS_API_KEY` |
| Fireworks AI | `FIREWORKS_API_KEY` |
| Together AI | `TOGETHER_API_KEY` |
| Cloudflare Workers AI | `CLOUDFLARE_API_KEY` |
| Hugging Face | `HUGGINGFACE_API_KEY` |
| Deep Infra | `DEEPINFRA_API_KEY` |
| Moonshot AI | `MOONSHOT_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| Nebius | `NEBIUS_API_KEY` |
| Venice AI | `VENICE_API_KEY` |
| OpenCode Zen | `OPENCODE_API_KEY` |
| 302.AI | `AI302_API_KEY` |
| Scaleway | `SCALEWAY_API_KEY` |
| OVHcloud | `OVH_AI_ENDPOINTS_ACCESS_TOKEN` |
| Baseten | `BASETEN_API_KEY` |

## 🛠️ Custom Tools (Dari TUI)

Plugin menambahkan tools yang bisa dipanggil langsung dari OpenCode:

| Tool | Deskripsi |
|------|-----------|
| `account_status` | Lihat status semua akun (aktif, rate-limited, cooldown) |
| `account_list` | Tampilkan daftar semua akun terdaftar |
| `account_switch` | Ganti akun aktif secara manual |
| `account_add` | Tambah akun API baru |
| `account_update` | Perbarui informasi akun seperti API key atau prioritas |
| `account_remove` | Hapus akun dari daftar |
| `account_config_path` | Tampilkan lokasi file konfigurasi |

### Contoh penggunaan di TUI:

```
> Tampilkan status semua akun saya
  → OpenCode akan memanggil tool "account_status"

> Switch ke akun anthropic-2
  → OpenCode akan memanggil tool "account_switch" dengan account_id="anthropic-2"
```

## 🔄 Alur Kerja

```
         ┌──────────────┐
         │  Mulai Sesi   │
         └──────┬───────┘
                │
         ┌──────▼───────┐
         │  Akun P1      │ ← Prioritas tertinggi
         │  (Utama)      │
         └──────┬───────┘
                │ Rate Limit?
         ┌──────▼───────┐
         │  Akun P2      │ ← Auto-switch
         │  (Cadangan 1) │
         └──────┬───────┘
                │ Rate Limit?
         ┌──────▼───────┐
         │  Akun P3      │ ← Auto-switch
         │  (Cadangan 2) │
         └──────┬───────┘
                │ Rate Limit?
         ┌──────▼───────┐
         │ 🚨 NOTIFIKASI│ ← Semua akun habis!
         │  Tunggu       │
         │  Cooldown      │
         └──────────────┘
```

## 📏 Kebijakan Rotasi (Penting)

- Rotasi akun bersifat **provider-scoped**.
- Jika akun dari provider `X` terkena rate limit, sistem hanya mencari akun cadangan dari provider `X`.
- Jika semua akun di provider `X` sedang rate-limited/tidak tersedia, sistem **berhenti** dan mengirim notifikasi error.
- **Tidak ada fallback lintas provider** secara otomatis.

## 🏷️ Penanda Status di `accounts.json`

Mulai versi ini, plugin juga menulis snapshot status akun ke field `accountMarkers` di file:

- `~/.config/opencode/multi-account/accounts.json`

Tujuannya agar saat buka sesi baru, Anda bisa langsung lihat akun mana yang:

- `active`
- `rate_limited` (beserta `rateLimitUntil`)
- `disabled`

Contoh bentuk data:

```json
{
  "accountMarkers": {
    "openai::1": {
      "status": "rate_limited",
      "rateLimitUntil": "2026-04-13T10:15:00.000Z",
      "updatedAt": "2026-04-13T09:55:00.000Z"
    },
    "openai::2": {
      "status": "active",
      "updatedAt": "2026-04-13T09:55:00.000Z"
    }
  }
}
```

## 📂 Struktur File

```
opencode_plugin/
├── package.json            # Dependencies & metadata
├── tsconfig.json           # TypeScript config
├── README.md               # Dokumentasi (file ini)
├── accounts.example.json   # Contoh konfigurasi akun
└── src/
    ├── index.ts            # Entry point plugin
    ├── account-manager.ts  # Logika rotasi akun
    ├── rate-limiter.ts     # Deteksi rate limit
    ├── storage.ts          # Baca/tulis file JSON
    └── types.ts            # TypeScript interfaces
```

## ⚠️ Keamanan

> **PENTING:** File `accounts.json` berisi API key sensitif.

- Jangan commit file ini ke Git
- Tambahkan ke `.gitignore`:
  ```
  .config/opencode/multi-account/accounts.json
  .config/opencode/multi-account/state.json
  ```
- Pertimbangkan untuk menggunakan file permission yang ketat:
  ```bash
  chmod 600 ~/.config/opencode/multi-account/accounts.json
  ```

## 📝 Lisensi

MIT
