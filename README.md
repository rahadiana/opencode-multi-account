# 🔄 OpenCode Multi-Account Manager Plugin

A plugin for [OpenCode](https://opencode.ai) that automatically manages multiple API accounts. When one account hits its rate limit, the plugin will **automatically switch to the next account** based on priority.

## ✨ Features

- **Priority Rotation** — Accounts are sorted by priority (P1 → P2 → P3, etc.)
- **Provider-Level Auto-Switch** — When rate limit is detected for Provider X, rotation occurs only within Provider X's account pool.
- **All Providers Supported** — Compatible with 35+ providers supported by OpenCode (Anthropic, OpenAI, Google, Groq, DeepSeek, OpenRouter, xAI, etc.)
- **Provider Exhausted Notifications** — Alerts you when **all accounts for a provider are exhausted**.
- **Custom Tools** — Kelola akun langsung dari TUI OpenCode
- **Cooldown Tracking** — Accounts rate-limited automatically reactivate after cooldown.

## 📦 Instalasi

### Prerequisites
- Node.js 18+ (disarankan versi terbaru LTS)
- npm
- Git

- Pastikan lingkungan Anda memiliki akses jaringan untuk mengunduh dependensi saat instalasi.

### Lokasi Folder Plugin per OS

| OS | Lokasi Global Plugin | Lokasi Config Multi-Account |
|----|-----------------------|-----------------------------|
| Linux | `~/.config/opencode/plugins/` | `~/.config/opencode/multi-account/` |
| macOS | `~/.config/opencode/plugins/` | `~/.config/opencode/multi-account/` |
| Windows (PowerShell) | `$env:USERPROFILE\.config\opencode\plugins\` | `$env:USERPROFILE\.config\multi-account\` |

### Method 1: Project-level (for this project only)

```bash
# Linux/macOS (bash/zsh):
mkdir -p .opencode/plugins
cp -r opencode_plugin .opencode/plugins/multi-account

# Windows (PowerShell):
New-Item -Path ".opencode/plugins" -ItemType Directory -Force
Copy-Item opencode_plugin ".opencode/plugins/multi-account" -Recurse -Force

# Windows (CMD):
if not exist ".opencode\plugins" mkdir ".opencode\plugins"
xcopy opencode_plugin ".opencode\plugins\multi-account" /E /I /Y
```

With the prerequisites set, proceed with the following end-to-end GitHub installation steps.

```
- Clone repository
- Masuk ke direktori proyek
- Jalankan npm ci
- Jalankan npm run typecheck
- Jalankan npm run build
- Verifikasi bahwa artefak build menghasilkan dist/index.js
```

### Method 2: Global (for all projects)

```bash
# Salin seluruh folder ke global plugins
# Linux/macOS:
cp -r opencode_plugin ~/.config/opencode/plugins/multi-account

# Windows:
xcopy opencode_plugin %USERPROFILE%\.config\opencode\plugins\multi-account /E /I
```

### Method 3: Via NPM

Once published, you can install the plugin into OpenCode by adding it to the `opencode.json` configuration file:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@rahadiana/opencode-multi-account"]
}
```

### Installation Verification (Mandatory)
- Verifikasi bahwa output build menghasilkan berkas dist/index.js. Jika tidak ada, jalankan ulang build.
- Jalankan perintah berikut untuk verifikasi langkah-langkah dasar:
- node -v (pastikan versi >= 18)
- npm ci
- npm run typecheck
- npm run build
- Periksa bahwa dist/index.js ada dan dapat dimuat oleh plugin OpenCode.
- Opsional: jalankan npm pack untuk memverifikasi struktur paket sebelum publish.

### Troubleshooting
- Unsupported Node.js version: Upgrade Node.js to v18+.
- Build gagal: jalankan `npm ci` lagi, periksa error TypeScript, pastikan environment memiliki TS compiler.
- Plugin not detected in OpenCode: Ensure the plugin folder is in the correct location (global or project-level) and properly configured.
- Account configuration not read: Ensure the account file (e.g., accounts.json) exists, is readable by the plugin, and the path configuration is correct.

### Entrypoint Note
- Entry point runtime dari plugin setelah build adalah dist/index.js. Periksa bahwa package.json mencerminkan path ini untuk publish (main: dist/index.js) agar paket npm berfungsi dengan benar.

### Generator accounts.example.json
- Gunakan skrip berikut untuk membuat atau memperbarui `accounts.example.json`:

```bash
node scripts/generate_accounts_example.mjs
```

- Skrip ini akan:
  - Membaca `accounts.json` (jika ada) dan membuat `accounts.example.json` dengan token yang disanitasi.
  - Membuat template default jika `accounts.json` tidak ditemukan.

- Pastikan untuk menjalankan skrip ini setiap kali struktur `accounts.json` berubah.