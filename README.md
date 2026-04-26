# 🔌 OpenCode Multi-Account Manager Plugin

A plugin for [OpenCode](https://opencode.ai) that automatically manages multiple API accounts. When one account hits its rate limit, the plugin will **automatically switch to the next account** based on priority.

## ✨ Features

- **Priority Rotation** — Accounts are sorted by priority (P1 → P2 → P3, etc.)
- **Provider-Level Auto-Switch** — When a rate limit is detected for Provider X, rotation occurs only within Provider X's account pool.
- **All Providers Supported** — Compatible with 35+ providers supported by OpenCode (Anthropic, OpenAI, Google, Groq, DeepSeek, OpenRouter, xAI, etc.)
- **Provider Exhausted Notifications** — Alerts you when **all accounts for a provider are exhausted**.
- **Custom Tools** — Manage accounts directly from the OpenCode TUI.
- **Cooldown Tracking** — Rate-limited accounts automatically reactivate after the cooldown period.

## 🛠️ Installation

### Prerequisites
- Node.js 18+ (latest LTS recommended)
- npm
- Git
- Ensure your environment has network access to download dependencies during installation.

### Plugin Folder Location per OS

| OS | Global Plugin Location | Multi-Account Config Location |
|----|-----------------------|-----------------------------|
| Linux | `~/.config/opencode/plugins/` | `~/.config/opencode/multi-account/` |
| macOS | `~/.config/opencode/plugins/` | `~/.config/opencode/multi-account/` |
| Windows (PowerShell) | `$env:USERPROFILE\.config\opencode\plugins\` | `$env:USERPROFILE\.config\opencode\multi-account\` |

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

With the prerequisites set, proceed with the following end-to-end installation steps:

```bash
# Clone the repository
git clone https://github.com/rahadiana/opencode-multi-account.git
cd opencode-multi-account

# Install dependencies and build
npm ci
npm run typecheck
npm run build

# Verify that the build artifact generates dist/index.js
```

### Method 2: Global (for all projects)

```bash
# Copy the entire folder to the global plugins directory
# Linux/macOS:
cp -r opencode-multi-account ~/.config/opencode/plugins/multi-account

# Windows:
xcopy opencode-multi-account %USERPROFILE%\.config\opencode\plugins\multi-account /E /I
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
- Verify that the build output generates the `dist/index.js` file. If missing, rerun the build.
- Run the following commands to verify the basic steps:
  - `node -v` (ensure version >= 18)
  - `npm ci`
  - `npm run typecheck`
  - `npm run build`
- Check that `dist/index.js` exists and can be loaded by the OpenCode plugin system.
- Optional: run `npm pack` to verify the package structure before publishing.

### Troubleshooting
- **Unsupported Node.js version**: Upgrade Node.js to v18+.
- **Build failed**: Run `npm ci` again, check for TypeScript errors, and ensure the environment has the TS compiler.
- **Plugin not detected in OpenCode**: Ensure the plugin folder is in the correct location (global or project-level) and properly configured.
- **Account configuration not read**: Ensure the account file (e.g., `accounts.json`) exists, is readable by the plugin, and the path configuration is correct.

### Entrypoint Note
- The runtime entry point of the plugin after building is `dist/index.js`. Verify that `package.json` reflects this path for publishing (`main: dist/index.js`) so the npm package functions correctly.

### Generator accounts.example.json
Use the following script to create or update `accounts.example.json`:

```bash
node scripts/generate_accounts_example.mjs
```

This script will:
- Read `accounts.json` (if it exists) and generate `accounts.example.json` with sanitized tokens.
- Create a default template if `accounts.json` is not found.

Make sure to run this script whenever the structure of `accounts.json` changes.
