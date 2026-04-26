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

### Prasyarat
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

### Cara 1: Project-level (khusus project ini)

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

Dengan prasyarat di atas, lanjutkan dengan langkah instalasi GitHub end-to-end berikut.

```
- Clone repository
- Masuk ke direktori proyek
- Jalankan npm ci
- Jalankan npm run typecheck
- Jalankan npm run build
- Verifikasi bahwa artefak build menghasilkan dist/index.js
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

### Verifikasi Instalasi (Wajib)
- Verifikasi bahwa output build menghasilkan berkas dist/index.js. Jika tidak ada, jalankan ulang build.
- Jalankan perintah berikut untuk verifikasi langkah-langkah dasar:
- node -v (pastikan versi >= 18)
- npm ci
- npm run typecheck
- npm run build
- Periksa bahwa dist/index.js ada dan dapat dimuat oleh plugin OpenCode.
- Opsional: jalankan npm pack untuk memverifikasi struktur paket sebelum publish.

### Troubleshooting
- Node.js versi tidak didukung: upgrade Node.js ke v18+.
- Build gagal: jalankan `npm ci` lagi, periksa error TypeScript, pastikan environment memiliki TS compiler.
- Plugin tidak terbaca di OpenCode: pastikan folder plugin berada di lokasi yang tepat (global atau project-level) dan konfigurasinya sudah benar.
- Config akun tidak terbaca: pastikan file akun (mis. accounts.json) ada dan dapat dibaca oleh plugin, serta path konfigurasinya sudah sesuai.

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